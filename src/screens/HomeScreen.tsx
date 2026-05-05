/**
 * Offload -- HomeScreen
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Animated,
  StatusBar,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FileText, Link as LinkIcon, Image as ImageIcon, Plus, Trash2, ExternalLink } from 'lucide-react-native';
import ShareMenu from 'react-native-share-menu';
import { colors } from '../theme/colors';
import { textStyles } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { shadows } from '../theme/shadows';
import { SkeletonCard } from '../components/Skeleton';
import { toast } from '../components/Toast';
import { Logo } from '../components/Logo';
import { useAppContext } from '../context/AppContext';
import { modelManager } from '../services/modelManager';
import { isUrl } from '../services/linkMeta';
import { ingestText, ingestLink, ingestAuto } from '../services/ingestion';
import { getAllItems, deleteItem } from '../services/storage';
import type { HomeStackParamList } from '../navigation/types';

// ─── ItemCard ────────────────────────────────────────

interface ItemCardProps {
  item: any;
  index: number;
  onDelete: (id: string) => void;
  onPress: (item: any) => void;
}

function ItemCard({ item, index, onDelete, onPress }: ItemCardProps) {
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

  const handleDelete = () => {
    Alert.alert(
      'Delete item',
      'This item will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(item.id),
        },
      ],
    );
  };

  const isLink = item.content_type === 'link';
  const isImage = item.content_type === 'image';

  const TypeIcon = isLink ? LinkIcon : isImage ? ImageIcon : FileText;

  return (
    <Animated.View style={[styles.itemCard, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
      <TouchableOpacity activeOpacity={0.75} onPress={() => onPress(item)} style={styles.itemCardInner}>
        {/* Header row: type badge + source label + timestamp + delete */}
        <View style={styles.itemTopRow}>
          <View style={styles.itemTopLeft}>
            <View style={[styles.typeBadge, isLink && styles.typeBadgeLink, isImage && styles.typeBadgeImage]}>
              <TypeIcon size={13} color={isLink ? colors.accent.primary : isImage ? colors.text.secondary : colors.text.secondary} />
            </View>
            {isLink && item.source_name ? (
              <Text style={styles.sourceName}>{item.source_name}</Text>
            ) : isImage ? (
              <Text style={styles.sourceName}>Image</Text>
            ) : null}
          </View>
          <View style={styles.itemTopRight}>
            <Text style={styles.itemTimestamp}>{getTimestamp()}</Text>
            <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.deleteBtn}>
              <Trash2 size={14} color={colors.text.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content preview */}
        <Text style={styles.itemPreview} numberOfLines={isLink ? 2 : 3}>
          {item.preview_text || item.raw_content || 'No preview'}
        </Text>

        {/* For link items: show URL in subdued style */}
        {isLink && item.raw_content ? (
          <View style={styles.linkUrlRow}>
            <ExternalLink size={11} color={colors.text.muted} />
            <Text style={styles.linkUrl} numberOfLines={1}>
              {item.raw_content}
            </Text>
          </View>
        ) : null}

        {/* For unembedded image items: note */}
        {isImage && item.is_embedded === 0 ? (
          <Text style={styles.imageNote}>Stored. Image search coming soon.</Text>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Link Preview Banner (shown inside add modal) ────

function LinkPreviewBanner({ url }: { url: string }) {
  return (
    <View style={styles.linkPreviewBanner}>
      <LinkIcon size={13} color={colors.accent.primary} />
      <Text style={styles.linkPreviewText} numberOfLines={1}>
        Link detected  {url}
      </Text>
    </View>
  );
}

// ─── Empty State ─────────────────────────────────────

function EmptyState() {
  const fadeIn = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }).start(); }, []);

  return (
    <Animated.View style={[styles.emptyState, { opacity: fadeIn }]}>
      <Logo size="lg" />
      <Text style={styles.emptyTitle}>Nothing saved yet</Text>
      <Text style={styles.emptySubtitle}>
        Tap + to add a note or URL.{'\n'}
        Share from YouTube, Spotify, or any app to save here.
      </Text>
    </Animated.View>
  );
}

// ─── HomeScreen ──────────────────────────────────────

