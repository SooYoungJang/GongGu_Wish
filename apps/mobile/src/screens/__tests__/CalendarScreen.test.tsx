import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CalendarScreen, filterGroupBuysByActivity } from "../CalendarScreen";
import { CALENDAR_CARD_HEIGHT } from "../../components/calendar/CalendarDateRow";
import { ThemeProvider } from "../../context/ThemeContext";
import { Pressable } from "react-native";
import { spacing } from "../../design/tokens";
import type { GroupBuy } from "../../types";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("../../api", () => ({
  fetchGroupBuys: vi.fn(),
}));

const activityMock = vi.hoisted(() => ({
  bookmarks: [] as Array<{ id: string }>,
  notifications: [] as Array<{ groupBuyId: string }>,
}));

const navigationMock = vi.hoisted(() => ({
  goBack: vi.fn(),
  navigate: vi.fn(),
}));

const listMock = vi.hoisted(() => ({
  scrollToIndex: vi.fn(),
  scrollToOffset: vi.fn(),
}));

vi.mock("../../hooks/useLocalDeals", () => ({
  useBookmarks: () => ({ bookmarks: activityMock.bookmarks, ready: true }),
  useNotifications: () => ({
    notifications: activityMock.notifications,
    ready: true,
  }),
}));

vi.mock("expo-secure-store", () => ({
  default: {
    getItemAsync: vi.fn(),
    setItemAsync: vi.fn(),
    deleteItemAsync: vi.fn(),
  },
}));

// Shared mutable query mock for tests that need custom return data
let mockQueryResult: {
  data: GroupBuy[] | null;
  isFetching: boolean;
  isError: boolean;
} = {
  data: null,
  isFetching: false,
  isError: false,
};

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => mockQueryResult,
}));

