import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ScrollView, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, Shadow } from '../../constants/theme';
import { getInvoices, deleteInvoice, archiveInvoice, getSettings } from '../../utils/storage';
import { formatCurrency, formatDate } from '../../utils/invoice';
import TypePickerModal from '../../components/TypePickerModal';

const STATUS_COLOR = {
  draft: Colors.textMuted, sent: Colors.warning, paid: Colors.accent, overdue: Colors.danger,
};

const FILTERS = [
  { key: 'all',      label: 'All' },
  { key: 'invoice',  label: 'Invoices' },
  { key: 'proforma', label: 'Proforma' },
  { key: 'paid',     label: 'Paid' },
  { key: 'archived', label: 'Archived' },
];

function applyFilter(invoices, filter) {
  switch (filter) {
    case 'invoice':  return invoices.filter(i => !i.archived && i.type !== 'proforma');
    case 'proforma': return invoices.filter(i => !i.archived && i.type === 'proforma');
    case 'paid':     return invoices.filter(i => !i.archived && i.status === 'paid');
    case 'archived': return invoices.filter(i => i.archived);
    default:         return invoices.filter(i => !i.archived);
  }
}

export default function Invoices() {
  const { t } = useTranslation();
  const router = useRouter();
  const [allInvoices, setAllInvoices] = useState([]);
  const [currency, setCurrency] = useState('RWF');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showTypePicker, setShowTypePicker] = useState(false);

  const load = useCallback(async () => {
    const [inv, s] = await Promise.all([getInvoices(), getSettings()]);
    setAllInvoices(inv);
    setCurrency(s.currency ?? 'RWF');
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = applyFilter(allInvoices, filter);
  const q = search.trim().toLowerCase();
  const invoices = q
    ? filtered.filter(i =>
        (i.number ?? '').toLowerCase().includes(q) ||
        (i.to?.name ?? '').toLowerCase().includes(q) ||
        (i.to?.email ?? '').toLowerCase().includes(q) ||
        (i.date ?? '').includes(q)
      )
    : filtered;

  const handleDelete = (id, number) => {
    Alert.alert('Delete Invoice', `Permanently delete ${number}?\nThis cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteInvoice(id); load(); } },
    ]);
  };

  const handleArchiveToggle = async (id, isArchived) => {
    await archiveInvoice(id);
    load();
  };

  const handleTypeSelect = (type) => {
    setShowTypePicker(false);
    router.push(`/invoice/template-picker?type=${type}`);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, Shadow.sm, item.archived && styles.cardArchived]}
      onPress={() => router.push(`/invoice/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.number}>{item.number}</Text>
          {item.type === 'proforma' && <Text style={styles.typeTag}>PROFORMA</Text>}
        </View>
        <Text style={styles.amount}>{formatCurrency(item.total ?? 0, currency)}</Text>
      </View>
      <Text style={styles.client}>{item.to?.name ?? '—'}</Text>
      <View style={styles.cardBottom}>
        <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
        <View style={styles.cardActions}>
          <View style={[styles.badge, { backgroundColor: (STATUS_COLOR[item.status] ?? Colors.textMuted) + '22' }]}>
            <Text style={[styles.badgeTxt, { color: STATUS_COLOR[item.status] ?? Colors.textMuted }]}>
              {t(`invoice.status.${item.status ?? 'draft'}`)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => handleArchiveToggle(item.id, item.archived)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={item.archived ? 'arrow-undo-outline' : 'archive-outline'}
              size={15}
              color={Colors.textMuted}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => handleDelete(item.id, item.number)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={15} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const counts = {
    all:      allInvoices.filter(i => !i.archived).length,
    invoice:  allInvoices.filter(i => !i.archived && i.type !== 'proforma').length,
    proforma: allInvoices.filter(i => !i.archived && i.type === 'proforma').length,
    paid:     allInvoices.filter(i => !i.archived && i.status === 'paid').length,
    archived: allInvoices.filter(i => i.archived).length,
  };

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchWrapper}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by client, number, date…"
          placeholderTextColor={Colors.textMuted}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter tabs */}
      <View style={styles.filterWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterTxt, filter === f.key && styles.filterTxtActive]}>{f.label}</Text>
              {counts[f.key] > 0 && (
                <View style={[styles.filterBadge, filter === f.key && styles.filterBadgeActive]}>
                  <Text style={[styles.filterBadgeTxt, filter === f.key && styles.filterBadgeTxtActive]}>
                    {counts[f.key]}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={invoices}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="document-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.empty}>
              {filter === 'archived' ? 'No archived invoices' : 'No invoices yet'}
            </Text>
          </View>
        }
        renderItem={renderItem}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setShowTypePicker(true)} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <TypePickerModal visible={showTypePicker} onSelect={handleTypeSelect} onClose={() => setShowTypePicker(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  filterWrapper: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  filterRow: { paddingHorizontal: Spacing.md, paddingVertical: 10, gap: 8 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterTxt: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  filterTxtActive: { color: '#fff' },
  filterBadge: { backgroundColor: Colors.border, borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1 },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  filterBadgeTxt: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary },
  filterBadgeTxtActive: { color: '#fff' },
  list: { padding: Spacing.md, paddingBottom: 100, gap: Spacing.sm },
  emptyWrap: { alignItems: 'center', marginTop: 60, gap: 12 },
  empty: { textAlign: 'center', color: Colors.textMuted, fontSize: FontSize.md },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md },
  cardArchived: { opacity: 0.6 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  number: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  typeTag: { fontSize: FontSize.xs, color: Colors.accent, fontWeight: '700', marginTop: 2 },
  amount: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  client: { fontSize: FontSize.md, color: Colors.text, marginBottom: 8 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: FontSize.xs, color: Colors.textMuted },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTxt: { fontSize: FontSize.xs, fontWeight: '600' },
  iconBtn: { padding: 4 },
  searchWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 8, gap: 8,
  },
  searchIcon: { marginRight: 2 },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.text, paddingVertical: 2 },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center', ...Shadow.md,
  },
});
