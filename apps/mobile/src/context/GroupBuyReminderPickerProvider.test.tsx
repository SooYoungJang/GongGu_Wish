import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { withTiming } from "react-native-reanimated";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GroupBuy } from "../types";
import type { GroupBuyReminderUpdate } from "../api";
import {
  GroupBuyReminderPickerProvider,
  useGroupBuyReminderPicker,
} from "./GroupBuyReminderPickerContext";

const notificationMocks = vi.hoisted(() => ({
  enabled: false,
  reminderDays: [] as number[],
  reminderPreference: null as GroupBuyReminderUpdate | null,
  setNotificationReminders: vi.fn(async () => ({ status: "enabled" })),
}));
const preferenceMocks = vi.hoisted(() => ({
  preferences: {
    pushEnabled: true,
    deadlineRemindersEnabled: true,
  },
}));

vi.mock("../hooks/useLocalDeals", () => ({
  useNotifications: () => ({
    getNotificationReminderDays: () => notificationMocks.reminderDays,
    getNotificationReminderPreference: () =>
      notificationMocks.reminderPreference,
    getNotificationState: () => ({ status: "idle" }),
    isNotifying: () => notificationMocks.enabled,
    setNotificationReminders: notificationMocks.setNotificationReminders,
  }),
}));

vi.mock("@expo/ui/datetimepicker", () => ({
  default: (props: object) => <Text {...props}>time picker</Text>,
}));

vi.mock("./AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("./NotificationPreferencesContext", () => ({
  useNotificationPreferences: () => preferenceMocks,
}));

vi.mock("../components/ui/SText", () => ({
  SText: ({ children, ...props }: React.PropsWithChildren<object>) => (
    <Text {...props}>{children}</Text>
  ),
}));

vi.mock("../design/useCommerceTheme", () => ({
  useCommerceTheme: () => ({
    colors: {
      accent: "#F0445E",
      accentSoft: "#FFF1F4",
      border: "#E5E7EB",
      disabled: "#D1D5DB",
      inverse: "#FFFFFF",
      muted: "#6B7280",
      overlay: "rgba(0,0,0,0.45)",
      softBg: "#F8FAFC",
      surface: "#FFFFFF",
      text: "#111827",
      warning: "#B45309",
      warningSoft: "#FFF7ED",
      weak: "#9CA3AF",
    },
  }),
}));

const item: GroupBuy = {
  id: "group-buy-1",
  productName: "테스트 공구",
  brandName: null,
  category: null,
  startDate: null,
  endDate: "2099-12-31T00:00:00.000Z",
  purchaseUrl: null,
  discountInfo: null,
  priceKrw: null,
  summary: null,
  confidence: 1,
  thumbnailUrl: null,
  videoUrl: null,
  mediaUrls: [],
  mediaType: null,
  rawPost: { postUrl: "", influencer: { instagramUsername: "" } },
};

function PickerHarness({ item: target = item }: { item?: GroupBuy }) {
  const { openReminderPicker } = useGroupBuyReminderPicker();
  return (
    <Text
      testID="open-reminder-picker"
      onPress={() => openReminderPicker(target)}
    >
      open
    </Text>
  );
}

