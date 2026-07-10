import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, StatusBar, StyleSheet, ToastAndroid, useWindowDimensions, View, LogBox } from 'react-native';
import { BlurView } from 'expo-blur';
import * as SystemUI from 'expo-system-ui';
import { NavigationContainer, NavigatorScreenParams, DefaultTheme, DarkTheme, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

import type { MainTabParamList, RootStackParamList } from './types';
import { configurePostgrest } from './lib/postgrest-client';
import { configureSupabase } from './lib/supabase';
import { requestNotificationPermissions } from './services/notifications';
import { getCommerceColors } from './design/commerce';

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
import { ReelsScreen } from './screens/ReelsScreen';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';

type RootStackWithTabs = RootStackParamList & {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
};

const queryClient = new QueryClient();
const Stack = createNativeStackNavigator<RootStackWithTabs>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const TAB_BAR_HEIGHT = 58;
const EXIT_BACK_PRESS_WINDOW_MS = 2000;
const REELS_TAB_COLORS = getCommerceColors(true);

import { SubmitScreen } from './screens/SubmitScreen';

// Each GNB icon: when focused the inside is filled with the accent color,
// when not focused the inside stays transparent so only the outline shows.

function RankingTabGlyph({ color, focused }: { color: string; focused: boolean }) {
  return (
    <View style={styles.tabGlyphFrame}>
      <Ionicons name={focused ? 'trophy' : 'trophy-outline'} size={24} color={color} />
    </View>
  );
}

function ReelsTabGlyph({ color }: { color: string; focused: boolean }) {
  return (
    <View style={styles.tabGlyphFrame}>
      <View style={[styles.reelsFrame, { borderColor: color }]}>
        <View style={[styles.reelsTriangle, { borderLeftColor: color }]} />
      </View>
    </View>
  );
}

function HomeTabGlyph({ color, focused }: { color: string; focused: boolean }) {
  return (
    <View style={styles.tabGlyphFrame}>
      <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
    </View>
  );
}

function SearchTabGlyph({ color, focused }: { color: string; focused: boolean }) {
  return (
    <View style={styles.tabGlyphFrame}>
      <Ionicons name={focused ? 'search' : 'search-outline'} size={24} color={color} />
    </View>
  );
}

function MyPageTabGlyph({ color, focused }: { color: string; focused: boolean }) {
  return (
    <View style={styles.tabGlyphFrame}>
      <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
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
  const isIOS = Platform.OS === 'ios';
  const tabBarHeight = TAB_BAR_HEIGHT + Math.max(insets.bottom - 12, 0);
  const tabBarBottomPadding = Math.max(insets.bottom - 8, isNarrow ? 2 : 4);
  const tabBarBackgroundColor = isIOS ? 'transparent' : colors.bottomBarBg;
  // When a Reels bottom sheet opens, hide the GNB by sliding it down off-screen
  // (style preserved, restored when the sheet closes).
  const [reelsSheetOpen, setReelsSheetOpen] = useState(false);

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // Active tab name inside the bottom tab navigator, mirrored into a ref from
  // the tab navigator's state events so the back handler reads a fresh value
  // without re-subscribing on every tab switch.
  const activeTabNameRef = useRef<keyof MainTabParamList>('Home');
  const lastHomeBackPressAtRef = useRef(0);

  // Android back button: if the user is on a non-Home tab, move to Home
  // instead of exiting the app. On Home, require a second back press while the
  // toast is visible before exiting.
  // MainTabs is a stack screen, so this handler unmounts while a detail or
  // other stack screen is pushed on top, avoiding conflicts with those.
  useEffect(() => {
    if (isIOS) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeTabNameRef.current !== 'Home') {
        lastHomeBackPressAtRef.current = 0;
        navigation.navigate('MainTabs', { screen: 'Home' });
        return true;
      }

      const now = Date.now();
      if (now - lastHomeBackPressAtRef.current <= EXIT_BACK_PRESS_WINDOW_MS) {
        BackHandler.exitApp();
        return true;
      }

      lastHomeBackPressAtRef.current = now;
      ToastAndroid.show('종료하려면 다시 누르세요', ToastAndroid.SHORT);
      return true;
    });
    return () => subscription.remove();
  }, [isIOS, navigation]);

  return (
    <Tab.Navigator
      backBehavior="none"
      initialRouteName="Home"
      screenListeners={{
        state: (event) => {
          const activeRouteName = event.data.state.routes[event.data.state.index]?.name;
          if (activeRouteName) {
            activeTabNameRef.current = activeRouteName as keyof MainTabParamList;
            if (activeRouteName !== 'Home') {
              lastHomeBackPressAtRef.current = 0;
            }
          }
        },
      }}
      screenOptions={({ route, navigation }) => {
        const navState = navigation.getState();
        const activeRouteName = navState.routes[navState.index]?.name;
        const isReelsActive = activeRouteName === 'Reels';
        return {
          headerShown: false,
          tabBarIconStyle: styles.tabIconSlot,
          tabBarItemStyle: [
            styles.tabButton,
          ],
          tabBarAccessibilityLabel: `${tabLabel(route.name)} 탭`,
          // Stable selector for E2E (Maestro): id "tab-<routeName>"
          tabBarTestID: `tab-${route.name}`,
          tabBarIcon: ({ focused, color }) => tabIcon(route.name, color, focused),
          tabBarShowLabel: false,
          tabBarLabel: tabLabel(route.name),
          tabBarActiveTintColor: isReelsActive ? REELS_TAB_COLORS.text : colors.text,
          tabBarInactiveTintColor: isReelsActive ? REELS_TAB_COLORS.tabInactive : colors.tabInactive,
          tabBarBackground: isIOS
            ? () => (
              <BlurView
                intensity={isReelsActive ? 42 : 34}
                tint={isReelsActive ? 'systemChromeMaterialDark' : 'systemChromeMaterial'}
                style={StyleSheet.absoluteFill}
              />
            )
            : undefined,
          tabBarStyle: [
            styles.tabBar,
            {
              backgroundColor: isReelsActive ? REELS_TAB_COLORS.bottomBarBg : tabBarBackgroundColor,
              borderColor: isReelsActive
                ? REELS_TAB_COLORS.bottomBarBorder
                : isIOS
                  ? 'rgba(255, 255, 255, 0.20)'
                  : colors.bottomBarBorder,
              height: tabBarHeight,
              paddingBottom: tabBarBottomPadding,
              // Slide the GNB off-screen while a Reels bottom sheet is open.
              bottom: reelsSheetOpen ? -tabBarHeight : 0,
            },
          ],
        };
      }}
    >
      <Tab.Screen name="Ranking" component={StoreScreen} />
      <Tab.Screen name="Reels">
        {() => <ReelsScreen onSheetVisibilityChange={setReelsSheetOpen} />}
      </Tab.Screen>
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

  useEffect(() => {
    requestNotificationPermissions().catch(() => {
      // permission request is best-effort; user can enable later in settings
    });
  }, []);

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
  tabBar: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    height: TAB_BAR_HEIGHT,
    left: 0,
    overflow: 'hidden',
    paddingTop: 2,
    position: 'absolute',
    right: 0,
  },
  tabButton: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingTop: 0,
  },
  tabIconSlot: {
    height: 28,
    marginBottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
  },
  tabGlyphFrame: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    position: 'relative',
    width: 34,
  },
  reelsFrame: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 6,
    borderStyle: 'solid',
    borderWidth: 1.6,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  reelsTriangle: {
    borderBottomColor: 'transparent',
    borderBottomWidth: 5.5,
    borderLeftWidth: 8,
    borderRightWidth: 0,
    borderStyle: 'solid',
    borderTopColor: 'transparent',
    borderTopWidth: 5.5,
    height: 0,
    marginLeft: 1,
    width: 0,
  },
});
