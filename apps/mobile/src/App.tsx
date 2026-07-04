import React, { useEffect } from 'react';
import { Platform, StatusBar, StyleSheet, Text, useWindowDimensions, View, LogBox } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { NavigationContainer, NavigatorScreenParams, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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
import { SearchScreen } from './screens/SearchScreen';
import { spacing } from './design/tokens';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';

type RootStackWithTabs = RootStackParamList & {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
};

const queryClient = new QueryClient();
const Stack = createNativeStackNavigator<RootStackWithTabs>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const TAB_BAR_HEIGHT = 82;

import { SubmitScreen } from './screens/SubmitScreen';

function PlaceholderScreen({ title, subtitle }: { title: string; subtitle: string }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.placeholderScreen, { backgroundColor: colors.bg }]}>
      <View style={styles.placeholderHeader}>
        <Text style={[styles.placeholderTitle, { color: colors.text }]}>{title}</Text>
      </View>
      <View style={styles.placeholderBody}>
        <Text style={[styles.placeholderSubtitle, { color: colors.muted }]}>{subtitle}</Text>
      </View>
    </SafeAreaView>
  );
}

function ReelsScreen() {
  return <PlaceholderScreen title="릴스" subtitle="릴스 기능을 준비 중입니다." />;
}

// Each GNB icon: when focused the inside is filled with the accent color,
// when not focused the inside stays transparent so only the outline shows.

function RankingTabGlyph({ color, focused }: { color: string; focused: boolean }) {
  return (
    <View style={styles.tabGlyphFrame}>
      <View style={[styles.chartFrame, { borderColor: color }]} />
      {focused ? <View style={[styles.chartBar, { backgroundColor: color }]} /> : null}
    </View>
  );
}

function ReelsTabGlyph({ color, focused }: { color: string; focused: boolean }) {
  return (
    <View style={styles.tabGlyphFrame}>
      <View style={[styles.reelsFrame, { borderColor: color }]}>
        <View style={[styles.reelsTriangle, { borderLeftColor: focused ? color : 'transparent' }]} />
      </View>
    </View>
  );
}

function HomeTabGlyph({ color, focused }: { color: string; focused: boolean }) {
  return (
    <View style={styles.tabGlyphFrame}>
      <View style={[styles.homeRoof, { borderColor: color }]} />
      <View style={[styles.homeBody, { borderColor: color, backgroundColor: focused ? color : 'transparent' }]} />
    </View>
  );
}

function SearchTabGlyph({ color, focused }: { color: string; focused: boolean }) {
  return (
    <View style={styles.tabGlyphFrame}>
      <View style={[styles.searchCircle, { borderColor: color }]} />
      <View style={[styles.searchHandle, { borderColor: color, backgroundColor: focused ? color : 'transparent' }]} />
    </View>
  );
}

function MyPageTabGlyph({ color, focused }: { color: string; focused: boolean }) {
  return (
    <View style={styles.menuGlyph}>
      <View style={[styles.menuLine, { backgroundColor: focused ? color : 'transparent', borderColor: color, borderWidth: 2.2 }]} />
      <View style={[styles.menuLine, { backgroundColor: focused ? color : 'transparent', borderColor: color, borderWidth: 2.2 }]} />
      <View style={[styles.menuLine, { backgroundColor: focused ? color : 'transparent', borderColor: color, borderWidth: 2.2 }]} />
    </View>
  );
}

function tabIcon(routeName: keyof MainTabParamList, color: string, focused: boolean) {
  switch (routeName) {
    case 'Ranking':
      return <RankingTabGlyph color={color} focused={focused} />;
    case 'Reels':
      return <ReelsTabGlyph color={color} focused={focused} />;
    case 'Home':
      return <HomeTabGlyph color={color} focused={focused} />;
    case 'Search':
      return <SearchTabGlyph color={color} focused={focused} />;
    case 'MyPage':
      return <MyPageTabGlyph color={color} focused={focused} />;
  }
}

function tabLabel(routeName: keyof MainTabParamList) {
  switch (routeName) {
    case 'Ranking':
      return '랭킹';
    case 'Reels':
      return '릴스';
    case 'Home':
      return '홈';
    case 'Search':
      return '검색';
    case 'MyPage':
      return '마이';
  }
}

