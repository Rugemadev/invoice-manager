import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, Modal, TextInput, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, Shadow } from '../../constants/theme';
import { getTemplate } from '../../constants/templates';
import { getInvoices, saveInvoice, deleteInvoice, archiveInvoice, getSettings, getBusinessLogo, addPaymentLog, updatePaymentLog, getInvoicePaymentLogs } from '../../utils/storage';
import { formatCurrency, formatDate, shareInvoice, printInvoice, buildInvoiceHTML } from '../../utils/invoice';
import Confetti from '../../components/Confetti';
import { playChime } from '../../utils/sound';

const STATUS_COLOR = {
  draft: Colors.textMuted,
  sent: Colors.warning,
  paid: Colors.accent,
  overdue: Colors.danger,
};

const LOG_STATUS_COLOR = {
  SUCCESSFUL: '#059669',
  PENDING:    '#D97706',
  FAILED:     '#DC2626',
  TIMEOUT:    '#6B7280',
  ERROR:      '#DC2626',
};
const LOG_STATUS_BG = {
  SUCCESSFUL: '#D1FAE5',
  PENDING:    '#FEF3C7',
  FAILED:     '#FEE2E2',
  TIMEOUT:    '#F3F4F6',
  ERROR:      '#FEE2E2',
};

const PAYMENT_METHODS = [
  { key: 'mtn',    label: 'MTN Mobile Money',   icon: 'phone-portrait-outline', color: '#FFCC00', bg: '#FFFBEB', text: Colors.text },
  { key: 'airtel', label: 'Airtel Money',        icon: 'phone-portrait-outline', color: '#E51A22', bg: '#FEF2F2', text: '#E51A22' },
  { key: 'cheque', label: 'Bank Cheque',          icon: 'document-text-outline',  color: '#2563EB', bg: '#EFF6FF', text: '#2563EB' },
  { key: 'cash',   label: 'Cash Payment',         icon: 'cash-outline',            color: '#059669', bg: '#ECFDF5', text: '#059669' },
];

