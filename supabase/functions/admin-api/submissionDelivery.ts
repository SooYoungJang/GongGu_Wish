export type SubmissionNotificationDeliveryStatus =
  | "NOT_STARTED"
  | "NO_RECIPIENTS"
  | "PENDING"
  | "SENT"
  | "PARTIAL"
  | "SKIPPED"
  | "FAILED";

export type SubmissionNotificationDelivery = {
  status: SubmissionNotificationDeliveryStatus;
  linkedSubmitterCount: number;
  pendingCount: number;
  processingCount: number;
  sentCount: number;
  skippedCount: number;
  retryingCount: number;
  failedCount: number;
};

export function getSubmissionNotificationDeliveryStatus(
  delivery: Omit<SubmissionNotificationDelivery, "status">,
): SubmissionNotificationDeliveryStatus {
  const active =
    delivery.pendingCount + delivery.processingCount + delivery.retryingCount;
  const completed =
    delivery.sentCount + delivery.skippedCount + delivery.failedCount;
  if (delivery.linkedSubmitterCount === 0) return "NO_RECIPIENTS";
  if (active + completed === 0) return "NOT_STARTED";
  if (active > 0) return "PENDING";
  if (delivery.failedCount > 0 && completed > delivery.failedCount) {
    return "PARTIAL";
  }
  if (delivery.failedCount > 0) return "FAILED";
  if (delivery.sentCount > 0 && delivery.skippedCount > 0) return "PARTIAL";
  if (delivery.sentCount > 0) return "SENT";
  return "SKIPPED";
}

export function mapSubmissionDelivery(row: Record<string, unknown>) {
  const delivery = {
    linkedSubmitterCount: Number(row.linked_submitter_count) || 0,
    pendingCount: Number(row.pending_count) || 0,
    processingCount: Number(row.processing_count) || 0,
    sentCount: Number(row.sent_count) || 0,
    skippedCount: Number(row.skipped_count) || 0,
    retryingCount: Number(row.retrying_count) || 0,
    failedCount: Number(row.failed_count) || 0,
  };
  return {
    ...delivery,
    status: getSubmissionNotificationDeliveryStatus(delivery),
  };
}
