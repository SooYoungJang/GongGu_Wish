import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PushNotificationPanel } from "./PushNotificationPanel";

const users = [
  {
    id: "user-1",
    email: "ready@example.com",
    nickname: "푸시 가능 사용자",
    fcmToken: null,
    hasPushToken: true,
    createdAt: "2026-07-15T00:00:00.000Z",
    updatedAt: "2026-07-15T00:00:00.000Z",
    status: "ACTIVE",
  },
  {
    id: "user-2",
    email: "offline@example.com",
    nickname: "토큰 없음 사용자",
    fcmToken: null,
    hasPushToken: false,
    createdAt: "2026-07-15T00:00:00.000Z",
    updatedAt: "2026-07-15T00:00:00.000Z",
    status: "ACTIVE",
  },
  {
    id: "user-3",
    email: "ready-two@example.com",
    nickname: "두 번째 푸시 사용자",
    fcmToken: null,
    hasPushToken: true,
    createdAt: "2026-07-15T00:00:00.000Z",
    updatedAt: "2026-07-15T00:00:00.000Z",
    status: "ACTIVE",
  },
];

describe("PushNotificationPanel", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("sends trimmed text and parsed JSON after confirmation", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue({
      provider: "expo",
      targeted: 2,
      sent: 2,
      failed: 0,
      invalidTokensRemoved: 0,
    });
    const onSearchUsers = vi
      .fn()
      .mockResolvedValue({ items: users, total: users.length });

    render(
      <PushNotificationPanel onSearchUsers={onSearchUsers} onSend={onSend} />,
    );
    await user.type(
      screen.getByRole("textbox", { name: /^제목/ }),
      "  새 공구  ",
    );
    await user.type(
      screen.getByRole("textbox", { name: /^본문/ }),
      "  확인해주세요  ",
    );
    fireEvent.change(screen.getByLabelText(/추가 데이터/), {
      target: { value: '{"screen":"Home"}' },
    });
    await user.click(
      screen.getByRole("button", { name: "전체 사용자에게 발송" }),
    );
    await user.click(screen.getByRole("button", { name: "확인하고 발송" }));

    expect(onSend).toHaveBeenCalledWith({
      title: "새 공구",
      body: "확인해주세요",
      data: { screen: "Home" },
    });
    expect((await screen.findByRole("status")).textContent).toContain(
      "대상 2명",
    );
  });

  it("blocks invalid JSON before sending", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const onSearchUsers = vi
      .fn()
      .mockResolvedValue({ items: users, total: users.length });

    render(
      <PushNotificationPanel onSearchUsers={onSearchUsers} onSend={onSend} />,
    );
    await user.type(screen.getByRole("textbox", { name: /^제목/ }), "제목");
    await user.type(screen.getByRole("textbox", { name: /^본문/ }), "본문");
    await user.type(screen.getByLabelText(/추가 데이터/), "not-json");
    await user.click(
      screen.getByRole("button", { name: "전체 사용자에게 발송" }),
    );

    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("JSON 객체");
  });

  it("sends only selected users after the audience is confirmed", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue({
      provider: "expo",
      targeted: 1,
      sent: 1,
      failed: 0,
      invalidTokensRemoved: 0,
    });
    const onSearchUsers = vi
      .fn()
      .mockResolvedValue({ items: users, total: users.length });

    render(
      <PushNotificationPanel onSearchUsers={onSearchUsers} onSend={onSend} />,
    );
    await user.click(screen.getByRole("radio", { name: /^선택 사용자/ }));
    expect(await screen.findByText("푸시 가능 사용자")).toBeTruthy();
    expect(
      screen.getByRole("checkbox", { name: "토큰 없음 사용자 선택" }),
    ).toHaveProperty("disabled", true);
    await user.click(
      screen.getByRole("checkbox", { name: "푸시 가능 사용자 선택" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: /^제목/ }),
      "개별 안내",
    );
    await user.type(
      screen.getByRole("textbox", { name: /^본문/ }),
      "선택 사용자 본문",
    );
    await user.click(
      screen.getByRole("button", { name: "선택 사용자에게 발송" }),
    );
    await user.click(screen.getByRole("button", { name: "확인하고 발송" }));

    expect(onSend).toHaveBeenCalledWith({
      title: "개별 안내",
      body: "선택 사용자 본문",
      userIds: ["user-1"],
    });
  });

  it("selects every push-ready user in the visible result", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue({
      provider: "expo",
      targeted: 2,
      sent: 2,
      failed: 0,
      invalidTokensRemoved: 0,
    });
    const onSearchUsers = vi
      .fn()
      .mockResolvedValue({ items: users, total: users.length });

    render(
      <PushNotificationPanel onSearchUsers={onSearchUsers} onSend={onSend} />,
    );
    await user.click(screen.getByRole("radio", { name: /^선택 사용자/ }));
    await screen.findByText("두 번째 푸시 사용자");
    await user.click(
      screen.getByRole("button", { name: "현재 결과 전체 선택" }),
    );
    expect(
      screen.getByRole("checkbox", { name: "푸시 가능 사용자 선택" }),
    ).toHaveProperty("checked", true);
    expect(
      screen.getByRole("checkbox", { name: "두 번째 푸시 사용자 선택" }),
    ).toHaveProperty("checked", true);
    await user.type(
      screen.getByRole("textbox", { name: /^제목/ }),
      "전체 선택",
    );
    await user.type(
      screen.getByRole("textbox", { name: /^본문/ }),
      "두 명에게 발송",
    );
    await user.click(
      screen.getByRole("button", { name: "선택 사용자에게 발송" }),
    );
    await user.click(screen.getByRole("button", { name: "확인하고 발송" }));

    expect(onSend).toHaveBeenCalledWith({
      title: "전체 선택",
      body: "두 명에게 발송",
      userIds: ["user-1", "user-3"],
    });
  });
});
