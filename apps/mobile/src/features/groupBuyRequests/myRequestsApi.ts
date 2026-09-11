import { postgrestFetch } from "../../lib/postgrest-client";
import { GroupBuyRequestResponseError } from "./api";

export type MyGroupBuyRequest = {
  id: string;
  productName: string;
  status: "OPEN" | "FULFILLED" | "HIDDEN";
  requestedAt: string;
  groupBuyId: string | null;
  notificationEnabled: boolean;
};
export type MyRequestCursor = { id: string; requestedAt: string };
export type MyRequestPage = { items: MyGroupBuyRequest[]; nextCursor: MyRequestCursor | null };

export async function fetchMyGroupBuyRequests(userId: string, cursor: MyRequestCursor | null = null): Promise<MyRequestPage> {
  const { data } = await postgrestFetch<unknown>("rpc/list_my_group_buy_requests_v2", {
    method: "POST",
    body: { p_expected_user_id: userId, p_after_requested_at: cursor?.requestedAt ?? null, p_after_id: cursor?.id ?? null, p_limit: 21 },
  });
  if (!Array.isArray(data) || data.length > 21) throw new GroupBuyRequestResponseError();
  const rows = data.map((row: unknown): MyGroupBuyRequest => {
    if (!row || typeof row !== "object") throw new GroupBuyRequestResponseError();
    const value = row as Record<string, unknown>;
    if (typeof value.request_id !== "string" || !value.request_id ||
      typeof value.product_name !== "string" || !value.product_name ||
      !["OPEN", "FULFILLED", "HIDDEN"].includes(String(value.status)) ||
      typeof value.requested_at !== "string" || Number.isNaN(Date.parse(value.requested_at)) ||
      (value.group_buy_id !== null && (typeof value.group_buy_id !== "string" || !value.group_buy_id)) || typeof value.notification_enabled !== "boolean") {
      throw new GroupBuyRequestResponseError();
    }
    return { id: value.request_id, productName: value.product_name, status: value.status as MyGroupBuyRequest["status"], requestedAt: value.requested_at, groupBuyId: value.group_buy_id as string | null, notificationEnabled: value.notification_enabled };
  });
  if (new Set(rows.map(row => row.id)).size !== rows.length || rows.some(row => row.id === cursor?.id)) throw new GroupBuyRequestResponseError();
  const items = rows.slice(0, 20);
  const last = items.at(-1);
  return { items, nextCursor: rows.length > 20 && last ? { id: last.id, requestedAt: last.requestedAt } : null };
}

export async function setMyRequestNotification(userId: string, requestId: string, enabled: boolean): Promise<boolean> {
  const { data } = await postgrestFetch<unknown>("rpc/set_my_request_notification", { method: "POST", body: { p_expected_user_id: userId, p_request_id: requestId, p_enabled: enabled } });
  if (data !== enabled) throw new GroupBuyRequestResponseError();
  return data;
}
