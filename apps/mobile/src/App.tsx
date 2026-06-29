import React from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View, LogBox } from 'react-native';
import { NavigationContainer, NavigatorScreenParams, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { spacing } from './design/tokens';
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
    <View style={[styles.placeholderScreen, { backgroundColor: colors.bg }]}>
      <Text style={[styles.placeholderTitle, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.placeholderSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
    </View>
  );
}

function CommunityScreen() {
  return <PlaceholderScreen title="커뮤니티" subtitle="공구 제보와 후기를 모아볼 수 있는 공간입니다." />;
}

function tabIcon(routeName: keyof MainTabParamList) {
  switch (routeName) {
    case 'Home':
      return '⌂';
    case 'Search':
      return '⌕';
    case 'Submit':
      return '+';
    case 'Community':
      return '◌';
    case 'MyPage':
      return '☻';
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
      return 'MY';
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
        tabBarItemStyle: [
          styles.tabButton,
          route.name === 'Submit' && styles.submitTabButton,
          route.name === 'Submit' && { marginHorizontal: submitTabMarginHorizontal },
        ],
        tabBarAccessibilityLabel: `${tabLabel(route.name)} 탭`,
        tabBarIcon: ({ focused }) => (
          <Text
            style={[
              styles.tabIcon,
              { color: focused ? colors.primary : colors.textSecondary },
              route.name === 'Submit' && { color: colors.ctaPurpleText },
            ]}
          >
            {tabIcon(route.name)}
          </Text>
        ),
        tabBarLabel: tabLabel(route.name),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: [
          { fontSize: 11, fontWeight: '700' },
          route.name === 'Submit' && { color: colors.ctaPurpleText },
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
        tabBarIconStyle: route.name === 'Submit' ? { backgroundColor: colors.ctaPurple, borderRadius: 28, minHeight: 56 } : undefined,
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
  const navTheme = React.useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      dark: isDark,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.bg,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.border,
        notification: colors.accent,
      },
    };
  }, [isDark, colors]);

  return <NavigationContainer theme={navTheme}>{children}</NavigationContainer>;
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
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="CalendarScreen" component={CalendarScreen} />
      <Stack.Screen name="Detail" component={DetailScreen} />
      <Stack.Screen name="FeedDetail" component={FeedDetailScreen} />
      <Stack.Screen name="Login" component={AuthScreen} />
      <Stack.Screen name="InfluencerGroupBuys" component={InfluencerGroupBuysScreen} />
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
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: spacing['2xl'],
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: spacing.sm,
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
  submitTabButton: {
    borderRadius: 28,
    marginHorizontal: spacing.xs,
    minHeight: 56,
  },
  tabIcon: {
    fontSize: 18,
    fontWeight: '800',
  },
});
