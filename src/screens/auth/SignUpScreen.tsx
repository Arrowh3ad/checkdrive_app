// ─────────────────────────────────────────────────────────────────────────────
// screens/auth/SignUpScreen.tsx  —  Email/password account creation.
//
// Mirrors SignInScreen's layout for consistency. On success, Firebase
// automatically signs the new user in, the store's `user` populates via the
// auth listener, and goBack() returns the user to whoever sent them here.
//
// Confirm-password match is checked client-side because Firebase doesn't track
// that — it only knows the one password the user submitted.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { signUpWithEmail, authErrorMessage } from '../../services/firebase';

export function SignUpScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignUp() {
    // Client-side validation — Firebase will catch deeper issues server-side.
    if (!email.trim()) {
      setError('Please enter your email.');
      return;
    }
    if (password.length < 6) {
      setError('Password should be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signUpWithEmail(email, password);
      // Firebase auto-signs-in on successful signup. Auth listener populates
      // the store; goBack returns us to the original caller (Pro/Settings).
      navigation.goBack();
    } catch (e: any) {
      setError(authErrorMessage(e?.code ?? ''));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.topbar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
              <Ionicons name="arrow-back" size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={s.header}>
            <View style={s.logo}>
              <MaterialCommunityIcons name="account-plus" size={30} color={theme.colors.primary} />
            </View>
            <Text style={s.title}>Create your account</Text>
            <Text style={s.subtitle}>Free to create. Required only to go Pro.</Text>
          </View>

          <View style={s.form}>
            <Text style={s.label}>Email</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={theme.colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!loading}
            />

            <Text style={s.label}>Password</Text>
            <View style={s.pwWrap}>
              <TextInput
                style={s.pwInput}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                placeholderTextColor={theme.colors.textTertiary}
                secureTextEntry={!showPw}
                autoCapitalize="none"
                autoComplete="password-new"
                editable={!loading}
              />
              <TouchableOpacity onPress={() => setShowPw((v) => !v)} style={s.eyeBtn}>
                <Ionicons
                  name={showPw ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.colors.textTertiary}
                />
              </TouchableOpacity>
            </View>

            <Text style={s.label}>Confirm password</Text>
            <TextInput
              style={s.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Re-enter password"
              placeholderTextColor={theme.colors.textTertiary}
              secureTextEntry={!showPw}
              autoCapitalize="none"
              autoComplete="password-new"
              editable={!loading}
            />

            {error && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={16} color={theme.colors.danger} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[s.primaryBtn, loading && s.primaryBtnDisabled]}
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.primaryBtnText}>Create account</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={s.switchRow}>
            <Text style={s.switchText}>Already have an account? </Text>
            <TouchableOpacity
              onPress={() => (navigation as any).replace('SignIn')}
              disabled={loading}
            >
              <Text style={s.switchLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Styles mirror SignInScreen so the two screens feel like one continuous flow.
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bgSecondary },
  scroll: { padding: 16, paddingBottom: 40 },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  backBtn: { padding: 4 },

  header: { alignItems: 'center', marginTop: 12, marginBottom: 28, gap: 8 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 24, fontWeight: '600', color: theme.colors.textPrimary },
  subtitle: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' },

  form: { gap: 8 },
  label: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary, marginTop: 8 },
  input: {
    backgroundColor: theme.colors.bgPrimary,
    borderWidth: 0.5,
    borderColor: theme.colors.borderSecondary,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  pwWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bgPrimary,
    borderWidth: 0.5,
    borderColor: theme.colors.borderSecondary,
    borderRadius: theme.radius.md,
  },
  pwInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  eyeBtn: { padding: 12 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FDECEC',
    borderRadius: theme.radius.md,
    padding: 12,
    marginTop: 12,
  },
  errorText: { flex: 1, fontSize: 13, color: theme.colors.danger },

  primaryBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 50,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  switchText: { fontSize: 14, color: theme.colors.textSecondary },
  switchLink: { fontSize: 14, color: theme.colors.primary, fontWeight: '600' },
});
