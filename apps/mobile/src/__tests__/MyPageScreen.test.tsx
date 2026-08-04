import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as api from '../api';
import {
  DealShelf,
  MyPageScreen,
  notificationEntryToGroupBuy,
} from '../screens/MyPageScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';
import { resolveAudiencePolicy } from '../audience/audiencePolicy';
import { AccessibilityInfo, Linking } from 'react-native';

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
const notificationMocks = vi.hoisted(() => ({
  getNotificationPermissionStatus: vi.fn(async () => 'granted'),
  registerForPushNotifications: vi.fn(
    async (): Promise<any> => ({
      status: 'registered',
      token: 'ExpoPushToken[test-token]',
    }),
  ),
}));
const dealCardMock = vi.hoisted(() => vi.fn());
const adsMocks = vi.hoisted(() => ({
  privacyOptionsRequired: false,
  showPrivacyOptions: vi.fn(async () => true),
}));
const audienceMocks = vi.hoisted(() => ({
  ageBand: 'age14Plus' as const,
  policy: {
    resolved: true,
    canUseApp: true,
    canAuthenticate: true,
    canRequestAds: true,
    canRecordBehaviorSignals: true,
  },
  selectAgeBand: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../audience/AudienceContext', () => ({
  useAudience: () => audienceMocks,
}));

const adultAudiencePolicy = resolveAudiencePolicy('age14Plus');
const settingsPreferenceMocks = vi.hoisted(() => ({
  saving: false,
  preferences: {
    pushEnabled: true,
    deadlineRemindersEnabled: true,
    submissionApprovalEnabled: true,
    marketingPushEnabled: false,
    reminderDays: [1, 3, 7] as Array<1 | 3 | 7>,
    followedInfluencers: ['seller.one'],
    followedBrands: ['Brand A'],
  },
  updatePreferences: vi.fn(async (patch: Record<string, unknown>) => patch),
}));

vi.mock('../ads/AdsContext', () => ({
  useAds: () => ({
    enabled: true,
    nativeUnitIds: {
      detail: 'test-native-unit',
      home: 'test-native-unit',
      reels: 'test-native-unit',
    },
    isReady: true,
    isSettled: true,
    privacyOptionsRequired: adsMocks.privacyOptionsRequired,
    showPrivacyOptions: adsMocks.showPrivacyOptions,
  }),
}));

vi.mock('../context/NotificationPreferencesContext', () => ({
  useNotificationPreferences: () => ({
    preferences: settingsPreferenceMocks.preferences,
    ready: true,
    saving: settingsPreferenceMocks.saving,
    error: null,
    updatePreferences: settingsPreferenceMocks.updatePreferences,
  }),
}));

vi.mock('../services/notifications', () => ({
  IS_EXPO_GO: false,
  getNotificationPermissionStatus:
    notificationMocks.getNotificationPermissionStatus,
  registerForPushNotifications: notificationMocks.registerForPushNotifications,
}));

vi.mock('../components/DealCard', () => ({
  DealCard: (props: any) => {
    dealCardMock(props);
    return React.createElement('DealCard', props);
  },
}));

