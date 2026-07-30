import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, LegalSection } from "../../../components/LegalPage";

export const metadata: Metadata = {
  title: "개인정보처리방침 | 공구위시",
  description: "공구위시 앱과 웹 서비스의 개인정보 처리 기준입니다.",
};

const listClass = "list-disc space-y-2 pl-5";
const linkClass = "font-semibold text-primary-700 underline underline-offset-4";

export default function PrivacyPage() {
  return (
    <LegalPage
      effectiveDate="2026년 7월 30일"
      summary="공구위시는 서비스 제공에 필요한 정보만 처리하고, 만 14세 이상 확인 전에는 인증·광고·행동 신호 기능을 사용하지 않습니다."
      title="개인정보처리방침"
    >
      <LegalSection title="1. 적용 범위">
        <p>
          이 방침은 공구위시 모바일 앱과 gongguwish.com에서 제공하는 공동구매
          탐색, 캘린더, 제보, 계정 및 알림 기능에 적용됩니다.
        </p>
      </LegalSection>

      <LegalSection title="2. 처리하는 정보">
        <ul className={listClass}>
          <li>
            계정 정보: 이메일 주소, 암호화된 인증 정보, 닉네임, 선택적 전화번호,
            마케팅 수신 선택값
          </li>
          <li>
            검색 및 콘텐츠 활동: 검색어, 콘텐츠 조회·딥뷰, 북마크, 최근 본 항목,
            관심·알림 설정, 위시 항목과 사용자 제보
          </li>
          <li>
            알림 정보: Expo 푸시 토큰, 알림 권한 및 수신 설정, 예약 알림 정보
          </li>
          <li>
            광고 및 진단 정보: 광고 ID, IP 주소에서 추정되는 대략적 위치, 앱
            실행·탭·동영상 조회 같은 상호작용, 앱·SDK 성능과 오류 진단, 기기 및
            계정 식별자
          </li>
          <li>
            운영 정보: 접속 기록, 요청 시각, 앱 버전과 기기 환경 등 서비스
            안정성과 보안을 위한 정보
          </li>
        </ul>
        <p>
          공구위시는 연령 확인을 위해 생년월일을 수집하지 않습니다. 사용자가
          인증 버튼을 계속할 때 확인한 만 14세 이상 여부만 기기에 저장합니다.
        </p>
      </LegalSection>

      <LegalSection title="3. 이용 목적">
        <ul className={listClass}>
          <li>계정 생성·인증, 여러 기기 간 활동 동기화와 고객 지원</li>
          <li>공동구매 검색, 캘린더, 북마크, 알림과 제보 기능 제공</li>
          <li>
            인기 콘텐츠 산정, 서비스 품질 측정, 장애 대응과 부정 이용 방지
          </li>
          <li>만 14세 이상 이용자 대상 광고 제공과 광고 동의 관리</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. 인증 전후 처리 기준">
        <ul className={listClass}>
          <li>
            인증을 시작하기 전에는 공개 콘텐츠만 제공하며 기존 세션 복원,
            로그인·회원가입, 광고 요청, 푸시 알림, 안정적 익명 ID 생성,
            검색·딥뷰·인기 신호 기록을 하지 않습니다.
          </li>
          <li>
            카카오·네이버·Apple 또는 이메일 인증을 계속해 만 14세 이상임을
            확인한 뒤에는 선택한 기능과 동의 상태에 따라 계정, 알림, 활동 저장
            및 광고 기능을 이용할 수 있습니다.
          </li>
        </ul>
        <p>
          공개 콘텐츠를 전송하는 데 필요한 네트워크 사업자는 인증 전에도 IP
          주소와 기본 접속 로그를 일시적으로 처리할 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection title="5. 광고 및 외부 처리업체">
        <p>
          광고 요청이 허용된 만 14세 이상 이용자에게는 Google Mobile Ads SDK를
          사용합니다. Google은 광고 제공, 분석과 부정행위 방지를 위해 IP 주소,
          사용자 제품 상호작용, 진단 정보, 광고 ID·앱 세트 ID 등 기기 및 계정
          식별자를 자동으로 수집·공유할 수 있습니다.
        </p>
        <p>
          자세한 내용은 Google의{" "}
          <a
            className={linkClass}
            href="https://developers.google.com/admob/android/privacy/play-data-disclosure"
            rel="noreferrer"
            target="_blank"
          >
            Google Play 데이터 공개 안내
          </a>
          를 확인해 주세요. 앱의 “광고 개인정보 설정”에서 가능한 선택을 다시 열
          수 있습니다.
        </p>
        <p>
          계정·데이터 저장과 인증에는 Supabase 기반 인프라를, 푸시 전달에는 Expo
          및 운영체제 알림 서비스를 이용합니다. 이들 업체는 서비스 제공, 보안과
          장애 대응에 필요한 범위에서 정보를 처리할 수 있으며 글로벌 인프라에서
          처리될 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection title="6. 보관 및 삭제">
        <p>
          정보는 각 기능 제공과 계정 유지에 필요한 기간 동안 보관합니다. 계정
          삭제가 완료되면 계정과 연결된 활동 데이터 및 푸시 토큰을 삭제하거나
          식별할 수 없도록 처리합니다. 다만 법령상 보관 의무, 분쟁 대응 또는
          보안상 필요한 기록은 해당 목적에 필요한 기간 동안 분리 보관할 수
          있습니다.
        </p>
        <p>
          앱의 설정에서 회원탈퇴를 하거나{" "}
          <Link className={linkClass} href="/account-deletion">
            계정 삭제 안내
          </Link>
          에 따라 웹으로 요청할 수 있습니다. 기기에 저장된 만 14세 이상 확인값과
          로컬 캐시는 앱 데이터 삭제 또는 앱 제거로 지울 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection title="7. 이용자의 선택과 권리">
        <p>
          이용자는 계정 정보 확인·수정, 알림 해제, 광고 개인정보 선택 변경, 계정
          및 관련 데이터 삭제를 요청할 수 있습니다. 요청 과정에서 계정 보호를
          위해 최소한의 본인 확인을 진행할 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection title="8. 안전성 확보와 변경 안내">
        <p>
          전송 구간 암호화, 접근 통제와 최소 권한 운영 등 합리적인 보호 조치를
          적용합니다. 처리 항목이나 외부 SDK가 바뀌면 이 방침과 Google Play의
          Data Safety 신고를 함께 검토하고, 중요한 변경은 시행 전에 알립니다.
        </p>
      </LegalSection>

      <LegalSection title="9. 문의">
        <p>
          개인정보 또는 삭제 요청 문의:{" "}
          <a className={linkClass} href="mailto:tturrr10@gmail.com">
            tturrr10@gmail.com
          </a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
