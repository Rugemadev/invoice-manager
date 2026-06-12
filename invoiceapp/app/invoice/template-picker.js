import { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ScrollView, Dimensions, StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { TEMPLATES, STYLE_META } from '../../constants/templates';
import { buildThumbnailHTML } from '../../utils/invoice';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, Shadow } from '../../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - Spacing.md * 2 - Spacing.sm * 3) / 2;
const PREVIEW_H = Math.round(CARD_W * 1.35);

const FILTERS = [
  { id: 'all', label: 'All', isNew: false },
  ...Object.entries(STYLE_META).map(([key, m]) => ({ id: key, label: m.label, isNew: m.isNew })),
];

// ─── Real HTML thumbnail rendered via WebView ─────────────────────────────────

function TemplateThumb({ template }) {
  const html = useMemo(() => buildThumbnailHTML(template.id), [template.id]);
  return (
    <View style={{ flex: 1, overflow: 'hidden' }} pointerEvents="none">
      <WebView
        source={{ html }}
        style={{ flex: 1 }}
        scrollEnabled={false}
        scalesPageToFit={true}
        javaScriptEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        cacheEnabled={true}
        androidLayerType="hardware"
      />
    </View>
  );
}

// Keep the old shape-based preview as unused (removed in favour of WebView)
function _TemplateLayoutPreview_unused({ template }) {
  const { style, primaryColor: p, lightColor: lc, darkColor: dc } = template;

  if (style === 'wave') {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8FAFC', overflow: 'hidden' }}>
        <View style={{ backgroundColor: p, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 26, borderBottomLeftRadius: 38, borderBottomRightRadius: 38 }}>
          <View style={{ width: '55%', height: 7, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 3 }} />
          <View style={{ width: '35%', height: 5, backgroundColor: 'rgba(255,255,255,0.45)', borderRadius: 2, marginTop: 4 }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 5, marginHorizontal: 8, marginTop: 8 }}>
          {[p, dc].map((c, i) => (
            <View key={i} style={{ flex: 1, height: 24, backgroundColor: '#fff', borderRadius: 4, borderTopWidth: 2.5, borderTopColor: c }} />
          ))}
        </View>
        <View style={{ marginHorizontal: 8, marginTop: 7, height: 9, backgroundColor: p, borderRadius: 2 }} />
        {[0, 1, 2].map(i => (
          <View key={i} style={{ marginHorizontal: 8, marginTop: 2, height: 7, backgroundColor: i % 2 !== 0 ? lc + '66' : '#fff', borderRadius: 1 }} />
        ))}
        <View style={{ marginHorizontal: 8, marginTop: 7, alignItems: 'flex-end' }}>
          <View style={{ width: 65, height: 17, backgroundColor: lc, borderRadius: 6, borderWidth: 1, borderColor: p + '55' }} />
        </View>
      </View>
    );
  }

  if (style === 'geometric') {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff', overflow: 'hidden' }}>
        <View style={{ backgroundColor: '#1A2332', height: 55, overflow: 'hidden', position: 'relative' }}>
          <View style={{ position: 'absolute', top: 0, right: 0, width: 55, height: 55, backgroundColor: p, borderBottomLeftRadius: 55 }} />
          <View style={{ marginTop: 10, marginLeft: 10 }}>
            <View style={{ width: '50%', height: 7, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 3 }} />
            <View style={{ width: '30%', height: 5, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 2, marginTop: 4 }} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 5, marginHorizontal: 8, marginTop: 8 }}>
          {[p, dc].map((c, i) => (
            <View key={i} style={{ flex: 1, height: 22, backgroundColor: '#F8FAFC', borderRadius: 3, borderLeftWidth: 3, borderLeftColor: c }} />
          ))}
        </View>
        <View style={{ marginHorizontal: 8, marginTop: 7, height: 9, backgroundColor: '#1A2332', borderRadius: 2 }} />
        {[0, 1, 2].map(i => (
          <View key={i} style={{ marginHorizontal: 8, marginTop: 2, height: 7, backgroundColor: i % 2 !== 0 ? lc + '33' : '#fff', borderRadius: 1, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }} />
        ))}
        <View style={{ marginHorizontal: 8, marginTop: 6, alignItems: 'flex-end' }}>
          <View style={{ width: 70, height: 15, backgroundColor: '#F8FAFC', borderRadius: 3, borderWidth: 1, borderColor: '#E2E8F0' }} />
        </View>
      </View>
    );
  }

  if (style === 'sidebar') {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#fff' }}>
        <View style={{ width: 32, backgroundColor: p, padding: 6, alignItems: 'center' }}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: 8 }} />
          {[0, 1, 2, 3, 4].map(i => (
            <View key={i} style={{ width: '80%', height: 3, backgroundColor: 'rgba(255,255,255,0.45)', borderRadius: 2, marginTop: 5 }} />
          ))}
        </View>
        <View style={{ flex: 1, padding: 7 }}>
          <View style={{ width: '60%', height: 8, backgroundColor: p, borderRadius: 3 }} />
          <View style={{ width: '40%', height: 5, backgroundColor: dc + '88', borderRadius: 2, marginTop: 4 }} />
          <View style={{ height: 8, backgroundColor: p, borderRadius: 2, marginTop: 9 }} />
          {[0, 1, 2].map(i => (
            <View key={i} style={{ height: 7, backgroundColor: i % 2 !== 0 ? lc + '66' : '#F8FAFC', borderRadius: 1, marginTop: 2 }} />
          ))}
          <View style={{ marginTop: 7, alignItems: 'flex-end' }}>
            <View style={{ width: 55, height: 14, backgroundColor: p, borderRadius: 4 }} />
          </View>
        </View>
      </View>
    );
  }

  if (style === 'corporate') {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff', overflow: 'hidden' }}>
        <View style={{ height: 48, flexDirection: 'row' }}>
          <View style={{ flex: 6, backgroundColor: '#1A2332', justifyContent: 'center', paddingHorizontal: 8 }}>
            <View style={{ width: '70%', height: 6, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 3 }} />
            <View style={{ width: '45%', height: 4, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 2, marginTop: 4 }} />
          </View>
          <View style={{ flex: 4, backgroundColor: p, justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 8 }}>
            <View style={{ width: '80%', height: 5, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 2 }} />
            <View style={{ width: '60%', height: 4, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 2, marginTop: 3 }} />
          </View>
        </View>
        <View style={{ height: 13, backgroundColor: lc, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 6 }}>
          {[0, 1, 2].map(i => <View key={i} style={{ width: '18%', height: 4, backgroundColor: dc + '88', borderRadius: 2 }} />)}
        </View>
        <View style={{ marginHorizontal: 8, marginTop: 7, height: 8, backgroundColor: p, borderRadius: 2 }} />
        {[0, 1, 2].map(i => (
          <View key={i} style={{ marginHorizontal: 8, marginTop: 2, height: 7, backgroundColor: i % 2 !== 0 ? lc + '44' : '#F8FAFC', borderRadius: 1 }} />
        ))}
        <View style={{ marginHorizontal: 8, marginTop: 6, alignItems: 'flex-end' }}>
          <View style={{ width: 65, height: 16, backgroundColor: p, borderRadius: 4 }} />
        </View>
      </View>
    );
  }

  if (style === 'stripe') {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ height: 36, backgroundColor: p, justifyContent: 'center', paddingHorizontal: 10 }}>
          <View style={{ width: '40%', height: 7, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 3 }} />
          <View style={{ width: '25%', height: 4, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 2, marginTop: 4 }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 4, marginHorizontal: 8, marginTop: 8 }}>
          {[0, 1].map(i => (
            <View key={i} style={{ flex: 1, height: 16, backgroundColor: '#F8FAFC', borderRadius: 3, borderLeftWidth: 2, borderLeftColor: i === 0 ? p : lc }} />
          ))}
        </View>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 8, marginTop: 3, gap: 4 }}>
            <View style={{ width: 10, height: 8, backgroundColor: i % 2 !== 0 ? lc : '#F1F5F9', borderRadius: 2 }} />
            <View style={{ flex: 1, height: 6, backgroundColor: i % 2 !== 0 ? lc + '55' : '#F1F5F9', borderRadius: 2 }} />
          </View>
        ))}
        <View style={{ marginHorizontal: 8, marginTop: 5, backgroundColor: lc, borderRadius: 4, height: 14, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 8 }}>
          <View style={{ width: '40%', height: 5, backgroundColor: p, borderRadius: 2 }} />
        </View>
        <View style={{ height: 5, backgroundColor: p, marginTop: 4 }} />
      </View>
    );
  }

  if (style === 'executive') {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ backgroundColor: '#1A2332', paddingHorizontal: 10, paddingTop: 10, paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <View style={{ width: '55%', height: 7, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 3 }} />
              <View style={{ width: '35%', height: 5, backgroundColor: p, borderRadius: 2, marginTop: 4 }} />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={{ width: 40, height: 5, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 2 }} />
              <View style={{ width: 28, height: 4, backgroundColor: p + 'aa', borderRadius: 2, marginTop: 3 }} />
            </View>
          </View>
        </View>
        <View style={{ height: 3, backgroundColor: p }} />
        <View style={{ flexDirection: 'row', gap: 5, marginHorizontal: 8, marginTop: 7 }}>
          {[0, 1].map(i => <View key={i} style={{ flex: 1, height: 18, backgroundColor: '#F8FAFC', borderRadius: 3 }} />)}
        </View>
        <View style={{ marginHorizontal: 8, marginTop: 7, height: 1, borderTopWidth: 2, borderTopColor: '#1A2332' }} />
        {[0, 1, 2].map(i => (
          <View key={i} style={{ marginHorizontal: 8, marginTop: 3, height: 7, backgroundColor: '#fff', borderRadius: 1, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }} />
        ))}
        <View style={{ marginHorizontal: 8, marginTop: 7, alignItems: 'flex-end' }}>
          <View style={{ width: 65, height: 5, borderTopWidth: 2, borderTopColor: p }} />
          <View style={{ width: 55, height: 6, backgroundColor: p + '44', borderRadius: 2, marginTop: 3 }} />
        </View>
      </View>
    );
  }

  if (style === 'modern') {
    return (
      <View style={{ flex: 1, backgroundColor: '#F1F5F9', overflow: 'hidden' }}>
        <View style={{ backgroundColor: p, margin: 8, borderRadius: 9, padding: 10 }}>
          <View style={{ width: '55%', height: 8, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 3 }} />
          <View style={{ width: '35%', height: 5, backgroundColor: 'rgba(255,255,255,0.45)', borderRadius: 2, marginTop: 4 }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 5, marginHorizontal: 8 }}>
          {[0, 1].map(i => <View key={i} style={{ flex: 1, height: 22, backgroundColor: '#fff', borderRadius: 6 }} />)}
        </View>
        <View style={{ marginHorizontal: 8, marginTop: 7, height: 9, backgroundColor: lc, borderRadius: 2 }} />
        {[0, 1, 2].map(i => (
          <View key={i} style={{ marginHorizontal: 8, marginTop: 2, height: 7, backgroundColor: i % 2 !== 0 ? lc + '66' : '#fff', borderRadius: 1 }} />
        ))}
        <View style={{ marginHorizontal: 8, marginTop: 7, alignItems: 'flex-end' }}>
          <View style={{ width: 70, height: 18, backgroundColor: '#fff', borderRadius: 6 }} />
        </View>
      </View>
    );
  }

  if (style === 'classic') {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ height: 6, backgroundColor: p }} />
        <View style={{ paddingHorizontal: 10, paddingTop: 8 }}>
          <View style={{ width: '50%', height: 8, backgroundColor: p, borderRadius: 3 }} />
          <View style={{ width: '30%', height: 5, backgroundColor: dc + '77', borderRadius: 2, marginTop: 4 }} />
        </View>
        <View style={{ height: 1, backgroundColor: p, marginHorizontal: 8, marginTop: 6 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 8, marginTop: 6 }}>
          <View style={{ width: '35%', height: 5, backgroundColor: dc + '55', borderRadius: 2 }} />
          <View style={{ width: '35%', height: 5, backgroundColor: dc + '55', borderRadius: 2 }} />
        </View>
        <View style={{ marginHorizontal: 8, marginTop: 7, height: 9, backgroundColor: p, borderRadius: 2 }} />
        {[0, 1, 2].map(i => (
          <View key={i} style={{ marginHorizontal: 8, marginTop: 2, height: 7, backgroundColor: i % 2 !== 0 ? lc + '55' : '#fff', borderRadius: 1, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }} />
        ))}
        <View style={{ marginHorizontal: 8, marginTop: 5, alignItems: 'flex-end' }}>
          <View style={{ width: '40%', height: 5, backgroundColor: p, borderRadius: 2 }} />
        </View>
        <View style={{ height: 5, backgroundColor: p, marginTop: 8 }} />
      </View>
    );
  }

  if (style === 'minimal') {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff', padding: 10 }}>
        <View style={{ height: 2, backgroundColor: p, marginBottom: 9 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ width: '45%', height: 7, backgroundColor: p, borderRadius: 3 }} />
          <View style={{ width: '28%', height: 5, backgroundColor: '#9CA3AF', borderRadius: 2, marginTop: 1 }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 9 }}>
          {[0, 1].map(i => (
            <View key={i} style={{ flex: 1 }}>
              <View style={{ width: '60%', height: 4, backgroundColor: '#9CA3AF', borderRadius: 2 }} />
              <View style={{ width: '80%', height: 4, backgroundColor: '#CDD5E0', borderRadius: 2, marginTop: 4 }} />
            </View>
          ))}
        </View>
        <View style={{ height: 1, backgroundColor: '#E5E7EB', marginTop: 9 }} />
        {[0, 1, 2].map(i => (
          <View key={i} style={{ height: 7, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', marginTop: 2 }} />
        ))}
        <View style={{ marginTop: 9, alignItems: 'flex-end' }}>
          <View style={{ width: '50%', height: 10, backgroundColor: p, borderRadius: 3 }} />
        </View>
      </View>
    );
  }

  if (style === 'bold') {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ backgroundColor: p, padding: 10 }}>
          <View style={{ width: '65%', height: 9, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 3 }} />
          <View style={{ width: '40%', height: 5, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 2, marginTop: 4 }} />
        </View>
        <View style={{ backgroundColor: lc, height: 16, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: '20%', height: 4, backgroundColor: dc + '88', borderRadius: 2 }} />
          <View style={{ width: '15%', height: 4, backgroundColor: dc + '66', borderRadius: 2 }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 8, marginTop: 7 }}>
          <View style={{ width: '35%', height: 5, backgroundColor: '#94A3B8', borderRadius: 2 }} />
          <View style={{ width: '35%', height: 5, backgroundColor: '#94A3B8', borderRadius: 2 }} />
        </View>
        <View style={{ marginHorizontal: 8, marginTop: 6, height: 9, backgroundColor: dc, borderRadius: 2 }} />
        {[0, 1, 2].map(i => (
          <View key={i} style={{ marginHorizontal: 8, marginTop: 2, height: 7, backgroundColor: i % 2 !== 0 ? lc + '77' : '#fff', borderRadius: 1 }} />
        ))}
        <View style={{ backgroundColor: p, marginHorizontal: 8, marginTop: 7, borderRadius: 6, height: 20, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 8 }}>
          <View style={{ width: '45%', height: 6, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 2 }} />
        </View>
      </View>
    );
  }

  // dark / elegant
  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <View style={{ paddingHorizontal: 10, paddingTop: 10 }}>
        <View style={{ width: '55%', height: 7, backgroundColor: p, borderRadius: 3 }} />
        <View style={{ width: '35%', height: 4, backgroundColor: p + '55', borderRadius: 2, marginTop: 4 }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 5, marginHorizontal: 8, marginTop: 9 }}>
        {[0, 1].map(i => (
          <View key={i} style={{ flex: 1, height: 22, backgroundColor: '#1E293B', borderRadius: 4, borderLeftWidth: 2.5, borderLeftColor: p }} />
        ))}
      </View>
      <View style={{ marginHorizontal: 8, marginTop: 8, height: 1, backgroundColor: p + '55' }} />
      {[0, 1, 2].map(i => (
        <View key={i} style={{ marginHorizontal: 8, marginTop: 4, height: 7, backgroundColor: '#1E293B', borderRadius: 1 }} />
      ))}
      <View style={{ marginHorizontal: 8, marginTop: 8, alignItems: 'flex-end' }}>
        <View style={{ width: '50%', height: 8, backgroundColor: p, borderRadius: 2 }} />
      </View>
    </View>
  );
}

