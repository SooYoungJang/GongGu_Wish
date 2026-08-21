import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildGroupBuyFilterExpression,
  getGroupBuyStatusFilter,
  koreaCalendarDate,
} from "./groupBuyVisibility.ts";

Deno.test("uses the Korean calendar date at the exposure boundary", () => {
  assertEquals(koreaCalendarDate("2026-08-21T14:59:59.999Z"), "2026-08-21");
  assertEquals(koreaCalendarDate("2026-08-21T15:00:00.000Z"), "2026-08-22");
});

Deno.test(
  "keeps the search constraint combined with exposure constraints",
  () => {
    assertEquals(
      buildGroupBuyFilterExpression(
        ["end_date.gte.2026-08-22", "end_date.is.null"],
        "머그컵",
      ),
      "and(end_date.gte.2026-08-22,product_name.ilike.%머그컵%),and(end_date.gte.2026-08-22,brand_name.ilike.%머그컵%),and(end_date.is.null,product_name.ilike.%머그컵%),and(end_date.is.null,brand_name.ilike.%머그컵%)",
    );
  },
);

Deno.test(
  "limits the 노출중 filter to approved group buys through today",
  () => {
    assertEquals(getGroupBuyStatusFilter("APPROVED", "2026-08-22"), {
      kind: "visible",
      status: "APPROVED",
      endDate: { operator: "gte", value: "2026-08-22" },
    });
  },
);

Deno.test(
  "includes date-derived and explicit expired statuses in the 만료 filter",
  () => {
    assertEquals(getGroupBuyStatusFilter("EXPIRED", "2026-08-22"), {
      kind: "expired",
      explicitStatus: "EXPIRED",
      approvedStatus: "APPROVED",
      endDate: { operator: "lt", value: "2026-08-22" },
    });
  },
);

Deno.test("keeps non-exposure status filters unchanged", () => {
  assertEquals(getGroupBuyStatusFilter("REVIEW_REQUIRED", "2026-08-22"), {
    kind: "status",
    value: "REVIEW_REQUIRED",
  });
  assertEquals(getGroupBuyStatusFilter(undefined, "2026-08-22"), {
    kind: "all",
  });
});
