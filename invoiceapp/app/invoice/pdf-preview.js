import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { getTemplate } from '../../constants/templates';
import { buildInvoiceHTML, shareInvoice, printInvoice } from '../../utils/invoice';
import { getInvoices } from '../../utils/storage';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, Shadow } from '../../constants/theme';

export default function PdfPreview() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [html, setHtml]             = useState(null);
  const [invoice, setInvoice]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [webLoading, setWebLoading] = useState(true);
  const [sharing, setSharing]       = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await getInvoices();
        const inv = all.find(i => i.id === id);
        if (!inv || cancelled) return;
        setInvoice(inv);
        const result = await buildInvoiceHTML(inv);
        if (!cancelled) { setHtml(result); setLoading(false); }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const tpl     = invoice ? getTemplate(invoice.templateId) : null;
  const primary = tpl?.primaryColor ?? Colors.primary;

  const handleShare = useCallback(async () => {
    if (!invoice || sharing) return;
    setSharing(true);
    try { await shareInvoice(invoice); } catch {}
    setSharing(false);
  }, [invoice, sharing]);

  const handlePrint = useCallback(async () => {
    if (!invoice) return;
    try { await printInvoice(invoice); } catch {}
  }, [invoice]);

  return (
    <>
      <Stack.Screen
        options={{
          title: invoice?.number ?? 'PDF Preview',
          headerStyle: { backgroundColor: primary },
          headerTintColor: '#fff',
          headerBackTitle: '',
        }}
      />
      <SafeAreaView style={s.container}>

        {/* WebView area */}
        <View style={s.webWrap}>
          {(loading || webLoading) && (
            <View style={s.loader}>
              <ActivityIndicator size="large" color={primary} />
              <Text style={s.loaderTxt}>Rendering PDF preview…</Text>
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
              <Text style={s.loaderTxt}>Could not render preview</Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={[s.footer, { borderTopColor: Colors.border }]}>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: primary }]}
            onPress={handleShare}
            activeOpacity={0.85}
            disabled={sharing}
          >
            {sharing
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="share-outline" size={20} color="#fff" />
            }
            <Text style={s.btnTxt}>{sharing ? 'Preparing…' : 'Share / Send'}</Text>
          </TouchableOpacity>

          <View style={s.secondRow}>
            <TouchableOpacity style={[s.outlineBtn, { borderColor: primary }]} onPress={handlePrint} activeOpacity={0.8}>
              <Ionicons name="print-outline" size={18} color={primary} />
              <Text style={[s.outlineTxt, { color: primary }]}>Print</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.outlineBtn, { borderColor: Colors.border }]} onPress={() => router.back()} activeOpacity={0.8}>
              <Ionicons name="arrow-back-outline" size={18} color={Colors.textSecondary} />
              <Text style={[s.outlineTxt, { color: Colors.textSecondary }]}>Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  webWrap:   { flex: 1, backgroundColor: '#fff' },
  web:       { flex: 1 },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.background, gap: 12,
  },
  loaderTxt: { fontSize: FontSize.sm, color: Colors.textMuted },

  footer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    gap: 8,
  },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: Radius.md,
    ...Shadow.sm,
  },
  btnTxt: { fontSize: FontSize.md, fontWeight: '800', color: '#fff' },

  secondRow: { flexDirection: 'row', gap: 10 },
  outlineBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1.5,
  },
  outlineTxt: { fontSize: FontSize.sm, fontWeight: '700' },
});
