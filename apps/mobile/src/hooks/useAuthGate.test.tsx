import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  user: null as { id: string } | null,
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

import { useAuthGate } from "./useAuthGate";

describe("useAuthGate", () => {
  beforeEach(() => {
    authMock.user = null;
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
});
