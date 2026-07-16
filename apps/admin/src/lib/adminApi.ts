import { supabase } from "@/supabase/client";
import type {
  AppUser,
  CdnRefreshResult,
  CdnRefreshStatusResponse,
  DashboardResponse,
  GongguSubmission,
  GroupBuy,
  HikerLookupResult,
  ListResponse,
  PushNotificationInput,
  PushNotificationResult,
} from "@/types";
import { normalizePersistedPriceKrwValue } from "./priceKrw";

type AdminMethod = "GET" | "POST" | "PATCH" | "DELETE";

type AdminEnvelope<T> =
  | {
      data: T;
      error?: never;
    }
  | {
      data?: never;
      error: string;
    };

export class AdminApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

export class AdminApiContractError extends Error {
  constructor(message: string) {
    super(`관리자 API 가격 계약 오류: ${message}`);
    this.name = "AdminApiContractError";
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new AdminApiError(error.message, 401);
  const token = data.session?.access_token;
  if (!token) throw new AdminApiError("관리자 로그인이 필요합니다.", 401);
  return token;
}

async function requestAdmin<T>(
  path: string,
  method: AdminMethod,
  options: {
    params?: Record<string, string | number | boolean | null | undefined>;
    body?: Record<string, unknown>;
  } = {},
): Promise<T> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new AdminApiError(
      "Vercel 환경 변수 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY가 필요합니다.",
      500,
    );
  }

  const token = await getAccessToken();
  const response = await fetch(`${supabaseUrl}/functions/v1/admin-api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({
      path,
      method,
      params: options.params ?? {},
      body: options.body ?? {},
    }),
  });

  const payload = (await response
    .json()
    .catch(() => null)) as AdminEnvelope<T> | null;
  if (!response.ok || !payload || "error" in payload) {
    throw new AdminApiError(
      payload?.error ?? `관리자 API 요청에 실패했습니다. (${response.status})`,
      response.status,
    );
  }

  return payload.data;
}

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizePersistedGroupBuyPrice(raw: Record<string, unknown>) {
  const hasCamelPrice = hasOwn(raw, "priceKrw");
  const hasSnakePrice = hasOwn(raw, "price_krw");
  if (!hasCamelPrice && !hasSnakePrice) {
    throw new AdminApiContractError("priceKrw 필드가 응답에서 누락되었습니다.");
  }

  let camelPrice: number | null | undefined;
  let snakePrice: number | null | undefined;
  try {
    if (hasCamelPrice) {
      camelPrice = normalizePersistedPriceKrwValue(raw.priceKrw);
    }
    if (hasSnakePrice) {
      snakePrice = normalizePersistedPriceKrwValue(raw.price_krw);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "유효하지 않은 가격";
    throw new AdminApiContractError(message);
  }

  if (hasCamelPrice && hasSnakePrice && camelPrice !== snakePrice) {
    throw new AdminApiContractError(
      "priceKrw와 price_krw가 서로 다른 값을 가리킵니다.",
    );
  }

  return camelPrice ?? snakePrice ?? null;
}

export function normalizeGroupBuyResponse(groupBuy: unknown): GroupBuy {
  if (!isRecord(groupBuy)) {
    throw new AdminApiContractError("공구 응답이 객체가 아닙니다.");
  }

  const rawPrice = normalizePersistedGroupBuyPrice(groupBuy);
  const rawIsHomeBanner =
    groupBuy.isHomeBanner !== undefined
      ? groupBuy.isHomeBanner
      : groupBuy.is_home_banner;
  const rawStartDate =
    groupBuy.homeBannerStartDate !== undefined
      ? groupBuy.homeBannerStartDate
      : groupBuy.home_banner_start_date;
  const rawEndDate =
    groupBuy.homeBannerEndDate !== undefined
      ? groupBuy.homeBannerEndDate
      : groupBuy.home_banner_end_date;
  const { price_krw: _legacyPrice, ...canonicalGroupBuy } = groupBuy;
  return {
    ...canonicalGroupBuy,
    priceKrw: rawPrice,
    isHomeBanner: rawIsHomeBanner === true,
    homeBannerStartDate: typeof rawStartDate === "string" ? rawStartDate : null,
    homeBannerEndDate: typeof rawEndDate === "string" ? rawEndDate : null,
  } as GroupBuy;
}

function normalizeGroupBuyListResponse(
  result: unknown,
): ListResponse<GroupBuy> {
  if (!isRecord(result) || !Array.isArray(result.items)) {
    throw new AdminApiContractError(
      "공구 목록 응답의 items가 배열이 아닙니다.",
    );
  }
  if (
    typeof result.total !== "number" ||
    !Number.isInteger(result.total) ||
    result.total < 0
  ) {
    throw new AdminApiContractError(
      "공구 목록 응답의 total이 유효하지 않습니다.",
    );
  }

  return {
    ...result,
    items: result.items.map(normalizeGroupBuyResponse),
  } as ListResponse<GroupBuy>;
}

export const adminApi = {
  dashboard() {
    return requestAdmin<DashboardResponse>("/admin/dashboard", "GET");
  },

  listSubmissions(params: {
    page?: number;
    limit?: number;
    status?: string;
    q?: string;
  }) {
    return requestAdmin<ListResponse<GongguSubmission>>(
      "/admin/submissions",
      "GET",
      { params },
    );
  },

  updateSubmission(id: string, body: Record<string, unknown>) {
    return requestAdmin<GongguSubmission>(`/admin/submissions/${id}`, "PATCH", {
      body,
    });
  },

  approveSubmission(id: string, body: Record<string, unknown>) {
    return requestAdmin<{ submission: GongguSubmission; groupBuy: GroupBuy }>(
      `/admin/submissions/${id}/approve`,
      "POST",
      { body },
    ).then((result) => ({
      ...result,
      groupBuy: normalizeGroupBuyResponse(result.groupBuy),
    }));
  },

  rejectSubmission(id: string, reason: string) {
    return requestAdmin<GongguSubmission>(
      `/admin/submissions/${id}/reject`,
      "POST",
      {
        body: { reason },
      },
    );
  },

  listGroupBuys(params: {
    page?: number;
    limit?: number;
    status?: string;
    q?: string;
  }) {
    return requestAdmin<ListResponse<GroupBuy>>("/admin/group-buys", "GET", {
      params,
    }).then(normalizeGroupBuyListResponse);
  },

  updateGroupBuy(id: string, body: Record<string, unknown>) {
    return requestAdmin<GroupBuy>(`/admin/group-buys/${id}`, "PATCH", {
      body,
    }).then(normalizeGroupBuyResponse);
  },

  lookupHiker(url: string) {
    return requestAdmin<HikerLookupResult>("/admin/hiker-lookup", "POST", {
      body: { url },
    });
  },

  listUsers(params: { page?: number; limit?: number; q?: string }) {
    return requestAdmin<ListResponse<AppUser>>("/admin/users", "GET", {
      params,
    });
  },

  updateUser(id: string, body: Record<string, unknown>) {
    return requestAdmin<AppUser>(`/admin/users/${id}`, "PATCH", { body });
  },

  sendPushNotification(input: PushNotificationInput) {
    return requestAdmin<PushNotificationResult>(
      "/admin/notifications",
      "POST",
      {
        body: { ...input },
      },
    );
  },

  cdnRefreshStatus(params: {
    limit?: number;
    status?: string | null;
    refreshWindowHours?: number;
  }) {
    return requestAdmin<CdnRefreshStatusResponse>("/admin/cdn-refresh", "GET", {
      params,
    });
  },

  refreshSingleCdn(groupBuyId: string, force = false) {
    return requestAdmin<CdnRefreshResult>("/admin/cdn-refresh", "POST", {
      body: { groupBuyId, force },
    });
  },

  refreshBatchCdn(limit = 20, refreshWindowHours = 1) {
    return requestAdmin<{ results: CdnRefreshResult[] }>(
      "/admin/cdn-refresh",
      "POST",
      {
        body: { mode: "batch", limit, refreshWindowHours },
      },
    );
  },
};
