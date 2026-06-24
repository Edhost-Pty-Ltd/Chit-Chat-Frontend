// ─── Screen: Sign In ─────────────────────────────────────────────────────────
//
// Design:
//   • Full glass-effect screen — no hero gradient bar, no orb bubble
//   • App logo (icon.png) centred at the top, no text taglines
//   • Country-code picker + local number input → 6-digit OTP
//
// Stub behaviour (swap sendOtp / verifyOtp for your real backend):
//   • Any phone number is accepted
//   • Code "123456" always passes
//
import { useState, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW, GRADIENTS } from '../types/theme';
import { RootStackParamList } from '../types';
import { useAuth as useAuthContext } from '../context/AuthContext';
import { useAuth } from '../hooks/useAuth';
import { COUNTRIES, DEFAULT_COUNTRY, Country, formatPhoneNumber } from '../data/countryCodes';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Stub API helpers ─────────────────────────────────────────────────────────
// Removed - now using Firebase Phone Authentication via useAuth hook

// ─── Country Picker Modal ─────────────────────────────────────────────────────

interface CountryPickerProps {
  visible: boolean;
  selected: Country;
  onSelect: (c: Country) => void;
  onClose: () => void;
}

function CountryPicker({ visible, selected, onSelect, onClose }: CountryPickerProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dial.includes(q) ||
        c.code.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={picker.root}>
        {/* Header */}
        <View style={picker.header}>
          <Text style={picker.title}>Select Country</Text>
          <TouchableOpacity onPress={onClose} style={picker.closeBtn}>
            <Ionicons name="close" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={picker.searchWrap}>
          <Ionicons name="search-outline" size={16} color={COLORS.sub} style={picker.searchIcon} />
          <TextInput
            style={picker.searchInput}
            placeholder="Search country or code…"
            placeholderTextColor={COLORS.textFaint}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>

        {/* List */}
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.code}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const isSelected = item.code === selected.code;
            return (
              <TouchableOpacity
                style={[picker.item, isSelected && picker.itemSelected]}
                onPress={() => { onSelect(item); onClose(); setQuery(''); }}
                activeOpacity={0.7}
              >
                <Text style={picker.flag}>{item.flag}</Text>
                <Text style={picker.countryName}>{item.name}</Text>
                <Text style={picker.dialCode}>+{item.dial}</Text>
                {isSelected && (
                  <Ionicons name="checkmark" size={16} color={COLORS.blue} style={picker.check} />
                )}
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={picker.sep} />}
          ListEmptyComponent={
            <Text style={picker.empty}>No countries found.</Text>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Step = 'phone' | 'otp';

export default function SignInScreen() {
  const { signIn: signInToContext } = useAuthContext();
  const { sendOTP, verifyOTP, error: authError } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'SignIn'>>();

  const [step, setStep] = useState<Step>('phone');
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [localNumber, setLocalNumber] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  const otpRefs = useRef<Array<TextInput | null>>([null, null, null, null, null, null]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const rawDigits = localNumber.replace(/\D/g, '');
  const formatted = formatPhoneNumber(rawDigits, country.groups);
  const fullNumber = `+${country.dial}${rawDigits}`;

  // ── Resend countdown ──────────────────────────────────────────────────────

  const startResendTimer = () => {
    setResendTimer(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  // ── Step 1: Send OTP ──────────────────────────────────────────────────────

  const handleSendOtp = async () => {
    const digits = localNumber.replace(/\D/g, '');
    if (digits.length < country.digits) {
      setErrorMsg(`Enter a ${country.digits}-digit number for ${country.name}.`);
      return;
    }
    setErrorMsg('');
    setLoading(true);
    try {
      const success = await sendOTP(fullNumber);
      if (success) {
        setStep('otp');
        startResendTimer();
      } else {
        setErrorMsg(authError || 'Failed to send code. Please try again.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ────────────────────────────────────────────────────

  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length < 6) { setErrorMsg('Enter all 6 digits.'); return; }
    setErrorMsg('');
    setLoading(true);
    try {
      console.log('[SignInScreen] Verifying OTP code...');
      const success = await verifyOTP(code);
      console.log('[SignInScreen] verifyOTP result:', success);
      
      if (success) {
        console.log('[SignInScreen] OTP verified, signing in to context...');
        // Update the context with phone number for session management
        try {
          await signInToContext(fullNumber);
          console.log('[SignInScreen] Sign-in to context successful');
          
          // Don't manually navigate - let AppNavigator handle it automatically
          // when the auth state changes. This prevents navigation errors.
          setLoading(false);
          
          // AppNavigator will automatically show Chats screen when isSignedIn becomes true
        } catch (contextError: any) {
          console.error('[SignInScreen] Error signing in to context:', contextError);
          setErrorMsg(contextError.message || 'Failed to complete sign-in. Please try again.');
          setLoading(false);
        }
      } else {
        console.log('[SignInScreen] OTP verification failed:', authError);
        setErrorMsg(authError || 'Incorrect code. Please try again.');
        setOtp(['', '', '', '', '', '']);
        otpRefs.current[0]?.focus();
        setLoading(false);
      }
    } catch (err: any) {
      console.error('[SignInScreen] Exception during verification:', err);
      setErrorMsg(err.message || 'Verification failed. Please try again.');
      setLoading(false);
    }
  };

  // ── OTP input helpers ─────────────────────────────────────────────────────

  const handleOtpChange = (text: string, index: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
    if (!digit && index > 0 && text === '') otpRefs.current[index - 1]?.focus();
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      const next = [...otp];
      next[index - 1] = '';
      setOtp(next);
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setOtp(['', '', '', '', '', '']);
    setErrorMsg('');
    setLoading(true);
    try {
      const success = await sendOTP(fullNumber);
      if (success) {
        startResendTimer();
      } else {
        setErrorMsg(authError || 'Failed to resend. Please try again.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Fixed default sky-blue background — sign in always uses the brand colours */}
          <LinearGradient colors={GRADIENTS.bg} style={StyleSheet.absoluteFill} />



          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Logo block ── */}
            <View style={styles.logoSection}>
              <Image
                source={require('../../assets/chitchat-logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            {/* ── Sign-in card ── */}
            <View style={styles.card}>

              {step === 'phone' ? (
                <>
                  <Text style={styles.cardTitle}>Sign In</Text>
                  <Text style={styles.cardSub}>
                    Enter your phone number to receive a verification code.
                  </Text>

                  {/* Phone row: [country picker] [local number] */}
                  <View style={styles.phoneRow}>
                    <TouchableOpacity
                      style={styles.dialBtn}
                      onPress={() => setPickerOpen(true)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.dialFlag}>{country.flag}</Text>
                      <Text style={styles.dialCode}>+{country.dial}</Text>
                      <View style={styles.iconTile}>
                        <Ionicons name="chevron-down" size={13} color={COLORS.blue} />
                      </View>
                    </TouchableOpacity>

                    <View style={[styles.inputWrap, styles.inputFlex]}>
                      <TextInput
                        style={styles.input}
                        placeholder={Array(country.digits + 1).join('0').replace(/(\d{3})(\d{3})(\d+)/, '$1 $2 $3')}
                        placeholderTextColor={COLORS.textFaint}
                        keyboardType="phone-pad"
                        autoComplete="tel"
                        textContentType="telephoneNumber"
                        value={formatted}
                        onChangeText={(t) => {
                          // Strip non-digits, limit to country digit count
                          const digits = t.replace(/\D/g, '').slice(0, country.digits);
                          setLocalNumber(digits);
                          setErrorMsg('');
                        }}
                        returnKeyType="done"
                        onSubmitEditing={handleSendOtp}
                      />
                    </View>
                  </View>

                  {rawDigits.length > 0 && (
                    <Text style={styles.previewText}>Will send to: {fullNumber}</Text>
                  )}

                  {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

                  <TouchableOpacity
                    onPress={handleSendOtp}
                    activeOpacity={0.85}
                    disabled={loading}
                  >
                    <LinearGradient colors={GRADIENTS.primary} style={styles.primaryBtn}>
                      {loading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.primaryBtnText}>Send Code</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.backRow}
                    onPress={() => {
                      setStep('phone');
                      setErrorMsg('');
                      setOtp(['', '', '', '', '', '']);
                    }}
                  >
                    <Ionicons name="chevron-back" size={18} color={COLORS.blue} />
                    <Text style={styles.backText}>Change number</Text>
                  </TouchableOpacity>

                  <Text style={styles.cardTitle}>Verify Code</Text>
                  <Text style={styles.cardSub}>
                    We sent a 6-digit code to{'\n'}
                    <Text style={styles.phoneHighlight}>{fullNumber}</Text>
                  </Text>

                  <View style={styles.otpRow}>
                    {otp.map((digit, i) => (
                      <TextInput
                        key={i}
                        ref={(el) => { otpRefs.current[i] = el; }}
                        style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                        value={digit}
                        onChangeText={(t) => handleOtpChange(t, i)}
                        onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, i)}
                        keyboardType="number-pad"
                        maxLength={1}
                        textAlign="center"
                        selectTextOnFocus
                      />
                    ))}
                  </View>

                  {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

                  <TouchableOpacity
                    onPress={handleVerifyOtp}
                    activeOpacity={0.85}
                    disabled={loading}
                  >
                    <LinearGradient colors={GRADIENTS.primary} style={styles.primaryBtn}>
                      {loading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.primaryBtnText}>Verify</Text>}
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
                    <Text style={styles.hintText}>
                      Enter the 6-digit code sent to your phone
                    </Text>
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

          {/* ── Create account link — mobile only, below the card ── */}
          {step === 'phone' && Platform.OS !== 'web' && (
            <View style={styles.createAccountRow}>
              <Text style={styles.createAccountText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('CreateAccount')} activeOpacity={0.8}>
                <Text style={styles.createAccountLink}>Create one</Text>
              </TouchableOpacity>
            </View>
          )}

        <CountryPicker
          visible={pickerOpen}
          selected={country}
          onSelect={setCountry}
          onClose={() => setPickerOpen(false)}
        />
      </SafeAreaView>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 48,
  },

  // ── Logo ──────────────────────────────────────────────────────────────────
  logoSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoImage: {
    width: 200,
    height: 200,
    borderRadius: 40,
    // Clip the dark JPEG corners
    overflow: 'hidden',
  },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: 'rgba(180,225,245,0.22)',
    borderRadius: RADIUS.xl,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    ...SHADOW.card,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  cardSub: {
    fontSize: 13,
    color: COLORS.sub,
    marginBottom: 20,
    lineHeight: 19,
  },

  // ── Phone input row ───────────────────────────────────────────────────────
  phoneRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },

  dialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 13,
    backgroundColor: 'rgba(30,156,240,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(30,156,240,0.18)',
    borderRadius: RADIUS.md,
  },
  dialFlag: { fontSize: 20 },
  dialCode: { fontSize: 14, fontWeight: '600', color: COLORS.text },

  inputWrap: {
    backgroundColor: 'rgba(30,156,240,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(30,156,240,0.18)',
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inputFlex: { flex: 1 },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 13,
    fontSize: 15,
    color: COLORS.text,
  },

  previewText: {
    fontSize: 11,
    color: COLORS.sub,
    marginBottom: 8,
    fontStyle: 'italic',
  },

  error: {
    fontSize: 13,
    color: COLORS.missed,
    marginBottom: 10,
    marginTop: 2,
  },

  primaryBtn: {
    borderRadius: RADIUS.md,
    paddingVertical: 15,
    alignItems: 'center',
    ...SHADOW.button,
    marginTop: 4,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // ── OTP step ──────────────────────────────────────────────────────────────
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  backText: { fontSize: 13, color: COLORS.blue, fontWeight: '600', marginLeft: 2 },

  phoneHighlight: { fontWeight: '700', color: COLORS.text },

  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
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
    borderWidth: 1,
    borderColor: 'rgba(30,156,240,0.18)',
  },
  otpBoxFilled: {
    borderColor: COLORS.blue,
    backgroundColor: 'rgba(30,156,240,0.12)',
    shadowColor: COLORS.blue,
    shadowOpacity: 0.30,
  },

  resendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  resendLabel: { fontSize: 13, color: COLORS.sub },
  resendLink: { fontSize: 13, color: COLORS.blue, fontWeight: '700' },
  resendLinkDisabled: { color: COLORS.textFaint },

  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    padding: 10,
    backgroundColor: 'rgba(30,156,240,0.06)',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(30,156,240,0.15)',
  },
  hintText: { fontSize: 12, color: COLORS.sub },
  hintCode: { fontWeight: '700', color: COLORS.blue },

  createAccountRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  createAccountText: { fontSize: 14, color: COLORS.sub },
  createAccountLink: { fontSize: 14, color: COLORS.blue, fontWeight: '700' },

  iconTile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30,156,240,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.50)',
    borderTopColor: 'rgba(255,255,255,0.75)',
    shadowColor: '#1E9CF0',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
});

// ─── Picker Styles ────────────────────────────────────────────────────────────

const picker = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg2 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: COLORS.text },
  closeBtn: { padding: 4 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    marginBottom: 6,
    backgroundColor: 'rgba(30,156,240,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(30,156,240,0.18)',
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: COLORS.text },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
    gap: 12,
  },
  itemSelected: { backgroundColor: 'rgba(30,156,240,0.08)' },

  flag: { fontSize: 24, width: 32, textAlign: 'center' },
  countryName: { flex: 1, fontSize: 15, color: COLORS.text },
  dialCode: { fontSize: 14, fontWeight: '600', color: COLORS.sub },
  check: { marginLeft: 4 },

  sep: { height: 1, backgroundColor: COLORS.border, marginLeft: 64 },
  empty: { textAlign: 'center', color: COLORS.sub, marginTop: 40, fontSize: 14 },
});
