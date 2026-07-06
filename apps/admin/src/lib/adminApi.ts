import { supabase } from "@/supabase/client";
import type {
  DashboardResponse,
  GongguSubmission,
  GroupBuy,
  HikerLookupResult,
  ListResponse,
} from "@/types";

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

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

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
    throw new AdminApiError("Vercel 환경 변수 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY가 필요합니다.", 500);
  }

  const token = await getAccessToken();
  const response = await fetch(`${supabaseUrl}/functions/v1/admin-api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "apikey": supabaseAnonKey,
    },
    body: JSON.stringify({
      path,
      method,
      params: options.params ?? {},
      body: options.body ?? {},
    }),
  });

  const payload = (await response.json().catch(() => null)) as AdminEnvelope<T> | null;
  if (!response.ok || !payload || "error" in payload) {
    throw new AdminApiError(payload?.error ?? `관리자 API 요청에 실패했습니다. (${response.status})`, response.status);
  }

  return payload.data;
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
    return requestAdmin<ListResponse<GongguSubmission>>("/admin/submissions", "GET", { params });
  },

  updateSubmission(id: string, body: Record<string, unknown>) {
    return requestAdmin<GongguSubmission>(`/admin/submissions/${id}`, "PATCH", { body });
  },

  approveSubmission(id: string, body: Record<string, unknown>) {
    return requestAdmin<{ submission: GongguSubmission; groupBuy: GroupBuy }>(
      `/admin/submissions/${id}/approve`,
      "POST",
      { body },
    );
  },

  rejectSubmission(id: string, reason: string) {
    return requestAdmin<GongguSubmission>(`/admin/submissions/${id}/reject`, "POST", {
      body: { reason },
    });
  },

  listGroupBuys(params: {
    page?: number;
    limit?: number;
    status?: string;
    q?: string;
  }) {
    return requestAdmin<ListResponse<GroupBuy>>("/admin/group-buys", "GET", { params });
  },

  updateGroupBuy(id: string, body: Record<string, unknown>) {
    return requestAdmin<GroupBuy>(`/admin/group-buys/${id}`, "PATCH", { body });
  },

  lookupHiker(url: string) {
    return requestAdmin<HikerLookupResult>("/admin/hiker-lookup", "POST", {
      body: { url },
    });
  },
};
