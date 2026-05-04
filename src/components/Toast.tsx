/**
 * Offload — Toast Notification System
 *
 * Custom toast that slides in from the top with auto-dismiss.
 * Replaces all Alert.alert usage for a smooth, non-blocking UX.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { textStyles } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

// ─── Types ───────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

// ─── Global Toast Queue ──────────────────────────────

type ToastListener = (toast: ToastData | null) => void;

let currentToast: ToastData | null = null;
const toastListeners: Set<ToastListener> = new Set();

function notifyToastListeners() {
  toastListeners.forEach(fn => fn(currentToast));
}

/**
 * Show a toast notification from anywhere in the app.
 */
export function showToast(
  type: ToastType,
  title: string,
  message?: string,
  duration = 3000,
) {
  currentToast = {
    id: Date.now().toString(),
    type,
    title,
    message,
    duration,
  };
  notifyToastListeners();
}

// Convenience methods
export const toast = {
  success: (title: string, message?: string) => showToast('success', title, message),
  error: (title: string, message?: string) => showToast('error', title, message),
  info: (title: string, message?: string) => showToast('info', title, message),
  warning: (title: string, message?: string) => showToast('warning', title, message),
};

// ─── Color Config ────────────────────────────────────

const TOAST_ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={16} color={colors.semantic.success} />,
  error: <XCircle size={16} color={colors.semantic.error} />,
  info: <Info size={16} color={colors.semantic.info} />,
  warning: <AlertTriangle size={16} color={colors.semantic.warning} />,
};

const TOAST_COLORS: Record<ToastType, { bg: string; border: string }> = {
  success: {
    bg: colors.semantic.successBg,
    border: colors.semantic.success,
  },
  error: {
    bg: colors.semantic.errorBg,
    border: colors.semantic.error,
  },
  info: {
    bg: colors.semantic.infoBg,
    border: colors.semantic.info,
  },
  warning: {
    bg: colors.semantic.warningBg,
    border: colors.semantic.warning,
  },
};

// ─── Toast Provider Component ────────────────────────

export function ToastProvider() {
  const [toastData, setToastData] = useState<ToastData | null>(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToastData(null);
    });
  }, []);

  const showToastAnimation = useCallback((data: ToastData) => {
    setToastData(data);

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Reset and animate in
    translateY.setValue(-120);
    opacity.setValue(0);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss
    timeoutRef.current = setTimeout(hideToast, data.duration || 3000);
  }, [hideToast]);

  useEffect(() => {
    const listener: ToastListener = (data) => {
      if (data) {
        showToastAnimation(data);
      }
    };
    toastListeners.add(listener);
    return () => {
      toastListeners.delete(listener);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [showToastAnimation]);

  if (!toastData) return null;

  const colorConfig = TOAST_COLORS[toastData.type];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={hideToast}
        style={[
          styles.toast,
          {
            backgroundColor: colorConfig.bg,
            borderColor: colorConfig.border,
          },
        ]}>
        <View style={[styles.iconCircle, { borderColor: colorConfig.border }]}>
          {TOAST_ICONS[toastData.type]}
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{toastData.title}</Text>
          {toastData.message && (
            <Text style={styles.message}>{toastData.message}</Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const { width: screenWidth } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: spacing.base,
    right: spacing.base,
    zIndex: 9999,
    elevation: 999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconText: {
    fontSize: 14,
    fontWeight: '700',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    ...textStyles.bodyMedium,
    color: colors.text.primary,
  },
  message: {
    ...textStyles.bodySm,
    color: colors.text.secondary,
    marginTop: 2,
  },
});
