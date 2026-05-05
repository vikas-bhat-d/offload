/**
 * Offload — OnboardingScreen
 *
 * First screen shown when the embedding model hasn't been downloaded yet.
 * Users manually tap download buttons — no auto-downloading.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { colors } from '../theme/colors';
import { textStyles } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { ModelCard } from '../components/ModelCard';
import { useModelStatus } from '../hooks/useModelStatus';
import { Logo } from '../components/Logo';

interface OnboardingScreenProps {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const nomic = useModelStatus('nomic-embed-text');
  const qwen = useModelStatus('qwen-0.5b');

  // Animations
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;
  const cardsFade = useRef(new Animated.Value(0)).current;
  const cardsSlide = useRef(new Animated.Value(40)).current;
  const btnScale = useRef(new Animated.Value(0.9)).current;

  const canContinue = nomic.isReady;

  useEffect(() => {
    // Staggered entrance animations
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeIn, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(slideUp, {
          toValue: 0,
          tension: 40,
          friction: 10,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(cardsFade, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(cardsSlide, {
          toValue: 0,
          tension: 40,
          friction: 10,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  // Animate continue button when ready
  useEffect(() => {
    if (canContinue) {
      Animated.spring(btnScale, {
        toValue: 1,
        tension: 80,
        friction: 6,
        useNativeDriver: true,
      }).start();
    }
  }, [canContinue]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg.base} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <Animated.View
          style={[
            styles.hero,
            {
              opacity: fadeIn,
              transform: [{ translateY: slideUp }],
            },
          ]}>
          <Logo size="lg" />
          <Text style={styles.tagline}>
            Your thoughts,{'\n'}automatically organised.
          </Text>
        </Animated.View>

        {/* Setup Section */}
        <Animated.View
          style={[
            styles.setupSection,
            {
              opacity: cardsFade,
              transform: [{ translateY: cardsSlide }],
            },
          ]}>
          <Text style={styles.setupLabel}>One-time setup</Text>
          <Text style={styles.setupDescription}>
            Download the AI models that power on-device intelligence.
            Everything runs locally — no cloud, no API keys.
          </Text>

          {/* Model Cards */}
          <ModelCard model={nomic} />
          <ModelCard
            model={qwen}
            showSkip
            onSkip={() => {
              // Just allow continuing without qwen
            }}
          />
        </Animated.View>
      </ScrollView>

      {/* Continue Button — fixed at bottom */}
      <View style={styles.bottomBar}>
        <Animated.View style={{ transform: [{ scale: canContinue ? btnScale : 0.9 }] }}>
          <TouchableOpacity
            style={[
              styles.continueBtn,
              !canContinue && styles.continueBtnDisabled,
            ]}
            activeOpacity={0.8}
            disabled={!canContinue}
            onPress={onComplete}>
            <Text
              style={[
                styles.continueBtnText,
                !canContinue && styles.continueBtnTextDisabled,
              ]}>
              {canContinue ? 'Get Started' : 'Download embedding model to continue'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 120,
  },
  hero: {
    alignItems: 'center',
    paddingTop: spacing['5xl'],
    paddingBottom: spacing['2xl'],
  },
  logoText: {
    ...textStyles.displayLarge,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  tagline: {
    ...textStyles.h2,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 28,
  },
  setupSection: {
    paddingTop: spacing.lg,
  },
  setupLabel: {
    ...textStyles.label,
    color: colors.accent.primary,
    marginBottom: spacing.sm,
  },
  setupDescription: {
    ...textStyles.body,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['2xl'],
    paddingTop: spacing.base,
    backgroundColor: colors.bg.base,
    // Fade edge
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  continueBtn: {
    backgroundColor: colors.accent.primary,
    paddingVertical: spacing.base,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  continueBtnDisabled: {
    backgroundColor: colors.bg.elevated,
  },
  continueBtnText: {
    ...textStyles.bodyMedium,
    color: colors.text.inverse,
    fontWeight: '700',
  },
  continueBtnTextDisabled: {
    color: colors.text.muted,
    fontWeight: '500',
  },
});
