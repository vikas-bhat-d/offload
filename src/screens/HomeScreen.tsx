/**
 * Offload — HomeScreen
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Animated, StatusBar, ActivityIndicator,
  Modal, KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { Zap, FileText, Link as LinkIcon, Image as ImageIcon, Sparkles, Plus } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { textStyles } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { shadows } from '../theme/shadows';
import { SkeletonCard } from '../components/Skeleton';
import { toast } from '../components/Toast';
import { useAppContext } from '../context/AppContext';
import { modelManager } from '../services/modelManager';
import { runTextEmbedding } from '../services/embedding';
import { insertItem, getAllItems } from '../services/storage';

function ItemCard({ item, index }: { item: any; index: number }) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 300, delay: index * 60, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 300, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const getTimestamp = () => {
    if (!item.created_at) return '';
    const diff = Date.now() - item.created_at;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <Animated.View style={[styles.itemCard, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
      <TouchableOpacity activeOpacity={0.7} style={styles.itemCardInner}>
        <View style={styles.itemTypeRow}>
          <View style={styles.typeBadge}>
            {item.content_type === 'text' ? <FileText size={14} color={colors.text.secondary} /> : item.content_type === 'link' ? <LinkIcon size={14} color={colors.text.secondary} /> : <ImageIcon size={14} color={colors.text.secondary} />}
          </View>
          <Text style={styles.itemTimestamp}>{getTimestamp()}</Text>
        </View>
        <Text style={styles.itemPreview} numberOfLines={3}>
          {item.preview_text || item.raw_content || 'No preview'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function EmptyState() {
  const fadeIn = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }).start(); }, []);

  return (
    <Animated.View style={[styles.emptyState, { opacity: fadeIn }]}>
      <Sparkles size={48} color={colors.accent.primary} style={{ marginBottom: spacing.lg }} />
      <Text style={styles.emptyTitle}>Nothing here yet</Text>
      <Text style={styles.emptySubtitle}>
        Tap the + button to add your first thought,{'\n'}note, or link.
      </Text>
    </Animated.View>
  );
}

export function HomeScreen() {
  const { embeddingReady } = useAppContext();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadItems = useCallback(async () => {
    try { setItems(await getAllItems()); }
    catch { toast.error('Failed to load items'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  const handleSave = async () => {
    if (!inputText.trim()) return;
    if (!embeddingReady) { toast.warning('Model not ready', 'Download the embedding model first.'); return; }
    setIsSaving(true);
    try {
      const modelPath = modelManager.getModelPath('nomic-embed-text');
      const result = await runTextEmbedding(inputText.trim(), modelPath);
      if (!result.success || !result.vector) throw new Error(result.error || 'Embedding failed');
      const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      await insertItem(id, inputText.trim(), result.vector);
      toast.success('Saved', 'Item embedded and stored.');
      setInputText('');
      setShowAddModal(false);
      Keyboard.dismiss();
      loadItems();
    } catch (err: any) { toast.error('Failed to save', err.message); }
    finally { setIsSaving(false); }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg.base} />
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Zap size={24} color={colors.text.primary} />
          <Text style={styles.headerTitle}>Offload</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          {items.length > 0 ? `${items.length} items saved` : 'Your semantic memory'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.skeletonContainer}><SkeletonCard /><SkeletonCard /><SkeletonCard /></View>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, i) => item.id || i.toString()}
          renderItem={({ item, index }) => <ItemCard item={item} index={index} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity style={styles.fab} activeOpacity={0.8} onPress={() => setShowAddModal(true)}>
        <Plus size={28} color={colors.text.inverse} />
      </TouchableOpacity>

      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => { if (!isSaving) { setShowAddModal(false); Keyboard.dismiss(); } }} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add New Item</Text>
            <TextInput
              style={styles.modalInput} value={inputText} onChangeText={setInputText}
              multiline placeholder="Type a thought, quote, link, or note…"
              placeholderTextColor={colors.text.muted} autoFocus editable={!isSaving}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setShowAddModal(false); Keyboard.dismiss(); }} disabled={isSaving}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, (!inputText.trim() || isSaving) && styles.modalSaveBtnDisabled]}
                activeOpacity={0.7} onPress={handleSave} disabled={!inputText.trim() || isSaving}>
                {isSaving ? <ActivityIndicator size="small" color={colors.text.inverse} /> : <Text style={styles.modalSaveText}>Embed & Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base },
  header: { paddingTop: spacing['5xl'], paddingBottom: spacing.base, paddingHorizontal: spacing.xl, backgroundColor: colors.bg.base, borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headerTitle: { ...textStyles.h1, color: colors.text.primary },
  headerSubtitle: { ...textStyles.bodySm, color: colors.text.muted, marginTop: spacing.xxs },
  listContent: { padding: spacing.base, paddingBottom: 100 },
  skeletonContainer: { padding: spacing.base },
  itemCard: { marginBottom: spacing.md },
  itemCardInner: { backgroundColor: colors.bg.surface, borderRadius: borderRadius.lg, padding: spacing.base, borderWidth: 1, borderColor: colors.border.subtle },
  itemTypeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  typeBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.bg.elevated, alignItems: 'center', justifyContent: 'center' },
  itemTimestamp: { ...textStyles.caption, color: colors.text.muted },
  itemPreview: { ...textStyles.body, color: colors.text.primary },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['2xl'] },
  emptyTitle: { ...textStyles.h2, color: colors.text.primary, marginBottom: spacing.sm },
  emptySubtitle: { ...textStyles.body, color: colors.text.secondary, textAlign: 'center', lineHeight: 22 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent.primary, alignItems: 'center', justifyContent: 'center', ...shadows.glow },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  modalSheet: { backgroundColor: colors.bg.surface, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.xl, paddingBottom: spacing['3xl'], borderTopWidth: 1, borderColor: colors.border.subtle },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border.medium, alignSelf: 'center', marginBottom: spacing.lg },
  modalTitle: { ...textStyles.h2, color: colors.text.primary, marginBottom: spacing.base },
  modalInput: { backgroundColor: colors.bg.elevated, borderRadius: borderRadius.md, color: colors.text.primary, padding: spacing.base, minHeight: 120, textAlignVertical: 'top', fontSize: 15, lineHeight: 22, borderWidth: 1, borderColor: colors.border.subtle, marginBottom: spacing.base },
  modalActions: { flexDirection: 'row', gap: spacing.md },
  modalCancelBtn: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: borderRadius.sm, backgroundColor: colors.bg.elevated },
  modalCancelText: { ...textStyles.bodyMedium, color: colors.text.secondary },
  modalSaveBtn: { flex: 2, paddingVertical: spacing.md, alignItems: 'center', borderRadius: borderRadius.sm, backgroundColor: colors.accent.primary },
  modalSaveBtnDisabled: { backgroundColor: colors.bg.elevated },
  modalSaveText: { ...textStyles.bodyMedium, color: colors.text.inverse, fontWeight: '700' },
});
