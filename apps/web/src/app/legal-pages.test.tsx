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
    expect(html).toContain("인증을 시작하기 전에는");
    expect(html).toContain("생년월일을 수집하지 않습니다");
    expect(html).not.toContain("사용자가 고른 연령 구간");
  });

  it("states the inline 14+ authentication contract in the terms", () => {
    const html = renderToStaticMarkup(<TermsPage />);

    expect(html).toContain("공개 콘텐츠는 연령 구간을 선택하지 않아도");
    expect(html).toContain("만 14세 이상");
    expect(html).toContain("계속하면 만 14세 이상임을 확인하고");
    expect(html).toContain(
      "서비스 이용약관에 동의하며 개인정보처리방침을 확인",
    );
    expect(html).not.toContain("만 12세 이하");
    expect(html).not.toContain("만 13세는");
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
