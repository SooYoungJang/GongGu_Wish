import { describe, expect, it } from "vitest";
import { validateHomeBannerForm } from "./homeBannerForm";

describe("validateHomeBannerForm", () => {
  it("allows a disabled banner without dates", () => {
    expect(validateHomeBannerForm({
      isHomeBanner: false,
      homeBannerStartDate: "",
      homeBannerEndDate: "",
    })).toBeNull();
  });

  it("requires both dates when the banner is enabled", () => {
    expect(validateHomeBannerForm({
      isHomeBanner: true,
      homeBannerStartDate: "2026-07-12",
      homeBannerEndDate: "",
    })).toBe("홈 배너 노출 시작일과 종료일을 모두 선택해주세요.");
  });

  it("rejects a range whose end precedes its start", () => {
    expect(validateHomeBannerForm({
      isHomeBanner: true,
      homeBannerStartDate: "2026-07-13",
      homeBannerEndDate: "2026-07-12",
    })).toBe("홈 배너 노출 종료일은 시작일과 같거나 이후여야 합니다.");
  });

  it("accepts an inclusive valid range", () => {
    expect(validateHomeBannerForm({
      isHomeBanner: true,
      homeBannerStartDate: "2026-07-12",
      homeBannerEndDate: "2026-07-12",
    })).toBeNull();
  });
});