vi.mock("react-native", () => {
  const ReactMock = require("react");
  const passthrough =
    (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement(type, props, children);

  return {
    ActivityIndicator: passthrough("ActivityIndicator"),
    FlatList: ReactMock.forwardRef(
      (
        {
          data = [],
          keyExtractor,
          renderItem,
          ListEmptyComponent,
          ...props
        }: any,
        ref: React.Ref<unknown>,
      ) => {
        ReactMock.useImperativeHandle(ref, () => ({
          scrollToIndex: listMock.scrollToIndex,
          scrollToOffset: listMock.scrollToOffset,
        }));
        const children =
          data.length > 0
            ? data.map((item: unknown, index: number) =>
                ReactMock.cloneElement(renderItem({ item, index }), {
                  key: keyExtractor?.(item, index) ?? index,
                }),
              )
            : typeof ListEmptyComponent === "function"
              ? ReactMock.createElement(ListEmptyComponent)
              : ListEmptyComponent;
        return ReactMock.createElement("FlatList", props, children);
      },
    ),
    Modal: ({ children, visible, ...props }: any) =>
      visible ? ReactMock.createElement("Modal", props, children) : null,
    Platform: {
      select: (obj: Record<string, unknown>) => obj.default,
    },
    Pressable: ({
      children,
      onPress,
      style,
      testID,
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
    }: any) =>
      ReactMock.createElement(
        "Pressable",
        {
          onPress,
          style,
          testID,
          accessibilityLabel,
          accessibilityRole,
          accessibilityState,
        },
        children,
      ),
    ScrollView: ({ children, ...props }: any) =>
      ReactMock.createElement("ScrollView", props, children),
    StyleSheet: { create: (styles: unknown) => styles },
    Text: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement("Text", props, children),
    View: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement("View", props, children),
    useColorScheme: () => "light",
    useWindowDimensions: () => ({ width: 390, height: 844 }),
  };
});

vi.mock("react-native-safe-area-context", () => {
  const ReactMock = require("react");
  return {
    SafeAreaView: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement("SafeAreaView", props, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
  };
});

// ─── Sample data ─────────────────────────────────────────────────────────────

const sampleGroupBuys: GroupBuy[] = [
  {
    id: "gb-cal-1",
    productName: "비건 선크림",
    brandName: "Sample Beauty",
    endDate:
      new Date(new Date().getFullYear(), new Date().getMonth(), 15)
        .toISOString()
        .slice(0, 10) + "T23:59:59+09:00",
    purchaseUrl: "https://example.com",
    discountInfo: "20% 할인",
    summary: "민감 피부용 선크림",
    confidence: 0.9,
    startDate: null,
    thumbnailUrl: null,
    videoUrl: null,
    mediaUrls: [],
    mediaType: null,
    rawPost: {
      postUrl: "https://instagram.com/p/c1",
      influencer: { instagramUsername: "beauty_pick" },
    },
  },
  {
    id: "gb-cal-2",
    productName: "그래놀라 세트",
    brandName: "Morning Table",
    endDate:
      new Date(new Date().getFullYear(), new Date().getMonth(), 15)
        .toISOString()
        .slice(0, 10) + "T23:59:59+09:00",
    purchaseUrl: "https://example.com/granola",
    discountInfo: "1+1",
    summary: "아침 식사용 그래놀라",
    confidence: 0.85,
    startDate: null,
    thumbnailUrl: null,
    videoUrl: null,
    mediaUrls: [],
    mediaType: null,
    rawPost: {
      postUrl: "https://instagram.com/p/c2",
      influencer: { instagramUsername: "food_mate" },
    },
  },
  {
    id: "gb-cal-3",
    productName: "프리미엄 홈트 키트",
    brandName: "핏스타그램",
    endDate:
      new Date(new Date().getFullYear(), new Date().getMonth() + 1, 5)
        .toISOString()
        .slice(0, 10) + "T23:59:59+09:00",
    purchaseUrl: "https://example.com/fitness",
    discountInfo: "25% 할인",
    summary: "홈트레이닝 풀세트",
    confidence: 0.78,
    startDate: null,
    thumbnailUrl: null,
    videoUrl: null,
    mediaUrls: [],
    mediaType: null,
    rawPost: {
      postUrl: "https://instagram.com/p/c3",
      influencer: { instagramUsername: "fitness_guru" },
    },
  },
];

// ─── Helper ──────────────────────────────────────────────────────────────────

function flattenText(
  node:
    | TestRenderer.ReactTestRendererJSON
    | TestRenderer.ReactTestRendererJSON[]
    | null,
): string {
  if (!node) return "";
  if (Array.isArray(node)) return node.map(flattenText).join(" ");
  return (
    node.children
      ?.map((child) => (typeof child === "string" ? child : flattenText(child)))
      .join(" ") ?? ""
  );
}

function renderCalendar(params: Record<string, unknown> = {}) {
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <ThemeProvider>
        <CalendarScreen
          navigation={navigationMock as any}
          route={
            { params, key: "CalendarScreen", name: "CalendarScreen" } as any
          }
        />
      </ThemeProvider>,
    );
  });
  return renderer!;
}

