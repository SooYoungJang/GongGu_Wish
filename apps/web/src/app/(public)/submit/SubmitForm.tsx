"use client";

import { useState, FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@gonggu/shared/utils/api-client";
import { useSubmissionGuard } from "@gonggu/shared/hooks";
import Link from "next/link";

type PublicSubmissionForm = {
  productName: string;
  brandName: string;
  startDate: string;
  endDate: string;
  purchaseUrl: string;
  discountInfo: string;
  instagramUrl: string;
  imageUrls: string;
  summary: string;
};

const emptyForm: PublicSubmissionForm = {
  productName: "",
  brandName: "",
  startDate: "",
  endDate: "",
  purchaseUrl: "",
  discountInfo: "",
  instagramUrl: "",
  imageUrls: "",
  summary: "",
};

function normalizeOptional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isValidOptionalUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateForm(form: PublicSubmissionForm): string | null {
  if (form.productName.trim().length < 2) {
    return "제품명은 2자 이상 필수입니다.";
  }
  if (!isValidOptionalUrl(form.purchaseUrl)) {
    return "구매 링크는 http(s) URL 형식이어야 합니다.";
  }
  if (!isValidOptionalUrl(form.instagramUrl)) {
    return "인스타그램 URL은 http(s) URL 형식이어야 합니다.";
  }
  if (!isValidOptionalUrl(form.imageUrls)) {
    return "이미지 URL은 http(s) URL 형식이어야 합니다.";
  }
  if (form.startDate.trim() && form.endDate.trim()) {
    const start = new Date(form.startDate.trim());
    const end = new Date(form.endDate.trim());
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return "날짜는 YYYY-MM-DD 형식으로 입력해주세요.";
    }
    if (start > end) {
      return "시작일은 종료일보다 늦을 수 없습니다.";
    }
  }
  return null;
}

