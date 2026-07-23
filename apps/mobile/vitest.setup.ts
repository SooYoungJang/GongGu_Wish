import React from "react";
import { vi } from "vitest";

Object.defineProperty(global, "fetch", {
  value: vi.fn(),
  writable: true,
});

(globalThis as any).__DEV__ = false;

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {},
    },
  },
}));

// ─── react-native mock ──────────────────────────────────────────────────────
const passthrough = (type: string) =>
  ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement(type, props, children);

vi.mock("react-native", () => {
  function AnimatedValue(this: any, value: number) {
    this._value = value;
    this.interpolate = vi.fn(() => 0);
  }

  return {
    ActivityIndicator: passthrough("ActivityIndicator"),
    Alert: { alert: vi.fn() },
    Animated: {
      Value: AnimatedValue,
      timing: () => ({ start: (cb?: () => void) => cb?.() }),
      delay: () => ({ start: vi.fn(), stop: vi.fn() }),
      loop: () => ({ start: vi.fn(), stop: vi.fn() }),
      parallel: () => ({ start: vi.fn(), stop: vi.fn() }),
      sequence: () => ({ start: vi.fn(), stop: vi.fn() }),
      View: passthrough("Animated.View"),
    },
    AccessibilityInfo: {
      addEventListener: vi.fn(() => ({ remove: vi.fn() })),
      announceForAccessibility: vi.fn(),
      isReduceMotionEnabled: vi.fn(() => Promise.resolve(false)),
      isScreenReaderEnabled: vi.fn(() => Promise.resolve(false)),
    },
    BackHandler: {
      addEventListener: vi.fn(() => ({ remove: vi.fn() })),
      exitApp: vi.fn(),
    },
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    Easing: {
      inOut: vi.fn(() => vi.fn()),
      sin: vi.fn(),
      ease: null,
      quad: null,
      cubic: null,
    },
    Image: passthrough("Image"),
    Linking: {
      addEventListener: vi.fn(() => ({ remove: vi.fn() })),
      getInitialURL: vi.fn(() => Promise.resolve(null)),
      openURL: vi.fn(() => Promise.resolve(true)),
    },
    Keyboard: {
      addListener: (event: any, cb: any) => {
        if (!globalThis.__keyboardListeners) globalThis.__keyboardListeners = {};
        globalThis.__keyboardListeners[event] = cb;
        return { remove: vi.fn() };
      },
    },
    KeyboardAvoidingView: passthrough("KeyboardAvoidingView"),
    Modal: ({ children, visible, ...props }: { children?: React.ReactNode; visible?: boolean }) =>
      visible ? React.createElement("Modal", props, children) : null,
    Platform: {
      OS: "ios",
      select: (obj: Record<string, unknown>) =>
        (obj as any).ios ?? obj.default,
    },
    Pressable: ({ children, ...props }: any) =>
      React.createElement("Pressable", props, children),
    ScrollView: passthrough("ScrollView"),
    StyleSheet: {
      create: (styles: unknown) => styles,
      flatten: (style: unknown) => style,
    },
    Text: passthrough("Text"),
    TextInput: passthrough("TextInput"),
    TouchableOpacity: passthrough("TouchableOpacity"),
    View: passthrough("View"),
    useColorScheme: () => (globalThis as any).__mockColorScheme ?? "light",
    __colorScheme: "light",
    __setColorScheme: (scheme: "light" | "dark") => {
      (globalThis as any).__mockColorScheme = scheme;
    },
    useWindowDimensions: () => ({ width: 390, height: 844 }),
  };
});

vi.mock("react-native-reanimated", () => {
  const ReactMock = require("react");
  const animated = {
    View: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement("Reanimated.View", props, children),
    createAnimatedComponent: (component: unknown) => component,
  };
  const interpolate = (
    value: number,
    inputRange: number[],
    outputRange: number[],
  ) => {
    const [inputMin, inputMax] = inputRange;
    const [outputMin, outputMax] = outputRange;
    if (inputMax === inputMin) return outputMin;
    const progress = Math.min(1, Math.max(0, (value - inputMin) / (inputMax - inputMin)));
    return outputMin + (outputMax - outputMin) * progress;
  };

  return {
    default: animated,
    View: animated.View,
    cancelAnimation: vi.fn(),
    Easing: {
      cubic: vi.fn((value: number) => value),
      out: vi.fn((fn: unknown) => fn),
    },
    Extrapolation: {
      CLAMP: "clamp",
    },
    interpolate,
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
    useAnimatedStyle: (updater: () => unknown) => updater(),
    useSharedValue: (value: unknown) => {
      const ref = ReactMock.useRef<{ value: unknown } | null>(null);
      if (!ref.current) {
        ref.current = { value };
      }
      return ref.current;
    },
    withSpring: vi.fn((toValue: unknown, _config?: unknown, callback?: (finished?: boolean) => void) => {
      callback?.(true);
      return toValue;
    }),
    withTiming: vi.fn((toValue: unknown, _config?: unknown, callback?: (finished?: boolean) => void) => {
      callback?.(true);
      return toValue;
    }),
  };
});

