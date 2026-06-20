"use client";

import type { ReactNode } from "react";
import { useInfluencers, useSubmissions } from "@gonggu/shared/hooks";
import { formatRelativeTime } from "@gonggu/shared/utils";
import Link from "next/link";
import { Card, Badge, Button } from "@gonggu/ui-web";

export default function AdminDashboardPage() {
  const {
    data: influencers,
    isLoading: influencersLoading,
    error: influencersError,
    refetch: refetchInfluencers,
  } = useInfluencers();
  const {
    data: submissions,
    isLoading: submissionsLoading,
    error: submissionsError,
    refetch: refetchSubmissions,
  } = useSubmissions();
  const pendingCount =
    submissions?.filter(
      (s) => s.status === "PENDING" || s.status === "REVIEW_REQUIRED"
    ).length ?? 0;
  const approvedCount =
    submissions?.filter((s) => s.status === "APPROVED").length ?? 0;
  const activeInfluencers = influencers?.filter((i) => i.isActive).length ?? 0;

  const hasError = !!(submissionsError || influencersError);

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <svg className="h-12 w-12 text-error-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <h2 className="text-xl font-semibold text-neutral-900">
          데이터를 불러올 수 없습니다
        </h2>
        <p className="text-neutral-500 text-sm">
          일시적인 오류가 발생했습니다. 다시 시도해주세요.
        </p>
        <Button
          variant="primary"
          onClick={() => {
            refetchSubmissions();
            refetchInfluencers();
          }}
        >
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold text-neutral-900">대시보드</h1>
        <p className="text-neutral-500 mt-1">
          공동구매 제보 및 승인 현황을 한눈에 확인하세요.
        </p>
      </header>

      {/* Stat Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="검수 대기"
          value={pendingCount}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          href="/admin/submissions"
          variant="warning"
          isLoading={submissionsLoading}
        />
        <StatCard
          title="활성 인플루언서"
          value={activeInfluencers}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
          href="/admin/influencers"
          variant="primary"
          isLoading={influencersLoading}
        />
        <StatCard
          title="누적 제보"
          value={submissions?.length ?? 0}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
          href="/admin/submissions"
          variant="success"
          isLoading={submissionsLoading}
        />
        <StatCard
          title="승인된 공구"
          value={approvedCount}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          href="/admin/group-buys"
          variant="success"
          isLoading={submissionsLoading}
        />
      </div>

      {/* Charts & Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Submissions */}
        <Card variant="outlined" padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-neutral-900">최근 제보</h2>
            <Link
              href="/admin/submissions"
              className="text-sm text-primary-600 hover:underline"
            >
              전체 보기<span aria-hidden="true"> →</span>
            </Link>
          </div>
          {submissionsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="animate-pulse h-16 bg-neutral-100 rounded-lg"
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : submissions && submissions.length > 0 ? (
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {submissions.slice(0, 5).map((sub) => (
                <SubmissionRow key={sub.id} submission={sub} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-12 space-y-2">
              <svg className="h-10 w-10 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
              <p className="text-neutral-500 text-sm">
                아직 접수된 제보가 없습니다
              </p>
              <p className="text-neutral-400 text-xs">
                첫 제보가 도착하면 여기에 표시됩니다
              </p>
            </div>
          )}
        </Card>

        {/* Registered Influencers */}
        <Card variant="outlined" padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-neutral-900">
              등록된 인플루언서
            </h2>
            <Link
              href="/admin/influencers"
              className="text-sm text-primary-600 hover:underline"
            >
              전체 보기<span aria-hidden="true"> →</span>
            </Link>
          </div>
          {influencersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="animate-pulse h-16 bg-neutral-100 rounded-lg"
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : influencers && influencers.length > 0 ? (
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {influencers.slice(0, 5).map((inf) => (
                <InfluencerRow key={inf.id} influencer={inf} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-12 space-y-2">
              <svg className="h-10 w-10 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <p className="text-neutral-500 text-sm">
                등록된 인플루언서가 없습니다
              </p>
              <p className="text-neutral-400 text-xs">
                인플루언서를 추가하면 여기에 표시됩니다
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ===========================================================================
   Sub-components
   =========================================================================== */

interface StatCardProps {
  title: string;
  value: number;
  icon: ReactNode;
  href: string;
  variant: "primary" | "success" | "warning";
  isLoading?: boolean;
}

const statCardVariants: Record<string, string> = {
  primary: "bg-primary-50 text-primary-600",
  success: "bg-success-50 text-success-600",
  warning: "bg-warning-50 text-warning-600",
};

function StatCard({ title, value, icon, href, variant, isLoading }: StatCardProps) {
  return (
    <Link
      href={href}
      className="block"
    >
      <Card variant="elevated" padding="lg" hoverable>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-neutral-500">{title}</p>
            {isLoading ? (
              <div className="mt-2 h-9 w-16 animate-pulse bg-neutral-200 rounded" aria-hidden="true" />
            ) : (
              <p className="text-3xl font-bold text-neutral-900 mt-1">
                {value}
              </p>
            )}
          </div>
          <div className={`p-3 rounded-xl text-xl ${statCardVariants[variant]}`} aria-hidden="true">
            {icon}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function SubmissionRow({
  submission,
}: {
  submission: {
    id: string;
    productName: string | null;
    status: string;
    createdAt: string;
  };
}) {
  const statusVariant =
    submission.status === "APPROVED"
      ? "success"
      : submission.status === "REJECTED" || submission.status === "DUPLICATE"
      ? "error"
      : "warning";

  const statusLabel: Record<string, string> = {
    PENDING: "대기 중",
    REVIEW_REQUIRED: "검수 필요",
    APPROVED: "승인됨",
    REJECTED: "반려됨",
    DUPLICATE: "중복",
  };

  return (
    <Link
      href={`/admin/submissions/${submission.id}`}
      className="flex items-center justify-between p-3 rounded-lg hover:bg-neutral-50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-neutral-900 truncate">
          {submission.productName ?? "제품명 미확인"}
        </p>
        <p className="text-sm text-neutral-500">
          {formatRelativeTime(submission.createdAt)}
        </p>
      </div>
      <Badge variant={statusVariant} size="sm">
        {statusLabel[submission.status] || submission.status}
      </Badge>
    </Link>
  );
}

function InfluencerRow({
  influencer,
}: {
  influencer: {
    id: string;
    instagramUsername: string;
    displayName: string | null;
    isActive: boolean;
  };
}) {
  return (
    <Link
      href={`/admin/influencers/${influencer.id}`}
      className="flex items-center justify-between p-3 rounded-lg hover:bg-neutral-50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-medium">
          {influencer.instagramUsername.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-medium text-neutral-900">
            @{influencer.instagramUsername}
          </p>
          <p className="text-sm text-neutral-500">
            {influencer.displayName ?? "표시명 없음"}
          </p>
        </div>
      </div>
      <Badge variant={influencer.isActive ? "success" : "default"} size="sm">
        {influencer.isActive ? "활성" : "비활성"}
      </Badge>
    </Link>
  );
}