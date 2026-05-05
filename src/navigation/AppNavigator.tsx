/**
 * Offload — AppNavigator
 *
 * Conditional root:
 * - If embedding model not ready → OnboardingScreen
 * - If ready → Main tab navigator (Home, Search, Settings)
 */

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { colors } from '../theme/colors';
import { textStyles } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { useAppContext } from '../context/AppContext';

import { OnboardingScreen } from '../screens/OnboardingScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ItemDetailScreen } from '../screens/ItemDetailScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SplashScreen } from '../components/SplashScreen';

import { Zap, Search, Settings, AlertTriangle } from 'lucide-react-native';

import type { RootStackParamList, MainTabParamList, HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();

// ─── Tab Icons ──

const TAB_ICONS: Record<string, React.FC<any>> = {
  Home: Zap,
  Search: Search,
  Settings: Settings,
};

// ─── Home Stack (list + detail) ──────────────────────

function HomeNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <HomeStack.Screen name="HomeList" component={HomeScreen} />
      <HomeStack.Screen name="ItemDetail" component={ItemDetailScreen} />
    </HomeStack.Navigator>
  );
}

// ─── Main Tab Navigator ──────────────────────────────

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.accent.primary,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIcon: ({ focused }) => {
          const Icon = TAB_ICONS[route.name];
          const iconColor = focused ? colors.accent.primary : colors.text.muted;
          return (
            <View style={[styles.tabIconContainer, focused && styles.tabIconContainerActive]}>
              <Icon size={20} color={iconColor} strokeWidth={focused ? 2.5 : 2} />
            </View>
          );
        },
      })}>
      <Tab.Screen name="Home" component={HomeNavigator} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

// ─── Root Navigator ──────────────────────────────────

export function AppNavigator() {
  const { appInitialized, embeddingReady, initError } = useAppContext();
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  const handleOnboardingComplete = useCallback(() => {
    setOnboardingComplete(true);
  }, []);

  // Show splash while initializing
  if (!appInitialized) {
    return <SplashScreen />;
  }

  // Show error if initialization failed
  if (initError) {
    return (
      <View style={styles.errorContainer}>
        <AlertTriangle size={48} color={colors.semantic.error} style={{ marginBottom: spacing.lg }} />
        <Text style={styles.errorTitle}>Failed to start</Text>
        <Text style={styles.errorMessage}>{initError}</Text>
      </View>
    );
  }

  // Determine initial route
  const showOnboarding = !embeddingReady && !onboardingComplete;

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}>
        {showOnboarding ? (
          <Stack.Screen name="Onboarding">
            {() => <OnboardingScreen onComplete={handleOnboardingComplete} />}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bg.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    height: 64,
    paddingBottom: 8,
    paddingTop: 8,
    elevation: 0,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  tabIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconContainerActive: {
    backgroundColor: colors.accent.glow,
  },
  tabIcon: {
    fontSize: 18,
    color: colors.text.muted,
  },
  tabIconActive: {
    color: colors.accent.primary,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: colors.bg.base,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.lg,
  },
  errorTitle: {
    ...textStyles.h2,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  errorMessage: {
    ...textStyles.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});
