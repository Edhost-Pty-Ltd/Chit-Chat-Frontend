// ─── Screen: Cloud Backup ────────────────────────────────────────────────────
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../components';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const INCLUDED_ITEMS: { icon: IoniconName; label: string }[] = [
  { icon: 'chatbubbles-outline',   label: 'Messages' },
  { icon: 'people-outline',        label: 'Contacts' },
  { icon: 'images-outline',        label: 'Media'    },
  { icon: 'document-text-outline', label: 'Notes'    },
  { icon: 'settings-outline',      label: 'Settings' },
];

export default function CloudBackupScreen() {
  const [backing, setBacking] = useState(false);
  const [done,    setDone]    = useState(false);

  const handleBackup = () => {
    setBacking(true); setDone(false);
    setTimeout(() => { setBacking(false); setDone(true); }, 1800);
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={GRADIENTS.bg} style={StyleSheet.absoluteFill} />
      <AppHeader title="Cloud Backup" showBack />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Hero gradient card */}
        <LinearGradient colors={GRADIENTS.sky} style={styles.heroCard}>
          <View style={styles.heroOrb} />
          <View style={styles.cloudIconWrap}>
            <Ionicons name={done ? 'cloud-done' : 'cloud-upload'} size={68} color="#fff" />
            {done && (
              <View style={styles.checkBadge}>
                <Ionicons name="checkmark" size={13} color="#fff" />
              </View>
            )}
          </View>
          <Text style={styles.heroTitle}>{done ? 'Backup Complete!' : 'Your data is safe.'}</Text>
          <Text style={styles.heroSub}>
            {done ? 'All your data has been backed up successfully.' : 'Unlimited storage · Non-Stop Backup'}
          </Text>
          <TouchableOpacity onPress={handleBackup} activeOpacity={0.85} disabled={backing}>
            <View style={[styles.backupBtn, backing && styles.backupBtnDisabled]}>
              {backing && <Ionicons name="sync" size={15} color={COLORS.blueDeep} style={{ marginRight: 6 }} />}
              <Text style={styles.backupBtnText}>{backing ? 'Backing up…' : 'Back Up Now'}</Text>
            </View>
          </TouchableOpacity>
        </LinearGradient>

        {/* Section label */}
        <Text style={styles.sectionTitle}>WHAT'S INCLUDED</Text>

        {/* Each included item = individual glass card */}
        {INCLUDED_ITEMS.map((item) => (
          <View key={item.label} style={styles.includedCard}>
            <View style={styles.includedIconBox}>
              <Ionicons name={item.icon} size={20} color={COLORS.blue} />
            </View>
            <Text style={styles.includedLabel}>{item.label}</Text>
            <LinearGradient colors={GRADIENTS.primary} style={styles.tick}>
              <Ionicons name="checkmark" size={13} color="#fff" />
            </LinearGradient>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.sky1 },
  scroll: { paddingHorizontal: 14, paddingBottom: 40, gap: 10 },

  heroCard: { borderRadius: RADIUS.lg, padding: 28, alignItems: 'center', overflow: 'hidden', ...SHADOW.glow },
  heroOrb:  { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.10)', top: -60, right: -60 },

  cloudIconWrap: { position: 'relative', marginBottom: 14 },
  checkBadge: {
    position: 'absolute', bottom: 2, right: -4,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.green,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },

  heroTitle: { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 8 },
  heroSub:   { fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 20, marginBottom: 22 },
  backupBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 36, paddingVertical: 13,
    ...SHADOW.button,
  },
  backupBtnDisabled: { opacity: 0.6 },
  backupBtnText:     { fontSize: 15, fontWeight: '700', color: COLORS.blueDeep },

  sectionTitle: { fontSize: 10, fontWeight: '700', color: COLORS.sub, letterSpacing: 1.2, paddingTop: 4 },

  // Each included item = glass card
  includedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    ...GLASS.card, borderRadius: RADIUS.lg,
    paddingHorizontal: 14, paddingVertical: 14,
    ...SHADOW.card,
  },
  includedIconBox: {
    width: 36, height: 36, borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(30,156,240,0.12)',
    borderWidth: 1, borderColor: 'rgba(30,156,240,0.20)',
    alignItems: 'center', justifyContent: 'center',
  },
  includedLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.text },
  tick:          { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
