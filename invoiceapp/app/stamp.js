import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Alert, TouchableOpacity,
  Image, ActivityIndicator, ScrollView,
} from 'react-native';
import { Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, Shadow } from '../constants/theme';
import { getStampPhoto, saveStampPhoto } from '../utils/storage';
import { removeBackground } from '../utils/removebg';

function cleanBase64(raw) {
  return (raw ?? '')
    .replace(/^data:image\/[^;]+;base64,/, '')
    .replace(/\s/g, '');
}

export default function StampScreen() {
  const [stampUri, setStampUri]     = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    getStampPhoto().then(setStampUri);
  }, []);

  const pickAndProcess = async (fromCamera = false) => {
    const permFn = fromCamera
      ? ImagePicker.requestCameraPermissionsAsync
      : ImagePicker.requestMediaLibraryPermissionsAsync;
    const { status } = await permFn();
    if (status !== 'granted') {
      Alert.alert('Permission needed',
        fromCamera ? 'Camera access is required.' : 'Gallery access is required.');
      return;
    }

    const pickerFn = fromCamera
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;

    // allowsEditing: true  ← THE KEY FIX
    //   Forces iOS to run the image through its native editing pipeline before
    //   returning. The output is ALWAYS a JPEG, ALWAYS a file:// URI, and
    //   asset.base64 is ALWAYS clean JPEG — regardless of whether the source
    //   was HEIC, ph://, or anything else. No ImageManipulator needed.
    //
    // quality: 0.85        ← Keeps file size reasonable for the remove.bg API.
    // base64: true         ← Get JPEG base64 directly. No file reading needed.
    const result = await pickerFn({
      mediaTypes: 'images',
      allowsEditing: true,
      quality: 0.85,
      base64: true,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const b64 = cleanBase64(asset.base64);

    if (!b64) {
      Alert.alert('Image Error', 'Could not read image data. Please try again.');
      return;
    }

    setProcessing(true);
    try {
      const pngBase64 = await removeBackground(b64);
      const dataUri = `data:image/png;base64,${pngBase64}`;
      await saveStampPhoto(dataUri);
      setStampUri(dataUri);
      Alert.alert('', '✓ Stamp saved! It will appear on all your invoices.');
    } catch (err) {
      Alert.alert('Stamp Failed', err.message ?? 'Could not remove background. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Remove Stamp', 'This will remove your stamp from all future invoices.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => { await saveStampPhoto(null); setStampUri(null); },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Official Stamp', headerBackTitle: '' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        <Text style={styles.desc}>
          Take a clear photo of your stamp on a plain white page. Crop to the
          stamp area for best results — the background is removed automatically.
        </Text>

        {stampUri && (
          <View style={[styles.savedCard, Shadow.sm]}>
            <Text style={styles.savedLabel}>Current Stamp</Text>
            <View style={styles.previewBox}>
              <Image source={{ uri: stampUri }} style={styles.previewImage} resizeMode="contain" />
            </View>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={16} color={Colors.danger} />
              <Text style={styles.deleteTxt}>Remove stamp</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.sectionTitle}>
          {stampUri ? 'Replace stamp' : 'Add your stamp'}
        </Text>

        {processing ? (
          <View style={[styles.processingCard, Shadow.sm]}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.processingTxt}>Removing background…</Text>
            <Text style={styles.processingNote}>This takes a few seconds</Text>
          </View>
        ) : (
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.pickBtn} onPress={() => pickAndProcess(true)} activeOpacity={0.7}>
              <Ionicons name="camera-outline" size={28} color={Colors.primary} />
              <Text style={styles.pickBtnTitle}>Camera</Text>
              <Text style={styles.pickBtnSub}>Take a photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pickBtn} onPress={() => pickAndProcess(false)} activeOpacity={0.7}>
              <Ionicons name="image-outline" size={28} color={Colors.primary} />
              <Text style={styles.pickBtnTitle}>Gallery</Text>
              <Text style={styles.pickBtnSub}>Choose image</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.tipCard, { backgroundColor: Colors.primaryLight }]}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
          <Text style={styles.tipText}>
            After selecting your photo, you can crop it to the stamp area before
            confirming. Works with all iPhone formats including HEIC.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.background },
  content:        { padding: Spacing.md },
  desc:           { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 22 },
  savedCard:      { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.lg },
  savedLabel:     { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm },
  previewBox:     { backgroundColor: '#F8F8F8', borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, alignItems: 'center' },
  previewImage:   { width: '100%', height: 140 },
  deleteBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm },
  deleteTxt:      { fontSize: FontSize.sm, color: Colors.danger },
  sectionTitle:   { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  processingCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  processingTxt:  { fontSize: FontSize.md, fontWeight: '600', color: Colors.text, marginTop: Spacing.sm },
  processingNote: { fontSize: FontSize.sm, color: Colors.textMuted },
  btnRow:         { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  pickBtn:        { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed', paddingVertical: Spacing.lg, alignItems: 'center', gap: 6, ...Shadow.sm },
  pickBtnTitle:   { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },
  pickBtnSub:     { fontSize: FontSize.xs, color: Colors.textMuted },
  tipCard:        { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.sm },
  tipText:        { flex: 1, fontSize: FontSize.sm, color: Colors.primary, lineHeight: 20 },
});
