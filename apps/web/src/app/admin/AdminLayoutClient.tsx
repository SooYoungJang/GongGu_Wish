"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "./AdminSidebar";
import { useAuth } from "../../lib/auth-context";
import { useEffect } from "react";
import { ToastProvider } from "@gonggu/ui-web";

export default function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, logout, user } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 인증 상태 확인 - 로그인 페이지에서는 체크하지 않음
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isLoginPage = window.location.pathname === "/admin/login";
    if (!isLoading && !isAuthenticated && !isLoginPage) {
      router.replace("/admin/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // 로딩 중 (로그인 페이지 제외)
  if (isLoading && typeof window !== "undefined" && window.location.pathname !== "/admin/login") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-4" role="status" aria-label="로딩 중" />
          <p className="text-neutral-500 text-sm">인증 확인 중...</p>
        </div>
      </div>
    );
  }

  // 로그인 페이지는 별도 레이아웃
  if (typeof window !== "undefined" && window.location.pathname === "/admin/login") {
    return <>{children}</>;
  }

  // 인증되지 않은 경우 (가드 역할)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <ToastProvider placement="bottom-right" maxToasts={3}>
      <div className="min-h-screen bg-neutral-50 flex">
        <AdminSidebar sidebarOpen={sidebarOpen} onSidebarToggle={setSidebarOpen} />
        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
          <header className="bg-neutral-0 border-b border-neutral-200 sticky top-0 z-30">
            <div className="flex items-center justify-between px-6 py-4">
              <button
                className="lg:hidden p-2 rounded-lg hover:bg-neutral-100"
                onClick={() => setSidebarOpen(true)}
                aria-label="사이드바 열기"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex-1 lg:flex-none" />
              <div className="flex items-center gap-4">
                {user && (
                  <span className="text-sm text-neutral-500 hidden sm:block">
                    {user.email}
                  </span>
                )}
                <button
                  onClick={logout}
                  className="text-sm text-error-600 hover:text-error-700 font-medium px-3 py-1.5 rounded-lg hover:bg-error-50 transition-colors"
                >
                  로그아웃
                </button>
              </div>
            </div>
          </header>
          <main className="flex-1 p-6 lg:p-8 overflow-auto">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}