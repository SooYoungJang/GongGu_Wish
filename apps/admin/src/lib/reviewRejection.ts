export function reviewRejectionReason(value: string) {
  return value.trim() || "관리자 반려";
}

export function isReviewRejectDisabled(
  actionLoading: boolean,
  reviewPending: boolean,
) {
  return actionLoading || !reviewPending;
}
