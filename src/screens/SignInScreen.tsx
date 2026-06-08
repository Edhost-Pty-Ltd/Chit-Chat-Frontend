// ─── Screen 1: Sign In — Glassmorphism ───────────────────────────────────────
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, GRADIENTS, RADIUS, SHADOW, GLASS } from '../types/theme';
import { RootStackParamList } from '../types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'SignIn'>;

// Glass card — BlurView on native, styled View on web
function GlassCard({ children, style }: { children: React.ReactNode; style?: any }) {
  if (Platform.OS === 'web') {
    return <View style={[styles.glassWeb, style]}>{children}</View>;
  }
  return (
    <BlurView intensity={55} tint="light" style={[styles.glassNative, style]}>
      {children}
    </BlurView>
  );
}

export default function SignInScreen() {
  const navigation = useNavigation<NavProp>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);

  return (
    <LinearGradient colors={GRADIENTS.bg} style={styles.root}>

      {/* Decorative blobs */}
      <View style={[styles.blob, { width: 280, height: 280, top: -80, left: -60, opacity: 0.18 }]} />
      <View style={[styles.blob, { width: 200, height: 200, top: 180, right: -80, opacity: 0.12 }]} />
      <View style={[styles.blob, { width: 160, height: 160, bottom: 120, left: -40, opacity: 0.10 }]} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero ─────────────────────────────────────────────── */}
          <View style={styles.hero}>
            <GlassCard style={styles.logoBox}>
              <Text style={styles.logoIcon}>💬</Text>
            </GlassCard>
            <Text style={styles.appName}>SkyConnect</Text>
            <Text style={styles.tagline}>Connect. Share. Anywhere.</Text>
            <Text style={styles.subTagline}>
              Messages, calls and more.{'\n'}Simple. Secure. Powerful.
            </Text>
          </View>

          {/* ── Sign In card ──────────────────────────────────────── */}
          <GlassCard style={styles.card}>
            <Text style={styles.cardTitle}>Sign In</Text>

            <View style={styles.inputWrap}>
              <Text style={styles.inputIcon}>✉️</Text>
              <TextInput
                style={styles.input}
                placeholder="Email or Phone"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.inputWrap}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <View style={styles.row}>
              <TouchableOpacity
                style={styles.checkRow}
                onPress={() => setRemember(!remember)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, remember && styles.checkboxActive]}>
                  {remember && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.rememberText}>Remember me</Text>
              </TouchableOpacity>
              <TouchableOpacity>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate('Chats')}
              activeOpacity={0.85}
            >
              <LinearGradient colors={GRADIENTS.primary} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Sign In</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialRow}>
              {[
                { label: 'G', color: '#ea4335' },
                { label: '🍎', color: '#fff' },
                { label: '⊞', color: '#00a4ef' },
              ].map((p, i) => (
                <TouchableOpacity key={i} style={styles.socialBtn}>
                  <Text style={[styles.socialIcon, { color: p.color }]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.signUpRow}>
              <Text style={styles.signUpText}>Don't have an account? </Text>
              <TouchableOpacity>
                <Text style={styles.signUpLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>

          {/* ── Sign Out card ─────────────────────────────────────── */}
          <GlassCard style={styles.card}>
            <Text style={styles.cardTitle}>Sign Out</Text>
            <Text style={styles.signOutSub}>Are you sure you want to sign out?</Text>
            <View style={styles.row}>
              <TouchableOpacity style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.signOutBtn}>
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>

        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Blobs
  blob: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#fff',
    zIndex: 0,
  },

  scroll: { padding: 24, paddingTop: 60, gap: 16, paddingBottom: 50, zIndex: 1 },

  // Hero
  hero: { alignItems: 'flex-start', marginBottom: 8 },
  logoBox: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, overflow: 'hidden',
  },
  logoIcon: { fontSize: 30 },
  appName: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  subTagline: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 8, lineHeight: 20 },

  // Glass card
  glassWeb: {
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: RADIUS.xl,
    padding: 22,
    ...SHADOW.card,
  },
  glassNative: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    padding: 22,
    ...SHADOW.card,
  },
  card: { marginBottom: 0 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 18 },

  // Inputs
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
    paddingHorizontal: 12, paddingVertical: 11,
    marginBottom: 12, gap: 10,
  },
  inputIcon: { fontSize: 16 },
  input: { flex: 1, fontSize: 14, color: '#fff' },

  // Helpers
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: COLORS.blue, borderColor: COLORS.blue },
  checkmark: { color: '#fff', fontSize: 11, fontWeight: '700' },
  rememberText: { fontSize: 13, color: COLORS.textSub },
  forgotText: { fontSize: 13, color: '#7dd3fc', fontWeight: '600' },

  // Primary button
  primaryBtn: {
    borderRadius: RADIUS.md, paddingVertical: 15,
    alignItems: 'center',
    ...SHADOW.button,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },

  // Divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.18)' },
  dividerText: { fontSize: 12, color: COLORS.textSub },

  // Social
  socialRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  socialBtn: {
    flex: 1, paddingVertical: 11,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
  },
  socialIcon: { fontSize: 16, fontWeight: '700' },

  // Sign up
  signUpRow: { flexDirection: 'row', justifyContent: 'center' },
  signUpText: { fontSize: 13, color: COLORS.textSub },
  signUpLink: { fontSize: 13, color: '#7dd3fc', fontWeight: '700' },

  // Sign out card
  signOutSub: { fontSize: 13, color: COLORS.textSub, marginBottom: 16 },
  cancelBtn: {
    flex: 1, paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center', marginRight: 10,
  },
  cancelText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  signOutBtn: { flex: 1, paddingVertical: 12, backgroundColor: COLORS.missed, borderRadius: RADIUS.sm, alignItems: 'center' },
  signOutText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
