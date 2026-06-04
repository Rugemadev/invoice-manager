import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import XLSX from 'xlsx';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, Shadow } from '../../constants/theme';
import { getInvoices, getSettings, formatCurrency } from '../../utils/storage';

const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

const PERIODS = [
  { key: '7d',    label: '7 Days' },
  { key: '30d',   label: '30 Days' },
  { key: '90d',   label: '3 Months' },
  { key: '180d',  label: '6 Months' },
  { key: 'ytd',   label: 'This Year' },
  { key: 'lyr',   label: 'Last Year' },
  { key: 'custom', label: 'Custom' },
];

function getPeriodRange(key) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (key) {
    case '7d':   return { from: new Date(+today - 6 * 86400000), to: now };
    case '30d':  return { from: new Date(+today - 29 * 86400000), to: now };
    case '90d':  return { from: new Date(+today - 89 * 86400000), to: now };
    case '180d': return { from: new Date(+today - 179 * 86400000), to: now };
    case 'ytd':  return { from: new Date(today.getFullYear(), 0, 1), to: now };
    case 'lyr': {
      const yr = today.getFullYear() - 1;
      return { from: new Date(yr, 0, 1), to: new Date(yr, 11, 31, 23, 59, 59) };
    }
    default: return null;
  }
}

function filterInvoices(invoices, period, customFrom, customTo) {
  let from, to;
  if (period === 'custom') {
    if (!customFrom || !customTo) return invoices.filter(i => !i.archived);
    from = new Date(customFrom);
    to   = new Date(customTo + 'T23:59:59');
    if (isNaN(from) || isNaN(to) || from > to) return [];
    const minDate = new Date(Date.now() - TWO_YEARS_MS);
    if (from < minDate) from = minDate;
  } else {
    const range = getPeriodRange(period);
    from = range.from;
    to   = range.to;
  }
  return invoices.filter(i => {
    if (i.archived) return false;
    const d = new Date(i.createdAt ?? i.date);
    return d >= from && d <= to;
  });
}

function computeStats(invoices) {
  return {
    count:         invoices.length,
    totalInvoiced: invoices.reduce((s, i) => s + (i.total || 0), 0),
    totalPaid:     invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0),
    outstanding:   invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + (i.total || 0), 0),
    countPaid:     invoices.filter(i => i.status === 'paid').length,
    countSent:     invoices.filter(i => i.status === 'sent').length,
    countOverdue:  invoices.filter(i => i.status === 'overdue').length,
    countDraft:    invoices.filter(i => i.status === 'draft').length,
  };
}

function clientBreakdown(invoices) {
  const map = {};
  invoices.forEach(inv => {
    const name = inv.to?.name?.trim() || 'Unknown';
    if (!map[name]) map[name] = { name, total: 0, paid: 0, count: 0 };
    map[name].total += inv.total || 0;
    if (inv.status === 'paid') map[name].paid += inv.total || 0;
    map[name].count++;
  });
  return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
}

