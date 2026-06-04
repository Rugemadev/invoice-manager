import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Spacing, FontSize, Radius, Shadow } from '../../constants/theme';
import { signUp, sanitizeAuthError } from '../../utils/auth';

const MIN_PASSWORD_LENGTH = 8;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 60_000;

export default function Signup() {
  const router = useRouter();
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);

  const failCount = useRef(0);
  const lockUntil = useRef(null);

  const handleSignup = async () => {
    // Enforce lockout
    if (lockUntil.current && Date.now() < lockUntil.current) {
      const secs = Math.ceil((lockUntil.current - Date.now()) / 1000);
      Alert.alert('Too many attempts', `Please wait ${secs} seconds before trying again.`);
      return;
    }

    if (!email.trim() || !password || !confirm) {
      Alert.alert('', 'Please fill in all fields.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('', 'Passwords do not match.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      Alert.alert('', `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setLoading(true);
    try {
      await signUp(email.trim().toLowerCase(), password);
      failCount.current = 0;
      lockUntil.current = null;
      // _layout.js auth guard will redirect to (tabs) automatically after session is created
    } catch (err) {
      const next = failCount.current + 1;
      failCount.current = next;
      if (next >= MAX_ATTEMPTS) {
        lockUntil.current = Date.now() + LOCKOUT_MS;
        failCount.current = 0;
        Alert.alert('Too many attempts', 'Please wait 60 seconds before trying again.');
      } else {
        Alert.alert('Sign Up Failed', sanitizeAuthError(err));
      }
    } finally {
      setLoading(false);
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
          <Text style={styles.tagline}>Create your account</Text>
        </View>

        {/* Form */}
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
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showPw}
                autoComplete="new-password"
                textContentType="newPassword"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw(v => !v)}>
                <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Repeat your password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showPw}
              autoComplete="new-password"
              textContentType="newPassword"
            />
          </View>

          <TouchableOpacity style={styles.btn} onPress={handleSignup} activeOpacity={0.85} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Create Account</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Log in link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.footerLink}>Sign in</Text>
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

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.xl },
  footerText: { fontSize: FontSize.md, color: Colors.textSecondary },
  footerLink: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },
});
