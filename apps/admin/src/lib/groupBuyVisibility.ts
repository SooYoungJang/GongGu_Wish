import type { GroupBuyStatus } from "@/types";

export function getGroupBuyVisibility(status: GroupBuyStatus) {
  const isHidden = status === "REJECTED";

  return {
    isHidden,
    canHide: !isHidden,
    canShow: isHidden,
  };
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
