import { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Switch, Alert, Image, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import i18n from '../../i18n';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, Shadow } from '../../constants/theme';
import {
  getSettings, saveSettings, getBusinessLogo, saveBusinessLogo,
  getStampPhoto,
  getProfiles, saveProfile, deleteProfile, getActiveProfileId, setActiveProfileId,
} from '../../utils/storage';
import { getCurrentUser, signOut } from '../../utils/auth';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'rw', label: 'Kinyarwanda' },
];

const CURRENCIES = ['RWF', 'USD', 'EUR', 'KES', 'NGN', 'GHS', 'XOF'];

function SectionTitle({ title }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function Field({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, secureTextEntry }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor={Colors.textMuted}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        secureTextEntry={secureTextEntry}
      />
    </View>
  );
}

export default function Settings() {
  const { t } = useTranslation();
  const router = useRouter();
  const [form, setForm] = useState({
    name: '', address: '', tin: '', phone: '', businessEmail: '',
    language: 'en', currency: 'RWF',
    momoNumber: '', momoCode: '',
    notificationsEnabled: true,
    instagram: '', website: '',
    signature: null,
  });
  const [logoUri, setLogoUri] = useState(null);
  const isPickingLogo = useRef(false);
  const [stampUri, setStampUri] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileIdState] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileDraft, setProfileDraft] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  useFocusEffect(useCallback(() => {
    (async () => {
      const [s, profileList, activeId, logoData, stampData, user] = await Promise.all([
        getSettings(), getProfiles(), getActiveProfileId(),
        getBusinessLogo(), getStampPhoto(), getCurrentUser(),
      ]);
      setProfiles(profileList);
      setActiveProfileIdState(activeId);
      const { logo: _l, claudeApiKey: _k, ...cleanSettings } = s ?? {};
      setForm(prev => ({ ...prev, ...cleanSettings }));
      if (!isPickingLogo.current) setLogoUri(logoData);
      setStampUri(stampData);
      setUserEmail(user?.email ?? '');
    })();
  }, []));

  const update = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const handleSave = async () => {
    const { logo: _l, claudeApiKey: _k, ...formToSave } = form;
    await saveSettings(formToSave);
    i18n.changeLanguage(form.language);
    Alert.alert('', '✓ Settings saved!');
  };

  const openAddProfile = () => {
    setProfileDraft({ id: null, name: '', address: '', tin: '', phone: '', businessEmail: '', momoNumber: '', momoCode: '', instagram: '', website: '' });
    setShowProfileModal(true);
  };

  const openEditProfile = (profile) => {
    setProfileDraft({ ...profile });
    setShowProfileModal(true);
  };

  const handleProfileSave = async () => {
    if (!profileDraft.name.trim()) { Alert.alert('', 'Enter a business name'); return; }
    const id = profileDraft.id ?? Math.random().toString(36).slice(2, 10).toUpperCase();
    const profile = { ...profileDraft, id };
    await saveProfile(profile);
    const updated = await getProfiles();
    setProfiles(updated);
    setShowProfileModal(false);
    setProfileDraft(null);
    await setActiveProfileId(id);
    setActiveProfileIdState(id);
    setForm(prev => ({ ...prev, ...profile }));
  };

  const handleProfileDelete = (id) => {
    Alert.alert('Delete Profile', 'Delete this business profile?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteProfile(id);
        const updated = profiles.filter(p => p.id !== id);
        setProfiles(updated);
        setShowProfileModal(false);
        setProfileDraft(null);
        if (activeProfileId === id) {
          await setActiveProfileId(null);
          setActiveProfileIdState(null);
        }
      }},
    ]);
  };

  const switchProfile = async (profileId) => {
    if (activeProfileId) {
      await saveProfile({ id: activeProfileId, name: form.name, address: form.address, tin: form.tin, phone: form.phone, businessEmail: form.businessEmail, momoNumber: form.momoNumber, momoCode: form.momoCode, instagram: form.instagram, website: form.website });
    }
    await setActiveProfileId(profileId);
    setActiveProfileIdState(profileId);
    const target = profiles.find(p => p.id === profileId);
    if (target) setForm(prev => ({ ...prev, ...target }));
  };

  const handleNotificationToggle = async (value) => {
    if (value) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') { Alert.alert('', 'Please enable notifications in your device settings.'); return; }
    }
    update('notificationsEnabled', value);
  };

  const pickLogo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('', 'Gallery permission is needed to pick a logo.'); return; }
    isPickingLogo.current = true;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.35, base64: true });
    isPickingLogo.current = false;
    if (result.canceled) return;
    const asset = result.assets[0];
    let dataUri;
    if (asset.base64) {
      dataUri = `data:image/jpeg;base64,${asset.base64}`;
    } else {
      try {
        const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
        dataUri = `data:image/jpeg;base64,${b64}`;
      } catch {
        Alert.alert('', 'Could not read the selected image. Please try another.');
        return;
      }
    }
    await saveBusinessLogo(dataUri);
    setLogoUri(dataUri);
  };

  const removeLogo = () => {
    Alert.alert('Remove Logo', 'Remove the business logo?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await saveBusinessLogo(null);
        setLogoUri(null);
      }},
    ]);
  };


  const handleLogout = () => {
    Alert.alert('Sign Out', 'Sign out of your account?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        try { await signOut(); } catch {}
      }},
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Business Profiles */}
      <SectionTitle title="Business Profiles" />
      <View style={[styles.card, Shadow.sm]}>
        {profiles.length === 0 && (
          <Text style={{ fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.sm }}>
            No extra profiles yet. Add one below to manage multiple businesses.
          </Text>
        )}
        {profiles.map(p => (
          <View key={p.id} style={[styles.profileRow, p.id === activeProfileId && styles.profileRowActive]}>
            <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }} onPress={() => switchProfile(p.id)} activeOpacity={0.7}>
              <View style={[styles.profileAvatar, p.id === activeProfileId && { backgroundColor: Colors.primary }]}>
                <Text style={[styles.profileAvatarTxt, p.id === activeProfileId && { color: '#fff' }]}>
                  {(p.name || '?')[0].toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.profileName, p.id === activeProfileId && { color: Colors.primary }]} numberOfLines={1}>
                  {p.name || 'Unnamed Business'}
                </Text>
                {p.id === activeProfileId && <Text style={styles.profileActiveLbl}>Active</Text>}
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openEditProfile(p)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="create-outline" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addProfileRow} onPress={openAddProfile} activeOpacity={0.7}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
          <Text style={{ color: Colors.primary, fontWeight: '600', fontSize: FontSize.sm }}>Add Business Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Add Business Modal — full-screen onboarding style */}
      <Modal visible={showProfileModal && !profileDraft?.id} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { setShowProfileModal(false); setProfileDraft(null); }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flex: 1, backgroundColor: Colors.background }}>
            {/* Branded header */}
            <View style={am.hero}>
              <TouchableOpacity style={am.closeBtn} onPress={() => { setShowProfileModal(false); setProfileDraft(null); }}>
                <Ionicons name="close" size={24} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
              <Ionicons name="business-outline" size={52} color="rgba(255,255,255,0.9)" />
              <Text style={am.heroTitle}>Add a Business</Text>
              <Text style={am.heroSub}>Create a separate workspace for another business or brand</Text>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={am.content} keyboardShouldPersistTaps="handled">
              {[
                { label: 'Business Name *', field: 'name', placeholder: 'Aristo Tours Ltd' },
                { label: 'Address', field: 'address', placeholder: 'Kigali, Rwanda', multiline: true },
                { label: 'TIN Number', field: 'tin', placeholder: '123456789' },
                { label: 'Phone', field: 'phone', placeholder: '+250 788 000 000', keyboard: 'phone-pad' },
                { label: 'Business Email', field: 'businessEmail', placeholder: 'info@business.com', keyboard: 'email-address' },
                { label: 'Instagram', field: 'instagram', placeholder: '@yourbusiness' },
                { label: 'Website', field: 'website', placeholder: 'www.yourbusiness.com' },
              ].map(({ label, field, placeholder, multiline, keyboard }) => (
                <View key={field} style={pm.field}>
                  <Text style={pm.label}>{label}</Text>
                  <TextInput
                    style={[pm.input, multiline && pm.inputMulti]}
                    value={profileDraft?.[field] ?? ''}
                    onChangeText={v => setProfileDraft(p => ({ ...p, [field]: v }))}
                    placeholder={placeholder}
                    placeholderTextColor={Colors.textMuted}
                    keyboardType={keyboard ?? 'default'}
                    multiline={multiline}
                    autoCapitalize={keyboard === 'email-address' ? 'none' : 'sentences'}
                  />
                </View>
              ))}
              <View style={{ height: 20 }} />
            </ScrollView>

            {/* CTA pinned to bottom */}
            <View style={am.footer}>
              <TouchableOpacity style={am.createBtn} onPress={handleProfileSave} activeOpacity={0.85}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={am.createBtnTxt}>Create Business Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Business Modal — sheet style */}
      <Modal visible={showProfileModal && !!profileDraft?.id} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setShowProfileModal(false); setProfileDraft(null); }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={pm.container}>
            <View style={pm.header}>
              <TouchableOpacity onPress={() => { setShowProfileModal(false); setProfileDraft(null); }}>
                <Text style={pm.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <Text style={pm.title}>Edit Business</Text>
              <TouchableOpacity onPress={handleProfileSave}>
                <Text style={pm.saveTxt}>Save</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={pm.content} keyboardShouldPersistTaps="handled">
              {[
                { label: 'Business Name *', field: 'name', placeholder: 'Aristo Tours Ltd' },
                { label: 'Address', field: 'address', placeholder: 'Kigali, Rwanda', multiline: true },
                { label: 'TIN Number', field: 'tin', placeholder: '123456789' },
                { label: 'Phone', field: 'phone', placeholder: '+250 788 000 000', keyboard: 'phone-pad' },
                { label: 'Business Email', field: 'businessEmail', placeholder: 'info@business.com', keyboard: 'email-address' },
                { label: 'Instagram', field: 'instagram', placeholder: '@yourbusiness' },
                { label: 'Website', field: 'website', placeholder: 'www.yourbusiness.com' },
              ].map(({ label, field, placeholder, multiline, keyboard }) => (
                <View key={field} style={pm.field}>
                  <Text style={pm.label}>{label}</Text>
                  <TextInput
                    style={[pm.input, multiline && pm.inputMulti]}
                    value={profileDraft?.[field] ?? ''}
                    onChangeText={v => setProfileDraft(p => ({ ...p, [field]: v }))}
                    placeholder={placeholder}
                    placeholderTextColor={Colors.textMuted}
                    keyboardType={keyboard ?? 'default'}
                    multiline={multiline}
                    autoCapitalize={keyboard === 'email-address' ? 'none' : 'sentences'}
                  />
                </View>
              ))}
              <TouchableOpacity style={pm.deleteBtn} onPress={() => handleProfileDelete(profileDraft.id)} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                <Text style={pm.deleteTxt}>Delete This Profile</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Business Logo */}
      <SectionTitle title="Business Logo" />
      <View style={[styles.card, Shadow.sm]}>
        {logoUri ? (
          <View style={styles.logoRow}>
            <Image source={{ uri: logoUri }} style={styles.logoPreview} resizeMode="contain" />
            <View style={styles.logoActions}>
              <TouchableOpacity style={styles.logoBtnOutline} onPress={pickLogo} activeOpacity={0.7}>
                <Ionicons name="swap-horizontal-outline" size={16} color={Colors.primary} />
                <Text style={[styles.logoBtnTxt, { color: Colors.primary }]}>Change</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoBtnDanger} onPress={removeLogo} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                <Text style={[styles.logoBtnTxt, { color: Colors.danger }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.logoUpload} onPress={pickLogo} activeOpacity={0.7}>
            <Ionicons name="image-outline" size={28} color={Colors.textMuted} />
            <Text style={styles.logoUploadTxt}>Tap to upload your business logo</Text>
            <Text style={styles.logoUploadSub}>Appears on all invoices and PDFs</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Profile */}
      <SectionTitle title={t('settings.profile')} />
      <View style={[styles.card, Shadow.sm]}>
        <Field label={t('settings.name')} value={form.name ?? ''} onChangeText={(v) => update('name', v)} />
        <Field label={t('settings.address')} value={form.address ?? ''} onChangeText={(v) => update('address', v)} />
        <Field label="Business Email" value={form.businessEmail ?? ''} onChangeText={(v) => update('businessEmail', v)} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" />
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Field label={t('settings.tin')} value={form.tin ?? ''} onChangeText={(v) => update('tin', v)} /></View>
          <View style={{ flex: 1 }}><Field label={t('settings.phone')} value={form.phone ?? ''} onChangeText={(v) => update('phone', v)} keyboardType="phone-pad" /></View>
        </View>
      </View>

      {/* Social Media */}
      <SectionTitle title="Social & Web" />
      <View style={[styles.card, Shadow.sm]}>
        <Text style={styles.socialNote}>These appear as a footer on every invoice PDF.</Text>
        <View style={styles.socialRow}>
          <View style={styles.socialIcon}><Ionicons name="logo-instagram" size={18} color="#E1306C" /></View>
          <View style={{ flex: 1 }}>
            <Field label="Instagram" value={form.instagram ?? ''} onChangeText={(v) => update('instagram', v)} placeholder="@yourbusiness" autoCapitalize="none" />
          </View>
        </View>
        <View style={styles.socialRow}>
          <View style={styles.socialIcon}><Ionicons name="globe-outline" size={18} color={Colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Field label="Website" value={form.website ?? ''} onChangeText={(v) => update('website', v)} placeholder="www.yourbusiness.com" autoCapitalize="none" />
          </View>
        </View>
      </View>

      {/* Language */}
      <SectionTitle title={t('settings.language')} />
      <View style={[styles.card, Shadow.sm]}>
        <View style={styles.chipRow}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[styles.chip, form.language === lang.code && styles.chipActive]}
              onPress={() => update('language', lang.code)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, form.language === lang.code && styles.chipTextActive]}>{lang.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Currency */}
      <SectionTitle title={t('settings.currency')} />
      <View style={[styles.card, Shadow.sm]}>
        <View style={styles.chipRow}>
          {CURRENCIES.map((cur) => (
            <TouchableOpacity
              key={cur}
              style={[styles.chip, form.currency === cur && styles.chipActive]}
              onPress={() => update('currency', cur)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, form.currency === cur && styles.chipTextActive]}>{cur}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Notifications */}
      <SectionTitle title={t('settings.notifications')} />
      <View style={[styles.card, Shadow.sm]}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>{t('settings.notifications')}</Text>
            <Text style={styles.switchDesc}>{t('settings.notificationsDesc')}</Text>
          </View>
          <Switch value={form.notificationsEnabled ?? true} onValueChange={handleNotificationToggle} trackColor={{ true: Colors.primary }} />
        </View>
      </View>

      {/* Saved Notes */}
      <SectionTitle title="Saved Notes" />
      <View style={[styles.card, Shadow.sm, { gap: 0 }]}>
        <TouchableOpacity style={styles.navRow} onPress={() => router.push('/saved-notes')} activeOpacity={0.7}>
          <View style={styles.navRowLeft}>
            <Ionicons name="document-text-outline" size={22} color={Colors.primary} />
            <View>
              <Text style={styles.navRowTitle}>Saved Notes</Text>
              <Text style={styles.navRowSub}>Reusable notes for payment info, terms, etc.</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Signature & Stamp */}
      <SectionTitle title="Signature & Stamp" />
      <View style={[styles.card, Shadow.sm, { gap: 0 }]}>
        <TouchableOpacity style={styles.navRow} onPress={() => router.push('/signature')} activeOpacity={0.7}>
          <View style={styles.navRowLeft}>
            <Ionicons name="create-outline" size={22} color={Colors.primary} />
            <View>
              <Text style={styles.navRowTitle}>My Signature</Text>
              <Text style={styles.navRowSub}>{form.signature ? '✓ Signature saved' : 'Draw and save your signature'}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
        <View style={styles.navDivider} />
        <TouchableOpacity style={styles.navRow} onPress={() => router.push('/stamp')} activeOpacity={0.7}>
          <View style={styles.navRowLeft}>
            <Ionicons name="shield-checkmark-outline" size={22} color={Colors.primary} />
            <View>
              <Text style={styles.navRowTitle}>Official Stamp</Text>
              <Text style={styles.navRowSub}>{stampUri ? '✓ Stamp saved' : 'Upload your business stamp'}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
        <Text style={styles.saveBtnText}>{t('common.save')}</Text>
      </TouchableOpacity>

      {/* Account */}
      <SectionTitle title="Account" />
      <View style={[styles.card, Shadow.sm]}>
        <View style={styles.accountRow}>
          <Ionicons name="person-circle-outline" size={28} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.accountEmail} numberOfLines={1}>{userEmail || 'Not signed in'}</Text>
            <Text style={styles.accountSub}>Invoices synced to cloud</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
          <Text style={styles.logoutTxt}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>{t('settings.version')} 1.0.0</Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md },
  sectionTitle: {
    fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginTop: Spacing.lg, marginBottom: Spacing.sm,
  },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.sm },
  field: {},
  fieldLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: Colors.background, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: FontSize.md, color: Colors.text,
  },

  // Logo
  logoUpload: { alignItems: 'center', paddingVertical: Spacing.lg, gap: 6 },
  logoUploadTxt: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary },
  logoUploadSub: { fontSize: FontSize.xs, color: Colors.textMuted },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  logoPreview: { width: 90, height: 60, borderRadius: Radius.sm, backgroundColor: Colors.background },
  logoActions: { flex: 1, gap: Spacing.sm },
  logoBtnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.sm, paddingVertical: 6, paddingHorizontal: Spacing.sm },
  logoBtnDanger: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: Colors.danger, borderRadius: Radius.sm, paddingVertical: 6, paddingHorizontal: Spacing.sm },
  logoBtnTxt: { fontSize: FontSize.sm, fontWeight: '600' },


  // Social
  socialNote: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 4 },
  socialRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  socialIcon: { paddingBottom: 10 },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  // Switch
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  switchLabel: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  switchDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },

  // Nav rows (signature / stamp)
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  navRowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  navRowTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  navRowSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  navDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: -Spacing.md },

  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.lg, ...Shadow.sm },
  saveBtnText: { fontSize: FontSize.lg, fontWeight: '700', color: '#fff' },
  version: { textAlign: 'center', color: Colors.textMuted, fontSize: FontSize.xs, marginTop: Spacing.lg },

  // Account section
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  accountEmail: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  accountSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: Spacing.sm, borderRadius: Radius.sm, backgroundColor: Colors.danger + '0D', borderWidth: 1.5, borderColor: Colors.danger + '44', marginTop: 4 },
  logoutTxt: { fontSize: FontSize.md, fontWeight: '700', color: Colors.danger },

  // Business Profiles list
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  profileRowActive: { backgroundColor: Colors.primary + '14', borderRadius: Radius.sm, paddingHorizontal: 6 },
  profileAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  profileAvatarTxt: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textSecondary },
  profileName: { fontSize: FontSize.md, color: Colors.text, fontWeight: '600' },
  profileActiveLbl: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600', marginTop: 1 },
  addProfileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: 12, marginTop: 4 },
});

