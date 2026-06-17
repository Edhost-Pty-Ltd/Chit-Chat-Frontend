// ─── Screen: Notification Settings ──────────────────────────────────────────
import React, { useState } from 'react';
import { View, Switch, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppBg, AppText, AppIcon, useForeground, useTypography } from '../context/ThemeContext';
import { COLORS, RADIUS, SHADOW, GLASS } from '../types/theme';

function Row({ icon, label, sub, value, onToggle, onPress, rightLabel }: {
  icon: string; label: string; sub?: string;
  value?: boolean; onToggle?: (v: boolean) => void;
  onPress?: () => void; rightLabel?: string;
}) {
  const { FG } = useForeground();
  const { fontFamily, textColor, iconColor } = useTypography();
  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}
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

export default function NotificationSettingsScreen() {
  const navigation = useNavigation();
  const { FG } = useForeground();
  const { fontFamily, textColor } = useTypography();

  // Messages
  const [msgNotifs,    setMsgNotifs]    = useState(true);
  const [msgPreview,   setMsgPreview]   = useState(true);
  const [msgVibrate,   setMsgVibrate]   = useState(true);
  const [msgSound,     setMsgSound]     = useState(true);

  // Groups
  const [groupNotifs,  setGroupNotifs]  = useState(true);
  const [groupPreview, setGroupPreview] = useState(true);
  const [groupVibrate, setGroupVibrate] = useState(false);

  // Calls
  const [callNotifs,   setCallNotifs]   = useState(true);
  const [missedCall,   setMissedCall]   = useState(true);
  const [ringtoneSel,  setRingtoneSel]  = useState('Default');

  // Status & updates
  const [statusNotifs, setStatusNotifs] = useState(false);
  const [reactNotifs,  setReactNotifs]  = useState(true);

  // Do Not Disturb
  const [dnd,          setDnd]          = useState(false);
  const [dndSchedule,  setDndSchedule]  = useState(false);

  return (
    <View style={styles.root}>
      <AppBg />
      <View style={[styles.header, { backgroundColor: FG.glassBg, borderBottomColor: FG.glassBorder }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <AppIcon name="chevron-back" size={26} color={COLORS.blue} fixedColor />
        </TouchableOpacity>
        <AppText style={[styles.title, { color: textColor, fontFamily }]}>Notifications</AppText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Do Not Disturb */}
        <AppText style={[styles.sectionLabel, { color: FG.secondary }]}>DO NOT DISTURB</AppText>
        <Row icon="moon-outline"     label="Do Not Disturb"
          sub={dnd ? 'All notifications silenced' : 'Off'}
          value={dnd} onToggle={setDnd} />
        <Row icon="time-outline"     label="Scheduled DND"
          sub={dndSchedule ? 'Set hours: 22:00 – 07:00' : 'Off'}
          value={dndSchedule} onToggle={setDndSchedule} />

        {/* Messages */}
        <AppText style={[styles.sectionLabel, { color: FG.secondary }]}>MESSAGES</AppText>
        <Row icon="chatbubble-outline"     label="Message Notifications"
          sub={msgNotifs ? 'Enabled' : 'Disabled'}
          value={msgNotifs} onToggle={setMsgNotifs} />
        {msgNotifs && <>
          <Row icon="eye-outline"          label="Show Preview"
            sub={msgPreview ? 'Show sender & message content' : 'Hide content'}
            value={msgPreview} onToggle={setMsgPreview} />
          <Row icon="volume-high-outline"  label="Notification Sound"
            sub={msgSound ? msgSound === true ? 'Default' : String(msgSound) : 'Silent'}
            value={msgSound as unknown as boolean} onToggle={setMsgSound} />
          <Row icon="phone-portrait-outline" label="Vibrate"
            sub={msgVibrate ? 'Vibrate with notification' : 'No vibration'}
            value={msgVibrate} onToggle={setMsgVibrate} />
        </>}

        {/* Groups */}
        <AppText style={[styles.sectionLabel, { color: FG.secondary }]}>GROUPS</AppText>
        <Row icon="people-outline"   label="Group Notifications"
          sub={groupNotifs ? 'Enabled' : 'Disabled'}
          value={groupNotifs} onToggle={setGroupNotifs} />
        {groupNotifs && <>
          <Row icon="eye-outline"    label="Show Preview"
            value={groupPreview} onToggle={setGroupPreview} />
          <Row icon="phone-portrait-outline" label="Vibrate"
            value={groupVibrate} onToggle={setGroupVibrate} />
        </>}

        {/* Calls */}
        <AppText style={[styles.sectionLabel, { color: FG.secondary }]}>CALLS</AppText>
        <Row icon="call-outline"     label="Incoming Calls"
          sub={callNotifs ? 'Ringtone & notification' : 'Silent'}
          value={callNotifs} onToggle={setCallNotifs} />
        <Row icon="notifications-outline" label="Missed Call Alerts"
          sub={missedCall ? 'Notify when call missed' : 'Off'}
          value={missedCall} onToggle={setMissedCall} />
        <Row icon="musical-notes-outline" label="Ringtone"
          sub={ringtoneSel}
          onPress={() => Alert.alert('Ringtone', 'Choose a ringtone from system sounds.')} />

        {/* Status & Reactions */}
        <AppText style={[styles.sectionLabel, { color: FG.secondary }]}>UPDATES</AppText>
        <Row icon="radio-button-on-outline" label="Status Updates"
          sub={statusNotifs ? 'Notify when contacts post status' : 'Off'}
          value={statusNotifs} onToggle={setStatusNotifs} />
        <Row icon="heart-outline"    label="Message Reactions"
          sub={reactNotifs ? 'Notify when someone reacts' : 'Off'}
          value={reactNotifs} onToggle={setReactNotifs} />

        {/* System */}
        <AppText style={[styles.sectionLabel, { color: FG.secondary }]}>SYSTEM</AppText>
        <Row icon="settings-outline" label="System Notification Settings"
          sub="Open device notification settings"
          onPress={() => Alert.alert('System Settings', 'This would open your device notification settings.')} />
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: RADIUS.lg, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13, ...SHADOW.card },
  rowMeta:    { flex: 1 },
  rowLabel:   { fontSize: 14, fontWeight: '500' },
  rowSub:     { fontSize: 12, marginTop: 2 },
  rightLabel: { fontSize: 12, fontWeight: '600' },
});
