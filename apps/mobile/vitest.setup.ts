import React from "react";
import { vi } from "vitest";

Object.defineProperty(global, "fetch", {
  value: vi.fn(),
  writable: true,
});

(globalThis as any).__DEV__ = false;

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
      isReduceMotionEnabled: vi.fn(() => Promise.resolve(false)),
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
    Keyboard: {
      addListener: (event: any, cb: any) => {
        if (!globalThis.__keyboardListeners) globalThis.__keyboardListeners = {};
        globalThis.__keyboardListeners[event] = cb;
        return { remove: vi.fn() };
      },
    },
    KeyboardAvoidingView: passthrough("KeyboardAvoidingView"),
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
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.default.callThrough = true;
  return Reanimated;
});

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  SafeAreaProvider: ({ children }: { children: unknown }) => children,
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
  };
});

vi.mock("@tanstack/react-query", () => ({
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
