import React, { useEffect } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View, LogBox } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { NavigationContainer, NavigatorScreenParams, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import type { MainTabParamList, RootStackParamList } from './types';
import { configurePostgrest } from './lib/postgrest-client';
import { configureSupabase } from './lib/supabase';

// Initialize PostgREST client with the Supabase anon key
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
configurePostgrest(anonKey);
// Initialize Supabase Auth client
configureSupabase(anonKey);

import { AdminScreen } from './screens/AdminScreen';
import { AuthScreen } from './screens/AuthScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { FeedDetailScreen } from './screens/FeedDetailScreen';
import { HomeScreen } from './screens/HomeScreen';
import { InfluencerGroupBuysScreen } from './screens/InfluencerGroupBuysScreen';
import { DetailScreen } from './screens/DetailScreen';
import { MyPageScreen } from './screens/MyPageScreen';
import { StoreScreen } from './screens/StoreScreen';
import { SubmitScreen } from './screens/SubmitScreen';
import { SearchScreen } from './screens/SearchScreen';
import { ScreenHeader } from './components/ScreenHeader';
import { borderRadius, spacing } from './design/tokens';
import { CrownGlyph } from './components/ui/LineGlyphs';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';

type RootStackWithTabs = RootStackParamList & {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
};

const queryClient = new QueryClient();
const Stack = createNativeStackNavigator<RootStackWithTabs>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const TAB_BAR_HEIGHT = 72;

function PlaceholderScreen({ title, subtitle }: { title: string; subtitle: string }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.placeholderScreen, { backgroundColor: colors.bg }]}>
      <View style={styles.placeholderHeader}>
        <ScreenHeader title={title} />
      </View>
      <View style={styles.placeholderBody}>
        <Text style={[styles.placeholderSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
    </SafeAreaView>
  );
}

function CommunityScreen() {
  return <PlaceholderScreen title="커뮤니티" subtitle="공구 제보와 후기를 모아볼 수 있는 공간입니다." />;
}

function tabIcon(routeName: keyof MainTabParamList, color: string) {
  switch (routeName) {
    case 'Home':
      return <Text style={[styles.tabIcon, { color }]}>⌂</Text>;
    case 'Search':
      return <CrownGlyph color={color} size={18} />;
    case 'Submit':
      return <Text style={[styles.tabIcon, { color }]}>+</Text>;
    case 'Community':
      return <Text style={[styles.tabIcon, { color }]}>◌</Text>;
    case 'MyPage':
      return <Text style={[styles.tabIcon, { color }]}>☻</Text>;
  }
}

function tabLabel(routeName: keyof MainTabParamList) {
  switch (routeName) {
    case 'Home':
      return '홈';
    case 'Search':
      return '랭킹';
    case 'Submit':
      return 'Submit';
    case 'Community':
      return '커뮤니티';
    case 'MyPage':
      return '마이';
  }
}

function MainTabs() {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isNarrow = screenWidth <= 375;
  const tabBarMarginHorizontal = isNarrow ? Math.max(spacing.sm, spacing.lg - 6) : spacing.lg;
  const tabBarBottomOffset = Math.max(insets.bottom, spacing.sm);
  const submitTabMarginHorizontal = isNarrow ? spacing.xxs : spacing.xs;
  const { colors, shadows } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIconStyle: route.name === 'Submit' ? {
          backgroundColor: colors.primary,
          borderRadius: borderRadius['2xl'],
          minHeight: 48,
          minWidth: 48,
          marginTop: -12,
          alignItems: 'center',
          justifyContent: 'center',
        } : undefined,
        tabBarItemStyle: [
          styles.tabButton,
          route.name === 'Submit' && { marginHorizontal: submitTabMarginHorizontal },
        ],
        tabBarAccessibilityLabel: `${tabLabel(route.name)} 탭`,
        tabBarIcon: ({ focused }) => tabIcon(
          route.name,
          route.name === 'Submit'
            ? colors.textInverse
            : (focused ? colors.primary : colors.textSecondary),
        ),
        tabBarLabel: tabLabel(route.name),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: [
          { fontSize: 11, fontWeight: '700' },
          route.name === 'Submit' && { color: colors.primary },
        ],
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            bottom: tabBarBottomOffset,
            marginHorizontal: tabBarMarginHorizontal,
            ...shadows.md,
          },
        ],
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={StoreScreen} />
      <Tab.Screen name="Submit" component={SubmitScreen} />
      <Tab.Screen name="Community" component={CommunityScreen} />
      <Tab.Screen name="MyPage" component={MyPageScreen} />
    </Tab.Navigator>
  );
}

// Suppress the known RN 0.83 Fabric text-warning (false positive)
LogBox.ignoreLogs(['Text strings must be rendered within a <Text> component']);

/**
 * Wraps NavigationContainer with the current theme's background color
 * so dark-mode screen transitions don't flash white.
 */
function ThemedNavigationContainer({ children }: { children: React.ReactNode }) {
  const { colors, isDark } = useTheme();
  const bg = colors.bg;

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(bg);
  }, [bg]);

  const navTheme = React.useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      dark: isDark,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: bg,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.border,
        notification: colors.accent,
      },
    };
  }, [isDark, colors, bg]);

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <NavigationContainer theme={navTheme}>{children}</NavigationContainer>
    </View>
  );
}

function ThemedStackNavigator() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      initialRouteName={
        Platform.OS === 'web' && typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')
          ? 'Admin'
          : 'MainTabs'
      }
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="CalendarScreen" component={CalendarScreen} />
      <Stack.Screen name="Detail" component={DetailScreen} />
      <Stack.Screen name="FeedDetail" component={FeedDetailScreen} />
      <Stack.Screen name="Login" component={AuthScreen} />
      <Stack.Screen name="InfluencerGroupBuys" component={InfluencerGroupBuysScreen} />
      <Stack.Screen name="SearchScreen" component={SearchScreen} />
      <Stack.Screen name="Admin" component={AdminScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <KeyboardProvider>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <ThemedNavigationContainer>
                <ThemedStackNavigator />
              </ThemedNavigationContainer>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </KeyboardProvider>
  );
}

const styles = StyleSheet.create({
  placeholderScreen: {
    flex: 1,
    backgroundColor: undefined,
  },
  placeholderHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  placeholderBody: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  placeholderSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  tabBar: {
    borderRadius: 30,
    borderTopWidth: 0,
    height: TAB_BAR_HEIGHT,
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm,
    position: 'absolute',
  },
  tabButton: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  tabIcon: {
    fontSize: 18,
    fontWeight: '800',
  },
});