vi.mock("react-native-gesture-handler", () => {
  const ReactMock = require("react");
  const chainable = (handlers: Record<string, unknown> = {}) => ({
    __handlers: handlers,
    activeOffsetY(value: unknown) {
      handlers.activeOffsetY = value;
      return this;
    },
    enabled(value: boolean) {
      handlers.enabled = value;
      return this;
    },
    failOffsetX(value: unknown) {
      handlers.failOffsetX = value;
      return this;
    },
    onBegin(handler: unknown) {
      handlers.onBegin = handler;
      return this;
    },
    onEnd(handler: unknown) {
      handlers.onEnd = handler;
      return this;
    },
    onFinalize(handler: unknown) {
      handlers.onFinalize = handler;
      return this;
    },
    onUpdate(handler: unknown) {
      handlers.onUpdate = handler;
      return this;
    },
    runOnJS(value: boolean) {
      handlers.runOnJS = value;
      return this;
    },
  });

  return {
    Gesture: {
      Pan: () => chainable(),
    },
    GestureDetector: ({ children, gesture }: { children?: React.ReactNode; gesture: unknown }) =>
      ReactMock.createElement("GestureDetector", { gesture }, children),
    GestureHandlerRootView: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement("GestureHandlerRootView", props, children),
    ScrollView: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement("ScrollView", props, children),
  };
});

vi.mock("react-native-pager-view", () => {
  const ReactMock = require("react");

  const PagerView = ReactMock.forwardRef(({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<unknown>) => {
    ReactMock.useImperativeHandle(ref, () => ({
      setPage: vi.fn(),
      setPageWithoutAnimation: vi.fn(),
    }));

    return ReactMock.createElement("PagerView", props, children);
  });

  return {
    default: PagerView,
  };
});

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  SafeAreaProvider: ({ children }: { children: unknown }) => children,
}));

vi.mock("react-native-google-mobile-ads", () => ({
  default: vi.fn(() => ({
    initialize: vi.fn(async () => []),
  })),
  AdsConsent: {
    gatherConsent: vi.fn(async () => ({ canRequestAds: true })),
    getConsentInfo: vi.fn(async () => ({ canRequestAds: true })),
    showPrivacyOptionsForm: vi.fn(async () => ({ canRequestAds: true })),
  },
  NativeAd: {
    createForAdRequest: vi.fn(),
  },
  NativeAdView: passthrough("NativeAdView"),
  NativeAsset: passthrough("NativeAsset"),
  NativeMediaView: passthrough("NativeMediaView"),
  NativeAssetType: {
    ADVERTISER: "advertiser",
    BODY: "body",
    CALL_TO_ACTION: "callToAction",
    HEADLINE: "headline",
    ICON: "icon",
  },
  NativeAdChoicesPlacement: {
    TOP_RIGHT: 1,
  },
  NativeMediaAspectRatio: {
    LANDSCAPE: 2,
    PORTRAIT: 3,
    SQUARE: 4,
  },
  TestIds: {
    NATIVE: "test-native-unit",
  },
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(() => Promise.resolve(null)),
    setItem: vi.fn(() => Promise.resolve()),
    removeItem: vi.fn(() => Promise.resolve()),
  },
  getItem: vi.fn(() => Promise.resolve(null)),
  setItem: vi.fn(() => Promise.resolve()),
  removeItem: vi.fn(() => Promise.resolve()),
}));

vi.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    React.useEffect(effect, [effect]);
  },
  useIsFocused: () => true,
  useNavigation: () => ({
    navigate: vi.fn(),
    goBack: vi.fn(),
  }),
  useRoute: () => ({ params: {} }),
}));

vi.mock("@react-navigation/native-stack", () => ({}));

vi.mock("react-native-keyboard-controller", () => {
  const passthrough = (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement(type, props, children);
  return {
    KeyboardAwareScrollView: passthrough("KeyboardAwareScrollView"),
    KeyboardStickyView: passthrough("KeyboardStickyView"),
    KeyboardProvider: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    KeyboardAvoidingView: passthrough("KeyboardAvoidingView"),
    useReanimatedKeyboardAnimation: () => {
      const height = React.useRef({ value: (globalThis as any).__mockKeyboardHeight ?? 0 }).current;
      const progress = React.useRef({ value: 0 }).current;
      return { height, progress };
    },
  };
});

vi.mock("@tanstack/react-query", () => ({
  QueryClient: class QueryClient {
    constructor(_options?: unknown) {}
    clear = vi.fn();
  },
  QueryClientProvider: ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  useQuery: vi.fn(() => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })),
  useMutation: vi.fn(),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));
