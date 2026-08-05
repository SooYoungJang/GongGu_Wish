import { notFound } from "next/navigation";
import Link from "next/link";
import { groupBuySchema, type GroupBuy } from "@gonggu/shared/schemas";

const DEFAULT_API_URL = "http://localhost:3003";
const APP_SCHEME = "gongguwish://";

function getApiBaseUrl() {
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(
    /\/$/,
    "",
  );
  return baseUrl.endsWith("/api/v1") ? baseUrl : `${baseUrl}/api/v1`;
}

async function fetchGroupBuy(groupBuyId: string): Promise<GroupBuy | null> {
  try {
    const response = await fetch(
      `${getApiBaseUrl()}/group-buys/${encodeURIComponent(groupBuyId)}`,
      { cache: "no-store" },
    );
    if (!response.ok) return null;

    const result = groupBuySchema.safeParse(await response.json());
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function formatDate(value: string | null) {
  const match = value?.match(/^\d{4}-(\d{2})-(\d{2})/);
  if (!match) return null;
  return `${Number(match[1])}월 ${Number(match[2])}일`;
}

function formatDateRange(groupBuy: GroupBuy) {
  const startDate = formatDate(groupBuy.startDate);
  const endDate = formatDate(groupBuy.endDate);
  if (!startDate || !endDate) return "기간 미정";
  return `${startDate} ~ ${endDate}`;
}

function getSafePurchaseUrl(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

export default async function GroupBuySharePage({
  params,
}: {
  params: Promise<{ groupBuyId: string }>;
}) {
  const { groupBuyId } = await params;
  if (!groupBuySchema.shape.id.safeParse(groupBuyId).success) notFound();

  const groupBuy = await fetchGroupBuy(groupBuyId);
  if (!groupBuy) notFound();

  const appUrl = `${APP_SCHEME}group-buy/${encodeURIComponent(groupBuy.id)}`;
  const purchaseUrl = getSafePurchaseUrl(groupBuy.purchaseUrl);

  return (
    <main className="min-h-[70vh] bg-neutral-50 px-6 py-16">
      <article className="mx-auto max-w-2xl rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm sm:p-10">
        <p className="text-sm font-semibold text-primary-700">GongGu Wish 공구</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-neutral-900">
          {groupBuy.productName ?? "공동구매"}
        </h1>
        {groupBuy.brandName && (
          <p className="mt-2 text-base font-medium text-neutral-600">
            {groupBuy.brandName}
          </p>
        )}
        <p className="mt-6 rounded-2xl bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">
          {formatDateRange(groupBuy)}
        </p>
        {groupBuy.summary && (
          <p className="mt-6 whitespace-pre-wrap leading-relaxed text-neutral-700">
            {groupBuy.summary}
          </p>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={appUrl}
            className="inline-flex items-center justify-center rounded-full bg-primary-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-800"
          >
            앱에서 열기
          </a>
          {purchaseUrl && (
            <a
              href={purchaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-neutral-300 px-5 py-3 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
            >
              구매 페이지 열기
            </a>
          )}
          <Link
            href="/calendar"
            className="inline-flex items-center justify-center rounded-full border border-neutral-300 px-5 py-3 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
          >
            캘린더 보기
          </Link>
        </div>
      </article>
    </main>
  );
}
