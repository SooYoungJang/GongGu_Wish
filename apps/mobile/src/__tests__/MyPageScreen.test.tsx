import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as api from '../api';
import { MyPageScreen } from '../screens/MyPageScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';

const navigationMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  goBack: vi.fn(),
}));
const focusedCallbacks = vi.hoisted(() => new Set<Function>());
const authMocks = vi.hoisted(() => ({
  session: null as any,
  signOut: vi.fn().mockResolvedValue(undefined),
}));
const alertMocks = vi.hoisted(() => ({ alert: vi.fn() }));

// Mock @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: authMocks.session } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resend: vi.fn(),
      verifyOtp: vi.fn(),
      exchangeCodeForSession: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: authMocks.signOut,
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
      getSession: vi.fn().mockResolvedValue({ data: { session: authMocks.session } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resend: vi.fn(),
      verifyOtp: vi.fn(),
      exchangeCodeForSession: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: authMocks.signOut,
    },
  })),
}));

// Mock useNavigation hook
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: navigationMocks.navigate,
    goBack: navigationMocks.goBack,
  }),
  useFocusEffect: vi.fn((cb: any) => {
    if (typeof cb === 'function' && !focusedCallbacks.has(cb)) {
      focusedCallbacks.add(cb);
      cb();
    }
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
    Modal: ({ children, visible, ...props }: any) =>
      visible ? ReactMock.createElement('Modal', props, children) : null,
    Pressable: ({ children, onPress, ...props }: any) =>
      ReactMock.createElement('Pressable', { onPress, ...props }, children),
    TextInput: (props: any) => ReactMock.createElement('TextInput', props),
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
    Alert: alertMocks,
    ActivityIndicator: passthrough('ActivityIndicator'),
  };
});

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

function renderScreen(screen: React.ReactElement) {
  let renderer: ReturnType<typeof TestRenderer.create>;
  act(() => {
    renderer = TestRenderer.create(
      React.createElement(ThemeProvider, null,
        React.createElement(AuthProvider, null,
          screen,
        ),
      ),
    );
  });
  return renderer!;
}

function renderMyPageScreen() {
  return renderScreen(React.createElement(MyPageScreen));
}

beforeEach(() => {
  authMocks.session = null;
  authMocks.signOut.mockClear();
  alertMocks.alert.mockClear();
  navigationMocks.navigate.mockClear();
  navigationMocks.goBack.mockClear();
});

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

  it('opens settings from the top-right menu', async () => {
    const renderer = renderMyPageScreen();
    await act(async () => {
      await Promise.resolve();
    });
    const menuButton = renderer.root.findByProps({
      accessibilityLabel: '설정 열기',
    });

    act(() => {
      menuButton.props.onPress();
    });

    expect(navigationMocks.navigate).toHaveBeenCalledWith('Settings');
  });

  it('renders notification and theme controls on the settings screen', () => {
    const renderer = renderScreen(React.createElement(SettingsScreen));
    const rendered = JSON.stringify(renderer.toJSON());

    expect(rendered).toContain('알림 설정');
    expect(rendered).toContain('화면 테마');
    expect(rendered).toContain('시스템');
    expect(rendered).toContain('라이트');
    expect(rendered).toContain('다크');
  });

  it('places account deletion at the bottom and asks for confirmation', async () => {
    authMocks.session = {
      access_token: 'access-token',
      user: {
        id: 'user-1',
        email: 'user@example.com',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    };
    const deleteSpy = vi.spyOn(api, 'deleteAccount').mockResolvedValue(undefined);
    const renderer = renderScreen(React.createElement(SettingsScreen));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const deleteButton = renderer.root.findByProps({
      accessibilityLabel: '회원탈퇴',
    });
    act(() => {
      deleteButton.props.onPress();
    });

    expect(alertMocks.alert).toHaveBeenCalledWith('회원탈퇴', expect.stringContaining('복구할 수 없어요'), expect.any(Array));
    const options = alertMocks.alert.mock.calls.at(-1)?.[2] as Array<{
      onPress?: () => void;
    }>;
    act(() => {
      options[1]?.onPress?.();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(deleteSpy).toHaveBeenCalledOnce();
    deleteSpy.mockRestore();
  });
});
