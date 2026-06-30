// ─── Screen: Notes ───────────────────────────────────────────────────────────
// Features:
//   • Rich text toolbar: bold, bullet list, numbered list, checkbox list
//   • Drawing canvas (PanResponder) with colour picker + clear
//   • Attachment picker: images (expo-image-picker) + docs (expo-document-picker)
//   • Emoji picker
//   • Checkbox → task-complete confirmation
import React, { useState, useRef, useCallback } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Alert, Modal, KeyboardAvoidingView,
  Platform, ScrollView, PanResponder, Image,
  GestureResponderEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBg, AppText, AppIcon, useForeground, useTypography, useGlass } from '../context/ThemeContext';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';
import { Note, NoteAttachment, DrawStroke } from '../types';
import { NOTES } from '../data/mockData';

// ─── Emoji picker ──────────────────────────────────────────────────────────────
const EMOJI_ROWS = [
  ['😀','😂','😍','🥰','😎','😢','😡','👍','👎','❤️'],
  ['🔥','🎉','🙏','💯','✅','🤣','😅','🤔','👀','💪'],
  ['🥳','😭','🌟','💡','📝','📌','🎯','🚀','💎','🌈'],
  ['🍎','🎵','🏆','⚡','🌺','🦋','🐶','🎨','📚','🏠'],
];
function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  const { FG } = useForeground();
  return (
    <View style={ep.container}>
      <View style={[ep.header, { borderBottomColor: FG.glassBorder }]}>
        <AppText style={[ep.title, { color: FG.secondary }]}>Emoji</AppText>
        <TouchableOpacity onPress={onClose}>
          <AppIcon name="close" size={18} color={FG.secondary} />
        </TouchableOpacity>
      </View>
      {EMOJI_ROWS.map((row, ri) => (
        <View key={ri} style={ep.row}>
          {row.map((emoji) => (
            <TouchableOpacity key={emoji} style={ep.cell} onPress={() => onPick(emoji)}>
              <AppText fixedColor style={ep.emoji}>{emoji}</AppText>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
}
const ep = StyleSheet.create({
  container: { paddingHorizontal: 4, paddingBottom: 4 },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 4 },
  title:     { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  row:       { flexDirection: 'row' },
  cell:      { width: '10%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  emoji:     { fontSize: 22 },
});

// ─── Drawing canvas ────────────────────────────────────────────────────────────
const DRAW_COLORS = ['#1a7fe8','#e84343','#10b981','#f59e0b','#8b5cf6','#ec4899','#000000','#ffffff'];
const CANVAS_H = 260;

interface DrawCanvasProps {
  strokes: DrawStroke[];
  onChange: (s: DrawStroke[]) => void;
}
function DrawCanvas({ strokes, onChange }: DrawCanvasProps) {
  const { FG } = useForeground();
  const [penColor, setPenColor] = useState('#1a7fe8');
  const penWidth = 4;  // slightly thicker for smooth visible lines

  // Use refs so PanResponder callbacks always read the current values
  const penColorRef  = useRef(penColor);
  const strokesRef   = useRef(strokes);
  const currentStroke = useRef<{ x: number; y: number }[]>([]);
  const [, forceUpdate] = useState(0);

  // Keep refs in sync every render
  penColorRef.current  = penColor;
  strokesRef.current   = strokes;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        currentStroke.current = [{ x: locationX, y: locationY }];
        forceUpdate((n) => n + 1);
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        // Push directly to avoid re-creating the array on every pixel
        currentStroke.current.push({ x: locationX, y: locationY });
        forceUpdate((n) => n + 1);
      },
      onPanResponderRelease: () => {
        if (currentStroke.current.length > 1) {
          // Read from refs — always current, no stale closure
          onChange([
            ...strokesRef.current,
            { points: [...currentStroke.current], color: penColorRef.current, width: penWidth },
          ]);
        }
        currentStroke.current = [];
        forceUpdate((n) => n + 1);
      },
    })
  ).current;

  // Render strokes as connected LINE SEGMENTS between consecutive points
  const renderStroke = (stroke: DrawStroke, key: string) => {
    const segs: React.ReactElement[] = [];
    for (let i = 1; i < stroke.points.length; i++) {
      const p1 = stroke.points[i - 1];
      const p2 = stroke.points[i];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 0.5) continue;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const midX  = (p1.x + p2.x) / 2;
      const midY  = (p1.y + p2.y) / 2;
      segs.push(
        <View
          key={`${key}-${i}`}
          style={{
            position:        'absolute',
            width:           len,
            height:          stroke.width,
            backgroundColor: stroke.color,
            borderRadius:    stroke.width / 2,
            left:  midX - len / 2,
            top:   midY - stroke.width / 2,
            transform: [{ rotate: `${angle}deg` }],
          }}
        />,
      );
    }
    return segs;
  };

  // Live stroke — same line-segment approach for the in-progress stroke
  const renderLiveStroke = () => {
    const pts = currentStroke.current;
    const segs: React.ReactElement[] = [];
    for (let i = 1; i < pts.length; i++) {
      const p1 = pts[i - 1];
      const p2 = pts[i];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 0.5) continue;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const midX  = (p1.x + p2.x) / 2;
      const midY  = (p1.y + p2.y) / 2;
      segs.push(
        <View
          key={`live-${i}`}
          style={{
            position:        'absolute',
            width:           len,
            height:          penWidth,
            backgroundColor: penColor,
            borderRadius:    penWidth / 2,
            left:  midX - len / 2,
            top:   midY - penWidth / 2,
            transform: [{ rotate: `${angle}deg` }],
          }}
        />,
      );
    }
    return segs;
  };

  return (
    <View>
      {/* Colour palette + clear */}
      <View style={draw.palette}>
        {DRAW_COLORS.map((c) => (
          <TouchableOpacity
            key={c}
            style={[draw.swatch, { backgroundColor: c }, penColor === c && draw.swatchSel]}
            onPress={() => setPenColor(c)}
          />
        ))}
        <View style={draw.paletteSep} />
        <TouchableOpacity style={draw.clearBtn} onPress={() => onChange([])}>
          <AppIcon name="trash-outline" size={16} color={COLORS.missed} fixedColor />
        </TouchableOpacity>
      </View>

      {/* Canvas — must NOT be inside a ScrollView or touches are hijacked */}
      <View
        style={[draw.canvas, { borderColor: FG.glassBorder, backgroundColor: FG.glassBg }]}
        {...panResponder.panHandlers}
      >
        {strokes.map((s, i) => renderStroke(s, `s${i}`))}
        {renderLiveStroke()}
        {strokes.length === 0 && currentStroke.current.length === 0 && (
          <AppText style={[draw.canvasHint, { color: FG.faint }]}>
            ✏️  Draw with your finger
          </AppText>
        )}
      </View>
    </View>
  );
}
const draw = StyleSheet.create({
  palette:    { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  swatch:     { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  swatchSel:  { borderColor: COLORS.blue, transform: [{ scale: 1.2 }] },
  paletteSep: { flex: 1 },
  clearBtn:   { padding: 4 },
  hint:       { fontSize: 11, marginLeft: 4 },
  canvas: {
    marginHorizontal: 16, height: CANVAS_H,
    borderRadius: RADIUS.lg, borderWidth: 1,
    overflow: 'hidden', position: 'relative',
  },
  canvasHint: { position: 'absolute', top: '45%', alignSelf: 'center', fontSize: 13 },
});

// ─── List-format helpers ───────────────────────────────────────────────────────
const BULLET   = '• ';
const NUMBERED_RE = /^\d+\.\s/;

function insertListPrefix(body: string, prefix: string): string {
  const lines = body.split('\n');
  const lastLine = lines[lines.length - 1] ?? '';
  // If last line already starts with this prefix, add a new line with same prefix
  if (lastLine.startsWith(prefix)) {
    return body + '\n' + prefix;
  }
  // Otherwise just append a new line with prefix
  return body + (body.length > 0 ? '\n' : '') + prefix;
}

function buildNumberedBody(body: string): string {
  const lines = body.split('\n');
  const lastLine = lines[lines.length - 1] ?? '';
  const match = lastLine.match(NUMBERED_RE);
  const nextNum = match ? parseInt(match[0]) + 1 : 1;
  return body + (body.length > 0 ? '\n' : '') + `${nextNum}. `;
}

// ─── Tab type for editor modes ────────────────────────────────────────────────
type EditorTab = 'write' | 'draw';

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function NotesScreen() {
  const navigation = useNavigation();
  const { FG }     = useForeground();
  const { fontFamily, textColor } = useTypography();
  const { bevel }  = useGlass();
  const insets     = useSafeAreaInsets();

  const [notes,       setNotes]       = useState<Note[]>(NOTES);
  const [query,       setQuery]       = useState('');
  const [editorOpen,  setEditorOpen]  = useState(false);
  const [editing,     setEditing]     = useState<Note | null>(null);
  const [draftTitle,  setDraftTitle]  = useState('');
  const [draftBody,   setDraftBody]   = useState('');
  const [draftStrokes, setDraftStrokes] = useState<DrawStroke[]>([]);
  const [draftAttachments, setDraftAttachments] = useState<NoteAttachment[]>([]);
  const [showEmoji,   setShowEmoji]   = useState(false);
  const [emojiTarget, setEmojiTarget] = useState<'title' | 'body'>('body');
  const [editorTab,   setEditorTab]   = useState<EditorTab>('write');
  const [confirmNote, setConfirmNote] = useState<Note | null>(null);

  const bodyInputRef = useRef<TextInput>(null);

  const filtered = query.trim()
    ? notes.filter((n) =>
        n.title.toLowerCase().includes(query.toLowerCase()) ||
        n.preview.toLowerCase().includes(query.toLowerCase()))
    : notes;

  // ── Editor open/close ──────────────────────────────────────────────────────
  const openNew = () => {
    setEditing(null);
    setDraftTitle('');
    setDraftBody('');
    setDraftStrokes([]);
    setDraftAttachments([]);
    setShowEmoji(false);
    setEditorTab('write');
    setEditorOpen(true);
  };

  const openEdit = (note: Note) => {
    setEditing(note);
    setDraftTitle(note.title);
    setDraftBody(note.preview);
    setDraftStrokes(note.strokes ?? []);
    setDraftAttachments(note.attachments ?? []);
    setShowEmoji(false);
    setEditorTab('write');
    setEditorOpen(true);
  };

  const insertEmoji = (emoji: string) => {
    if (emojiTarget === 'title') setDraftTitle((t) => t + emoji);
    else setDraftBody((b) => b + emoji);
    setShowEmoji(false);
  };

  // ── Formatting helpers ─────────────────────────────────────────────────────
  const insertBullet   = () => setDraftBody((b) => insertListPrefix(b, BULLET));
  const insertNumbered = () => setDraftBody((b) => buildNumberedBody(b));
  const insertCheckbox = () => setDraftBody((b) => insertListPrefix(b, '☐ '));
  const insertBold     = () => setDraftBody((b) => b + '**bold**');

  // ── Attachment pickers ─────────────────────────────────────────────────────
  const pickImage = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo access to add images.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (!result.canceled) {
      const newAttachments: NoteAttachment[] = result.assets.map((a) => ({
        uri:  a.uri,
        name: a.fileName ?? `image_${Date.now()}.jpg`,
        type: 'image' as const,
      }));
      setDraftAttachments((prev) => [...prev, ...newAttachments]);
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true });
    if (!result.canceled) {
      const newAttachments: NoteAttachment[] = result.assets.map((a) => ({
        uri:  a.uri,
        name: a.name,
        type: 'document' as const,
      }));
      setDraftAttachments((prev) => [...prev, ...newAttachments]);
    }
  };

  const removeAttachment = (uri: string) =>
    setDraftAttachments((prev) => prev.filter((a) => a.uri !== uri));

  // ── Save / delete ──────────────────────────────────────────────────────────
  const saveNote = () => {
    if (!draftTitle.trim() && !draftBody.trim() && draftStrokes.length === 0 && draftAttachments.length === 0) {
      setEditorOpen(false);
      return;
    }
    const today = new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
    const updated: Partial<Note> = {
      title:       draftTitle.trim() || 'Untitled',
      preview:     draftBody.trim(),
      date:        today,
      strokes:     draftStrokes,
      attachments: draftAttachments,
    };
    if (editing) {
      setNotes((prev) => prev.map((n) => n.id === editing.id ? { ...n, ...updated } : n));
    } else {
      setNotes((prev) => [{ id: Date.now(), checked: false, ...updated } as Note, ...prev]);
    }
    setEditorOpen(false);
  };

  const confirmDelete = (note: Note) => {
    Alert.alert(
      'Delete note?',
      `"${note.title}" will be permanently deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => { setNotes((prev) => prev.filter((n) => n.id !== note.id)); setEditorOpen(false); } },
      ],
    );
  };

  // ── Checkbox flow ──────────────────────────────────────────────────────────
  const handleCheckbox = (note: Note) => {
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, checked: true } : n)));
    setConfirmNote(note);
  };
  const handleKeep = () => {
    if (confirmNote) setNotes((prev) => prev.map((n) => (n.id === confirmNote.id ? { ...n, checked: false } : n)));
    setConfirmNote(null);
  };
  const handleDeleteConfirmed = () => {
    if (!confirmNote) return;
    setNotes((prev) => prev.filter((n) => n.id !== confirmNote.id));
    setConfirmNote(null);
  };

  // ── Note card ──────────────────────────────────────────────────────────────
  const renderNote = ({ item }: { item: Note }) => (
    <TouchableOpacity
      style={[styles.noteCard, bevel]}
      activeOpacity={0.75}
      onPress={() => openEdit(item)}
    >
      <View style={styles.noteTop}>
        <AppText style={[styles.noteTitle, { color: textColor, fontFamily }]} numberOfLines={1}>
          {item.title}
        </AppText>
        <TouchableOpacity onPress={() => handleCheckbox(item)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          {item.checked ? (
            <LinearGradient colors={GRADIENTS.primary} style={styles.checkbox}>
              <AppIcon name="checkmark" size={13} color="#fff" fixedColor />
            </LinearGradient>
          ) : (
            <View style={[styles.checkbox, styles.checkboxEmpty, { borderColor: COLORS.blue }]} />
          )}
        </TouchableOpacity>
      </View>
      <AppText style={[styles.notePreview, { color: FG.secondary }]} numberOfLines={2}>
        {item.preview}
      </AppText>
      {/* Attachment / drawing indicators */}
      <View style={styles.noteChips}>
        {(item.attachments?.length ?? 0) > 0 && (
          <View style={[styles.noteChip, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}>
            <AppIcon name="attach" size={11} color={FG.secondary} />
            <AppText style={[styles.noteChipTxt, { color: FG.secondary }]}>{item.attachments!.length}</AppText>
          </View>
        )}
        {(item.strokes?.length ?? 0) > 0 && (
          <View style={[styles.noteChip, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}>
            <AppIcon name="pencil" size={11} color={FG.secondary} />
            <AppText style={[styles.noteChipTxt, { color: FG.secondary }]}>Drawing</AppText>
          </View>
        )}
      </View>
      <AppText style={[styles.noteDate, { color: FG.faint }]}>{item.date}</AppText>
    </TouchableOpacity>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <AppBg />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: FG.glassBg, borderBottomColor: FG.glassBorder, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <AppIcon name="chevron-back" size={26} color={COLORS.blue} fixedColor />
        </TouchableOpacity>
        <AppText style={[styles.title, { color: textColor, fontFamily }]}>Notes</AppText>
        <TouchableOpacity onPress={openNew} style={styles.iconBtn}>
          <LinearGradient colors={GRADIENTS.primary} style={styles.addBtnInner}>
            <AppIcon name="add" size={22} color="#fff" fixedColor />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, bevel]}>
        <AppIcon name="search-outline" size={16} color={FG.secondary} />
        <TextInput
          style={[styles.searchInput, { color: textColor }]}
          placeholder="Search notes"
          placeholderTextColor={FG.faint}
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <AppIcon name="close-circle" size={16} color={FG.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Notes list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderNote}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <AppIcon name="document-text-outline" size={52} color={FG.secondary} />
            <AppText style={[styles.emptyText, { color: FG.secondary }]}>
              {query ? 'No matching notes' : 'No notes yet — tap + to create one'}
            </AppText>
          </View>
        }
      />

      {/* ── Note editor modal ── */}
      <Modal visible={editorOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditorOpen(false)}>
        <View style={styles.editorRoot}>
          <AppBg />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />

          <KeyboardAvoidingView style={styles.editorContent} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

            {/* Editor header */}
            <View style={[styles.editorHeader, { backgroundColor: FG.glassBg, borderBottomColor: FG.glassBorder, paddingTop: insets.top + 10 }]}>
              <TouchableOpacity onPress={() => setEditorOpen(false)} style={styles.editorHBtn}>
                <AppText style={[styles.cancelTxt, { color: COLORS.sub }]}>Cancel</AppText>
              </TouchableOpacity>
              <AppText style={[styles.editorHTitle, { color: textColor, fontFamily }]}>
                {editing ? 'Edit Note' : 'New Note'}
              </AppText>
              <TouchableOpacity onPress={saveNote} style={styles.editorHBtn}>
                <LinearGradient colors={GRADIENTS.primary} style={styles.saveBtn}>
                  <AppText fixedColor style={styles.saveTxt}>Save</AppText>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Write / Draw tabs */}
            <View style={[styles.tabRow, { backgroundColor: FG.glassBg, borderBottomColor: FG.glassBorder }]}>
              {(['write', 'draw'] as EditorTab[]).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tabBtn, editorTab === tab && styles.tabBtnActive]}
                  onPress={() => { setEditorTab(tab); setShowEmoji(false); }}
                  activeOpacity={0.8}
                >
                  <AppIcon
                    name={tab === 'write' ? 'document-text-outline' : 'brush-outline'}
                    size={16}
                    color={editorTab === tab ? COLORS.blue : FG.secondary}
                    fixedColor={editorTab === tab}
                  />
                  <AppText style={[styles.tabBtnTxt, { color: editorTab === tab ? COLORS.blue : FG.secondary }]}>
                    {tab === 'write' ? 'Write' : 'Draw'}
                  </AppText>
                </TouchableOpacity>
              ))}
            </View>

            {editorTab === 'write' ? (
              <>
                {/* Title */}
                <View style={[styles.titleRow, { borderBottomColor: FG.glassBorder }]}>
                  <TextInput
                    style={[styles.titleInput, { color: textColor }]}
                    placeholder="Title"
                    placeholderTextColor={FG.faint}
                    value={draftTitle}
                    onChangeText={setDraftTitle}
                    returnKeyType="next"
                    autoFocus={!editing}
                    onFocus={() => setEmojiTarget('title')}
                  />
                  <TouchableOpacity onPress={() => { setEmojiTarget('title'); setShowEmoji((v) => !v); }} style={styles.emojiToggle}>
                    <AppText fixedColor style={styles.emojiToggleTxt}>😊</AppText>
                  </TouchableOpacity>
                </View>

                {/* Body */}
                <ScrollView style={styles.bodyScroll} keyboardShouldPersistTaps="handled">
                  <TextInput
                    ref={bodyInputRef}
                    style={[styles.bodyInput, { color: textColor }]}
                    placeholder="Start writing…"
                    placeholderTextColor={FG.faint}
                    value={draftBody}
                    onChangeText={setDraftBody}
                    multiline
                    textAlignVertical="top"
                    onFocus={() => { setEmojiTarget('body'); setShowEmoji(false); }}
                  />

                  {/* Attachment chips */}
                  {draftAttachments.length > 0 && (
                    <View style={styles.attachRow}>
                      {draftAttachments.map((a) => (
                        <View key={a.uri} style={[styles.attachChip, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}>
                          {a.type === 'image'
                            ? <Image source={{ uri: a.uri }} style={styles.attachThumb} />
                            : <AppIcon name="document-outline" size={22} color={COLORS.blue} fixedColor />
                          }
                          <AppText style={[styles.attachChipName, { color: textColor }]} numberOfLines={1}>{a.name}</AppText>
                          <TouchableOpacity onPress={() => removeAttachment(a.uri)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                            <AppIcon name="close-circle" size={16} color={COLORS.missed} fixedColor />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </ScrollView>

                {/* Emoji picker */}
                {showEmoji && (
                  <View style={[styles.emojiPanel, { backgroundColor: FG.glassBg, borderTopColor: FG.glassBorder }]}>
                    <EmojiPicker onPick={insertEmoji} onClose={() => setShowEmoji(false)} />
                  </View>
                )}

                {/* Formatting + tools toolbar */}
                <View style={[styles.toolbar, { backgroundColor: FG.glassBg, borderTopColor: FG.glassBorder }]}>
                  {/* Format buttons */}
                  <TouchableOpacity style={styles.toolBtn} onPress={insertBold}>
                    <AppText style={[styles.toolBtnTxt, { color: FG.secondary, fontWeight: '800' }]}>B</AppText>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.toolBtn} onPress={insertBullet}>
                    <AppIcon name="list-outline" size={20} color={FG.secondary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.toolBtn} onPress={insertNumbered}>
                    <AppIcon name="list-circle-outline" size={20} color={FG.secondary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.toolBtn} onPress={insertCheckbox}>
                    <AppIcon name="checkbox-outline" size={20} color={FG.secondary} />
                  </TouchableOpacity>

                  <View style={styles.toolSep} />

                  {/* Emoji */}
                  <TouchableOpacity style={styles.toolBtn} onPress={() => { setEmojiTarget('body'); setShowEmoji((v) => !v); }}>
                    <AppIcon name="happy-outline" size={20} color={showEmoji ? COLORS.blue : FG.secondary} fixedColor={showEmoji} />
                  </TouchableOpacity>
                  {/* Image */}
                  <TouchableOpacity style={styles.toolBtn} onPress={pickImage}>
                    <AppIcon name="image-outline" size={20} color={FG.secondary} />
                  </TouchableOpacity>
                  {/* Document */}
                  <TouchableOpacity style={styles.toolBtn} onPress={pickDocument}>
                    <AppIcon name="attach-outline" size={20} color={FG.secondary} />
                  </TouchableOpacity>

                  <View style={styles.toolSep} />

                  {/* Delete */}
                  {editing && (
                    <TouchableOpacity style={styles.toolBtn} onPress={() => confirmDelete(editing)}>
                      <AppIcon name="trash-outline" size={20} color={COLORS.missed} fixedColor />
                    </TouchableOpacity>
                  )}
                </View>
              </>
            ) : (
              /* ── Draw tab — plain View, NOT ScrollView, so PanResponder gets all touches ── */
              <View style={{ flex: 1 }}>
                <DrawCanvas strokes={draftStrokes} onChange={setDraftStrokes} />
              </View>
            )}
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Task-complete confirmation ── */}
      <Modal visible={!!confirmNote} transparent animationType="fade" onRequestClose={handleKeep}>
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmCard, { backgroundColor: FG.glassBg, borderColor: FG.glassBorder }]}>
            <AppBg />
            <LinearGradient colors={GRADIENTS.primary} style={styles.confirmIconWrap}>
              <AppIcon name="checkmark" size={28} color="#fff" fixedColor />
            </LinearGradient>
            <AppText style={[styles.confirmHeading, { color: textColor, fontFamily }]}>Task Complete!</AppText>
            <AppText style={[styles.confirmBody, { color: FG.secondary }]}>
              <AppText style={{ fontWeight: '700', color: textColor }}>"{confirmNote?.title}"</AppText>
              {' '}has been marked as complete.{'\n'}Would you like to delete it?
            </AppText>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={[styles.confirmBtn, styles.confirmBtnKeep, { borderColor: FG.glassBorder }]} onPress={handleKeep} activeOpacity={0.8}>
                <AppText style={[styles.confirmBtnTxt, { color: textColor }]}>Keep</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleDeleteConfirmed} activeOpacity={0.8}>
                <LinearGradient colors={['#e84343', '#c0392b']} style={styles.confirmBtnGrad}>
                  <AppIcon name="trash-outline" size={16} color="#fff" fixedColor />
                  <AppText fixedColor style={[styles.confirmBtnTxt, { color: '#fff' }]}>Delete</AppText>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingTop: 0, paddingBottom: 12, paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  iconBtn:     { padding: 2 },
  title:       { flex: 1, fontSize: 26, fontWeight: '800' },
  addBtnInner: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', ...SHADOW.button },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 14, marginTop: 10, marginBottom: 10,
    borderRadius: RADIUS.full, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  listContent: { paddingHorizontal: 14, paddingBottom: 32 },

  noteCard:      { borderRadius: RADIUS.lg, padding: 16 },
  noteTop:       { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  noteTitle:     { fontSize: 15, fontWeight: '700', flex: 1, marginRight: 10 },
  notePreview:   { fontSize: 13, lineHeight: 20, marginBottom: 6 },
  noteChips:     { flexDirection: 'row', gap: 6, marginBottom: 6 },
  noteChip:      { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.full, borderWidth: 1 },
  noteChipTxt:   { fontSize: 10, fontWeight: '600' },
  noteDate:      { fontSize: 11 },
  checkbox:      { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  checkboxEmpty: { borderWidth: 1.5 },

  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },

  // ── Editor ──────────────────────────────────────────────────────────────────
  editorRoot:    { flex: 1 },
  editorContent: { flex: 1, zIndex: 10 },

  editorHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 0, paddingBottom: 10, borderBottomWidth: 1,
  },
  editorHBtn:   { minWidth: 70 },
  editorHTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  cancelTxt:    { fontSize: 15 },
  saveBtn:      { borderRadius: RADIUS.full, paddingHorizontal: 18, paddingVertical: 8, alignItems: 'center' },
  saveTxt:      { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Write / Draw tabs
  tabRow: {
    flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 16,
  },
  tabBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: COLORS.blue },
  tabBtnTxt:    { fontSize: 13, fontWeight: '600' },

  titleRow: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth, paddingRight: 8,
  },
  titleInput: {
    flex: 1, fontSize: 22, fontWeight: '700',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  emojiToggle:    { padding: 10 },
  emojiToggleTxt: { fontSize: 22 },

  bodyScroll: { flex: 1 },
  bodyInput: {
    minHeight: 180, fontSize: 15, lineHeight: 24,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8,
  },

  // Attachment chips in body
  attachRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  attachChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: RADIUS.lg, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 8,
    maxWidth: 200,
  },
  attachThumb:     { width: 36, height: 36, borderRadius: 6 },
  attachChipName:  { flex: 1, fontSize: 12, fontWeight: '500' },

  emojiPanel: { borderTopWidth: 1, paddingTop: 4 },

  toolbar: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    paddingHorizontal: 8, paddingVertical: 6, borderTopWidth: 1, gap: 2,
  },
  toolBtn:    { padding: 8, borderRadius: 8 },
  toolBtnTxt: { fontSize: 16 },
  toolSep:    { width: 1, height: 24, backgroundColor: 'rgba(90,127,160,0.25)', marginHorizontal: 4 },

  // ── Task-complete confirmation ──────────────────────────────────────────────
  confirmOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28,
  },
  confirmCard: {
    width: '100%', borderRadius: 20, borderWidth: 1,
    alignItems: 'center', padding: 28, gap: 12,
    overflow: 'hidden', ...SHADOW.glow,
  },
  confirmIconWrap: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4, ...SHADOW.button,
  },
  confirmHeading: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  confirmBody:    { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  confirmActions: { flexDirection: 'row', gap: 12, marginTop: 8, width: '100%' },
  confirmBtn:     { flex: 1, borderRadius: RADIUS.full, overflow: 'hidden' },
  confirmBtnKeep: { borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13 },
  confirmBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13 },
  confirmBtnTxt:  { fontSize: 15, fontWeight: '700' },
});
