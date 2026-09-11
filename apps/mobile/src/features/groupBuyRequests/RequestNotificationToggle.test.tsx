import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RequestNotificationToggle } from "./RequestNotificationToggle";
const state = vi.hoisted(() => ({ userId: "owner", pushEnabled: true, register: vi.fn(), save: vi.fn(), alert: vi.fn() }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { id: state.userId }, session: { access_token: "test-token" } }) }));
vi.mock("../../context/NotificationPreferencesContext", () => ({ useNotificationPreferences: () => ({ ready: true, preferences: { pushEnabled: state.pushEnabled } }) }));
vi.mock("../../hooks/useAuthGate", () => ({ useAuthGate: () => ({ canAuthenticate: true }) }));
vi.mock("../../design/useCommerceTheme", () => ({ useCommerceTheme: () => ({ colors: {} }) }));
vi.mock("../../services/notifications", () => ({ registerForPushNotifications: state.register }));
vi.mock("./myRequestsApi", () => ({ setMyRequestNotification: state.save }));
vi.mock("../../components/ui/SText", () => ({ SText: ({ children }: any) => <span>{children}</span> }));
vi.mock("react-native", () => {
  const React = require("react");
  const component = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
  return { View: component("View"), Pressable: component("Pressable"), Alert: { alert: state.alert } };
});
let renderer: TestRenderer.ReactTestRenderer;
const changed = vi.fn();
const element = (enabled = false) => <RequestNotificationToggle userId="owner" requestId="request" enabled={enabled} closed={false} onSettings={vi.fn()} onChanged={changed} />;
const mount = (enabled = false) => act(() => { renderer = TestRenderer.create(element(enabled)); });
const press = async () => { await act(async () => { renderer.root.findByType("Pressable" as any).props.onPress(); }); };
beforeEach(() => { vi.clearAllMocks(); state.userId = "owner"; state.pushEnabled = true; state.register.mockResolvedValue({ status: "registered" }); state.save.mockResolvedValue(true); });
afterEach(() => { if (renderer) act(() => renderer.unmount()); });
describe("request notification consent", () => {
  it("does not enable global push implicitly", async () => {
    state.pushEnabled = false;
    mount(); await press();
    expect(state.alert).toHaveBeenCalledOnce();
    expect(state.register).not.toHaveBeenCalled();
    expect(state.save).not.toHaveBeenCalled();
  });
  it("requires successful device registration before saving opt-in", async () => {
    state.register.mockResolvedValue({ status: "unavailable", reason: "permission-denied" });
    mount(); await press();
    expect(state.save).not.toHaveBeenCalled();
    expect(JSON.stringify(renderer.toJSON())).toContain("저장하지 못했어요");
    state.register.mockResolvedValue({ status: "registered" });
    await press();
    expect(state.save).toHaveBeenCalledWith("owner", "request", true);
  });
  it("disables without requesting device permission", async () => {
    mount(true); await press();
    expect(state.register).not.toHaveBeenCalled();
    expect(state.save).toHaveBeenCalledWith("owner", "request", false);
  });
  it("ignores registration completion after switching accounts and blocks duplicate taps", async () => {
    let complete!: (value: unknown) => void;
    state.register.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    mount(); await press(); await press();
    expect(state.register).toHaveBeenCalledOnce();
    state.userId = "other";
    act(() => renderer.update(element()));
    await act(async () => complete({ status: "registered" }));
    expect(state.save).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
  });
});
