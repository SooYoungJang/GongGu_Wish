import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GroupBuy } from "../types";
import { GroupBuyReminderButton } from "./GroupBuyReminderButton";

const pickerMocks = vi.hoisted(() => ({
  enabled: false,
  openReminderPicker: vi.fn(),
  state: { status: "idle" } as { status: string },
}));

vi.mock("../context/GroupBuyReminderPickerContext", () => ({
  useGroupBuyReminderPicker: () => ({
    getReminderState: () => pickerMocks.state,
    isReminderEnabled: () => pickerMocks.enabled,
    openReminderPicker: pickerMocks.openReminderPicker,
  }),
}));

vi.mock("../design/useCommerceTheme", () => ({
  useCommerceTheme: () => ({
    colors: {
      accent: "#F0445E",
      accentSoft: "#FFF1F4",
      borderLight: "#EEF0F3",
      surface: "#FFFFFF",
      text: "#111827",
    },
  }),
}));

const item: GroupBuy = {
  id: "group-buy-1",
  productName: "테스트 공구",
  brandName: null,
  category: null,
  startDate: null,
  endDate: "2099-12-31",
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

describe("GroupBuyReminderButton", () => {
  beforeEach(() => {
    pickerMocks.enabled = false;
    pickerMocks.state = { status: "idle" };
    pickerMocks.openReminderPicker.mockClear();
  });

  it("opens the shared picker without opening the parent deal card", () => {
    const stopPropagation = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<GroupBuyReminderButton item={item} />);
    });
    const button = renderer!.root.findByProps({
      accessibilityLabel: "테스트 공구 마감 알림 설정",
    });

    act(() => button.props.onPress({ stopPropagation }));

    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(pickerMocks.openReminderPicker).toHaveBeenCalledWith(item);
  });

  it("announces an existing reminder as a date change action", () => {
    pickerMocks.enabled = true;
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<GroupBuyReminderButton item={item} />);
    });

    expect(
      renderer!.root.findByProps({
        accessibilityLabel: "테스트 공구 마감 알림 날짜 변경",
      }).props.accessibilityState,
    ).toMatchObject({ selected: true });
  });
});