export function HomeScreen() {
  const { embeddingReady } = useAppContext();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList, 'HomeList'>>();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isInputUrl = isUrl(inputText);

  const loadItems = useCallback(async () => {
    try { setItems(await getAllItems()); }
    catch { toast.error('Failed to load items'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  // ── Share menu handler ──
  const handleShare = useCallback(
    async (item: any) => {
      if (!item) return;
      const { mimeType, data } = item;
      if (!data) return;

      if (!embeddingReady && !mimeType?.startsWith('image/')) {
        toast.warning('Model not ready', 'Download the embedding model first.');
        return;
      }

      toast.info('Saving...', typeof data === 'string' ? data.slice(0, 60) : undefined);

      const result = await ingestAuto(
        Array.isArray(data) ? data[0] : data,
        mimeType,
      );

      if (result.success) {
        const isImg = mimeType?.startsWith('image/');
        toast.success(
          isImg ? 'Image saved' : 'Saved',
          isImg ? 'Image stored. Embedding coming soon.' : 'Embedded and stored.',
        );
        loadItems();
      } else {
        toast.error('Failed to save', (result as any).error);
      }
    },
    [embeddingReady, loadItems],
  );

  useEffect(() => {
    ShareMenu.getInitialShare(handleShare);
    const subscription = ShareMenu.addNewShareListener(handleShare);
    return () => subscription.remove();
  }, [handleShare]);

  // ── Manual save from modal ──
  const handleSave = async () => {
    if (!inputText.trim()) return;
    if (!embeddingReady) {
      toast.warning('Model not ready', 'Download the embedding model first.');
      return;
    }
    setIsSaving(true);
    try {
      let result;
      if (isInputUrl) {
        result = await ingestLink(inputText.trim());
        if (result.success) {
          const meta = (result as any).metadata;
          toast.success(
            meta?.sourceName ? `Saved from ${meta.sourceName}` : 'Link saved',
            meta?.title,
          );
        }
      } else {
        result = await ingestText(inputText.trim());
        if (result.success) toast.success('Saved', 'Embedded and stored.');
      }

      if (!result.success) {
        toast.error('Failed to save', (result as any).error);
        return;
      }

      setInputText('');
      setShowAddModal(false);
      Keyboard.dismiss();
      loadItems();
    } catch (err: any) {
      toast.error('Failed to save', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete handler ──
  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteItem(id);
      setItems(prev => prev.filter(i => i.id !== id));
      toast.success('Deleted');
    } catch {
      toast.error('Delete failed');
    }
  }, []);

  const saveButtonLabel = isSaving
    ? undefined
    : isInputUrl
    ? 'Fetch & Save'
    : 'Embed & Save';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg.base} />

      {/* Header */}
      <View style={styles.header}>
        <Logo size="md" />
        <Text style={styles.headerSubtitle}>
          {items.length > 0 ? `${items.length} item${items.length !== 1 ? 's' : ''} saved` : 'Your semantic memory'}
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
          renderItem={({ item, index }) => (
            <ItemCard
              item={item}
              index={index}
              onDelete={handleDelete}
              onPress={(i) => navigation.navigate('ItemDetail', { item: i })}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity style={styles.fab} activeOpacity={0.8} onPress={() => setShowAddModal(true)}>
        <Plus size={28} color={colors.text.inverse} />
      </TouchableOpacity>

      {/* Add modal */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => { if (!isSaving) { setShowAddModal(false); Keyboard.dismiss(); } }}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add item</Text>

            <TextInput
              style={styles.modalInput}
              value={inputText}
              onChangeText={setInputText}
              multiline
              placeholder="Type a note, paste a YouTube link, Spotify URL..."
              placeholderTextColor={colors.text.muted}
              autoFocus
              editable={!isSaving}
            />

            {isInputUrl && inputText.trim() ? (
              <LinkPreviewBanner url={inputText.trim()} />
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setShowAddModal(false); Keyboard.dismiss(); }}
                disabled={isSaving}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, (!inputText.trim() || isSaving) && styles.modalSaveBtnDisabled]}
                activeOpacity={0.7}
                onPress={handleSave}
                disabled={!inputText.trim() || isSaving}
              >
                {isSaving
                  ? <ActivityIndicator size="small" color={colors.text.inverse} />
                  : <Text style={styles.modalSaveText}>{saveButtonLabel}</Text>}
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

  header: {
    paddingTop: spacing['5xl'],
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.bg.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerSubtitle: { ...textStyles.bodySm, color: colors.text.muted, marginTop: spacing.xs },

  listContent: { padding: spacing.base, paddingBottom: 120 },
  skeletonContainer: { padding: spacing.base },

  // Item card
  itemCard: { marginBottom: spacing.md },
  itemCardInner: {
    backgroundColor: colors.bg.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  itemTopLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  itemTopRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  typeBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadgeLink: { backgroundColor: colors.accent.surface },
  typeBadgeImage: { backgroundColor: colors.bg.elevated },
  sourceName: { ...textStyles.caption, color: colors.accent.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  itemTimestamp: { ...textStyles.caption, color: colors.text.muted },
  deleteBtn: { padding: 2 },
  itemPreview: { ...textStyles.body, color: colors.text.primary, lineHeight: 21 },
  linkUrlRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  linkUrl: { ...textStyles.caption, color: colors.text.muted, flex: 1 },
  imageNote: { ...textStyles.caption, color: colors.text.muted, marginTop: spacing.xs, fontStyle: 'italic' },

  // Link preview banner inside modal
  linkPreviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent.surface,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.accent,
  },
  linkPreviewText: { ...textStyles.caption, color: colors.accent.muted, flex: 1 },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    gap: spacing.lg,
  },
  emptyTitle: { ...textStyles.h2, color: colors.text.primary },
  emptySubtitle: { ...textStyles.body, color: colors.text.secondary, textAlign: 'center', lineHeight: 22 },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.glow,
  },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  modalSheet: {
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    paddingBottom: spacing['3xl'],
    borderTopWidth: 1,
    borderColor: colors.border.subtle,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.medium,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: { ...textStyles.h2, color: colors.text.primary, marginBottom: spacing.base },
  modalInput: {
    backgroundColor: colors.bg.elevated,
    borderRadius: borderRadius.md,
    color: colors.text.primary,
    padding: spacing.base,
    minHeight: 120,
    textAlignVertical: 'top',
    fontSize: 15,
    lineHeight: 22,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: spacing.sm,
  },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    backgroundColor: colors.bg.elevated,
  },
  modalCancelText: { ...textStyles.bodyMedium, color: colors.text.secondary },
  modalSaveBtn: {
    flex: 2,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    backgroundColor: colors.accent.primary,
  },
  modalSaveBtnDisabled: { backgroundColor: colors.bg.elevated },
  modalSaveText: { ...textStyles.bodyMedium, color: colors.text.inverse, fontWeight: '700' },
});
