import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { NavigationContainer, NavigatorScreenParams } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MainTabParamList, RootStackParamList } from './types';
import { AdminScreen } from './screens/AdminScreen';
import { HomeScreen } from './screens/HomeScreen';
import { InfluencerGroupBuysScreen } from './screens/InfluencerGroupBuysScreen';
import { DetailScreen } from './screens/DetailScreen';
import { StoreScreen } from './screens/StoreScreen';
import { SubmitScreen } from './screens/SubmitScreen';
import { colors, shadows, spacing } from './design/tokens';

type RootStackWithTabs = RootStackParamList & {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
};

const queryClient = new QueryClient();
const Stack = createNativeStackNavigator<RootStackWithTabs>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const TAB_BAR_HEIGHT = 70;

function PlaceholderScreen({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.placeholderScreen}>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderSubtitle}>{subtitle}</Text>
    </View>
  );
}

function CommunityScreen() {
  return <PlaceholderScreen title="커뮤니티" subtitle="공구 제보와 후기를 모아볼 수 있는 공간입니다." />;
}

function MyPageScreen() {
  return <PlaceholderScreen title="마이페이지" subtitle="저장한 공구와 알림 설정을 관리하세요." />;
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
      return 'Home';
    case 'Search':
      return 'Search';
    case 'Submit':
      return 'Submit';
    case 'Community':
      return 'Community';
    case 'MyPage':
      return 'MyPage';
  }
}

function MainTabs() {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isNarrow = screenWidth <= 375;
  const tabBarMarginHorizontal = isNarrow ? Math.max(spacing.sm, spacing.lg - 6) : spacing.lg;
  const tabBarBottomOffset = Math.max(insets.bottom, spacing.sm);
  const submitTabMarginHorizontal = isNarrow ? spacing.xxs : spacing.xs;

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
          <Text style={[styles.tabIcon, focused && styles.tabIconFocused, route.name === 'Submit' && styles.submitTabIcon]}>
            {tabIcon(route.name)}
          </Text>
        ),
        tabBarLabel: ({ focused }) => (
          <Text style={[styles.tabText, focused && styles.tabTextFocused, route.name === 'Submit' && styles.submitTabText]}>
            {tabLabel(route.name)}
          </Text>
        ),
        tabBarStyle: [styles.tabBar, { bottom: tabBarBottomOffset, marginHorizontal: tabBarMarginHorizontal }],
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

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName={
              Platform.OS === 'web' && typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')
                ? 'Admin'
                : 'MainTabs'
            }
            screenOptions={{ headerShown: false }}
          >
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="Detail" component={DetailScreen} />
            <Stack.Screen name="InfluencerGroupBuys" component={InfluencerGroupBuysScreen} />
            <Stack.Screen name="Admin" component={AdminScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  placeholderScreen: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    flex: 1,
    justifyContent: 'center',
    padding: spacing['2xl'],
  },
  placeholderTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  placeholderSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  tabBar: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 30,
    borderTopWidth: 0,
    height: TAB_BAR_HEIGHT,
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm,
    position: 'absolute',
    ...shadows.md,
  },
  tabButton: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  submitTabButton: {
    backgroundColor: colors.ctaPurple,
    borderRadius: 28,
    marginHorizontal: spacing.xs,
    minHeight: 56,
  },
  tabIcon: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '800',
  },
  tabIconFocused: {
    color: colors.primary,
  },
  tabText: {
    color: colors.textTertiary,
    fontSize: 10,
    fontWeight: '700',
  },
  tabTextFocused: {
    color: colors.primary,
  },
  submitTabIcon: {
    color: colors.ctaPurpleText,
    fontSize: 22,
  },
  submitTabText: {
    color: colors.ctaPurpleText,
  },
});
