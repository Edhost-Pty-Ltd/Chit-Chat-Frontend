// ─── Screen: Create Account ──────────────────────────────────────────────────
// Mobile only. Collects name, phone + optional photo → OTP → biometric check.
// If no photo is chosen, the first letter of their first name is used as avatar.
import React, { useState, useRef, useMemo } from 'react';
import {
  View, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image, Alert, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
// expo-local-authentication requires a native build — lazy load so Expo Go doesn't crash
let LocalAuthentication: any = null;
try { LocalAuthentication = require('expo-local-authentication'); } catch { /* Expo Go */ }
import { useAuth } from '../context/AuthContext';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';
import { RootStackParamList } from '../types';
import { COUNTRIES, DEFAULT_COUNTRY, Country, formatPhoneNumber } from '../data/countryCodes';
import { Text } from 'react-native';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'CreateAccount'>;
type Step = 'details' | 'otp' | 'biometric';

// ─── Stub OTP helpers ─────────────────────────────────────────────────────────
async function sendOtp(_phone: string): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, 800));
}
async function verifyOtp(_phone: string, code: string): Promise<boolean> {
  await new Promise<void>((r) => setTimeout(r, 600));
  return code === '123456';
}

// ─── Biometric helper ─────────────────────────────────────────────────────────
async function runBiometric(): Promise<{ success: boolean; message: string }> {
  try {
    if (!LocalAuthentication) return { success: true, message: 'not_available' }; // skip in Expo Go
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return { success: true, message: 'no_hardware' }; // skip gracefully

    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) return { success: true, message: 'not_enrolled' }; // skip gracefully

    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const isFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const promptMsg = isFace ? 'Confirm with Face ID' : 'Confirm with fingerprint';

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: promptMsg,
      fallbackLabel: 'Use PIN',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return { success: result.success, message: result.success ? 'ok' : 'failed' };
  } catch {
    return { success: true, message: 'error_skip' }; // don't block on unexpected errors
  }
}

// ─── Country Picker ───────────────────────────────────────────────────────────
function CountryPicker({ visible, selected, onSelect, onClose }: {
  visible: boolean; selected: Country;
  onSelect: (c: Country) => void; onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={picker.root}>
        <View style={picker.header}>
          <Text style={picker.title}>Select Country</Text>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={COLORS.text} /></TouchableOpacity>
        </View>
        <View style={picker.searchWrap}>
          <Ionicons name="search-outline" size={16} color={COLORS.sub} style={{ marginRight: 6 }} />
          <TextInput style={picker.searchInput} placeholder="Search…" placeholderTextColor={COLORS.textFaint}
            value={query} onChangeText={setQuery} autoCorrect={false} autoCapitalize="none" clearButtonMode="while-editing" />
        </View>
        <FlatList
          data={filtered} keyExtractor={i => i.code} keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const sel = item.code === selected.code;
            return (
              <TouchableOpacity style={[picker.item, sel && picker.itemSelected]}
                onPress={() => { onSelect(item); onClose(); setQuery(''); }} activeOpacity={0.7}>
                <Text style={picker.flag}>{item.flag}</Text>
                <Text style={picker.countryName}>{item.name}</Text>
                <Text style={picker.dialCode}>+{item.dial}</Text>
                {sel && <Ionicons name="checkmark" size={16} color={COLORS.blue} />}
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={picker.sep} />}
          ListEmptyComponent={<Text style={picker.empty}>No countries found.</Text>}
        />
      </SafeAreaView>
    </Modal>
  );
}

