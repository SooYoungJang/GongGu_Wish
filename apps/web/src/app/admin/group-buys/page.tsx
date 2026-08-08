"use client";

import { useState } from "react";
import {
  usePlaywrightGroupBuys,
  useApproveGroupBuy,
  useRejectGroupBuy,
  useUpdateGroupBuy,
} from "@gonggu/shared/hooks";
import type { GroupBuyAdmin } from "@gonggu/shared/schemas";
import { Button, Card, CardContent, useToast } from "@gonggu/ui-web";

type Draft = {
  productName: string;
  brandName: string;
  category: string;
  startDate: string;
  endDate: string;
  purchaseUrl: string;
  discountInfo: string;
  priceKrw: string;
  summary: string;
};

function toDateInput(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function toDraft(item: GroupBuyAdmin): Draft {
  return {
    productName: item.productName ?? "",
    brandName: item.brandName ?? "",
    category: item.category ?? "",
    startDate: toDateInput(item.startDate),
    endDate: toDateInput(item.endDate),
    purchaseUrl: item.purchaseUrl ?? "",
    discountInfo: item.discountInfo ?? "",
    priceKrw: item.priceKrw == null ? "" : String(item.priceKrw),
    summary: item.summary ?? "",
  };
}

function toPayload(draft: Draft) {
  return {
    productName: draft.productName.trim() || undefined,
    brandName: draft.brandName.trim() || undefined,
    category: draft.category.trim() || undefined,
    startDate: draft.startDate ? `${draft.startDate}T00:00:00.000Z` : undefined,
    endDate: draft.endDate ? `${draft.endDate}T00:00:00.000Z` : undefined,
    purchaseUrl: draft.purchaseUrl.trim() || undefined,
    discountInfo: draft.discountInfo.trim() || undefined,
    priceKrw: draft.priceKrw.trim() ? Number(draft.priceKrw) : undefined,
    summary: draft.summary.trim() || undefined,
  };
}

export default function AdminGroupBuysPage() {
  const { data: items, isLoading, error, refetch } = usePlaywrightGroupBuys();
  const updateMutation = useUpdateGroupBuy();
  const approveMutation = useApproveGroupBuy();
  const rejectMutation = useRejectGroupBuy();
  const { addToast } = useToast();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const updateDraft = (
    item: GroupBuyAdmin,
    key: keyof Draft,
    value: string,
  ) => {
    setDrafts((previous) => ({
      ...previous,
      [item.id]: {
        ...(previous[item.id] ?? toDraft(item)),
        [key]: value,
      },
    }));
  };

  const handleSave = async (item: GroupBuyAdmin) => {
    const draft = drafts[item.id] ?? toDraft(item);
    try {
      await updateMutation.mutateAsync({ id: item.id, data: toPayload(draft) });
      addToast({ message: "공구 후보를 저장했습니다.", type: "success" });
      refetch();
    } catch (saveError) {
      addToast({
        message:
          saveError instanceof Error
            ? saveError.message
            : "저장에 실패했습니다.",
        type: "error",
      });
    }
  };

  const handleApprove = async (item: GroupBuyAdmin) => {
    try {
      await approveMutation.mutateAsync(item.id);
      addToast({ message: "공구를 승인했습니다.", type: "success" });
      refetch();
    } catch (approveError) {
      addToast({
        message:
          approveError instanceof Error
            ? approveError.message
            : "승인에 실패했습니다. 필수 필드를 확인하세요.",
        type: "error",
      });
    }
  };

  const handleReject = async (item: GroupBuyAdmin) => {
    const reason = window.prompt("반려 사유를 입력하세요.");
    if (!reason?.trim()) return;
    try {
      await rejectMutation.mutateAsync({ id: item.id, reason: reason.trim() });
      addToast({ message: "공구 후보를 반려했습니다.", type: "info" });
      refetch();
    } catch (rejectError) {
      addToast({
        message:
          rejectError instanceof Error
            ? rejectError.message
            : "반려에 실패했습니다.",
        type: "error",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-neutral-500">
        공구 후보를 불러오는 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-24 text-center space-y-4">
        <p className="text-error-600">공구 후보를 불러오지 못했습니다.</p>
        <Button variant="primary" onClick={() => refetch()}>
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-neutral-900">공구 후보 검수</h1>
        <p className="text-neutral-500 mt-1">
          Playwright 공개 수집 후보는 필수 정보를 보완하고 승인해야 앱에
          공개됩니다.
        </p>
      </header>

      {items && items.length > 0 ? (
        <div className="space-y-4">
          {items.map((item) => {
            const draft = drafts[item.id] ?? toDraft(item);
            return (
              <Card key={item.id} variant="outlined" padding="lg">
                <CardContent>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
                          {item.sourceType} · {item.status}
                        </p>
                        <h2 className="text-xl font-semibold text-neutral-900">
                          @{item.rawPost.influencer.instagramUsername}
                        </h2>
                        <a
                          className="text-sm text-primary-600 hover:underline"
                          href={item.rawPost.postUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          원본 게시물 열기
                        </a>
                      </div>
                      <div className="text-sm text-neutral-500 md:text-right">
                        <p>
                          자동 추출 신뢰도 {Math.round(item.confidence * 100)}%
                        </p>
                        <p>수집 캡션 기반 · 미디어는 원본 URL만 저장</p>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {(
                        [
                          ["productName", "제품명", "text"],
                          ["brandName", "브랜드명", "text"],
                          ["category", "카테고리", "text"],
                          ["purchaseUrl", "구매 URL", "url"],
                          ["startDate", "시작일", "date"],
                          ["endDate", "마감일", "date"],
                          ["discountInfo", "할인 정보", "text"],
                          ["priceKrw", "가격 (원)", "number"],
                        ] as const
                      ).map(([key, label, type]) => (
                        <label
                          key={key}
                          className="space-y-1 text-sm text-neutral-700"
                        >
                          <span>{label}</span>
                          <input
                            type={type}
                            value={draft[key]}
                            onChange={(event) =>
                              updateDraft(item, key, event.target.value)
                            }
                            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                          />
                        </label>
                      ))}
                    </div>

                    <label className="space-y-1 text-sm text-neutral-700">
                      <span>요약</span>
                      <textarea
                        value={draft.summary}
                        onChange={(event) =>
                          updateDraft(item, "summary", event.target.value)
                        }
                        rows={3}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                      />
                    </label>

                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => void handleReject(item)}
                        disabled={rejectMutation.isPending}
                      >
                        반려
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => void handleSave(item)}
                        disabled={updateMutation.isPending}
                      >
                        저장
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => void handleApprove(item)}
                        disabled={approveMutation.isPending}
                      >
                        승인
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card variant="outlined" padding="lg">
          <CardContent>
            <p className="py-12 text-center text-neutral-500">
              검수 대기 중인 자동 수집 공구가 없습니다.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
