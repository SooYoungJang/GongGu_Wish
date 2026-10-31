import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, CalendarRange, Download, FileText, Shield } from "lucide-react";

const GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=com.gonggu.wish";
const title = "공구위시 - 인스타그램 공동구매 캘린더";
const description = "흩어진 인스타 공구를 한곳에서 살펴보세요. 공구위시에서 공동구매 일정을 확인하고, Android 앱에서 관심 공구를 북마크하세요.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://gongguwish.com/" },
  openGraph: {
    title,
    description,
    url: "https://gongguwish.com/",
    siteName: "공구위시",
    locale: "ko_KR",
    type: "website",
  },
  twitter: { card: "summary", title, description },
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-neutral-0 flex flex-col">
      <header className="bg-neutral-0 border-b border-neutral-200/60 sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-xl font-bold text-primary-700">
            <CalendarRange className="h-6 w-6" aria-hidden="true" />
            공구위시
          </Link>
          <nav aria-label="주요 메뉴" className="flex flex-wrap items-center gap-4 sm:gap-6">
            <Link href="/calendar" className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-800 hover:text-primary-700 transition-colors">
              <CalendarRange className="h-4 w-4" aria-hidden="true" />
              캘린더
            </Link>
            <Link href="/submit" className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-800 hover:text-primary-700 transition-colors">
              <FileText className="h-4 w-4" aria-hidden="true" />
              제보하기
            </Link>
            <Link href="/admin" className="inline-flex items-center gap-1.5 rounded-full bg-primary-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-800">
              <Shield className="h-4 w-4" aria-hidden="true" />
              관리자
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 text-white">
          <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
            <div className="max-w-3xl">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-neutral-0/15 px-4 py-1.5 text-sm font-medium backdrop-blur">
                <CalendarRange className="h-4 w-4" />
                공구위시 · 공동구매 캘린더
              </p>
              <h1 className="text-4xl font-extrabold tracking-tight leading-tight sm:text-5xl">
                흩어진 인스타 공구,<br />
                한곳에서 보고 일정 챙기기
              </h1>
              <p className="mt-5 text-lg text-white/90 leading-relaxed">
                어디서 봤더라, 언제 끝나더라? 공구위시에서 관심 있는 공동구매를 찾아보고, 앱에 북마크해 다시 확인하세요.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={GOOGLE_PLAY_URL} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-neutral-0 px-6 py-3 text-sm font-semibold text-primary-800 shadow-sm transition hover:bg-neutral-0/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                  <Download className="h-5 w-5" aria-hidden="true" />
                  Google Play에서 앱 설치
                </a>
                <Link href="/calendar" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-neutral-0/30 bg-neutral-0/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-neutral-0/20">
                  웹에서 캘린더 먼저 보기
                </Link>
              </div>
              <p className="mt-4 text-sm text-white/90">Android 앱 · Google Play로 이동합니다</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="features-heading" className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <h2 id="features-heading" className="text-2xl font-bold text-neutral-900">찾고, 일정 보고, 관심 공구 저장하기</h2>
          <p className="mt-3 mb-8 text-neutral-600">공구를 둘러보는 순간부터 다시 찾아볼 때까지.</p>
          <div className="grid gap-6 md:grid-cols-3">
            <FeatureCard icon={<CalendarRange className="h-5 w-5 text-primary-700" aria-hidden="true" />} title="공동구매 일정 한눈에" description="캘린더에서 공구 일정을 살펴보고, 진행 중이거나 마감이 다가오는 공구를 확인하세요." />
            <FeatureCard icon={<Bookmark className="h-5 w-5 text-primary-700" aria-hidden="true" />} title="관심 공구는 앱에 북마크" description="다시 보고 싶은 공구를 북마크하고, 앱에서 모아 확인하세요." />
            <FeatureCard icon={<FileText className="h-5 w-5 text-primary-700" aria-hidden="true" />} title="발견한 공구 함께 나누기" description="알리고 싶은 공구가 있다면 제보해주세요. 제보한 정보는 검토 후 반영됩니다." />
          </div>
        </section>

        <section aria-labelledby="start-heading" className="border-t border-neutral-100 bg-neutral-50">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
            <h2 id="start-heading" className="text-2xl font-bold text-neutral-900">첫 관심 공구부터 시작해보세요</h2>
            <ol className="mt-8 grid gap-6 sm:grid-cols-3">
              <Step number="01" title="앱 설치하기" description="Google Play에서 공구위시 Android 앱을 설치하세요." />
              <Step number="02" title="공구 찾아보기" description="관심 있는 상품을 검색하고 공구 일정을 살펴보세요." />
              <Step number="03" title="북마크로 모아보기" description="관심 공구를 저장해두고 필요할 때 다시 확인하세요." />
            </ol>
            <a href={GOOGLE_PLAY_URL} className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-700">
              <Download className="h-5 w-5" aria-hidden="true" />
              Google Play에서 앱 설치
            </a>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-neutral-600">공구위시는 공동구매 정보를 안내합니다. 구매는 판매자의 외부 페이지에서 진행되며, 가격과 판매 일정은 해당 페이지에서 최종 확인해주세요.</p>
          </div>
        </section>
      </main>

      <footer className="bg-neutral-0 border-t border-neutral-100 py-8 mt-auto">
        <div className="mx-auto max-w-7xl px-6 text-center text-neutral-500 text-sm space-y-3">
          <nav aria-label="정책 및 지원" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link className="hover:text-primary-700" href="/privacy">개인정보처리방침</Link>
            <Link className="hover:text-primary-700" href="/terms">서비스 이용약관</Link>
            <Link className="hover:text-primary-700" href="/account-deletion">계정 삭제 안내</Link>
            <a className="hover:text-primary-700" href="mailto:tturrr10@gmail.com">지원 문의</a>
          </nav>
          <p>© 2026 공구위시. 인플루언서 공동구매 정보 서비스.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <article className="rounded-2xl border border-neutral-200 bg-neutral-0 p-6 shadow-sm transition hover:shadow-md">
      <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50">{icon}</span>
      <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
      <p className="mt-2 text-neutral-600 leading-relaxed">{description}</p>
    </article>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <li className="rounded-2xl border border-neutral-200 bg-neutral-0 p-6 shadow-sm">
      <span aria-hidden="true" className="text-sm font-bold text-primary-700">{number}</span>
      <h3 className="mt-3 text-lg font-semibold text-neutral-900">{title}</h3>
      <p className="mt-2 leading-relaxed text-neutral-600">{description}</p>
    </li>
  );
}
