// ─── Screen: Backup ──────────────────────────────────────────────────────────
// Container for the on-device data transfer feature. Nothing here touches the
// network — export writes an encrypted file the user shares themselves, and
// import reads a file the user picks. This screen just routes to those two
// flows: Settings → Backup → (Export My Data | Import My Data).
import React from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppBg, AppText, AppIcon, useForeground, useTypography, useGlass } from '../context/ThemeContext';
import { COLORS, RADIUS } from '../types/theme';
import { RootStackParamList } from '../types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Backup'>;

// ─── Shared navigation row (mirrors PrivacySettings' Row) ────────────────────
function Row({
  icon, label, sub, onPress,
}: {
  icon: string; label: string; sub?: string; onPress: () => void;
}) {
  const { FG } = useForeground();
  const { fontFamily, textColor, iconColor } = useTypography();
  const { bevel } = useGlass();
  return (
    <TouchableOpacity style={[styles.row, bevel]} onPress={onPress} activeOpacity={0.75}>
      <AppIcon glass tileSize={38} name={icon as any} size={18} color={iconColor} />
      <View style={styles.rowMeta}>
        <AppText style={[styles.rowLabel, { color: textColor, fontFamily }]}>{label}</AppText>
        {sub ? <AppText style={[styles.rowSub, { color: FG.secondary }]}>{sub}</AppText> : null}
      </View>
      <AppIcon name="chevron-forward" size={16} color={FG.secondary} />
    </TouchableOpacity>
  );
}

export default function BackupScreen() {
  const navigation = useNavigation<NavProp>();
  const { FG } = useForeground();
  const { fontFamily, textColor } = useTypography();
  const { bevel } = useGlass();

  return (
    <View style={styles.root}>
      <AppBg />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: FG.glassBg, borderBottomColor: FG.glassBorder }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <AppIcon name="chevron-back" size={26} color={COLORS.blue} fixedColor />
        </TouchableOpacity>
        <AppText style={[styles.title, { color: textColor, fontFamily }]}>Backup</AppText>
        <View style={styles.back} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Explanation card */}
        <View style={[styles.infoCard, bevel]}>
          <View style={styles.infoIconWrap}>
            <AppIcon name="shield-checkmark-outline" size={22} color={COLORS.blue} fixedColor />
          </View>
          <AppText style={[styles.infoText, { color: FG.secondary }]}>
            Save or restore the messages stored on this device — including older ones that may no
            longer be in the cloud. Everything happens{' '}
            <AppText fixedColor style={[styles.infoStrong, { color: textColor }]}>entirely on your device</AppText>.
            Nothing is uploaded to any server; you choose where the backup file goes.
          </AppText>
        </View>

        <AppText style={[styles.sectionLabel, { color: FG.secondary }]}>TRANSFER</AppText>

        <Row
          icon="cloud-download-outline"
          label="Export My Data"
          sub="Create an encrypted backup file to move to another device"
          onPress={() => navigation.navigate('ExportData')}
        />
        <Row
          icon="cloud-upload-outline"
          label="Import My Data"
          sub="Restore messages from a backup file"
          onPress={() => navigation.navigate('ImportData')}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 16 : 52,
    paddingBottom: 12, paddingHorizontal: 14, borderBottomWidth: 1,
  },
  back:  { width: 36, alignItems: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },

  scroll: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 40, gap: 8 },

  infoCard: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    borderRadius: RADIUS.lg, padding: 14, marginBottom: 4,
  },
  infoIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(30,156,240,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  infoText:   { flex: 1, fontSize: 13, lineHeight: 19 },
  infoStrong: { fontWeight: '700' },

  sectionLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.2,
    paddingHorizontal: 4, paddingBottom: 2, paddingTop: 8,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: RADIUS.lg, paddingHorizontal: 14, paddingVertical: 13,
  },
  rowMeta:  { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '500' },
  rowSub:   { fontSize: 12, marginTop: 2 },
});
