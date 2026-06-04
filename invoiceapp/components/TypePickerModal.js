import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, Shadow } from '../constants/theme';

const DOC_TYPES = [
  { type: 'invoice',  docTitle: 'Invoice',          icon: 'document-text',            color: Colors.primary,  sub: 'Standard payment request' },
  { type: 'proforma', docTitle: 'Proforma Invoice', icon: 'document-outline',         color: '#8B5CF6',       sub: 'Quote before work begins' },
  { type: 'invoice',  docTitle: 'Delivery Note',    icon: 'cube-outline',             color: '#10B981',       sub: 'Confirms goods delivered' },
  { type: 'invoice',  docTitle: 'Receipt',          icon: 'receipt-outline',          color: '#F59E0B',       sub: 'Proof of payment received' },
  { type: 'invoice',  docTitle: 'Quotation',        icon: 'calculator-outline',       color: '#EC4899',       sub: 'Formal price estimate' },
  { type: 'invoice',  docTitle: 'Purchase Order',   icon: 'cart-outline',             color: '#0EA5E9',       sub: 'Order to a supplier' },
  { type: 'invoice',  docTitle: 'Credit Note',      icon: 'arrow-undo-outline',       color: '#EF4444',       sub: 'Refund or credit adjustment' },
];

export default function TypePickerModal({ visible, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>What are you preparing?</Text>
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {DOC_TYPES.map(({ type, docTitle, icon, color, sub }) => (
              <TouchableOpacity
                key={docTitle}
                style={[styles.option, { borderColor: color + '44' }]}
                onPress={() => onSelect({ type, docTitle })}
                activeOpacity={0.8}
              >
                <View style={[styles.iconBox, { backgroundColor: color + '18' }]}>
                  <Ionicons name={icon} size={24} color={color} />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>{docTitle}</Text>
                  <Text style={styles.optionSub}>{sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, paddingBottom: 36,
    maxHeight: '85%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.md },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderWidth: 1.5, borderRadius: Radius.md, padding: Spacing.sm,
    marginBottom: Spacing.sm, backgroundColor: Colors.background,
  },
  iconBox: { width: 44, height: 44, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
  optionText: { flex: 1 },
  optionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  optionSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.md, marginTop: 4 },
  cancelText: { fontSize: FontSize.md, color: Colors.textMuted },
});
