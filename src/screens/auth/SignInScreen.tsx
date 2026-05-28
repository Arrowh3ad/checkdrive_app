// ─────────────────────────────────────────────────────────────────────────────
// screens/auth/SignInScreen.tsx  —  Email/password sign-in.
//
// FLOW
// Reached by pushing onto the stack from Pro (guest taps subscribe) or Settings
// (guest taps "Sign in"). On success, `navigation.goBack()` returns to whoever
// pushed this screen — by then the store's `user` is populated (via the auth
// listener), so that screen re-renders into its logged-in state automatically.
//
// SignIn ↔ SignUp swap with `navigation.replace`, so only one auth screen ever
// sits above the caller and a single goBack() is always correct.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useState } from 'react';
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
import { signInWithEmail, authErrorMessage } from '../../services/firebase';

export function SignInScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // See SignUpScreen for the rationale: Android resizes but doesn't scroll
  // the focused field into view, so we scroll to the bottom on focus.
  const scrollRef = useRef<ScrollView>(null);
  function scrollToBottom() {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }

  async function handleSignIn() {
    // Cheap client-side checks so we don't bother the network with blanks.
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signInWithEmail(email, password);
      // Auth listener updates the store; pop back to the caller (Pro/Settings).
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
          ref={scrollRef}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Topbar ───────────────────────────────────────────────────── */}
          <View style={s.topbar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
              <Ionicons name="arrow-back" size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* ── Brand mark + heading ─────────────────────────────────────── */}
          <View style={s.header}>
            <View style={s.logo}>
              <MaterialCommunityIcons name="car-cog" size={30} color={theme.colors.primary} />
            </View>
            <Text style={s.title}>Welcome back</Text>
            <Text style={s.subtitle}>Sign in to manage your Pro subscription</Text>
          </View>

          {/* ── Form ─────────────────────────────────────────────────────── */}
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
                placeholder="Your password"
                placeholderTextColor={theme.colors.textTertiary}
                secureTextEntry={!showPw}
                autoCapitalize="none"
                autoComplete="password"
                editable={!loading}
                onFocus={scrollToBottom}
              />
              <TouchableOpacity onPress={() => setShowPw((v) => !v)} style={s.eyeBtn}>
                <Ionicons
                  name={showPw ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.colors.textTertiary}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => (navigation as any).navigate('ForgotPassword')}
              disabled={loading}
            >
              <Text style={s.forgot}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Error banner — only rendered when there's something to show. */}
            {error && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={16} color={theme.colors.danger} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[s.primaryBtn, loading && s.primaryBtnDisabled]}
              onPress={handleSignIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.primaryBtnText}>Sign in</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Switch to sign-up ────────────────────────────────────────── */}
          <View style={s.switchRow}>
            <Text style={s.switchText}>Don't have an account? </Text>
            <TouchableOpacity
              onPress={() => (navigation as any).replace('SignUp')}
              disabled={loading}
            >
              <Text style={s.switchLink}>Sign up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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
  forgot: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '500',
    textAlign: 'right',
    marginTop: 8,
  },

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