function MainTabs() {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isNarrow = screenWidth <= 375;
  const tabBarHeight = TAB_BAR_HEIGHT + Math.max(insets.bottom - 10, 0);
  const tabBarBottomPadding = Math.max(insets.bottom, isNarrow ? 8 : 10);

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIconStyle: styles.tabIconSlot,
        tabBarItemStyle: [
          styles.tabButton,
        ],
        tabBarAccessibilityLabel: `${tabLabel(route.name)} 탭`,
        tabBarIcon: ({ focused }) => tabIcon(
          route.name,
          focused ? colors.text : colors.tabInactive,
          focused,
        ),
        tabBarLabel: tabLabel(route.name),
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: [
          styles.tabLabel,
        ],
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: colors.bottomBarBg,
            borderColor: colors.bottomBarBorder,
            height: tabBarHeight,
            paddingBottom: tabBarBottomPadding,
          },
        ],
      })}
    >
      <Tab.Screen name="Ranking" component={StoreScreen} />
      <Tab.Screen name="Reels" component={ReelsScreen} />
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
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
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bg} />
      <View style={{ flex: 1, backgroundColor: bg }}>
        <NavigationContainer theme={navTheme}>{children}</NavigationContainer>
      </View>
    </>
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
      <Stack.Screen name="Submit" component={SubmitScreen} />
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
    <GestureHandlerRootView style={styles.appRoot}>
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
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
  },
  placeholderScreen: {
    flex: 1,
  },
  placeholderHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  placeholderTitle: {
    fontSize: 22,
    fontWeight: '900',
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
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    height: TAB_BAR_HEIGHT,
    left: 0,
    paddingTop: 9,
    position: 'absolute',
    right: 0,
  },
  tabButton: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 58,
    paddingTop: 2,
  },
  tabIconSlot: {
    height: 28,
    marginBottom: 1,
    width: 34,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 14,
  },
  tabGlyphFrame: {
    height: 28,
    position: 'relative',
    width: 34,
  },
  homeRoof: {
    borderLeftWidth: 2.4,
    borderTopWidth: 2.4,
    height: 15,
    left: 9,
    position: 'absolute',
    top: 4,
    transform: [{ rotate: '45deg' }],
    width: 15,
  },
  homeBody: {
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    borderBottomWidth: 2.4,
    borderLeftWidth: 2.4,
    borderRightWidth: 2.4,
    bottom: 3,
    height: 14,
    left: 8,
    position: 'absolute',
    width: 18,
  },
  searchCircle: {
    borderRadius: 999,
    borderWidth: 2.3,
    height: 16,
    left: 6,
    position: 'absolute',
    top: 3,
    width: 16,
  },
  searchHandle: {
    borderBottomRightRadius: 999,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 999,
    borderWidth: 2.3,
    bottom: 4,
    height: 9,
    left: 18,
    position: 'absolute',
    width: 9,
  },
  reelsFrame: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 6,
    borderStyle: 'solid',
    bottom: 4,
    height: 20,
    justifyContent: 'center',
    left: 9,
    position: 'absolute',
    width: 16,
  },
  reelsTriangle: {
    borderBottomColor: 'transparent',
    borderLeftWidth: 9,
    borderRightWidth: 0,
    borderStyle: 'solid',
    borderTopColor: 'transparent',
    borderTopWidth: 6,
    height: 0,
    width: 0,
  },
  chartFrame: {
    borderBottomWidth: 2.3,
    borderLeftWidth: 2.3,
    borderRadius: 2,
    bottom: 5,
    height: 18,
    left: 7,
    position: 'absolute',
    width: 21,
  },
  chartBar: {
    bottom: 6,
    height: 10,
    left: 14,
    position: 'absolute',
    width: 4,
  },
  menuGlyph: {
    gap: 5,
    height: 28,
    justifyContent: 'center',
    width: 26,
  },
  menuLine: {
    borderRadius: 999,
    height: 2.4,
    width: 26,
  },
});
