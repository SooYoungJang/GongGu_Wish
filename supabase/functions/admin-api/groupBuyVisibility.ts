export type GroupBuyStatusFilter =
  | { kind: "all" }
  | { kind: "status"; value: string }
  | {
      kind: "visible";
      status: "APPROVED";
      endDate: { operator: "gte"; value: string };
    }
  | {
      kind: "expired";
      explicitStatus: "EXPIRED";
      approvedStatus: "APPROVED";
      endDate: { operator: "lt"; value: string };
    };

export function koreaCalendarDate(
  value: Date | string = new Date(),
): string | null {
  const instant = new Date(value instanceof Date ? value.getTime() : value);
  if (Number.isNaN(instant.getTime())) return null;

  return new Date(instant.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export function buildGroupBuyFilterExpression(
  conditions: string[],
  query: string | null,
) {
  if (!query) return conditions.join(",");

  const searchConditions = [
    `product_name.ilike.%${query}%`,
    `brand_name.ilike.%${query}%`,
  ];
  return conditions
    .flatMap((condition) =>
      searchConditions.map((searchCondition) => {
        const innerCondition =
          condition.startsWith("and(") && condition.endsWith(")")
            ? condition.slice(4, -1)
            : condition;
        return `and(${innerCondition},${searchCondition})`;
      }),
    )
    .join(",");
}

export function getGroupBuyStatusFilter(
  status: string | null | undefined,
  today: string,
): GroupBuyStatusFilter {
  if (!status || status === "ALL") return { kind: "all" };

  if (status === "APPROVED") {
    return {
      kind: "visible",
      status: "APPROVED",
      endDate: { operator: "gte", value: today },
    };
  }

  if (status === "EXPIRED") {
    return {
      kind: "expired",
      explicitStatus: "EXPIRED",
      approvedStatus: "APPROVED",
      endDate: { operator: "lt", value: today },
    };
  }

  return { kind: "status", value: status };
}