// Mock @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: authMocks.session } }),
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
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: authMocks.session } }),
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
vi.mock('expo-constants', () => ({
  default: {
    appOwnership: 'expo',
    expoConfig: { extra: {}, version: '0.1.0' },
  },
}));
vi.mock('expo-application', () => ({
  nativeApplicationVersion: '2.3.4',
  nativeBuildVersion: '42',
}));
vi.mock('expo-modules-core', () => ({}));
vi.mock('expo-notifications', () => ({
  scheduleNotificationAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  SchedulableTriggerInputTypes: {
    CALENDAR: 'calendar',
    TIME_INTERVAL: 'timeInterval',
  },
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
  const passthrough =
    (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement(type, props, children);
  return {
    AccessibilityInfo: {
      announceForAccessibility: vi.fn(),
    },
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
      ReactMock.createElement(
        'TouchableOpacity',
        { onPress, ...props },
        children,
      ),
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
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(
          AuthProvider,
          { audiencePolicy: adultAudiencePolicy },
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
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.mocked(AccessibilityInfo.announceForAccessibility).mockClear();
  vi.mocked(Linking.openURL).mockClear();
  authMocks.session = null;
  authMocks.signOut.mockClear();
  alertMocks.alert.mockClear();
  navigationMocks.navigate.mockClear();
  navigationMocks.goBack.mockClear();
  settingsPreferenceMocks.preferences.pushEnabled = true;
  settingsPreferenceMocks.preferences.deadlineRemindersEnabled = true;
  settingsPreferenceMocks.preferences.submissionApprovalEnabled = true;
  settingsPreferenceMocks.preferences.marketingPushEnabled = false;
  settingsPreferenceMocks.preferences.reminderDays = [1, 3, 7];
  settingsPreferenceMocks.preferences.followedInfluencers = ['seller.one'];
  settingsPreferenceMocks.preferences.followedBrands = ['Brand A'];
  settingsPreferenceMocks.saving = false;
  settingsPreferenceMocks.updatePreferences.mockClear();
  notificationMocks.getNotificationPermissionStatus.mockClear();
  notificationMocks.registerForPushNotifications.mockReset().mockResolvedValue({
    status: 'registered',
    token: 'ExpoPushToken[test-token]',
  });
  adsMocks.privacyOptionsRequired = false;
  adsMocks.showPrivacyOptions.mockClear();
  audienceMocks.policy.canAuthenticate = true;
  audienceMocks.policy.canRequestAds = true;
  audienceMocks.policy.canRecordBehaviorSignals = true;
});

describe('MyPageScreen', () => {
  it('isolates and announces the wish registration dialog', async () => {
    const renderer = renderMyPageScreen();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      renderer.root
        .findByProps({ accessibilityLabel: '위시 아이템 등록하기' })
        .props.onPress();
    });

    const dialog = renderer.root.findByProps({
      testID: 'wish-registration-dialog',
    });
    expect(dialog.props.accessibilityLabel).toBe('위시 아이템 등록');
    expect(dialog.props.accessibilityViewIsModal).toBe(true);
    expect(dialog.props.importantForAccessibility).toBe('yes');

    const modal = renderer.root.findByType(
      'Modal' as unknown as React.ElementType,
    );
    act(() => modal.props.onShow());
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      '위시 아이템 등록',
    );
  });

  it('keeps notification price and discount fields when building a home card item', () => {
    const item = notificationEntryToGroupBuy({
      groupBuyId: 'deal-1',
      productName: '테스트 공구',
      priceKrw: 200000,
      brandName: '테스트 브랜드',
      category: 'beauty',
      startDate: '2026-07-15T00:00:00.000Z',
      endDate: '2026-07-30T00:00:00.000Z',
      purchaseUrl: 'https://example.com/deal',
      discountInfo: '20% 할인',
      summary: '테스트 요약',
      confidence: 1,
      thumbnailUrl: 'https://example.com/deal.png',
      videoUrl: null,
      mediaUrls: ['https://example.com/deal.png'],
      mediaType: 'IMAGE',
      rawPost: {
        postUrl: 'https://instagram.com/p/1',
        influencer: { instagramUsername: 'seller' },
      },
      scheduledFor: null,
      notificationId: null,
      createdAt: '2026-07-15T00:00:00.000Z',
    });

    expect(item).toMatchObject({
      priceKrw: 200000,
      brandName: '테스트 브랜드',
      discountInfo: '20% 할인',
      thumbnailUrl: 'https://example.com/deal.png',
    });
  });

  it('uses an active bookmark action inside the shared DealCard price row', () => {
    const item = {
      id: 'deal-1',
      productName: '테스트 공구',
      category: 'beauty',
    } as any;
    const onPressDeal = vi.fn();
    const onUnbookmarkDeal = vi.fn();
    const styles = {
      dealShelf: 'dealShelf',
      shelfHeader: 'shelfHeader',
      shelfTitle: 'shelfTitle',
      shelfSubtitle: 'shelfSubtitle',
      miniDealRail: 'miniDealRail',
      shelfDealItem: 'shelfDealItem',
      shelfDealCard: 'shelfDealCard',
      emptyShelf: 'emptyShelf',
      emptyShelfText: 'emptyShelfText',
      pressed: 'pressed',
    } as any;

    dealCardMock.mockClear();
    let renderer: ReturnType<typeof TestRenderer.create>;
    act(() => {
      renderer = renderScreen(
        React.createElement(DealShelf, {
          title: '북마크한 공구',
          subtitle: '저장해둔 공구를 모아봤어요',
          items: [item],
          emptyText: '북마크한 공구가 아직 없어요.',
          onPressDeal,
          onUnbookmarkDeal,
          s: styles,
        }),
      );
    });

    expect(dealCardMock).toHaveBeenCalledWith(
      expect.objectContaining({
        item,
        category: 'beauty',
        onPress: expect.any(Function),
        style: styles.shelfDealCard,
        trailingAction: expect.objectContaining({
          accessibilityHint: '북마크 목록에서 제거합니다.',
          accessibilityLabel: '테스트 공구 북마크 해제',
          onPress: expect.any(Function),
          selected: true,
          testID: 'my-page-unbookmark-deal-1',
        }),
      }),
    );

    const trailingAction = dealCardMock.mock.calls[0]?.[0].trailingAction;
    expect(trailingAction.icon.props.name).toBe('bookmark');
    expect(
      renderer!.root.findAll((node) =>
        node.children.some((child) => child === '북마크 해제'),
      ),
    ).toHaveLength(0);
    act(() => {
      trailingAction.onPress();
    });
    expect(onUnbookmarkDeal).toHaveBeenCalledWith(item);
  });

  it('uses the reminder bell as the only notification removal entry point', () => {
    const item = {
      id: 'deal-1',
      productName: '테스트 공구',
      category: 'beauty',
    } as any;
    const styles = {
      dealShelf: 'dealShelf',
      shelfHeader: 'shelfHeader',
      shelfTitle: 'shelfTitle',
      shelfSubtitle: 'shelfSubtitle',
      miniDealRail: 'miniDealRail',
      shelfDealItem: 'shelfDealItem',
      shelfDealCard: 'shelfDealCard',
      emptyShelf: 'emptyShelf',
      emptyShelfText: 'emptyShelfText',
      pressed: 'pressed',
    } as any;

    dealCardMock.mockClear();
    let renderer: ReturnType<typeof TestRenderer.create>;
    act(() => {
      renderer = renderScreen(
        React.createElement(DealShelf, {
          title: '알림 설정한 공구',
          subtitle: '마감 알림을 설정한 공구예요',
          items: [item],
          emptyText: '알림을 설정한 공구가 아직 없어요.',
          onPressDeal: vi.fn(),
          s: styles,
        }),
      );
    });

    expect(dealCardMock.mock.calls[0]?.[0].trailingAction).toBeUndefined();
    const text = JSON.stringify(renderer!.toJSON());
    expect(text).toContain('마감 알림을 설정한 공구예요');
    expect(text).not.toContain('알림 해제');
  });

  it('renders without crashing', () => {
    const renderer = renderMyPageScreen();
    expect(renderer.toJSON()).toBeTruthy();
  });

  it('renders a Kakao user without an email instead of throwing', async () => {
    authMocks.session = {
      access_token: 'kakao-access-token',
      user: {
        id: 'kakao-user',
        email: '',
        created_at: '2026-07-25T00:00:00.000Z',
        app_metadata: { provider: 'kakao' },
        user_metadata: { name: '카카오 사용자' },
      },
    };

    const renderer = renderMyPageScreen();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(JSON.stringify(renderer.toJSON())).toContain('카카오 사용자');
  });

  it('explains that guest bookmarks and notifications require login', async () => {
    const renderer = renderMyPageScreen();
    await act(async () => {
      await Promise.resolve();
    });

    expect(JSON.stringify(renderer.toJSON())).toContain(
      '북마크와 알림 설정은 로그인 후 이용할 수 있어요.',
    );
  });

  it("offers login even before the 14+ confirmation is stored", async () => {
    audienceMocks.policy.canAuthenticate = false;
    audienceMocks.policy.canRequestAds = false;
    audienceMocks.policy.canRecordBehaviorSignals = false;
    const renderer = renderMyPageScreen();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(JSON.stringify(renderer.toJSON())).not.toContain("만 13세 모드");
    const loginButton = renderer.root.findByProps({
      accessibilityLabel: "로그인하고 활동 이어보기",
    });

    act(() => {
      loginButton.props.onPress();
    });

    expect(navigationMocks.navigate).toHaveBeenCalledWith("Login");
  });

  it("shows loading state initially", () => {
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

  it('renders notification and theme controls without follow notification controls', () => {
    const renderer = renderScreen(React.createElement(SettingsScreen));
    const rendered = JSON.stringify(renderer.toJSON());

    expect(rendered).toContain("알림 설정");
    expect(rendered).toContain("화면 테마");
    expect(rendered).toContain("시스템");
    expect(rendered).toContain("라이트");
    expect(rendered).toContain("다크");
    expect(rendered).not.toContain("연령 설정");
    expect(
      renderer.root.findAll(
        (node) =>
          typeof node.props.accessibilityLabel === "string" &&
          node.props.accessibilityLabel.startsWith("연령 구간"),
      ),
    ).toHaveLength(0);
    expect(rendered).not.toContain("공구 마감 임박 알림");
    expect(
      renderer.root.findAllByProps({ testID: 'deadline-notification-toggle' }),
    ).toHaveLength(0);
    expect(rendered).toContain('내 제보 승인 알림');
    expect(rendered).toContain('마케팅 정보 수신');
    expect(rendered).not.toContain('팔로우 알림');
    expect(rendered).not.toContain('@seller.one');
    expect(rendered).not.toContain('Brand A');
    expect(rendered).not.toContain('마감 알림 날짜');
    expect(rendered).not.toContain('테스트 알림 보내기');
  });

  it('shows legal document buttons and the app version in settings', async () => {
    const renderer = renderScreen(React.createElement(SettingsScreen));
    const rendered = JSON.stringify(renderer.toJSON());

    expect(rendered).toContain('앱 정보');
    expect(rendered).toContain('개인정보 처리방침');
    expect(rendered).toContain('서비스 이용약관');
    expect(rendered).toContain('앱 버전');
    expect(rendered).toContain('2.3.4 (42)');

    const privacyPolicyButton = renderer.root.findByProps({
      accessibilityLabel: '개인정보 처리방침',
    });
    const termsOfServiceButton = renderer.root.findByProps({
      accessibilityLabel: '서비스 이용약관',
    });

    await act(async () => {
      await privacyPolicyButton.props.onPress();
    });

    expect(Linking.openURL).toHaveBeenNthCalledWith(
      1,
      'https://gongguwish.com/privacy',
    );

    await act(async () => {
      await termsOfServiceButton.props.onPress();
    });

    expect(Linking.openURL).toHaveBeenNthCalledWith(
      2,
      'https://gongguwish.com/terms',
    );
  });

  it('opens required Google ad privacy options from settings', async () => {
    adsMocks.privacyOptionsRequired = true;
    const renderer = renderScreen(React.createElement(SettingsScreen));
    const button = renderer.root.findByProps({
      accessibilityLabel: '광고 개인정보 설정',
    });

    await act(async () => {
      await button.props.onPress();
    });

    expect(JSON.stringify(renderer.toJSON())).toContain('개인정보 및 광고');
    expect(adsMocks.showPrivacyOptions).toHaveBeenCalledOnce();
  });

  it('persists own-submission approval without exposing follow notification controls', async () => {
    authMocks.session = {
      access_token: 'access-token',
      user: { id: 'user-1', email: 'user@example.com' },
    };
    const renderer = renderScreen(React.createElement(SettingsScreen));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const submissionApprovalSwitch = renderer.root.findByProps({
      accessibilityLabel: '내 제보 승인 알림',
    });

    await act(async () => {
      await submissionApprovalSwitch.props.onValueChange(false);
    });

    expect(settingsPreferenceMocks.updatePreferences).toHaveBeenCalledWith({
      submissionApprovalEnabled: false,
    });
    expect(
      renderer.root.findAllByProps({
        accessibilityLabel: '@seller.one 인플루언서 알림 해제',
      }),
    ).toHaveLength(0);
    expect(
      renderer.root.findAllByProps({
        accessibilityLabel: 'Brand A 브랜드 알림 해제',
      }),
    ).toHaveLength(0);
  });

  it('keeps notification switches interactive while preferences sync', async () => {
    authMocks.session = {
      access_token: 'access-token',
      user: { id: 'user-1', email: 'user@example.com' },
    };
    settingsPreferenceMocks.saving = true;
    const renderer = renderScreen(React.createElement(SettingsScreen));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      renderer.root.findByProps({ accessibilityLabel: '푸시 알림' }).props
        .disabled,
    ).toBe(false);
    expect(
      renderer.root.findByProps({ accessibilityLabel: '내 제보 승인 알림' })
        .props.disabled,
    ).toBe(false);
  });

  it('routes guest notification changes to login without persisting them', async () => {
    const renderer = renderScreen(React.createElement(SettingsScreen));
    const push = renderer.root.findByProps({
      accessibilityLabel: '푸시 알림',
    });

    await act(async () => {
      await push.props.onValueChange(true);
      await Promise.resolve();
    });

    expect(navigationMocks.navigate).toHaveBeenCalledWith('Login');
    expect(settingsPreferenceMocks.updatePreferences).not.toHaveBeenCalled();
    expect(push.props.value).toBe(false);
  });

  it("keeps the login route available from settings before 14+ confirmation", async () => {
    audienceMocks.policy.canAuthenticate = false;
    audienceMocks.policy.canRequestAds = false;
    audienceMocks.policy.canRecordBehaviorSignals = false;
    const renderer = renderScreen(React.createElement(SettingsScreen));
    const push = renderer.root.findByProps({ accessibilityLabel: "푸시 알림" });

    expect(push.props.disabled).toBe(false);
    expect(JSON.stringify(renderer.toJSON())).not.toContain("만 13세 모드");

    await act(async () => {
      await push.props.onValueChange(true);
      await Promise.resolve();
    });

    expect(navigationMocks.navigate).toHaveBeenCalledWith("Login");
    expect(settingsPreferenceMocks.updatePreferences).not.toHaveBeenCalled();
  });

  it("moves the push toggle immediately while token registration finishes", async () => {
    authMocks.session = {
      access_token: 'access-token',
      user: { id: 'user-1', email: 'user@example.com' },
    };
    settingsPreferenceMocks.preferences.pushEnabled = false;
    let resolveRegistration!: (result: {
      status: 'registered';
      token: string;
    }) => void;
    const registration = new Promise<{
      status: 'registered';
      token: string;
    }>((resolve) => {
      resolveRegistration = resolve;
    });
    notificationMocks.registerForPushNotifications.mockReturnValueOnce(
      registration,
    );
    const renderer = renderScreen(React.createElement(SettingsScreen));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const push = renderer.root.findByProps({ accessibilityLabel: '푸시 알림' });
    act(() => {
      push.props.onValueChange(true);
    });

    expect(
      renderer.root.findByProps({ accessibilityLabel: '푸시 알림' }).props
        .value,
    ).toBe(true);
    expect(
      renderer.root.findByProps({ accessibilityLabel: '푸시 알림' }).props
        .disabled,
    ).toBe(false);
    expect(settingsPreferenceMocks.updatePreferences).not.toHaveBeenCalledWith({
      pushEnabled: true,
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(notificationMocks.registerForPushNotifications).toHaveBeenCalledWith(
      'access-token',
      expect.objectContaining({
        refreshAuthToken: expect.any(Function),
        requestPermission: true,
      }),
    );

    await act(async () => {
      resolveRegistration({
        status: 'registered',
        token: 'ExpoPushToken[test-token]',
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(settingsPreferenceMocks.updatePreferences).toHaveBeenCalledWith({
      pushEnabled: true,
    });
  });

  it('requests explicit push permission before enabling marketing messages', async () => {
    authMocks.session = {
      access_token: 'access-token',
      user: { id: 'user-1', email: 'user@example.com' },
    };
    settingsPreferenceMocks.preferences.pushEnabled = false;
    settingsPreferenceMocks.preferences.marketingPushEnabled = false;
    let resolveRegistration!: (result: {
      status: 'registered';
      token: string;
    }) => void;
    notificationMocks.registerForPushNotifications.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRegistration = resolve;
      }),
    );

    const renderer = renderScreen(React.createElement(SettingsScreen));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const marketing = renderer.root.findByProps({
      accessibilityLabel: '마케팅 정보 수신',
    });
    await act(async () => {
      await marketing.props.onValueChange(true);
      await Promise.resolve();
    });

    expect(notificationMocks.registerForPushNotifications).toHaveBeenCalledWith(
      'access-token',
      expect.objectContaining({ requestPermission: true }),
    );
    expect(
      settingsPreferenceMocks.updatePreferences,
    ).not.toHaveBeenCalledWith({ marketingPushEnabled: true });
    expect(marketing.props.value).toBe(false);

    await act(async () => {
      resolveRegistration({
        status: 'registered',
        token: 'ExpoPushToken[test-token]',
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(settingsPreferenceMocks.updatePreferences).toHaveBeenCalledWith({
      marketingPushEnabled: true,
    });
  });

  it('withdraws marketing consent without requesting push permission', async () => {
    authMocks.session = {
      access_token: 'access-token',
      user: { id: 'user-1', email: 'user@example.com' },
    };
    settingsPreferenceMocks.preferences.marketingPushEnabled = true;

    const renderer = renderScreen(React.createElement(SettingsScreen));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const marketing = renderer.root.findByProps({
      accessibilityLabel: '마케팅 정보 수신',
    });
    await act(async () => {
      await marketing.props.onValueChange(false);
    });

    expect(settingsPreferenceMocks.updatePreferences).toHaveBeenCalledWith({
      marketingPushEnabled: false,
    });
    expect(notificationMocks.registerForPushNotifications).not.toHaveBeenCalled();
  });

  it('rolls the optimistic push toggle back after a native token failure', async () => {
    authMocks.session = {
      access_token: 'access-token',
      user: { id: 'user-1', email: 'user@example.com' },
    };
    settingsPreferenceMocks.preferences.pushEnabled = false;
    let resolveRegistration!: (result: {
      status: 'failed';
      reason: 'token-request-failed';
    }) => void;
    const registration = new Promise<{
      status: 'failed';
      reason: 'token-request-failed';
    }>((resolve) => {
      resolveRegistration = resolve;
    });
    notificationMocks.registerForPushNotifications.mockReturnValueOnce(
      registration,
    );
    const renderer = renderScreen(React.createElement(SettingsScreen));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const push = renderer.root.findByProps({ accessibilityLabel: '푸시 알림' });
    act(() => {
      push.props.onValueChange(true);
    });

    expect(
      renderer.root.findByProps({ accessibilityLabel: '푸시 알림' }).props
        .value,
    ).toBe(true);

    await act(async () => {
      resolveRegistration({
        status: 'failed',
        reason: 'token-request-failed',
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      renderer.root.findByProps({ accessibilityLabel: '푸시 알림' }).props
        .value,
    ).toBe(false);
    expect(settingsPreferenceMocks.updatePreferences).not.toHaveBeenCalledWith({
      pushEnabled: true,
    });
    expect(alertMocks.alert).toHaveBeenCalledWith(
      '푸시 알림 등록에 실패했어요',
      expect.stringContaining('앱 설정'),
    );
  });

  it('keeps the latest push intent when an older registration finishes', async () => {
    authMocks.session = {
      access_token: 'access-token',
      user: { id: 'user-1', email: 'user@example.com' },
    };
    settingsPreferenceMocks.preferences.pushEnabled = false;
    let resolveRegistration!: () => void;
    notificationMocks.registerForPushNotifications.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRegistration = () =>
          resolve({
            status: 'registered',
            token: 'ExpoPushToken[test-token]',
          });
      }),
    );
    const renderer = renderScreen(React.createElement(SettingsScreen));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      renderer.root
        .findByProps({ accessibilityLabel: '푸시 알림' })
        .props.onValueChange(true);
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      renderer.root
        .findByProps({ accessibilityLabel: '푸시 알림' })
        .props.onValueChange(false);
    });

    expect(
      renderer.root.findByProps({ accessibilityLabel: '푸시 알림' }).props
        .value,
    ).toBe(false);

    await act(async () => {
      resolveRegistration();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(settingsPreferenceMocks.updatePreferences).not.toHaveBeenCalledWith({
      pushEnabled: true,
    });
    expect(settingsPreferenceMocks.updatePreferences).toHaveBeenCalledWith({
      pushEnabled: false,
    });
    expect(alertMocks.alert).not.toHaveBeenCalled();
  });

  it('deletes the account only after explicit destructive confirmation', async () => {
    authMocks.session = {
      access_token: 'access-token',
      user: {
        id: 'user-1',
        email: 'user@example.com',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    };
    const deleteSpy = vi
      .spyOn(api, 'deleteAccount')
      .mockResolvedValue(undefined);
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

    expect(deleteSpy).not.toHaveBeenCalled();
    expect(authMocks.signOut).not.toHaveBeenCalled();
    expect(navigationMocks.goBack).not.toHaveBeenCalled();
    expect(alertMocks.alert).toHaveBeenCalledOnce();
    expect(alertMocks.alert).toHaveBeenCalledWith(
      '회원 탈퇴',
      '정말 탈퇴하시겠습니까?\n탈퇴하면 계정과 저장된 활동 데이터가 삭제되며 복구할 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        expect.objectContaining({
          text: '탈퇴하기',
          style: 'destructive',
          onPress: expect.any(Function),
        }),
      ],
    );
    const options = alertMocks.alert.mock.calls.at(-1)?.[2] as Array<{
      text: string;
      style: string;
      onPress?: () => void;
    }>;

    expect(options[0]?.onPress).toBeUndefined();
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(authMocks.signOut).not.toHaveBeenCalled();
    expect(navigationMocks.goBack).not.toHaveBeenCalled();

    act(() => {
      options[1]?.onPress?.();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(deleteSpy).toHaveBeenCalledOnce();
    expect(deleteSpy).toHaveBeenCalledWith('access-token');
    expect(authMocks.signOut).toHaveBeenCalledOnce();
    expect(navigationMocks.goBack).toHaveBeenCalledOnce();
    deleteSpy.mockRestore();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
