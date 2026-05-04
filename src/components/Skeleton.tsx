/**
 * Offload — Skeleton Component
 *
 * Shimmer loading placeholder for smooth loading states.
 * Replaces content with animated gradient bars.
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { borderRadius as br } from '../theme/spacing';

interface SkeletonProps {
  /** Width of the skeleton. Defaults to '100%' */
  width?: number | string;
  /** Height of the skeleton */
  height?: number;
  /** Border radius */
  borderRadius?: number;
  /** Additional styles */
  style?: ViewStyle;
}

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = br.sm,
  style,
}: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: colors.shimmer.base,
          opacity,
        },
        style,
      ]}
    />
  );
}

/**
 * Pre-built skeleton layout for a card.
 */
export function SkeletonCard({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.card, style]}>
      <Skeleton width="60%" height={14} style={styles.gap} />
      <Skeleton width="100%" height={12} style={styles.gap} />
      <Skeleton width="80%" height={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.surface,
    borderRadius: br.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: 12,
  },
  gap: {
    marginBottom: 10,
  },
});