// ─── Template card ────────────────────────────────────────────────────────────

function TemplateCard({ template, onPress }) {
  const meta = STYLE_META[template.style];
  return (
    <TouchableOpacity style={[s.card, { width: CARD_W }]} onPress={onPress} activeOpacity={0.82}>
      <View style={[s.previewBox, { height: PREVIEW_H }]}>
        <TemplateThumb template={template} />
        {meta?.isNew && (
          <View style={s.newBadge}>
            <Text style={s.newBadgeTxt}>NEW</Text>
          </View>
        )}
      </View>
      <View style={s.cardFooter}>
        <Text style={s.cardName} numberOfLines={1}>{template.name}</Text>
        <View style={[s.dot, { backgroundColor: template.primaryColor }]} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

function FilterChip({ filter, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[s.chip, active && s.chipActive]}
    >
      <Text style={[s.chipTxt, active && s.chipTxtActive]}>{filter.label}</Text>
      {filter.isNew && !active && <View style={s.newDot} />}
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TemplatePicker() {
  const router = useRouter();
  const { type, docTitle } = useLocalSearchParams();
  const label = docTitle ? decodeURIComponent(docTitle) : (type === 'proforma' ? 'Proforma Invoice' : 'Invoice');
  const [activeFilter, setActiveFilter] = useState('all');

  const filtered = useMemo(
    () => activeFilter === 'all' ? TEMPLATES : TEMPLATES.filter(t => t.style === activeFilter),
    [activeFilter],
  );

  const handleSelect = (templateId) => {
    const dtParam = docTitle ? `&docTitle=${docTitle}` : '';
    router.push(`/invoice/template-preview?type=${type}&templateId=${templateId}${dtParam}`);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Choose Template', headerBackTitle: '' }} />
      <StatusBar barStyle="dark-content" />
      <View style={s.container}>
        {/* Header banner */}
        <View style={s.banner}>
          <Text style={s.bannerSub}>Creating a</Text>
          <Text style={s.bannerTitle}>{label}</Text>
          <Text style={s.bannerCount}>{filtered.length} of {TEMPLATES.length} templates</Text>
        </View>

        {/* Style filter tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.filterScroll}
          contentContainerStyle={s.filterRow}
        >
          {FILTERS.map(f => (
            <FilterChip
              key={f.id}
              filter={f}
              active={activeFilter === f.id}
              onPress={() => setActiveFilter(f.id)}
            />
          ))}
        </ScrollView>

        {/* Grid */}
        <FlatList
          data={filtered}
          keyExtractor={t => t.id}
          numColumns={2}
          key={activeFilter}
          columnWrapperStyle={s.row}
          contentContainerStyle={s.grid}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={3}
          renderItem={({ item }) => (
            <TemplateCard template={item} onPress={() => handleSelect(item.id)} />
          )}
        />
      </View>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  banner: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: 4 },
  bannerSub:   { fontSize: FontSize.xs, color: Colors.textMuted },
  bannerTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text, marginTop: 1 },
  bannerCount: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  filterScroll: { flexGrow: 0, flexShrink: 0 },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 10,
  },
  chip: {
    flexShrink: 0,          // never compress — always show full label
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt:    { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  chipTxtActive: { color: '#fff' },
  newDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },

  grid: { paddingHorizontal: Spacing.md, paddingTop: 4, paddingBottom: 40, gap: Spacing.sm },
  row:  { gap: Spacing.sm, justifyContent: 'flex-start' },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  previewBox: { overflow: 'hidden', position: 'relative' },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 10, paddingVertical: 8,
  },
  cardName: { flex: 1, fontSize: 11, fontWeight: '600', color: Colors.text, marginRight: 6 },
  dot:      { width: 10, height: 10, borderRadius: 5 },

  newBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: '#EF4444', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  newBadgeTxt: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
});
