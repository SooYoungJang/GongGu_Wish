import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: storage,
}));

import { clearSessionId, getSessionId } from "./session";
import { resolveAudiencePolicy } from "../audience/audiencePolicy";
import { setAudiencePolicySnapshot } from "../audience/behaviorSignalsPolicy";

describe("installation session id", () => {
  beforeEach(async () => {
    storage.getItem.mockReset().mockResolvedValue(null);
    storage.setItem.mockReset().mockResolvedValue(undefined);
    storage.removeItem.mockReset().mockResolvedValue(undefined);
    setAudiencePolicySnapshot(resolveAudiencePolicy("age14Plus"));
    await clearSessionId();
    storage.removeItem.mockClear();
  });

  it("removes the stable id and clears the in-memory cache", async () => {
    const first = await getSessionId();
    await clearSessionId();
    const second = await getSessionId();

    expect(storage.removeItem).toHaveBeenCalledWith("@gonggu/session-id/v1");
    expect(second).not.toBe(first);
  });

  it("does not read or create a stable id when behavior signals are blocked", async () => {
    setAudiencePolicySnapshot(resolveAudiencePolicy("age13"));

    await expect(getSessionId()).resolves.toBeNull();

    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
