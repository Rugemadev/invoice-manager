import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { getTemplate } from '../../constants/templates';
import { buildInvoiceHTML } from '../../utils/invoice';
import { getSettings } from '../../utils/storage';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, Shadow } from '../../constants/theme';


// Map doc title → number prefix (and whether a due date applies)
const DOC_META = {
  'invoice':          { prefix: 'INV',  hasDue: true  },
  'proforma invoice': { prefix: 'PRO',  hasDue: true  },
  'receipt':          { prefix: 'REC',  hasDue: false },
  'quotation':        { prefix: 'QUO',  hasDue: true  },
  'purchase order':   { prefix: 'PO',   hasDue: true  },
  'delivery note':    { prefix: 'DN',   hasDue: false },
  'credit note':      { prefix: 'CN',   hasDue: false },
};

function makeSampleInvoice(templateId, docTitle) {
  const today = new Date();
  const due   = new Date(today.getTime() + 14 * 86400000);
  const fmt   = d => d.toISOString().split('T')[0];
  const title = docTitle || 'Invoice';
  const meta  = DOC_META[title.toLowerCase()] ?? { prefix: 'DOC', hasDue: true };
  return {
    id: 'PREVIEW',
    number: `${meta.prefix}-2025-0042`,
    type: 'invoice',
    docTitle: title.toUpperCase(),
    templateId,
    date:    fmt(today),
    dueDate: meta.hasDue ? fmt(due) : null,
    status: 'draft',
    archived: false,
    noLogo: false,       // will attempt to load real logo
    logoUri: null,
    signature: null,
    from: {
      name: 'Kigali Creative Ltd',
      address: 'KG 15 Ave, Gasabo\nKigali, Rwanda',
      tin: '102345678',
      phone: '+250 788 123 456',
      email: 'hello@kigalicreative.rw',
      instagram: '@kigalicreative',
      website: 'www.kigalicreative.rw',
      businessEmail: 'billing@kigalicreative.rw',
    },
    to: {
      name: 'Muhanga Tech Solutions',
      address: 'Southern Province, Rwanda',
      tin: '201234567',
      email: 'accounts@muhanga.rw',
    },
    items: [
      { id: '1', type: 'item', description: 'Web Design & Development', notes: 'Responsive website, 5 pages', qty: 1, unitPrice: 180000, extra: '' },
      { id: '2', type: 'item', description: 'Brand Identity Package',   notes: 'Logo, colors & typography guide', qty: 1, unitPrice: 95000,  extra: '' },
      { id: '3', type: 'item', description: 'Monthly Maintenance',      notes: 'Updates & technical support',    qty: 3, unitPrice: 30000,  extra: '' },
      { id: '4', type: 'item', description: 'SEO Optimization',         notes: '',                               qty: 1, unitPrice: 55000,  extra: '' },
    ],
    colHeaders: { desc: 'Description', qty: 'Qty', price: 'Unit Price', extraLabel: '' },
    vatRate: 18,
    currency: 'RWF',
    subtotal: 420000,
    vatAmount: 75600,
    total:     495600,
    notes: 'Payment due within 14 days. Bank transfer or Mobile Money accepted.\nThank you for choosing us!',
    createdAt:          new Date().toISOString(),
    paymentMethod:      null,
    paymentMethodLabel: null,
  };
}

export default function TemplatePreview() {
  const router = useRouter();
  const { templateId, type, docTitle } = useLocalSearchParams();
  const tpl = getTemplate(templateId);
  const label = docTitle ? decodeURIComponent(docTitle) : 'Invoice';

  const [html,    setHtml]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [webLoading, setWebLoading] = useState(true);

  // Build HTML preview from real invoice engine (same as PDF output)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const settings = await getSettings();
        const sample = makeSampleInvoice(templateId, label);
        // Patch from-block with real business settings for a personalised preview
        if (settings?.name)    sample.from.name    = settings.name;
        if (settings?.address) sample.from.address = settings.address;
        if (settings?.tin)     sample.from.tin     = settings.tin;
        if (settings?.phone)   sample.from.phone   = settings.phone;
        if (settings?.email)   sample.from.email   = settings.email;
        if (settings?.currency) {
          sample.currency = settings.currency;
          // keep rounded numbers; just update the label
        }
        const result = await buildInvoiceHTML(sample);
        if (!cancelled) { setHtml(result); setLoading(false); }
      } catch {
        if (!cancelled) { setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [templateId, label]);

  const useTemplate = useCallback(() => {
    const dtParam = docTitle ? `&docTitle=${docTitle}` : '';
    router.replace(`/invoice/create?type=${type}&templateId=${templateId}${dtParam}`);
  }, [templateId, type, docTitle]);

  return (
    <>
      <Stack.Screen
        options={{
          title: tpl.name,
          headerBackTitle: 'Back',
          headerRight: () => (
            <TouchableOpacity onPress={useTemplate} style={hdr.btn} activeOpacity={0.75}>
              <Text style={hdr.btnTxt}>Use</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={s.container}>

        {/* Template name strip */}
        <View style={[s.strip, { backgroundColor: tpl.primaryColor }]}>
          <View style={[s.dot, { backgroundColor: tpl.lightColor }]} />
          <Text style={s.stripName}>{tpl.name}</Text>
          <Text style={s.stripHint}>Tap "Use" to apply this template</Text>
        </View>

        {/* Preview WebView */}
        <View style={s.webContainer}>
          {(loading || webLoading) && (
            <View style={s.loader}>
              <ActivityIndicator size="large" color={tpl.primaryColor} />
              <Text style={s.loaderTxt}>Rendering preview…</Text>
            </View>
          )}
          {!loading && html && (
            <WebView
              style={[s.web, webLoading && { opacity: 0 }]}
              source={{ html }}
              scrollEnabled
              showsVerticalScrollIndicator={false}
              scalesPageToFit={true}
              onLoadEnd={() => setWebLoading(false)}
            />
          )}
          {!loading && !html && (
            <View style={s.loader}>
              <Ionicons name="alert-circle-outline" size={40} color={Colors.textMuted} />
              <Text style={s.loaderTxt}>Failed to render preview</Text>
            </View>
          )}
        </View>

        {/* Bottom CTA */}
        <View style={s.footer}>
          <TouchableOpacity style={[s.useBtn, { backgroundColor: tpl.primaryColor }]} onPress={useTemplate} activeOpacity={0.85}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={s.useBtnTxt}>Use This Template</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.75}>
            <Text style={s.backBtnTxt}>Back to Gallery</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </>
  );
}

const hdr = StyleSheet.create({
  btn:    { marginRight: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: Colors.primary },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
});

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.background },

  strip:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  dot:          { width: 10, height: 10, borderRadius: 5 },
  stripName:    { fontSize: FontSize.sm, fontWeight: '700', color: '#fff', flex: 1 },
  stripHint:    { fontSize: 10, color: 'rgba(255,255,255,0.7)' },

  webContainer: { flex: 1, backgroundColor: '#fff' },
  web:          { flex: 1 },

  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.background, gap: 12,
  },
  loaderTxt: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 4 },

  footer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  useBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: Radius.md,
    ...Shadow.sm,
  },
  useBtnTxt: { fontSize: FontSize.md, fontWeight: '800', color: '#fff' },
  backBtn:   { alignItems: 'center', paddingVertical: 8 },
  backBtnTxt:{ fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
});
