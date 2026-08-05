export type AdminGroupBuyRequestStatus = "OPEN" | "FULFILLED" | "HIDDEN";

export type AdminGroupBuyRequest = {
  id: string;
  productName: string;
  status: AdminGroupBuyRequestStatus;
  requestCount: number;
  createdAt: string;
  latestRequestedAt: string | null;
};

export type AdminGroupBuyRequestList = {
  items: AdminGroupBuyRequest[];
  total: number;
};

export class AdminGroupBuyRequestContractError extends Error {
  constructor() {
    super("공구 요청 목록 응답이 올바르지 않습니다.");
    this.name = "AdminGroupBuyRequestContractError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AdminGroupBuyRequestContractError();
  }
  return value;
}

function requiredDate(value: unknown) {
  const date = requiredString(value);
  if (Number.isNaN(Date.parse(date))) {
    throw new AdminGroupBuyRequestContractError();
  }
  return date;
}

function optionalDate(value: unknown): string | null {
  return value === null ? null : requiredDate(value);
}

function requiredStatus(value: unknown): AdminGroupBuyRequestStatus {
  if (value === "OPEN" || value === "FULFILLED" || value === "HIDDEN") {
    return value;
  }
  throw new AdminGroupBuyRequestContractError();
}

export function mapAdminGroupBuyRequest(
  row: Record<string, unknown>,
): AdminGroupBuyRequest {
  if (
    typeof row.requestCount !== "number" ||
    !Number.isInteger(row.requestCount) ||
    row.requestCount < 0
  ) {
    throw new AdminGroupBuyRequestContractError();
  }
  return {
    id: requiredString(row.id),
    productName: requiredString(row.productName),
    status: requiredStatus(row.status),
    requestCount: row.requestCount,
    createdAt: requiredDate(row.createdAt),
    latestRequestedAt: optionalDate(row.latestRequestedAt),
  };
}

export function mapAdminGroupBuyRequestList(
  value: unknown,
): AdminGroupBuyRequestList {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new AdminGroupBuyRequestContractError();
  }
  if (
    typeof value.total !== "number" ||
    !Number.isInteger(value.total) ||
    value.total < 0
  ) {
    throw new AdminGroupBuyRequestContractError();
  }

  return {
    items: value.items.map((item) => {
      if (!isRecord(item)) throw new AdminGroupBuyRequestContractError();
      return mapAdminGroupBuyRequest(item);
    }),
    total: value.total,
  };
}
