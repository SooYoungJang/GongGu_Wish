import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PushNotificationPanel } from "./PushNotificationPanel";

describe("PushNotificationPanel", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("sends trimmed text and parsed JSON after confirmation", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    const onSend = vi.fn().mockResolvedValue({
      provider: "expo",
      targeted: 2,
      sent: 2,
      failed: 0,
      invalidTokensRemoved: 0,
    });

    render(<PushNotificationPanel onSend={onSend} />);
    await user.type(screen.getByLabelText("제목"), "  새 공구  ");
    await user.type(screen.getByLabelText("본문"), "  확인해주세요  ");
    fireEvent.change(screen.getByLabelText(/추가 데이터/), {
      target: { value: '{"screen":"Home"}' },
    });
    await user.click(
      screen.getByRole("button", { name: "전체 사용자에게 발송" }),
    );

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
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    const onSend = vi.fn();

    render(<PushNotificationPanel onSend={onSend} />);
    await user.type(screen.getByLabelText("제목"), "제목");
    await user.type(screen.getByLabelText("본문"), "본문");
    await user.type(screen.getByLabelText(/추가 데이터/), "not-json");
    await user.click(
      screen.getByRole("button", { name: "전체 사용자에게 발송" }),
    );

    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("JSON 객체");
  });
});
