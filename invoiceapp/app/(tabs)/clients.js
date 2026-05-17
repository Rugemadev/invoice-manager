import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, Shadow } from '../../constants/theme';
import { getClients, saveClient, deleteClient, getInvoices } from '../../utils/storage';
import { generateId } from '../../utils/invoice';

const EMPTY_CLIENT = { name: '', address: '', tin: '', phone: '', email: '' };

function ClientModal({ visible, initial, onSave, onClose }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial ?? EMPTY_CLIENT);

  const update = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const handleSave = () => {
    if (!form.name.trim()) { Alert.alert('', 'Name is required'); return; }
    onSave(form);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modal.container}>
        <View style={modal.handle} />
        <Text style={modal.title}>{initial?.id ? t('common.edit') : t('clients.addClient')}</Text>

        {[
          { key: 'name', label: t('clients.name') },
          { key: 'address', label: t('clients.address') },
          { key: 'tin', label: t('clients.tin') },
          { key: 'phone', label: t('clients.phone'), keyboard: 'phone-pad' },
          { key: 'email', label: t('clients.email'), keyboard: 'email-address' },
        ].map(({ key, label, keyboard }) => (
          <View key={key} style={modal.field}>
            <Text style={modal.label}>{label}</Text>
            <TextInput
              style={modal.input}
              value={form[key]}
              onChangeText={(v) => update(key, v)}
              placeholder={label}
              placeholderTextColor={Colors.textMuted}
              keyboardType={keyboard ?? 'default'}
            />
          </View>
        ))}

        <TouchableOpacity style={modal.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <Text style={modal.saveBtnText}>{t('common.save')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={modal.cancelBtn} onPress={onClose}>
          <Text style={modal.cancelText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

export default function Clients() {
  const { t } = useTranslation();
  const [clients, setClients] = useState([]);
  const [invoiceCounts, setInvoiceCounts] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    const [c, invoices] = await Promise.all([getClients(), getInvoices()]);
    setClients(c);
    const counts = {};
    invoices.forEach((inv) => {
      const name = inv.to?.name;
      if (name) counts[name] = (counts[name] ?? 0) + 1;
    });
    setInvoiceCounts(counts);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSave = async (form) => {
    const client = { ...form, id: form.id ?? generateId(), createdAt: form.createdAt ?? new Date().toISOString() };
    await saveClient(client);
    setModalVisible(false);
    setEditing(null);
    load();
  };

  const handleDelete = (client) => {
    Alert.alert('', `Delete ${client.name}?`, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => { await deleteClient(client.id); load(); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={clients}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>{t('clients.noClients')}</Text>}
        renderItem={({ item }) => (
          <View style={[styles.card, Shadow.sm]}>
            <TouchableOpacity
              style={styles.cardMain}
              onPress={() => { setEditing(item); setModalVisible(true); }}
              activeOpacity={0.7}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name[0]?.toUpperCase() ?? '?'}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                {item.address ? <Text style={styles.sub}>{item.address}</Text> : null}
                {item.phone ? <Text style={styles.sub}>{item.phone}</Text> : null}
                {item.tin ? <Text style={styles.sub}>TIN: {item.tin}</Text> : null}
              </View>
            </TouchableOpacity>
            <View style={styles.cardRight}>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{invoiceCounts[item.name] ?? 0}</Text>
                <Text style={styles.countLabel}>{t('clients.invoices')}</Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => { setEditing(item); setModalVisible(true); }}>
                  <Ionicons name="pencil-outline" size={18} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(item)}>
                  <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => { setEditing(null); setModalVisible(true); }} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color={Colors.textInverse} />
      </TouchableOpacity>

      <ClientModal
        visible={modalVisible}
        initial={editing}
        onSave={handleSave}
        onClose={() => { setModalVisible(false); setEditing(null); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, paddingBottom: 100, gap: Spacing.sm },
  empty: { textAlign: 'center', color: Colors.textMuted, marginTop: 60 },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md,
    flexDirection: 'row', alignItems: 'center',
  },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cardRight: { alignItems: 'center', gap: Spacing.xs, marginLeft: Spacing.sm },
  cardActions: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 6 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.primary },
  info: { flex: 1 },
  name: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  countBadge: { alignItems: 'center' },
  countText: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.primary },
  countLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
    ...Shadow.md,
  },
});

const modal = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface, padding: Spacing.lg, paddingTop: Spacing.md },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.lg },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.lg },
  field: { marginBottom: Spacing.sm },
  label: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: Colors.background, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: FontSize.md, color: Colors.text,
  },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
  saveBtnText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textInverse },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.md },
  cancelText: { fontSize: FontSize.md, color: Colors.textMuted },
});
