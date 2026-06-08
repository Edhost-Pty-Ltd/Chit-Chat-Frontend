// ─── Shared Components — Glassmorphism Edition ───────────────────────────────
import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ViewStyle, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, GLASS, RADIUS, SHADOW, GRADIENTS } from '../types/theme';
import { RootStackParamList, ContactStatus } from '../types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// ─── GlassCard ───────────────────────────────────────────────────────────────
// Wrapper that renders BlurView on native, plain View on web
interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  intensity?: number;
}

export function GlassCard({ children, style, intensity = 55 }: GlassCardProps) {
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.glassCardWeb, style]}>
        {children}
      </View>
    );
  }
  return (
    <BlurView intensity={intensity} tint="light" style={[styles.glassCardNative, style]}>
      {children}
    </BlurView>
  );
}

// ─── Avatar ──────────────────────────────────────────────────────────────────
interface AvatarProps {
  initials: string;
  color: string;
  size?: number;
  status?: ContactStatus;
  style?: ViewStyle;
}

export function Avatar({ initials, color, size = 44, status, style }: AvatarProps) {
  const dotSize = Math.round(size * 0.27);
  return (
    <View style={[{ width: size, height: size }, style]}>
      {/* Glass ring behind avatar */}
      <View style={[styles.avatarRing, {
        width: size + 4, height: size + 4,
        borderRadius: (size + 4) / 2,
        top: -2, left: -2,
      }]} />
      {/* Coloured circle */}
      <View style={[styles.avatarCircle, {
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color,
      }]}>
        <Text style={[styles.avatarText, { fontSize: Math.round(size * 0.36) }]}>
          {initials}
        </Text>
      </View>
      {/* Status dot */}
      {status && (
        <View style={[styles.statusDot, {
          width: dotSize, height: dotSize, borderRadius: dotSize / 2,
          bottom: 0, right: 0,
          backgroundColor:
            status === 'online' ? COLORS.green :
            status === 'away'   ? COLORS.amber  : 'rgba(255,255,255,0.30)',
        }]} />
      )}
    </View>
  );
}

// ─── BottomNav ────────────────────────────────────────────────────────────────
type TabKey = 'chats' | 'calls' | 'contacts' | 'status' | 'more';

const TABS: { id: TabKey; icon: string; label: string; screen?: keyof RootStackParamList }[] = [
  { id: 'chats',    icon: '💬', label: 'Chats',    screen: 'Chats'  },
  { id: 'calls',    icon: '📞', label: 'Calls',    screen: 'Calls'  },
  { id: 'contacts', icon: '👥', label: 'Contacts'                   },
  { id: 'status',   icon: '🔄', label: 'Updates',  screen: 'Status' },
  { id: 'more',     icon: '⋯',  label: 'More'                       },
];

interface BottomNavProps { active: TabKey; }

export function BottomNav({ active }: BottomNavProps) {
  const navigation = useNavigation<NavProp>();

  const inner = (
    <View style={styles.navInner}>
      {TABS.map((t) => {
        const isActive = active === t.id;
        return (
          <TouchableOpacity
            key={t.id}
            style={styles.navItem}
            activeOpacity={0.7}
            onPress={() => t.screen && navigation.navigate(t.screen as any)}
          >
            {isActive && (
              <LinearGradient colors={GRADIENTS.primary} style={styles.navActivePill} />
            )}
            <Text style={styles.navIcon}>{t.icon}</Text>
            <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (Platform.OS === 'web') {
    return <View style={[styles.navBarWeb]}>{inner}</View>;
  }
  return (
    <BlurView intensity={70} tint="dark" style={styles.navBarNative}>
      {inner}
    </BlurView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // GlassCard
  glassCardWeb: {
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    // CSS backdrop-filter via boxShadow workaround on web
  },
  glassCardNative: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },

  // Avatar
  avatarRing: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  avatarCircle: {
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.card,
  },
  avatarText: { color: '#fff', fontWeight: '700' },
  statusDot: {
    position: 'absolute',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
  },

  // BottomNav
  navBarNative: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.18)',
    paddingBottom: 28,
  },
  navBarWeb: {
    backgroundColor: 'rgba(10,36,99,0.75)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.18)',
    paddingBottom: 12,
  },
  navInner: {
    flexDirection: 'row',
    paddingTop: 10,
  },
  navItem: {
    flex: 1, alignItems: 'center', gap: 4,
    position: 'relative', paddingVertical: 2,
  },
  navActivePill: {
    position: 'absolute',
    top: -4, width: '70%', height: '140%',
    borderRadius: RADIUS.full,
    opacity: 0.25,
  },
  navIcon:        { fontSize: 20 },
  navLabel:       { fontSize: 10, fontWeight: '500', color: 'rgba(255,255,255,0.55)' },
  navLabelActive: { fontWeight: '700', color: '#fff' },
});
