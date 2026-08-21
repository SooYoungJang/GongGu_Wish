import type { GroupBuyStatus } from "@/types";

export function getGroupBuyVisibility(status: GroupBuyStatus) {
  const isHidden = status === "REJECTED";

  return {
    isHidden,
    canHide: !isHidden,
    canShow: isHidden,
  };
}

export type GroupBuyListStatus = {
  status: GroupBuyStatus;
  label?: string;
};

function isPastEndDate(endDate: string | null | undefined, date: Date) {
  if (!endDate) return false;

  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return false;

  const endOfDay = new Date(end);
  endOfDay.setHours(23, 59, 59, 999);

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  return endOfDay < startOfDay;
}

export function getGroupBuyListStatus(
  status: GroupBuyStatus,
  endDate: string | null | undefined,
  date: Date = new Date(),
): GroupBuyListStatus {
  if (status !== "APPROVED") return { status };

  if (isPastEndDate(endDate, date)) {
    return { status: "EXPIRED", label: "노출 기간 만료" };
  }

  return { status: "APPROVED", label: "노출중" };
}

export function groupBuyStatusForVisibility(hide: boolean): GroupBuyStatus {
  return hide ? "REJECTED" : "APPROVED";
}

export function shouldReturnToGroupBuyList(
  activeFilter: "ALL" | GroupBuyStatus,
  nextStatus: GroupBuyStatus,
): boolean {
  return activeFilter !== "ALL" && activeFilter !== nextStatus;
}