export default function SubmitForm() {
  const [form, setForm] = useState<PublicSubmissionForm>(emptyForm);
  const [feedback, setFeedback] = useState<string | null>(null);
  const { isDispatched, guard, reset } = useSubmissionGuard();

  const submitMutation = useMutation({
    mutationFn: async (data: PublicSubmissionForm) => {
      const response = await apiClient.post("/submissions", {
        productName: data.productName.trim(),
        brandName: normalizeOptional(data.brandName),
        startDate: normalizeOptional(data.startDate),
        endDate: normalizeOptional(data.endDate),
        purchaseUrl: normalizeOptional(data.purchaseUrl),
        discountInfo: normalizeOptional(data.discountInfo),
        instagramUrl: normalizeOptional(data.instagramUrl),
        imageUrls: normalizeOptional(data.imageUrls)
          ? [data.imageUrls.trim()]
          : [],
        summary: normalizeOptional(data.summary),
        isAnonymous: true,
      });
      return response;
    },
  });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validationError = validateForm(form);
    if (validationError) {
      setFeedback(validationError);
      return;
    }

    if (!guard()) return;

    setFeedback("제보를 접수하는 중입니다...");

    try {
      await submitMutation.mutateAsync(form);
      setFeedback("제보가 접수되었습니다. 운영자 승인 후 캘린더에 반영됩니다.");
      setForm(emptyForm);
      setTimeout(() => {
        window.location.href = "/";
      }, 700);
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "제보 접수에 실패했습니다. 잠시 후 다시 시도해주세요."
      );
    } finally {
      reset();
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-[calc(100vh-12rem)] bg-gradient-to-b from-neutral-50 to-neutral-0 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="text-center mb-10">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-2">
            User Submission
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900 mb-4">
            공구 제보하기
          </h1>
          <p className="text-neutral-700 text-lg leading-relaxed">
            발견한 공동구매 정보를 알려주세요. 필수 제품명만 있어도 접수되며,
            운영자 승인 후 캘린더에 노출됩니다.
          </p>
        </header>

        {/* Feedback Message */}
        {feedback && (
          <div
            className={`mb-6 p-4 rounded-xl text-center ${
              feedback.includes("실패") || feedback.includes("필수") || feedback.includes("형식")
                ? "bg-error-50 text-error-700 border border-error-200"
                : feedback.includes("접수되었습니다")
                ? "bg-success-50 text-success-700 border border-success-200"
                : "bg-warning-50 text-warning-700 border border-warning-200"
            }`}
            role="alert"
          >
            <p className="text-sm">{feedback}</p>
          </div>
        )}

        {/* Form Card */}
        <form onSubmit={handleSubmit} className="bg-neutral-0 rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8 space-y-6">
            {/* Required indicator */}
            <p className="text-sm text-neutral-500 text-right">
              * 필수 항목
            </p>

            {/* 제품명 */}
            <div>
              <label
                htmlFor="productName"
                className="block text-sm font-medium text-neutral-700 mb-2"
              >
                제품명 <span className="text-error-500">*</span>
              </label>
              <input
                type="text"
                id="productName"
                name="productName"
                value={form.productName}
                onChange={handleChange}
                placeholder="예: 마롱드파리 크로와상 6입"
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-neutral-900 placeholder-neutral-400 transition-colors"
                required
                minLength={2}
                maxLength={100}
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-neutral-500">
                2자 이상, 최대 100자까지 입력 가능합니다.
              </p>
            </div>

            {/* 브랜드 */}
            <div>
              <label
                htmlFor="brandName"
                className="block text-sm font-medium text-neutral-700 mb-2"
              >
                브랜드
              </label>
              <input
                type="text"
                id="brandName"
                name="brandName"
                value={form.brandName}
                onChange={handleChange}
                placeholder="예: 마롱드파리"
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-neutral-900 placeholder-neutral-400 transition-colors"
                maxLength={50}
                autoComplete="off"
              />
            </div>

            {/* 날짜: 시작일, 종료일 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="startDate"
                  className="block text-sm font-medium text-neutral-700 mb-2"
                >
                  시작일 (YYYY-MM-DD)
                </label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  value={form.startDate}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-neutral-900 placeholder-neutral-400 transition-colors"
                />
              </div>
              <div>
                <label
                  htmlFor="endDate"
                  className="block text-sm font-medium text-neutral-700 mb-2"
                >
                  종료일 (YYYY-MM-DD)
                </label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  value={form.endDate}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-neutral-900 placeholder-neutral-400 transition-colors"
                />
              </div>
            </div>

            {/* 구매 링크 */}
            <div>
              <label
                htmlFor="purchaseUrl"
                className="block text-sm font-medium text-neutral-700 mb-2"
              >
                구매 링크
              </label>
              <input
                type="url"
                id="purchaseUrl"
                name="purchaseUrl"
                value={form.purchaseUrl}
                onChange={handleChange}
                placeholder="https://smartstore.naver.com/..."
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-neutral-900 placeholder-neutral-400 transition-colors"
                autoComplete="url"
              />
              <p className="mt-1 text-xs text-neutral-500">
                스마트스토어, 쿠팡, 공식몰 등 구매 가능한 URL을 입력하세요.
              </p>
            </div>

            {/* 할인 정보 */}
            <div>
              <label
                htmlFor="discountInfo"
                className="block text-sm font-medium text-neutral-700 mb-2"
              >
                할인/혜택
              </label>
              <input
                type="text"
                id="discountInfo"
                name="discountInfo"
                value={form.discountInfo}
                onChange={handleChange}
                placeholder="예: 정가 25,000원 → 18,900원 (24% 할인)"
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-neutral-900 placeholder-neutral-400 transition-colors"
                maxLength={200}
                autoComplete="off"
              />
            </div>

            {/* 인스타그램 URL */}
            <div>
              <label
                htmlFor="instagramUrl"
                className="block text-sm font-medium text-neutral-700 mb-2"
              >
                인스타그램 URL
              </label>
              <input
                type="url"
                id="instagramUrl"
                name="instagramUrl"
                value={form.instagramUrl}
                onChange={handleChange}
                placeholder="https://www.instagram.com/p/ABC123/"
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-neutral-900 placeholder-neutral-400 transition-colors"
                autoComplete="url"
              />
              <p className="mt-1 text-xs text-neutral-500">
                공동구매 원본 게시물 URL을 입력하세요.
              </p>
            </div>

            {/* 이미지 URL */}
            <div>
              <label
                htmlFor="imageUrls"
                className="block text-sm font-medium text-neutral-700 mb-2"
              >
                대표 이미지 URL
              </label>
              <input
                type="url"
                id="imageUrls"
                name="imageUrls"
                value={form.imageUrls}
                onChange={handleChange}
                placeholder="https://example.com/image.jpg"
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-neutral-900 placeholder-neutral-400 transition-colors"
                autoComplete="url"
              />
              <p className="mt-1 text-xs text-neutral-500">
                게시물의 대표 이미지 URL 하나만 입력하세요. (추후 다중 이미지 지원 예정)
              </p>
            </div>

            {/* 요약 */}
            <div>
              <label
                htmlFor="summary"
                className="block text-sm font-medium text-neutral-700 mb-2"
              >
                한 줄 요약
              </label>
              <textarea
                id="summary"
                name="summary"
                value={form.summary}
                onChange={handleChange}
                rows={4}
                placeholder="예: 버터 향 가득한 정통 크로와상, 냉동 보관 가능"
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-neutral-900 placeholder-neutral-400 transition-colors resize-none"
                maxLength={500}
              />
              <p className="mt-1 text-xs text-neutral-500 text-right">
                {form.summary.length}/500자
              </p>
            </div>

            {/* Submit Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-neutral-100">
              <button
                type="submit"
                disabled={isDispatched}
                className="flex-1 py-3.5 px-6 bg-primary-700 text-white font-semibold rounded-2xl shadow-sm hover:bg-primary-800 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-center"
              >
                {isDispatched ? "제출 중..." : "제보 제출"}
              </button>
              <Link
                href="/"
                className="flex-1 py-3.5 px-6 bg-neutral-0 text-neutral-800 font-semibold rounded-2xl border border-neutral-200 hover:bg-neutral-50 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors text-center"
              >
                취소
              </Link>
            </div>
          </div>
        </form>

        {/* Info Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-neutral-500 mb-2">
            제보하신 내용은 운영자 검수 후 승인되면 캘린더에 반영됩니다.
          </p>
          <p className="text-sm text-neutral-500">
            익명으로 처리되며, 연락처는 별도 수집하지 않습니다.
          </p>
        </div>
      </div>
    </div>
  );
}