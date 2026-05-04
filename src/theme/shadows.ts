/**
 * Offload — Design Tokens: Shadows
 *
 * Soft shadows appropriate for a light/warm theme.
 * Android uses `elevation`, iOS uses shadow* properties.
 */

import { Platform, ViewStyle } from 'react-native';

export const shadows: Record<string, ViewStyle> = {
  none: {
    elevation: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },

  sm: Platform.select({
    android: { elevation: 2 },
    default: {
      shadowColor: '#2C2C2C',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
    },
  }) as ViewStyle,

  md: Platform.select({
    android: { elevation: 4 },
    default: {
      shadowColor: '#2C2C2C',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
    },
  }) as ViewStyle,

  lg: Platform.select({
    android: { elevation: 8 },
    default: {
      shadowColor: '#2C2C2C',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
    },
  }) as ViewStyle,

  /** Glow shadow for accent-tinted elements */
  glow: Platform.select({
    android: { elevation: 6 },
    default: {
      shadowColor: '#7FA688',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
    },
  }) as ViewStyle,
};
