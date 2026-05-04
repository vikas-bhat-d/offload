/**
 * Offload — SearchScreen
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  Animated, StatusBar, ActivityIndicator, Keyboard,
} from 'react-native';
import { Search, FileText, Link as LinkIcon, Image as ImageIcon } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { textStyles } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { SkeletonCard } from '../components/Skeleton';
import { toast } from '../components/Toast';
import { useAppContext } from '../context/AppContext';
import { modelManager } from '../services/modelManager';
import { runTextEmbedding } from '../services/embedding';
import { searchSimilarItems } from '../services/storage';

function ScoreBar({ distance }: { distance: number }) {
  // Convert cosine distance (0=identical, 2=opposite) to similarity percentage
  const similarity = Math.max(0, Math.min(100, (1 - distance / 2) * 100));
  return (
    <View style={styles.scoreBarContainer}>
      <View style={styles.scoreBarTrack}>
        <View style={[styles.scoreBarFill, { width: `${similarity}%` }]} />
      </View>
      <Text style={styles.scoreBarLabel}>{similarity.toFixed(0)}% match</Text>
    </View>
  );
}

function ResultCard({ item, index }: { item: any; index: number }) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 300, delay: index * 80, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[styles.resultCard, { opacity: fadeIn }]}>
      <View style={styles.resultTypeRow}>
        {item.content_type === 'text' ? <FileText size={14} color={colors.text.muted} /> : item.content_type === 'link' ? <LinkIcon size={14} color={colors.text.muted} /> : <ImageIcon size={14} color={colors.text.muted} />}
        <Text style={styles.resultType}>{item.content_type}</Text>
      </View>
      <Text style={styles.resultText} numberOfLines={3}>{item.preview_text}</Text>
      <ScoreBar distance={item.distance} />
    </Animated.View>
  );
}

export function SearchScreen() {
  const { embeddingReady } = useAppContext();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(async (text: string) => {
    if (!text.trim() || !embeddingReady) return;
    setIsSearching(true);
    setHasSearched(true);
    try {
      const modelPath = modelManager.getModelPath('nomic-embed-text');
      const result = await runTextEmbedding(text.trim(), modelPath);
      if (!result.success || !result.vector) throw new Error(result.error || 'Embedding failed');
      const matches = await searchSimilarItems(result.vector, 10);
      setResults(matches);
    } catch (err: any) {
      toast.error('Search failed', err.message);
    } finally {
      setIsSearching(false);
    }
  }, [embeddingReady]);

  const onChangeText = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length >= 3) {
      debounceRef.current = setTimeout(() => handleSearch(text), 800);
    }
  }, [handleSearch]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg.base} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
        <View style={styles.searchInputContainer}>
          <Search size={18} color={colors.text.muted} style={{ marginRight: spacing.sm }} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={onChangeText}
            placeholder="Find anything semantically…"
            placeholderTextColor={colors.text.muted}
            returnKeyType="search"
            onSubmitEditing={() => handleSearch(query)}
          />
          {isSearching && <ActivityIndicator size="small" color={colors.accent.primary} />}
        </View>
      </View>

      {isSearching && !results.length ? (
        <View style={styles.skeletonContainer}><SkeletonCard /><SkeletonCard /><SkeletonCard /></View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(item, i) => item.id || i.toString()}
          renderItem={({ item, index }) => <ResultCard item={item} index={index} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      ) : hasSearched && !isSearching ? (
        <View style={styles.emptyState}>
          <Search size={48} color={colors.accent.primary} style={{ marginBottom: spacing.lg }} />
          <Text style={styles.emptyTitle}>No matches found</Text>
          <Text style={styles.emptySubtitle}>Try a different query or save more items.</Text>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Search size={48} color={colors.accent.primary} style={{ marginBottom: spacing.lg }} />
          <Text style={styles.emptyTitle}>Semantic Search</Text>
          <Text style={styles.emptySubtitle}>
            Type to search your collection by meaning,{'\n'}not just keywords.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base },
  header: { paddingTop: spacing['5xl'], paddingBottom: spacing.base, paddingHorizontal: spacing.xl, backgroundColor: colors.bg.base, borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  headerTitle: { ...textStyles.h1, color: colors.text.primary, marginBottom: spacing.md },
  searchInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.elevated, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border.subtle },
  searchInput: { flex: 1, color: colors.text.primary, fontSize: 15, paddingVertical: spacing.md },
  listContent: { padding: spacing.base, paddingBottom: 40 },
  skeletonContainer: { padding: spacing.base },
  resultCard: { backgroundColor: colors.bg.surface, borderRadius: borderRadius.lg, padding: spacing.base, borderWidth: 1, borderColor: colors.border.subtle, marginBottom: spacing.md },
  resultTypeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  resultType: { ...textStyles.labelSm, color: colors.text.muted },
  resultText: { ...textStyles.body, color: colors.text.primary, marginBottom: spacing.md },
  scoreBarContainer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scoreBarTrack: { flex: 1, height: 4, backgroundColor: colors.bg.elevated, borderRadius: 2, overflow: 'hidden' },
  scoreBarFill: { height: '100%', backgroundColor: colors.accent.primary, borderRadius: 2 },
  scoreBarLabel: { ...textStyles.mono, color: colors.text.muted, minWidth: 70, textAlign: 'right' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['2xl'] },
  emptyTitle: { ...textStyles.h2, color: colors.text.primary, marginBottom: spacing.sm },
  emptySubtitle: { ...textStyles.body, color: colors.text.secondary, textAlign: 'center', lineHeight: 22 },
});
