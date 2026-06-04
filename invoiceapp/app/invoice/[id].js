import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, Modal, TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, Shadow } from '../../constants/theme';
import { getTemplate } from '../../constants/templates';
import { getInvoices, saveInvoice, deleteInvoice, archiveInvoice, getSettings, getBusinessLogo } from '../../utils/storage';
import { formatCurrency, formatDate, shareInvoice, printInvoice } from '../../utils/invoice';
import Confetti from '../../components/Confetti';
import { playChime } from '../../utils/sound';

const STATUS_COLOR = {
  draft: Colors.textMuted,
  sent: Colors.warning,
  paid: Colors.accent,
  overdue: Colors.danger,
};

const PAYMENT_METHODS = [
  { key: 'mtn',    label: 'MTN Mobile Money',   icon: 'phone-portrait-outline', color: '#FFCC00', bg: '#FFFBEB', text: Colors.text },
  { key: 'airtel', label: 'Airtel Money',        icon: 'phone-portrait-outline', color: '#E51A22', bg: '#FEF2F2', text: '#E51A22' },
  { key: 'cheque', label: 'Bank Cheque',          icon: 'document-text-outline',  color: '#2563EB', bg: '#EFF6FF', text: '#2563EB' },
  { key: 'card',   label: 'Credit / Debit Card',  icon: 'card-outline',            color: '#7C3AED', bg: '#F5F3FF', text: '#7C3AED' },
  { key: 'cash',   label: 'Cash Payment',         icon: 'cash-outline',            color: '#059669', bg: '#ECFDF5', text: '#059669' },
];

