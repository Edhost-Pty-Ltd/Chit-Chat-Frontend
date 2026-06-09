// ─── Screen: Settings ────────────────────────────────────────────────────────
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, BottomNav } from '../components';
import { useAuth } from '../hooks/useAuth';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';
import { RootStackParamList } from '../types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

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
  const { signOut, user } = useAuth();

  const handleItem = async (id: string) => {
    if (id === 'signout') {
      await signOut();
      // Navigation guard auto-redirects to SignIn
    }
    if (id === 'backup')   navigation.navigate('CloudBackup');
    if (id === 'calendar') navigation.navigate('Calendar');
    if (id === 'notes')    navigation.navigate('Notes');
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={GRADIENTS.bg} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Profile — glass card */}
        <TouchableOpacity style={styles.profileCard} activeOpacity={0.8}>
          <Avatar initials={user?.phoneNumber?.slice(-2) ?? 'ME'} color={COLORS.blue} size={54} status="online" />
          <View style={styles.profileText}>
            <Text style={styles.profileName}>{user?.phoneNumber ?? 'User'}</Text>
            <Text style={styles.profileSub}>Available to help</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.sub} />
        </TouchableOpacity>

        {/* Each section: label + individual glass cards per row */}
        {SETTINGS_SECTIONS.map((section, si) => (
          <View key={si} style={styles.section}>
            {section.label && <Text style={styles.sectionLabel}>{section.label}</Text>}
            {section.items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.settingsCard}
                activeOpacity={0.75}
                onPress={() => handleItem(item.id)}
              >
                <View style={[styles.iconBox, item.danger && styles.iconBoxDanger]}>
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={item.danger ? COLORS.missed : COLORS.blue}
                  />
                </View>
                <Text style={[styles.itemLabel, item.danger && styles.itemLabelDanger]}>
                  {item.label}
                </Text>
                {!item.danger && <Ionicons name="chevron-forward" size={16} color={COLORS.sub} />}
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

  // Profile card
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    ...GLASS.card, borderRadius: RADIUS.lg, paddingHorizontal: 14, paddingVertical: 14,
    ...SHADOW.card, marginBottom: 10,
  },
  profileText: { flex: 1 },
  profileName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  profileSub:  { fontSize: 12, color: COLORS.sub, marginTop: 2 },

  section:      { gap: 8, marginBottom: 4 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: COLORS.sub, letterSpacing: 1.2, paddingHorizontal: 4, paddingBottom: 2 },

  // Each settings row = its own glass card
  settingsCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    ...GLASS.card, borderRadius: RADIUS.lg, paddingHorizontal: 14, paddingVertical: 13,
    ...SHADOW.card,
  },
  iconBox: {
    width: 36, height: 36, borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(30,156,240,0.12)',
    borderWidth: 1, borderColor: 'rgba(30,156,240,0.20)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconBoxDanger:   { backgroundColor: 'rgba(232,67,67,0.10)', borderColor: 'rgba(232,67,67,0.20)' },
  itemLabel:       { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.text },
  itemLabelDanger: { color: COLORS.missed, fontWeight: '600' },
});
