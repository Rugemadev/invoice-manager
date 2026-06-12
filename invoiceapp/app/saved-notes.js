import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, Shadow } from '../constants/theme';
import { getSavedNotes, saveSavedNote, deleteSavedNote } from '../utils/storage';

export default function SavedNotes() {
  const [notes, setNotes]         = useState([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing]     = useState(null); // null = new
  const [title, setTitle]         = useState('');
  const [content, setContent]     = useState('');

  const load = useCallback(async () => {
    setNotes(await getSavedNotes());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openNew = () => {
    setEditing(null);
    setTitle('');
    setContent('');
    setShowEditor(true);
  };

  const openEdit = note => {
    setEditing(note);
    setTitle(note.title);
    setContent(note.content);
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('', 'Please enter a title.'); return; }
    if (!content.trim()) { Alert.alert('', 'Please enter the note content.'); return; }
    const note = {
      id: editing?.id ?? `note_${Date.now()}`,
      title: title.trim(),
      content: content.trim(),
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };
    await saveSavedNote(note);
    setShowEditor(false);
    load();
  };

  const handleDelete = note => {
    Alert.alert('Delete Note', `Delete "${note.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteSavedNote(note.id); load(); } },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{
        title: 'Saved Notes',
        headerRight: () => (
          <TouchableOpacity onPress={openNew} style={{ marginRight: 4 }}>
            <Ionicons name="add" size={26} color={Colors.primary} />
          </TouchableOpacity>
        ),
      }} />

      <FlatList
        data={notes}
        keyExtractor={item => item.id}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="document-text-outline" size={48} color={Colors.textMuted} />
            <Text style={s.emptyTitle}>No saved notes yet</Text>
            <Text style={s.emptySub}>Create reusable notes with payment details,{'\n'}company info, or any text you use often.</Text>
            <TouchableOpacity style={[s.newBtn, { backgroundColor: Colors.primary }]} onPress={openNew}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={s.newBtnTxt}>Create your first note</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[s.card, Shadow.sm]}>
            <TouchableOpacity style={s.cardBody} onPress={() => openEdit(item)} activeOpacity={0.75}>
              <Ionicons name="document-text-outline" size={20} color={Colors.primary} style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.noteTitle}>{item.title}</Text>
                <Text style={s.notePreview} numberOfLines={2}>{item.content}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item)} style={s.delBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={18} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        )}
      />

      <Modal visible={showEditor} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEditor(false)}>
        <KeyboardAvoidingView style={s.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>{editing ? 'Edit Note' : 'New Saved Note'}</Text>

          <Text style={s.fieldLabel}>Title</Text>
          <TextInput
            style={s.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Payment Instructions"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="words"
          />

          <Text style={s.fieldLabel}>Note Content</Text>
          <TextInput
            style={[s.input, s.inputMulti]}
            value={content}
            onChangeText={setContent}
            placeholder={'e.g. Payment via MTN MoMo: +250 788 xxx xxx\nPlease include invoice number as reference.\n\nThank you for your business!'}
            placeholderTextColor={Colors.textMuted}
            multiline
            autoCapitalize="sentences"
          />

          <TouchableOpacity style={[s.saveBtn, { backgroundColor: Colors.primary }]} onPress={handleSave} activeOpacity={0.85}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            <Text style={s.saveBtnTxt}>{editing ? 'Update Note' : 'Save Note'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.cancelBtn} onPress={() => setShowEditor(false)}>
            <Text style={s.cancelBtnTxt}>Cancel</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  list:        { padding: Spacing.md, gap: Spacing.sm },
  card:        { backgroundColor: Colors.surface, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', paddingRight: Spacing.md },
  cardBody:    { flex: 1, flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, alignItems: 'flex-start' },
  noteTitle:   { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginBottom: 3 },
  notePreview: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
  delBtn:      { padding: 6 },

  empty:      { alignItems: 'center', paddingTop: 80, paddingHorizontal: Spacing.xl },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, marginTop: Spacing.md },
  emptySub:   { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  newBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: Radius.md, paddingVertical: 12, paddingHorizontal: 20, marginTop: Spacing.lg },
  newBtnTxt:  { color: '#fff', fontSize: FontSize.sm, fontWeight: '700' },

  modal:      { flex: 1, backgroundColor: Colors.surface, padding: Spacing.lg, paddingTop: Spacing.md },
  modalHandle:{ width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4, marginTop: Spacing.sm },
  input:      { backgroundColor: Colors.background, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.sm, paddingVertical: 10, fontSize: FontSize.md, color: Colors.text },
  inputMulti: { minHeight: 140, textAlignVertical: 'top', paddingTop: 10 },
  saveBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.md, paddingVertical: Spacing.md, marginTop: Spacing.lg, ...Shadow.sm },
  saveBtnTxt: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  cancelBtn:  { alignItems: 'center', paddingVertical: Spacing.sm, marginTop: 4 },
  cancelBtnTxt: { fontSize: FontSize.md, color: Colors.textMuted },
});
