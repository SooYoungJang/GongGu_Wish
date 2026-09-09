import { postgrestPost } from "../../lib/postgrest-client";

export const REPORT_REASONS = [
  { value: "PRICE", label: "가격이 달라요" },
  { value: "SOLD_OUT", label: "품절됐어요" },
  { value: "ENDED", label: "공구가 종료됐어요" },
  { value: "LINK", label: "구매 링크가 열리지 않아요" },
] as const;
export type ProductReportReason = typeof REPORT_REASONS[number]["value"];

export async function submitProductReport(userId: string, groupBuyId: string, reason: ProductReportReason) {
  const data = await postgrestPost<unknown>("rpc/submit_product_report", {
    p_expected_user_id: userId, p_group_buy_id: groupBuyId, p_reason: reason,
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (!row || typeof row.id !== "string" || row.status !== "OPEN") {
    throw new Error("신고 접수 결과를 확인하지 못했어요. 다시 시도해 주세요.");
  }
  return { id: row.id as string, status: "OPEN" as const };
}
