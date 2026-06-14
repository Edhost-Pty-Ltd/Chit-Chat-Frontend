// ─── Screen: Profile ─────────────────────────────────────────────────────────
import React, { useRef, useState } from 'react';
import {
  View, TouchableOpacity, StyleSheet, ScrollView,
  Image, Alert, Platform, TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { doc, updateDoc } from 'firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { AppBg, AppText, AppIcon, useForeground, useTypography } from '../context/ThemeContext';
import { COLORS, RADIUS, SHADOW, GLASS } from '../types/theme';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { phone, displayName, setDisplayName, avatarUri, setAvatarUri } = useAuth();
  const { FG }  = useForeground();
  const { fontFamily, textColor } = useTypography();

  const [editingName, setEditingName] = useState(false);
  const [draftName,   setDraftName]   = useState(displayName || 'John Doe');
  const nameInputRef = useRef<TextInput>(null);

  const shownName = displayName || 'John Doe';

  // ── Save name ─────────────────────────────────────────────────────────────
  const saveName = async () => {
    const trimmed = draftName.trim();
    if (!trimmed) {
      setEditingName(false);
      return;
    }
    
    try {
      // Save to AsyncStorage via context
      await setDisplayName(trimmed);
      
      // Also save to Firestore so other users can see the updated name
      const authInstance = getAuth();
      const currentUser = authInstance.currentUser;
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, { displayName: trimmed });
        console.log('[ProfileScreen] Updated displayName in Firestore:', trimmed);
      }
    } catch (error) {
      console.error('[ProfileScreen] Error saving displayName:', error);
      Alert.alert('Error', 'Failed to save display name. Please try again.');
    }
    
    setEditingName(false);
  };

  // ── Pick photo ────────────────────────────────────────────────────────────
  const pickPhoto = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to update your picture.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      
      try {
        const authInstance = getAuth();
        const currentUser = authInstance.currentUser;
        
        if (!currentUser) {
          Alert.alert('Error', 'Not signed in');
          return;
        }
        
        // Upload to Firebase Storage first
        console.log('[ProfileScreen] Uploading profile picture to Firebase Storage...');
        const { uploadFile, generateFileName } = await import('../config/storage');
        
        const fileName = generateFileName('jpg');
        const downloadURL = await uploadFile(uri, 'avatar', {
          userId: currentUser.uid,
          fileName,
        }, (progress) => {
          console.log(`[ProfileScreen] Upload progress: ${progress}%`);
        });
        
        console.log('[ProfileScreen] Upload complete, download URL:', downloadURL);
        
        // Save local URI to AsyncStorage for immediate UI update
        await setAvatarUri(uri);
        
        // Save download URL to Firestore so other users can access it
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, { photoURL: downloadURL });
        console.log('[ProfileScreen] Updated photoURL in Firestore');
        
        Alert.alert('Success', 'Profile picture updated successfully');
      } catch (error: any) {
        console.error('[ProfileScreen] Error saving avatar:', error);
        Alert.alert('Error', `Failed to save profile picture: ${error.message}`);
      }
    }
  };

  const initials = shownName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <View style={styles.root}>
      <AppBg />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: FG.glassBg, borderBottomColor: FG.glassBorder }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <AppIcon glass tileSize={36} name="chevron-back" size={20} />
        </TouchableOpacity>
        <AppText style={[styles.headerTitle, { color: textColor, fontFamily }]}>Profile</AppText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Avatar ── */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickPhoto} activeOpacity={0.85} style={styles.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
            ) : (
              <LinearGradient colors={[COLORS.blue, COLORS.blueDark]} style={styles.avatarPlaceholder}>
                <AppText fixedColor style={styles.avatarInitials}>{initials}</AppText>
              </LinearGradient>
            )}
            <View style={[styles.cameraBadge, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}>
              <AppIcon name="camera" size={16} fixedColor color={COLORS.blue} />
            </View>
          </TouchableOpacity>
          <AppText style={[styles.tapHint, { color: FG.secondary, fontFamily }]}>
            Tap photo to change
          </AppText>
        </View>

        {/* ── Info cards ── */}
        <View style={styles.section}>

          {/* Name — tap anywhere on the card to edit */}
          <TouchableOpacity
            style={[styles.infoCard, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}
            activeOpacity={0.8}
            onPress={() => {
              setDraftName(shownName);
              setEditingName(true);
              setTimeout(() => nameInputRef.current?.focus(), 50);
            }}
          >
            <AppIcon glass tileSize={40} name="person-outline" size={20} />
            <View style={styles.infoContent}>
              <AppText style={[styles.infoLabel, { color: FG.secondary, fontFamily }]}>Name</AppText>
              {editingName ? (
                <TextInput
                  ref={nameInputRef}
                  style={[styles.infoInput, { color: textColor, fontFamily, borderBottomColor: COLORS.blue }]}
                  value={draftName}
                  onChangeText={setDraftName}
                  returnKeyType="done"
                  onSubmitEditing={saveName}
                  onBlur={saveName}
                  autoFocus
                />
              ) : (
                <AppText style={[styles.infoValue, { color: textColor, fontFamily }]}>
                  {shownName}
                </AppText>
              )}
            </View>
            {/* Save button only shown while editing */}
            {editingName && (
              <TouchableOpacity onPress={saveName} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <AppIcon glass tileSize={34} name="checkmark" size={16} fixedColor color={COLORS.blue} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          {/* Phone */}
          <View style={[styles.infoCard, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}>
            <AppIcon glass tileSize={40} name="call-outline" size={20} />
            <View style={styles.infoContent}>
              <AppText style={[styles.infoLabel, { color: FG.secondary, fontFamily }]}>Phone Number</AppText>
              <AppText style={[styles.infoValue, { color: textColor, fontFamily }]}>
                {phone || 'Not set'}
              </AppText>
            </View>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 14,
    gap: 8, borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 17, fontWeight: '700', color: COLORS.text,
  },

  scroll: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 48, gap: 20 },

  // Avatar
  avatarSection: { alignItems: 'center', gap: 10 },
  avatarWrap:    { width: 110, height: 110, borderRadius: 55, ...SHADOW.glow },
  avatarImg: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.50)',
  },
  avatarPlaceholder: {
    width: 110, height: 110, borderRadius: 55,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.40)',
  },
  avatarInitials: { fontSize: 38, fontWeight: '800', color: '#fff' },
  cameraBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, ...SHADOW.button,
  },
  tapHint: { fontSize: 12, color: COLORS.sub },

  // Info cards
  section:  { gap: 10 },
  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    ...GLASS.card, borderRadius: RADIUS.lg,
    paddingHorizontal: 14, paddingVertical: 14, ...SHADOW.card,
  },
  infoContent: { flex: 1 },
  infoLabel:   { fontSize: 11, fontWeight: '600', color: COLORS.sub, marginBottom: 3 },
  infoValue:   { fontSize: 15, fontWeight: '600', color: COLORS.text },
  infoInput: {
    fontSize: 15, fontWeight: '600', color: COLORS.text,
    borderBottomWidth: 1.5, paddingBottom: 2,
    padding: 0, margin: 0,
  },
});
