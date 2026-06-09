// ─── Screen: Sign In — Phone OTP Two-Step Flow ──────────────────────────────
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';
import { useAuth } from '../hooks/useAuth';

export default function SignInScreen() {
  const { step, error, sendOTP, verifyOTP } = useAuth();

  const [phone, setPhone] = useState('');
  const [otp, setOtp]     = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Determine which step of the flow we're in
  const isOtpStep = step === 'verifying' || (step === 'error' && otp.length > 0);
  const isBusy    = step === 'sending' || step === 'verifying';

  // ── Validate phone: must be 10+ digits after stripping non-digits ───
  function validatePhone(raw: string): boolean {
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 10) {
      setValidationError('Phone number must be at least 10 digits');
      return false;
    }
    setValidationError(null);
    return true;
  }

  // ── Handle Send OTP ─────────────────────────────────────────────────
  async function handleSendOTP() {
    if (isBusy) return;
    if (!validatePhone(phone)) return;

    const digits = phone.replace(/\D/g, '');
    await sendOTP(`+27${digits}`);
  }

  // ── Handle Verify OTP ───────────────────────────────────────────────
  async function handleVerify() {
    if (isBusy) return;
    if (otp.length !== 6) {
      setValidationError('Please enter the 6-digit code');
      return;
    }
    setValidationError(null);
    await verifyOTP(otp);
  }

  // ── Handle Resend ───────────────────────────────────────────────────
  async function handleResend() {
    if (isBusy) return;
    setOtp('');
    setValidationError(null);
    const digits = phone.replace(/\D/g, '');
    await sendOTP(`+27${digits}`);
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <LinearGradient colors={GRADIENTS.bg} style={StyleSheet.absoluteFill} />

      {/* Hero */}
      <LinearGradient colors={GRADIENTS.sky} style={styles.hero}>
        <View style={styles.heroOrb} />
        <View style={styles.logoBox}>
          <Ionicons name="chatbubbles" size={30} color="#fff" />
        </View>
        <Text style={styles.appName}>ChitChat</Text>
        <Text style={styles.tagline}>Connect. Share. Anywhere.</Text>
        <Text style={styles.subTagline}>Messages, calls and more.{'\n'}Simple. Secure. Powerful.</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Sign In card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {isOtpStep ? 'Verify OTP' : 'Sign In'}
          </Text>
          <Text style={styles.cardSubtitle}>
            {isOtpStep
              ? 'Enter the 6-digit code sent to your phone'
              : 'Enter your phone number to get started'}
          </Text>

          {/* ─── Step 1: Phone Input ──────────────────────────────── */}
          {!isOtpStep && (
            <>
              <View style={styles.inputWrap}>
                <View style={styles.prefixBox}>
                  <Text style={styles.prefixText}>+27</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="658 500 320"
                  placeholderTextColor={COLORS.textFaint}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={(text) => {
                    setPhone(text);
                    setValidationError(null);
                  }}
                  editable={!isBusy}
                />
              </View>

              {/* Validation or hook error */}
              {(validationError || error) && (
                <Text style={styles.errorText}>{validationError || error}</Text>
              )}

              {/* Send OTP button */}
              <TouchableOpacity onPress={handleSendOTP} activeOpacity={0.85} disabled={isBusy}>
                <LinearGradient colors={GRADIENTS.primary} style={styles.primaryBtn}>
                  {step === 'sending' ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Send OTP</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {/* ─── Step 2: OTP Input ───────────────────────────────── */}
          {isOtpStep && (
            <>
              <View style={styles.inputWrap}>
                <Ionicons name="keypad-outline" size={18} color={COLORS.sub} style={styles.inputIcon} />
                <TextInput
                  style={styles.otpInput}
                  placeholder="000000"
                  placeholderTextColor={COLORS.textFaint}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={(text) => {
                    setOtp(text);
                    setValidationError(null);
                  }}
                  editable={!isBusy}
                />
              </View>

              {/* Validation or hook error */}
              {(validationError || error) && (
                <Text style={styles.errorText}>{validationError || error}</Text>
              )}

              {/* Verify button */}
              <TouchableOpacity onPress={handleVerify} activeOpacity={0.85} disabled={isBusy}>
                <LinearGradient colors={GRADIENTS.primary} style={styles.primaryBtn}>
                  {step === 'verifying' ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Verify</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Resend link */}
              <TouchableOpacity onPress={handleResend} style={styles.resendRow} disabled={isBusy}>
                <Text style={styles.resendText}>
                  Didn't receive the code?{' '}
                  <Text style={styles.resendLink}>Resend OTP</Text>
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sky1 },

  // ── Hero ─────────────────────────────────────────────────────────────
  hero: {
    paddingTop: 60, paddingBottom: 36, paddingHorizontal: 28,
    overflow: 'hidden',
  },
  heroOrb: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.10)', top: -60, right: -60,
  },
  logoBox: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.40)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, ...SHADOW.glow,
  },
  appName:    { fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  tagline:    { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  subTagline: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 8, lineHeight: 20 },

  // ── Card ─────────────────────────────────────────────────────────────
  scroll: { padding: 20, paddingBottom: 48 },
  card: { ...GLASS.elevated, borderRadius: RADIUS.xl, padding: 22, ...SHADOW.card },
  cardTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  cardSubtitle: { fontSize: 13, color: COLORS.sub, marginBottom: 20 },

  // ── Inputs ───────────────────────────────────────────────────────────
  inputWrap: {
    ...GLASS.input, borderRadius: RADIUS.md, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center',
  },
  prefixBox: {
    paddingLeft: 14, paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.35)',
  },
  prefixText: {
    fontSize: 14, fontWeight: '600', color: COLORS.text,
  },
  phoneInput: {
    flex: 1, paddingHorizontal: 10, paddingVertical: 13,
    fontSize: 14, color: COLORS.text,
  },
  inputIcon: { paddingLeft: 14 },
  otpInput: {
    flex: 1, paddingHorizontal: 10, paddingVertical: 13,
    fontSize: 20, color: COLORS.text, letterSpacing: 8, fontWeight: '600',
  },

  // ── Error ────────────────────────────────────────────────────────────
  errorText: {
    fontSize: 12, color: COLORS.missed, marginBottom: 12, marginTop: -4, paddingHorizontal: 4,
  },

  // ── Button ───────────────────────────────────────────────────────────
  primaryBtn: {
    borderRadius: RADIUS.md, paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.button,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // ── Resend ───────────────────────────────────────────────────────────
  resendRow: { marginTop: 18, alignItems: 'center' },
  resendText: { fontSize: 13, color: COLORS.sub },
  resendLink: { color: COLORS.blue, fontWeight: '700' },
});
