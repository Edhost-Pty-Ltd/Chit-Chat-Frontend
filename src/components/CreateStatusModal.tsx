// ─── Component: CreateStatusModal ─────────────────────────────────────────────
// Modal for creating status updates with image/video picker, text status with
// custom colors, caption input, and preview before posting.

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, RADIUS, SHADOW, GRADIENTS } from '../types/theme';
import { AppBg, AppText, AppIcon, useForeground, useGlass } from '../context/ThemeContext';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface CreateStatusModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (
    mediaType: 'image' | 'video' | 'text',
    mediaUri: string | null,
    caption: string | null,
    backgroundColor: string | null,
    textColor: string | null
  ) => Promise<void>;
}

// ─── Color options for text status ────────────────────────────────────────────

const TEXT_BG_COLORS = [
  { bg: '#1a7fe8', text: '#ffffff' },
  { bg: '#f97316', text: '#ffffff' },
  { bg: '#8b5cf6', text: '#ffffff' },
  { bg: '#ec4899', text: '#ffffff' },
  { bg: '#10b981', text: '#ffffff' },
  { bg: '#f59e0b', text: '#000000' },
  { bg: '#e11d48', text: '#ffffff' },
  { bg: '#06b6d4', text: '#000000' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function CreateStatusModal({ visible, onClose, onCreate }: CreateStatusModalProps) {
  const [mode, setMode] = useState<'select' | 'text' | 'media'>('select');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [caption, setCaption] = useState('');
  const [textStatus, setTextStatus] = useState('');
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [uploading, setUploading] = useState(false);

  const { FG } = useForeground();
  const { bevel } = useGlass();

  // ── Reset state when closing ────────────────────────────────────────────────
  const handleClose = () => {
    setMode('select');
    setMediaUri(null);
    setCaption('');
    setTextStatus('');
    setSelectedColorIndex(0);
    onClose();
  };

  // ── Image/Video picker ──────────────────────────────────────────────────────
  const pickMedia = async (type: 'image' | 'video') => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission required', 'Please allow access to your photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: type === 'image' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 30, // WhatsApp allows 30s videos
      });

      if (!result.canceled && result.assets[0]) {
        setMediaUri(result.assets[0].uri);
        setMediaType(type);
        setMode('media');
      }
    } catch (err) {
      console.error('[CreateStatusModal] Pick media error:', err);
      Alert.alert('Error', 'Failed to pick media');
    }
  };

  const pickCamera = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission required', 'Please allow camera access');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setMediaUri(result.assets[0].uri);
        setMediaType('image');
        setMode('media');
      }
    } catch (err) {
      console.error('[CreateStatusModal] Camera error:', err);
      Alert.alert('Error', 'Failed to open camera');
    }
  };

  // ── Post status ─────────────────────────────────────────────────────────────
  const handlePost = async () => {
    if (uploading) return;

    try {
      setUploading(true);

      if (mode === 'text') {
        if (!textStatus.trim()) {
          Alert.alert('Empty status', 'Please enter some text');
          setUploading(false);
          return;
        }

        const color = TEXT_BG_COLORS[selectedColorIndex];
        await onCreate('text', null, textStatus.trim(), color.bg, color.text);
      } else if (mode === 'media' && mediaUri) {
        await onCreate(mediaType, mediaUri, caption.trim() || null, null, null);
      }

      handleClose();
    } catch (err) {
      console.error('[CreateStatusModal] Post error:', err);
      Alert.alert('Error', 'Failed to post status');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.root}>
        <AppBg />

        {/* ── Selection mode ──────────────────────────────────────────────────── */}
        {mode === 'select' && (
          <>
            <View style={[styles.header, { borderBottomColor: FG.glassBorder }]}>
              <TouchableOpacity onPress={handleClose} style={styles.iconPad}>
                <AppIcon name="close" size={26} color={COLORS.sub} />
              </TouchableOpacity>
              <AppText style={styles.headerTitle}>Create Status</AppText>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.selectContent}>
              <TouchableOpacity
                style={[styles.optionCard, bevel]}
                activeOpacity={0.8}
                onPress={() => setMode('text')}
              >
                <LinearGradient colors={GRADIENTS.primary} style={styles.optionIcon}>
                  <AppIcon name="text-outline" size={28} color="#fff" fixedColor />
                </LinearGradient>
                <View style={styles.optionMeta}>
                  <AppText style={styles.optionTitle}>Text Status</AppText>
                  <AppText style={styles.optionSub}>Share a text update</AppText>
                </View>
                <AppIcon name="chevron-forward" size={20} color={COLORS.sub} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optionCard, bevel]}
                activeOpacity={0.8}
                onPress={() => pickMedia('image')}
              >
                <LinearGradient colors={['#ec4899', '#8b5cf6']} style={styles.optionIcon}>
                  <AppIcon name="image-outline" size={28} color="#fff" fixedColor />
                </LinearGradient>
                <View style={styles.optionMeta}>
                  <AppText style={styles.optionTitle}>Photo</AppText>
                  <AppText style={styles.optionSub}>Share a photo</AppText>
                </View>
                <AppIcon name="chevron-forward" size={20} color={COLORS.sub} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optionCard, bevel]}
                activeOpacity={0.8}
                onPress={() => pickMedia('video')}
              >
                <LinearGradient colors={['#f97316', '#ef4444']} style={styles.optionIcon}>
                  <AppIcon name="videocam-outline" size={28} color="#fff" fixedColor />
                </LinearGradient>
                <View style={styles.optionMeta}>
                  <AppText style={styles.optionTitle}>Video</AppText>
                  <AppText style={styles.optionSub}>Share a video (up to 30s)</AppText>
                </View>
                <AppIcon name="chevron-forward" size={20} color={COLORS.sub} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optionCard, bevel]}
                activeOpacity={0.8}
                onPress={pickCamera}
              >
                <LinearGradient colors={['#06b6d4', '#10b981']} style={styles.optionIcon}>
                  <AppIcon name="camera-outline" size={28} color="#fff" fixedColor />
                </LinearGradient>
                <View style={styles.optionMeta}>
                  <AppText style={styles.optionTitle}>Camera</AppText>
                  <AppText style={styles.optionSub}>Take a photo</AppText>
                </View>
                <AppIcon name="chevron-forward" size={20} color={COLORS.sub} />
              </TouchableOpacity>
            </ScrollView>
          </>
        )}

        {/* ── Text mode ───────────────────────────────────────────────────────── */}
        {mode === 'text' && (
          <>
            <View style={[styles.header, { borderBottomColor: FG.glassBorder }]}>
              <TouchableOpacity onPress={() => setMode('select')} style={styles.iconPad}>
                <AppIcon name="arrow-back" size={26} color={COLORS.sub} />
              </TouchableOpacity>
              <AppText style={styles.headerTitle}>Text Status</AppText>
              <TouchableOpacity onPress={handlePost} disabled={uploading || !textStatus.trim()}>
                {uploading ? (
                  <ActivityIndicator size="small" color={COLORS.blue} />
                ) : (
                  <AppIcon
                    name="checkmark"
                    size={26}
                    color={textStatus.trim() ? COLORS.blue : COLORS.sub}
                  />
                )}
              </TouchableOpacity>
            </View>

            <LinearGradient
              colors={[TEXT_BG_COLORS[selectedColorIndex].bg, '#0a5bb8']}
              style={styles.textPreview}
            >
              <TextInput
                style={[
                  styles.textInput,
                  { color: TEXT_BG_COLORS[selectedColorIndex].text },
                ]}
                placeholder="Type your status..."
                placeholderTextColor={`${TEXT_BG_COLORS[selectedColorIndex].text}80`}
                value={textStatus}
                onChangeText={setTextStatus}
                multiline
                maxLength={700}
              />
            </LinearGradient>

            <View style={[styles.colorPicker, { backgroundColor: FG.glassBg }]}>
              <AppText style={styles.colorLabel}>Background Color</AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorScroll}>
                {TEXT_BG_COLORS.map((color, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => setSelectedColorIndex(index)}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color.bg },
                      selectedColorIndex === index && styles.colorOptionSelected,
                    ]}
                    activeOpacity={0.7}
                  >
                    {selectedColorIndex === index && (
                      <Ionicons name="checkmark" size={20} color={color.text} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </>
        )}

        {/* ── Media mode ──────────────────────────────────────────────────────── */}
        {mode === 'media' && mediaUri && (
          <>
            <View style={[styles.header, { borderBottomColor: FG.glassBorder }]}>
              <TouchableOpacity onPress={() => setMode('select')} style={styles.iconPad}>
                <AppIcon name="arrow-back" size={26} color={COLORS.sub} />
              </TouchableOpacity>
              <AppText style={styles.headerTitle}>Preview</AppText>
              <TouchableOpacity onPress={handlePost} disabled={uploading}>
                {uploading ? (
                  <ActivityIndicator size="small" color={COLORS.blue} />
                ) : (
                  <AppIcon name="checkmark" size={26} color={COLORS.blue} />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.mediaPreview}>
              <Image source={{ uri: mediaUri }} style={styles.mediaImage} resizeMode="contain" />
            </View>

            <View style={[styles.captionInput, bevel]}>
              <TextInput
                style={styles.captionField}
                placeholder="Add a caption..."
                placeholderTextColor={COLORS.sub}
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={200}
              />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  iconPad: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectContent: {
    padding: 16,
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: RADIUS.lg,
  },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.card,
  },
  optionMeta: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  optionSub: {
    fontSize: 13,
    color: COLORS.sub,
    marginTop: 2,
  },
  optionDisabled: {
    opacity: 0.5,
  },
  textPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  textInput: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
  colorPicker: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  colorLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.sub,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  colorScroll: {
    flexDirection: 'row',
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#ffffff',
    ...SHADOW.card,
  },
  mediaPreview: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  captionInput: {
    margin: 16,
    padding: 14,
    borderRadius: RADIUS.lg,
    minHeight: 80,
  },
  captionField: {
    fontSize: 15,
    lineHeight: 20,
  },
});
