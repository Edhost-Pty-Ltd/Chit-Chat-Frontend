// ─── Shared Components ───────────────────────────────────────────────────────
import React from 'react';
import {
  View, TouchableOpacity, StyleSheet, ViewStyle, Image,
} from 'react-native';import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';
import { RootStackParamList, ContactStatus } from '../types';
import { AppText, AppIcon, useForeground, useTypography } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

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
        <AppText style={[styles.avatarText, { fontSize: Math.round(size * 0.36) }]}>
          {initials}
        </AppText>
      </View>
    </View>
  );
}// ─── BottomNav ────────────────────────────────────────────────────────────────
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
  const { FG } = useForeground();
  const { fontFamily, textColor } = useTypography();

  return (
    <View style={styles.navBarWrapper}>
    <View style={[styles.navBar, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}>
      {TABS.map((t) => {
        const isActive = active === t.id;
        return (
          <TouchableOpacity
            key={t.id}
            style={styles.navItem}
            activeOpacity={0.75}
            onPress={() => navigation.navigate(t.screen as any)}
          >
            {isActive ? (
              <LinearGradient colors={GRADIENTS.primary} style={styles.iconTileActive}>
                <AppIcon name={t.iconActive} size={20} color="#fff" fixedColor />
              </LinearGradient>
            ) : (
              <View style={styles.iconTileInactive}>
                <AppIcon name={t.icon} size={20} color={FG.secondary} />
              </View>
            )}
            <AppText style={[
              styles.navLabel,
              { color: isActive ? COLORS.blue : FG.secondary, fontFamily },
              isActive && styles.navLabelActive,
            ]}>
              {t.label}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </View>
    </View>
  );
}

// ─── UserAvatar ───────────────────────────────────────────────────────────────
// Renders the signed-in user's profile picture (or initials fallback).
interface UserAvatarProps { size?: number; }
export function UserAvatar({ size = 44 }: UserAvatarProps) {
  const { avatarUri, displayName } = useAuth();
  const name     = displayName || 'JD';
  const initials = name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  if (avatarUri) {
    return (
      <Image
        source={{ uri: avatarUri }}
        style={{
          width: size, height: size, borderRadius: size / 2,
          borderWidth: 2, borderColor: 'rgba(255,255,255,0.50)',
        }}
      />
    );
  }
  return <Avatar initials={initials} color={COLORS.blue} size={size} />;
}
interface AppHeaderProps {
  title: string;
  showBack?: boolean;
  rightIcon?: string;
  onRightPress?: () => void;
}
export function AppHeader({ title, showBack, rightIcon, onRightPress }: AppHeaderProps) {
  const navigation = useNavigation<NavProp>();
  const { FG } = useForeground();
  const { fontFamily, textColor } = useTypography();
  return (
    <View style={[styles.header, { backgroundColor: FG.glassBg, borderBottomColor: FG.glassBorder }]}>
      {showBack ? (
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerSide}>
          <AppIcon name="chevron-back" size={26} color={COLORS.blue} fixedColor />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerSide} />
      )}
      <AppText style={[styles.headerTitle, { color: textColor, fontFamily }]}>{title}</AppText>
      {rightIcon ? (
        <TouchableOpacity onPress={onRightPress} style={[styles.headerSide, { alignItems: 'flex-end' }]}>
          <LinearGradient colors={GRADIENTS.primary} style={styles.headerRightBtn}>
            <AppText style={{ fontSize: 15, color: '#fff' }}>{rightIcon}</AppText>
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
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
  },
  avatarText: { color: '#fff', fontWeight: '700' },
  statusDot:  { position: 'absolute', borderWidth: 2, borderColor: COLORS.sky1 },

  navBarWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    paddingTop: 6,
  },
  navBar: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 50,
    paddingVertical: 10,
    paddingHorizontal: 8,
    overflow: 'hidden',
    shadowColor: '#0e6ea8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },

  // Active — blue gradient tile with glow
  iconTileActive: {
    width: 46,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.button,
  },

  // Inactive — plain container, no glass tile (avoids Android overflow artifacts)
  iconTileInactive: {
    width: 46,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  navLabel:       { fontSize: 10, fontWeight: '500' },
  navLabelActive: { fontWeight: '700', color: COLORS.blue },

  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, ...GLASS.header },
  headerSide:     { width: 40 },
  headerTitle:    { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: COLORS.text },
  headerRightBtn: { width: 32, height: 32, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', ...SHADOW.button },
});
