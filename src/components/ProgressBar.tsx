/**
 * Offload — ProgressBar Component
 *
 * Animated progress bar with smooth fill transitions.
 * Used for model downloads and other progress indicators.
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { borderRadius } from '../theme/spacing';

interface ProgressBarProps {
  /** Progress value from 0 to 100 */
  progress: number;
  /** Height of the bar */
  height?: number;
  /** Track (background) color */
  trackColor?: string;
  /** Fill color */
  fillColor?: string;
  /** Whether to show a glow effect on the fill */
  glow?: boolean;
  /** Additional container styles */
  style?: ViewStyle;
}

export function ProgressBar({
  progress,
  height = 6,
  trackColor = colors.bg.elevated,
  fillColor = colors.accent.primary,
  glow = false,
  style,
}: ProgressBarProps) {
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(animatedWidth, {
      toValue: Math.min(Math.max(progress, 0), 100),
      useNativeDriver: false,
      tension: 40,
      friction: 12,
    }).start();
  }, [progress]);

  const fillWidth = animatedWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={[
        styles.track,
        { height, backgroundColor: trackColor, borderRadius: height / 2 },
        style,
      ]}>
      <Animated.View
        style={[
          styles.fill,
          {
            width: fillWidth,
            height,
            backgroundColor: fillColor,
            borderRadius: height / 2,
          },
          glow && styles.glow,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  glow: {
    shadowColor: colors.accent.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
});
