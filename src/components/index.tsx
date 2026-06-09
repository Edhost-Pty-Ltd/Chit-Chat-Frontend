// ─── Shared Components ───────────────────────────────────────────────────────
import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ViewStyle,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';
import { RootStackParamList, ContactStatus } from '../types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// ─── Avatar ──────────────────────────────────────────────────────────────────
interface AvatarProps {
  initials: string;
  color: string;
  size?: number;
  status?: ContactStatus;
  style?: ViewStyle;
}
export function Avatar({ initials, color, size = 44, status: _status, style }: AvatarProps) {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <View style={[styles.avatarCircle, {
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color,
      }]}>
        <Text style={[styles.avatarText, { fontSize: Math.round(size * 0.36) }]}>
          {initials}
        </Text>
      </View>
    </View>
  );
}

// ─── BottomNav ────────────────────────────────────────────────────────────────
type TabKey = 'chats' | 'calls' | 'status' | 'settings';
const TABS: {
  id: TabKey;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconActive: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  screen: keyof RootStackParamList;
}[] = [
  { id: 'chats',    icon: 'chatbubble-outline',      iconActive: 'chatbubble',      label: 'Chats',    screen: 'Chats'    },
  { id: 'calls',    icon: 'call-outline',             iconActive: 'call',            label: 'Calls',    screen: 'Calls'    },
  { id: 'status',   icon: 'radio-button-off-outline', iconActive: 'radio-button-on', label: 'Updates',  screen: 'Status'   },
  { id: 'settings', icon: 'settings-outline',         iconActive: 'settings',        label: 'Settings', screen: 'Settings' },
];

interface BottomNavProps { active: TabKey; }
export function BottomNav({ active }: BottomNavProps) {
  const navigation = useNavigation<NavProp>();
  return (
    <View style={styles.navBar}>
      {TABS.map((t) => {
        const isActive = active === t.id;
        return (
          <TouchableOpacity key={t.id} style={styles.navItem} activeOpacity={0.7}
            onPress={() => navigation.navigate(t.screen as any)}>
            {isActive && <View style={styles.navActiveGlow} />}
            <Ionicons
              name={isActive ? t.iconActive : t.icon}
              size={22}
              color={isActive ? COLORS.blue : COLORS.sub}
            />
            <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{t.label}</Text>
            {isActive && <View style={styles.navDot} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── AppHeader ────────────────────────────────────────────────────────────────
interface AppHeaderProps {
  title: string;
  showBack?: boolean;
  rightIcon?: string;
  onRightPress?: () => void;
}
export function AppHeader({ title, showBack, rightIcon, onRightPress }: AppHeaderProps) {
  const navigation = useNavigation<NavProp>();
  return (
    <View style={styles.header}>
      {showBack ? (
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerSide}>
          <Ionicons name="chevron-back" size={26} color={COLORS.blue} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerSide} />
      )}
      <Text style={styles.headerTitle}>{title}</Text>
      {rightIcon ? (
        <TouchableOpacity onPress={onRightPress} style={[styles.headerSide, { alignItems: 'flex-end' }]}>
          <LinearGradient colors={GRADIENTS.primary} style={styles.headerRightBtn}>
            <Text style={{ fontSize: 15, color: '#fff' }}>{rightIcon}</Text>
          </LinearGradient>
        </TouchableOpacity>
      ) : (
        <View style={styles.headerSide} />
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  avatarCircle: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.50)',
  },
  avatarText: { color: '#fff', fontWeight: '700' },
  statusDot:  { position: 'absolute', borderWidth: 2, borderColor: COLORS.sky1 },

  navBar:       { flexDirection: 'row', ...GLASS.nav, paddingBottom: 24, paddingTop: 10 },
  navItem:      { flex: 1, alignItems: 'center', gap: 3, position: 'relative' },
  navActiveGlow:{ position: 'absolute', top: -6, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(30,156,240,0.12)' },
  navLabel:       { fontSize: 10, fontWeight: '500', color: COLORS.sub },
  navLabelActive: { fontWeight: '700', color: COLORS.blue },
  navDot:         { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.blue, marginTop: 1 },

  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, ...GLASS.header },
  headerSide:     { width: 40 },
  headerTitle:    { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: COLORS.text },
  headerRightBtn: { width: 32, height: 32, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', ...SHADOW.button },
});
