/**
 * Offload — SettingsScreen
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Modal, ActivityIndicator,
} from 'react-native';
import { colors } from '../theme/colors';
import { textStyles } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { ModelCard } from '../components/ModelCard';
import { toast } from '../components/Toast';
import { useModelStatus } from '../hooks/useModelStatus';
import { useAppContext } from '../context/AppContext';
import { getAllItems, deleteAllItems } from '../services/storage';

export function SettingsScreen() {
  const { dbReady, vecAvailable } = useAppContext();
  const nomic = useModelStatus('nomic-embed-text');
  const qwen = useModelStatus('qwen-0.5b');
  const [itemCount, setItemCount] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    getAllItems().then(items => setItemCount(items.length)).catch(() => {});
  }, []);

  const handleDeleteAll = async () => {
    setIsDeleting(true);
    try {
      await deleteAllItems();
      setItemCount(0);
      setShowDeleteConfirm(false);
      toast.success('Done', 'All records deleted.');
    } catch (err: any) {
      toast.error('Delete failed', err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg.base} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Model Management */}
        <Text style={styles.sectionLabel}>AI Models</Text>
        <ModelCard model={nomic} compact />
        <ModelCard model={qwen} compact />

        {/* System Status */}
        <Text style={styles.sectionLabel}>System</Text>
        <View style={styles.infoCard}>
          <InfoRow label="Database" value={dbReady ? 'Connected' : 'Not ready'} ok={dbReady} />
          <InfoRow label="Vector Search" value={vecAvailable ? 'Available' : 'Missing'} ok={vecAvailable} />
          <InfoRow label="Total Items" value={String(itemCount)} />
        </View>

        {/* Danger Zone */}
        <Text style={styles.sectionLabel}>Danger Zone</Text>
        <View style={styles.dangerCard}>
          <Text style={styles.dangerDescription}>
            Permanently delete all saved items and their vector embeddings from the local database.
          </Text>
          <TouchableOpacity
            style={styles.dangerBtn}
            activeOpacity={0.7}
            onPress={() => setShowDeleteConfirm(true)}>
            <Text style={styles.dangerBtnText}>Delete All Records</Text>
          </TouchableOpacity>
        </View>

        {/* About */}
        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.infoCard}>
          <InfoRow label="App" value="Offload v0.0.1" />
          <InfoRow label="Runtime" value="On-device, zero cloud" />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal visible={showDeleteConfirm} transparent animationType="fade" onRequestClose={() => setShowDeleteConfirm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete All Data?</Text>
            <Text style={styles.modalDescription}>
              This will permanently remove all {itemCount} items and their embeddings. This cannot be undone.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalDeleteBtn} onPress={handleDeleteAll} disabled={isDeleting} activeOpacity={0.7}>
                {isDeleting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalDeleteText}>Delete All</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, ok === true && { color: colors.semantic.success }, ok === false && { color: colors.semantic.error }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base },
  header: { paddingTop: spacing['5xl'], paddingBottom: spacing.base, paddingHorizontal: spacing.xl, backgroundColor: colors.bg.base, borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  headerTitle: { ...textStyles.h1, color: colors.text.primary },
  scrollContent: { padding: spacing.xl },
  sectionLabel: { ...textStyles.label, color: colors.accent.primary, marginBottom: spacing.md, marginTop: spacing.lg },
  infoCard: { backgroundColor: colors.bg.surface, borderRadius: borderRadius.lg, padding: spacing.base, borderWidth: 1, borderColor: colors.border.subtle },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  infoLabel: { ...textStyles.body, color: colors.text.secondary },
  infoValue: { ...textStyles.mono, color: colors.text.primary },
  dangerCard: { backgroundColor: colors.bg.surface, borderRadius: borderRadius.lg, padding: spacing.base, borderWidth: 1, borderColor: colors.semantic.error + '30' },
  dangerDescription: { ...textStyles.bodySm, color: colors.text.secondary, marginBottom: spacing.base },
  dangerBtn: { backgroundColor: colors.semantic.errorBg, paddingVertical: spacing.md, borderRadius: borderRadius.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.semantic.error + '40' },
  dangerBtnText: { ...textStyles.bodyMedium, color: colors.semantic.error, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  modalCard: { backgroundColor: colors.bg.surface, borderRadius: borderRadius.lg, padding: spacing.xl, width: '100%', borderWidth: 1, borderColor: colors.border.subtle },
  modalTitle: { ...textStyles.h2, color: colors.text.primary, marginBottom: spacing.sm },
  modalDescription: { ...textStyles.body, color: colors.text.secondary, marginBottom: spacing.xl, lineHeight: 22 },
  modalActions: { flexDirection: 'row', gap: spacing.md },
  modalCancelBtn: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: borderRadius.sm, backgroundColor: colors.bg.elevated },
  modalCancelText: { ...textStyles.bodyMedium, color: colors.text.secondary },
  modalDeleteBtn: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: borderRadius.sm, backgroundColor: colors.semantic.error },
  modalDeleteText: { ...textStyles.bodyMedium, color: '#fff', fontWeight: '700' },
});