function ReminderModal({ visible, onClose, clientName }) {
  const tomorrow = new Date(Date.now() + 86400000);
  const [date, setDate] = useState(tomorrow.toISOString().split('T')[0]);
  const [time, setTime] = useState('09:00');
  const [loading, setLoading] = useState(false);

  const handleSet = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { Alert.alert('', 'Enter date as YYYY-MM-DD'); return; }
    if (!/^\d{2}:\d{2}$/.test(time))        { Alert.alert('', 'Enter time as HH:MM (24h)'); return; }
    const dateTime = new Date(`${date}T${time}:00`);
    if (isNaN(dateTime.getTime()))  { Alert.alert('', 'Invalid date or time.'); return; }
    if (dateTime <= new Date())     { Alert.alert('', 'Please choose a future date and time.'); return; }
    setLoading(true);
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') { Alert.alert('', 'Please enable notifications in device settings.'); setLoading(false); return; }
      const secondsFromNow = Math.floor((dateTime.getTime() - Date.now()) / 1000);
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Invoice Reminder', body: `Follow up on payment from ${clientName}`, sound: true },
        trigger: { type: 'timeInterval', seconds: secondsFromNow },
      });
      Alert.alert('✓ Reminder set', `You will be notified on ${date} at ${time}`);
      onClose();
    } catch (e) {
      Alert.alert('Error', e.message ?? 'Could not set reminder.');
    }
    setLoading(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={reminderModal.container}>
        <View style={reminderModal.handle} />
        <Text style={reminderModal.title}>Set Reminder</Text>
        <Text style={reminderModal.sub}>Pick a date and time to be notified to follow up on this payment.</Text>
        <View style={reminderModal.field}>
          <Text style={reminderModal.label}>Date</Text>
          <TextInput
            style={reminderModal.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.textMuted}
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <View style={reminderModal.field}>
          <Text style={reminderModal.label}>Time (24h format)</Text>
          <TextInput
            style={reminderModal.input}
            value={time}
            onChangeText={setTime}
            placeholder="HH:MM"
            placeholderTextColor={Colors.textMuted}
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <TouchableOpacity style={[reminderModal.setBtn, loading && { opacity: 0.5 }]} onPress={handleSet} disabled={loading} activeOpacity={0.85}>
          <Ionicons name="alarm-outline" size={20} color="#fff" />
          <Text style={reminderModal.setBtnTxt}>{loading ? 'Setting…' : 'Set Reminder'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={reminderModal.cancelBtn} onPress={onClose}>
          <Text style={reminderModal.cancelTxt}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function PaymentModal({ visible, invoice, settings, onClose, onPaid }) {
  const { t } = useTranslation();
  const [method, setMethod]   = useState(null);
  const [phone, setPhone]     = useState('');
  const [step, setStep]       = useState('select');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (visible) {
      setMethod(null);
      setPhone(invoice?.to?.phone ?? '');
      setStep('select');
      setAttempt(0);
    }
  }, [visible]);

  const handlePay = async () => {
    if (method === 'momo') {
      if (!phone.trim()) { Alert.alert('', 'Enter the client\'s MoMo phone number'); return; }
      setStep('waiting');
      try {
        const { requestMoMoPayment, pollMoMoStatus } = await import('../../utils/momo');
        const { referenceId } = await requestMoMoPayment({
          amount:        invoice.total,
          currency:      invoice.currency ?? 'RWF',
          phone:         phone.trim(),
          invoiceId:     invoice.id,
          invoiceNumber: invoice.number,
        });
        const result = await pollMoMoStatus(referenceId, {
          onUpdate: (status, att) => setAttempt(att),
          maxAttempts: 12,
          intervalMs: 5000,
        });
        setStep(result === 'SUCCESSFUL' ? 'success' : result === 'FAILED' ? 'failed' : 'timeout');
        if (result === 'SUCCESSFUL') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => onPaid?.('mtn'), 1400);
        }
      } catch (e) {
        Alert.alert('Error', e.message ?? 'Could not initiate payment. Configure Firebase first — see SETUP guide.');
        setStep('select');
      }
    } else {
      setStep('waiting');
      await new Promise(r => setTimeout(r, 2000));
      setStep('success');
      setTimeout(() => onPaid?.('card'), 1400);
    }
  };

  const renderBody = () => {
    if (step === 'waiting') return (
      <View style={modal.centered}>
        <Ionicons name="time-outline" size={64} color={Colors.mtn} />
        <Text style={modal.waitTitle}>
          {method === 'momo' ? 'Waiting for client to approve…' : 'Processing…'}
        </Text>
        {method === 'momo' && (
          <Text style={modal.waitSub}>Client will see a MoMo prompt on their phone.{'\n'}{attempt > 0 ? `Check (${attempt}/12)` : ''}</Text>
        )}
      </View>
    );

    if (step === 'success') return (
      <View style={modal.centered}>
        <Ionicons name="checkmark-circle" size={72} color={Colors.accent} />
        <Text style={modal.successTxt}>Payment Received!</Text>
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

        <TouchableOpacity style={[modal.method, method === 'card' && modal.active]} onPress={() => setMethod('card')} activeOpacity={0.7}>
          <View style={[modal.icon, { backgroundColor: Colors.primary }]}><Ionicons name="card-outline" size={18} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Text style={modal.mTitle}>{t('payment.card')}</Text>
            <Text style={modal.mSub}>Visa / Mastercard</Text>
          </View>
          {method === 'card' && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
        </TouchableOpacity>

        {method === 'card' && (
          <View style={modal.cardFields}>
            <TextInput style={modal.input} placeholder={t('payment.cardNumber')} placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <TextInput style={[modal.input, { flex: 1 }]} placeholder={t('payment.cardExpiry')} placeholderTextColor={Colors.textMuted} />
              <TextInput style={[modal.input, { flex: 1 }]} placeholder={t('payment.cardCvv')} placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
            </View>
            <TextInput style={modal.input} placeholder={t('payment.cardName')} placeholderTextColor={Colors.textMuted} />
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
  const [showReminder, setShowReminder] = useState(false);
  const hasPlayedRef = useRef(false);

  const load = useCallback(async () => {
    const [invoices, s, logoData] = await Promise.all([getInvoices(), getSettings(), getBusinessLogo()]);
    const inv = invoices.find(i => i.id === id);
    setInvoice(inv ?? null);
    setSettings(s);
    setLogoUri(logoData);
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

  const handleShare = () => setShowPreview(true);

  const confirmPaid = async (method) => {
    setShowPaidMethodPicker(false);
    const updated = { ...invoice, status: 'paid', paymentMethod: method.key, paymentMethodLabel: method.label };
    await saveInvoice(updated);
    setInvoice(updated);
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

        {/* Actions row */}
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: tpl.lightColor }]} onPress={handleShare} activeOpacity={0.7}>
            <Ionicons name="share-outline" size={20} color={primary} />
            <Text style={[styles.actionTxt, { color: primary }]}>{t('invoice.sharePdf')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: tpl.lightColor }]} onPress={() => printInvoice(invoice)} activeOpacity={0.7}>
            <Ionicons name="print-outline" size={20} color={primary} />
            <Text style={[styles.actionTxt, { color: primary }]}>{t('invoice.print')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.accentLight }]} onPress={() => setShowReminder(true)} activeOpacity={0.7}>
            <Ionicons name="alarm-outline" size={20} color={Colors.accent} />
            <Text style={[styles.actionTxt, { color: Colors.accent }]}>{t('invoice.remind')}</Text>
          </TouchableOpacity>
        </View>

        {invoice.status !== 'paid' && (
          <>
            <TouchableOpacity style={[styles.payBtn, { backgroundColor: Colors.mtn }]} onPress={() => setShowPayment(true)} activeOpacity={0.85}>
              <Ionicons name="phone-portrait-outline" size={20} color={Colors.text} />
              <Text style={styles.payBtnTxt}>{t('invoice.receivePayment')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.paidBtn, { borderColor: Colors.accent }]} onPress={() => setShowPaidMethodPicker(true)} activeOpacity={0.85}>
              <Ionicons name="checkmark-circle-outline" size={20} color={Colors.accent} />
              <Text style={[styles.paidBtnTxt, { color: Colors.accent }]}>{t('invoice.markAsPaid')}</Text>
            </TouchableOpacity>
          </>
        )}

        {invoice.status === 'paid' && (
          <View style={styles.paidBanner}>
            <Ionicons name="checkmark-circle" size={28} color={Colors.accent} />
            <View>
              <Text style={styles.paidBannerTxt}>{t('invoice.paymentReceived')}</Text>
              {invoice.paymentMethodLabel ? <Text style={{ fontSize: FontSize.xs, color: Colors.accent }}>{invoice.paymentMethodLabel}</Text> : null}
            </View>
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

      {/* Invoice preview */}
      <Modal visible={showPreview} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPreview(false)}>
        <ScrollView style={previewModal.container} contentContainerStyle={previewModal.content}>
          <View style={previewModal.handle} />
          <Text style={previewModal.heading}>Invoice Preview</Text>

          <View style={[previewModal.card, { borderTopColor: primary, borderTopWidth: 3 }]}>
            {logoUri ? <Image source={{ uri: logoUri }} style={previewModal.logo} resizeMode="contain" /> : null}
            <Text style={[previewModal.docType, { color: primary }]}>{docTitle.toUpperCase()}</Text>
            <Text style={previewModal.invNumber}>{invoice.number}</Text>
            <Text style={previewModal.meta}>Date: {formatDate(invoice.date)}</Text>
            {invoice.dueDate ? <Text style={previewModal.meta}>Due: {formatDate(invoice.dueDate)}</Text> : null}
          </View>

          <View style={[previewModal.card, previewModal.row]}>
            <View style={{ flex: 1 }}>
              <Text style={[previewModal.partyLabel, { color: primary }]}>FROM</Text>
              <Text style={previewModal.partyName}>{invoice.from?.name}</Text>
              <Text style={previewModal.partySub}>{invoice.from?.address}</Text>
              {invoice.from?.tin ? <Text style={previewModal.partySub}>TIN: {invoice.from.tin}</Text> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[previewModal.partyLabel, { color: primary }]}>TO</Text>
              <Text style={previewModal.partyName}>{invoice.to?.name}</Text>
              <Text style={previewModal.partySub}>{invoice.to?.address}</Text>
              {invoice.to?.tin ? <Text style={previewModal.partySub}>TIN: {invoice.to.tin}</Text> : null}
            </View>
          </View>

          <View style={previewModal.card}>
            {invoice.items?.map((item, i) => item.type === 'section' ? (
              <Text key={item.id} style={[previewModal.sectionHead, { color: primary }]}>{item.description}</Text>
            ) : (
              <View key={item.id} style={[previewModal.itemRow, i > 0 && { borderTopWidth: 1, borderTopColor: Colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={previewModal.itemDesc}>{item.description}</Text>
                  {item.notes ? <Text style={previewModal.itemNotes}>{item.notes}</Text> : null}
                </View>
                <Text style={previewModal.itemQty}>{item.qty} ×</Text>
                <Text style={previewModal.itemPrice}>{formatCurrency(parseFloat(item.qty||0)*parseFloat(item.unitPrice||0), currency)}</Text>
              </View>
            ))}
            <View style={[previewModal.totalRow, { borderTopColor: primary, borderTopWidth: 2, marginTop: 8 }]}>
              <Text style={[previewModal.totalLabel, { color: primary, fontWeight: '700' }]}>TOTAL</Text>
              <Text style={[previewModal.totalValue, { color: primary, fontWeight: '700', fontSize: FontSize.lg }]}>{formatCurrency(invoice.total, currency)}</Text>
            </View>
          </View>

          <TouchableOpacity style={[previewModal.shareBtn, { backgroundColor: primary }]} onPress={doShare} activeOpacity={0.85}>
            <Ionicons name="share-outline" size={20} color="#fff" />
            <Text style={previewModal.shareBtnTxt}>Share PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={previewModal.closeBtn} onPress={() => setShowPreview(false)}>
            <Text style={previewModal.closeBtnTxt}>Close Preview</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
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
        onPaid={(methodKey) => {
          setShowPayment(false);
          const pm = PAYMENT_METHODS.find(m => m.key === methodKey) ?? PAYMENT_METHODS.find(m => m.key === 'mtn');
          confirmPaid(pm);
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
  paidBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.accentLight, borderRadius: Radius.md, paddingVertical: Spacing.md },
  paidBannerTxt: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.accent },
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
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.sm },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.sm },
  heading: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.md },
  logo: { width: 80, height: 50, borderRadius: Radius.sm, marginBottom: Spacing.sm },
  docType: { fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  invNumber: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginTop: 2 },
  meta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  partyLabel: { fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  partyName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  partySub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  sectionHead: { fontSize: FontSize.sm, fontWeight: '700', paddingVertical: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, gap: 8 },
  itemDesc: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '600' },
  itemNotes: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  itemQty: { fontSize: FontSize.sm, color: Colors.textMuted, width: 40, textAlign: 'right' },
  itemPrice: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '600', width: 80, textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 2 },
  totalLabel: { fontSize: FontSize.md },
  totalValue: { fontSize: FontSize.md },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.md, paddingVertical: Spacing.md, marginTop: Spacing.sm, ...Shadow.md },
  shareBtnTxt: { fontSize: FontSize.lg, fontWeight: '700', color: '#fff' },
  closeBtn: { alignItems: 'center', paddingVertical: Spacing.md },
  closeBtnTxt: { fontSize: FontSize.md, color: Colors.textMuted },
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
});

const reminderModal = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface, padding: Spacing.lg, paddingTop: Spacing.md },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.lg },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 20 },
  field: { marginBottom: Spacing.md },
  label: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { backgroundColor: Colors.background, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.lg, color: Colors.text },
  setBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.accent, borderRadius: Radius.md, paddingVertical: Spacing.md, marginTop: Spacing.md },
  setBtnTxt: { fontSize: FontSize.lg, fontWeight: '700', color: '#fff' },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.md, marginTop: Spacing.sm },
  cancelTxt: { fontSize: FontSize.md, color: Colors.textMuted },
});
