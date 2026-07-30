import type { Metadata } from "next";

import { LegalPage, LegalSection } from "../../../components/LegalPage";

export const metadata: Metadata = {
  title: "서비스 이용약관 | 공구위시",
  description: "공구위시 앱과 웹 서비스의 이용 조건입니다.",
};

const listClass = "list-disc space-y-2 pl-5";
const linkClass = "font-semibold text-primary-700 underline underline-offset-4";

export default function TermsPage() {
  return (
    <LegalPage
      effectiveDate="2026년 7월 30일"
      summary="이 약관은 공구위시가 제공하는 공동구매 탐색·캘린더·제보·계정 기능의 이용 조건을 정합니다."
      title="서비스 이용약관"
    >
      <LegalSection title="1. 서비스의 목적">
        <p>
          공구위시는 여러 공개 출처의 공동구매 정보를 탐색하고 일정으로 확인할
          수 있도록 돕는 정보 서비스입니다. 공구위시는 상품의 판매자, 결제
          당사자 또는 배송 당사자가 아닙니다.
        </p>
      </LegalSection>

      <LegalSection title="2. 공개 이용과 계정 연령">
        <ul className={listClass}>
          <li>
            공개 콘텐츠는 연령 구간을 선택하지 않아도 로그인 없이 바로 탐색할 수
            있습니다.
          </li>
          <li>
            로그인과 회원가입은 만 14세 이상만 이용할 수 있습니다. 인증 전에는
            기존 세션을 복원하거나 광고를 요청하고 검색·조회 같은 행동 신호를
            기록하지 않습니다.
          </li>
        </ul>
        <p>
          카카오·네이버·Apple 또는 이메일 인증 버튼을 계속하면 만 14세 이상임을
          확인하고, 서비스 이용약관에 동의하며 개인정보처리방침을 확인한 것으로
          봅니다. 이 확인값은 인증 기능을 제공하기 위해 기기에 저장됩니다.
        </p>
      </LegalSection>

      <LegalSection title="3. 계정과 보안">
        <ul className={listClass}>
          <li>
            계정 정보는 정확하게 입력하고 인증 수단을 안전하게 관리해야 합니다.
          </li>
          <li>타인의 계정이나 연락처를 허가 없이 사용해서는 안 됩니다.</li>
          <li>계정의 무단 사용이 의심되면 즉시 지원 이메일로 알려 주세요.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. 이용자의 의무">
        <ul className={listClass}>
          <li>법령, 이 약관과 서비스 안내를 준수해야 합니다.</li>
          <li>
            허위·기만적 제보, 권리 침해 콘텐츠, 악성 코드, 자동화된 과도한 요청
            등 서비스나 다른 이용자를 해치는 행위를 해서는 안 됩니다.
          </li>
          <li>
            공동구매 참여 전 가격, 기간, 판매자, 환불·배송 조건을 실제 판매
            페이지에서 직접 확인해야 합니다.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. 정보의 정확성과 외부 링크">
        <p>
          공동구매 정보는 공개 게시물, 제보 또는 외부 서비스에서 수집될 수 있어
          변경·지연·오류가 발생할 수 있습니다. 공구위시는 중요한 정보를 가능한
          범위에서 갱신하지만 특정 상품의 재고, 가격, 품질, 배송 또는 거래
          성립을 보증하지 않습니다.
        </p>
        <p>
          외부 링크에서 이루어지는 구매와 개인정보 처리는 해당 판매자 또는 외부
          서비스의 약관과 정책을 따릅니다.
        </p>
      </LegalSection>

      <LegalSection title="6. 콘텐츠와 권리">
        <p>
          서비스의 소프트웨어, 디자인과 자체 제작 콘텐츠에 관한 권리는 공구위시
          또는 정당한 권리자에게 있습니다. 외부 게시물, 상표와 상품 이미지는 각
          권리자에게 귀속됩니다. 이용자는 자신이 제출할 권한이 있는 정보만
          제보해야 합니다.
        </p>
      </LegalSection>

      <LegalSection title="7. 서비스 변경·제한">
        <p>
          안정성, 보안, 법령 또는 운영상 필요에 따라 기능을 변경하거나 일시
          중단할 수 있습니다. 약관 위반, 부정 이용 또는 보안 위험이 확인되면
          필요한 범위에서 계정이나 기능 이용을 제한할 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection title="8. 계정 해지">
        <p>
          만 14세 이상 계정 이용자는 앱 설정의 회원탈퇴 또는 웹의 계정 삭제
          안내를 통해 계정과 관련 데이터 삭제를 요청할 수 있습니다. 삭제된
          계정과 데이터는 법령상 보존 대상이 아닌 한 복구되지 않을 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection title="9. 약관 변경과 문의">
        <p>
          약관을 변경할 때에는 시행일과 주요 내용을 서비스 또는 공식 웹사이트에
          알립니다. 문의는{" "}
          <a className={linkClass} href="mailto:tturrr10@gmail.com">
            tturrr10@gmail.com
          </a>
          으로 보내 주세요.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
