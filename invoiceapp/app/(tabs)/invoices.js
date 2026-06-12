import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ScrollView, TextInput, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, Shadow } from '../../constants/theme';
import { getInvoices, deleteInvoice, archiveInvoice, getSettings } from '../../utils/storage';
import { formatCurrency, formatDate } from '../../utils/invoice';
import TypePickerModal from '../../components/TypePickerModal';
import Mascot from '../../components/Mascot';

const STATUS_COLOR = {
  draft: Colors.textMuted, sent: Colors.warning, paid: Colors.accent, overdue: Colors.danger,
};

const DOC_TYPE_ORDER = ['Invoice', 'Proforma Invoice', 'Quotation', 'Receipt', 'Delivery Note', 'Purchase Order', 'Credit Note'];

function buildFilters(invoices) {
  const active = invoices.filter(i => !i.archived);
  const titles = [...new Set(active.map(i => i.docTitle || 'Invoice'))];
  titles.sort((a, b) => {
    const ai = DOC_TYPE_ORDER.indexOf(a);
    const bi = DOC_TYPE_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  return [
    { key: 'all', label: 'All' },
    ...titles.map(t => ({ key: `doc:${t}`, label: t })),
    { key: 'paid',     label: 'Paid' },
    { key: 'archived', label: 'Archived' },
  ];
}

function applyFilter(invoices, filter) {
  if (filter.startsWith('doc:')) {
    const title = filter.slice(4);
    return invoices.filter(i => !i.archived && (i.docTitle || 'Invoice') === title);
  }
  switch (filter) {
    case 'paid':     return invoices.filter(i => !i.archived && i.status === 'paid');
    case 'archived': return invoices.filter(i => i.archived);
    default:         return invoices.filter(i => !i.archived);
  }
}

function StatCard({ label, value, color }) {
  return (
    <View style={[styles.statCard, Shadow.sm]}>
      <Text style={[styles.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TotalCard({ label, value }) {
  return (
    <View style={[styles.totalCard, Shadow.sm]}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={styles.totalValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{value}</Text>
    </View>
  );
}

export default function Invoices() {
  const { t } = useTranslation();
  const router = useRouter();
  const [allInvoices, setAllInvoices]     = useState([]);
  const [settings, setSettings]           = useState({ currency: 'RWF', name: '' });
  const [filter, setFilter]               = useState('all');
  const [search, setSearch]               = useState('');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [refreshing, setRefreshing]       = useState(false);
  const [selectedMonthKey, setSelectedMonthKey] = useState(null);

  const load = useCallback(async () => {
    const [inv, s] = await Promise.all([getInvoices(), getSettings()]);
    setAllInvoices(inv);
    setSettings(s);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  // Monthly income chart data (last 12 months)
  const now = new Date();
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthInvs = allInvoices.filter(inv => {
      if (inv.archived) return false;
      return (inv.date || inv.createdAt || '').slice(0, 7) === key;
    });
    const paidTotal = monthInvs.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total ?? 0), 0);
    const allTotal  = monthInvs.reduce((s, i) => s + (i.total ?? 0), 0);
    return { key, label: d.toLocaleDateString('en-US', { month: 'short' }), year: d.getFullYear(), paidTotal, allTotal, count: monthInvs.length, invoices: monthInvs };
  });

  // Stats
  const selectedMonth  = selectedMonthKey ? monthlyData.find(m => m.key === selectedMonthKey) : null;
  const activeInvoices = allInvoices.filter(i => !i.archived);
  const statsTotal   = selectedMonth ? selectedMonth.allTotal   : activeInvoices.reduce((s, i) => s + (i.total ?? 0), 0);
  const statsPaid    = selectedMonth ? selectedMonth.invoices.filter(i => i.status === 'paid').length    : activeInvoices.filter(i => i.status === 'paid').length;
  const statsPending = selectedMonth ? selectedMonth.invoices.filter(i => ['sent', 'overdue'].includes(i.status)).length : activeInvoices.filter(i => ['sent', 'overdue'].includes(i.status)).length;

  // Invoice list — filtered by month picker OR by filter chip + search
  const filteredByChip = applyFilter(allInvoices, filter);
  const q = search.trim().toLowerCase();
  const invoiceList = selectedMonthKey
    ? (selectedMonth?.invoices ?? [])
    : (q
        ? filteredByChip.filter(i =>
            (i.number ?? '').toLowerCase().includes(q) ||
            (i.to?.name ?? '').toLowerCase().includes(q) ||
            (i.to?.email ?? '').toLowerCase().includes(q) ||
            (i.date ?? '').includes(q)
          )
        : filteredByChip);

  const filters = buildFilters(allInvoices);

  const counts = {};
  counts.all      = activeInvoices.length;
  counts.paid     = activeInvoices.filter(i => i.status === 'paid').length;
  counts.archived = allInvoices.filter(i => i.archived).length;
  filters.forEach(f => {
    if (f.key.startsWith('doc:')) {
      const title = f.key.slice(4);
      counts[f.key] = activeInvoices.filter(i => (i.docTitle || 'Invoice') === title).length;
    }
  });

  const handleDelete = (id, number) => {
    Alert.alert('Delete', `Permanently delete ${number}?\nThis cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteInvoice(id); load(); } },
    ]);
  };

  const handleArchiveToggle = async (id) => { await archiveInvoice(id); load(); };

  const handleTypeSelect = ({ type, docTitle }) => {
    setShowTypePicker(false);
    router.push(`/invoice/template-picker?type=${type}&docTitle=${encodeURIComponent(docTitle)}`);
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
          <Text style={styles.typeTag}>{(item.docTitle || 'Invoice').toUpperCase()}</Text>
        </View>
        <Text style={styles.amount}>{formatCurrency(item.total ?? 0, settings.currency)}</Text>
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
          <TouchableOpacity style={styles.iconBtn} onPress={() => handleArchiveToggle(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={item.archived ? 'arrow-undo-outline' : 'archive-outline'} size={15} color={Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(item.id, item.number)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={15} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const ListHeader = (
    <View>
      {/* Stats */}
      <View style={styles.statsContainer}>
        <TotalCard
          label={selectedMonth ? `${selectedMonth.label} ${selectedMonth.year}` : 'Total Revenue'}
          value={formatCurrency(statsTotal, settings.currency)}
        />
        <View style={styles.statsRow}>
          <StatCard label={t('dashboard.paid')}    value={String(statsPaid)}    color={Colors.accent} />
          <StatCard label={t('dashboard.pending')} value={String(statsPending)} color={Colors.warning} />
        </View>
      </View>

      {/* Monthly income chart */}
      <View style={styles.chartSection}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Income History</Text>
          {selectedMonthKey && (
            <TouchableOpacity onPress={() => setSelectedMonthKey(null)}>
              <Text style={styles.chartShowAll}>Show All</Text>
            </TouchableOpacity>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartRow}>
          {(() => {
            const maxTotal = Math.max(...monthlyData.map(m => m.allTotal), 1);
            return monthlyData.map(m => {
              const barH  = Math.max(4, Math.round((m.allTotal / maxTotal) * 60));
              const paidH = Math.max(0, Math.round((m.paidTotal / maxTotal) * 60));
              const isSelected = m.key === selectedMonthKey;
              return (
                <TouchableOpacity key={m.key} style={styles.chartBar} onPress={() => { setSelectedMonthKey(isSelected ? null : m.key); setSearch(''); }} activeOpacity={0.7}>
                  <Text style={[styles.chartCount, isSelected && { color: Colors.primary }]}>{m.count > 0 ? m.count : ''}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barTotal, { height: barH, opacity: isSelected ? 1 : 0.6 }]} />
                    <View style={[styles.barPaid, { height: paidH }]} />
                  </View>
                  <Text style={[styles.chartMonth, isSelected && { color: Colors.primary, fontWeight: '700' }]}>{m.label}</Text>
                </TouchableOpacity>
              );
            });
          })()}
        </ScrollView>
      </View>

      {/* Filter chips (only show when not drilling into a month) */}
      {!selectedMonthKey && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filters.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterTxt, filter === f.key && styles.filterTxtActive]}>{f.label}</Text>
              {(counts[f.key] ?? 0) > 0 && (
                <View style={[styles.filterBadge, filter === f.key && styles.filterBadgeActive]}>
                  <Text style={[styles.filterBadgeTxt, filter === f.key && styles.filterBadgeTxtActive]}>{counts[f.key]}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {selectedMonthKey && (
        <Text style={styles.monthHeading}>
          {selectedMonth?.label} {selectedMonth?.year} — {invoiceList.length} invoice{invoiceList.length !== 1 ? 's' : ''}
        </Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header — mascot + greeting + search */}
      <View style={styles.header}>
        {/* Row 1: mascot + greeting */}
        <View style={styles.headerTop}>
          <Mascot size={68} />
          <View style={styles.greetingBlock}>
            <Text style={styles.greeting}>{t('dashboard.greeting')}</Text>
            {settings.name
              ? <Text style={styles.userName}>{settings.name}</Text>
              : <Text style={styles.userName}>Welcome!</Text>
            }
          </View>
        </View>

        {/* Row 2: search bar */}
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={15} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={v => { setSearch(v); setSelectedMonthKey(null); }}
            placeholder="Search by client, number, date…"
            placeholderTextColor={Colors.textMuted}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={15} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={invoiceList}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={ListHeader}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="document-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.empty}>
              {filter === 'archived'
                ? 'No archived documents'
                : filter.startsWith('doc:')
                  ? `No ${filter.slice(4)} documents yet`
                  : filter === 'paid'
                    ? 'No paid documents yet'
                    : 'No documents yet'}
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

  header: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  greetingBlock: { flex: 1 },
  greeting:  { fontSize: FontSize.sm, color: Colors.textSecondary },
  userName:  { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.background, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 9,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: FontSize.sm, color: Colors.text, paddingVertical: 0 },

  statsContainer: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, gap: Spacing.sm },
  totalCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.lg },
  totalLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  totalValue: { fontSize: FontSize.xxxl, fontWeight: '900', color: Colors.primary, letterSpacing: -1 },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  statValue: { fontSize: FontSize.xl, fontWeight: '800' },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, textAlign: 'center' },

  chartSection: { marginTop: Spacing.sm, paddingHorizontal: Spacing.md },
  chartHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  chartTitle:   { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  chartShowAll: { fontSize: FontSize.xs, color: Colors.primary },
  chartRow:     { gap: 8, paddingBottom: 4 },
  chartBar:     { alignItems: 'center', width: 44 },
  chartCount:   { fontSize: 9, color: Colors.textMuted, marginBottom: 2 },
  barTrack:     { width: 24, height: 64, justifyContent: 'flex-end', backgroundColor: Colors.border + '44', borderRadius: 4, overflow: 'hidden', position: 'relative' },
  barTotal:     { width: '100%', backgroundColor: Colors.primary + '55', borderRadius: 4, position: 'absolute', bottom: 0 },
  barPaid:      { width: '100%', backgroundColor: Colors.accent, borderRadius: 4, position: 'absolute', bottom: 0 },
  chartMonth:   { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },

  filterRow:        { paddingHorizontal: Spacing.md, paddingVertical: 10, gap: 8 },
  filterChip:       { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterTxt:        { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  filterTxtActive:  { color: '#fff' },
  filterBadge:      { backgroundColor: Colors.border, borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1 },
  filterBadgeActive:{ backgroundColor: 'rgba(255,255,255,0.25)' },
  filterBadgeTxt:   { fontSize: 10, fontWeight: '700', color: Colors.textSecondary },
  filterBadgeTxtActive: { color: '#fff' },

  monthHeading: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },

  list:      { paddingHorizontal: Spacing.md, paddingBottom: 100, gap: Spacing.sm },
  emptyWrap: { alignItems: 'center', marginTop: 40, gap: 12 },
  empty:     { textAlign: 'center', color: Colors.textMuted, fontSize: FontSize.md },

  card:         { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md },
  cardArchived: { opacity: 0.6 },
  cardTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  number:       { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  typeTag:      { fontSize: 9, color: Colors.textMuted, fontWeight: '700', marginTop: 1, letterSpacing: 0.5 },
  amount:       { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  client:       { fontSize: FontSize.md, color: Colors.text, marginBottom: 8 },
  cardBottom:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date:         { fontSize: FontSize.xs, color: Colors.textMuted },
  cardActions:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge:        { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTxt:     { fontSize: FontSize.xs, fontWeight: '600' },
  iconBtn:      { padding: 4 },

  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', ...Shadow.md },
});
