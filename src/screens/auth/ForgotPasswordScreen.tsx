// ─────────────────────────────────────────────────────────────────────────────
// screens/auth/ForgotPasswordScreen.tsx  —  Password reset by email.
//
// Pushed on top of SignInScreen via a regular navigate(), so back returns to
// SignIn. We DON'T auto-navigate after sending the email — the user needs a
// confirmation that something happened, plus a chance to re-check the address.
//
// Firebase's sendPasswordResetEmail doesn't reveal whether the email is
// registered (anti-enumeration), so we show the same success message either
// way. The user just goes to their inbox.
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
import { sendPasswordReset, authErrorMessage } from '../../services/firebase';

export function ForgotPasswordScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    if (!email.trim()) {
      setError('Please enter your email.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
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
              <MaterialCommunityIcons name="email-outline" size={30} color={theme.colors.primary} />
            </View>
            <Text style={s.title}>Reset your password</Text>
            <Text style={s.subtitle}>
              Enter the email tied to your account and we'll send you a reset link.
            </Text>
          </View>

          {/* Success view: rendered after we've successfully called sendPasswordReset. */}
          {sent ? (
            <View style={s.successCard}>
              <Ionicons name="checkmark-circle" size={28} color={theme.colors.primary} />
              <Text style={s.successTitle}>Check your inbox</Text>
              <Text style={s.successBody}>
                If an account exists for {email.trim()}, you'll get a password-reset
                email shortly. The link expires after 1 hour.
              </Text>
              <TouchableOpacity style={s.primaryBtn} onPress={() => navigation.goBack()}>
                <Text style={s.primaryBtnText}>Back to sign in</Text>
              </TouchableOpacity>
            </View>
          ) : (
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

              {error && (
                <View style={s.errorBox}>
                  <Ionicons name="alert-circle" size={16} color={theme.colors.danger} />
                  <Text style={s.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[s.primaryBtn, loading && s.primaryBtnDisabled]}
                onPress={handleSend}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.primaryBtnText}>Send reset email</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
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
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 16,
  },

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

  successCard: {
    backgroundColor: theme.colors.bgPrimary,
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
    borderRadius: theme.radius.lg,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  successTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  successBody: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  primaryBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 15,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 50,
    alignSelf: 'stretch',
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
