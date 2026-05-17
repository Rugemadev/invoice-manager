import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, Shadow } from '../constants/theme';

export default function TypePickerModal({ visible, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>What are you creating?</Text>

          <TouchableOpacity style={[styles.option, { borderColor: Colors.primary }]} onPress={() => onSelect('invoice')} activeOpacity={0.8}>
            <View style={[styles.iconBox, { backgroundColor: Colors.primaryLight }]}>
              <Ionicons name="document-text" size={28} color={Colors.primary} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Invoice</Text>
              <Text style={styles.optionSub}>Request payment for completed work</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.option, { borderColor: Colors.accent }]} onPress={() => onSelect('proforma')} activeOpacity={0.8}>
            <View style={[styles.iconBox, { backgroundColor: Colors.accentLight }]}>
              <Ionicons name="document-outline" size={28} color={Colors.accent} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Proforma Invoice</Text>
              <Text style={styles.optionSub}>Quote before work begins</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </TouchableOpacity>

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
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, paddingBottom: 40 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.lg },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderWidth: 1.5, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm,
    backgroundColor: Colors.surface, ...Shadow.sm,
  },
  iconBox: { width: 52, height: 52, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
  optionText: { flex: 1 },
  optionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  optionSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.md, marginTop: Spacing.xs },
  cancelText: { fontSize: FontSize.md, color: Colors.textMuted },
});
