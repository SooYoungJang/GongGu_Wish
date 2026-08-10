"use client";

import { useState } from "react";
import {
  useInfluencers,
  useCreateInfluencer,
  useDeactivateInfluencer,
  useUpdateInfluencerPlaywrightCollection,
} from "@gonggu/shared/hooks";
import { formatDateTime } from "@gonggu/shared/utils";
import { useConfirmation, AlertDialog } from "@gonggu/ui-web";

export default function AdminInfluencersPage() {
  const { data: influencers, isLoading, refetch } = useInfluencers();
  const createMutation = useCreateInfluencer({
    onSuccess: () => void refetch(),
  });
  const deactivateMutation = useDeactivateInfluencer({
    onSuccess: () => void refetch(),
  });
  const collectionMutation = useUpdateInfluencerPlaywrightCollection({
    onSuccess: () => void refetch(),
  });
  const { confirm, state: confirmState } = useConfirmation();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ instagramUsername: "", displayName: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = form.instagramUsername.trim().replace(/^@/, "");
    if (!username) {
      setErrors({ instagramUsername: "인스타그램 계정은 필수입니다" });
      return;
    }
    if (!form.displayName.trim()) {
      setErrors({ displayName: "표시명은 필수입니다" });
      return;
    }

    try {
      await createMutation.mutateAsync({
        instagramUsername: username,
        displayName: form.displayName.trim(),
      });
      setForm({ instagramUsername: "", displayName: "" });
      setShowForm(false);
      setErrors({});
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "등록에 실패했습니다";
      setErrors({ form: message });
    }
  };

  const handleDeactivate = (id: string) => {
    confirm({
      title: "인플루언서 비활성화",
      description:
        "이 인플루언서를 비활성화하시겠습니까? 기존 승인된 공구는 유지되고 신규 수집 대상에서 제외됩니다.",
      variant: "destructive",
      confirmText: "비활성화",
      onConfirm: async () => {
        await deactivateMutation.mutateAsync(id);
      },
    });
  };

  const handleCollectionToggle = (id: string, enabled: boolean) => {
    confirm({
      title: enabled ? "공개 수집 활성화" : "공개 수집 비활성화",
      description: enabled
        ? "Instagram/Meta 약관과 수집 권한을 확인했고, 해당 계정의 공개 게시물만 수집하도록 활성화하시겠습니까?"
        : "이 계정의 Playwright 공개 게시물 수집을 중지하시겠습니까?",
      variant: enabled ? "default" : "destructive",
      confirmText: enabled ? "활성화" : "비활성화",
      onConfirm: async () => {
        await collectionMutation.mutateAsync({
          id,
          playwrightCollectionEnabled: enabled,
        });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"
          role="status"
          aria-label="로딩 중"
        ></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">
            인플루언서 관리
          </h1>
          <p className="text-neutral-600 mt-1">
            공구 수집 대상인 인플루언서 계정을 관리합니다.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
        >
          인플루언서 추가
        </button>
      </header>

      {showForm && (
        <div className="bg-neutral-0 rounded-xl border border-neutral-100 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">
            새 인플루언서 등록
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            <div>
              <label
                htmlFor="instagramUsername"
                className="block text-sm font-medium text-neutral-700 mb-1"
              >
                인스타그램 계정 @
              </label>
              <input
                id="instagramUsername"
                type="text"
                value={form.instagramUsername}
                onChange={(e) =>
                  setForm({ ...form, instagramUsername: e.target.value })
                }
                placeholder="example_user"
                aria-required="true"
                aria-label="인스타그램 계정"
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.instagramUsername
                    ? "border-error-500"
                    : "border-neutral-300"
                }`}
              />
              {errors.instagramUsername && (
                <p className="mt-1 text-sm text-error-600">
                  {errors.instagramUsername}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="displayName"
                className="block text-sm font-medium text-neutral-700 mb-1"
              >
                표시명
              </label>
              <input
                id="displayName"
                type="text"
                value={form.displayName}
                onChange={(e) =>
                  setForm({ ...form, displayName: e.target.value })
                }
                placeholder="표시될 이름"
                aria-required="true"
                aria-label="표시명"
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.displayName ? "border-error-500" : "border-neutral-300"
                }`}
              />
              {errors.displayName && (
                <p className="mt-1 text-sm text-error-600">
                  {errors.displayName}
                </p>
              )}
            </div>
            {errors.form && (
              <p className="text-sm text-error-600">{errors.form}</p>
            )}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {createMutation.isPending ? "등록 중..." : "등록"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm({ instagramUsername: "", displayName: "" });
                  setErrors({});
                }}
                className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-neutral-0 rounded-xl border border-neutral-100 overflow-hidden">
        {influencers && influencers.length > 0 ? (
          <div className="divide-y divide-neutral-100">
            {influencers.map((inf) => (
              <div
                key={inf.id}
                className="p-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-lg">
                    {inf.instagramUsername.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-900">
                      @{inf.instagramUsername}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {inf.displayName ?? "표시명 없음"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-2 lg:items-end">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        inf.isActive
                          ? "bg-success-100 text-success-700"
                          : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {inf.isActive ? "활성" : "비활성"}
                    </span>
                    <button
                      onClick={() =>
                        handleCollectionToggle(
                          inf.id,
                          inf.playwrightCollectionEnabled !== true,
                        )
                      }
                      disabled={!inf.isActive || collectionMutation.isPending}
                      aria-pressed={inf.playwrightCollectionEnabled === true}
                      className={`px-3 py-1.5 text-sm rounded-lg font-medium disabled:opacity-50 ${
                        inf.playwrightCollectionEnabled === true
                          ? "bg-primary-100 text-primary-700"
                          : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      공개 수집{" "}
                      {inf.playwrightCollectionEnabled === true ? "ON" : "OFF"}
                    </button>
                    {inf.isActive && (
                      <button
                        onClick={() => handleDeactivate(inf.id)}
                        disabled={deactivateMutation.isPending}
                        className="px-3 py-1.5 text-sm text-error-600 hover:text-error-700 font-medium disabled:opacity-50"
                      >
                        비활성화
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-neutral-500 text-left lg:text-right space-y-1">
                    <p>
                      공개 게시물 {inf.playwrightRawPostCount ?? 0}개 · 후보{" "}
                      {inf.playwrightCandidateCount ?? 0}개 · 한국 신호 충족{" "}
                      {inf.playwrightKoreaCandidateCount ?? 0}개
                    </p>
                    <p>
                      마지막 시도: {formatDateTime(inf.playwrightLastAttemptAt)}
                    </p>
                    <p>
                      마지막 성공: {formatDateTime(inf.playwrightLastSuccessAt)}
                    </p>
                    {inf.playwrightLastError && (
                      <p className="text-error-600 max-w-xl">
                        오류: {inf.playwrightLastError}
                      </p>
                    )}
                    <p>등록: {formatDateTime(inf.createdAt)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-neutral-500">
            <p>등록된 인플루언서가 없습니다.</p>
          </div>
        )}
      </div>
      {confirmState && <AlertDialog {...confirmState} />}
    </div>
  );
}
