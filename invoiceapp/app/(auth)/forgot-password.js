import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Spacing, FontSize, Radius, Shadow } from '../../constants/theme';
import { resetPasswordForEmail } from '../../utils/auth';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) {
      Alert.alert('', 'Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      await resetPasswordForEmail(email.trim().toLowerCase());
      setSent(true);
    } catch (err) {
      Alert.alert('Error', err.message ?? 'Could not send reset email. Check the address and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Back */}
        <TouchableOpacity style={styles.back} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={Colors.primary} />
          <Text style={styles.backTxt}>Back to Sign In</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconBox}>
            <Ionicons name="lock-open-outline" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Forgot Password?</Text>
          <Text style={styles.subtitle}>
            Enter the email address linked to your account and we'll send you a reset link.
          </Text>
        </View>

        {sent ? (
          /* Success state */
          <View style={[styles.card, Shadow.sm, styles.successCard]}>
            <Ionicons name="checkmark-circle" size={48} color={Colors.accent} />
            <Text style={styles.successTitle}>Check your email</Text>
            <Text style={styles.successBody}>
              A password reset link has been sent to{'\n'}
              <Text style={{ fontWeight: '700' }}>{email}</Text>
            </Text>
            <Text style={styles.successNote}>
              Tap the link in the email to create a new password. If you don't see it, check your spam folder.
            </Text>
            <TouchableOpacity style={styles.btn} onPress={() => router.back()} activeOpacity={0.85}>
              <Text style={styles.btnText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Form */
          <View style={[styles.card, Shadow.sm]}>
            <View style={styles.field}>
              <Text style={styles.label}>Email address</Text>
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
                autoFocus
              />
            </View>

            <TouchableOpacity style={styles.btn} onPress={handleSend} activeOpacity={0.85} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Send Reset Link</Text>
              }
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, padding: Spacing.lg, paddingTop: Spacing.xl },

  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.xl },
  backTxt: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '600' },

  header: { alignItems: 'center', marginBottom: Spacing.xl },
  iconBox: {
    width: 72, height: 72, borderRadius: Radius.lg,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm },
  subtitle: {
    fontSize: FontSize.md, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 22,
  },

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
    fontSize: FontSize.md, color: Colors.text,
  },
  btn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 14, alignItems: 'center', ...Shadow.sm,
  },
  btnText: { fontSize: FontSize.lg, fontWeight: '700', color: '#fff' },

  successCard: { alignItems: 'center', gap: Spacing.md },
  successTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  successBody: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  successNote: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
