import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { Pressable, Text } from "react-native";
import { AppErrorBoundary } from "./AppErrorBoundary";
const report = vi.hoisted(() => vi.fn());
vi.mock("./telemetry", () => ({ telemetry: { record: report, flush: vi.fn().mockResolvedValue(undefined) } }));
afterEach(() => vi.restoreAllMocks());
it("shows a provider-independent fallback and remounts the child on retry", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  let fail = true;
  function Child() { if (fail) throw new TypeError("private message"); return <Text>복구됨</Text>; }
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<AppErrorBoundary><Child /></AppErrorBoundary>); });
  expect(JSON.stringify(tree.toJSON())).toContain("화면을 불러오지 못했어요");
  expect(JSON.stringify(tree.toJSON())).not.toContain("private message");
  expect(report).toHaveBeenCalledWith("js_error", null, expect.any(TypeError));
  fail = false;
  await act(async () => { tree.root.findByType(Pressable).props.onPress(); });
  expect(JSON.stringify(tree.toJSON())).toContain("복구됨");
  await act(async () => tree.unmount());
});
