import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { user: { id: "user-a" } as { id: string } | null, session: { access_token: "token-a" } as { access_token: string } | null, isLoading: false },
  policy: { canAuthenticate: true, canRecordBehaviorSignals: true },
  start: vi.fn(), stop: vi.fn(),
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => mocks.auth }));
vi.mock("../audience/AudienceContext", () => ({ useAudience: () => ({ policy: mocks.policy }) }));
vi.mock("../services/userAppAccess", () => ({ startUserAppAccessTracking: mocks.start }));
import { UserActivityBridge } from "./UserActivityBridge";

describe("app access audience and session boundary", () => {
  let tree: ReactTestRenderer | undefined;
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth = { user: { id: "user-a" }, session: { access_token: "token-a" }, isLoading: false };
    mocks.policy = { canAuthenticate: true, canRecordBehaviorSignals: true };
    mocks.start.mockReturnValue(mocks.stop);
  });
  afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; });
  async function render() {
    await act(async () => {
      if (tree) tree.update(<UserActivityBridge />);
      else tree = create(<UserActivityBridge />);
    });
  }

  it("does not record guests, unresolved sessions or restricted audiences", async () => {
    mocks.auth.isLoading = true;
    await render();
    mocks.auth.isLoading = false; mocks.auth.user = null; mocks.auth.session = null;
    await render();
    mocks.auth.user = { id: "user-a" }; mocks.auth.session = { access_token: "token-a" };
    mocks.policy.canAuthenticate = false;
    await render();
    mocks.policy.canAuthenticate = true; mocks.policy.canRecordBehaviorSignals = false;
    await render();
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("disposes the previous account on account switch, logout and policy restriction", async () => {
    await render();
    expect(mocks.start).toHaveBeenLastCalledWith("user-a");
    mocks.auth.user = { id: "user-b" }; mocks.auth.session = { access_token: "token-b" };
    await render();
    expect(mocks.stop).toHaveBeenCalledTimes(1);
    expect(mocks.start).toHaveBeenLastCalledWith("user-b");
    mocks.auth.user = null; mocks.auth.session = null;
    await render();
    expect(mocks.stop).toHaveBeenCalledTimes(2);
    mocks.auth.user = { id: "user-b" }; mocks.auth.session = { access_token: "token-b" };
    await render();
    mocks.policy.canRecordBehaviorSignals = false;
    await render();
    expect(mocks.stop).toHaveBeenCalledTimes(3);
    expect(mocks.start).toHaveBeenCalledTimes(3);
  });
});
