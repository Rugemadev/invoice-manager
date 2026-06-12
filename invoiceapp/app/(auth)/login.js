import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { Colors } from '../../constants/colors';
import { Spacing, FontSize, Radius, Shadow } from '../../constants/theme';
import { signIn, sanitizeAuthError } from '../../utils/auth';
import { supabase } from '../../utils/supabase';

WebBrowser.maybeCompleteAuthSession();

// Lock out for 30 s after 5 consecutive failures; reset on success.
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 30_000;

export default function Login() {
  const router = useRouter();
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [socialLoading, setSocialLoading] = useState(null);

  const failCount  = useRef(0);
  const lockUntil  = useRef(null);

  const handleLogin = async () => {
    if (lockUntil.current && Date.now() < lockUntil.current) {
      const secs = Math.ceil((lockUntil.current - Date.now()) / 1000);
      Alert.alert('Too many attempts', `Please wait ${secs} seconds before trying again.`);
      return;
    }
    if (!email.trim() || !password) {
      Alert.alert('', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
      failCount.current = 0;
      lockUntil.current = null;
    } catch (err) {
      const next = failCount.current + 1;
      failCount.current = next;
      if (next >= MAX_ATTEMPTS) {
        lockUntil.current = Date.now() + LOCKOUT_MS;
        failCount.current = 0;
        Alert.alert('Account temporarily locked', 'Too many failed attempts. Please wait 30 seconds.');
      } else {
        Alert.alert('Sign In Failed', sanitizeAuthError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setSocialLoading('google');
    try {
      const redirectTo = makeRedirectUri({ scheme: 'invoiceapp', path: 'auth-callback' });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('No auth URL returned');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success' && result.url) {
        // Session is picked up automatically by onAuthStateChange in _layout.js
        await supabase.auth.getSession();
      }
    } catch (err) {
      Alert.alert('Google Sign In Failed', err.message ?? 'Please try again.');
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Logo / branding */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Ionicons name="receipt-outline" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.appName}>Invoice Manager</Text>
          <Text style={styles.tagline}>Sign in to your account</Text>
        </View>

        {/* Email / password form */}
        <View style={[styles.card, Shadow.sm]}>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.pwRow}>
              <TextInput
                style={[styles.input, styles.pwInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showPw}
                autoComplete="password"
                textContentType="password"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw(v => !v)}>
                <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.forgotRow} onPress={() => router.push('/(auth)/forgot-password')} activeOpacity={0.7}>
            <Text style={styles.forgotTxt}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btn} onPress={handleLogin} activeOpacity={0.85} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Sign In</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerTxt}>or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social sign-in */}
        <TouchableOpacity
          style={styles.socialBtn}
          onPress={handleGoogleSignIn}
          activeOpacity={0.8}
          disabled={!!socialLoading}
        >
          {socialLoading === 'google'
            ? <ActivityIndicator size="small" color={Colors.text} />
            : <>
                <Text style={styles.googleG}>G</Text>
                <Text style={styles.socialBtnTxt}>Continue with Google</Text>
              </>
          }
        </TouchableOpacity>

        {/* Sign up link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/signup')} activeOpacity={0.7}>
            <Text style={styles.footerLink}>Create account</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg },

  header: { alignItems: 'center', marginBottom: Spacing.xl },
  logoBox: {
    width: 72, height: 72, borderRadius: Radius.lg,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.md,
  },
  appName: { fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  tagline: { fontSize: FontSize.md, color: Colors.textSecondary },

  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.md,
  },
  field: { gap: 6 },
  label: {
    fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  input: {
    backgroundColor: Colors.background, borderRadius: Radius.sm,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    fontSize: FontSize.md, color: Colors.text, flex: 1,
  },
  pwRow: { flexDirection: 'row', alignItems: 'center' },
  pwInput: { borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  eyeBtn: {
    borderWidth: 1.5, borderLeftWidth: 0, borderColor: Colors.border,
    borderTopRightRadius: Radius.sm, borderBottomRightRadius: Radius.sm,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.sm, paddingVertical: 12,
  },
  btn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: 4, ...Shadow.sm,
  },
  btnText: { fontSize: FontSize.lg, fontWeight: '700', color: '#fff' },
  forgotRow: { alignSelf: 'flex-end' },
  forgotTxt: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginVertical: Spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerTxt: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600' },

  socialBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13, borderRadius: Radius.md,
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border,
    ...Shadow.sm,
  },
  googleG: { fontSize: 16, fontWeight: '800', color: '#4285F4' },
  socialBtnTxt: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.xl },
  footerText: { fontSize: FontSize.md, color: Colors.textSecondary },
  footerLink: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },
});
