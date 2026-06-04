// ─── Shared Components ────────────────────────────────────────────────────────
import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ViewStyle,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, RADIUS, SHADOW } from '../types/theme';
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

export function Avatar({ initials, color, size = 44, status, style }: AvatarProps) {
  const dotSize = Math.round(size * 0.27);

  return (
    <View style={[{ width: size, height: size }, style]}>
      {/* Circle */}
      <View style={[styles.avatarCircle, {
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color,
      }]}>
        <Text style={[styles.avatarText, { fontSize: Math.round(size * 0.36) }]}>
          {initials}
        </Text>
      </View>

      {/* Online dot */}
      {status && (
        <View style={[styles.statusDot, {
          width: dotSize, height: dotSize, borderRadius: dotSize / 2,
          bottom: 0, right: 0,
          backgroundColor:
            status === 'online'  ? COLORS.green  :
            status === 'away'    ? '#f59e0b'      : '#94a3b8',
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

interface BottomNavProps {
  active: TabKey;
}

export function BottomNav({ active }: BottomNavProps) {
  const navigation = useNavigation<NavProp>();

  return (
    <View style={styles.navBar}>
      {TABS.map((t) => {
        const isActive = active === t.id;
        return (
          <TouchableOpacity
            key={t.id}
            style={styles.navItem}
            activeOpacity={0.7}
            onPress={() => t.screen && navigation.navigate(t.screen as any)}
          >
            <Text style={styles.navIcon}>{t.icon}</Text>
            <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
              {t.label}
            </Text>
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Text style={styles.headerBackText}>‹</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.headerBack} />
      )}
      <Text style={styles.headerTitle}>{title}</Text>
      {rightIcon ? (
        <TouchableOpacity onPress={onRightPress} style={styles.headerRight}>
          <View style={styles.headerRightBtn}>
            <Text style={{ fontSize: 16 }}>{rightIcon}</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={styles.headerRight} />
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Avatar
  avatarCircle: {
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.card,
  },
  avatarText: {
    color: '#fff', fontWeight: '700',
  },
  statusDot: {
    position: 'absolute',
    borderWidth: 2, borderColor: COLORS.sky1,
  },

  // BottomNav
  navBar: {
    flexDirection: 'row',
    borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingBottom: 24, paddingTop: 8,
  },
  navItem: {
    flex: 1, alignItems: 'center', gap: 3,
  },
  navIcon: { fontSize: 20 },
  navLabel: { fontSize: 10, fontWeight: '500', color: COLORS.sub },
  navLabelActive: { fontWeight: '700', color: COLORS.blue },
  navDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: COLORS.blue, marginTop: 1,
  },

  // AppHeader
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  headerBack: { width: 40 },
  headerBackText: { fontSize: 28, color: COLORS.blue, fontWeight: '300' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: COLORS.blueDeep },
  headerRight: { width: 40, alignItems: 'flex-end' },
  headerRightBtn: {
    width: 32, height: 32, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.blue,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.button,
  },
});