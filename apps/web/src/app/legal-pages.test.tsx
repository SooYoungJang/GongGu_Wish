import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AccountDeletionPage from "./(public)/account-deletion/page";
import PrivacyPage from "./(public)/privacy/page";
import TermsPage from "./(public)/terms/page";

describe("public policy pages", () => {
  it("publishes the actual mobile data and Google advertising disclosures", () => {
    const html = renderToStaticMarkup(<PrivacyPage />);

    expect(html).toContain("tturrr10@gmail.com");
    expect(html).toContain("선택적 전화번호");
    expect(html).toContain("검색 및 콘텐츠 활동");
    expect(html).toContain("푸시 토큰");
    expect(html).toContain("광고 ID");
    expect(html).toContain("IP 주소");
    expect(html).toContain("Google Mobile Ads SDK");
    expect(html).toContain("만 13세");
  });

  it("states the age-based service contract in the terms", () => {
    const html = renderToStaticMarkup(<TermsPage />);

    expect(html).toContain("만 12세 이하");
    expect(html).toContain("만 13세");
    expect(html).toContain("만 14세 이상");
    expect(html).toContain("광고 없이");
  });

  it("provides both the in-app and web account-deletion paths", () => {
    const html = renderToStaticMarkup(<AccountDeletionPage />);

    expect(html).toContain("앱 내에서 삭제");
    expect(html).toContain("설정");
    expect(html).toContain("회원탈퇴");
    expect(html).toContain("tturrr10@gmail.com");
    expect(html).toContain("mailto:");
  });
});
