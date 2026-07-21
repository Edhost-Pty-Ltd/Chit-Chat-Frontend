// ─── Screen: Import Data ─────────────────────────────────────────────────────
// Restores messages from a .chitchat backup file created by Export My Data.
// The user picks the file (pickExportFile), enters the passphrase shown during
// export, and importLocalData() decrypts + merges it into the local cache. The
// user can retry with a different file or passphrase without leaving the screen.
import React, { useState, useCallback } from 'react';
import {
  View, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Platform, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { AppBg, AppText, AppIcon, useForeground, useTypography, useGlass } from '../context/ThemeContext';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';
import { RootStackParamList } from '../types';
import {
  pickExportFile,
  importLocalData,
  ImportProgress,
  ImportResult,
} from '../utils/importLocalData';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'ImportData'>;

// ── Progress stage → human label ─────────────────────────────────────────────
const STAGE_LABEL: Record<ImportProgress['stage'], string> = {
  picking: 'Opening file…',
  decrypting: 'Decrypting your backup…',
  validating: 'Checking the file…',
  merging: 'Restoring your messages…',
  done: 'Finishing up…',
};

// Derive the last path segment as a friendly filename for a file:// URI.
function fileNameFromUri(uri: string): string {
  try {
    const decoded = decodeURIComponent(uri);
    const seg = decoded.split('/').pop() || decoded;
    return seg.split('?')[0] || 'Selected file';
  } catch {
    return 'Selected file';
  }
}

// Turn the utility's error strings into friendly, actionable copy. The decrypt
// failure is the common "wrong passphrase" case and gets the clearest message.
function friendlyError(raw?: string): string {
  if (!raw) return 'Something went wrong. Please try again.';
  const lower = raw.toLowerCase();
  if (lower.includes('decrypt') || lower.includes('passphrase')) {
    return 'Incorrect passphrase — please check it and try again.';
  }
  if (lower.includes('not a valid') || lower.includes('supported')) {
    return "This file isn't a valid Chit-Chat backup. Please select a .chitchat file exported from this app.";
  }
  return raw;
}

export default function ImportDataScreen() {
  const navigation = useNavigation<NavProp>();
  const { FG } = useForeground();
  const { fontFamily, textColor } = useTypography();
  const { bevel } = useGlass();

  const [fileUri, setFileUri] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePick = useCallback(async () => {
    setErrorMsg(null);
    setResult(null);
    const uri = await pickExportFile();
    if (uri) setFileUri(uri);
  }, []);

  const handleImport = useCallback(async () => {
    if (!fileUri) return;
    setErrorMsg(null);
    setResult(null);
    setImporting(true);
    setProgress({ stage: 'decrypting' });

    let importRes: ImportResult;
    try {
      importRes = await importLocalData(fileUri, passphrase, (p) => setProgress(p));
    } catch {
      setImporting(false);
      setProgress(null);
      setErrorMsg('Something went wrong while restoring. Please try again.');
      return;
    }

    setImporting(false);
    setProgress(null);

    if (!importRes.success) {
      setErrorMsg(friendlyError(importRes.error));
      return;
    }
    setResult(importRes);
  }, [fileUri, passphrase]);

  const canImport = !!fileUri && passphrase.length > 0 && !importing;

  // Merging progress detail: "Restoring chat 3 of 12"
  const mergingDetail =
    progress?.stage === 'merging' && progress.totalChats
      ? `Restoring chat ${progress.chatsProcessed ?? 0} of ${progress.totalChats}`
      : null;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppBg />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: FG.glassBg, borderBottomColor: FG.glassBorder }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} disabled={importing}>
          <AppIcon name="chevron-back" size={26} color={importing ? COLORS.textFaint : COLORS.blue} fixedColor />
        </TouchableOpacity>
        <AppText style={[styles.title, { color: textColor, fontFamily }]}>Import My Data</AppText>
        <View style={styles.back} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Explanation */}
        <View style={[styles.card, bevel]}>
          <AppText style={[styles.bodyText, { color: FG.secondary }]}>
            Restore messages from a backup file created on another device. Pick the{' '}
            <AppText fixedColor style={[styles.strong, { color: textColor }]}>.chitchat</AppText>{' '}
            file and enter the passphrase shown when it was exported. Everything is processed{' '}
            <AppText fixedColor style={[styles.strong, { color: textColor }]}>on your device</AppText>.
          </AppText>
        </View>

        {/* Select file */}
        <AppText style={[styles.sectionLabel, { color: FG.secondary }]}>BACKUP FILE</AppText>
        <TouchableOpacity style={[styles.row, bevel]} onPress={handlePick} activeOpacity={0.75} disabled={importing}>
          <AppIcon glass tileSize={38} name="document-attach-outline" size={18} color={COLORS.blue} fixedColor />
          <View style={styles.rowMeta}>
            <AppText style={[styles.rowLabel, { color: textColor, fontFamily }]}>
              {fileUri ? 'Change file' : 'Select File'}
            </AppText>
            {fileUri ? (
              <AppText style={[styles.rowSub, { color: FG.secondary }]} numberOfLines={1}>
                {fileNameFromUri(fileUri)}
              </AppText>
            ) : (
              <AppText style={[styles.rowSub, { color: FG.secondary }]}>
                Choose a .chitchat backup file
              </AppText>
            )}
          </View>
          <AppIcon name="chevron-forward" size={16} color={FG.secondary} />
        </TouchableOpacity>

        {/* Passphrase */}
        {fileUri && (
          <>
            <AppText style={[styles.sectionLabel, { color: FG.secondary }]}>PASSPHRASE</AppText>
            <View style={[styles.inputWrap]}>
              <TextInput
                style={[styles.input, { color: textColor }]}
                placeholder="Enter the export passphrase"
                placeholderTextColor={COLORS.textFaint}
                value={passphrase}
                onChangeText={(t) => { setPassphrase(t); setErrorMsg(null); }}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!importing}
                returnKeyType="done"
                onSubmitEditing={() => { if (canImport) handleImport(); }}
              />
            </View>
          </>
        )}

        {/* Progress */}
        {importing && progress && (
          <View style={[styles.card, bevel, styles.progressCard]}>
            <ActivityIndicator size="small" color={COLORS.blue} />
            <View style={{ flex: 1 }}>
              <AppText style={[styles.progressLabel, { color: textColor }]}>
                {STAGE_LABEL[progress.stage]}
              </AppText>
              {mergingDetail && (
                <AppText style={[styles.progressStep, { color: FG.secondary }]}>{mergingDetail}</AppText>
              )}
            </View>
          </View>
        )}

        {/* Error */}
        {errorMsg && !importing && (
          <View style={[styles.card, bevel, styles.errorCard]}>
            <AppIcon name="alert-circle-outline" size={18} color={COLORS.missed} fixedColor />
            <AppText fixedColor style={styles.errorText}>{errorMsg}</AppText>
          </View>
        )}

        {/* Success summary */}
        {result?.success && !importing && (
          <View style={[styles.card, bevel, styles.successCard]}>
            <View style={styles.successHead}>
              <AppIcon name="checkmark-circle-outline" size={20} color={COLORS.blue} fixedColor />
              <AppText style={[styles.successTitle, { color: textColor }]}>Restore complete</AppText>
            </View>
            <AppText style={[styles.bodyText, { color: FG.secondary }]}>
              Restored{' '}
              <AppText fixedColor style={[styles.strong, { color: textColor }]}>
                {result.messageCount} message{result.messageCount === 1 ? '' : 's'}
              </AppText>{' '}
              across{' '}
              <AppText fixedColor style={[styles.strong, { color: textColor }]}>
                {result.chatCount} chat{result.chatCount === 1 ? '' : 's'}
              </AppText>.
            </AppText>

            {!!result.chatsSummary?.length && (
              <View style={styles.summaryList}>
                {result.chatsSummary.map((c, i) => (
                  <View key={c.chatId} style={[styles.summaryRow, i > 0 && styles.summaryRowBorder, { borderTopColor: FG.glassBorder }]}>
                    <AppText style={[styles.summaryChat, { color: textColor }]} numberOfLines={1}>
                      Chat {i + 1}
                    </AppText>
                    <AppText style={[styles.summaryCount, { color: FG.secondary }]}>
                      {c.messageCount} msg{c.messageCount === 1 ? '' : 's'}
                    </AppText>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Action button */}
        {fileUri && (
          <TouchableOpacity onPress={handleImport} activeOpacity={0.85} disabled={!canImport}>
            <LinearGradient colors={GRADIENTS.primary} style={[styles.primaryBtn, !canImport && styles.btnDisabled]}>
              {importing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <AppText fixedColor style={styles.primaryBtnText}>
                  {result?.success ? 'Restore Again' : 'Restore Data'}
                </AppText>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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

  card:     { borderRadius: RADIUS.lg, padding: 16 },
  bodyText: { fontSize: 13, lineHeight: 19 },
  strong:   { fontWeight: '700' },

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

  inputWrap: { ...GLASS.input, borderRadius: RADIUS.md, flexDirection: 'row', alignItems: 'center' },
  input:     { flex: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15 },

  progressCard:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressLabel: { fontSize: 14, fontWeight: '600' },
  progressStep:  { fontSize: 12, marginTop: 2 },

  errorCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  errorText: { flex: 1, fontSize: 13, lineHeight: 18, color: COLORS.missed, fontWeight: '500' },

  successCard:  { gap: 8 },
  successHead:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  successTitle: { fontSize: 15, fontWeight: '700' },

  summaryList: { marginTop: 6 },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryRowBorder: { borderTopWidth: 1 },
  summaryChat:  { flex: 1, fontSize: 13, fontWeight: '500' },
  summaryCount: { fontSize: 12, fontWeight: '600' },

  primaryBtn:     { borderRadius: RADIUS.md, paddingVertical: 15, alignItems: 'center', ...SHADOW.button, marginTop: 8 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnDisabled:    { opacity: 0.6 },
});
