// ─── Screen: Account Settings ────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { View, Switch, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { AppBg, AppText, AppIcon, useForeground, useTypography, useGlass } from '../context/ThemeContext';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';
import { RootStackParamList } from '../types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AccountSettings'>;

const BIOMETRIC_KEY = 'auth_biometric_enabled';

type RowProps = {
  icon: string; label: string; sub?: string;
  value?: boolean; onToggle?: (v: boolean) => void;
  onPress?: () => void; danger?: boolean; rightLabel?: string;
};
function Row({ icon, label, sub, value, onToggle, onPress, danger, rightLabel }: RowProps) {
  const { FG } = useForeground();
  const { fontFamily, textColor, iconColor } = useTypography();
  const { bevel } = useGlass();
  return (
    <TouchableOpacity
      style={[styles.row, bevel]}
      onPress={onPress} activeOpacity={onPress ? 0.75 : 1}
    >
      <AppIcon glass tileSize={38} name={icon as any} size={18}
        color={danger ? COLORS.missed : iconColor} fixedColor={danger} />
      <View style={styles.rowMeta}>
        <AppText style={[styles.rowLabel, { color: danger ? COLORS.missed : textColor, fontFamily },
          danger && { fontWeight: '600' }]}>{label}</AppText>
        {sub ? <AppText style={[styles.rowSub, { color: FG.secondary }]}>{sub}</AppText> : null}
      </View>
      {onToggle != null
        ? <Switch value={value} onValueChange={onToggle} trackColor={{ true: COLORS.blue }} />
        : rightLabel
          ? <AppText style={[styles.rightLabel, { color: FG.secondary }]}>{rightLabel}</AppText>
          : onPress ? <AppIcon name="chevron-forward" size={16} color={FG.secondary} /> : null}
    </TouchableOpacity>
  );
}

export default function AccountSettingsScreen() {
  const navigation = useNavigation<NavProp>();
  const { FG } = useForeground();
  const { fontFamily, textColor } = useTypography();
  const { phone, displayName, signOut } = useAuth();

  const [twoFA,            setTwoFA]            = useState(true);
  const [bioLoading,       setBioLoading]       = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(BIOMETRIC_KEY).then((v) => setBiometricEnabled(v === 'true'));
  }, []);

  const handleBiometricToggle = async (enabled: boolean) => {
    if (bioLoading) return;
    setBioLoading(true);
    try {
      await AsyncStorage.setItem(BIOMETRIC_KEY, enabled ? 'true' : 'false');
      setBiometricEnabled(enabled);
    } catch {
      Alert.alert('Error', 'Could not update biometric preference.');
    } finally {
      setBioLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <AppBg />
      <View style={[styles.header, { backgroundColor: FG.glassBg, borderBottomColor: FG.glassBorder }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <AppIcon name="chevron-back" size={26} color={COLORS.blue} fixedColor />
        </TouchableOpacity>
        <AppText style={[styles.title, { color: textColor, fontFamily }]}>Account</AppText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Security */}
        <AppText style={[styles.sectionLabel, { color: FG.secondary }]}>SECURITY</AppText>
        <Row icon="call-outline" label="Phone Number"
          sub={phone || 'Not set'}
          rightLabel="Change"
          onPress={() => navigation.navigate('ChangeNumber')} />
        <Row icon="shield-checkmark-outline" label="Two-Step Verification"
          sub={twoFA ? 'Enabled' : 'Add an extra layer of security'}
          value={twoFA} onToggle={setTwoFA} />
        <Row
          icon="finger-print"
          label="Biometric Login"
          sub={
            bioLoading
              ? 'Verifying…'
              : biometricEnabled
                ? 'Enabled — fingerprint or face ID required on launch'
                : 'Use fingerprint or face ID to sign in'
          }
          value={biometricEnabled}
          onToggle={handleBiometricToggle}
        />

        {/* Account actions */}
        <AppText style={[styles.sectionLabel, { color: FG.secondary }]}>ACCOUNT</AppText>
        <Row icon="trash-outline" label="Delete Account"
          sub="Permanently delete your ChitChat account"
          danger onPress={() =>
            Alert.alert('Delete Account',
              'This will permanently delete your account and all data. This action cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: signOut },
              ])
          } />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'web' ? 16 : 52, paddingBottom: 12, paddingHorizontal: 14, borderBottomWidth: 1 },
  back:   { width: 36 },
  title:  { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  scroll: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 40, gap: 8 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, paddingHorizontal: 4, paddingBottom: 2, paddingTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: RADIUS.lg, paddingHorizontal: 14, paddingVertical: 13 },
  rowMeta:    { flex: 1 },
  rowLabel:   { fontSize: 14, fontWeight: '500' },
  rowSub:     { fontSize: 12, marginTop: 2 },
  rightLabel: { fontSize: 12, fontWeight: '600', color: COLORS.green },
});
