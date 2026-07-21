// ─── Screen: Export Data ─────────────────────────────────────────────────────
// Exports every locally-cached message into a single encrypted .chitchat file
// using exportLocalData(). We generate a random one-time passphrase for the
// user (they can't type their own) and require it to import on the new device.
// The file never leaves the device until the user picks a destination in the
// native share sheet. The temp file is deleted afterwards regardless of outcome.
import React, { useState, useMemo, useCallback } from 'react';
import {
  View, TouchableOpacity, StyleSheet, ScrollView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { AppBg, AppText, AppIcon, useForeground, useTypography, useGlass } from '../context/ThemeContext';
import { COLORS, RADIUS, SHADOW, GRADIENTS } from '../types/theme';
import { RootStackParamList } from '../types';
import {
  exportLocalData,
  shareExportedFile,
  deleteExportedFile,
  ExportProgress,
  ExportResult,
} from '../utils/exportLocalData';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'ExportData'>;

// ── Readable passphrase generator ────────────────────────────────────────────
// 4 random words joined by hyphens, e.g. "river-maple-cobalt-lantern".
// Memorable, easy to re-type on the other device, and comfortably longer than
// the utility's 6-character minimum.
const WORDS = [
  'river', 'maple', 'cobalt', 'lantern', 'harbor', 'ember', 'willow', 'meadow',
  'pebble', 'summit', 'orchid', 'falcon', 'marble', 'cedar', 'copper', 'violet',
  'canyon', 'breeze', 'garnet', 'thistle', 'saffron', 'juniper', 'anchor', 'quartz',
  'mango', 'pine', 'coral', 'aspen', 'onyx', 'indigo', 'raven', 'lotus',
];

function generatePassphrase(): string {
  const pick = () => WORDS[Math.floor(Math.random() * WORDS.length)];
  return [pick(), pick(), pick(), pick()].join('-');
}

// ── Progress stage → human label + step index ────────────────────────────────
const STAGE_ORDER: ExportProgress['stage'][] = ['reading', 'encrypting', 'writing', 'done'];
const STAGE_LABEL: Record<ExportProgress['stage'], string> = {
  reading: 'Reading your messages…',
  encrypting: 'Encrypting your backup…',
  writing: 'Writing the backup file…',
  done: 'Finalizing…',
};

export default function ExportDataScreen() {
  const navigation = useNavigation<NavProp>();
  const { FG } = useForeground();
  const { fontFamily, textColor } = useTypography();
  const { bevel } = useGlass();

  // Generate the passphrase once per screen mount.
  const [passphrase] = useState(generatePassphrase);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentStep = progress ? STAGE_ORDER.indexOf(progress.stage) + 1 : 0;

  const handleExport = useCallback(async () => {
    setErrorMsg(null);
    setResult(null);
    setExporting(true);
    setProgress({ stage: 'reading' });

    let exportRes: ExportResult;
    try {
      exportRes = await exportLocalData(passphrase, (p) => setProgress(p));
    } catch (e: any) {
      setExporting(false);
      setProgress(null);
      setErrorMsg('Something went wrong while creating your backup. Please try again.');
      return;
    }

    if (!exportRes.success || !exportRes.fileUri) {
      setExporting(false);
      setProgress(null);
      setErrorMsg(exportRes.error ?? 'Could not create your backup. Please try again.');
      return;
    }

    // Success — show the summary, then open the share sheet.
    setResult(exportRes);
    setExporting(false);

    const fileUri = exportRes.fileUri;
    try {
      await shareExportedFile(fileUri);
    } catch {
      // Share failing (or being cancelled) is not fatal — the summary stays on
      // screen so the user can retry the share via the button below.
    } finally {
      // Always clean up the temp file so it never lingers, whether the user
      // completed the share or cancelled it.
      await deleteExportedFile(fileUri);
    }
  }, [passphrase]);

  // Re-open the share sheet is not possible after cleanup (file deleted), so
  // "share again" re-runs the whole export to regenerate a fresh file.
  const shareDisabled = exporting;

  return (
    <View style={styles.root}>
      <AppBg />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: FG.glassBg, borderBottomColor: FG.glassBorder }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} disabled={exporting}>
          <AppIcon name="chevron-back" size={26} color={exporting ? COLORS.textFaint : COLORS.blue} fixedColor />
        </TouchableOpacity>
        <AppText style={[styles.title, { color: textColor, fontFamily }]}>Export My Data</AppText>
        <View style={styles.back} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Explanation */}
        <View style={[styles.card, bevel]}>
          <AppText style={[styles.bodyText, { color: FG.secondary }]}>
            This creates an encrypted backup of the messages stored on this device — including
            older ones that may no longer be in the cloud. The file stays{' '}
            <AppText fixedColor style={[styles.strong, { color: textColor }]}>entirely on your device</AppText>{' '}
            until you choose where to send it. Nothing is uploaded to any server.
          </AppText>
        </View>

        {/* Passphrase */}
        <AppText style={[styles.sectionLabel, { color: FG.secondary }]}>YOUR ONE-TIME PASSPHRASE</AppText>
        <View style={[styles.card, bevel]}>
          <View style={styles.passphraseBox}>
            <AppText fixedColor style={[styles.passphraseText, { color: textColor }]} selectable>
              {passphrase}
            </AppText>
          </View>

          <View style={styles.warnRow}>
            <AppIcon name="warning-outline" size={16} color={COLORS.missed} fixedColor />
            <AppText fixedColor style={styles.warnText}>
              You'll need this passphrase to import on the new device. Write it down now — it
              cannot be recovered if lost.
            </AppText>
          </View>
        </View>

        {/* Progress */}
        {exporting && progress && (
          <View style={[styles.card, bevel, styles.progressCard]}>
            <ActivityIndicator size="small" color={COLORS.blue} />
            <View style={{ flex: 1 }}>
              <AppText style={[styles.progressLabel, { color: textColor }]}>
                {STAGE_LABEL[progress.stage]}
              </AppText>
              <AppText style={[styles.progressStep, { color: FG.secondary }]}>
                Step {currentStep} of {STAGE_ORDER.length}
              </AppText>
            </View>
          </View>
        )}

        {/* Error */}
        {errorMsg && !exporting && (
          <View style={[styles.card, bevel, styles.errorCard]}>
            <AppIcon name="alert-circle-outline" size={18} color={COLORS.missed} fixedColor />
            <AppText fixedColor style={styles.errorText}>{errorMsg}</AppText>
          </View>
        )}

        {/* Success summary */}
        {result?.success && !exporting && (
          <View style={[styles.card, bevel, styles.successCard]}>
            <View style={styles.successHead}>
              <AppIcon name="checkmark-circle-outline" size={20} color={COLORS.blue} fixedColor />
              <AppText style={[styles.successTitle, { color: textColor }]}>Backup ready</AppText>
            </View>
            <AppText style={[styles.bodyText, { color: FG.secondary }]}>
              Exported{' '}
              <AppText fixedColor style={[styles.strong, { color: textColor }]}>
                {result.messageCount} message{result.messageCount === 1 ? '' : 's'}
              </AppText>{' '}
              from{' '}
              <AppText fixedColor style={[styles.strong, { color: textColor }]}>
                {result.chatCount} chat{result.chatCount === 1 ? '' : 's'}
              </AppText>. If the share sheet didn't appear, tap below to create and share it again.
            </AppText>
          </View>
        )}

        {/* Action button */}
        <TouchableOpacity onPress={handleExport} activeOpacity={0.85} disabled={shareDisabled}>
          <LinearGradient colors={GRADIENTS.primary} style={[styles.primaryBtn, shareDisabled && styles.btnDisabled]}>
            {exporting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <AppText fixedColor style={styles.primaryBtnText}>
                {result?.success ? 'Export Again' : 'Start Export'}
              </AppText>
            )}
          </LinearGradient>
        </TouchableOpacity>
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

  card:      { borderRadius: RADIUS.lg, padding: 16 },
  bodyText:  { fontSize: 13, lineHeight: 19 },
  strong:    { fontWeight: '700' },

  sectionLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.2,
    paddingHorizontal: 4, paddingBottom: 2, paddingTop: 8,
  },

  passphraseBox: {
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(30,156,240,0.10)',
    borderWidth: 1, borderColor: 'rgba(30,156,240,0.25)',
    paddingVertical: 16, paddingHorizontal: 14, alignItems: 'center',
  },
  passphraseText: { fontSize: 20, fontWeight: '800', letterSpacing: 0.5, textAlign: 'center' },

  warnRow:  { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 12 },
  warnText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700', color: COLORS.missed },

  progressCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressLabel: { fontSize: 14, fontWeight: '600' },
  progressStep:  { fontSize: 12, marginTop: 2 },

  errorCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  errorText: { flex: 1, fontSize: 13, lineHeight: 18, color: COLORS.missed, fontWeight: '500' },

  successCard: { gap: 8 },
  successHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  successTitle: { fontSize: 15, fontWeight: '700' },

  primaryBtn:     { borderRadius: RADIUS.md, paddingVertical: 15, alignItems: 'center', ...SHADOW.button, marginTop: 8 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnDisabled:    { opacity: 0.6 },
});
