/**
 * Offload -- ItemDetailScreen
 *
 * Full-detail view for a single saved item.
 * Reached by tapping any card on HomeScreen.
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
  Linking,
  Alert,
  Animated,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, FileText, Link as LinkIcon, Image as ImageIcon, ExternalLink, Trash2, Globe } from 'lucide-react-native';

import type { HomeStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { textStyles } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { deleteItem } from '../services/storage';
import { toast } from '../components/Toast';

type Props = NativeStackScreenProps<HomeStackParamList, 'ItemDetail'>;

// ─── Helpers ─────────────────────────────────────────

function formatFullDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Header ──────────────────────────────────────────

function DetailHeader({
  title,
  onBack,
  onDelete,
}: {
  title: string;
  onBack: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.headerBtn}>
        <ArrowLeft size={20} color={colors.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.headerBtn}>
        <Trash2 size={18} color={colors.semantic.error} />
      </TouchableOpacity>
    </View>
  );
}

// ─── ItemDetailScreen ─────────────────────────────────

export function ItemDetailScreen({ route, navigation }: Props) {
  const { item } = route.params;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, []);

  const isLink = item.content_type === 'link';
  const isImage = item.content_type === 'image';
  const isText = item.content_type === 'text';

  const headerTitle = isLink
    ? (item.source_name ?? 'Link')
    : isImage
    ? 'Image'
    : 'Note';

  const handleDelete = () => {
    Alert.alert(
      'Delete item',
      'This item will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteItem(item.id);
              toast.success('Deleted');
              navigation.goBack();
            } catch {
              toast.error('Delete failed');
            }
          },
        },
      ],
    );
  };

  const handleOpenUrl = () => {
    if (item.raw_content) {
      Linking.openURL(item.raw_content).catch(() => {
        toast.error('Could not open URL');
      });
    }
  };

  const TypeIcon = isLink ? LinkIcon : isImage ? ImageIcon : FileText;
  const typeColor = isLink ? colors.accent.primary : colors.text.secondary;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg.base} />

      <DetailHeader
        title={headerTitle}
        onBack={() => navigation.goBack()}
        onDelete={handleDelete}
      />

      <Animated.ScrollView
        style={{ opacity: fadeIn }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>

        {/* Type + source badge */}
        <View style={styles.badgeRow}>
          <View style={[styles.typeBadge, isLink && styles.typeBadgeLink]}>
            <TypeIcon size={13} color={typeColor} />
          </View>
          {isLink && item.source_name ? (
            <Text style={styles.sourceName}>{item.source_name}</Text>
          ) : isImage ? (
            <Text style={styles.sourceName}>Image</Text>
          ) : (
            <Text style={styles.sourceName}>Note</Text>
          )}
        </View>

        {/* ── LINK content ── */}
        {isLink && (
          <>
            <Text style={styles.linkTitle}>{item.preview_text || item.raw_content}</Text>

            {item.description ? (
              <Text style={styles.linkDescription}>{item.description}</Text>
            ) : null}

            {/* Thumbnail */}
            {item.thumbnail_path ? (
              <View style={styles.thumbnailContainer}>
                <Image
                  source={{ uri: item.thumbnail_path }}
                  style={styles.thumbnail}
                  resizeMode="cover"
                />
              </View>
            ) : null}

            {/* URL row */}
            <View style={styles.divider} />
            <View style={styles.urlRow}>
              <Globe size={14} color={colors.text.muted} style={{ marginRight: spacing.xs }} />
              <Text style={styles.urlText} numberOfLines={2} selectable>{item.raw_content}</Text>
            </View>
            <TouchableOpacity style={styles.openBtn} activeOpacity={0.75} onPress={handleOpenUrl}>
              <ExternalLink size={15} color={colors.text.inverse} />
              <Text style={styles.openBtnText}>Open in browser</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── TEXT content ── */}
        {isText && (
          <Text style={styles.textBody} selectable>{item.raw_content}</Text>
        )}

        {/* ── IMAGE content ── */}
        {isImage && (
          <>
            <Text style={styles.imagePath} selectable>{item.raw_content}</Text>
            <View style={styles.imageNotice}>
              <Text style={styles.imageNoticeText}>
                Image search and preview will be available once image embedding is implemented.
              </Text>
            </View>
          </>
        )}

        {/* Timestamp */}
        <View style={styles.divider} />
        <Text style={styles.timestamp}>{formatFullDate(item.created_at)}</Text>

      </Animated.ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing['5xl'],
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.bg.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    ...textStyles.bodyMedium,
    color: colors.text.secondary,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 12,
  },

  // Body
  body: {
    padding: spacing.xl,
    paddingBottom: spacing['4xl'],
  },

  // Badge
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.base,
  },
  typeBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadgeLink: {
    backgroundColor: colors.accent.surface,
  },
  sourceName: {
    ...textStyles.caption,
    color: colors.accent.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Link
  linkTitle: {
    ...textStyles.h2,
    color: colors.text.primary,
    marginBottom: spacing.base,
    lineHeight: 30,
  },
  linkDescription: {
    ...textStyles.body,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: spacing.base,
  },
  thumbnailContainer: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  thumbnail: {
    width: '100%',
    height: 200,
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.base,
  },
  urlText: {
    ...textStyles.bodySm,
    color: colors.text.muted,
    flex: 1,
    lineHeight: 18,
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    marginBottom: spacing.base,
  },
  openBtnText: {
    ...textStyles.bodyMedium,
    color: colors.text.inverse,
    fontWeight: '600',
  },

  // Text
  textBody: {
    ...textStyles.body,
    color: colors.text.primary,
    lineHeight: 24,
    marginBottom: spacing.base,
  },

  // Image
  imagePath: {
    ...textStyles.bodySm,
    color: colors.text.muted,
    fontFamily: 'monospace',
    backgroundColor: colors.bg.elevated,
    padding: spacing.sm,
    borderRadius: borderRadius.xs,
    marginBottom: spacing.base,
  },
  imageNotice: {
    backgroundColor: colors.accent.surface,
    borderRadius: borderRadius.sm,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border.accent,
    marginBottom: spacing.base,
  },
  imageNoticeText: {
    ...textStyles.bodySm,
    color: colors.accent.muted,
    lineHeight: 18,
  },

  // Common
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.base,
  },
  timestamp: {
    ...textStyles.caption,
    color: colors.text.muted,
    textAlign: 'center',
  },
});
