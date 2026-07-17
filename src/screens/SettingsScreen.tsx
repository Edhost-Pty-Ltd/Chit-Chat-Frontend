// ─── Screen: Settings ────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons'; // kept for IoniconName type
import { BottomNav, UserAvatar } from '../components';
import { ProfilePictureViewer } from '../components/ProfilePictureViewer';
import { COLORS, RADIUS } from '../types/theme';
import { RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';
import { FEATURE_FLAGS } from '../constants/featureFlags';

import { AppBg, AppText, AppIcon, useForeground, useTypography, useGlass } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type NavProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

// Build settings sections dynamically based on feature flags
const buildSettingsSections = (): {
  label?: string;
  items: { id: string; icon: IoniconName; label: string; danger?: boolean }[];
}[] => {
  const sections: {
    label?: string;
    items: { id: string; icon: IoniconName; label: string; danger?: boolean }[];
  }[] = [
    {
      label: 'APPS',
      items: [
        { id: 'calendar', icon: 'calendar-outline',      label: 'Calendar'     },
        { id: 'notes',    icon: 'document-text-outline', label: 'Notes'        },
      ],
    },
    {
      items: [
        { id: 'account',       icon: 'person-outline',        label: 'Account'       },
        { id: 'privacy',       icon: 'lock-closed-outline',   label: 'Privacy'       },
        { id: 'notifications', icon: 'notifications-outline', label: 'Notifications' },
      ],
    },
    {
      items: [
        { id: 'devices',    icon: 'phone-portrait-outline', label: 'Linked Devices'  },
        { id: 'appearance', icon: 'color-palette-outline',  label: 'Appearance'      },
      ],
    },
  ];

  // Conditionally add Help & About section
  const helpAboutItems: { id: string; icon: IoniconName; label: string }[] = [];
  if (FEATURE_FLAGS.helpSupport) {
    helpAboutItems.push({ id: 'help', icon: 'help-circle-outline', label: 'Help & Support' });
  }
  if (FEATURE_FLAGS.about) {
    helpAboutItems.push({ id: 'about', icon: 'information-circle-outline', label: 'About' });
  }
  if (helpAboutItems.length > 0) {
    sections.push({ items: helpAboutItems });
  }

  // Always add sign out
  sections.push({
    items: [{ id: 'signout', icon: 'log-out-outline', label: 'Sign Out', danger: true }],
  });

  return sections;
};

export default function SettingsScreen() {
  const navigation = useNavigation<NavProp>();
  const { signOut, displayName, avatarUri } = useAuth();
  const { FG } = useForeground();
  const { fontFamily, textColor, iconColor } = useTypography();
  const { bevel } = useGlass();
  const insets = useSafeAreaInsets();

  const [viewerOpen, setViewerOpen] = useState(false);
  const shownName = displayName || 'John Doe';

  const SETTINGS_SECTIONS = buildSettingsSections();

  const handleItem = (id: string) => {
    if (id === 'signout')    { signOut(); return; }
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

      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <AppText style={[styles.title, { color: textColor, fontFamily }]}>Settings</AppText>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Profile — tap the avatar to expand the photo, details to open profile */}
        <View style={[styles.profileCard, bevel]}>
          <TouchableOpacity
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={avatarUri ? 'View profile picture' : 'Open profile'}
            onPress={() => {
              if (avatarUri) {
                setViewerOpen(true);
              } else {
                navigation.navigate('Profile');
              }
            }}
          >
            <View pointerEvents="none">
              <UserAvatar size={54} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.profileText}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={() => navigation.navigate('Profile')}
          >
            <AppText style={[styles.profileName, { color: textColor, fontFamily }]}>{shownName}</AppText>
          </TouchableOpacity>
        </View>

        {/* Each section: label + individual glass cards per row */}
        {SETTINGS_SECTIONS.map((section, si) => (
          <View key={si} style={styles.section}>
            {section.label && <AppText style={[styles.sectionLabel, { color: FG.secondary }]}>{section.label}</AppText>}
            {section.items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.settingsCard, bevel]}
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

      <ProfilePictureViewer
        visible={viewerOpen}
        imageUri={avatarUri}
        displayName={shownName}
        onClose={() => setViewerOpen(false)}
      />

      <BottomNav active="settings" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sky1 },

  header: { paddingHorizontal: 20, paddingTop: 0, paddingBottom: 14 },
  title:  { fontSize: 26, fontWeight: '800', color: COLORS.text },

  scroll: { paddingHorizontal: 14, paddingBottom: 20, gap: 6 },

  // Profile card — blue-tinted glassmorphism
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  profileText: { flex: 1, minHeight: 54, justifyContent: 'center' },
  profileName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  profileSub:  { fontSize: 12, color: COLORS.sub, marginTop: 2 },

  section:      { gap: 8, marginBottom: 4 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: COLORS.sub, letterSpacing: 1.2, paddingHorizontal: 4, paddingBottom: 2 },

  // Each settings row — blue-tinted glassmorphism
  settingsCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  itemLabel:       { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.text },
  itemLabelDanger: { color: COLORS.missed, fontWeight: '600' },
});
