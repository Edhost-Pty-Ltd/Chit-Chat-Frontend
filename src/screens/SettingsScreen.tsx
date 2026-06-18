// ─── Screen: Settings ────────────────────────────────────────────────────────
import React from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons'; // kept for IoniconName type
import { Avatar, BottomNav, UserAvatar } from '../components';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';
import { RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';

import { AppBg, AppText, AppIcon, useForeground, useTypography, useTheme } from '../context/ThemeContext';
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type NavProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

const SETTINGS_SECTIONS: {
  label?: string;
  items: { id: string; icon: IoniconName; label: string; danger?: boolean }[];
}[] = [
  {
    label: 'APPS',
    items: [
      { id: 'calendar', icon: 'calendar-outline',      label: 'Calendar'     },
      { id: 'notes',    icon: 'document-text-outline', label: 'Notes'        },
      { id: 'backup',   icon: 'cloud-upload-outline',  label: 'Cloud Backup' },
    ],
  },
  {
    items: [
      { id: 'account',       icon: 'person-outline',        label: 'Account'       },
      { id: 'privacy',       icon: 'lock-closed-outline',   label: 'Privacy'       },
      { id: 'notifications', icon: 'notifications-outline', label: 'Notifications' },
      { id: 'chat',          icon: 'chatbubble-outline',    label: 'Chat'          },
    ],
  },
  {
    items: [
      { id: 'storage',    icon: 'server-outline',         label: 'Data and Storage' },
      { id: 'devices',    icon: 'phone-portrait-outline', label: 'Linked Devices'  },
      { id: 'appearance', icon: 'color-palette-outline',  label: 'Appearance'      },
    ],
  },
  {
    items: [
      { id: 'help',  icon: 'help-circle-outline',        label: 'Help & Support' },
      { id: 'about', icon: 'information-circle-outline', label: 'About'          },
    ],
  },
  {
    items: [{ id: 'signout', icon: 'log-out-outline', label: 'Sign Out', danger: true }],
  },
];

export default function SettingsScreen() {
  const navigation = useNavigation<NavProp>();
  const { signOut, phone, displayName } = useAuth();
  const { FG } = useForeground();
  const { fontFamily, textColor, iconColor } = useTypography();

  const handleItem = (id: string) => {
    if (id === 'signout')    { signOut(); return; }
    if (id === 'backup')     navigation.navigate('CloudBackup');
    if (id === 'calendar')   navigation.navigate('Calendar');
    if (id === 'notes')      navigation.navigate('Notes');
    if (id === 'appearance') navigation.navigate('Appearance');
    if (id === 'account')       navigation.navigate('AccountSettings');
    if (id === 'privacy')       navigation.navigate('PrivacySettings');
    if (id === 'notifications') navigation.navigate('NotificationSettings');
    if (id === 'devices')       navigation.navigate('LinkedDevices');
  };

  return (
    <View style={styles.root}>
      <AppBg />

      <View style={styles.header}>
        <AppText style={[styles.title, { color: textColor, fontFamily }]}>Settings</AppText>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Profile — glass card — tap to open profile */}
        <TouchableOpacity
          style={styles.profileCard}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Profile')}
        >
          <UserAvatar size={54} />
          <View style={styles.profileText}>
            <AppText style={[styles.profileName, { color: textColor, fontFamily }]}>{displayName || 'John Doe'}</AppText>
          </View>
        </TouchableOpacity>

        {/* Each section: label + individual glass cards per row */}
        {SETTINGS_SECTIONS.map((section, si) => (
          <View key={si} style={styles.section}>
            {section.label && <AppText style={[styles.sectionLabel, { color: FG.secondary }]}>{section.label}</AppText>}
            {section.items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.settingsCard}
                activeOpacity={0.75}
                onPress={() => handleItem(item.id)}
              >
                <AppIcon
                  glass
                  tileSize={38}
                  name={item.icon}
                  size={18}
                  color={item.danger ? COLORS.missed : iconColor}
                  fixedColor={item.danger}
                />
                <AppText style={[styles.itemLabel, { color: textColor, fontFamily }, item.danger && styles.itemLabelDanger]}
                  fixedColor={item.danger}
                >
                  {item.label}
                </AppText>
                {!item.danger && null}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>

      <BottomNav active="settings" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sky1 },

  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14 },
  title:  { fontSize: 26, fontWeight: '800', color: COLORS.text },

  scroll: { paddingHorizontal: 14, paddingBottom: 20, gap: 6 },

  // Profile card — blue-tinted glassmorphism
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(180,225,245,0.22)',
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    ...SHADOW.card,
    marginBottom: 10,
  },
  profileText: { flex: 1 },
  profileName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  profileSub:  { fontSize: 12, color: COLORS.sub, marginTop: 2 },

  section:      { gap: 8, marginBottom: 4 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: COLORS.sub, letterSpacing: 1.2, paddingHorizontal: 4, paddingBottom: 2 },

  // Each settings row — blue-tinted glassmorphism
  settingsCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(180,225,245,0.22)',
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    ...SHADOW.card,
  },
  iconBoxDanger: {}, // kept for legacy reference — glass tile handles danger styling via fixedColor
  itemLabel:       { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.text },
  itemLabelDanger: { color: COLORS.missed, fontWeight: '600' },
});
