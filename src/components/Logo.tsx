/**
 * Offload -- Wordmark Logo
 *
 * The app logotype used across all screens.
 * Uses a diamond mark + bold wordmark per the design system.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  sm: { wordmark: 18, mark: 12, gap: 5 },
  md: { wordmark: 24, mark: 16, gap: 6 },
  lg: { wordmark: 34, mark: 22, gap: 8 },
};

export function Logo({ size = 'md' }: LogoProps) {
  const s = SIZE_MAP[size];
  return (
    <View style={[styles.row, { gap: s.gap }]}>
      <View style={[styles.markContainer, { width: s.mark + 4, height: s.mark + 4, borderRadius: (s.mark + 4) / 2 }]}>
        <View style={[styles.markDiamond, { width: s.mark * 0.55, height: s.mark * 0.55 }]} />
      </View>
      <Text style={[styles.wordmark, { fontSize: s.wordmark }]}>Offload</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markContainer: {
    backgroundColor: colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markDiamond: {
    backgroundColor: colors.text.inverse,
    transform: [{ rotate: '45deg' }],
  },
  wordmark: {
    color: colors.text.primary,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
});
