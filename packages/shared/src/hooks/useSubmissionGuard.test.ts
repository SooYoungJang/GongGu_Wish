// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSubmissionGuard } from "./useSubmissionGuard";

describe("useSubmissionGuard", () => {
  describe("basic export", () => {
    it("exports useSubmissionGuard as a function", async () => {
      const mod = await import("./useSubmissionGuard");
      expect(typeof mod.useSubmissionGuard).toBe("function");
    });

    it("accepts 0 or 1 optional argument", async () => {
      const mod = await import("./useSubmissionGuard");
      expect(mod.useSubmissionGuard.length).toBeLessThanOrEqual(1);
    });
  });

  describe("guard() behavior", () => {
    it("returns true on first call", () => {
      const { result } = renderHook(() => useSubmissionGuard());
      let returnValue: boolean | undefined;
      act(() => {
        returnValue = result.current.guard();
      });
      expect(returnValue).toBe(true);
    });

    it("returns false when already dispatched (in-flight)", () => {
      const { result } = renderHook(() => useSubmissionGuard());
      let first: boolean | undefined;
      let second: boolean | undefined;
      act(() => {
        first = result.current.guard();
        second = result.current.guard();
      });
      expect(first).toBe(true);
      expect(second).toBe(false);
    });

    it("returns true again after reset()", () => {
      const { result } = renderHook(() => useSubmissionGuard());
      let first: boolean | undefined;
      let afterReset: boolean | undefined;

      act(() => {
        first = result.current.guard();
      });
      expect(first).toBe(true);

      act(() => {
        result.current.reset();
      });

      act(() => {
        afterReset = result.current.guard();
      });
      expect(afterReset).toBe(true);
    });
  });

  describe("isDispatched state", () => {
    it("starts as false", () => {
      const { result } = renderHook(() => useSubmissionGuard());
      expect(result.current.isDispatched).toBe(false);
    });

    it("becomes true after guard() returns true", () => {
      const { result } = renderHook(() => useSubmissionGuard());
      act(() => {
        result.current.guard();
      });
      expect(result.current.isDispatched).toBe(true);
    });

    it("becomes false after reset()", () => {
      const { result } = renderHook(() => useSubmissionGuard());
      act(() => {
        result.current.guard();
      });
      expect(result.current.isDispatched).toBe(true);

      act(() => {
        result.current.reset();
      });
      expect(result.current.isDispatched).toBe(false);
    });

    it("remains true when guard() is called again while dispatched", () => {
      const { result } = renderHook(() => useSubmissionGuard());
      act(() => {
        result.current.guard();
        result.current.guard(); // second call should be blocked
      });
      expect(result.current.isDispatched).toBe(true);
    });
  });

  describe("timeoutMs auto-release", () => {
    it("auto-releases guard after timeoutMs", async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() =>
        useSubmissionGuard({ timeoutMs: 1000 }),
      );

      act(() => {
        result.current.guard();
      });
      expect(result.current.isDispatched).toBe(true);

      // Advance time past timeout
      act(() => {
        vi.advanceTimersByTime(1100);
      });
      expect(result.current.isDispatched).toBe(false);

      // Should be able to guard again after auto-release
      let reGuard: boolean | undefined;
      act(() => {
        reGuard = result.current.guard();
      });
      expect(reGuard).toBe(true);

      vi.useRealTimers();
    });

    it("does not auto-release before timeoutMs", async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() =>
        useSubmissionGuard({ timeoutMs: 2000 }),
      );

      act(() => {
        result.current.guard();
      });

      // Advance time but not past timeout
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(result.current.isDispatched).toBe(true);

      // Should still be blocked
      let blocked: boolean | undefined;
      act(() => {
        blocked = result.current.guard();
      });
      expect(blocked).toBe(false);

      vi.useRealTimers();
    });

    it("resets timer on each guard() call", async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() =>
        useSubmissionGuard({ timeoutMs: 1000 }),
      );

      act(() => {
        result.current.guard();
      });

      // Advance 800ms (still within window)
      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(result.current.isDispatched).toBe(true);

      // After auto-release + re-guard, the timer should reset
      act(() => {
        vi.advanceTimersByTime(300); // now at 1100ms total, auto-release
      });
      expect(result.current.isDispatched).toBe(false);

      // Re-guard and verify fresh timer
      act(() => {
        result.current.guard();
      });
      expect(result.current.isDispatched).toBe(true);

      // At 1100ms past re-guard, still dispatched
      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(result.current.isDispatched).toBe(true);

      vi.useRealTimers();
    });
  });

  describe("reset() clears pending timer", () => {
    it("cancel auto-release timer on reset()", async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() =>
        useSubmissionGuard({ timeoutMs: 1000 }),
      );

      act(() => {
        result.current.guard();
      });

      act(() => {
        result.current.reset();
      });
      expect(result.current.isDispatched).toBe(false);

      // Advance past original timeout - should stay released
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(result.current.isDispatched).toBe(false);

      vi.useRealTimers();
    });
  });
});
