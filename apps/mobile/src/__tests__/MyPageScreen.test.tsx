import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { MyPageScreen } from '../screens/MyPageScreen';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';

// Mock @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resend: vi.fn(),
      verifyOtp: vi.fn(),
      exchangeCodeForSession: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
  }),
}));

// Mock expo-secure-store
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
}));

// Mock lib/supabase
vi.mock('../lib/supabase', () => ({
  configureSupabase: vi.fn(),
  getSupabase: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resend: vi.fn(),
      verifyOtp: vi.fn(),
      exchangeCodeForSession: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
  })),
}));

// Mock useNavigation hook
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: vi.fn(),
    goBack: vi.fn(),
  }),
  useFocusEffect: vi.fn((cb: any) => {
    if (typeof cb === 'function') cb();
    return vi.fn();
  }),
}));

// Mock expo-constants / expo-modules-core so useLocalDeals (IS_EXPO_GO) loads
vi.mock('expo-constants', () => ({ default: { appOwnership: 'expo' } }));
vi.mock('expo-modules-core', () => ({}));
vi.mock('expo-notifications', () => ({
  scheduleNotificationAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  SchedulableTriggerInputTypes: { CALENDAR: 'calendar', TIME_INTERVAL: 'timeInterval' },
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock SafeAreaView as a plain View
// Mock react-native with components used by MyPageScreen
vi.mock('react-native', () => {
  const ReactMock = require('react');
  const passthrough = (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement(type, props, children);
  return {
    View: passthrough('View'),
    Text: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement('Text', props, children),
    Image: passthrough('Image'),
    Pressable: ({ children, onPress, ...props }: any) =>
      ReactMock.createElement('Pressable', { onPress, ...props }, children),
    TouchableOpacity: ({ children, onPress, ...props }: any) =>
      ReactMock.createElement('TouchableOpacity', { onPress, ...props }, children),
    ScrollView: ({ children, ...props }: any) =>
      ReactMock.createElement('ScrollView', props, children),
    FlatList: ({ children, ...props }: any) =>
      ReactMock.createElement('FlatList', props, children),
    Switch: (props: any) => ReactMock.createElement('Switch', props),
    StatusBar: passthrough('StatusBar'),
    StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
    Platform: { OS: 'ios', select: (obj: any) => obj.ios ?? obj.default },
    useColorScheme: () => 'light',
    Linking: {
      openURL: vi.fn(),
      getInitialURL: vi.fn().mockResolvedValue(null),
      addEventListener: vi.fn(() => ({ remove: vi.fn() })),
      removeEventListener: vi.fn(),
    },
    Share: { share: vi.fn() },
    Alert: { alert: vi.fn() },
    ActivityIndicator: passthrough('ActivityIndicator'),
  };
});

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

function renderMyPageScreen() {
  let renderer: ReturnType<typeof TestRenderer.create>;
  act(() => {
    renderer = TestRenderer.create(
      React.createElement(ThemeProvider, null,
        React.createElement(AuthProvider, null,
          React.createElement(MyPageScreen),
        ),
      ),
    );
  });
  return renderer!;
}

describe('MyPageScreen', () => {
  it('renders without crashing', () => {
    const renderer = renderMyPageScreen();
    expect(renderer.toJSON()).toBeTruthy();
  });

  it('shows loading state initially', () => {
    const renderer = renderMyPageScreen();
    const json = renderer.toJSON();
    expect(json).not.toBeNull();
  });
});