const am = StyleSheet.create({
  hero: {
    backgroundColor: Colors.primary,
    paddingTop: 56, paddingBottom: 32, paddingHorizontal: Spacing.lg,
    alignItems: 'center', gap: 10,
  },
  closeBtn: { position: 'absolute', top: 52, left: Spacing.md, padding: 6 },
  heroTitle: { fontSize: FontSize.xxl, fontWeight: '900', color: '#fff', marginTop: 4 },
  heroSub: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 20 },
  content: { padding: Spacing.md, gap: Spacing.sm },
  footer: { padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background },
  createBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: Spacing.md, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    ...Shadow.sm,
  },
  createBtnTxt: { fontSize: FontSize.lg, fontWeight: '700', color: '#fff' },
});

const pm = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  cancelTxt: { fontSize: FontSize.md, color: Colors.textMuted },
  saveTxt: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },
  content: { padding: Spacing.md, gap: Spacing.sm },
  field: { gap: 4 },
  label: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: Colors.surface, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.md, color: Colors.text },
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.danger + '55', borderRadius: Radius.md, paddingVertical: Spacing.sm, marginTop: Spacing.lg, backgroundColor: Colors.danger + '0D' },
  deleteTxt: { fontSize: FontSize.md, color: Colors.danger, fontWeight: '600' },
});