export default function ReportsScreen() {
  const [period, setPeriod]         = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');
  const [allInvoices, setAllInvoices] = useState([]);
  const [currency, setCurrency]     = useState('RWF');
  const [loading, setLoading]       = useState(true);
  const [exporting, setExporting]   = useState(false);

  useFocusEffect(useCallback(() => {
    (async () => {
      setLoading(true);
      const [invoices, settings] = await Promise.all([getInvoices(), getSettings()]);
      setAllInvoices(invoices);
      setCurrency(settings.currency ?? 'RWF');
      setLoading(false);
    })();
  }, []));

  const filtered = filterInvoices(allInvoices, period, customFrom, customTo);
  const stats    = computeStats(filtered);
  const clients  = clientBreakdown(filtered);
  const periodLabel = period === 'custom'
    ? (customFrom && customTo ? `${customFrom} → ${customTo}` : 'Custom range')
    : PERIODS.find(p => p.key === period)?.label ?? '';

  const fmt = (n) => formatCurrency(n, currency);

  const exportExcel = async () => {
    if (filtered.length === 0) { Alert.alert('', 'No invoices in this period.'); return; }
    try {
      setExporting(true);
      const summaryWs = XLSX.utils.aoa_to_sheet([
        ['Invoice Report'],
        ['Period', periodLabel],
        ['Generated', new Date().toLocaleDateString()],
        [],
        ['Total Invoices', stats.count],
        ['Total Invoiced', stats.totalInvoiced],
        ['Total Paid', stats.totalPaid],
        ['Outstanding', stats.outstanding],
        [],
        ['Status Breakdown'],
        ['Paid',    stats.countPaid],
        ['Sent',    stats.countSent],
        ['Overdue', stats.countOverdue],
        ['Draft',   stats.countDraft],
      ]);

      const invHeaders = ['Number', 'Date', 'Due Date', 'Client', 'Type', 'Status', 'Currency', 'Subtotal', 'VAT', 'Total'];
      const invRows = filtered.map(i => [
        i.number ?? '', i.date ?? '', i.dueDate ?? '',
        i.to?.name ?? '',
        i.docTitle ?? (i.type === 'proforma' ? 'Proforma Invoice' : 'Invoice'),
        i.status ?? '', i.currency ?? currency,
        i.subtotal ?? 0, i.vatAmount ?? 0, i.total ?? 0,
      ]);
      const invoicesWs = XLSX.utils.aoa_to_sheet([invHeaders, ...invRows]);

      const clientHeaders = ['Client', 'Invoices', 'Total', 'Paid'];
      const clientRows = clients.map(c => [c.name, c.count, c.total, c.paid]);
      const clientsWs = XLSX.utils.aoa_to_sheet([clientHeaders, ...clientRows]);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, summaryWs,  'Summary');
      XLSX.utils.book_append_sheet(wb, invoicesWs, 'Invoices');
      XLSX.utils.book_append_sheet(wb, clientsWs,  'Clients');

      const base64  = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const fileUri = FileSystem.cacheDirectory + `Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: 'base64' });
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Export Excel Report',
      });
    } catch (e) {
      Alert.alert('Export Failed', e.message ?? 'Could not generate Excel file.');
    } finally {
      setExporting(false);
    }
  };

  const exportPDF = async () => {
    if (filtered.length === 0) { Alert.alert('', 'No invoices in this period.'); return; }
    try {
      setExporting(true);

      const clientRowsHtml = clients.map(c => `
        <tr>
          <td>${c.name}</td>
          <td style="text-align:center">${c.count}</td>
          <td style="text-align:right">${fmt(c.total)}</td>
          <td style="text-align:right">${fmt(c.paid)}</td>
        </tr>`).join('');

      const invRowsHtml = filtered.slice(0, 200).map(i => `
        <tr>
          <td>${i.number ?? ''}</td>
          <td>${i.date ?? ''}</td>
          <td>${i.to?.name ?? ''}</td>
          <td>${i.docTitle ?? (i.type === 'proforma' ? 'Proforma' : 'Invoice')}</td>
          <td>${i.status ?? ''}</td>
          <td style="text-align:right">${fmt(i.total ?? 0)}</td>
        </tr>`).join('');

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; color: #1E293B; padding: 28px; font-size: 13px; }
  h1   { color: #2563EB; font-size: 22px; margin: 0 0 4px; }
  .sub { color: #64748B; font-size: 12px; margin-bottom: 24px; }
  .cards { display: flex; gap: 12px; margin-bottom: 24px; }
  .card { flex: 1; background: #F8FAFC; border-radius: 8px; padding: 14px; border-top: 3px solid #2563EB; }
  .card.green { border-top-color: #10B981; }
  .card.amber { border-top-color: #F59E0B; }
  .clabel { font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .cval   { font-size: 17px; font-weight: 700; color: #1E293B; }
  .card.green .cval { color: #10B981; }
  .card.amber .cval { color: #F59E0B; }
  h2 { font-size: 15px; margin: 22px 0 8px; color: #1E293B; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #2563EB; color: #fff; padding: 7px 9px; text-align: left; }
  td { padding: 6px 9px; border-bottom: 1px solid #E2E8F0; }
  tr:nth-child(even) td { background: #F8FAFC; }
  .footer { margin-top: 32px; font-size: 10px; color: #94A3B8; text-align: center; }
</style></head><body>
<h1>Invoice Report</h1>
<div class="sub">Period: ${periodLabel} &nbsp;|&nbsp; Generated: ${new Date().toLocaleDateString()}</div>
<div class="cards">
  <div class="card">
    <div class="clabel">Total Invoiced</div>
    <div class="cval">${fmt(stats.totalInvoiced)}</div>
  </div>
  <div class="card green">
    <div class="clabel">Total Paid</div>
    <div class="cval">${fmt(stats.totalPaid)}</div>
  </div>
  <div class="card amber">
    <div class="clabel">Outstanding</div>
    <div class="cval">${fmt(stats.outstanding)}</div>
  </div>
  <div class="card">
    <div class="clabel">Invoices</div>
    <div class="cval">${stats.count}</div>
  </div>
</div>
<h2>Top Clients</h2>
<table><thead><tr>
  <th>Client</th><th style="text-align:center">Count</th>
  <th style="text-align:right">Total</th><th style="text-align:right">Paid</th>
</tr></thead><tbody>${clientRowsHtml}</tbody></table>
<h2>Invoices${filtered.length > 200 ? ' (first 200 shown)' : ''}</h2>
<table><thead><tr>
  <th>Number</th><th>Date</th><th>Client</th><th>Type</th><th>Status</th>
  <th style="text-align:right">Total</th>
</tr></thead><tbody>${invRowsHtml}</tbody></table>
<div class="footer">Generated by Invoice Manager</div>
</body></html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const destUri = FileSystem.cacheDirectory + `Report_${new Date().toISOString().split('T')[0]}.pdf`;
      await FileSystem.copyAsync({ from: uri, to: destUri });
      await Sharing.shareAsync(destUri, { mimeType: 'application/pdf', dialogTitle: 'Export PDF Report' });
    } catch (e) {
      Alert.alert('Export Failed', e.message ?? 'Could not generate PDF.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>

      {/* Period chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.chipsScroll}
        contentContainerStyle={s.chipsContent}
      >
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[s.chip, period === p.key && s.chipActive]}
            onPress={() => setPeriod(p.key)}
            activeOpacity={0.7}
          >
            <Text style={[s.chipTxt, period === p.key && s.chipTxtActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Custom date inputs */}
      {period === 'custom' && (
        <View style={s.customRange}>
          <View style={{ flex: 1 }}>
            <Text style={s.rangeLabel}>From</Text>
            <TextInput
              style={s.rangeInput}
              value={customFrom}
              onChangeText={setCustomFrom}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.rangeLabel}>To</Text>
            <TextInput
              style={s.rangeInput}
              value={customTo}
              onChangeText={setCustomTo}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>
      )}

      {/* Summary cards */}
      <View style={s.cards}>
        <View style={[s.card, { borderTopColor: Colors.primary }]}>
          <Text style={s.cardLabel}>Total Invoiced</Text>
          <Text style={[s.cardValue, { color: Colors.primary }]} numberOfLines={1} adjustsFontSizeToFit>{fmt(stats.totalInvoiced)}</Text>
          <Text style={s.cardSub}>{stats.count} invoice{stats.count !== 1 ? 's' : ''}</Text>
        </View>
        <View style={[s.card, { borderTopColor: Colors.accent }]}>
          <Text style={s.cardLabel}>Total Paid</Text>
          <Text style={[s.cardValue, { color: Colors.accent }]} numberOfLines={1} adjustsFontSizeToFit>{fmt(stats.totalPaid)}</Text>
          <Text style={s.cardSub}>{stats.countPaid} paid</Text>
        </View>
        <View style={[s.card, { borderTopColor: Colors.warning }]}>
          <Text style={s.cardLabel}>Outstanding</Text>
          <Text style={[s.cardValue, { color: Colors.warning }]} numberOfLines={1} adjustsFontSizeToFit>{fmt(stats.outstanding)}</Text>
          <Text style={s.cardSub}>{stats.countSent + stats.countOverdue} unpaid</Text>
        </View>
        <View style={[s.card, { borderTopColor: Colors.textMuted }]}>
          <Text style={s.cardLabel}>Draft</Text>
          <Text style={[s.cardValue, { color: Colors.textSecondary }]} numberOfLines={1} adjustsFontSizeToFit>{stats.countDraft}</Text>
          <Text style={s.cardSub}>not sent</Text>
        </View>
      </View>

      {/* Empty state */}
      {filtered.length === 0 && (
        <View style={s.empty}>
          <Ionicons name="bar-chart-outline" size={52} color={Colors.textMuted} />
          <Text style={s.emptyTitle}>No invoices in this period</Text>
          <Text style={s.emptySub}>Try a different date range</Text>
        </View>
      )}

      {/* Top clients */}
      {clients.length > 0 && (
        <View style={[s.section, Shadow.sm]}>
          <Text style={s.sectionTitle}>Top Clients</Text>
          {clients.map((c, i) => {
            const pct = stats.totalInvoiced > 0 ? (c.total / stats.totalInvoiced) * 100 : 0;
            return (
              <View key={c.name} style={s.clientRow}>
                <View style={s.rank}>
                  <Text style={s.rankTxt}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.clientTop}>
                    <Text style={s.clientName} numberOfLines={1}>{c.name}</Text>
                    <Text style={s.clientTotal}>{fmt(c.total)}</Text>
                  </View>
                  <View style={s.bar}>
                    <View style={[s.barFill, { width: `${Math.min(pct, 100)}%` }]} />
                  </View>
                  <Text style={s.clientSub}>
                    {c.count} invoice{c.count !== 1 ? 's' : ''} · {fmt(c.paid)} paid
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Status breakdown */}
      {filtered.length > 0 && (
        <View style={[s.section, Shadow.sm]}>
          <Text style={s.sectionTitle}>By Status</Text>
          {[
            { label: 'Paid',    count: stats.countPaid,    color: Colors.accent },
            { label: 'Sent',    count: stats.countSent,    color: Colors.warning },
            { label: 'Overdue', count: stats.countOverdue, color: Colors.danger },
            { label: 'Draft',   count: stats.countDraft,   color: Colors.textMuted },
          ].map(({ label, count, color }) => (
            <View key={label} style={s.statusRow}>
              <View style={[s.statusDot, { backgroundColor: color }]} />
              <Text style={s.statusLabel}>{label}</Text>
              <Text style={s.statusCount}>{count}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Export buttons */}
      <View style={s.exportRow}>
        <TouchableOpacity
          style={[s.exportBtn, { backgroundColor: '#1D6B38' }, (exporting || filtered.length === 0) && s.exportDisabled]}
          onPress={exportExcel}
          disabled={exporting || filtered.length === 0}
          activeOpacity={0.85}
        >
          <Ionicons name="grid-outline" size={20} color="#fff" />
          <Text style={s.exportBtnTxt}>Export Excel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.exportBtn, { backgroundColor: Colors.danger }, (exporting || filtered.length === 0) && s.exportDisabled]}
          onPress={exportPDF}
          disabled={exporting || filtered.length === 0}
          activeOpacity={0.85}
        >
          <Ionicons name="document-text-outline" size={20} color="#fff" />
          <Text style={s.exportBtnTxt}>Export PDF</Text>
        </TouchableOpacity>
      </View>

      {exporting && (
        <View style={s.exportingRow}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={s.exportingTxt}>Preparing export…</Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content:   { padding: Spacing.md },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  chipsScroll:   { marginHorizontal: -Spacing.md, marginBottom: Spacing.md },
  chipsContent:  { paddingHorizontal: Spacing.md, gap: Spacing.sm, flexDirection: 'row' },
  chip:          { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  chipActive:    { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt:       { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  chipTxtActive: { color: '#fff' },

  customRange: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  rangeLabel:  { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  rangeInput:  { backgroundColor: Colors.surface, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.md, color: Colors.text },

  cards:     { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  card:      { flex: 1, minWidth: '45%', backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, borderTopWidth: 3, ...Shadow.sm },
  cardLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  cardValue: { fontSize: FontSize.xl, fontWeight: '800', marginBottom: 2 },
  cardSub:   { fontSize: FontSize.xs, color: Colors.textMuted },

  empty:      { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textSecondary },
  emptySub:   { fontSize: FontSize.sm, color: Colors.textMuted },

  section:      { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },

  clientRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  rank:      { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  rankTxt:   { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  clientTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  clientName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, flex: 1, marginRight: 8 },
  clientTotal:{ fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  bar:     { height: 4, backgroundColor: Colors.borderLight, borderRadius: 2, marginBottom: 4 },
  barFill: { height: 4, borderRadius: 2, backgroundColor: Colors.primary },
  clientSub: { fontSize: FontSize.xs, color: Colors.textMuted },

  statusRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  statusDot:   { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { flex: 1, fontSize: FontSize.md, color: Colors.text },
  statusCount: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },

  exportRow:      { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  exportBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.md, paddingVertical: Spacing.md, ...Shadow.sm },
  exportDisabled: { opacity: 0.45 },
  exportBtnTxt:   { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
  exportingRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: Spacing.md },
  exportingTxt:   { fontSize: FontSize.sm, color: Colors.textSecondary },
});
