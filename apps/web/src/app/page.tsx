import Link from "next/link";
import { CalendarRange, FileText, Shield, Star } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-neutral-0 flex flex-col">
      <header className="bg-neutral-0 border-b border-neutral-200/60 sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-xl font-bold text-primary-700">
            <CalendarRange className="h-6 w-6" aria-hidden="true" />
            GongGu Calendar
          </Link>
          <nav className="flex items-center gap-6">
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
                인플루언서 공동구매 일정
              </p>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                GongGu Calendar
              </h1>
              <p className="mt-5 text-lg text-white/90 leading-relaxed">
                인플루언서 공동구매 정보를 한눈에 보는 캘린더 서비스. 놓치기 쉬운 공구 일정을 캘린더로 빠르게 확인하고 바로 제보까지 이어갈 수 있습니다.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/calendar" className="inline-flex items-center gap-2 rounded-full bg-neutral-0 px-6 py-3 text-sm font-semibold text-primary-800 shadow-sm transition hover:bg-neutral-0/90">
                  캘린더 보기
                </Link>
                <Link href="/submit" className="inline-flex items-center gap-2 rounded-full border border-neutral-0/30 bg-neutral-0/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-neutral-0/20">
                  공구 제보하기
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-8 md:grid-cols-3">
            <FeatureCard icon={<CalendarRange className="h-5 w-5 text-primary-700" />} title="실시간 공동구매 현황" description="인플루언서별 진행 중인 공구를 한 화면에서 모아 봅니다." />
            <FeatureCard icon={<span className="h-5 w-5 text-primary-700">⏱️</span>} title="마감 임박 알림" description="다가오는 공구와 마감 임박 공구를 빠르게 구분해서 볼 수 있습니다." />
            <FeatureCard icon={<FileText className="h-5 w-5 text-primary-700" />} title="간편한 제보 시스템" description="아이디어나 발견한 공구 정보를 빠르게 제보하고 운영자 승인을 기다릴 수 있습니다." />
          </div>
        </section>

        <section className="border-t border-neutral-100 bg-neutral-50">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="grid gap-8 sm:grid-cols-3">
              <StatCard value="50+" label="추적 중인 인플루언서" />
              <StatCard value="200+" label="누적 공구 데이터" />
              <StatCard value="99%" label="데이터 정확도" />
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-neutral-0 border-t border-neutral-100 py-8 mt-auto">
        <div className="mx-auto max-w-7xl px-6 text-center text-neutral-500 text-sm">
          © 2026 GongGu Calendar. 인플루언서 공동구매 정보 서비스.
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

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <article className="rounded-2xl border border-neutral-200 bg-neutral-0 p-6 text-center shadow-sm">
      <div className="inline-flex items-center gap-2 text-primary-700">
        <Star className="h-4 w-4" aria-hidden="true" />
        <span className="text-3xl font-bold">{value}</span>
      </div>
      <div className="mt-2 text-sm text-neutral-600">{label}</div>
    </article>
  );
}
