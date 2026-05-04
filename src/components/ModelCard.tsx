/**
 * Offload — ModelCard Component
 *
 * Displays a model's info with download/cancel/delete actions.
 * Shows animated progress bar during download.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { CheckCircle, Check } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { textStyles } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { ProgressBar } from './ProgressBar';
import { UseModelStatusResult } from '../hooks/useModelStatus';

interface ModelCardProps {
  model: UseModelStatusResult;
  /** Whether to show the skip option (for optional models) */
  showSkip?: boolean;
  onSkip?: () => void;
  /** Compact variant for settings screen */
  compact?: boolean;
}

export function ModelCard({ model, showSkip, onSkip, compact }: ModelCardProps) {
  const { info, status, isReady, isDownloading, startDownload, cancelDownload, deleteModel } = model;

  // ─── Status Badge ──────────────────────────────────

  const getStatusBadge = () => {
    switch (status.state) {
      case 'ready':
        return (
          <View style={[styles.badge, styles.badgeSuccess]}>
            <View style={styles.badgeIconRow}>
              <Check size={10} color={colors.semantic.success} />
              <Text style={[styles.badgeText, { color: colors.semantic.success }]}>
                Ready
              </Text>
            </View>
          </View>
        );
      case 'downloading':
        return (
          <View style={[styles.badge, styles.badgeDownloading]}>
            <Text style={[styles.badgeText, { color: colors.accent.primary }]}>
              Downloading
            </Text>
          </View>
        );
      case 'error':
        return (
          <View style={[styles.badge, styles.badgeError]}>
            <Text style={[styles.badgeText, { color: colors.semantic.error }]}>
              Error
            </Text>
          </View>
        );
      default:
        return (
          <View style={[styles.badge, styles.badgeDefault]}>
            <Text style={[styles.badgeText, { color: colors.text.muted }]}>
              Not Downloaded
            </Text>
          </View>
        );
    }
  };

  // ─── Action Button ─────────────────────────────────

  const renderAction = () => {
    switch (status.state) {
      case 'not_downloaded':
        return (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.downloadBtn}
              activeOpacity={0.7}
              onPress={startDownload}>
              <Text style={styles.downloadBtnText}>Download</Text>
              <Text style={styles.sizeLabel}>{info.sizeLabel}</Text>
            </TouchableOpacity>
            {showSkip && onSkip && (
              <TouchableOpacity
                style={styles.skipBtn}
                activeOpacity={0.7}
                onPress={onSkip}>
                <Text style={styles.skipBtnText}>Skip for now</Text>
              </TouchableOpacity>
            )}
          </View>
        );

      case 'downloading':
        return (
          <View style={styles.downloadingContainer}>
            <ProgressBar
              progress={status.progress?.percent || 0}
              height={8}
              glow
              style={styles.progressBar}
            />
            <View style={styles.downloadMeta}>
              <Text style={styles.downloadMetaText}>
                {status.progress?.percent || 0}%
                {status.progress?.speedMBps
                  ? `  ·  ${status.progress.speedMBps} MB/s`
                  : ''}
              </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={cancelDownload}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'verifying':
        return (
          <View style={styles.verifyingRow}>
            <ActivityIndicator size="small" color={colors.accent.primary} />
            <Text style={styles.verifyingText}>Verifying integrity…</Text>
          </View>
        );

      case 'ready':
        if (compact) {
          return (
            <TouchableOpacity
              style={styles.deleteBtn}
              activeOpacity={0.7}
              onPress={deleteModel}>
              <Text style={styles.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
          );
        }
        return (
          <View style={styles.readyRow}>
            <View style={styles.readyTitleRow}>
              <CheckCircle size={16} color={colors.semantic.success} />
              <Text style={styles.readyText}>Ready to use</Text>
            </View>
            {status.fileSizeBytes && (
              <Text style={styles.fileSizeText}>
                {(status.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB on device
              </Text>
            )}
          </View>
        );

      case 'error':
        return (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{status.error || 'Download failed'}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              activeOpacity={0.7}
              onPress={startDownload}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  // ─── Render ────────────────────────────────────────

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.modelName}>{info.name}</Text>
          {info.required && (
            <Text style={styles.requiredLabel}>Required</Text>
          )}
        </View>
        {getStatusBadge()}
      </View>
      {!compact && (
        <Text style={styles.description}>{info.description}</Text>
      )}
      {renderAction()}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: spacing.md,
  },
  cardCompact: {
    padding: spacing.base,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modelName: {
    ...textStyles.h3,
    color: colors.text.primary,
  },
  requiredLabel: {
    ...textStyles.labelSm,
    color: colors.accent.primary,
    fontSize: 9,
    backgroundColor: colors.accent.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    overflow: 'hidden',
  },
  description: {
    ...textStyles.bodySm,
    color: colors.text.secondary,
    marginBottom: spacing.base,
  },

  // ─── Badge ───────────────────────────────
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  badgeSuccess: {
    backgroundColor: colors.semantic.successBg,
    borderColor: colors.semantic.success,
  },
  badgeDownloading: {
    backgroundColor: colors.accent.surface,
    borderColor: colors.accent.primary,
  },
  badgeError: {
    backgroundColor: colors.semantic.errorBg,
    borderColor: colors.semantic.error,
  },
  badgeDefault: {
    backgroundColor: 'transparent',
    borderColor: colors.border.subtle,
  },
  badgeIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    ...textStyles.labelSm,
    fontSize: 10,
    letterSpacing: 0.5,
  },

  // ─── Actions ─────────────────────────────
  actionRow: {
    gap: spacing.sm,
  },
  downloadBtn: {
    backgroundColor: colors.accent.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  downloadBtnText: {
    ...textStyles.bodyMedium,
    color: colors.text.inverse,
    fontWeight: '700',
  },
  sizeLabel: {
    ...textStyles.caption,
    color: 'rgba(255,255,255,0.7)',
  },
  skipBtn: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  skipBtnText: {
    ...textStyles.bodySm,
    color: colors.text.muted,
  },

  // ─── Downloading ─────────────────────────
  downloadingContainer: {
    gap: spacing.sm,
  },
  progressBar: {
    marginTop: spacing.xs,
  },
  downloadMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  downloadMetaText: {
    ...textStyles.mono,
    color: colors.text.secondary,
  },
  cancelText: {
    ...textStyles.bodySm,
    color: colors.semantic.error,
    fontWeight: '600',
  },

  // ─── Verifying ───────────────────────────
  verifyingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  verifyingText: {
    ...textStyles.bodySm,
    color: colors.text.secondary,
  },

  // ─── Ready ───────────────────────────────
  readyRow: {
    gap: spacing.xxs,
  },
  readyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  readyText: {
    ...textStyles.bodySm,
    color: colors.semantic.success,
    fontWeight: '600',
  },
  fileSizeText: {
    ...textStyles.caption,
    color: colors.text.muted,
  },

  // ─── Error ───────────────────────────────
  errorContainer: {
    gap: spacing.sm,
  },
  errorText: {
    ...textStyles.bodySm,
    color: colors.semantic.error,
  },
  retryBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.accent.primary,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  retryBtnText: {
    ...textStyles.bodyMedium,
    color: colors.accent.primary,
    fontWeight: '600',
  },

  // ─── Delete ──────────────────────────────
  deleteBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-end',
  },
  deleteBtnText: {
    ...textStyles.bodySm,
    color: colors.semantic.error,
    fontWeight: '600',
  },
});
