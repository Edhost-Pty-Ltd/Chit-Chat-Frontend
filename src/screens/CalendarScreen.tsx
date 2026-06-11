// ─── Screen: Calendar ────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons'; // kept for IoniconName type
import { AppHeader } from '../components';
import { CALENDAR_EVENTS } from '../data/mockData';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';

import { AppBg, AppText, AppIcon, useForeground } from '../context/ThemeContext';

const DAYS   = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January','February','March','April','May','June','July',
                'August','September','October','November','December'];

function buildGrid(year: number, month: number) {
  const first = new Date(year, month, 1).getDay();
  const days  = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  return cells;
}

export default function CalendarScreen() {
  const { FG } = useForeground();
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [sel,   setSel]   = useState(now.getDate());

  const cells = buildGrid(year, month);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dayEvents = CALENDAR_EVENTS.filter((e) => e.date === `${year}-${pad(month + 1)}-${pad(sel)}`);

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0);  } else setMonth(m => m + 1); };

  return (
    <View style={styles.root}>
      <AppBg />
      <AppHeader title="Calendar" showBack rightIcon="+" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Month nav */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={styles.navArrow}>
            <AppIcon name="chevron-back" size={22} color={COLORS.blue} />
          </TouchableOpacity>
          <AppText style={[styles.monthLabel, { color: FG.primary }]}>{MONTHS[month]} {year}</AppText>
          <TouchableOpacity onPress={nextMonth} style={styles.navArrow}>
            <AppIcon name="chevron-forward" size={22} color={COLORS.blue} />
          </TouchableOpacity>
        </View>

        {/* Calendar grid — glass card */}
        <View style={styles.calCard}>
          <View style={styles.daysHeader}>
            {DAYS.map((d, i) => <AppText key={i} style={styles.dayLabel}>{d}</AppText>)}
          </View>
          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={i} style={styles.cell} />;
              const isToday    = isCurrentMonth && day === now.getDate();
              const isSelected = day === sel;
              return (
                <TouchableOpacity key={i} style={styles.cell} onPress={() => setSel(day)} activeOpacity={0.7}>
                  {isSelected ? (
                    <LinearGradient colors={GRADIENTS.primary} style={styles.dayCircle}>
                      <AppText style={styles.dayNumSelected}>{day}</AppText>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.dayCircle, isToday && styles.todayCircle]}>
                      <AppText style={[styles.dayNum, isToday && styles.todayNum, { color: FG.primary }]}>{day}</AppText>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Events for selected day */}
        <AppText style={styles.eventSectionLabel}>{MONTHS[month].slice(0, 3)} {sel}, {year}</AppText>

        {dayEvents.length === 0 ? (
          <View style={styles.noEvents}>
            <AppIcon name="calendar-outline" size={40} color={COLORS.sub} />
            <AppText style={styles.noEventsText}>No events today</AppText>
          </View>
        ) : dayEvents.map((ev) => (
          // Each event = glass card
          <View key={ev.id} style={styles.eventCard}>
            <View style={[styles.eventAccent, { backgroundColor: ev.color }]} />
            <View style={styles.eventBody}>
              <AppText style={styles.eventTitle}>{ev.title}</AppText>
              <View style={styles.eventTimeRow}>
                <AppIcon name="time-outline" size={13} color={COLORS.sub} />
                <AppText style={styles.eventTime}>{ev.startTime} – {ev.endTime}</AppText>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.sky1 },
  scroll: { paddingHorizontal: 14, paddingBottom: 32, gap: 10 },

  monthNav:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  navArrow:   { padding: 6 },
  monthLabel: { fontSize: 16, fontWeight: '700', color: COLORS.text },

  // Calendar grid glass card
  calCard: { ...GLASS.card, borderRadius: RADIUS.lg, paddingVertical: 12, ...SHADOW.card },

  daysHeader: { flexDirection: 'row', paddingHorizontal: 8, marginBottom: 4 },
  dayLabel:   { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: COLORS.sub },

  grid:           { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 },
  cell:           { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  dayCircle:      { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  todayCircle:    { backgroundColor: 'rgba(30,156,240,0.15)', borderWidth: 1, borderColor: COLORS.blue },
  dayNum:         { fontSize: 13, color: COLORS.text },
  dayNumSelected: { fontSize: 13, fontWeight: '700', color: '#fff' },
  todayNum:       { color: COLORS.blue, fontWeight: '700' },

  eventSectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.sub, letterSpacing: 0.6, paddingTop: 4 },

  noEvents:     { alignItems: 'center', paddingVertical: 24, gap: 10 },
  noEventsText: { fontSize: 14, color: COLORS.sub },

  // Each event = glass card
  eventCard: {
    flexDirection: 'row',
    ...GLASS.card, borderRadius: RADIUS.lg,
    overflow: 'hidden', ...SHADOW.card,
  },
  eventAccent:  { width: 4 },
  eventBody:    { flex: 1, padding: 14 },
  eventTitle:   { fontSize: 14, fontWeight: '700', color: COLORS.text },
  eventTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  eventTime:    { fontSize: 12, color: COLORS.sub },
});