const CAL_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ReminderModal({ visible, onClose, clientName }) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const [selDate, setSelDate]   = useState(tomorrow);
  const [calMonth, setCalMonth] = useState(new Date(tomorrow.getFullYear(), tomorrow.getMonth(), 1));
  const [hour, setHour]         = useState(9);
  const [minute, setMinute]     = useState(0);
  const [loading, setLoading]   = useState(false);

  const yr  = calMonth.getFullYear();
  const mo  = calMonth.getMonth();
  const firstDow    = new Date(yr, mo, 1).getDay();
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();

  const rows = [];
  const flat = [];
  for (let i = 0; i < firstDow; i++) flat.push(null);
  for (let d = 1; d <= daysInMonth; d++) flat.push(d);
  while (flat.length % 7 !== 0) flat.push(null);
  for (let i = 0; i < flat.length; i += 7) rows.push(flat.slice(i, i + 7));

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const isSelected = (d) => d && selDate.getFullYear() === yr && selDate.getMonth() === mo && selDate.getDate() === d;
  const isPast     = (d) => d && new Date(yr, mo, d) < today;

  const selectDay = (d) => {
    if (!d || isPast(d)) return;
    setSelDate(new Date(yr, mo, d));
  };

  const prevMonth = () => {
    const prev = new Date(yr, mo - 1, 1);
    const cur  = new Date(); cur.setDate(1); cur.setHours(0, 0, 0, 0);
    if (prev >= cur) setCalMonth(prev);
  };
  const nextMonth = () => setCalMonth(new Date(yr, mo + 1, 1));

  const monthLabel = calMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const adjustHour   = (delta) => setHour(h   => (h   + delta + 24) % 24);
  const adjustMinute = (delta) => setMinute(m  => (m   + delta + 60) % 60);

  const handleSet = async () => {
    const dateTime = new Date(selDate);
    dateTime.setHours(hour, minute, 0, 0);
    if (dateTime <= new Date()) { Alert.alert('', 'Please choose a future date and time.'); return; }
    setLoading(true);
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') { Alert.alert('', 'Please enable notifications in device settings.'); setLoading(false); return; }
      const secondsFromNow = Math.floor((dateTime.getTime() - Date.now()) / 1000);
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Invoice Reminder', body: `Follow up on payment from ${clientName}`, sound: true },
        trigger: { type: 'timeInterval', seconds: secondsFromNow },
      });
      const dateStr = selDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      Alert.alert('✓ Reminder set', `${dateStr} at ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`);
      onClose();
    } catch (e) {
      Alert.alert('Error', e.message ?? 'Could not set reminder.');
    }
    setLoading(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={reminderModal.container} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View style={reminderModal.handle} />
        <Text style={reminderModal.title}>Set Reminder</Text>
        <Text style={reminderModal.sub}>Choose when to follow up on payment from {clientName}.</Text>

        {/* Calendar */}
        <View style={reminderModal.calCard}>
          <View style={reminderModal.calHeader}>
            <TouchableOpacity onPress={prevMonth} style={reminderModal.navBtn}>
              <Ionicons name="chevron-back" size={20} color={Colors.text} />
            </TouchableOpacity>
            <Text style={reminderModal.monthLabel}>{monthLabel}</Text>
            <TouchableOpacity onPress={nextMonth} style={reminderModal.navBtn}>
              <Ionicons name="chevron-forward" size={20} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <View style={reminderModal.weekRow}>
            {CAL_WEEKDAYS.map(d => (
              <Text key={d} style={reminderModal.weekDay}>{d}</Text>
            ))}
          </View>

          {rows.map((row, ri) => (
            <View key={ri} style={reminderModal.dayRow}>
              {row.map((d, ci) => {
                const past = isPast(d);
                const sel  = isSelected(d);
                return (
                  <TouchableOpacity
                    key={ci}
                    style={[reminderModal.dayCell, sel && { backgroundColor: Colors.primary }]}
                    onPress={() => selectDay(d)}
                    disabled={!d || past}
                    activeOpacity={d && !past ? 0.7 : 1}
                  >
                    <Text style={[
                      reminderModal.dayTxt,
                      past && reminderModal.dayPast,
                      sel  && reminderModal.daySelTxt,
                    ]}>
                      {d ?? ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* Time picker */}
        <View style={reminderModal.timeCard}>
          <Text style={reminderModal.timeTitle}>Time</Text>
          <View style={reminderModal.timeRow}>
            {/* Hour */}
            <View style={reminderModal.timeUnit}>
              <TouchableOpacity onPress={() => adjustHour(1)}  style={reminderModal.timeBtn}>
                <Ionicons name="chevron-up"   size={22} color={Colors.primary} />
              </TouchableOpacity>
              <View style={reminderModal.timeDigitBox}>
                <Text style={reminderModal.timeDigit}>{String(hour).padStart(2,'0')}</Text>
              </View>
              <TouchableOpacity onPress={() => adjustHour(-1)} style={reminderModal.timeBtn}>
                <Ionicons name="chevron-down" size={22} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={reminderModal.timeSep}>:</Text>
            {/* Minute (15-min steps) */}
            <View style={reminderModal.timeUnit}>
              <TouchableOpacity onPress={() => adjustMinute(15)}  style={reminderModal.timeBtn}>
                <Ionicons name="chevron-up"   size={22} color={Colors.primary} />
              </TouchableOpacity>
              <View style={reminderModal.timeDigitBox}>
                <Text style={reminderModal.timeDigit}>{String(minute).padStart(2,'0')}</Text>
              </View>
              <TouchableOpacity onPress={() => adjustMinute(-15)} style={reminderModal.timeBtn}>
                <Ionicons name="chevron-down" size={22} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TouchableOpacity style={[reminderModal.setBtn, { backgroundColor: Colors.accent }, loading && { opacity: 0.5 }]} onPress={handleSet} disabled={loading} activeOpacity={0.85}>
          <Ionicons name="alarm-outline" size={20} color="#fff" />
          <Text style={reminderModal.setBtnTxt}>{loading ? 'Setting…' : 'Set Reminder'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={reminderModal.cancelBtn} onPress={onClose}>
          <Text style={reminderModal.cancelTxt}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  );
}

function PaymentModal({ visible, invoice, settings, onClose, onPaid }) {
  const { t } = useTranslation();
  const [method, setMethod]     = useState(null);
  const [phone, setPhone]       = useState('');
  const [step, setStep]         = useState('select');
  const [attempt, setAttempt]   = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [refId, setRefId]       = useState(null);
  const logIdRef                = useRef(null);

  useEffect(() => {
    if (visible) {
      setMethod(null);
      setPhone(invoice?.to?.phone ?? '');
      setStep('select');
      setAttempt(0);
      setStatusMsg('');
      setRefId(null);
      logIdRef.current = null;
    }
  }, [visible]);

  const handlePay = async () => {
    if (method === 'momo') {
      if (!phone.trim()) { Alert.alert('', 'Enter the client\'s MoMo phone number'); return; }
      setStep('waiting');
      setStatusMsg('Sending payment request…');

      // Create a pending log entry before hitting the API
      const logId = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      logIdRef.current = logId;
      await addPaymentLog({
        id:            logId,
        invoiceId:     invoice.id,
        invoiceNumber: invoice.number,
        referenceId:   null,
        amount:        invoice.total,
        currency:      invoice.currency ?? 'RWF',
        phone:         phone.trim(),
        method:        'mtn',
        status:        'PENDING',
        initiatedAt:   new Date().toISOString(),
        resolvedAt:    null,
        errorMessage:  null,
      });

      try {
        const { requestMoMoPayment, pollMoMoStatus } = await import('../../utils/momo');
        const { referenceId } = await requestMoMoPayment({
          amount:        invoice.total,
          currency:      invoice.currency ?? 'RWF',
          phone:         phone.trim(),
          invoiceId:     invoice.id,
          invoiceNumber: invoice.number,
        });

        setRefId(referenceId);
        await updatePaymentLog(logId, { referenceId });
        setStatusMsg('USSD prompt sent — waiting for client to approve…');

        const result = await pollMoMoStatus(referenceId, {
          onUpdate: (status, att) => {
            setAttempt(att);
            setStatusMsg(`Checking payment status… (${att}/12)`);
          },
          maxAttempts: 12,
          intervalMs:  5000,
        });

        const finalStatus = result === 'SUCCESSFUL' ? 'SUCCESSFUL'
          : result === 'FAILED' ? 'FAILED' : 'TIMEOUT';
        await updatePaymentLog(logId, { status: finalStatus, resolvedAt: new Date().toISOString() });

        setStep(finalStatus === 'SUCCESSFUL' ? 'success' : finalStatus === 'FAILED' ? 'failed' : 'timeout');
        if (finalStatus === 'SUCCESSFUL') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => onPaid?.('mtn', referenceId), 1400);
        }
      } catch (e) {
        const msg = e.message ?? 'Could not initiate payment.';
        await updatePaymentLog(logId, { status: 'ERROR', resolvedAt: new Date().toISOString(), errorMessage: msg });
        Alert.alert('Error', msg);
        setStep('select');
      }
    } else {
      setStep('waiting');
      await new Promise(r => setTimeout(r, 2000));
      setStep('success');
      setTimeout(() => onPaid?.('card', null), 1400);
    }
  };

  const renderBody = () => {
    if (step === 'waiting') return (
      <View style={modal.centered}>
        <ActivityIndicator size="large" color={Colors.mtn} style={{ marginBottom: 16 }} />
        <Text style={modal.waitTitle}>
          {method === 'momo' ? 'Waiting for approval…' : 'Processing…'}
        </Text>
        {method === 'momo' && (
          <>
            <Text style={modal.waitSub}>{statusMsg}</Text>
            {attempt > 0 && (
              <View style={modal.dotsRow}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <View key={i} style={[modal.dot, i < attempt && modal.dotFilled]} />
                ))}
              </View>
            )}
          </>
        )}
      </View>
    );

    if (step === 'success') return (
      <View style={modal.centered}>
        <Ionicons name="checkmark-circle" size={72} color={Colors.accent} />
        <Text style={modal.successTxt}>Payment Received!</Text>
        {refId && (
          <View style={modal.refBox}>
            <Text style={modal.refLabel}>Reference ID</Text>
            <Text style={modal.refValue}>{refId.slice(0, 8).toUpperCase()}…{refId.slice(-4).toUpperCase()}</Text>
          </View>
        )}
      </View>
    );

    if (step === 'failed' || step === 'timeout') return (
      <View style={modal.centered}>
        <Ionicons name="close-circle" size={72} color={Colors.danger} />
        <Text style={modal.failedTxt}>{step === 'timeout' ? 'Payment timed out' : 'Payment was declined'}</Text>
        <TouchableOpacity style={modal.retryBtn} onPress={() => { setStep('select'); setAttempt(0); }}>
          <Text style={modal.retryTxt}>Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={modal.cancelBtn} onPress={onClose}>
          <Text style={modal.cancelTxt}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </View>
    );

    return (
      <>
        <TouchableOpacity style={[modal.method, method === 'momo' && modal.active]} onPress={() => setMethod('momo')} activeOpacity={0.7}>
          <View style={[modal.icon, { backgroundColor: Colors.mtn }]}><Text style={modal.iconTxt}>M</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={modal.mTitle}>{t('payment.mtnMomo')}</Text>
            <Text style={modal.mSub}>Send USSD prompt to client's phone</Text>
          </View>
          {method === 'momo' && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
        </TouchableOpacity>

        {method === 'momo' && (
          <View style={modal.phoneField}>
            <Text style={modal.phoneLabel}>Client's MoMo number</Text>
            <TextInput
              style={modal.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. 0788 123 456"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>
        )}

        <TouchableOpacity style={[modal.payBtn, !method && { opacity: 0.4 }]} onPress={handlePay} disabled={!method} activeOpacity={0.85}>
          <Text style={modal.payBtnTxt}>{t('payment.payNow')} — {formatCurrency(invoice?.total ?? 0, invoice?.currency)}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={modal.cancelBtn} onPress={onClose}>
          <Text style={modal.cancelTxt}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={step === 'waiting' ? undefined : onClose}>
      <View style={modal.container}>
        <View style={modal.handle} />
        <Text style={modal.title}>{t('payment.chooseMethod')}</Text>
        <Text style={modal.amount}>{formatCurrency(invoice?.total ?? 0, invoice?.currency)}</Text>
        {renderBody()}
      </View>
    </Modal>
  );
}

export default function InvoiceDetail() {
  const { t } = useTranslation();
  const { id, new: isNew, paid: justPaid } = useLocalSearchParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState(null);
  const [settings, setSettings] = useState({});
  const [logoUri, setLogoUri] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showPaidMethodPicker, setShowPaidMethodPicker] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState(null);
  const [previewHtmlLoading, setPreviewHtmlLoading] = useState(false);
  const [previewWebLoading, setPreviewWebLoading] = useState(true);
  const [showReminder, setShowReminder] = useState(false);
  const [paymentLogs, setPaymentLogs] = useState([]);
  const hasPlayedRef = useRef(false);

  const load = useCallback(async () => {
    const [invoices, s, logoData, logs] = await Promise.all([
      getInvoices(), getSettings(), getBusinessLogo(), getInvoicePaymentLogs(id),
    ]);
    const inv = invoices.find(i => i.id === id);
    setInvoice(inv ?? null);
    setSettings(s);
    setLogoUri(logoData);
    setPaymentLogs(logs);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if ((isNew === '1' || justPaid === '1') && !hasPlayedRef.current) {
      hasPlayedRef.current = true;
      const t = setTimeout(async () => {
        setShowConfetti(true);
        await playChime();
      }, 300);
      return () => clearTimeout(t);
    }
  }, [isNew, justPaid]);

  // Must be above the early return — hooks cannot be called conditionally
  const handleShare = useCallback(async () => {
    if (!invoice) return;
    setPreviewHtml(null);
    setPreviewHtmlLoading(true);
    setPreviewWebLoading(true);
    setShowPreview(true);
    try {
      const result = await buildInvoiceHTML(invoice);
      setPreviewHtml(result);
    } catch {}
    setPreviewHtmlLoading(false);
  }, [invoice]);

  if (!invoice) return null;

  const tpl = getTemplate(invoice.templateId);
  const primary = tpl?.primaryColor ?? Colors.primary;
  const currency = invoice.currency ?? 'RWF';
  const isProforma = invoice.type === 'proforma';

  const doShare = async () => {
    setShowPreview(false);
    await new Promise(r => setTimeout(r, 400));
    try {
      await saveInvoice({ ...invoice, status: invoice.status === 'draft' ? 'sent' : invoice.status });
      await shareInvoice(invoice);
      await load();
    } catch (e) {
      Alert.alert('', 'Could not share. Please try again.');
    }
  };

  const confirmPaid = async (method, momoReference = null) => {
    setShowPaidMethodPicker(false);
    const updated = {
      ...invoice,
      status: 'paid',
      paymentMethod: method.key,
      paymentMethodLabel: method.label,
      paidAt: new Date().toISOString(),
      ...(momoReference && { momoReference }),
    };
    await saveInvoice(updated);
    setInvoice(updated);
    // Reload logs so the history section reflects the new SUCCESSFUL entry
    setPaymentLogs(await getInvoicePaymentLogs(id));
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowConfetti(true);
    await playChime();
  };

  const handleDelete = () => {
    Alert.alert('Delete Invoice', `Permanently delete ${invoice.number}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteInvoice(invoice.id);
          router.replace('/(tabs)/invoices');
        }
      },
    ]);
  };

  const handleArchive = async () => {
    await archiveInvoice(invoice.id);
    Alert.alert('', invoice.archived ? '✓ Invoice restored.' : '✓ Invoice archived.');
    router.replace('/(tabs)/invoices');
  };

  const docTitle = invoice.docTitle || (isProforma ? 'PROFORMA INVOICE' : 'INVOICE');

  const headerTextColor = tpl?.headerText ?? '#fff';

  return (
    <>
      <Stack.Screen options={{
        title: invoice.number,
        headerStyle: { backgroundColor: primary },
        headerTintColor: headerTextColor,
        headerBackTitle: '',
        headerRight: () => (
          <TouchableOpacity
            onPress={() => router.push(
              `/invoice/create?editId=${invoice.id}&templateId=${invoice.templateId}&type=${invoice.type}&docTitle=${encodeURIComponent(invoice.docTitle ?? (isProforma ? 'Proforma Invoice' : 'Invoice'))}`
            )}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginRight: 4 }}
          >
            <Ionicons name="create-outline" size={22} color={headerTextColor} />
          </TouchableOpacity>
        ),
      }} />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Header card */}
        <View style={[styles.card, Shadow.sm, { borderTopColor: primary, borderTopWidth: 3 }]}>
          <View style={styles.cardTop}>
            {logoUri ? <Image source={{ uri: logoUri }} style={styles.logo} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={[styles.docType, { color: primary }]}>{docTitle.toUpperCase()}</Text>
              <Text style={styles.number}>{invoice.number}</Text>
              <Text style={styles.meta}>{formatDate(invoice.createdAt)}</Text>
              {invoice.dueDate ? <Text style={styles.meta}>Due: {formatDate(invoice.dueDate)}</Text> : null}
              <View style={[styles.badge, { backgroundColor: STATUS_COLOR[invoice.status] + '22' }]}>
                <Text style={[styles.badgeText, { color: STATUS_COLOR[invoice.status] }]}>
                  {t(`invoice.status.${invoice.status}`)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.parties}>
            <View style={styles.party}>
              <Text style={[styles.partyLabel, { color: primary }]}>{t('invoice.from')}</Text>
              <Text style={styles.partyName}>{invoice.from?.name}</Text>
              <Text style={styles.partySub}>{invoice.from?.address}</Text>
              {invoice.from?.tin ? <Text style={styles.partySub}>TIN: {invoice.from.tin}</Text> : null}
            </View>
            <View style={[styles.party, { alignItems: 'flex-end' }]}>
              <Text style={[styles.partyLabel, { color: primary }]}>{t('invoice.to')}</Text>
              <Text style={styles.partyName}>{invoice.to?.name}</Text>
              <Text style={[styles.partySub, { textAlign: 'right' }]}>{invoice.to?.address}</Text>
              {invoice.to?.tin ? <Text style={styles.partySub}>TIN: {invoice.to.tin}</Text> : null}
            </View>
          </View>
        </View>

        {/* Items table */}
        <View style={[styles.card, Shadow.sm]}>
          {(() => {
            const ch = invoice.colHeaders ?? {};
            const descLabel  = ch.desc  || 'Description';
            const qtyLabel   = ch.qty   || 'Qty';
            const priceLabel = ch.price || 'Price';
            const extraLabel = ch.extraLabel || '';
            const hasExtra   = !!extraLabel;
            return (
              <>
                <View style={styles.tableHead}>
                  <Text style={[styles.col, { flex: 3 }]}>{descLabel}</Text>
                  {hasExtra && <Text style={[styles.col, { flex: 2 }]}>{extraLabel}</Text>}
                  <Text style={[styles.col, { flex: 1, textAlign: 'center' }]}>{qtyLabel}</Text>
                  <Text style={[styles.col, { flex: 2, textAlign: 'right' }]}>{priceLabel}</Text>
                  <Text style={[styles.col, { flex: 2, textAlign: 'right' }]}>Total</Text>
                </View>
                {invoice.items?.map(item => {
                  if (item.type === 'section') {
                    return (
                      <View key={item.id} style={[styles.sectionRow, { borderLeftColor: primary }]}>
                        <Text style={[styles.sectionRowText, { color: primary }]}>{item.description}</Text>
                      </View>
                    );
                  }
                  return (
                    <View key={item.id} style={styles.tableRow}>
                      <Text style={[styles.cell, { flex: 3 }]}>{item.description}</Text>
                      {hasExtra && <Text style={[styles.cell, { flex: 2 }]}>{item.extra ?? ''}</Text>}
                      <Text style={[styles.cell, { flex: 1, textAlign: 'center' }]}>
                        {parseFloat(item.qty) % 1 === 0 ? parseInt(item.qty, 10) : parseFloat(item.qty) || item.qty}
                      </Text>
                      <Text style={[styles.cell, { flex: 2, textAlign: 'right' }]}>{formatCurrency(item.unitPrice, currency)}</Text>
                      <Text style={[styles.cell, { flex: 2, textAlign: 'right' }]}>{formatCurrency(parseFloat(item.qty||0)*parseFloat(item.unitPrice||0), currency)}</Text>
                    </View>
                  );
                })}
              </>
            );
          })()}
        </View>

        {/* Totals */}
        <View style={[styles.card, Shadow.sm]}>
          <View style={styles.totalRow}><Text style={styles.totalLbl}>Subtotal</Text><Text style={styles.totalVal}>{formatCurrency(invoice.subtotal, currency)}</Text></View>
          <View style={styles.totalRow}><Text style={styles.totalLbl}>VAT ({invoice.vatRate}%)</Text><Text style={styles.totalVal}>{formatCurrency(invoice.vatAmount, currency)}</Text></View>
          <View style={[styles.totalRow, { borderTopWidth: 2, borderTopColor: primary, marginTop: 6, paddingTop: 10 }]}>
            <Text style={[styles.totalLbl, { fontWeight: '700', fontSize: FontSize.lg, color: primary }]}>TOTAL</Text>
            <Text style={[styles.totalVal, { fontWeight: '700', fontSize: FontSize.lg, color: primary }]}>{formatCurrency(invoice.total, currency)}</Text>
          </View>
        </View>

        {invoice.notes ? (
          <View style={[styles.card, Shadow.sm]}>
            <Text style={styles.notesLbl}>Notes</Text>
            <Text style={styles.notesTxt}>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* Actions grid (2×2) */}
        <View style={{ gap: Spacing.sm, marginBottom: 0 }}>
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: tpl.lightColor }]} onPress={handleShare} activeOpacity={0.7}>
              <Ionicons name="share-outline" size={20} color={primary} />
              <Text style={[styles.actionTxt, { color: primary }]}>{t('invoice.sharePdf')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: tpl.lightColor }]} onPress={() => router.push(`/invoice/pdf-preview?id=${invoice.id}`)} activeOpacity={0.7}>
              <Ionicons name="eye-outline" size={20} color={primary} />
              <Text style={[styles.actionTxt, { color: primary }]}>Preview PDF</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: tpl.lightColor }]} onPress={() => printInvoice(invoice)} activeOpacity={0.7}>
              <Ionicons name="print-outline" size={20} color={primary} />
              <Text style={[styles.actionTxt, { color: primary }]}>{t('invoice.print')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.accentLight }]} onPress={() => setShowReminder(true)} activeOpacity={0.7}>
              <Ionicons name="alarm-outline" size={20} color={Colors.accent} />
              <Text style={[styles.actionTxt, { color: Colors.accent }]}>{t('invoice.remind')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {invoice.status !== 'paid' && (
          <TouchableOpacity style={[styles.paidBtn, { borderColor: Colors.accent }]} onPress={() => setShowPaidMethodPicker(true)} activeOpacity={0.85}>
            <Ionicons name="checkmark-circle-outline" size={20} color={Colors.accent} />
            <Text style={[styles.paidBtnTxt, { color: Colors.accent }]}>{t('invoice.markAsPaid')}</Text>
          </TouchableOpacity>
        )}
        {/* MoMo receive payment — temporarily hidden. PaymentModal component is preserved below for easy restoration.
        {invoice.status !== 'paid' && (
          <TouchableOpacity style={[styles.payBtn, { backgroundColor: Colors.mtn }]} onPress={() => setShowPayment(true)} activeOpacity={0.85}>
            <Ionicons name="phone-portrait-outline" size={20} color={Colors.text} />
            <Text style={styles.payBtnTxt}>{t('invoice.receivePayment')}</Text>
          </TouchableOpacity>
        )}
        */}

        {invoice.status === 'paid' && (
          <View style={styles.paidBanner}>
            <Ionicons name="checkmark-circle" size={28} color={Colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.paidBannerTxt}>{t('invoice.paymentReceived')}</Text>
              {invoice.paymentMethodLabel ? (
                <Text style={{ fontSize: FontSize.xs, color: Colors.accent }}>{invoice.paymentMethodLabel}</Text>
              ) : null}
              {invoice.momoReference ? (
                <Text style={styles.paidRef}>Ref: {invoice.momoReference.slice(0, 8).toUpperCase()}…{invoice.momoReference.slice(-4).toUpperCase()}</Text>
              ) : null}
              {invoice.paidAt ? (
                <Text style={styles.paidAt}>{new Date(invoice.paidAt).toLocaleString()}</Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Payment History */}
        {paymentLogs.length > 0 && (
          <View style={[styles.card, Shadow.sm]}>
            <Text style={styles.logsTitle}>Payment History</Text>
            {paymentLogs.map((log, i) => (
              <View key={log.id} style={[styles.logRow, i > 0 && { borderTopWidth: 1, borderTopColor: Colors.borderLight }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.logDate}>{new Date(log.initiatedAt).toLocaleString()}</Text>
                  <Text style={styles.logDetail}>{log.phone} · {formatCurrency(log.amount, log.currency)}</Text>
                  {log.referenceId ? (
                    <Text style={styles.logRef}>Ref: {log.referenceId.slice(0, 8).toUpperCase()}…{log.referenceId.slice(-4).toUpperCase()}</Text>
                  ) : null}
                </View>
                <View style={[styles.logBadge, { backgroundColor: LOG_STATUS_BG[log.status] }]}>
                  <Text style={[styles.logBadgeTxt, { color: LOG_STATUS_COLOR[log.status] }]}>{log.status}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Delete + Archive */}
        <View style={styles.dangerRow}>
          <TouchableOpacity style={styles.archiveBtn} onPress={handleArchive} activeOpacity={0.7}>
            <Ionicons name={invoice.archived ? 'arrow-undo-outline' : 'archive-outline'} size={16} color={Colors.textSecondary} />
            <Text style={styles.archiveTxt}>{invoice.archived ? 'Restore' : 'Archive'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
            <Text style={styles.deleteTxt}>Delete</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Payment method picker */}
      <Modal visible={showPaidMethodPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPaidMethodPicker(false)}>
        <View style={paidModal.container}>
          <View style={paidModal.handle} />
          <Text style={paidModal.title}>How was this invoice paid?</Text>
          {PAYMENT_METHODS.map(m => (
            <TouchableOpacity key={m.key} style={[paidModal.method, { backgroundColor: m.bg, borderColor: m.color + '40' }]} onPress={() => confirmPaid(m)} activeOpacity={0.7}>
              <View style={[paidModal.iconWrap, { backgroundColor: m.color + '20' }]}>
                <Ionicons name={m.icon} size={22} color={m.color} />
              </View>
              <Text style={[paidModal.methodLabel, { color: m.text }]}>{m.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={m.color} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={paidModal.cancelBtn} onPress={() => setShowPaidMethodPicker(false)}>
            <Text style={paidModal.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* PDF preview before sharing */}
      <Modal visible={showPreview} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPreview(false)}>
        <SafeAreaView style={previewModal.container}>
          <View style={previewModal.header}>
            <View style={{ flex: 1 }}>
              <Text style={previewModal.heading}>PDF Preview</Text>
              <Text style={previewModal.headingSub}>{invoice.number} · {invoice.to?.name ?? ''}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowPreview(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={previewModal.webWrap}>
            {(previewHtmlLoading || previewWebLoading) && (
              <View style={previewModal.loader}>
                <ActivityIndicator size="large" color={primary} />
                <Text style={previewModal.loaderTxt}>Building preview…</Text>
              </View>
            )}
            {previewHtml ? (
              <WebView
                source={{ html: previewHtml }}
                style={[previewModal.web, previewWebLoading && { opacity: 0 }]}
                scrollEnabled
                scalesPageToFit={true}
                onLoadEnd={() => setPreviewWebLoading(false)}
              />
            ) : null}
          </View>

          <View style={[previewModal.footer, { borderTopColor: Colors.border }]}>
            <TouchableOpacity style={[previewModal.shareBtn, { backgroundColor: primary }]} onPress={doShare} activeOpacity={0.85}>
              <Ionicons name="share-outline" size={20} color="#fff" />
              <Text style={previewModal.shareBtnTxt}>Share / Send PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={previewModal.cancelBtn} onPress={() => setShowPreview(false)}>
              <Text style={previewModal.cancelBtnTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      <Confetti visible={showConfetti} onDone={() => setShowConfetti(false)} />

      <ReminderModal
        visible={showReminder}
        onClose={() => setShowReminder(false)}
        clientName={invoice.to?.name ?? 'client'}
      />

      <PaymentModal
        visible={showPayment}
        invoice={invoice}
        settings={settings}
        onClose={() => setShowPayment(false)}
        onPaid={(methodKey, momoReference) => {
          setShowPayment(false);
          const pm = PAYMENT_METHODS.find(m => m.key === methodKey) ?? PAYMENT_METHODS.find(m => m.key === 'mtn');
          confirmPaid(pm, momoReference);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.sm },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md },
  cardTop: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  logo: { width: 70, height: 52, borderRadius: Radius.sm, resizeMode: 'contain' },
  docType: { fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  number: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  meta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  badge: { alignSelf: 'flex-start', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  badgeText: { fontSize: FontSize.xs, fontWeight: '700' },
  parties: { flexDirection: 'row', justifyContent: 'space-between' },
  party: { flex: 1 },
  partyLabel: { fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  partyName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  partySub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  tableHead: { flexDirection: 'row', paddingBottom: Spacing.sm, borderBottomWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm },
  col: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderColor: Colors.borderLight },
  cell: { fontSize: FontSize.sm, color: Colors.text },
  sectionRow: { paddingVertical: 8, borderBottomWidth: 1, borderColor: Colors.borderLight, borderLeftWidth: 3, paddingLeft: Spacing.sm, marginVertical: 2 },
  sectionRowText: { fontSize: FontSize.sm, fontWeight: '700' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  totalLbl: { fontSize: FontSize.md, color: Colors.textSecondary },
  totalVal: { fontSize: FontSize.md, color: Colors.text },
  notesLbl: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary, marginBottom: 4 },
  notesTxt: { fontSize: FontSize.md, color: Colors.text },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: Radius.md, paddingVertical: Spacing.sm },
  actionTxt: { fontSize: FontSize.xs, fontWeight: '600' },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, ...Shadow.sm },
  payBtnTxt: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text, flexShrink: 1, textAlign: 'center' },
  paidBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderRadius: Radius.md, paddingVertical: Spacing.md },
  paidBtnTxt: { fontSize: FontSize.lg, fontWeight: '600' },
  paidBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: Colors.accentLight, borderRadius: Radius.md, padding: Spacing.md },
  paidBannerTxt: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.accent },
  paidRef: { fontSize: FontSize.xs, color: Colors.accent, marginTop: 2, fontFamily: 'monospace' },
  paidAt: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  logsTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.sm },
  logDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  logDetail: { fontSize: FontSize.sm, color: Colors.text, marginTop: 1 },
  logRef: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1, fontFamily: 'monospace' },
  logBadge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  logBadgeTxt: { fontSize: 10, fontWeight: '700' },
  dangerRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  archiveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: Spacing.sm },
  archiveTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  deleteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: Colors.danger + '55', borderRadius: Radius.md, paddingVertical: Spacing.sm, backgroundColor: Colors.danger + '0D' },
  deleteTxt: { fontSize: FontSize.sm, color: Colors.danger, fontWeight: '600' },
});

const paidModal = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface, padding: Spacing.lg, paddingTop: Spacing.md },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.lg },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.lg },
  method: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1.5, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  iconWrap: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  methodLabel: { flex: 1, fontSize: FontSize.md, fontWeight: '600' },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.md, marginTop: Spacing.sm },
  cancelTxt: { fontSize: FontSize.md, color: Colors.textMuted },
});

const previewModal = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.surface },
  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  heading:    { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  headingSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  webWrap:    { flex: 1, backgroundColor: '#fff' },
  web:        { flex: 1 },
  loader:     { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, gap: 10 },
  loaderTxt:  { fontSize: FontSize.sm, color: Colors.textMuted },
  footer:     { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, paddingBottom: Spacing.md, backgroundColor: Colors.surface, borderTopWidth: 1, gap: 8 },
  shareBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.md, paddingVertical: 14, ...Shadow.sm },
  shareBtnTxt:  { fontSize: FontSize.md, fontWeight: '800', color: '#fff' },
  cancelBtn:    { alignItems: 'center', paddingVertical: 8 },
  cancelBtnTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
});

const modal = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.surface, padding: Spacing.lg, paddingTop: Spacing.md },
  handle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.lg },
  title:      { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  amount:     { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.primary, marginBottom: Spacing.lg },
  method:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  active:     { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  icon:       { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  iconTxt:    { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  mTitle:     { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  mSub:       { fontSize: FontSize.sm, color: Colors.textSecondary },
  cardFields: { gap: Spacing.sm, marginTop: Spacing.sm },
  phoneField: { gap: 4, marginBottom: Spacing.sm },
  phoneLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:      { backgroundColor: Colors.background, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.md, color: Colors.text },
  payBtn:     { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
  payBtnTxt:  { fontSize: FontSize.lg, fontWeight: '700', color: '#fff' },
  cancelBtn:  { alignItems: 'center', paddingVertical: Spacing.md },
  cancelTxt:  { fontSize: FontSize.md, color: Colors.textMuted },
  centered:    { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.md },
  waitTitle:   { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, textAlign: 'center', marginTop: Spacing.sm },
  waitSub:     { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  successTxt:  { fontSize: FontSize.xl, fontWeight: '700', color: Colors.accent, marginTop: Spacing.sm },
  failedTxt:   { fontSize: FontSize.xl, fontWeight: '700', color: Colors.danger, marginTop: Spacing.sm, textAlign: 'center' },
  retryBtn:    { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, marginTop: Spacing.sm },
  retryTxt:    { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
  dotsRow:     { flexDirection: 'row', gap: 4, marginTop: Spacing.sm },
  dot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotFilled:   { backgroundColor: Colors.mtn },
  refBox:      { marginTop: Spacing.sm, backgroundColor: Colors.background, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  refLabel:    { fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  refValue:    { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, fontFamily: 'monospace', marginTop: 2 },
});

const reminderModal = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.surface, paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  handle:       { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.lg },
  title:        { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  sub:          { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 20 },

  // Calendar
  calCard:      { backgroundColor: Colors.background, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  calHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  navBtn:       { padding: 6 },
  monthLabel:   { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  weekRow:      { flexDirection: 'row', marginBottom: 6 },
  weekDay:      { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  dayRow:       { flexDirection: 'row', marginBottom: 4 },
  dayCell:      { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 100 },
  dayTxt:       { fontSize: FontSize.sm, color: Colors.text, fontWeight: '500' },
  dayPast:      { color: Colors.border },
  daySelTxt:    { color: '#fff', fontWeight: '700' },

  // Time picker
  timeCard:     { backgroundColor: Colors.background, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  timeTitle:    { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md, alignSelf: 'flex-start' },
  timeRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  timeUnit:     { alignItems: 'center', gap: 4 },
  timeBtn:      { padding: 8 },
  timeDigitBox: { backgroundColor: Colors.surface, borderRadius: Radius.sm, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border },
  timeDigit:    { fontSize: 28, fontWeight: '800', color: Colors.text, minWidth: 44, textAlign: 'center' },
  timeSep:      { fontSize: 28, fontWeight: '800', color: Colors.textMuted, marginBottom: 8 },

  setBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.md, paddingVertical: Spacing.md, marginTop: Spacing.sm },
  setBtnTxt:    { fontSize: FontSize.lg, fontWeight: '700', color: '#fff' },
  cancelBtn:    { alignItems: 'center', paddingVertical: Spacing.md },
  cancelTxt:    { fontSize: FontSize.md, color: Colors.textMuted },
});
