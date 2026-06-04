import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Image, Alert, KeyboardAvoidingView, Platform, Modal, FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, Shadow } from '../../constants/theme';
import { getTemplate } from '../../constants/templates';
import {
  getInvoices, saveInvoice, getSettings, getBusinessLogo, saveBusinessLogo,
  getClients, saveClient, getProducts, saveProduct,
} from '../../utils/storage';
import { generateId, calcInvoice, formatCurrency } from '../../utils/invoice';

const CURRENCIES = [
  // Africa — listed first (primary market)
  { code: 'RWF', name: 'Rwandan Franc',          symbol: 'Fr',   flag: '🇷🇼' },
  { code: 'KES', name: 'Kenyan Shilling',         symbol: 'KSh',  flag: '🇰🇪' },
  { code: 'UGX', name: 'Ugandan Shilling',        symbol: 'USh',  flag: '🇺🇬' },
  { code: 'TZS', name: 'Tanzanian Shilling',      symbol: 'TSh',  flag: '🇹🇿' },
  { code: 'NGN', name: 'Nigerian Naira',          symbol: '₦',    flag: '🇳🇬' },
  { code: 'GHS', name: 'Ghanaian Cedi',           symbol: '₵',    flag: '🇬🇭' },
  { code: 'ZAR', name: 'South African Rand',      symbol: 'R',    flag: '🇿🇦' },
  { code: 'ETB', name: 'Ethiopian Birr',          symbol: 'Br',   flag: '🇪🇹' },
  { code: 'EGP', name: 'Egyptian Pound',          symbol: '£',    flag: '🇪🇬' },
  { code: 'MAD', name: 'Moroccan Dirham',         symbol: 'MAD',  flag: '🇲🇦' },
  { code: 'XOF', name: 'West African CFA Franc',  symbol: 'Fr',   flag: '🌍' },
  { code: 'XAF', name: 'Central African CFA Franc', symbol: 'Fr', flag: '🌍' },
  // Americas
  { code: 'USD', name: 'US Dollar',               symbol: '$',    flag: '🇺🇸' },
  { code: 'CAD', name: 'Canadian Dollar',         symbol: 'C$',   flag: '🇨🇦' },
  { code: 'BRL', name: 'Brazilian Real',          symbol: 'R$',   flag: '🇧🇷' },
  { code: 'MXN', name: 'Mexican Peso',            symbol: '$',    flag: '🇲🇽' },
  // Europe
  { code: 'EUR', name: 'Euro',                    symbol: '€',    flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound',           symbol: '£',    flag: '🇬🇧' },
  { code: 'CHF', name: 'Swiss Franc',             symbol: 'Fr',   flag: '🇨🇭' },
  { code: 'SEK', name: 'Swedish Krona',           symbol: 'kr',   flag: '🇸🇪' },
  { code: 'NOK', name: 'Norwegian Krone',         symbol: 'kr',   flag: '🇳🇴' },
  { code: 'DKK', name: 'Danish Krone',            symbol: 'kr',   flag: '🇩🇰' },
  { code: 'PLN', name: 'Polish Złoty',            symbol: 'zł',   flag: '🇵🇱' },
  // Middle East
  { code: 'AED', name: 'UAE Dirham',              symbol: 'د.إ',  flag: '🇦🇪' },
  { code: 'SAR', name: 'Saudi Riyal',             symbol: '﷼',    flag: '🇸🇦' },
  { code: 'QAR', name: 'Qatari Riyal',            symbol: '﷼',    flag: '🇶🇦' },
  // Asia Pacific
  { code: 'JPY', name: 'Japanese Yen',            symbol: '¥',    flag: '🇯🇵' },
  { code: 'CNY', name: 'Chinese Yuan',            symbol: '¥',    flag: '🇨🇳' },
  { code: 'INR', name: 'Indian Rupee',            symbol: '₹',    flag: '🇮🇳' },
  { code: 'AUD', name: 'Australian Dollar',       symbol: 'A$',   flag: '🇦🇺' },
  { code: 'SGD', name: 'Singapore Dollar',        symbol: 'S$',   flag: '🇸🇬' },
  { code: 'HKD', name: 'Hong Kong Dollar',        symbol: 'HK$',  flag: '🇭🇰' },
  { code: 'MYR', name: 'Malaysian Ringgit',       symbol: 'RM',   flag: '🇲🇾' },
];

function CurrencyPickerModal({ visible, selected, onSelect, onClose }) {
  const [query, setQuery] = useState('');

  const results = query.trim()
    ? CURRENCIES.filter(c =>
        c.code.toLowerCase().includes(query.toLowerCase()) ||
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.symbol.toLowerCase().includes(query.toLowerCase())
      )
    : CURRENCIES;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={cpkStyles.container}>
        <View style={cpkStyles.handle} />
        <Text style={cpkStyles.title}>Select Currency</Text>

        {/* Search */}
        <View style={cpkStyles.searchRow}>
          <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
          <TextInput
            style={cpkStyles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search currency or code…"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>

        <FlatList
          data={results}
          keyExtractor={c => c.code}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={cpkStyles.list}
          renderItem={({ item }) => {
            const isActive = item.code === selected;
            return (
              <TouchableOpacity
                style={[cpkStyles.row, isActive && cpkStyles.rowActive]}
                onPress={() => { onSelect(item.code); onClose(); }}
                activeOpacity={0.7}
              >
                <Text style={cpkStyles.flag}>{item.flag}</Text>
                <View style={cpkStyles.info}>
                  <Text style={[cpkStyles.code, isActive && cpkStyles.codeActive]}>{item.code}</Text>
                  <Text style={cpkStyles.name} numberOfLines={1}>{item.name}</Text>
                </View>
                <Text style={[cpkStyles.symbol, isActive && cpkStyles.symbolActive]}>{item.symbol}</Text>
                {isActive && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} style={{ marginLeft: 6 }} />}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={cpkStyles.empty}>
              <Text style={cpkStyles.emptyTxt}>No currencies found for "{query}"</Text>
            </View>
          }
        />

        <TouchableOpacity style={cpkStyles.closeBtn} onPress={onClose} activeOpacity={0.8}>
          <Text style={cpkStyles.closeTxt}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType, multiline, autoCapitalize }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor={Colors.textMuted}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        autoCapitalize={autoCapitalize ?? (keyboardType === 'email-address' ? 'none' : 'sentences')}
      />
    </View>
  );
}

function SectionHeader({ title, color }) {
  return <Text style={[styles.sectionHeader, { borderLeftColor: color }]}>{title}</Text>;
}

function InvoicePreviewCard({ from, to, items, total, currency, invoiceNumber, date, tpl, logoUri, docTitle, onExpand }) {
  const primary = tpl.primaryColor;
  const lineItems = items.filter(i => i.type === 'item' && i.description);
  return (
    <View style={[pvStyles.card, { borderTopColor: primary, borderTopWidth: 3 }]}>
      <View style={pvStyles.topRow}>
        <Text style={pvStyles.badge}>LIVE PREVIEW</Text>
        <TouchableOpacity onPress={onExpand} style={pvStyles.expandBtn} activeOpacity={0.7}>
          <Ionicons name="eye-outline" size={20} color={primary} />
        </TouchableOpacity>
      </View>
      <View style={pvStyles.header}>
        {logoUri ? <Image source={{ uri: logoUri }} style={pvStyles.logo} resizeMode="contain" /> : null}
        <View style={{ flex: 1 }}>
          <Text style={[pvStyles.docType, { color: primary }]}>{(docTitle || 'INVOICE').toUpperCase()}</Text>
          <Text style={pvStyles.number}>{invoiceNumber || 'INV-0001'}</Text>
          <Text style={pvStyles.meta}>{date}</Text>
        </View>
      </View>
      <View style={pvStyles.parties}>
        <View style={{ flex: 1 }}>
          <Text style={[pvStyles.partyLabel, { color: primary }]}>FROM</Text>
          <Text style={pvStyles.partyName} numberOfLines={1}>{from.name || '—'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[pvStyles.partyLabel, { color: primary }]}>TO</Text>
          <Text style={pvStyles.partyName} numberOfLines={1}>{to.name || '—'}</Text>
        </View>
      </View>
      {lineItems.slice(0, 3).map(item => (
        <View key={item.id} style={pvStyles.itemRow}>
          <Text style={pvStyles.itemDesc} numberOfLines={1}>{item.description}</Text>
          <Text style={pvStyles.itemAmt}>{(parseFloat(item.qty || 0) * parseFloat(item.unitPrice || 0)).toLocaleString()} {currency}</Text>
        </View>
      ))}
      {lineItems.length > 3 ? <Text style={pvStyles.moreItems}>+ {lineItems.length - 3} more items</Text> : null}
      <View style={[pvStyles.totalRow, { borderTopColor: primary }]}>
        <Text style={[pvStyles.totalLbl, { color: primary }]}>TOTAL</Text>
        <Text style={[pvStyles.totalVal, { color: primary }]}>{total.toLocaleString()} {currency}</Text>
      </View>
    </View>
  );
}

function ClientPickerModal({ visible, clients, onSelect, onClose, onClientCreated }) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [draft, setDraft] = useState({ name: '', phone: '', email: '', address: '' });

  useEffect(() => {
    if (visible) { setShowNewForm(false); setDraft({ name: '', phone: '', email: '', address: '' }); }
  }, [visible]);

  const handleCreateNew = async () => {
    if (!draft.name.trim()) { Alert.alert('', 'Name is required'); return; }
    const client = { ...draft, id: generateId(), createdAt: new Date().toISOString() };
    await saveClient(client);
    onClientCreated?.(client);
    onSelect(client);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={cpStyles.container}>
        <View style={cpStyles.handle} />
        {showNewForm ? (
          <>
            <View style={cpStyles.formHeader}>
              <TouchableOpacity onPress={() => setShowNewForm(false)} style={{ padding: 4 }}>
                <Ionicons name="arrow-back-outline" size={22} color={Colors.text} />
              </TouchableOpacity>
              <Text style={cpStyles.title}>New Client</Text>
            </View>
            {[
              { key: 'name', label: 'Name / Company' },
              { key: 'address', label: 'Address' },
              { key: 'phone', label: 'Phone', keyboard: 'phone-pad' },
              { key: 'email', label: 'Email', keyboard: 'email-address' },
            ].map(({ key, label, keyboard }) => (
              <View key={key} style={cpStyles.formField}>
                <Text style={cpStyles.formLabel}>{label}</Text>
                <TextInput
                  style={cpStyles.formInput}
                  value={draft[key]}
                  onChangeText={v => setDraft(p => ({ ...p, [key]: v }))}
                  placeholder={label}
                  placeholderTextColor={Colors.textMuted}
                  keyboardType={keyboard ?? 'default'}
                  autoCapitalize={keyboard === 'email-address' ? 'none' : 'sentences'}
                />
              </View>
            ))}
            <TouchableOpacity style={cpStyles.saveBtn} onPress={handleCreateNew} activeOpacity={0.85}>
              <Text style={cpStyles.saveBtnTxt}>Save &amp; Select Client</Text>
            </TouchableOpacity>
            <TouchableOpacity style={cpStyles.cancelBtn} onPress={() => setShowNewForm(false)}>
              <Text style={cpStyles.cancelTxt}>Back to list</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={cpStyles.title}>Choose a Client</Text>
            <TouchableOpacity style={cpStyles.newClientBtn} onPress={() => setShowNewForm(true)} activeOpacity={0.7}>
              <Ionicons name="person-add-outline" size={18} color={Colors.primary} />
              <Text style={cpStyles.newClientTxt}>Create New Client</Text>
            </TouchableOpacity>
            <FlatList
              data={clients}
              keyExtractor={c => c.id}
              contentContainerStyle={cpStyles.list}
              renderItem={({ item }) => (
                <TouchableOpacity style={cpStyles.item} onPress={() => onSelect(item)} activeOpacity={0.7}>
                  <View style={cpStyles.avatar}>
                    <Text style={cpStyles.avatarTxt}>{item.name[0]?.toUpperCase() ?? '?'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={cpStyles.name}>{item.name}</Text>
                    {item.address ? <Text style={cpStyles.sub}>{item.address}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={cpStyles.empty}>{'No saved clients yet.\nTap "Create New Client" above.'}</Text>}
            />
            <TouchableOpacity style={cpStyles.cancelBtn} onPress={onClose}>
              <Text style={cpStyles.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

function ProductPickerModal({ visible, products, onSelect, onClose, onProductSaved }) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [draft, setDraft] = useState({ name: '', unitPrice: '', notes: '' });

  useEffect(() => {
    if (visible) { setShowNewForm(false); setDraft({ name: '', unitPrice: '', notes: '' }); }
  }, [visible]);

  const handleCreate = async () => {
    if (!draft.name.trim()) { Alert.alert('', 'Product name is required'); return; }
    const product = { id: generateId(), name: draft.name.trim(), unitPrice: draft.unitPrice, notes: draft.notes };
    await saveProduct(product);
    onProductSaved?.(product);
    onSelect(product);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={ppStyles.container}>
        <View style={ppStyles.handle} />
        {showNewForm ? (
          <>
            <View style={ppStyles.formHeader}>
              <TouchableOpacity onPress={() => setShowNewForm(false)} style={{ padding: 4 }}>
                <Ionicons name="arrow-back-outline" size={22} color={Colors.text} />
              </TouchableOpacity>
              <Text style={ppStyles.title}>New Product</Text>
            </View>
            <View style={ppStyles.formField}>
              <Text style={ppStyles.formLabel}>Product Name *</Text>
              <TextInput style={ppStyles.formInput} value={draft.name} onChangeText={v => setDraft(p => ({ ...p, name: v }))} placeholder="e.g. Web Design Package" placeholderTextColor={Colors.textMuted} />
            </View>
            <View style={ppStyles.formField}>
              <Text style={ppStyles.formLabel}>Default Unit Price</Text>
              <TextInput style={ppStyles.formInput} value={draft.unitPrice} onChangeText={v => setDraft(p => ({ ...p, unitPrice: v }))} placeholder="0" keyboardType="numeric" placeholderTextColor={Colors.textMuted} />
            </View>
            <View style={ppStyles.formField}>
              <Text style={ppStyles.formLabel}>Notes (optional)</Text>
              <TextInput style={[ppStyles.formInput, { minHeight: 60, textAlignVertical: 'top' }]} value={draft.notes} onChangeText={v => setDraft(p => ({ ...p, notes: v }))} placeholder="Description, size, colour..." multiline placeholderTextColor={Colors.textMuted} />
            </View>
            <TouchableOpacity style={ppStyles.saveBtn} onPress={handleCreate} activeOpacity={0.85}>
              <Text style={ppStyles.saveBtnTxt}>Save & Add to Invoice</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ppStyles.cancelBtn} onPress={() => setShowNewForm(false)}>
              <Text style={ppStyles.cancelTxt}>Back to list</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={ppStyles.title}>Select Product / Item</Text>
            <TouchableOpacity style={ppStyles.newBtn} onPress={() => setShowNewForm(true)} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
              <Text style={ppStyles.newBtnTxt}>Create New Product</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ppStyles.blankBtn} onPress={() => onSelect(null)} activeOpacity={0.7}>
              <Ionicons name="create-outline" size={18} color={Colors.textSecondary} />
              <Text style={ppStyles.blankBtnTxt}>Add Blank Item</Text>
            </TouchableOpacity>
            <FlatList
              data={products}
              keyExtractor={p => p.id}
              contentContainerStyle={ppStyles.list}
              renderItem={({ item }) => (
                <TouchableOpacity style={ppStyles.item} onPress={() => onSelect(item)} activeOpacity={0.7}>
                  <View style={{ flex: 1 }}>
                    <Text style={ppStyles.itemName}>{item.name}</Text>
                    {item.notes ? <Text style={ppStyles.itemNotes} numberOfLines={1}>{item.notes}</Text> : null}
                  </View>
                  {item.unitPrice ? <Text style={ppStyles.itemPrice}>{parseFloat(item.unitPrice || 0).toLocaleString()}</Text> : null}
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={ppStyles.empty}>{'No saved products yet.\nTap "Create New Product" above.'}</Text>}
            />
            <TouchableOpacity style={ppStyles.cancelBtn} onPress={onClose}>
              <Text style={ppStyles.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

function FullPreviewModal({ visible, onClose, from, to, items, subtotal, vatAmount, total, currency, vatRate, invoiceNumber, date, dueDate, notes, tpl, logoUri, type, docTitle }) {
  const primary = tpl.primaryColor;
  const isProforma = type === 'proforma';
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <ScrollView style={fpStyles.container} contentContainerStyle={fpStyles.content}>
        <View style={fpStyles.handle} />
        <Text style={fpStyles.heading}>Invoice Preview</Text>

        <View style={[fpStyles.card, { borderTopColor: primary, borderTopWidth: 3 }]}>
          {logoUri ? <Image source={{ uri: logoUri }} style={fpStyles.logo} resizeMode="contain" /> : null}
          <Text style={[fpStyles.docType, { color: primary }]}>{docTitle || (isProforma ? 'PROFORMA INVOICE' : 'INVOICE')}</Text>
          <Text style={fpStyles.number}>{invoiceNumber}</Text>
          <Text style={fpStyles.meta}>Date: {date}</Text>
          {dueDate ? <Text style={fpStyles.meta}>Due: {dueDate}</Text> : null}
        </View>

        <View style={[fpStyles.card, fpStyles.row]}>
          <View style={{ flex: 1 }}>
            <Text style={[fpStyles.partyLabel, { color: primary }]}>FROM</Text>
            <Text style={fpStyles.partyName}>{from.name || '—'}</Text>
            {from.address ? <Text style={fpStyles.partySub}>{from.address}</Text> : null}
            {from.tin ? <Text style={fpStyles.partySub}>TIN: {from.tin}</Text> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[fpStyles.partyLabel, { color: primary }]}>TO</Text>
            <Text style={fpStyles.partyName}>{to.name || '—'}</Text>
            {to.address ? <Text style={fpStyles.partySub}>{to.address}</Text> : null}
            {to.tin ? <Text style={fpStyles.partySub}>TIN: {to.tin}</Text> : null}
          </View>
        </View>

        <View style={fpStyles.card}>
          {items.map(item => item.type === 'section' ? (
            <Text key={item.id} style={[fpStyles.sectionHead, { color: primary }]}>{item.description}</Text>
          ) : (
            <View key={item.id} style={fpStyles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={fpStyles.itemDesc}>{item.description || '—'}</Text>
                {item.notes ? <Text style={fpStyles.itemNotes}>{item.notes}</Text> : null}
              </View>
              <Text style={fpStyles.itemQty}>{item.qty} ×</Text>
              <Text style={fpStyles.itemPrice}>{formatCurrency(parseFloat(item.qty || 0) * parseFloat(item.unitPrice || 0), currency)}</Text>
            </View>
          ))}
          <View style={[fpStyles.totalsSection, { borderTopColor: primary }]}>
            <View style={fpStyles.totalRow}><Text style={fpStyles.totalLbl}>Subtotal</Text><Text style={fpStyles.totalVal}>{formatCurrency(subtotal, currency)}</Text></View>
            <View style={fpStyles.totalRow}><Text style={fpStyles.totalLbl}>VAT ({vatRate}%)</Text><Text style={fpStyles.totalVal}>{formatCurrency(vatAmount, currency)}</Text></View>
            <View style={[fpStyles.totalRow, { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4, paddingTop: 8 }]}>
              <Text style={[fpStyles.totalLbl, { fontWeight: '700', color: primary }]}>TOTAL</Text>
              <Text style={[fpStyles.totalVal, { fontWeight: '700', color: primary }]}>{formatCurrency(total, currency)}</Text>
            </View>
          </View>
        </View>

        {notes ? (
          <View style={fpStyles.card}>
            <Text style={fpStyles.notesLbl}>Notes</Text>
            <Text style={fpStyles.notesTxt}>{notes}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={fpStyles.closeBtn} onPress={onClose} activeOpacity={0.8}>
          <Text style={fpStyles.closeTxt}>Close Preview</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </Modal>
  );
}

export default function CreateInvoice() {
  const { t } = useTranslation();
  const router = useRouter();
  const { type = 'invoice', templateId = 't01', docTitle: paramDocTitle, editId } = useLocalSearchParams();
  const tpl = getTemplate(templateId);
  const isProforma = type === 'proforma';
  const isEditing = !!editId;

  const [editingInvoice, setEditingInvoice] = useState(null);
  const [logoUri, setLogoUri] = useState(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState('RWF');
  const [vatRate, setVatRate] = useState('18');
  const [notes, setNotes] = useState('');
  const [docTitle] = useState(
    paramDocTitle ? decodeURIComponent(paramDocTitle) : (isProforma ? 'Proforma Invoice' : 'Invoice')
  );
  const [pickerForItemId, setPickerForItemId] = useState(null);
  const [from, setFrom] = useState({
    name: '', address: '', tin: '', phone: '', email: '',
    momoNumber: '', momoCode: '', instagram: '', website: '', businessEmail: '',
  });
  const [to, setTo] = useState({ name: '', address: '', tin: '', email: '' });
  const [items, setItems] = useState([{ id: generateId(), type: 'item', description: '', notes: '', extra: '', qty: '1', unitPrice: '' }]);
  const [savedClients, setSavedClients] = useState([]);
  const [savedProducts, setSavedProducts] = useState([]);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  const colHeaders = { desc: 'Description', extraLabel: '', qty: 'Qty', price: 'Unit Price' };

  useEffect(() => {
    (async () => {
      const [allInvoices, settings, logoDataUri, clients, products] = await Promise.all([
        getInvoices(), getSettings(), getBusinessLogo(), getClients(), getProducts(),
      ]);

      setSavedClients(clients);
      setSavedProducts(products);
      if (logoDataUri) setLogoUri(logoDataUri);

      if (isEditing) {
        const inv = allInvoices.find(i => i.id === editId);
        if (inv) {
          setEditingInvoice(inv);
          setInvoiceNumber(inv.number ?? '');
          setDate(inv.date ?? new Date().toISOString().split('T')[0]);
          setDueDate(inv.dueDate ?? '');
          setCurrency(inv.currency ?? 'RWF');
          setVatRate(String(inv.vatRate ?? '18'));
          setNotes(inv.notes ?? '');
          if (inv.from) setFrom(inv.from);
          if (inv.to)   setTo(inv.to);
          if (inv.items?.length) setItems(inv.items);
        }
      } else {
        const prefix = isProforma ? 'PRO' : 'INV';
        const year = new Date().getFullYear();
        const max = allInvoices
          .map(i => parseInt(i.number?.split('-')[2] ?? '0', 10))
          .reduce((a, b) => Math.max(a, b), 0);
        setInvoiceNumber(`${prefix}-${year}-${String(max + 1).padStart(4, '0')}`);
        setCurrency(settings.currency ?? 'RWF');
        setFrom({
          name:          settings.name ?? '',
          address:       settings.address ?? '',
          tin:           settings.tin ?? '',
          phone:         settings.phone ?? '',
          email:         settings.businessEmail ?? '',
          momoNumber:    settings.momoNumber ?? '',
          momoCode:      settings.momoCode ?? '',
          instagram:     settings.instagram ?? '',
          website:       settings.website ?? '',
          businessEmail: settings.businessEmail ?? '',
        });
      }
    })();
  }, []);

  const pickLogo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.35, base64: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    let dataUri;
    if (asset.base64) {
      dataUri = `data:image/jpeg;base64,${asset.base64}`;
    } else {
      try {
        const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
        dataUri = `data:image/jpeg;base64,${base64}`;
      } catch {
        Alert.alert('', 'Could not read the selected image. Please try another.');
        return;
      }
    }
    setLogoUri(dataUri);
    await saveBusinessLogo(dataUri);
  };

  const updateItem = (id, field, val) => setItems(p => p.map(i => i.id === id ? { ...i, [field]: val } : i));
  const removeItem = (id) => {
    const item = items.find(i => i.id === id);
    if (item?.type === 'item') {
      const itemCount = items.filter(i => i.type === 'item').length;
      if (itemCount <= 1) return;
    }
    setItems(p => p.filter(i => i.id !== id));
  };

  const handleSelectProduct = (product) => {
    setShowProductPicker(false);
    if (pickerForItemId) {
      // Fill an existing item from catalog
      if (product) {
        updateItem(pickerForItemId, 'description', product.name);
        updateItem(pickerForItemId, 'unitPrice', product.unitPrice ?? '');
        updateItem(pickerForItemId, 'notes', product.notes ?? '');
      }
      setPickerForItemId(null);
    } else {
      // Add a new item
      if (!product) {
        setItems(p => [...p, { id: generateId(), type: 'item', description: '', notes: '', extra: '', qty: '1', unitPrice: '' }]);
      } else {
        setItems(p => [...p, { id: generateId(), type: 'item', description: product.name, notes: product.notes ?? '', extra: '', qty: '1', unitPrice: product.unitPrice ?? '' }]);
      }
    }
  };

  const handleProductSaved = (product) => {
    setSavedProducts(prev => [product, ...prev]);
  };

  const { subtotal, vatAmount, total } = calcInvoice(items, vatRate);
  const primary = tpl.primaryColor;

  const handleSelectClient = (client) => {
    setTo({ name: client.name, address: client.address ?? '', tin: client.tin ?? '', email: client.email ?? '' });
    setShowClientPicker(false);
  };

  const handleClientCreated = (client) => {
    setSavedClients(prev => [client, ...prev]);
  };

  const handleSave = async () => {
    if (!from.name.trim()) { Alert.alert('', 'Please enter your name.'); return; }
    if (!to.name.trim())   { Alert.alert('', 'Please enter the client name.'); return; }
    if (items.filter(i => i.type === 'item').some(i => !i.description.trim())) {
      Alert.alert('', 'All items need a description.'); return;
    }

    if (isEditing && editingInvoice) {
      const updated = {
        ...editingInvoice,
        number: invoiceNumber,
        date, dueDate,
        docTitle,
        from, to, items,
        colHeaders,
        vatRate, currency, notes,
        subtotal, vatAmount, total,
        noLogo: !logoUri,
      };
      await saveInvoice(updated);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/invoice/${updated.id}`);
      return;
    }

    const settings = await getSettings();

    const invoice = {
      id: generateId(),
      number: invoiceNumber,
      type,
      templateId,
      date, dueDate,
      createdAt: new Date().toISOString(),
      status: 'draft',
      logoUri: null,
      noLogo: !logoUri,
      signature: settings.signature ?? null,
      docTitle,
      from, to, items,
      colHeaders,
      vatRate, currency, notes,
      subtotal, vatAmount, total,
    };

    await saveInvoice(invoice);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace(`/invoice/${invoice.id}?new=1`);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{
        title: isEditing ? `Edit ${docTitle}` : `New ${docTitle}`,
        headerStyle: { backgroundColor: primary },
        headerTintColor: tpl.headerText,
        headerBackTitle: '',
      }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <InvoicePreviewCard
          from={from} to={to} items={items} total={total} currency={currency}
          invoiceNumber={invoiceNumber} date={date} tpl={tpl} logoUri={logoUri}
          docTitle={docTitle} onExpand={() => setShowFullPreview(true)}
        />

        {/* Template badge */}
        <View style={[styles.templateBar, { backgroundColor: tpl.lightColor }]}>
          <View style={[styles.templateDot, { backgroundColor: primary }]} />
          <Text style={[styles.templateName, { color: primary }]}>{tpl.name}</Text>
        </View>

        {/* Logo */}
        <View style={styles.logoBoxWrap}>
          {logoUri ? (
            <View style={styles.logoBox}>
              <Image source={{ uri: logoUri }} style={styles.logoImage} />
              <TouchableOpacity style={styles.logoClearBtn} onPress={() => setLogoUri(null)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons name="close-circle" size={20} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.logoPlaceholderBox} onPress={pickLogo} activeOpacity={0.7}>
              <Ionicons name="image-outline" size={28} color={Colors.textMuted} />
              <Text style={styles.logoText}>{t('invoice.addLogo')}</Text>
            </TouchableOpacity>
          )}
          {logoUri && (
            <TouchableOpacity style={styles.logoChangeBtn} onPress={pickLogo} activeOpacity={0.7}>
              <Ionicons name="swap-horizontal-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.logoChangeTxt}>Change</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Invoice # and dates */}
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Field label={isProforma ? 'Proforma #' : t('invoice.number')} value={invoiceNumber} onChangeText={setInvoiceNumber} /></View>
          <View style={{ flex: 1 }}><Field label={t('invoice.date')} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" /></View>
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Field label={t('invoice.dueDate')} value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" /></View>
          <View style={{ flex: 1 }}><Field label={t('invoice.vatRate')} value={vatRate} onChangeText={setVatRate} keyboardType="numeric" /></View>
        </View>

        {/* Currency selector */}
        {(() => {
          const cur = CURRENCIES.find(c => c.code === currency) ?? { code: currency, name: currency, symbol: '', flag: '💱' };
          return (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Currency</Text>
              <TouchableOpacity style={styles.currencyBtn} onPress={() => setShowCurrencyPicker(true)} activeOpacity={0.7}>
                <Text style={styles.currencyFlag}>{cur.flag}</Text>
                <View style={styles.currencyInfo}>
                  <Text style={styles.currencyCode}>{cur.code}</Text>
                  <Text style={styles.currencyName}>{cur.name}</Text>
                </View>
                <Text style={styles.currencySymbol}>{cur.symbol}</Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* FROM */}
        <SectionHeader title={t('invoice.from')} color={primary} />
        <Field label={t('invoice.issuerName')} value={from.name} onChangeText={v => setFrom(p => ({ ...p, name: v }))} />
        <Field label={t('invoice.issuerAddress')} value={from.address} onChangeText={v => setFrom(p => ({ ...p, address: v }))} multiline />
        <Field label="Email" value={from.email} onChangeText={v => setFrom(p => ({ ...p, email: v, businessEmail: v }))} keyboardType="email-address" placeholder="business@email.com" />
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Field label={t('invoice.issuerTin')} value={from.tin} onChangeText={v => setFrom(p => ({ ...p, tin: v }))} /></View>
          <View style={{ flex: 1 }}><Field label={t('clients.phone')} value={from.phone} onChangeText={v => setFrom(p => ({ ...p, phone: v }))} keyboardType="phone-pad" /></View>
        </View>

        {/* TO */}
        <SectionHeader title={t('invoice.to')} color={primary} />
        <TouchableOpacity style={[styles.chooseClientBtn, { borderColor: primary }]} onPress={() => setShowClientPicker(true)} activeOpacity={0.7}>
          <Ionicons name="people-outline" size={18} color={primary} />
          <Text style={[styles.chooseClientText, { color: primary }]}>Choose or Add Client</Text>
          <Ionicons name="chevron-forward" size={16} color={primary} />
        </TouchableOpacity>
        <Field label={t('invoice.clientName')} value={to.name} onChangeText={v => setTo(p => ({ ...p, name: v }))} />
        <Field label={t('invoice.clientAddress')} value={to.address} onChangeText={v => setTo(p => ({ ...p, address: v }))} multiline />
        <Field label="Client Email" value={to.email} onChangeText={v => setTo(p => ({ ...p, email: v }))} keyboardType="email-address" placeholder="client@email.com" />
        <Field label={t('invoice.clientTin')} value={to.tin} onChangeText={v => setTo(p => ({ ...p, tin: v }))} />

        {/* ITEMS */}
        <SectionHeader title={t('invoice.items')} color={primary} />

        {items.map((item, idx) => {
          if (item.type === 'section') {
            return (
              <View key={item.id} style={[styles.sectionItemCard, { borderLeftColor: primary }]}>
                <View style={styles.itemHeader}>
                  <Text style={[styles.sectionItemLabel, { color: primary }]}>SECTION</Text>
                  <TouchableOpacity onPress={() => removeItem(item.id)}>
                    <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.input, styles.sectionTitleInput]}
                  value={item.description}
                  onChangeText={v => updateItem(item.id, 'description', v)}
                  placeholder="Section heading..."
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            );
          }

          const itemNum = items.slice(0, idx).filter(i => i.type === 'item').length + 1;
          return (
            <View key={item.id} style={[styles.itemCard, Shadow.sm]}>
              <View style={styles.itemHeader}>
                <Text style={[styles.itemIndex, { color: primary }]}>#{itemNum}</Text>
                <TouchableOpacity
                  style={[styles.catalogBtn, { borderColor: primary + '55' }]}
                  onPress={() => { setPickerForItemId(item.id); setShowProductPicker(true); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="albums-outline" size={14} color={primary} />
                  <Text style={[styles.catalogBtnTxt, { color: primary }]}>Catalog</Text>
                </TouchableOpacity>
                {items.filter(i => i.type === 'item').length > 1 && (
                  <TouchableOpacity onPress={() => removeItem(item.id)}>
                    <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
              <Field label={t('invoice.itemDescription')} value={item.description} onChangeText={v => updateItem(item.id, 'description', v)} />
              <Field label="Notes (optional)" value={item.notes ?? ''} onChangeText={v => updateItem(item.id, 'notes', v)} multiline placeholder="Size, colour, additional details..." />
              <View style={styles.row}>
                <View style={{ flex: 1 }}><Field label={colHeaders.qty || t('invoice.itemQty')} value={item.qty} onChangeText={v => updateItem(item.id, 'qty', v)} keyboardType="numeric" /></View>
                <View style={{ flex: 2 }}><Field label={colHeaders.price || t('invoice.itemUnitPrice')} value={item.unitPrice} onChangeText={v => updateItem(item.id, 'unitPrice', v)} keyboardType="numeric" /></View>
              </View>
            </View>
          );
        })}

        {/* Add Item button */}
        <TouchableOpacity style={[styles.addItemBtn, { borderColor: primary }]} onPress={() => setShowProductPicker(true)} activeOpacity={0.7}>
          <Ionicons name="add-circle-outline" size={20} color={primary} />
          <Text style={[styles.addItemText, { color: primary }]}>{t('invoice.addItem')}</Text>
        </TouchableOpacity>

        {/* Totals */}
        <View style={[styles.totalsCard, Shadow.sm, { borderTopColor: primary }]}>
          <View style={styles.totalRow}><Text style={styles.totalLabel}>{t('invoice.subtotal')}</Text><Text style={styles.totalValue}>{subtotal.toLocaleString()} {currency}</Text></View>
          <View style={styles.totalRow}><Text style={styles.totalLabel}>{t('invoice.vat')} ({vatRate}%)</Text><Text style={styles.totalValue}>{vatAmount.toLocaleString()} {currency}</Text></View>
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text style={[styles.grandLabel, { color: primary }]}>{t('invoice.totalAmount')}</Text>
            <Text style={[styles.grandValue, { color: primary }]}>{total.toLocaleString()} {currency}</Text>
          </View>
        </View>

        <Field label={t('invoice.notes')} value={notes} onChangeText={setNotes} placeholder={t('invoice.notesPlaceholder')} multiline />

        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: primary }]} onPress={handleSave} activeOpacity={0.85}>
          <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
          <Text style={styles.saveBtnText}>{isEditing ? `Update ${docTitle}` : `Save ${docTitle}`}</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>

      <ClientPickerModal
        visible={showClientPicker}
        clients={savedClients}
        onSelect={handleSelectClient}
        onClientCreated={handleClientCreated}
        onClose={() => setShowClientPicker(false)}
      />

      <ProductPickerModal
        visible={showProductPicker}
        products={savedProducts}
        onSelect={handleSelectProduct}
        onProductSaved={handleProductSaved}
        onClose={() => { setShowProductPicker(false); setPickerForItemId(null); }}
      />

      <FullPreviewModal
        visible={showFullPreview}
        onClose={() => setShowFullPreview(false)}
        from={from} to={to} items={items}
        subtotal={subtotal} vatAmount={vatAmount} total={total}
        currency={currency} vatRate={vatRate}
        invoiceNumber={invoiceNumber} date={date} dueDate={dueDate}
        notes={notes} tpl={tpl} logoUri={logoUri} type={type} docTitle={docTitle}
      />

      <CurrencyPickerModal
        visible={showCurrencyPicker}
        selected={currency}
        onSelect={setCurrency}
        onClose={() => setShowCurrencyPicker(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md },
  templateBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.sm, padding: Spacing.sm, marginBottom: Spacing.md },
  templateDot: { width: 10, height: 10, borderRadius: 5 },
  templateName: { fontSize: FontSize.sm, fontWeight: '600' },
  logoBoxWrap: { alignSelf: 'center', alignItems: 'center', marginBottom: Spacing.lg },
  logoBox: { position: 'relative' },
  logoImage: { width: 120, height: 80, borderRadius: Radius.sm, resizeMode: 'contain' },
  logoClearBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: Colors.surface, borderRadius: 10 },
  logoPlaceholderBox: { width: 120, height: 80, borderRadius: Radius.sm, borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface },
  logoText: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
  logoChangeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  logoChangeTxt: { fontSize: FontSize.xs, color: Colors.textMuted },
  row: { flexDirection: 'row', gap: Spacing.sm },
  field: { marginBottom: Spacing.sm },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.text, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: Colors.surface, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.md, color: '#111111' },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  sectionHeader: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginTop: Spacing.lg, marginBottom: Spacing.sm, borderLeftWidth: 3, paddingLeft: Spacing.sm },
  itemCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  itemIndex: { fontSize: FontSize.sm, fontWeight: '700', flex: 1 },
  catalogBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: Radius.sm, paddingVertical: 3, paddingHorizontal: 8, marginRight: 8 },
  catalogBtnTxt: { fontSize: 11, fontWeight: '600' },
  sectionItemCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderLeftWidth: 3 },
  sectionItemLabel: { fontSize: FontSize.xs, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  sectionTitleInput: { fontWeight: '700' },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: Spacing.sm, borderWidth: 1.5, borderRadius: Radius.md, borderStyle: 'dashed', marginBottom: Spacing.md },
  addItemText: { fontSize: FontSize.sm, fontWeight: '600' },
  totalsCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md, borderTopWidth: 3 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  totalLabel: { fontSize: FontSize.md, color: Colors.textSecondary },
  totalValue: { fontSize: FontSize.md, color: Colors.text },
  grandTotal: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 6, paddingTop: 10 },
  grandLabel: { fontSize: FontSize.lg, fontWeight: '700' },
  grandValue: { fontSize: FontSize.lg, fontWeight: '700' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.md, paddingVertical: Spacing.md, marginTop: Spacing.md, ...Shadow.md },
  saveBtnText: { fontSize: FontSize.lg, fontWeight: '700', color: '#fff' },
  chooseClientBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  chooseClientText: { flex: 1, fontSize: FontSize.sm, fontWeight: '600' },

  // Currency selector
  currencyBtn:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 10 },
  currencyFlag:   { fontSize: 22 },
  currencyInfo:   { flex: 1 },
  currencyCode:   { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  currencyName:   { fontSize: FontSize.xs, color: Colors.textMuted },
  currencySymbol: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary, marginRight: 2 },
});

const cpkStyles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.surface, paddingTop: Spacing.sm },
  handle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.md },
  title:       { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  searchRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, backgroundColor: Colors.background, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.text, paddingVertical: 0 },
  list:        { paddingHorizontal: Spacing.md, paddingBottom: 24, gap: 4 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.sm, paddingVertical: 12, borderRadius: Radius.md },
  rowActive:   { backgroundColor: Colors.primaryLight },
  flag:        { fontSize: 26, width: 36, textAlign: 'center' },
  info:        { flex: 1 },
  code:        { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  codeActive:  { color: Colors.primary },
  name:        { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  symbol:      { fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary, minWidth: 32, textAlign: 'right' },
  symbolActive:{ color: Colors.primary },
  empty:       { alignItems: 'center', paddingVertical: Spacing.xl },
  emptyTxt:    { fontSize: FontSize.md, color: Colors.textMuted },
  closeBtn:    { alignItems: 'center', paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, marginTop: Spacing.sm },
  closeTxt:    { fontSize: FontSize.md, color: Colors.textMuted, fontWeight: '600' },
});

const pvStyles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  badge: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, color: Colors.textMuted, textTransform: 'uppercase' },
  expandBtn: { padding: 4 },
  header: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', marginBottom: Spacing.sm },
  logo: { width: 48, height: 36, borderRadius: 4 },
  docType: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  number: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  meta: { fontSize: FontSize.xs, color: Colors.textSecondary },
  parties: { flexDirection: 'row', marginBottom: Spacing.sm, gap: Spacing.md },
  partyLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  partyName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  itemDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1 },
  itemAmt: { fontSize: FontSize.xs, color: Colors.text, fontWeight: '600', marginLeft: 8 },
  moreItems: { fontSize: FontSize.xs, color: Colors.textMuted, paddingTop: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, marginTop: 6, borderTopWidth: 2 },
  totalLbl: { fontSize: FontSize.sm, fontWeight: '700' },
  totalVal: { fontSize: FontSize.sm, fontWeight: '700' },
});

const cpStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface, paddingTop: Spacing.md },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.lg },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  formField: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  formLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  formInput: { backgroundColor: Colors.background, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.md, color: Colors.text },
  saveBtn: { marginHorizontal: Spacing.lg, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
  saveBtnTxt: { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
  newClientBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, backgroundColor: Colors.primaryLight, borderRadius: Radius.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  newClientTxt: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 40 },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.background, borderRadius: Radius.md, padding: Spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },
  name: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  sub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  empty: { textAlign: 'center', color: Colors.textMuted, marginTop: 40, paddingHorizontal: Spacing.lg, lineHeight: 22 },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.md, margin: Spacing.md },
  cancelTxt: { fontSize: FontSize.md, color: Colors.textMuted },
});

const ppStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface, paddingTop: Spacing.md },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.lg },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  formField: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  formLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  formInput: { backgroundColor: Colors.background, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.md, color: Colors.text },
  saveBtn: { marginHorizontal: Spacing.lg, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
  saveBtnTxt: { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, backgroundColor: Colors.primaryLight, borderRadius: Radius.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  newBtnTxt: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },
  blankBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, backgroundColor: Colors.background, borderRadius: Radius.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  blankBtnTxt: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 40 },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.background, borderRadius: Radius.md, padding: Spacing.md },
  itemName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  itemNotes: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  itemPrice: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '700', marginRight: 4 },
  empty: { textAlign: 'center', color: Colors.textMuted, marginTop: 40, paddingHorizontal: Spacing.lg, lineHeight: 22 },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.md, margin: Spacing.md },
  cancelTxt: { fontSize: FontSize.md, color: Colors.textMuted },
});

const fpStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.sm },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.sm },
  heading: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.md },
  logo: { width: 80, height: 50, borderRadius: Radius.sm, marginBottom: Spacing.sm },
  docType: { fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  number: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginTop: 2 },
  meta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  partyLabel: { fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  partyName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  partySub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  sectionHead: { fontSize: FontSize.sm, fontWeight: '700', paddingVertical: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: 8 },
  itemDesc: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '600' },
  itemNotes: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  itemQty: { fontSize: FontSize.sm, color: Colors.textMuted, width: 40, textAlign: 'right' },
  itemPrice: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '600', width: 90, textAlign: 'right' },
  totalsSection: { borderTopWidth: 2, marginTop: 8, paddingTop: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalLbl: { fontSize: FontSize.md, color: Colors.textSecondary },
  totalVal: { fontSize: FontSize.md, color: Colors.text },
  notesLbl: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary, marginBottom: 4 },
  notesTxt: { fontSize: FontSize.md, color: Colors.text },
  closeBtn: { alignItems: 'center', paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.md, marginTop: Spacing.sm },
  closeTxt: { fontSize: FontSize.md, color: Colors.textMuted, fontWeight: '600' },
});

