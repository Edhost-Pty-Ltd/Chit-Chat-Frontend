// ─── Screen: Sign In ─────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW, GRADIENTS, GLASS } from '../types/theme';
import { RootStackParamList } from '../types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'SignIn'>;

export default function SignInScreen() {
  const navigation = useNavigation<NavProp>();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPass, setShowPass] = useState(false);

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
          <Text style={styles.cardTitle}>Sign In</Text>

          {/* Email input */}
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color={COLORS.sub} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email or Phone"
              placeholderTextColor={COLORS.textFaint}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Password input */}
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={COLORS.sub} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={COLORS.textFaint}
              secureTextEntry={!showPass}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
              <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.sub} />
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <TouchableOpacity style={styles.checkRow} onPress={() => setRemember(!remember)} activeOpacity={0.7}>
              <View style={[styles.checkbox, remember && styles.checkboxActive]}>
                {remember && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Text style={styles.rememberText}>Remember me</Text>
            </TouchableOpacity>
            <TouchableOpacity>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => navigation.replace('Chats')} activeOpacity={0.85}>
            <LinearGradient colors={GRADIENTS.primary} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Sign In</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.orText}>or continue with</Text>

          {/* Google button */}
          <TouchableOpacity style={styles.socialBtnFull} activeOpacity={0.85}>
            <Ionicons name="logo-google" size={20} color="#EA4335" />
            <Text style={styles.socialBtnText}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Apple button */}
          <TouchableOpacity style={[styles.socialBtnFull, styles.socialBtnApple]} activeOpacity={0.85}>
            <Ionicons name="logo-apple" size={22} color={COLORS.text} />
            <Text style={styles.socialBtnText}>Continue with Apple</Text>
          </TouchableOpacity>

          <View style={styles.signUpRow}>
            <Text style={styles.signUpText}>Don't have an account? </Text>
            <TouchableOpacity><Text style={styles.signUpLink}>Sign Up</Text></TouchableOpacity>
          </View>
        </View>

        {/* Sign Out card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign Out</Text>
          <Text style={styles.signOutSub}>Are you sure you want to sign out?</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.signOutBtn}>
              <Ionicons name="log-out-outline" size={16} color={COLORS.missed} style={{ marginRight: 4 }} />
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

  scroll: { padding: 20, gap: 16, paddingBottom: 48 },
  card: { ...GLASS.elevated, borderRadius: RADIUS.xl, padding: 22, ...SHADOW.card },
  cardTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 18 },

  inputWrap: {
    ...GLASS.input, borderRadius: RADIUS.md, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center',
  },
  inputIcon: { paddingLeft: 14 },
  input:     { flex: 1, paddingHorizontal: 10, paddingVertical: 13, fontSize: 14, color: COLORS.text },
  eyeBtn:    { paddingRight: 12 },

  row:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  checkRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox:       { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: COLORS.blue, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: COLORS.blue },
  rememberText:   { fontSize: 13, color: COLORS.sub },
  forgotText:     { fontSize: 13, color: COLORS.blue, fontWeight: '600' },

  primaryBtn:     { borderRadius: RADIUS.md, paddingVertical: 15, alignItems: 'center', ...SHADOW.button },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  orText: { textAlign: 'center', fontSize: 13, color: COLORS.sub, marginVertical: 16 },

  // Full-width labelled social buttons
  socialBtnFull: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    paddingVertical: 13, marginBottom: 10,
    ...GLASS.input, borderRadius: RADIUS.md,
    ...SHADOW.card,
  },
  socialBtnApple: {
    marginBottom: 16,
  },
  socialBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.text },

  // Legacy — unused
  socialRow: {},
  socialBtn: {},

  signUpRow:  { flexDirection: 'row', justifyContent: 'center' },
  signUpText: { fontSize: 13, color: COLORS.sub },
  signUpLink: { fontSize: 13, color: COLORS.blue, fontWeight: '700' },

  signOutSub: { fontSize: 13, color: COLORS.sub, marginBottom: 16 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, marginRight: 8,
    ...GLASS.input, borderRadius: RADIUS.sm, alignItems: 'center',
  },
  cancelText:  { fontSize: 14, fontWeight: '600', color: COLORS.blue },
  signOutBtn:  {
    flex: 1, paddingVertical: 12,
    flexDirection: 'row',
    backgroundColor: 'rgba(232,67,67,0.10)',
    borderRadius: RADIUS.sm,
    borderWidth: 1.5, borderColor: 'rgba(232,67,67,0.30)',
    alignItems: 'center', justifyContent: 'center',
  },
  signOutText: { fontSize: 14, fontWeight: '600', color: COLORS.missed },
});