describe("GroupBuyReminderPickerProvider", () => {
  beforeEach(() => {
    notificationMocks.enabled = false;
    notificationMocks.reminderDays = [];
    notificationMocks.reminderPreference = null;
    notificationMocks.setNotificationReminders.mockClear();
    preferenceMocks.preferences.pushEnabled = true;
    preferenceMocks.preferences.deadlineRemindersEnabled = true;
  });

  it("opens immediately with seven unselected reminder dates", () => {
    vi.mocked(withTiming).mockClear();
    notificationMocks.setNotificationReminders.mockClear();
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <GroupBuyReminderPickerProvider>
          <PickerHarness />
        </GroupBuyReminderPickerProvider>,
      );
    });

    act(() =>
      renderer!.root
        .findByProps({ testID: "open-reminder-picker" })
        .props.onPress(),
    );

    expect(renderer!.root.findByProps({ animationType: "none" })).toBeTruthy();
    expect(withTiming).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ duration: 100 }),
    );
    expect(withTiming).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ duration: 160 }),
    );
    const animatedViews = renderer!.root.findAllByType(
      "Reanimated.View" as unknown as React.ElementType,
    );
    expect(animatedViews[0]?.props.style[1]).toEqual({ opacity: 0 });
    expect(
      renderer!.root.findByProps({ accessibilityRole: "none" }).props.style[2],
    ).toEqual({
      transform: [{ translateY: 24 }],
    });
    for (let day = 1; day <= 7; day += 1) {
      expect(
        renderer!.root.findByProps({ testID: `group-buy-reminder-day-${day}` }),
      ).toBeTruthy();
    }
    expect(
      renderer!.root.findByProps({ testID: "group-buy-reminder-save" }).props
        .disabled,
    ).toBe(true);
    expect(
      renderer!.root.findByProps({ testID: "group-buy-reminder-day-2" }).props
        .accessibilityLabel,
    ).toMatch(/^D-2, \d+\/\d+ .+ 마감 알림$/);

    act(() =>
      renderer!.root
        .findByProps({ testID: "group-buy-reminder-day-2" })
        .props.onPress(),
    );
    act(() =>
      renderer!.root
        .findByProps({ testID: "group-buy-reminder-day-4" })
        .props.onPress(),
    );

    expect(
      renderer!.root.findByProps({ testID: "group-buy-reminder-save" }).props
        .disabled,
    ).toBe(false);
    expect(
      renderer!.root.findByProps({ testID: "group-buy-reminder-day-2" }).props
        .accessibilityState.checked,
    ).toBe(true);
    expect(
      renderer!.root.findByProps({ testID: "group-buy-reminder-day-4" }).props
        .accessibilityState.checked,
    ).toBe(true);

    act(() => {
      renderer!.root
        .findByProps({ testID: "group-buy-reminder-save" })
        .props.onPress();
    });

    expect(notificationMocks.setNotificationReminders).toHaveBeenCalledWith(
      item,
      {
        type: "deadline",
        reminderDays: [2, 4],
        reminderTimeMinutes: null,
      },
    );
  });

  it("ignores the legacy deadline preference when global push is enabled", () => {
    preferenceMocks.preferences.deadlineRemindersEnabled = false;
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <GroupBuyReminderPickerProvider>
          <PickerHarness />
        </GroupBuyReminderPickerProvider>,
      );
    });

    act(() =>
      renderer!.root
        .findByProps({ testID: "open-reminder-picker" })
        .props.onPress(),
    );

    expect(JSON.stringify(renderer!.toJSON())).not.toContain("선택만 저장돼요");
  });

  it("shows paused guidance when global push is disabled", () => {
    preferenceMocks.preferences.pushEnabled = false;
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <GroupBuyReminderPickerProvider>
          <PickerHarness />
        </GroupBuyReminderPickerProvider>,
      );
    });

    act(() =>
      renderer!.root
        .findByProps({ testID: "open-reminder-picker" })
        .props.onPress(),
    );

    expect(JSON.stringify(renderer!.toJSON())).toContain(
      "푸시 알림이 꺼져 있어 선택만 저장돼요.",
    );
  });

  it("turns off an existing reminder through the shared picker", async () => {
    notificationMocks.enabled = true;
    notificationMocks.reminderDays = [3];
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <GroupBuyReminderPickerProvider>
          <PickerHarness />
        </GroupBuyReminderPickerProvider>,
      );
    });

    act(() =>
      renderer!.root
        .findByProps({ testID: "open-reminder-picker" })
        .props.onPress(),
    );

    await act(async () => {
      renderer!.root
        .findByProps({ testID: "group-buy-reminder-disable" })
        .props.onPress();
      await Promise.resolve();
    });

    expect(notificationMocks.setNotificationReminders).toHaveBeenCalledWith(
      item,
      {
        type: "deadline",
        reminderDays: [],
        reminderTimeMinutes: null,
      },
    );
  });

  it("restores opening days and the saved shared time before start", () => {
    const openingItem = {
      ...item,
      startDate: "2099-12-30T00:00:00.000Z",
    };
    notificationMocks.enabled = true;
    notificationMocks.reminderPreference = {
      type: "opening",
      reminderDays: [0, 3],
      reminderTimeMinutes: 15 * 60 + 30,
    };
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <GroupBuyReminderPickerProvider>
          <PickerHarness item={openingItem} />
        </GroupBuyReminderPickerProvider>,
      );
    });

    act(() =>
      renderer!.root
        .findByProps({ testID: "open-reminder-picker" })
        .props.onPress(),
    );

    expect(JSON.stringify(renderer!.toJSON())).toContain("공구 오픈 알림");
    expect(
      renderer!.root.findByProps({ testID: "group-buy-reminder-day-0" }).props
        .accessibilityState.checked,
    ).toBe(true);
    const timePicker = renderer!.root.findByProps({
      testID: "group-buy-opening-reminder-time",
    });
    expect(timePicker.props.value.getHours()).toBe(15);
    expect(timePicker.props.value.getMinutes()).toBe(30);

    act(() => {
      renderer!.root
        .findByProps({ testID: "group-buy-reminder-save" })
        .props.onPress();
    });

    expect(notificationMocks.setNotificationReminders).toHaveBeenCalledWith(
      openingItem,
      {
        type: "opening",
        reminderDays: [0, 3],
        reminderTimeMinutes: 15 * 60 + 30,
      },
    );
  });
});
