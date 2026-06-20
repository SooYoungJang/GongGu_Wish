"use client";

import { useMemo, useState } from "react";
import { useCalendarGroupBuys } from "@gonggu/shared/hooks";
import type { CalendarGroupBuyItem } from "@gonggu/shared/schemas";
import type { GroupBuy } from "@gonggu/shared/schemas";
import { formatRelativeTime, getStatusColor } from "@gonggu/shared/utils";
import Link from "next/link";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const dow = DAY_NAMES[d.getDay()];
  return `${m}월 ${day}일 (${dow})`;
}

function formatMonthLabel(year: number, month: number): string {
  return `${year}년 ${month}월`;
}

type FilterValue = "all" | "upcoming" | "ending-soon";

function filterGroupBuy(gb: GroupBuy, filter: FilterValue): boolean {
  if (filter === "all") return true;
  if (!gb.endDate) return false;
  const daysLeft = Math.ceil(
    (new Date(gb.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (filter === "upcoming") return daysLeft > 7;
  if (filter === "ending-soon") return daysLeft >= 0 && daysLeft <= 7;
  return true;
}

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [filter, setFilter] = useState<FilterValue>("all");

  const { data, isLoading, isError } = useCalendarGroupBuys(year, month);

  // Flatten items, apply filter, then re-group by date
  const filteredItems = useMemo<CalendarGroupBuyItem[]>(() => {
    if (!data) return [];
    return data.items
      .map((item) => ({
        date: item.date,
        groupBuys: item.groupBuys.filter((gb) => filterGroupBuy(gb, filter)),
      }))
      .filter((item) => item.groupBuys.length > 0);
  }, [data, filter]);

  function goToPrevMonth() {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function goToNextMonth() {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12 text-error-500">
        데이터 로드에 실패했습니다. 나중에 다시 시도해주세요.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <header className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900 mb-2">
          공동구매 캘린더
        </h1>
        <p className="text-neutral-700 leading-relaxed">진행 중인 공구 일정을 확인하세요. 관심 있는 공구를 빠르게 찾아 제보 페이지로 이동할 수 있습니다.</p>
      </header>

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={goToPrevMonth}
          className="p-2 rounded-lg hover:bg-neutral-100 transition-colors text-neutral-600"
          aria-label="이전 달"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h2 className="text-2xl font-bold text-neutral-900">
          {formatMonthLabel(year, month)}
        </h2>

        <button
          onClick={goToNextMonth}
          disabled={isCurrentMonth}
          className="p-2 rounded-lg hover:bg-neutral-100 transition-colors text-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="다음 달"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-8">
        {(["all", "upcoming", "ending-soon"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? "bg-primary-700 text-white shadow-sm"
                : "bg-white text-neutral-800 border border-neutral-200 hover:bg-neutral-50"
            }`}
          >
            {f === "all" && "전체"}
            {f === "upcoming" && "다가오는 공구"}
            {f === "ending-soon" && "마감 임박"}
          </button>
        ))}
      </div>

      {data && data.meta && (
        <div className="text-sm text-neutral-500 mb-4">
          총 {data.meta.total}개의 공구 (필터 적용 후 {filteredItems.reduce((sum, item) => sum + item.groupBuys.length, 0)}개)
        </div>
      )}

      {filteredItems.length === 0 ? (
        <div className="text-center py-16 text-neutral-500">
          <p className="text-lg">{filter !== "all" ? "조건에 맞는 공구가 없습니다." : "표시할 공구가 없습니다."}</p>
          <Link
            href="/submit"
            className="mt-4 inline-flex items-center gap-1.5 text-primary-700 font-semibold hover:text-primary-800"
          >
            제보 페이지에서 공구 제보하기
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {filteredItems.map((item) => (
            <section key={item.date}>
              <h3 className="text-lg font-semibold text-neutral-700 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDateLabel(item.date)}
              </h3>
              <div className="space-y-4">
                {item.groupBuys.map((gb) => (
                  <GroupBuyCard key={gb.id} groupBuy={gb} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupBuyCard({ groupBuy }: { groupBuy: GroupBuy }) {
  return (
    <article className="bg-white rounded-xl border border-neutral-100 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl font-semibold text-neutral-900 truncate">
              {groupBuy.productName ?? "제품명 미확인"}
            </h2>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(groupBuy.status)}`}>
              {groupBuy.status}
            </span>
          </div>
          {groupBuy.brandName && (
            <p className="text-neutral-700 font-medium mb-2">{groupBuy.brandName}</p>
          )}
          {groupBuy.summary && (
            <p className="text-neutral-700 mb-3 line-clamp-2 leading-relaxed">{groupBuy.summary}</p>
          )}
          <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-500">
            {groupBuy.discountInfo && (
              <span className="font-semibold text-primary-700">{groupBuy.discountInfo}</span>
            )}
            {groupBuy.endDate && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className={groupBuy.status === "EXPIRED" ? "text-error-500" : ""}>
                  {formatRelativeTime(groupBuy.endDate)}
                </span>
              </span>
            )}
            {groupBuy.purchaseUrl && (
              <a
                href={groupBuy.purchaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:underline text-sm font-medium"
              >
                구매하기 →
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
