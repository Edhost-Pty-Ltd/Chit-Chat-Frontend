// --- Screen: Calendar --------------------------------------------------------
// Uses AsyncStorage for local event persistence + expo-notifications for reminders.
// 5 view modes: Year | Month | Week | Day | Schedule
import { scheduleEventNotification, cancelEventNotification } from '../services/calendarNotifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, TouchableOpacity, StyleSheet, ScrollView, SectionList,
  Modal, TextInput, Alert, Platform, PanResponder, KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { AppBg, AppText, AppIcon, useForeground, useTypography, useGlass } from '../context/ThemeContext';
import { COLORS, RADIUS, SHADOW, GRADIENTS } from '../types/theme';

const EVENTS_STORAGE_KEY = '@chit_chat_calendar_events';




type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type ViewMode = 'year' | 'month' | 'week' | 'day' | 'schedule';

// --- Constants ----------------------------------------------------------------
const WEEK_DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_DAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS      = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const HOUR_H      = 56;
const DAY_HOUR_H  = 72;
const EVENT_COLORS = ['#1a7fe8','#e84343','#f59e0b','#10b981','#8b5cf6','#ec4899','#06b6d4','#f97316'];

const VIEW_TABS: { key: ViewMode; label: string }[] = [
  { key: 'year',     label: 'Year'     },
  { key: 'month',    label: 'Month'    },
  { key: 'week',     label: 'Week'     },
  { key: 'day',      label: 'Day'      },
  { key: 'schedule', label: 'Schedule' },
];

function pad(n: number) { return String(n).padStart(2, '0'); }
function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function firstDayOf(y: number, m: number)  { return new Date(y, m, 1).getDay(); }

// --- SA Public Holidays -------------------------------------------------------
// Returns a map of "YYYY-MM-DD" ? holiday name for a given year
function getEasterSunday(y: number): Date {
  // Anonymous Gregorian algorithm
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m2 = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m2 + 114) / 31) - 1; // 0-indexed
  const day   = ((h + l - 7 * m2 + 114) % 31) + 1;
  return new Date(y, month, day);
}

