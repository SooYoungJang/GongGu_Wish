import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { UserAccessTime } from "./UserAccessTime";

describe("UserAccessTime", () => {
  afterEach(cleanup);

  it("shows the full date and time in Korea when UTC is still the previous day", () => {
    render(<UserAccessTime value="2026-10-24T15:04:09.000Z" />);

    const time = screen.getByText(/2026.*10.*25.*00:04:09/);
    expect(time.tagName).toBe("TIME");
    expect(time.getAttribute("datetime")).toBe("2026-10-24T15:04:09.000Z");
    expect(time.getAttribute("title")).toBe("한국시간 (UTC+9)");
  });

  it("converts an explicit foreign timezone rather than using the browser timezone", () => {
    render(<UserAccessTime value="2026-10-25T08:10:09-07:00" />);
    expect(screen.getByText(/2026.*10.*26.*00:10:09/).textContent).toMatch(/2026.*10.*26.*00:10:09/);
  });

  it.each([undefined, null, "", "not-a-date"])("distinguishes an unavailable timestamp: %s", (value) => {
    render(<UserAccessTime value={value} />);
    expect(screen.getByText("기록 없음").textContent).toBe("기록 없음");
    expect(document.querySelector("time")).toBeNull();
  });
});