export default function CreateAccountScreen() {
  const navigation = useNavigation<NavProp>();
  const { signIn, setDisplayName, setAvatarUri } = useAuth();

  const [step,        setStep]        = useState<Step>('details');
  const [name,        setName]        = useState('');
  const [country,     setCountry]     = useState<Country>(DEFAULT_COUNTRY);
  const [localNumber, setLocalNumber] = useState('');
  const [avatarUri,   setLocalAvatar] = useState<string | null>(null);
  const [pickerOpen,  setPickerOpen]  = useState(false);
  const [otp,         setOtp]         = useState(['', '', '', '', '', '']);
  const [loading,     setLoading]     = useState(false);
  const [errorMsg,    setErrorMsg]    = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  const otpRefs  = useRef<Array<TextInput | null>>([null, null, null, null, null, null]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const rawDigits  = localNumber.replace(/\D/g, '');
  const formatted  = formatPhoneNumber(rawDigits, country.groups);
  const fullNumber = `+${country.dial}${rawDigits}`;

  // ── Photo pick ────────────────────────────────────────────────────────────
  const pickPhoto = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to set a profile picture.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true, aspect: [1, 1], quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) setLocalAvatar(result.assets[0].uri);
  };

  // ── Resend countdown ──────────────────────────────────────────────────────
  const startResendTimer = () => {
    setResendTimer(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendTimer(t => { if (t <= 1) { clearInterval(timerRef.current!); return 0; } return t - 1; });
    }, 1000);
  };

  // ── Step 1: Send OTP ──────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!name.trim()) { setErrorMsg('Please enter your name.'); return; }
    if (rawDigits.length < country.digits) {
      setErrorMsg(`Enter a ${country.digits}-digit number for ${country.name}.`); return;
    }
    setErrorMsg(''); setLoading(true);
    try {
      await sendOtp(fullNumber);
      setStep('otp'); startResendTimer();
    } catch { setErrorMsg('Failed to send code. Please try again.'); }
    finally { setLoading(false); }
  };

  // ── Step 2: Verify OTP → biometric ──────────────────────────────────────
  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) { setErrorMsg('Enter all 6 digits.'); return; }
    setErrorMsg(''); setLoading(true);
    try {
      const ok = await verifyOtp(fullNumber, code);
      if (ok) {
        setStep('biometric');
      } else {
        setErrorMsg('Incorrect code. Please try again.');
        setOtp(['', '', '', '', '', '']);
        otpRefs.current[0]?.focus();
      }
    } catch { setErrorMsg('Verification failed. Please try again.'); }
    finally { setLoading(false); }
  };

  // ── Step 3: Biometric → create account ───────────────────────────────────
  const handleBiometric = async () => {
    setLoading(true);
    try {
      const { success, message } = await runBiometric();
      if (success) {
        await signIn(fullNumber);
        await setDisplayName(name.trim());
        if (avatarUri) await setAvatarUri(avatarUri);
        // AppNavigator will react to isSignedIn and navigate to Chats
      } else {
        Alert.alert(
          'Authentication failed',
          'Biometric check did not pass. Please try again.',
          [{ text: 'Try Again', onPress: handleBiometric }, { text: 'Cancel', style: 'cancel' }],
        );
      }
    } finally { setLoading(false); }
  };

  // ── OTP helpers ───────────────────────────────────────────────────────────
  const handleOtpChange = (text: string, i: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const next = [...otp]; next[i] = digit; setOtp(next);
    if (digit && i < 5) otpRefs.current[i + 1]?.focus();
    if (!digit && i > 0 && text === '') otpRefs.current[i - 1]?.focus();
  };
  const handleOtpKey = (key: string, i: number) => {
    if (key === 'Backspace' && !otp[i] && i > 0) {
      const next = [...otp]; next[i - 1] = ''; setOtp(next); otpRefs.current[i - 1]?.focus();
    }
  };
  const handleResend = async () => {
    if (resendTimer > 0) return;
    setOtp(['', '', '', '', '', '']); setErrorMsg(''); setLoading(true);
    try { await sendOtp(fullNumber); startResendTimer(); }
    catch { setErrorMsg('Failed to resend.'); }
    finally { setLoading(false); }
  };

  // First letter of first name as avatar initial
  const firstInitial = name.trim().charAt(0).toUpperCase() || '?';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <LinearGradient colors={GRADIENTS.bg} style={StyleSheet.absoluteFill} />

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Back link */}
          <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={COLORS.blue} />
            <Text style={styles.backText}>Sign In</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            {step === 'details' ? (
              <>
                <Text style={styles.cardTitle}>Create Account</Text>
                <Text style={styles.cardSub}>Fill in your details to get started.</Text>

                {/* Avatar picker */}
                <TouchableOpacity style={styles.avatarWrap} onPress={pickPhoto} activeOpacity={0.8}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                  ) : (
                    <LinearGradient colors={[COLORS.blue, COLORS.blueDark]} style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarInitials}>{firstInitial}</Text>
                    </LinearGradient>
                  )}
                  <View style={styles.cameraBadge}>
                    <Ionicons name="camera" size={14} color={COLORS.blue} />
                  </View>
                  <Text style={styles.avatarHint}>Add photo</Text>
                </TouchableOpacity>

                {/* Name */}
                <View style={styles.inputWrap}>
                  <View style={[styles.iconTile, { marginLeft: 8 }]}>
                    <Ionicons name="person-outline" size={18} color={COLORS.blue} />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Full name"
                    placeholderTextColor={COLORS.textFaint}
                    value={name}
                    onChangeText={t => { setName(t); setErrorMsg(''); }}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>

                {/* Phone */}
                <View style={styles.phoneRow}>
                  <TouchableOpacity style={styles.dialBtn} onPress={() => setPickerOpen(true)} activeOpacity={0.75}>
                    <Text style={styles.dialFlag}>{country.flag}</Text>
                    <Text style={styles.dialCode}>+{country.dial}</Text>
                    <View style={styles.iconTile}>
                      <Ionicons name="chevron-down" size={13} color={COLORS.blue} />
                    </View>
                  </TouchableOpacity>
                  <View style={[styles.inputWrap, styles.inputFlex]}>
                    <TextInput
                      style={styles.input}
                      placeholder="Phone number"
                      placeholderTextColor={COLORS.textFaint}
                      keyboardType="phone-pad"
                      value={formatted}
                      onChangeText={t => {
                        const d = t.replace(/\D/g, '').slice(0, country.digits);
                        setLocalNumber(d); setErrorMsg('');
                      }}
                      returnKeyType="done"
                      onSubmitEditing={handleSend}
                    />
                  </View>
                </View>

                {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

                <TouchableOpacity onPress={handleSend} activeOpacity={0.85} disabled={loading}>
                  <LinearGradient colors={GRADIENTS.primary} style={styles.primaryBtn}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Send Verification Code</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : step === 'otp' ? (
              <>
                <TouchableOpacity style={styles.backRow} onPress={() => { setStep('details'); setErrorMsg(''); setOtp(['','','','','','']); }}>
                  <Ionicons name="chevron-back" size={18} color={COLORS.blue} />
                  <Text style={styles.backText}>Change details</Text>
                </TouchableOpacity>

                <Text style={styles.cardTitle}>Verify Code</Text>
                <Text style={styles.cardSub}>We sent a 6-digit code to{'\n'}<Text style={styles.phoneHighlight}>{fullNumber}</Text></Text>

                <View style={styles.otpRow}>
                  {otp.map((digit, i) => (
                    <TextInput
                      key={i}
                      ref={el => { otpRefs.current[i] = el; }}
                      style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                      value={digit}
                      onChangeText={t => handleOtpChange(t, i)}
                      onKeyPress={({ nativeEvent }) => handleOtpKey(nativeEvent.key, i)}
                      keyboardType="number-pad"
                      maxLength={1}
                      textAlign="center"
                      selectTextOnFocus
                    />
                  ))}
                </View>

                {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

                <TouchableOpacity onPress={handleVerify} activeOpacity={0.85} disabled={loading}>
                  <LinearGradient colors={GRADIENTS.primary} style={styles.primaryBtn}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Verify Code</Text>}
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.resendRow}>
                  <Text style={styles.resendLabel}>Didn't receive a code? </Text>
                  <TouchableOpacity onPress={handleResend} disabled={resendTimer > 0}>
                    <Text style={[styles.resendLink, resendTimer > 0 && styles.resendLinkDisabled]}>
                      {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.hintBox}>
                  <Ionicons name="information-circle-outline" size={15} color={COLORS.sub} />
                  <Text style={styles.hintText}>Demo: use code <Text style={styles.hintCode}>123456</Text></Text>
                </View>
              </>
            ) : (
              /* Biometric step */
              <View style={styles.biometricWrap}>
                <View style={styles.biometricIcon}>
                  <Ionicons name="finger-print" size={70} color={COLORS.blue} />
                </View>
                <Text style={styles.cardTitle}>Two-Factor Verification</Text>
                <Text style={styles.cardSub}>
                  For your security, please verify your identity using{'\n'}
                  your device's biometrics.
                </Text>

                {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

                <TouchableOpacity onPress={handleBiometric} activeOpacity={0.85} disabled={loading}>
                  <LinearGradient colors={GRADIENTS.primary} style={styles.primaryBtn}>
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.primaryBtnText}>Verify with Biometrics</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </View>            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <CountryPicker visible={pickerOpen} selected={country} onSelect={setCountry} onClose={() => setPickerOpen(false)} />
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 24 : 56, paddingBottom: 48 },

  backRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backText: { fontSize: 13, color: COLORS.blue, fontWeight: '600', marginLeft: 2 },

  card: { backgroundColor: 'transparent', borderRadius: RADIUS.xl, padding: 22, borderWidth: 1, borderColor: 'rgba(30,156,240,0.18)', shadowColor: '#0e6ea8', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.20, shadowRadius: 20, elevation: 8 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  cardSub:   { fontSize: 13, color: COLORS.sub, marginBottom: 20, lineHeight: 19 },

  // Avatar
  avatarWrap: { alignItems: 'center', marginBottom: 20, gap: 6 },
  avatarImg: { width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: 'rgba(30,156,240,0.30)' },
  avatarPlaceholder: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(30,156,240,0.25)' },
  avatarInitials: { fontSize: 30, fontWeight: '800', color: '#fff' },
  cameraBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.blue,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center', justifyContent: 'center',
    marginTop: -14,
  },
  avatarHint: { fontSize: 11, color: COLORS.sub, marginTop: 2 },

  inputWrap: { backgroundColor: 'rgba(30,156,240,0.06)', borderRadius: RADIUS.md, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(30,156,240,0.18)', shadowColor: '#0e6ea8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.10, shadowRadius: 6, elevation: 2 },
  inputIcon: { paddingLeft: 14 },
  inputFlex: { flex: 1, marginBottom: 0 },
  input:     { flex: 1, paddingHorizontal: 12, paddingVertical: 13, fontSize: 15, color: COLORS.text },

  phoneRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  dialBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 13, backgroundColor: 'rgba(30,156,240,0.06)', borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(30,156,240,0.18)', shadowColor: '#0e6ea8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.10, shadowRadius: 6, elevation: 2 },
  dialFlag: { fontSize: 20 },
  dialCode: { fontSize: 14, fontWeight: '600', color: COLORS.text },

  error: { fontSize: 13, color: COLORS.missed, marginBottom: 10, marginTop: -4 },

  primaryBtn:     { borderRadius: RADIUS.md, paddingVertical: 15, alignItems: 'center', ...SHADOW.button, marginTop: 4 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  phoneHighlight: { fontWeight: '700', color: COLORS.text },

  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  otpBox: {
    width: 48,
    height: 58,
    borderRadius: RADIUS.md,
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 58,
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: 'rgba(30,156,240,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(30,156,240,0.22)',
    shadowColor: '#0e6ea8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  otpBoxFilled: {
    borderColor: COLORS.blue,
    backgroundColor: 'rgba(30,156,240,0.12)',
    shadowColor: COLORS.blue,
    shadowOpacity: 0.30,
  },

  resendRow:          { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  resendLabel:        { fontSize: 13, color: COLORS.sub },
  resendLink:         { fontSize: 13, color: COLORS.blue, fontWeight: '700' },
  resendLinkDisabled: { color: COLORS.textFaint },

  hintBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, padding: 10, backgroundColor: 'rgba(30,156,240,0.06)', borderRadius: RADIUS.sm, borderWidth: 1, borderColor: 'rgba(30,156,240,0.15)' },
  hintText: { fontSize: 12, color: COLORS.sub },
  hintCode: { fontWeight: '700', color: COLORS.blue },

  // Biometric step
  biometricWrap: { alignItems: 'center', paddingVertical: 10 },
  biometricIcon: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(30,156,240,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(30,156,240,0.22)',
    borderTopColor: 'rgba(30,156,240,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#1E9CF0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.50,
    shadowRadius: 24,
    elevation: 16,
  },

  iconTile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30,156,240,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(30,156,240,0.18)',
    shadowColor: '#1E9CF0',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
});

const picker = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg2 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title:    { flex: 1, fontSize: 17, fontWeight: '700', color: COLORS.text },
  searchWrap: { flexDirection: 'row', alignItems: 'center', margin: 12, marginBottom: 6, ...GLASS.input, borderRadius: RADIUS.md, paddingHorizontal: 10 },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: COLORS.text },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 13, gap: 12 },
  itemSelected: { backgroundColor: 'rgba(30,156,240,0.08)' },
  flag:        { fontSize: 24, width: 32, textAlign: 'center' },
  countryName: { flex: 1, fontSize: 15, color: COLORS.text },
  dialCode:    { fontSize: 14, fontWeight: '600', color: COLORS.sub },
  sep:   { height: 1, backgroundColor: COLORS.border, marginLeft: 64 },
  empty: { textAlign: 'center', color: COLORS.sub, marginTop: 40, fontSize: 14 },
});
