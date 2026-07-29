import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, LegalSection } from "../../../components/LegalPage";

export const metadata: Metadata = {
  title: "계정 삭제 안내 | 공구위시",
  description: "공구위시 계정과 관련 데이터 삭제를 요청하는 방법입니다.",
};

const listClass = "list-decimal space-y-2 pl-5";
const linkClass = "font-semibold text-primary-700 underline underline-offset-4";
const deletionMailto =
  "mailto:tturrr10@gmail.com?subject=%EA%B3%B5%EA%B5%AC%EC%9C%84%EC%8B%9C%20%EA%B3%84%EC%A0%95%20%EC%82%AD%EC%A0%9C%20%EC%9A%94%EC%B2%AD";

export default function AccountDeletionPage() {
  return (
    <LegalPage
      effectiveDate="2026년 7월 29일"
      summary="공구위시 계정은 앱 안에서 직접 삭제하거나, 앱에 접근할 수 없을 때 이메일로 삭제를 요청할 수 있습니다."
      title="계정 및 데이터 삭제 안내"
    >
      <LegalSection title="앱 내에서 삭제">
        <ol className={listClass}>
          <li>만 14세 이상 계정으로 공구위시 앱에 로그인합니다.</li>
          <li>마이페이지에서 설정을 엽니다.</li>
          <li>계정 영역의 회원탈퇴를 선택하고 확인합니다.</li>
        </ol>
        <p>
          앱 내 회원탈퇴가 완료되면 계정과 연결된 활동 데이터 및 푸시 토큰을
          삭제하고 기기의 사용자 로컬 캐시를 정리합니다.
        </p>
      </LegalSection>

      <LegalSection title="웹에서 삭제 요청">
        <p>
          앱을 설치하거나 로그인할 수 없다면 계정에 사용한 이메일 주소에서 아래
          지원 이메일로 요청해 주세요.
        </p>
        <a
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary-700 px-5 py-3 font-bold text-white transition hover:bg-primary-800"
          href={deletionMailto}
        >
          mailto: tturrr10@gmail.com으로 삭제 요청
        </a>
        <p>
          요청에는 “공구위시 계정 삭제 요청”이라는 제목과 가입 이메일만 적어
          주세요. 비밀번호, 이메일 인증 코드, 전체 전화번호나 신분증 사본은
          보내지 마세요. 계정 보호를 위해 가입 이메일 회신 등 최소한의 본인
          확인을 요청할 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection title="삭제되는 정보">
        <ul className="list-disc space-y-2 pl-5">
          <li>계정과 프로필 정보</li>
          <li>계정에 연결된 북마크, 알림 설정, 위시 항목과 활동 데이터</li>
          <li>등록된 푸시 토큰과 계정 연결 정보</li>
        </ul>
        <p>
          법령상 보관 의무, 분쟁 대응 또는 서비스 보안에 필요한 기록은 해당
          목적과 기간에 한해 분리 보관한 뒤 삭제할 수 있습니다. 처리 결과는
          요청에 사용한 이메일로 안내합니다.
        </p>
      </LegalSection>

      <LegalSection title="게스트 및 기기 데이터">
        <p>
          계정을 만들지 않은 만 13세 이용자에게는 삭제할 온라인 계정이 없습니다.
          기기에 남은 연령 구간과 로컬 설정은 운영체제의 앱 데이터 삭제 또는 앱
          제거로 지울 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection title="관련 문서">
        <p>
          처리 범위와 예외는{" "}
          <Link className={linkClass} href="/privacy">
            개인정보처리방침
          </Link>
          과{" "}
          <Link className={linkClass} href="/terms">
            서비스 이용약관
          </Link>
          을 확인해 주세요.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
