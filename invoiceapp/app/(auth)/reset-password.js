import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Spacing, FontSize, Radius, Shadow } from '../../constants/theme';
import { exchangeCodeForSession, updatePassword, signOut, sanitizeAuthError } from '../../utils/auth';

export default function ResetPassword() {
  const router = useRouter();
  const { code } = useLocalSearchParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleReset = async () => {
    if (!password || !confirm) {
      Alert.alert('', 'Please fill in both fields.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('', 'Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('', 'Password must be at least 8 characters.');
      return;
    }
    if (!code) {
      Alert.alert('Invalid Link', 'This reset link is invalid or has already been used. Please request a new one.');
      return;
    }

    setLoading(true);
    try {
      // Exchange the one-time code for a temporary recovery session
      await exchangeCodeForSession(code);
      // Update the password while the recovery session is active
      await updatePassword(password);
      // Sign out the recovery session so the user logs in fresh
      await signOut();
      setDone(true);
    } catch (err) {
      const msg = (err?.message ?? '').toLowerCase();
      if (msg.includes('expired') || msg.includes('invalid')) {
        Alert.alert(
          'Link Expired',
          'This reset link has expired or already been used. Please request a new one.',
          [{ text: 'OK', onPress: () => router.replace('/(auth)/forgot-password') }],
        );
      } else {
        Alert.alert('Error', sanitizeAuthError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <View style={styles.doneContainer}>
        <Ionicons name="checkmark-circle" size={72} color={Colors.accent} />
        <Text style={styles.doneTitle}>Password Updated!</Text>
        <Text style={styles.doneBody}>Your password has been changed successfully.</Text>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => router.replace('/(auth)/login')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>Sign In with New Password</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconBox}>
            <Ionicons name="key-outline" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Create New Password</Text>
          <Text style={styles.subtitle}>Choose a strong password for your account.</Text>
        </View>

        {/* Form */}
        <View style={[styles.card, Shadow.sm]}>
          <View style={styles.field}>
            <Text style={styles.label}>New Password</Text>
            <View style={styles.pwRow}>
              <TextInput
                style={[styles.input, styles.pwInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showPw}
                autoComplete="new-password"
                textContentType="newPassword"
                autoFocus
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw(v => !v)}>
                <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Repeat your new password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showPw}
              autoComplete="new-password"
              textContentType="newPassword"
            />
          </View>

          <TouchableOpacity style={styles.btn} onPress={handleReset} activeOpacity={0.85} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Update Password</Text>
            }
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
  iconBox: {
    width: 72, height: 72, borderRadius: Radius.lg,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center' },

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

  doneContainer: {
    flex: 1, backgroundColor: Colors.background,
    justifyContent: 'center', alignItems: 'center',
    padding: Spacing.xl, gap: Spacing.md,
  },
  doneTitle: { fontSize: 24, fontWeight: '800', color: Colors.text },
  doneBody: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center' },
});
