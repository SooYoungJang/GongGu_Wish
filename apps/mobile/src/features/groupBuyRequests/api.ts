import { ApiError } from "../../lib/api-types";
import { postgrestFetch } from "../../lib/postgrest-client";
import { getSupabase } from "../../lib/supabase";
import { getSessionId } from "../../utils/session";
import type { GroupBuyRequestRanking, GroupBuyRequestResult } from "./types";

export class GroupBuyRequestSessionUnavailableError extends Error {
  readonly code = "GROUP_BUY_REQUEST_SESSION_UNAVAILABLE";

  constructor() {
    super("익명 행동 집계가 허용되지 않아 공구를 요청할 수 없습니다.");
    this.name = "GroupBuyRequestSessionUnavailableError";
  }
}

export class GroupBuyRequestResponseError extends Error {
  readonly code = "GROUP_BUY_REQUEST_RESPONSE_INVALID";

  constructor() {
    super("공구 요청 응답 형식이 올바르지 않습니다.");
    this.name = "GroupBuyRequestResponseError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function parseRequestResult(value: unknown): GroupBuyRequestResult {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.request_id) ||
    !isNonEmptyString(value.product_name) ||
    !isPositiveInteger(value.request_count) ||
    typeof value.already_requested !== "boolean" ||
    typeof value.ranking_eligible !== "boolean"
  ) {
    throw new GroupBuyRequestResponseError();
  }

  return {
    requestId: value.request_id,
    productName: value.product_name,
    requestCount: value.request_count,
    alreadyRequested: value.already_requested,
    rankingEligible: value.ranking_eligible,
  };
}

function parseRanking(value: unknown): GroupBuyRequestRanking {
  if (
    !isRecord(value) ||
    !isPositiveInteger(value.rank) ||
    !isNonEmptyString(value.request_id) ||
    !isNonEmptyString(value.product_name) ||
    !isPositiveInteger(value.request_count)
  ) {
    throw new GroupBuyRequestResponseError();
  }

  return {
    rank: value.rank,
    requestId: value.request_id,
    productName: value.product_name,
    requestCount: value.request_count,
  };
}

async function mapEdgeFunctionError(error: unknown): Promise<ApiError> {
  let status = 0;
  let message = "공구 요청에 실패했습니다.";

  if (isRecord(error)) {
    if (isNonEmptyString(error.message)) message = error.message;

    const context = error.context;
    if (isRecord(context)) {
      if (typeof context.status === "number") status = context.status;

      if (typeof context.json === "function") {
        try {
          const body = await context.json.call(context);
          if (isRecord(body) && isNonEmptyString(body.error)) {
            message = body.error;
          }
        } catch {
          // Keep the SDK error message when the Edge response is not JSON.
        }
      }
    }
  }

  return new ApiError(status, message);
}

export async function requestGroupBuy(
  productName: string,
): Promise<GroupBuyRequestResult> {
  const sessionId = await getSessionId();
  if (!sessionId) {
    throw new GroupBuyRequestSessionUnavailableError();
  }

  const { data, error } = await getSupabase().functions.invoke<unknown>(
    "group-buy-request",
    {
      body: {
        product_name: productName,
        session_id: sessionId,
      },
    },
  );

  if (error) {
    throw await mapEdgeFunctionError(error);
  }

  if (!data) {
    throw new GroupBuyRequestResponseError();
  }

  return parseRequestResult(data);
}

export async function fetchGroupBuyRequestRankings(): Promise<
  GroupBuyRequestRanking[]
> {
  const { data } = await postgrestFetch<unknown>(
    "rpc/get_group_buy_request_rankings",
    {
      method: "POST",
      body: { p_limit_count: 3 },
    },
  );

  if (!Array.isArray(data)) {
    throw new GroupBuyRequestResponseError();
  }

  return data.map(parseRanking);
}
