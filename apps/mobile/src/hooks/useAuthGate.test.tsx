import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  user: null as { id: string } | null,
}));
const audienceMock = vi.hoisted(() => ({
  canAuthenticate: true,
}));
const navigationMock = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock("@react-navigation/native", () => ({
  useNavigation: () => navigationMock,
}));
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: authMock.user }),
}));
vi.mock("../audience/AudienceContext", () => ({
  useAudience: () => ({
    policy: { canAuthenticate: audienceMock.canAuthenticate },
  }),
}));

import { useAuthGate } from "./useAuthGate";

describe("useAuthGate", () => {
  beforeEach(() => {
    authMock.user = null;
    audienceMock.canAuthenticate = true;
    navigationMock.navigate.mockReset();
  });

  it("redirects guests to the login and signup screen", () => {
    const gate = renderHook(() => useAuthGate());
    let allowed = true;

    act(() => {
      allowed = gate.result.current.requireAuth();
    });

    expect(allowed).toBe(false);
    expect(gate.result.current.isAuthenticated).toBe(false);
    expect(navigationMock.navigate).toHaveBeenCalledWith("Login");
  });

  it("allows authenticated users without navigating away", () => {
    authMock.user = { id: "user-1" };
    const gate = renderHook(() => useAuthGate());

    expect(gate.result.current.requireAuth()).toBe(true);
    expect(gate.result.current.isAuthenticated).toBe(true);
    expect(navigationMock.navigate).not.toHaveBeenCalled();
  });

  it("blocks direct login navigation for age-13 browse mode", () => {
    audienceMock.canAuthenticate = false;
    const gate = renderHook(() => useAuthGate());

    expect(gate.result.current.requireAuth()).toBe(false);
    expect(gate.result.current.canAuthenticate).toBe(false);
    expect(navigationMock.navigate).not.toHaveBeenCalled();
  });
});
