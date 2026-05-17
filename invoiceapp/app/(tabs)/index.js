import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, Shadow } from '../../constants/theme';
import { getInvoices, getSettings } from '../../utils/storage';
import { formatCurrency, formatDate } from '../../utils/invoice';
import TypePickerModal from '../../components/TypePickerModal';

const STATUS_COLOR = {
  draft: Colors.textMuted, sent: Colors.warning, paid: Colors.accent, overdue: Colors.danger,
};

function StatCard({ label, value, color }) {
  return (
    <View style={[styles.statCard, Shadow.sm]}>
      <Text style={[styles.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const [invoices, setInvoices] = useState([]);
  const [allInvoices, setAllInvoices] = useState([]);
  const [settings, setSettings] = useState({ currency: 'RWF', name: '' });
  const [refreshing, setRefreshing] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [selectedMonthKey, setSelectedMonthKey] = useState(null);

  const load = useCallback(async () => {
    const [inv, s] = await Promise.all([getInvoices(), getSettings()]);
    setAllInvoices(inv);
    setInvoices(inv.filter(i => !i.archived).slice(0, 10));
    setSettings(s);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleTypeSelect = (type) => {
    setShowTypePicker(false);
    router.push(`/invoice/template-picker?type=${type}`);
  };

  // Compute monthly data for the last 12 months
  const now = new Date();
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthInvs = allInvoices.filter(inv => {
      if (inv.archived) return false;
      const invMonthKey = (inv.date || inv.createdAt || '').slice(0, 7);
      return invMonthKey === key;
    });
    const paidTotal = monthInvs.filter(inv => inv.status === 'paid').reduce((s, inv) => s + (inv.total ?? 0), 0);
    const allTotal = monthInvs.reduce((s, inv) => s + (inv.total ?? 0), 0);
    return {
      key, label: d.toLocaleDateString('en-US', { month: 'short' }),
      year: d.getFullYear(), paidTotal, allTotal, count: monthInvs.length, invoices: monthInvs,
    };
  });

  const displayedInvoices = selectedMonthKey
    ? (monthlyData.find(m => m.key === selectedMonthKey)?.invoices ?? [])
    : allInvoices.filter(inv => !inv.archived).slice(0, 10);

  const selectedMonth = selectedMonthKey ? monthlyData.find(m => m.key === selectedMonthKey) : null;
  const statsTotal = selectedMonth ? selectedMonth.allTotal : allInvoices.filter(i => !i.archived).reduce((s, i) => s + (i.total ?? 0), 0);
  const statsPaid = selectedMonth ? selectedMonth.invoices.filter(i => i.status === 'paid').length : allInvoices.filter(i => !i.archived && i.status === 'paid').length;
  const statsPending = selectedMonth ? selectedMonth.invoices.filter(i => i.status === 'sent' || i.status === 'overdue').length : allInvoices.filter(i => !i.archived && (i.status === 'sent' || i.status === 'overdue')).length;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{t('dashboard.greeting')} 👋</Text>
            {settings.name ? <Text style={styles.userName}>{settings.name}</Text> : null}
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatCard label={selectedMonth ? selectedMonth.label : t('dashboard.thisWeek')} value={formatCurrency(statsTotal, settings.currency)} color={Colors.primary} />
          <StatCard label={t('dashboard.paid')} value={String(statsPaid)} color={Colors.accent} />
          <StatCard label={t('dashboard.pending')} value={String(statsPending)} color={Colors.warning} />
        </View>

        {/* Monthly Income Chart */}
        <View style={styles.chartSection}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Income History</Text>
            {selectedMonthKey && (
              <TouchableOpacity onPress={() => setSelectedMonthKey(null)}>
                <Text style={{ fontSize: FontSize.xs, color: Colors.primary }}>Show All</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartRow}>
            {(() => {
              const maxTotal = Math.max(...monthlyData.map(m => m.allTotal), 1);
              return monthlyData.map(m => {
                const barHeight = Math.max(4, Math.round((m.allTotal / maxTotal) * 60));
                const paidHeight = Math.max(0, Math.round((m.paidTotal / maxTotal) * 60));
                const isSelected = m.key === selectedMonthKey;
                return (
                  <TouchableOpacity key={m.key} style={styles.chartBar} onPress={() => setSelectedMonthKey(isSelected ? null : m.key)} activeOpacity={0.7}>
                    <Text style={[styles.chartCount, isSelected && { color: Colors.primary }]}>{m.count > 0 ? m.count : ''}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barTotal, { height: barHeight, opacity: isSelected ? 1 : 0.6 }]} />
                      <View style={[styles.barPaid, { height: paidHeight }]} />
                    </View>
                    <Text style={[styles.chartMonth, isSelected && { color: Colors.primary, fontWeight: '700' }]}>{m.label}</Text>
                  </TouchableOpacity>
                );
              });
            })()}
          </ScrollView>
        </View>

        <Text style={styles.sectionTitle}>
          {selectedMonthKey ? `${monthlyData.find(m => m.key === selectedMonthKey)?.label} ${monthlyData.find(m => m.key === selectedMonthKey)?.year} Invoices` : 'Recent Invoices'}
        </Text>
        {displayedInvoices.length === 0
          ? <Text style={styles.empty}>{t('dashboard.noInvoices')}</Text>
          : displayedInvoices.map(inv => (
            <TouchableOpacity key={inv.id} style={[styles.row, Shadow.sm]} onPress={() => router.push(`/invoice/${inv.id}`)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={styles.invNumber}>{inv.number}</Text>
                <Text style={styles.invClient}>{inv.to?.name ?? '—'}</Text>
                <Text style={styles.invDate}>{formatDate(inv.createdAt)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={styles.invAmount}>{formatCurrency(inv.total ?? 0, settings.currency)}</Text>
                <View style={[styles.badge, { backgroundColor: STATUS_COLOR[inv.status] + '22' }]}>
                  <Text style={[styles.badgeTxt, { color: STATUS_COLOR[inv.status] }]}>{t(`invoice.status.${inv.status}`)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        }
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setShowTypePicker(true)} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <TypePickerModal visible={showTypePicker} onSelect={handleTypeSelect} onClose={() => setShowTypePicker(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.md, paddingBottom: 100, gap: Spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  greeting: { fontSize: FontSize.md, color: Colors.textSecondary },
  userName: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  statValue: { fontSize: FontSize.lg, fontWeight: '700' },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, textAlign: 'center' },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  empty: { textAlign: 'center', color: Colors.textMuted, marginTop: Spacing.xl },
  row: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  invNumber: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  invClient: { fontSize: FontSize.md, color: Colors.text, marginTop: 2 },
  invDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  invAmount: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  badge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTxt: { fontSize: FontSize.xs, fontWeight: '600' },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', ...Shadow.md },

  // Monthly chart
  chartSection: { marginBottom: Spacing.md },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  chartTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  chartRow: { gap: 8, paddingHorizontal: 2, paddingBottom: 4 },
  chartBar: { alignItems: 'center', width: 44 },
  chartCount: { fontSize: 9, color: Colors.textMuted, marginBottom: 2 },
  barTrack: { width: 24, height: 64, justifyContent: 'flex-end', backgroundColor: Colors.border + '44', borderRadius: 4, overflow: 'hidden', position: 'relative' },
  barTotal: { width: '100%', backgroundColor: Colors.primary + '55', borderRadius: 4, position: 'absolute', bottom: 0 },
  barPaid: { width: '100%', backgroundColor: Colors.accent, borderRadius: 4, position: 'absolute', bottom: 0 },
  chartMonth: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
});
