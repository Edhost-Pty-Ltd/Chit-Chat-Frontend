// ─── Screen 1: Sign In ───────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { COLORS, RADIUS, SHADOW, GRADIENTS } from '../types/theme';
import { RootStackParamList } from '../types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'SignIn'>;

export default function SignInScreen() {
  const navigation = useNavigation<NavProp>();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);

  const handleSignIn = () => navigation.replace('Chats');

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ── Sky hero ─────────────────────────────────────────────── */}
      <LinearGradient colors={GRADIENTS.sky} style={styles.hero}>
        {/* Decorative cloud blobs */}
        <View style={[styles.cloud, { width: 120, height: 38, top: 28, left: '50%' }]} />
        <View style={[styles.cloud, { width: 80,  height: 26, top: 56, left: '15%' }]} />
        <View style={[styles.cloud, { width: 60,  height: 22, top: 40, right: 20   }]} />

        {/* Logo */}
        <View style={styles.logoBox}>
          <Text style={styles.logoIcon}>💬</Text>
        </View>
        <Text style={styles.appName}>SkyConnect</Text>
        <Text style={styles.tagline}>Connect. Share. Anywhere.</Text>
        <Text style={styles.subTagline}>
          Messages, calls and more.{'\n'}Simple. Secure. Powerful.
        </Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Sign In card ─────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>

          <TextInput
            style={styles.input}
            placeholder="Email or Phone"
            placeholderTextColor={COLORS.sub}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={COLORS.sub}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {/* Remember me + forgot */}
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

          {/* Primary button */}
          <TouchableOpacity onPress={handleSignIn} activeOpacity={0.85}>
            <LinearGradient colors={GRADIENTS.primary} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Sign In</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.orText}>or continue with</Text>

          {/* Social buttons */}
          <View style={styles.socialRow}>
            {[
              { label: 'G',  bg: '#fff',  color: '#e11d48' },
              { label: '🍎', bg: '#000',  color: '#fff'    },
              { label: '⊞',  bg: '#fff',  color: COLORS.blue },
            ].map((p, i) => (
              <TouchableOpacity key={i} style={[styles.socialBtn, { backgroundColor: p.bg }]}>
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
        </View>

        {/* ── Sign Out card (shown below for design reference) ───── */}
        <View style={styles.card}>
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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sky1 },

  // Hero
  hero: {
    paddingTop: 60, paddingBottom: 36, paddingHorizontal: 28,
    overflow: 'hidden',
  },
  cloud: {
    position: 'absolute',
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  logoBox: {
    width: 60, height: 60, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  logoIcon:   { fontSize: 28 },
  appName:    { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  tagline:    { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  subTagline: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 8, lineHeight: 20 },

  // Scroll / cards
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },

  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.xl,
    padding: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
    ...SHADOW.card,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 16 },

  // Inputs
  input: {
    backgroundColor: COLORS.inputBg,
    borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: 'rgba(26,127,232,0.18)',
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: COLORS.text,
    marginBottom: 12,
  },

  // Row helpers
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },

  // Checkbox
  checkRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox:      { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: COLORS.blue, alignItems: 'center', justifyContent: 'center' },
  checkboxActive:{ backgroundColor: COLORS.blue },
  checkmark:     { color: '#fff', fontSize: 11, fontWeight: '700' },
  rememberText:  { fontSize: 13, color: COLORS.sub },
  forgotText:    { fontSize: 13, color: COLORS.blue, fontWeight: '600' },

  // Primary button
  primaryBtn: {
    borderRadius: RADIUS.md, paddingVertical: 14,
    alignItems: 'center',
    ...SHADOW.button,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // OR divider
  orText: { textAlign: 'center', fontSize: 13, color: COLORS.sub, marginVertical: 14 },

  // Social buttons
  socialRow:  { flexDirection: 'row', gap: 10, marginBottom: 14 },
  socialBtn:  {
    flex: 1, paddingVertical: 10,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5, borderColor: 'rgba(26,127,232,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  socialIcon: { fontSize: 16, fontWeight: '700' },

  // Sign up link
  signUpRow:  { flexDirection: 'row', justifyContent: 'center' },
  signUpText: { fontSize: 13, color: COLORS.sub },
  signUpLink: { fontSize: 13, color: COLORS.blue, fontWeight: '700' },

  // Sign out card
  signOutSub: { fontSize: 13, color: COLORS.sub, marginBottom: 14 },
  cancelBtn:  {
    flex: 1, paddingVertical: 11,
    backgroundColor: COLORS.inputBg,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5, borderColor: 'rgba(26,127,232,0.18)',
    alignItems: 'center', marginRight: 8,
  },
  cancelText:  { fontSize: 14, fontWeight: '600', color: COLORS.blue },
  signOutBtn:  {
    flex: 1, paddingVertical: 11,
    backgroundColor: COLORS.missed,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  signOutText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});