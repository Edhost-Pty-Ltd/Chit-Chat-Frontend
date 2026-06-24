// ─── Screen: Privacy Settings ────────────────────────────────────────────────
import React, { useState } from 'react';
import { View, Switch, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppBg, AppText, AppIcon, useForeground, useTypography, useGlass } from '../context/ThemeContext';
import { COLORS, RADIUS, SHADOW, GLASS } from '../types/theme';

type Visibility = 'Everyone' | 'Contacts' | 'Nobody';

function Row({ icon, label, sub, value, onToggle, onPress, rightLabel }: {
  icon: string; label: string; sub?: string;
  value?: boolean; onToggle?: (v: boolean) => void;
  onPress?: () => void; rightLabel?: string;
}) {
  const { FG } = useForeground();
  const { fontFamily, textColor, iconColor } = useTypography();
  const { bevel } = useGlass();
  return (
    <TouchableOpacity
      style={[styles.row, bevel]}
      onPress={onPress} activeOpacity={onPress ? 0.75 : 1}
    >
      <AppIcon glass tileSize={38} name={icon as any} size={18} color={iconColor} />
      <View style={styles.rowMeta}>
        <AppText style={[styles.rowLabel, { color: textColor, fontFamily }]}>{label}</AppText>
        {sub ? <AppText style={[styles.rowSub, { color: FG.secondary }]}>{sub}</AppText> : null}
      </View>
      {onToggle != null
        ? <Switch value={value} onValueChange={onToggle} trackColor={{ true: COLORS.blue }} />
        : rightLabel
          ? <AppText style={[styles.rightLabel, { color: FG.secondary }]}>{rightLabel}</AppText>
          : onPress ? <AppIcon name="chevron-forward" size={16} color={FG.secondary} /> : null}
    </TouchableOpacity>
  );
}

function VisibilityPicker({ label, value, onChange }: { label: string; value: Visibility; onChange: (v: Visibility) => void }) {
  const { FG } = useForeground();
  const { fontFamily, textColor, iconColor } = useTypography();
  const { bevel } = useGlass();
  const options: Visibility[] = ['Everyone', 'Contacts', 'Nobody'];
  return (
    <View style={[styles.row, bevel]}>
      <AppIcon glass tileSize={38} name="people-outline" size={18} color={iconColor} />
      <AppText style={[styles.rowLabel, { color: textColor, fontFamily, flex: 1 }]}>{label}</AppText>
      <View style={styles.visRow}>
        {options.map((o) => (
          <TouchableOpacity key={o} onPress={() => onChange(o)}
            style={[styles.visBtn, value === o && { backgroundColor: COLORS.blue }]}>
            <AppText style={[styles.visTxt, { color: value === o ? '#fff' : FG.secondary }]} fixedColor={value === o}>{o}</AppText>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function PrivacySettingsScreen() {
  const navigation = useNavigation();
  const { FG } = useForeground();
  const { fontFamily, textColor } = useTypography();

  const [lastSeen,      setLastSeen]      = useState<Visibility>('Contacts');
  const [profilePhoto,  setProfilePhoto]  = useState<Visibility>('Contacts');
  const [status,        setStatus]        = useState<Visibility>('Everyone');
  const [groups,        setGroups]        = useState<Visibility>('Contacts');
  const [callsWho,      setCallsWho]      = useState<Visibility>('Contacts');
  const [screenshot,    setScreenshot]    = useState(false);
  const [disappearing,  setDisappearing]  = useState(true);

  return (
    <View style={styles.root}>
      <AppBg />
      <View style={[styles.header, { backgroundColor: FG.glassBg, borderBottomColor: FG.glassBorder }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <AppIcon name="chevron-back" size={26} color={COLORS.blue} fixedColor />
        </TouchableOpacity>
        <AppText style={[styles.title, { color: textColor, fontFamily }]}>Privacy</AppText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Visibility */}
        <AppText style={[styles.sectionLabel, { color: FG.secondary }]}>WHO CAN SEE</AppText>
        <VisibilityPicker label="Last Seen"     value={lastSeen}     onChange={setLastSeen} />
        <VisibilityPicker label="Profile Photo" value={profilePhoto} onChange={setProfilePhoto} />
        <VisibilityPicker label="Status"        value={status}       onChange={setStatus} />
        <VisibilityPicker label="Groups"        value={groups}       onChange={setGroups} />
        <VisibilityPicker label="Can Call Me"   value={callsWho}     onChange={setCallsWho} />

        {/* Messages */}
        <AppText style={[styles.sectionLabel, { color: FG.secondary }]}>MESSAGES</AppText>
        <Row icon="timer-outline" label="Disappearing Messages"
          sub={disappearing ? 'On — messages delete after 72 hours' : 'Off'}
          value={disappearing} onToggle={setDisappearing} />
        <Row icon="camera-outline" label="View Once Media"
          sub="Photos & videos can only be viewed once"
          onPress={() => Alert.alert('View Once', 'Configure view-once media settings.')} />
        <Row icon="phone-portrait-outline" label="Screenshot Block"
          sub={screenshot ? 'Enabled — screenshots blocked' : 'Disabled'}
          value={screenshot} onToggle={setScreenshot} />

        {/* Advanced */}
        <AppText style={[styles.sectionLabel, { color: FG.secondary }]}>ADVANCED</AppText>
        <Row icon="ban-outline" label="Blocked Contacts"
          sub="Manage who can't contact you"
          onPress={() => (navigation as any).navigate('BlockedContacts')} 
          rightLabel="" />
        <Row icon="shield-outline" label="Silence Unknown Callers"
          sub="Calls from unknown numbers go to voicemail"
          onPress={() => Alert.alert('Unknown Callers', 'Configure call filtering.')} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'web' ? 16 : 52, paddingBottom: 12, paddingHorizontal: 14, borderBottomWidth: 1 },
  back:   { width: 36 },
  title:  { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  scroll: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 40, gap: 8 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, paddingHorizontal: 4, paddingBottom: 2, paddingTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: RADIUS.lg, paddingHorizontal: 14, paddingVertical: 13 },
  rowMeta:    { flex: 1 },
  rowLabel:   { fontSize: 14, fontWeight: '500' },
  rowSub:     { fontSize: 12, marginTop: 2 },
  rightLabel: { fontSize: 12, fontWeight: '600' },
  visRow: { flexDirection: 'row', gap: 4 },
  visBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(90,127,160,0.15)' },
  visTxt: { fontSize: 11, fontWeight: '600' },
});