function openCalendarPicker(renderer: TestRenderer.ReactTestRenderer) {
  const toggle = renderer.root.findByProps({ testID: "calendar-month-toggle" });
  act(() => toggle.props.onPress());
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("CalendarScreen", () => {
  beforeEach(() => {
    activityMock.bookmarks = [];
    activityMock.notifications = [];
    listMock.scrollToIndex.mockClear();
    listMock.scrollToOffset.mockClear();
    navigationMock.goBack.mockClear();
    navigationMock.navigate.mockClear();
    mockQueryResult = {
      data: null,
      isFetching: false,
      isError: false,
    };
  });

  it("renders the calendar header with current year and month", () => {
    const renderer = renderCalendar();
    const text = flattenText(renderer!.toJSON());
    const now = new Date();
    expect(text).toContain(`${now.getFullYear()}년 ${now.getMonth() + 1}월`);
    expect(text).toContain("오늘");
  });

  it("renders a top today button and scrolls to the current date row", () => {
    const renderer = renderCalendar({
      initialDate: "2026-01-15",
    });
    const todayButton = renderer.root.findByProps({
      testID: "calendar-today-button",
    });

    listMock.scrollToIndex.mockClear();
    act(() => todayButton.props.onPress());

    expect(todayButton.props.accessibilityLabel).toBe("오늘로 이동");
    expect(listMock.scrollToIndex).toHaveBeenCalledWith({
      animated: true,
      index: expect.any(Number),
      viewPosition: 0,
    });
  });

  it("keeps the today action in the filter row as a compact secondary action", () => {
    const renderer = renderCalendar();
    const filterActions = renderer.root.findByProps({
      testID: "calendar-filter-actions",
    });

    expect(
      filterActions.findByProps({ testID: "calendar-today-button" }),
    ).toBeDefined();
    expect(
      renderer.root
        .findByProps({ testID: "calendar-month-row" })
        .findAllByProps({
          testID: "calendar-today-button",
        }),
    ).toHaveLength(0);
  });

  it("keeps the calendar picker closed by default and opens it from the year-month button", () => {
    const renderer = renderCalendar();
    expect(
      renderer.root.findAllByProps({ testID: "calendar-picker-modal" }),
    ).toHaveLength(0);

    const toggle = renderer.root.findByProps({
      testID: "calendar-month-toggle",
    });
    expect(toggle.props.accessibilityLabel).toContain("달력 열기");

    act(() => toggle.props.onPress());

    expect(
      renderer.root.findByProps({ testID: "calendar-picker-modal" }),
    ).toBeDefined();
    expect(
      renderer.root.findByProps({ testID: "calendar-grid" }),
    ).toBeDefined();
    expect(
      renderer.root.findByProps({ testID: "calendar-month-toggle" }).props
        .accessibilityLabel,
    ).toContain("달력 닫기");
  });

  it("renders weekday labels in order (월~일)", () => {
    const renderer = renderCalendar();
    openCalendarPicker(renderer);
    const text = flattenText(renderer!.toJSON());
    expect(text).toContain("월");
    expect(text).toContain("화");
    expect(text).toContain("수");
    expect(text).toContain("목");
    expect(text).toContain("금");
    expect(text).toContain("토");
    expect(text).toContain("일");
  });

  it("renders today's date and marks it in the grid", () => {
    const renderer = renderCalendar();
    openCalendarPicker(renderer);
    const today = new Date();
    const text = flattenText(renderer!.toJSON());
    expect(text).toContain(String(today.getDate()));
  });

  it("renders navigation arrows and today button", () => {
    const renderer = renderCalendar();
    openCalendarPicker(renderer);
    const pressables = renderer!.root.findAllByType(
      "Pressable" as unknown as React.ElementType,
    );
    const labels = pressables
      .map((p) => p.props.accessibilityLabel)
      .filter(Boolean);
    expect(labels).toContain("이전 달");
    expect(labels).toContain("다음 달");
    expect(labels).toContain("오늘로 이동");
  });

  it("renders activity filters instead of the unavailable following filter", () => {
    const renderer = renderCalendar();
    const text = flattenText(renderer!.toJSON());

    expect(text).toContain("전체 보기");
    expect(text).toContain("북마크");
    expect(text).toContain("알림");
    expect(text).not.toContain("북마크만 보기");
    expect(text).not.toContain("알림만 보기");
    expect(text).not.toContain("둘 다 보기");
    expect(text).not.toContain("✓");
    expect(text).not.toContain("팔로잉");
  });

  it("filters group buys by bookmark and notification combinations", () => {
    const bookmarkedIds = new Set(["gb-cal-1", "gb-cal-3"]);
    const notifiedIds = new Set(["gb-cal-2", "gb-cal-3"]);

    expect(
      filterGroupBuysByActivity(
        sampleGroupBuys,
        { bookmarked: false, notified: false },
        bookmarkedIds,
        notifiedIds,
      ).map((item) => item.id),
    ).toEqual(["gb-cal-1", "gb-cal-2", "gb-cal-3"]);
    expect(
      filterGroupBuysByActivity(
        sampleGroupBuys,
        { bookmarked: true, notified: false },
        bookmarkedIds,
        notifiedIds,
      ).map((item) => item.id),
    ).toEqual(["gb-cal-1", "gb-cal-3"]);
    expect(
      filterGroupBuysByActivity(
        sampleGroupBuys,
        { bookmarked: false, notified: true },
        bookmarkedIds,
        notifiedIds,
      ).map((item) => item.id),
    ).toEqual(["gb-cal-2", "gb-cal-3"]);
    expect(
      filterGroupBuysByActivity(
        sampleGroupBuys,
        { bookmarked: true, notified: true },
        bookmarkedIds,
        notifiedIds,
      ).map((item) => item.id),
    ).toEqual(["gb-cal-1", "gb-cal-2", "gb-cal-3"]);
  });

  it("applies the selected activity filter to the calendar deals", () => {
    const today = new Date();
    const todayEnd = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      23,
      59,
      59,
    ).toISOString();
    const bookmarkDeal = {
      ...sampleGroupBuys[0],
      id: "gb-filter-bookmark",
      productName: "북마크 전용 공구",
      endDate: todayEnd,
    };
    const notificationDeal = {
      ...sampleGroupBuys[1],
      id: "gb-filter-notification",
      productName: "알림 전용 공구",
      endDate: todayEnd,
    };
    const bothDeal = {
      ...sampleGroupBuys[2],
      id: "gb-filter-both",
      productName: "공통 공구",
      endDate: todayEnd,
    };
    mockQueryResult = {
      data: [bookmarkDeal, notificationDeal, bothDeal],
      isFetching: false,
      isError: false,
    };
    activityMock.bookmarks = [{ id: bookmarkDeal.id }, { id: bothDeal.id }];
    activityMock.notifications = [{ groupBuyId: notificationDeal.id }];
    activityMock.notifications.push({ groupBuyId: bothDeal.id });

    const renderer = renderCalendar();
    const bookmarkFilter = renderer!.root.findByProps({
      testID: "calendar-filter-bookmarked",
    });
    act(() => bookmarkFilter.props.onPress());
    const text = flattenText(renderer!.toJSON());

    expect(text).toContain("북마크 전용 공구");
    expect(text).toContain("공통 공구");
    expect(text).not.toContain("알림 전용 공구");

    const notificationFilter = renderer!.root.findByProps({
      testID: "calendar-filter-notified",
    });
    act(() => notificationFilter.props.onPress());
    const bothText = flattenText(renderer!.toJSON());

    expect(bothText).toContain("북마크 전용 공구");
    expect(bothText).toContain("알림 전용 공구");
    expect(bothText).toContain("공통 공구");
  });

  it("keeps the header fixed above a virtualized date timeline", () => {
    const today = new Date();
    mockQueryResult = {
      data: [
        {
          ...sampleGroupBuys[0],
          id: "gb-scroll-test",
          endDate: new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
            23,
            59,
            59,
          ).toISOString(),
        },
      ],
      isFetching: false,
      isError: false,
    };
    const renderer = renderCalendar();
    const header = renderer!.root.findByProps({ testID: "calendar-header" });
    const dateList = renderer!.root.find(
      (node) =>
        String(node.type) === "FlatList" &&
        node.props.testID === "calendar-date-list",
    );

    expect(header.props.style).toMatchObject({ flexShrink: 0 });
    expect(dateList.props.style).toMatchObject({ flex: 1 });
    mockQueryResult = {
      data: null,
      isFetching: false,
      isError: false,
    };
  });

  it("keeps the calendar grid compact inside the picker modal", () => {
    const renderer = renderCalendar();
    openCalendarPicker(renderer);
    const calendarGrid = renderer!.root.findByProps({
      testID: "calendar-grid",
    });
    const firstDayCell = renderer!.root.findAll(
      (node) => node.props.accessibilityLabel === "1일",
    )[0];

    expect(calendarGrid.props.style).toMatchObject({
      marginBottom: spacing.sm,
      paddingVertical: spacing.xxs,
    });
    expect(firstDayCell.props.style[0]).toMatchObject({ minHeight: 36 });
  });

  it("closes the picker and scrolls the timeline after selecting a date", () => {
    const renderer = renderCalendar();
    openCalendarPicker(renderer);
    const dayCell = renderer.root.findAll(
      (node) => node.props.accessibilityLabel === "1일",
    )[0];

    act(() => dayCell.props.onPress());

    expect(
      renderer.root.findAllByProps({ testID: "calendar-picker-modal" }),
    ).toHaveLength(0);
    expect(listMock.scrollToIndex).toHaveBeenCalledWith({
      animated: true,
      index: expect.any(Number),
      viewPosition: 0,
    });
  });

  it("uses the shared back button contract", () => {
    const renderer = renderCalendar();
    const backButton = renderer!.root
      .findAllByType(Pressable)
      .find((node) => node.props.testID === "calendar-back-button");

    expect(backButton).toBeDefined();
    expect(backButton!.props.accessibilityLabel).toBe("뒤로가기");
    expect(backButton!.props.accessibilityRole).toBe("button");
  });

  it("shows empty state when no group buys on selected date", () => {
    const renderer = renderCalendar();
    const text = flattenText(renderer!.toJSON());
    expect(text).toContain("이 날짜의 공구가 없어요");
  });

  it("shows a network error state without substituting sample deals", () => {
    mockQueryResult = {
      data: null,
      isFetching: false,
      isError: true,
    };

    const renderer = renderCalendar();
    const text = flattenText(renderer!.toJSON());

    expect(text).toContain("공구 정보를 불러오지 못했어요");
    expect(text).not.toContain("샘플");
  });

  it("shows group buys for the selected date when data is available", () => {
    // Mock useQuery to return data with group buys on today's date
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const buysForToday: GroupBuy[] = [
      {
        id: "gb-today-1",
        productName: "오늘의 딜",
        brandName: "투데이",
        category: "beauty",
        endDate: todayStr + "T23:59:59+09:00",
        purchaseUrl: "https://example.com",
        discountInfo: "30% 할인",
        summary: "오늘만 특가",
        confidence: 0.95,
        startDate: null,
        thumbnailUrl: null,
        videoUrl: null,
        mediaUrls: [],
        mediaType: null,
        rawPost: {
          postUrl: "https://instagram.com/p/t1",
          influencer: { instagramUsername: "daily_deal" },
        },
      },
    ];

    // Set mock data
    mockQueryResult = {
      data: buysForToday,
      isFetching: false,
      isError: false,
    };

    const renderer = renderCalendar();
    const text = flattenText(renderer!.toJSON());
    const dateRow = renderer.root.findByProps({
      testID: `calendar-date-row-${todayStr}`,
    });
    const carousel = renderer.root.findByProps({
      testID: `calendar-deals-carousel-${todayStr}`,
    });

    expect(dateRow).toBeDefined();
    expect(carousel.props.horizontal).toBe(true);
    expect(carousel.props.style).toMatchObject({
      height: CALENDAR_CARD_HEIGHT,
    });
    expect(text).toContain("오늘의 딜");
    expect(text).toContain("뷰티");
    expect(text).toContain("@ daily_deal");
    expect(text).toContain("30% 할인");

    const dealButton = renderer.root.find(
      (node) => node.props.accessibilityLabel === "오늘의 딜 상세 보기",
    );
    act(() => dealButton.props.onPress());

    expect(navigationMock.navigate).toHaveBeenCalledWith("Detail", {
      groupBuy: buysForToday[0],
    });

    // Reset
    mockQueryResult = {
      data: null,
      isFetching: false,
      isError: false,
    };
  });

  it("opens on the exact initialDate passed from the home weekly strip", () => {
    mockQueryResult = {
      data: [
        {
          id: "gb-media-test",
          productName: "미디어테스트 20260702T163723Z",
          brandName: null,
          category: "electronics",
          startDate: "2026-07-02T00:00:00",
          endDate: "2026-07-04T00:00:00",
          purchaseUrl: "https://example.com/media",
          discountInfo: null,
          summary: null,
          confidence: 0.95,
          thumbnailUrl: null,
          videoUrl: null,
          mediaUrls: [],
          mediaType: null,
          rawPost: {
            postUrl: "https://instagram.com/p/media",
            influencer: { instagramUsername: "media_test" },
          },
        },
      ],
      isFetching: false,
      isError: false,
    };

    const renderer = renderCalendar({ initialDate: "2026-07-02" });
    const text = flattenText(renderer!.toJSON());

    expect(
      renderer.root.findByProps({ testID: "calendar-date-row-2026-07-02" }),
    ).toBeDefined();
    expect(text).toContain("미디어테스트 20260702T163723Z");

    mockQueryResult = {
      data: null,
      isFetching: false,
      isError: false,
    };
  });
});
