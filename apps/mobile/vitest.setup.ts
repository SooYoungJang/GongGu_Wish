import { vi } from "vitest";

Object.defineProperty(global, "fetch", {
  value: vi.fn(),
  writable: true,
});

vi.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.default.callThrough = true;
  return Reanimated;
});

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

vi.mock("@tanstack/react-query", async () => {
  const actualQuery = await vi.importActual("@tanstack/react-query");
  return {
    ...actualQuery,
    useQuery: vi.fn((key, fn) => {
      return { data: [], isLoading: false, isError: false, refetch: vi.fn() };
    }),
    useMutation: vi.fn(),
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});