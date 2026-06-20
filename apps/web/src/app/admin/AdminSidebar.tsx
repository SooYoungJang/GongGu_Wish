"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const adminNav = [
  { href: "/admin/dashboard", label: "대시보드" },
  { href: "/admin/submissions", label: "제보 검수" },
  { href: "/admin/influencers", label: "인플루언서 관리" },
  { href: "/admin/group-buys", label: "공구 관리" },
] as const;

interface AdminSidebarProps {
  sidebarOpen: boolean;
  onSidebarToggle: (open: boolean) => void;
}

export default function AdminSidebar({ sidebarOpen, onSidebarToggle }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => onSidebarToggle(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-bg-primary border-r border-border-primary transform transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo area */}
          <div className="p-6 border-b border-border-primary flex items-center justify-between">
            <Link href="/admin/dashboard" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-50 text-primary-700" aria-hidden="true">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </span>
              <h1 className="text-xl font-bold text-primary-600">공구캘린더</h1>
            </Link>
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-bg-secondary transition-colors"
              onClick={() => onSidebarToggle(false)}
              aria-label="사이드바 닫기"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {adminNav.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-out ${
                    isActive
                      ? "bg-primary-50 text-primary-700 shadow-sm"
                      : "text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.label}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Bottom section */}
          <div className="p-4 border-t border-border-primary space-y-2">
            <Link
              href="/"
              className="flex items-center gap-2 px-4 py-2 text-sm text-text-tertiary hover:text-text-primary transition-colors rounded-lg hover:bg-bg-secondary"
              aria-label="사용자 페이지로 이동"
            >
              <span aria-hidden="true">←</span>
              <span>사용자 페이지로 이동</span>
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}