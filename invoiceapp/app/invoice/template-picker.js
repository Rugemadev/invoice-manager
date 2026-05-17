import { useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { TEMPLATES } from '../../constants/templates';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, Shadow } from '../../constants/theme';

function TemplateCard({ template, onPress }) {
  const [c1, c2, c3] = template.previewColors;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      {/* Mini preview */}
      <View style={[styles.preview, { backgroundColor: c2 }]}>
        <View style={[styles.previewHeader, { backgroundColor: c1 }]} />
        <View style={styles.previewBody}>
          <View style={[styles.previewLine, { backgroundColor: c3, width: '70%' }]} />
          <View style={[styles.previewLine, { backgroundColor: c3 + '88', width: '50%' }]} />
          <View style={[styles.previewLine, { backgroundColor: c3 + '55', width: '60%' }]} />
        </View>
        <View style={[styles.previewDot, { backgroundColor: c1 }]} />
      </View>
      <Text style={styles.name} numberOfLines={2}>{template.name}</Text>
    </TouchableOpacity>
  );
}

export default function TemplatePicker() {
  const router = useRouter();
  const { type } = useLocalSearchParams();
  const label = type === 'proforma' ? 'Proforma Invoice' : 'Invoice';

  const handleSelect = (templateId) => {
    router.push(`/invoice/create?type=${type}&templateId=${templateId}`);
  };

  return (
    <>
      <Stack.Screen options={{ title: `Choose Template`, headerBackTitle: '' }} />
      <View style={styles.container}>
        <View style={styles.banner}>
          <Text style={styles.bannerLabel}>Creating a</Text>
          <Text style={styles.bannerType}>{label}</Text>
          <Text style={styles.bannerSub}>{TEMPLATES.length} templates available</Text>
        </View>
        <FlatList
          data={TEMPLATES}
          keyExtractor={t => t.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TemplateCard template={item} onPress={() => handleSelect(item.id)} />
          )}
        />
      </View>
    </>
  );
}

const CARD_W = 160;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  banner: { padding: Spacing.md, paddingBottom: Spacing.sm },
  bannerLabel: { fontSize: FontSize.sm, color: Colors.textMuted },
  bannerType: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text },
  bannerSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 40 },
  row: { gap: Spacing.sm, justifyContent: 'space-between' },
  card: {
    width: CARD_W, backgroundColor: Colors.surface,
    borderRadius: Radius.md, overflow: 'hidden', ...Shadow.sm,
  },
  preview: { height: 100, padding: 0 },
  previewHeader: { height: 28 },
  previewBody: { padding: 8, gap: 5 },
  previewLine: { height: 5, borderRadius: 3 },
  previewDot: { position: 'absolute', right: 10, bottom: 10, width: 20, height: 20, borderRadius: 10 },
  name: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.text, padding: Spacing.sm, paddingTop: 6 },
});
