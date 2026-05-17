import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import SignaturePad from '../components/SignaturePad';
import { getSettings, saveSettings } from '../utils/storage';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, Shadow } from '../constants/theme';

export default function SignatureScreen() {
  const router = useRouter();
  const [saved, setSaved] = useState(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  useEffect(() => {
    getSettings().then(s => setSaved(s.signature ?? null));
  }, []);

  const handleSave = async (dataUri) => {
    const settings = await getSettings();
    await saveSettings({ ...settings, signature: dataUri });
    setSaved(dataUri);
    Alert.alert('', '✓ Signature saved! It will appear on all your invoices.');
  };

  const handleDelete = async () => {
    Alert.alert('Remove Signature', 'This will remove your signature from all future invoices.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          const settings = await getSettings();
          await saveSettings({ ...settings, signature: null });
          setSaved(null);
        }
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'My Signature', headerBackTitle: '' }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        scrollEnabled={scrollEnabled}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.desc}>
          Your signature is saved once and automatically added to every invoice and proforma you create.
        </Text>

        {saved ? (
          <View style={[styles.savedCard, Shadow.sm]}>
            <Text style={styles.savedLabel}>Current Signature</Text>
            <View style={styles.sigPreview}>
              <Image source={{ uri: saved }} style={styles.sigImage} resizeMode="contain" />
            </View>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={16} color={Colors.danger} />
              <Text style={styles.deleteTxt}>Remove & draw new one</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>
          {saved ? 'Draw a new signature to replace' : 'Draw your signature below'}
        </Text>

        <SignaturePad
          onSave={handleSave}
          height={220}
          onBeginDraw={() => setScrollEnabled(false)}
          onEndDraw={() => setScrollEnabled(true)}
        />

        <View style={[styles.tipCard, { backgroundColor: Colors.primaryLight }]}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
          <Text style={styles.tipText}>
            Use a single fluid motion. If you make a mistake, tap Clear and try again.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md },
  desc: { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 22 },
  savedCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.lg },
  savedLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm },
  sigPreview: { backgroundColor: '#FAFAFA', borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, alignItems: 'center' },
  sigImage: { width: '100%', height: 80 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm },
  deleteTxt: { fontSize: FontSize.sm, color: Colors.danger },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  tipCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.md },
  tipText: { flex: 1, fontSize: FontSize.sm, color: Colors.primary, lineHeight: 20 },
});