function getSAHolidays(year: number): Record<string, string> {
  const holidays: Record<string, string> = {};
  const add = (m: number, d: number, name: string) => {
    holidays[`${year}-${pad(m)}-${pad(d)}`] = name;
  };

  // Fixed public holidays
  add(1,  1,  "New Year's Day");
  add(3,  21, 'Human Rights Day');
  add(4,  27, 'Freedom Day');
  add(5,  1,  'Workers Day');
  add(6,  16, 'Youth Day');
  add(8,  9,  "National Women's Day");
  add(9,  24, 'Heritage Day');
  add(12, 16, 'Day of Reconciliation');
  add(12, 25, 'Christmas Day');
  add(12, 26, 'Day of Goodwill');

  // Easter-based
  const easter = getEasterSunday(year);
  const gf = new Date(easter); gf.setDate(easter.getDate() - 2); // Good Friday
  const fm = new Date(easter); fm.setDate(easter.getDate() + 1); // Family Day (Easter Monday)
  const addDate = (d: Date, name: string) => {
    holidays[`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`] = name;
  };
  addDate(gf, 'Good Friday');
  addDate(fm, 'Family Day');

  // If holiday falls on Sunday, Monday is the substitute
  Object.entries({ ...holidays }).forEach(([key, name]) => {
    const d = new Date(key);
    if (d.getDay() === 0) {
      const sub = new Date(d); sub.setDate(d.getDate() + 1);
      const subKey = `${sub.getFullYear()}-${pad(sub.getMonth() + 1)}-${pad(sub.getDate())}`;
      if (!holidays[subKey]) holidays[subKey] = name + ' (observed)';
    }
  });

  return holidays;
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day  = copy.getDay(); // 0=Sun
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

function formatDateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatSectionTitle(d: Date) {
  const weekDay = WEEK_DAYS[d.getDay()];
  return `${weekDay}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;
}

interface SimpleEvent {
  id:    string;
  title: string;
  start: Date;
  end:   Date;
  color: string;
  calendarId?: string;
  notes?: string;
}

// --- Event Form ---------------------------------------------------------------
interface FormProps {
  visible:    boolean;
  initial?:   Partial<SimpleEvent & { startStr: string; endStr: string }>;
  dateStr:    string;
  calendars:  any[];
  onSave:     (ev: SimpleEvent) => void;
  onDelete?:  (id: string) => void;
  onClose:    () => void;
}
function EventForm({ visible, initial, dateStr, calendars, onSave, onDelete, onClose }: FormProps) {
  const { FG } = useForeground();
  const { fontFamily, textColor } = useTypography();

  const [title,     setTitle]     = useState('');
  const [startStr,  setStartStr]  = useState('09:00');
  const [endStr,    setEndStr]    = useState('10:00');
  const [color,     setColor]     = useState(EVENT_COLORS[0]);
  const [calId,     setCalId]     = useState('');
  const [notes,     setNotes]     = useState('');

  useEffect(() => {
    setTitle(initial?.title ?? '');
    setStartStr(initial?.startStr ?? '09:00');
    setEndStr(initial?.endStr ?? '10:00');
    setColor(initial?.color ?? EVENT_COLORS[0]);
    setCalId(initial?.calendarId ?? calendars[0]?.id ?? '');
    setNotes(initial?.notes ?? '');
  }, [initial, visible, calendars]);

  const buildDate = (timeStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [h, min]  = timeStr.split(':').map(Number);
    return new Date(y, m - 1, d, h, min);
  };

  const handleSave = () => {
    if (!title.trim()) { Alert.alert('Title required'); return; }
    onSave({
      id:         initial?.id ?? '',
      title:      title.trim(),
      start:      buildDate(startStr),
      end:        buildDate(endStr),
      color,
      calendarId: calId || calendars[0]?.id,
      notes,
    });
    onClose();
  };

  const handleDelete = () => {
    Alert.alert('Delete event?', `"${title}" will be permanently removed from your calendar.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { onDelete?.(initial!.id!); onClose(); } },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={form.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={form.sheet}>
          <AppBg />
          <View style={form.scrim} />

          {/* Header */}
          <View style={form.header}>
            <TouchableOpacity onPress={onClose}>
              <AppText fixedColor style={form.cancelTxt}>Cancel</AppText>
            </TouchableOpacity>
            <AppText style={[form.headTitle, { color: textColor, fontFamily }]}>
              {initial?.id ? 'Edit Event' : 'New Event'}
            </AppText>
            <TouchableOpacity onPress={handleSave}>
              <LinearGradient colors={GRADIENTS.primary} style={form.saveBtn}>
                <AppText fixedColor style={form.saveTxt}>Save</AppText>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={form.body}>

            {/* Title */}
            <View style={[form.field, { borderBottomColor: COLORS.blue }]}>
              <AppIcon name="pencil-outline" size={16} color={FG.secondary} style={{ marginRight: 8 }} />
              <TextInput style={[form.fieldInput, { color: textColor }]}
                placeholder="Event title" placeholderTextColor={FG.faint}
                value={title} onChangeText={setTitle} autoFocus />
            </View>

            {/* Date */}
            <View style={[form.field, { borderBottomColor: FG.glassBorder }]}>
              <AppIcon name="calendar-outline" size={16} color={FG.secondary} style={{ marginRight: 8 }} />
              <AppText style={[form.fieldText, { color: textColor }]}>{dateStr}</AppText>
            </View>

            {/* Start / End */}
            <View style={form.timeRow}>
              <View style={{ flex: 1 }}>
                <AppText style={[form.sectionLabel, { color: FG.secondary }]}>START</AppText>
                <TextInput style={[form.timeInput, { color: textColor, borderBottomColor: COLORS.blue }]}
                  value={startStr} onChangeText={setStartStr}
                  keyboardType="numbers-and-punctuation" placeholder="09:00" placeholderTextColor={FG.faint} />
              </View>
              <AppIcon name="arrow-forward" size={16} color={FG.secondary} style={{ marginBottom: 8 }} />
              <View style={{ flex: 1 }}>
                <AppText style={[form.sectionLabel, { color: FG.secondary }]}>END</AppText>
                <TextInput style={[form.timeInput, { color: textColor, borderBottomColor: COLORS.blue }]}
                  value={endStr} onChangeText={setEndStr}
                  keyboardType="numbers-and-punctuation" placeholder="10:00" placeholderTextColor={FG.faint} />
              </View>
            </View>

            {/* Notes */}
            <View style={[form.field, { borderBottomColor: FG.glassBorder }]}>
              <AppIcon name="document-text-outline" size={16} color={FG.secondary} style={{ marginRight: 8 }} />
              <TextInput style={[form.fieldInput, { color: textColor }]}
                placeholder="Notes (optional)" placeholderTextColor={FG.faint}
                value={notes} onChangeText={setNotes} multiline />
            </View>

            {/* Calendar selector */}
            {calendars.length > 1 && (
              <>
                <AppText style={[form.sectionLabel, { color: FG.secondary, marginTop: 14 }]}>CALENDAR</AppText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  {calendars.filter((c) => c.allowsModifications).map((c) => (
                    <TouchableOpacity key={c.id} onPress={() => setCalId(c.id)}
                      style={[form.calChip, calId === c.id && { borderColor: COLORS.blue, backgroundColor: 'rgba(30,156,240,0.12)' }]}>
                      <View style={[form.calDot, { backgroundColor: c.color ?? COLORS.blue }]} />
                      <AppText style={[form.calName, { color: textColor }]}>{c.title}</AppText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Colour */}
            <AppText style={[form.sectionLabel, { color: FG.secondary, marginTop: 14 }]}>COLOUR</AppText>
            <View style={form.colorRow}>
              {EVENT_COLORS.map((c) => (
                <TouchableOpacity key={c} onPress={() => setColor(c)}
                  style={[form.dot, { backgroundColor: c }, color === c && form.dotSel]}>
                  {color === c && <AppIcon name="checkmark" size={13} color="#fff" fixedColor />}
                </TouchableOpacity>
              ))}
            </View>

            {/* Delete */}
            {!!initial?.id && (
              <TouchableOpacity onPress={handleDelete} style={form.deleteRow}>
                <AppIcon name="trash-outline" size={18} color={COLORS.missed} fixedColor />
                <AppText fixedColor style={form.deleteTxt}>Delete Event</AppText>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// --- Side Menu ---------------------------------------------------------------
interface SideMenuProps {
  visible:  boolean;
  active:   ViewMode;
  onChange: (m: ViewMode) => void;
  onClose:  () => void;
}
function SideMenu({ visible, active, onChange, onClose }: SideMenuProps) {
  const { FG } = useForeground();
  const { fontFamily, textColor } = useTypography();

  const menuItems: { key: ViewMode; label: string; icon: IoniconName }[] = [
    { key: 'year',     label: 'Year',     icon: 'calendar-outline'       },
    { key: 'month',    label: 'Month',    icon: 'grid-outline'            },
    { key: 'week',     label: 'Week',     icon: 'calendar-number-outline' },
    { key: 'day',      label: 'Day',      icon: 'today-outline'           },
    { key: 'schedule', label: 'Schedule', icon: 'list-outline'            },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={side.backdrop} activeOpacity={1} onPress={onClose} />
      {/* Drawer � curved right corners only */}
      <View style={[side.drawer, { backgroundColor: 'transparent' }]}>
        <AppBg />
        <View style={side.scrim} />

        {/* Top padding + close row */}
        <View style={side.topRow}>
          <TouchableOpacity onPress={onClose} style={side.closeBtn}>
            <AppIcon name="close-circle" size={28} color={FG.secondary} />
          </TouchableOpacity>
        </View>

        {/* Calendar icon + title */}
        <View style={side.brandRow}>
          <LinearGradient colors={GRADIENTS.primary} style={side.brandIcon}>
            <AppIcon name="calendar" size={24} color="#fff" fixedColor />
          </LinearGradient>
          <AppText style={[side.brandName, { color: textColor, fontFamily }]}>Calendar</AppText>
        </View>

        {/* Divider */}
        <View style={[side.divider, { backgroundColor: FG.glassBorder }]} />

        {/* Menu items */}
        <View style={side.menuList}>
          {menuItems.map(({ key, label, icon }) => {
            const isActive = active === key;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  side.menuItem,
                  isActive && { backgroundColor: 'rgba(30,156,240,0.14)' },
                ]}
                onPress={() => { onChange(key); onClose(); }}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={isActive ? GRADIENTS.primary : ['rgba(30,156,240,0.10)', 'rgba(30,156,240,0.06)']}
                  style={side.iconWrap}
                >
                  <AppIcon name={icon} size={20} color={isActive ? '#fff' : undefined} fixedColor={isActive} />
                </LinearGradient>
                <AppText style={[
                  side.menuLabel,
                  { color: isActive ? COLORS.blue : textColor, fontFamily },
                  isActive && side.menuLabelActive,
                ]}>
                  {label}
                </AppText>
                {isActive && (
                  <View style={side.activeBar} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

// --- Year View ----------------------------------------------------------------
interface YearViewProps {
  year: number;
  today: Date;
  eventsByYearMonth: Record<string, Set<number>>;
  onSelectMonth: (month: number) => void;
}
function YearView({ year, today, eventsByYearMonth, onSelectMonth }: YearViewProps) {
  const { FG } = useForeground();
  const { textColor, fontFamily } = useTypography();
  const { bevel } = useGlass();

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={yearStyles.grid}>
      {MONTHS.map((mName, mIdx) => {
        const key = `${year}-${mIdx}`;
        const hasEvDays = eventsByYearMonth[key] ?? new Set<number>();
        const fd  = firstDayOf(year, mIdx);
        const td  = daysInMonth(year, mIdx);
        const cells: (number | null)[] = [
          ...Array(fd).fill(null),
          ...Array.from({ length: td }, (_, i) => i + 1),
        ];
        // pad to full weeks
        while (cells.length % 7 !== 0) cells.push(null);

        return (
          <TouchableOpacity key={mIdx} onPress={() => onSelectMonth(mIdx)}
            style={[yearStyles.monthCard, bevel]}
            activeOpacity={0.75}>
            <AppText style={[yearStyles.monthName, { color: textColor, fontFamily }]}>{mName}</AppText>
            {/* Day-of-week header row */}
            <View style={yearStyles.miniWeekRow}>
              {WEEK_DAYS_SHORT.map((w, wi) => (
                <AppText key={wi} style={[yearStyles.miniWeekLabel, { color: FG.secondary }]}>{w}</AppText>
              ))}
            </View>
            {/* Date grid */}
            {Array.from({ length: cells.length / 7 }, (_, row) => (
              <View key={row} style={yearStyles.miniRow}>
                {cells.slice(row * 7, row * 7 + 7).map((day, ci) => {
                  if (day === null) return <View key={ci} style={yearStyles.miniCell} />;
                  const isToday = year === today.getFullYear() && mIdx === today.getMonth() && day === today.getDate();
                  const hasEv   = hasEvDays.has(day);
                  return (
                    <View key={ci} style={yearStyles.miniCell}>
                      <View style={[yearStyles.miniDayWrap, isToday && yearStyles.miniDayToday]}>
                        <AppText style={[yearStyles.miniDay, isToday && { color: '#fff' }, { color: isToday ? '#fff' : textColor }]}>
                          {day}
                        </AppText>
                      </View>
                      {hasEv && <View style={[yearStyles.miniDot, { backgroundColor: COLORS.blue }]} />}
                    </View>
                  );
                })}
              </View>
            ))}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// --- Week View ----------------------------------------------------------------
interface WeekViewProps {
  weekStart: Date;
  today: Date;
  events: SimpleEvent[];
  onSelectDay: (d: Date) => void;
  onEditEvent: (ev: SimpleEvent) => void;
}
function WeekView({ weekStart, today, events, onSelectDay, onEditEvent }: WeekViewProps) {
  const { FG } = useForeground();
  const { textColor } = useTypography();

  // Build the 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  // Map events to day index + hour
  const eventSlots = useMemo(() => {
    const map: Record<string, SimpleEvent[]> = {};
    events.forEach((ev) => {
      const key = formatDateKey(ev.start);
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [events]);

  const COL_W = 44; // approx column width for each day

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Day column headers */}
      <View style={[weekStyles.headerRow, { backgroundColor: FG.glassBg, borderBottomColor: FG.glassBorder }]}>
        <View style={weekStyles.timeGutter} />
        {days.map((d, i) => {
          const isTod = sameDay(d, today);
          const dow   = d.getDay();
          return (
            <TouchableOpacity key={i} style={weekStyles.dayHeader} onPress={() => onSelectDay(d)} activeOpacity={0.7}>
              <AppText style={[weekStyles.dayHeaderWd, {
                color: dow === 0 ? COLORS.missed : dow === 6 ? COLORS.blue : FG.secondary,
              }]}>
                {WEEK_DAYS[d.getDay()].slice(0, 3)}
              </AppText>
              <View style={[weekStyles.dayHeaderNum, isTod && { backgroundColor: COLORS.blue }]}>
                <AppText style={[weekStyles.dayHeaderNumTxt, { color: isTod ? '#fff' : textColor }]}>
                  {d.getDate()}
                </AppText>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Hourly rows */}
      {Array.from({ length: 24 }, (_, hi) => (
        <View key={hi} style={[weekStyles.hourRow, { borderTopColor: FG.glassBorder }]}>
          <AppText style={[weekStyles.hourLabel, { color: FG.secondary }]}>{pad(hi)}:00</AppText>
          {days.map((d, di) => {
            const key    = formatDateKey(d);
            const slotEvs = (eventSlots[key] ?? []).filter((e) => e.start.getHours() === hi);
            return (
              <View key={di} style={[weekStyles.dayCol, { borderLeftColor: FG.glassBorder }]}>
                {slotEvs.map((ev) => (
                  <TouchableOpacity key={ev.id}
                    style={[weekStyles.weekEvent, { backgroundColor: ev.color + 'dd', borderLeftColor: ev.color }]}
                    onPress={() => onEditEvent(ev)} activeOpacity={0.8}>
                    <AppText fixedColor style={weekStyles.weekEventTxt} numberOfLines={2}>{ev.title}</AppText>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

// --- Day View -----------------------------------------------------------------
interface DayViewProps {
  date: Date;
  today: Date;
  events: SimpleEvent[];
  onEditEvent: (ev: SimpleEvent) => void;
  onNewEvent: () => void;
}
function DayView({ date, today, events, onEditEvent, onNewEvent }: DayViewProps) {
  const { FG } = useForeground();
  const { textColor, fontFamily } = useTypography();

  const dayEvents = useMemo(() =>
    events
      .filter((e) => sameDay(e.start, date))
      .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [events, date]);

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Day label */}
      <View style={[dayStyles.dayHeader, { borderBottomColor: FG.glassBorder }]}>
        <AppText style={[dayStyles.dayTitle, { color: textColor, fontFamily }]}>
          {WEEK_DAYS[date.getDay()]}, {MONTHS_SHORT[date.getMonth()]} {date.getDate()}, {date.getFullYear()}
        </AppText>
        <TouchableOpacity onPress={onNewEvent} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <AppIcon name="add-circle-outline" size={24} />
        </TouchableOpacity>
      </View>

      {/* Hourly timeline */}
      <View style={{ paddingBottom: 40 }}>
        {Array.from({ length: 24 }, (_, hi) => {
          const slotEvs = dayEvents.filter((e) => e.start.getHours() === hi);
          return (
            <View key={hi} style={[dayStyles.hourRow, { borderTopColor: FG.glassBorder, minHeight: DAY_HOUR_H }]}>
              <AppText style={[dayStyles.hourLabel, { color: FG.secondary }]}>{pad(hi)}:00</AppText>
              <View style={dayStyles.hourSlot}>
                {slotEvs.map((ev) => {
                  const startMin = ev.start.getMinutes();
                  const durMin   = Math.max(30, (ev.end.getTime() - ev.start.getTime()) / 60000);
                  return (
                    <TouchableOpacity key={ev.id}
                      style={[dayStyles.timelineEvent, {
                        backgroundColor: ev.color + 'cc',
                        top:    startMin / 60 * DAY_HOUR_H,
                        height: Math.max(durMin / 60 * DAY_HOUR_H, 36),
                        borderLeftColor: ev.color,
                      }]}
                      onPress={() => onEditEvent(ev)} activeOpacity={0.85}>
                      <AppText fixedColor style={dayStyles.timelineTitle} numberOfLines={1}>{ev.title}</AppText>
                      <AppText fixedColor style={dayStyles.timelineTime}>
                        {pad(ev.start.getHours())}:{pad(ev.start.getMinutes())} � {pad(ev.end.getHours())}:{pad(ev.end.getMinutes())}
                      </AppText>
                      {ev.notes ? <AppText fixedColor style={dayStyles.timelineNotes} numberOfLines={1}>{ev.notes}</AppText> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

// --- Schedule View ------------------------------------------------------------
interface ScheduleViewProps {
  events: SimpleEvent[];
  calendars: any[];
  onEditEvent: (ev: SimpleEvent) => void;
}
function ScheduleView({ events, calendars, onEditEvent }: ScheduleViewProps) {
  const { FG } = useForeground();
  const { textColor, fontFamily } = useTypography();

  const calMap = useMemo(() => {
    const m: Record<string, string> = {};
    calendars.forEach((c) => { m[c.id] = c.title; });
    return m;
  }, [calendars]);

  const sections = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
    const groups: Record<string, SimpleEvent[]> = {};
    sorted.forEach((ev) => {
      const key = formatDateKey(ev.start);
      if (!groups[key]) groups[key] = [];
      groups[key].push(ev);
    });
    return Object.entries(groups).map(([key, data]) => ({
      title: formatSectionTitle(data[0].start),
      data,
    }));
  }, [events]);

  if (sections.length === 0) {
    return (
      <View style={schedStyles.empty}>
        <AppIcon name="calendar-outline" size={48} color={FG.secondary} />
        <AppText style={[schedStyles.emptyTxt, { color: FG.secondary }]}>No upcoming events</AppText>
      </View>
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 40 }}
      renderSectionHeader={({ section }) => (
        <View style={[schedStyles.sectionHeader, { backgroundColor: FG.glassBg, borderBottomColor: FG.glassBorder }]}>
          <AppText style={[schedStyles.sectionTitle, { color: textColor, fontFamily }]}>{section.title}</AppText>
        </View>
      )}
      renderItem={({ item }) => {
        const calName = item.calendarId ? calMap[item.calendarId] : undefined;
        return (
          <TouchableOpacity style={[schedStyles.eventRow, { borderBottomColor: FG.glassBorder }]}
            onPress={() => onEditEvent(item)} activeOpacity={0.75}>
            <View style={[schedStyles.colorDot, { backgroundColor: item.color }]} />
            <View style={schedStyles.eventInfo}>
              <AppText style={[schedStyles.eventTitle, { color: textColor }]} numberOfLines={1}>{item.title}</AppText>
              <AppText style={[schedStyles.eventTime, { color: FG.secondary }]}>
                {pad(item.start.getHours())}:{pad(item.start.getMinutes())} � {pad(item.end.getHours())}:{pad(item.end.getMinutes())}
                {calName ? `  �  ${calName}` : ''}
              </AppText>
            </View>
            <AppIcon name="chevron-forward" size={16} color={FG.secondary} />
          </TouchableOpacity>
        );
      }}
    />
  );
}

// --- Main Screen -------------------------------------------------------------
export default function CalendarScreen() {
  const { FG } = useForeground();
  const { fontFamily, textColor } = useTypography();
  const { bevel } = useGlass();
  const navigation = useNavigation();

  const today = new Date();
  const [viewMode,  setViewMode]  = useState<ViewMode>('month');
  const [year,      setYear]      = useState(today.getFullYear());
  const [month,     setMonth]     = useState(today.getMonth());
  const [selDay,    setSelDay]    = useState(today.getDate());
  const [selDate,   setSelDate]   = useState<Date>(today);  // used by week/day
  const [events,    setEvents]    = useState<SimpleEvent[]>([]);
  const [formOpen,  setFormOpen]  = useState(false);
  const [editing,   setEditing]   = useState<Partial<SimpleEvent & { startStr: string; endStr: string }> | undefined>();
  const [menuOpen,  setMenuOpen]  = useState(false);

  // Swipe left/right to navigate months (also week�7 and day�1)
  const swipeRef = useRef({ startX: 0 });
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 15 && Math.abs(gs.dy) < Math.abs(gs.dx),
      onPanResponderGrant: (_, gs) => { swipeRef.current.startX = gs.x0; },
      onPanResponderRelease: (_, gs) => {
        if (Math.abs(gs.dx) > 50) {
          // Will call navigate via a ref � need to store navigate in a ref
          navigateRef.current(gs.dx < 0 ? 1 : -1);
        }
      },
    })
  ).current;

  // Store navigate in a ref so PanResponder can call it without stale closure
  const navigateRef = useRef<(dir: 1 | -1) => void>(() => {});

  // -- Load events from AsyncStorage on mount & focus -------------------------
  useEffect(() => {
    loadEventsFromStorage();
  }, []);

  // Reload events when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadEventsFromStorage();
    });
    return unsubscribe;
  }, [navigation]);

  const loadEventsFromStorage = async () => {
    try {
      const stored = await AsyncStorage.getItem(EVENTS_STORAGE_KEY);
      if (stored) {
        const parsed: any[] = JSON.parse(stored);
        const hydrated = parsed.map((e) => ({
          ...e,
          start: new Date(e.start),
          end:   new Date(e.end),
        }));
        setEvents(hydrated);
        console.log('[CalendarScreen] Loaded', hydrated.length, 'events from storage');
      }
    } catch (error) {
      console.error('[CalendarScreen] Error loading events:', error);
    }
  };

  const persistEvents = async (updatedEvents: SimpleEvent[]) => {
    try {
      const serialized = updatedEvents.map((e) => ({
        ...e,
        start: e.start.toISOString(),
        end:   e.end.toISOString(),
      }));
      await AsyncStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(serialized));
      console.log('[CalendarScreen] Persisted', updatedEvents.length, 'events to storage');
    } catch (error) {
      console.error('[CalendarScreen] Error persisting events:', error);
    }
  };

  const saveEvent = async (ev: SimpleEvent) => {
    let updatedEvents: SimpleEvent[];

    if (ev.id) {
      // Editing existing event
      updatedEvents = events.map((e) => (e.id === ev.id ? { ...ev } : e));
    } else {
      // New event
      const newId = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const newEv = { ...ev, id: newId };
      updatedEvents = [...events, newEv];
      ev = newEv; // use the version with the id for notification scheduling
    }

    setEvents(updatedEvents);
    await persistEvents(updatedEvents);

    // Schedule notification for the event
    try {
      const notifId = await scheduleEventNotification({
        id: ev.id,
        title: ev.title,
        start: ev.start,
        notes: ev.notes,
      });
      if (notifId) {
        console.log('[CalendarScreen] Notification scheduled:', notifId);
      }
    } catch (error) {
      console.error('[CalendarScreen] Error scheduling notification:', error);
    }
  };

  const deleteEvent = async (id: string) => {
    const updatedEvents = events.filter((e) => e.id !== id);
    setEvents(updatedEvents);
    await persistEvents(updatedEvents);

    // Cancel notification
    try {
      await cancelEventNotification(id);
    } catch (error) {
      console.error('[CalendarScreen] Error cancelling notification:', error);
    }
  };



  // -- Navigation helpers ----------------------------------------------------
  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const navigate = (dir: 1 | -1) => {
    if (viewMode === 'year') {
      setYear(y => y + dir);
    } else if (viewMode === 'month') {
      dir > 0 ? nextMonth() : prevMonth();
    } else if (viewMode === 'week') {
      const nd = new Date(selDate);
      nd.setDate(nd.getDate() + dir * 7);
      setSelDate(nd);
      setYear(nd.getFullYear());
      setMonth(nd.getMonth());
    } else if (viewMode === 'day') {
      const nd = new Date(selDate);
      nd.setDate(nd.getDate() + dir);
      setSelDate(nd);
      setSelDay(nd.getDate());
      setYear(nd.getFullYear());
      setMonth(nd.getMonth());
    }
  };

  // Keep navigateRef current so PanResponder doesn't have a stale closure
  navigateRef.current = navigate;

  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelDay(today.getDate());
    setSelDate(new Date(today));
    if (viewMode !== 'month') setViewMode('month');
  };

  const openNew = () => { setEditing(undefined); setFormOpen(true); };
  const openEdit = (ev: SimpleEvent) => {
    const fmt = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setEditing({ ...ev, startStr: fmt(ev.start), endStr: fmt(ev.end) });
    setFormOpen(true);
  };

  // -- Derived state ---------------------------------------------------------
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const selDateStr     = `${year}-${pad(month + 1)}-${pad(selDay)}`;
  const firstDay       = firstDayOf(year, month);
  const totalDays      = daysInMonth(year, month);
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  const eventsByDay = useMemo(() => {
    const map: Record<number, SimpleEvent[]> = {};
    events.forEach((e) => {
      const d = e.start.getDate();
      if (e.start.getMonth() === month && e.start.getFullYear() === year) {
        if (!map[d]) map[d] = [];
        map[d].push(e);
      }
    });
    return map;
  }, [events, month, year]);

  const dayEvents = useMemo(() =>
    events
      .filter((e) => {
        const d = e.start;
        return d.getFullYear() === year && d.getMonth() === month && d.getDate() === selDay;
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [events, year, month, selDay]);

  // Events indexed by year-month key for the year view dots
  const eventsByYearMonth = useMemo(() => {
    const map: Record<string, Set<number>> = {};
    events.forEach((e) => {
      const key = `${e.start.getFullYear()}-${e.start.getMonth()}`;
      if (!map[key]) map[key] = new Set();
      map[key].add(e.start.getDate());
    });
    return map;
  }, [events]);

  const weekStart = useMemo(() => startOfWeek(selDate), [selDate]);

  // SA public holidays for the current year
  const holidays = useMemo(() => getSAHolidays(year), [year]);

  // -- Header label ----------------------------------------------------------
  const headerLabel = useMemo(() => {
    if (viewMode === 'year')  return `${year}`;
    if (viewMode === 'month') return `${MONTHS[month]} ${year}`;
    if (viewMode === 'week') {
      const ws = weekStart;
      const we = new Date(ws); we.setDate(ws.getDate() + 6);
      if (ws.getMonth() === we.getMonth())
        return `${MONTHS_SHORT[ws.getMonth()]} ${ws.getDate()}�${we.getDate()}, ${ws.getFullYear()}`;
      return `${MONTHS_SHORT[ws.getMonth()]} ${ws.getDate()} � ${MONTHS_SHORT[we.getMonth()]} ${we.getDate()}, ${ws.getFullYear()}`;
    }
    if (viewMode === 'day') {
      return `${WEEK_DAYS[selDate.getDay()]}, ${MONTHS_SHORT[selDate.getMonth()]} ${selDate.getDate()}`;
    }
    return 'Schedule';
  }, [viewMode, year, month, weekStart, selDate]);

  const showNavArrows = false; // replaced by swipe gesture

  return (
    <View style={styles.root}>
      <AppBg />

      {/* -- Header -- */}
      <View style={[styles.header, { backgroundColor: FG.glassBg, borderBottomColor: FG.glassBorder }]}>
        {/* Left: back arrow */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navBtn}>
          <AppIcon name="chevron-back" size={26} />
        </TouchableOpacity>
        <AppText style={[styles.monthYear, { color: textColor, fontFamily }]}>
          {headerLabel}
        </AppText>
        <View style={styles.headerRight}>
          {/* Hamburger � opens side menu */}
          <TouchableOpacity onPress={() => setMenuOpen(true)} style={styles.navBtn}>
            <AppIcon name="menu-outline" size={26} color={FG.secondary} />
          </TouchableOpacity>
          {/* Today button */}
          {!(viewMode === 'month' && isCurrentMonth && selDay === today.getDate()) && (
            <TouchableOpacity onPress={goToday} style={[styles.todayBtn, { borderColor: COLORS.blue }]}>
              <AppText fixedColor style={styles.todayBtnTxt}>Today</AppText>
            </TouchableOpacity>
          )}
          {showNavArrows && null}
          <TouchableOpacity onPress={openNew} style={styles.addBtn}>
            <LinearGradient colors={GRADIENTS.primary} style={styles.addBtnInner}>
              <AppIcon name="add" size={22} color="#fff" fixedColor />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* -- Side menu -- */}
      <SideMenu
        visible={menuOpen}
        active={viewMode}
        onChange={setViewMode}
        onClose={() => setMenuOpen(false)}
      />

      {viewMode === 'year' && (
        <YearView
          year={year}
          today={today}
          eventsByYearMonth={eventsByYearMonth}
          onSelectMonth={(m) => {
            setMonth(m);
            setViewMode('month');
          }}
        />
      )}

      {/* -- MONTH VIEW -- */}
      {viewMode === 'month' && (
        <View style={{ flex: 1 }} {...panResponder.panHandlers}>
          {/* Week labels */}
          <View style={[styles.weekRow, { backgroundColor: FG.glassBg }]}>
            {WEEK_DAYS.map((d, i) => (
              <View key={d} style={styles.weekCell}>
                <AppText style={[styles.weekLabel, {
                  color: i === 0 ? COLORS.missed : i === 6 ? COLORS.blue : FG.secondary,
                }]}>{d}</AppText>
              </View>
            ))}
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Month grid */}
            <View style={styles.grid}>
              {cells.map((day, i) => {
                if (day === null) return <View key={`e-${i}`} style={styles.cell} />;
                const isToday = isCurrentMonth && day === today.getDate();
                const isSel   = day === selDay;
                const dow     = (firstDay + day - 1) % 7;
                const evs     = eventsByDay[day] ?? [];
                return (
                  <TouchableOpacity key={day} style={styles.cell} onPress={() => setSelDay(day)} activeOpacity={0.7}>
                    <View style={[styles.dayNumWrap, isSel && styles.dayNumSel, isToday && !isSel && styles.dayNumToday]}>
                      <AppText style={[
                        styles.dayNum,
                        { color: dow === 0 ? COLORS.missed : dow === 6 ? COLORS.blue : textColor },
                        isSel && styles.dayNumTxtSel,
                        isToday && !isSel && styles.dayNumTxtToday,
                      ]}>{day}</AppText>
                    </View>
                    {evs.slice(0, 2).map((ev) => (
                      <View key={ev.id} style={[styles.eventPill, { backgroundColor: ev.color }]}>
                        <AppText fixedColor style={styles.eventPillTxt} numberOfLines={1}>{ev.title}</AppText>
                      </View>
                    ))}
                    {evs.length > 2 && (
                      <AppText style={[styles.moreLabel, { color: FG.secondary }]}>+{evs.length - 2}</AppText>
                    )}
                    {/* SA public holiday pill */}
                    {(() => {
                      const hKey = `${year}-${pad(month + 1)}-${pad(day)}`;
                      const hName = holidays[hKey];
                      return hName ? (
                        <View style={styles.holidayPill}>
                          <AppText fixedColor style={styles.holidayPillTxt} numberOfLines={1}>{hName}</AppText>
                        </View>
                      ) : null;
                    })()}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Day header */}
            <View style={[styles.dayDivider, { borderTopColor: FG.glassBorder }]}>
              <AppText style={[styles.dayDividerTxt, { color: textColor, fontFamily }]}>
                {WEEK_DAYS[new Date(year, month, selDay).getDay()]}, {MONTHS[month].slice(0, 3)} {selDay}
              </AppText>
              <TouchableOpacity onPress={openNew} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <AppIcon name="add-circle-outline" size={22} />
              </TouchableOpacity>
            </View>

            {/* Events for selected day � card list only, no hourly time slots */}
            {dayEvents.length === 0 ? (
              <View style={styles.noDayEvents}>
                <AppText style={[styles.noDayEventsTxt, { color: FG.secondary }]}>No events � tap + to add</AppText>
              </View>
            ) : dayEvents.map((ev) => (
              <TouchableOpacity key={ev.id}
                style={[styles.dayEventRow, bevel]}
                onPress={() => openEdit(ev)} activeOpacity={0.8}>
                <View style={[styles.dayEventAccent, { backgroundColor: ev.color }]} />
                <View style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 12 }}>
                  <AppText style={[styles.dayEventTitle, { color: textColor, fontFamily }]} numberOfLines={1}>{ev.title}</AppText>
                  <AppText style={[styles.dayEventTime, { color: FG.secondary }]}>
                    {pad(ev.start.getHours())}:{pad(ev.start.getMinutes())} � {pad(ev.end.getHours())}:{pad(ev.end.getMinutes())}
                  </AppText>
                </View>
                <AppIcon name="chevron-forward" size={16} color={FG.secondary} style={{ marginRight: 12 }} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* -- WEEK VIEW -- */}
      {viewMode === 'week' && (
        <WeekView
          weekStart={weekStart}
          today={today}
          events={events}
          onSelectDay={(d) => {
            setSelDate(d);
            setSelDay(d.getDate());
            setYear(d.getFullYear());
            setMonth(d.getMonth());
            setViewMode('day');
          }}
          onEditEvent={openEdit}
        />
      )}

      {/* -- DAY VIEW -- */}
      {viewMode === 'day' && (
        <DayView
          date={selDate}
          today={today}
          events={events}
          onEditEvent={openEdit}
          onNewEvent={openNew}
        />
      )}

      {/* -- SCHEDULE VIEW -- */}
      {viewMode === 'schedule' && (
        <ScheduleView
          events={events}
          calendars={[]}
          onEditEvent={openEdit}
        />
      )}

      <EventForm
        visible={formOpen}
        initial={editing}
        dateStr={selDateStr}
        calendars={[]}
        onSave={saveEvent}
        onDelete={deleteEvent}
        onClose={() => setFormOpen(false)}
      />
    </View>
  );
}

// --- Styles ------------------------------------------------------------------
const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'web' ? 16 : 52, paddingBottom: 10, paddingHorizontal: 14, borderBottomWidth: 1,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  monthYear:   { fontSize: 20, fontWeight: '700' },
  todayBtn:    { borderWidth: 1.5, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4, marginRight: 4 },
  todayBtnTxt: { fontSize: 12, fontWeight: '600', color: COLORS.blue },
  navBtn:      { padding: 4 },
  addBtn:      { marginLeft: 4 },
  addBtnInner: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', ...SHADOW.button },

  weekRow:  { flexDirection: 'row', paddingVertical: 6 },
  weekCell: { flex: 1, alignItems: 'center' },
  weekLabel:{ fontSize: 11, fontWeight: '700' },

  permBanner: {},
  permBannerTxt: {},

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, minHeight: 64, paddingBottom: 4, paddingHorizontal: 1, alignItems: 'center' },

  dayNumWrap:     { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  dayNumSel:      { backgroundColor: COLORS.blue },
  dayNumToday:    { backgroundColor: 'rgba(30,156,240,0.15)', borderWidth: 1, borderColor: COLORS.blue },
  dayNum:         { fontSize: 13 },
  dayNumTxtSel:   { color: '#fff', fontWeight: '700' },
  dayNumTxtToday: { color: COLORS.blue, fontWeight: '700' },

  eventPill:    { width: '96%', borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1, marginTop: 1 },
  eventPillTxt: { fontSize: 9, color: '#fff', fontWeight: '600' },
  moreLabel:    { fontSize: 9, marginTop: 1 },
  holidayPill:  { width: '96%', borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1, marginTop: 1, backgroundColor: '#e84343' },
  holidayPillTxt: { fontSize: 8, color: '#fff', fontWeight: '700' },

  dayDivider:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1 },
  dayDividerTxt: { fontSize: 14, fontWeight: '700' },

  noDayEvents:    { alignItems: 'center', paddingVertical: 20 },
  noDayEventsTxt: { fontSize: 13 },
  dayEventRow:    { flexDirection: 'row', alignItems: 'center', marginHorizontal: 14, marginBottom: 8, borderRadius: RADIUS.lg, overflow: 'hidden' },
  dayEventAccent: { width: 5, alignSelf: 'stretch' },
  dayEventTitle:  { fontSize: 14, fontWeight: '600' },
  dayEventTime:   { fontSize: 12, marginTop: 2 },

  timelineEvent: { position: 'absolute', left: 0, right: 0, borderRadius: 4, borderLeftWidth: 3, padding: 4, overflow: 'hidden' },
  timelineTitle: { fontSize: 12, fontWeight: '600', color: '#fff' },
  timelineTime:  { fontSize: 10, color: 'rgba(255,255,255,0.80)', marginTop: 1 },
});

// Side menu styles
const side = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  drawer: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: 260, overflow: 'hidden',
    // Curved right corners only
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    ...SHADOW.glow,
  },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(135,206,235,0.15)' },

  topRow: {
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingTop: Platform.OS === 'web' ? 16 : 56, paddingHorizontal: 16, paddingBottom: 4,
  },
  closeBtn: { padding: 4 },

  brandRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
  },
  brandIcon: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.button,
  },
  brandName: { fontSize: 20, fontWeight: '800' },

  divider: { height: 1, marginHorizontal: 20, marginBottom: 8 },

  menuList:  { gap: 4, paddingHorizontal: 10 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 12, paddingVertical: 14,
    borderRadius: 16,
  },
  iconWrap: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  menuLabel:       { flex: 1, fontSize: 15, fontWeight: '500' },
  menuLabelActive: { fontWeight: '700' },
  activeBar: {
    width: 4, height: 24, borderRadius: 2,
    backgroundColor: COLORS.blue,
  },
});

// Year view styles
const yearStyles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 8, paddingBottom: 40 },
  monthCard: {
    width: '48%', margin: '1%', borderRadius: RADIUS.md, padding: 10,
  },
  monthName:     { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  miniWeekRow:   { flexDirection: 'row', marginBottom: 2 },
  miniWeekLabel: { flex: 1, fontSize: 8, textAlign: 'center', fontWeight: '600' },
  miniRow:       { flexDirection: 'row' },
  miniCell:      { flex: 1, alignItems: 'center', paddingVertical: 1 },
  miniDayWrap:   { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  miniDayToday:  { backgroundColor: COLORS.blue },
  miniDay:       { fontSize: 9 },
  miniDot:       { width: 4, height: 4, borderRadius: 2, marginTop: 1 },
});

// Week view styles
const weekStyles = StyleSheet.create({
  headerRow:    { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 6 },
  timeGutter:   { width: 50 },
  dayHeader:    { flex: 1, alignItems: 'center' },
  dayHeaderWd:  { fontSize: 10, fontWeight: '700' },
  dayHeaderNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  dayHeaderNumTxt: { fontSize: 12, fontWeight: '700' },
  hourRow:      { flexDirection: 'row', minHeight: HOUR_H, borderTopWidth: StyleSheet.hairlineWidth },
  hourLabel:    { width: 50, fontSize: 10, paddingTop: 4, paddingLeft: 6, textAlign: 'right' },
  dayCol:       { flex: 1, borderLeftWidth: StyleSheet.hairlineWidth, paddingHorizontal: 1, minHeight: HOUR_H, position: 'relative' },
  weekEvent:    { borderRadius: 3, borderLeftWidth: 3, padding: 2, marginBottom: 2 },
  weekEventTxt: { fontSize: 9, color: '#fff', fontWeight: '600' },
});

// Day view styles
const dayStyles = StyleSheet.create({
  dayHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  dayTitle:    { fontSize: 15, fontWeight: '700' },
  hourRow:     { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  hourLabel:   { width: 50, fontSize: 11, paddingTop: 4, paddingLeft: 14, textAlign: 'right' },
  hourSlot:    { flex: 1, position: 'relative', marginLeft: 8, marginRight: 8 },
  timelineEvent: { position: 'absolute', left: 0, right: 0, borderRadius: 5, borderLeftWidth: 3, padding: 6, overflow: 'hidden' },
  timelineTitle: { fontSize: 13, fontWeight: '700', color: '#fff' },
  timelineTime:  { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  timelineNotes: { fontSize: 10, color: 'rgba(255,255,255,0.70)', marginTop: 2 },
});

// Schedule view styles
const schedStyles = StyleSheet.create({
  empty:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTxt:      { fontSize: 15, fontWeight: '500' },
  sectionHeader: { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionTitle:  { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  eventRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  colorDot:      { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  eventInfo:     { flex: 1 },
  eventTitle:    { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  eventTime:     { fontSize: 12 },
});

const form = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)', justifyContent: 'flex-end' },
  sheet:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', overflow: 'hidden', ...SHADOW.glow },
  scrim:   { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(135,206,235,0.15)' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(30,156,240,0.20)',
    backgroundColor: 'rgba(135,206,235,0.15)',
  },
  headTitle: { fontSize: 16, fontWeight: '700' },
  cancelTxt: { fontSize: 15, color: COLORS.sub },
  saveBtn:   { borderRadius: RADIUS.full, paddingHorizontal: 18, paddingVertical: 8 },
  saveTxt:   { fontSize: 14, fontWeight: '700', color: '#fff' },

  body: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, gap: 4 },

  field:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1.5 },
  fieldInput:  { flex: 1, fontSize: 16, padding: 0 },
  fieldText:   { flex: 1, fontSize: 16 },

  timeRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginVertical: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 },
  timeInput:    { fontSize: 16, paddingVertical: 8, borderBottomWidth: 1.5 },

  calChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: 'rgba(30,156,240,0.25)', marginRight: 8 },
  calDot:  { width: 10, height: 10, borderRadius: 5 },
  calName: { fontSize: 12, fontWeight: '600' },

  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  dot:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dotSel:   { borderWidth: 3, borderColor: '#fff', ...SHADOW.button },

  deleteRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 28, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(232,67,67,0.25)' },
  deleteTxt: { fontSize: 15, fontWeight: '600', color: COLORS.missed },
});
