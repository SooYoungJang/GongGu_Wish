import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  collectPushCandidateRows,
  selectPushRecipientTokens,
} from "./pushNotifications.ts";

Deno.test("paginates every push candidate beyond the Supabase row limit", async () => {
  const rows = Array.from({ length: 501 }, (_, index) => ({
    id: `user-${String(index).padStart(4, "0")}`,
    push_token: `ExpoPushToken[token-${index}]`,
    push_enabled: true,
  }));
  const requestedRanges: Array<[number, number]> = [];
  const builder = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    not() {
      return this;
    },
    in() {
      return this;
    },
    order() {
      return this;
    },
    range(from: number, to: number) {
      requestedRanges.push([from, to]);
      return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
    },
  };
  const supabase = { from: () => builder };

  const result = await collectPushCandidateRows(
    supabase as never,
    null,
  );

  assertEquals(result.length, 501);
  assertEquals(requestedRanges, [[0, 499], [500, 999]]);
});

Deno.test("fails closed when one Expo token is owned by multiple users", () => {
  const result = selectPushRecipientTokens(
    [
      {
        id: "old-user",
        push_token: "ExpoPushToken[shared]",
        push_enabled: true,
      },
      {
        id: "current-user",
        push_token: "ExpoPushToken[shared]",
        push_enabled: true,
      },
      {
        id: "unique-user",
        push_token: "ExpoPushToken[unique]",
        push_enabled: true,
      },
    ],
    { type: "general" },
  );

  assertEquals(result.candidateTokens, [
    "ExpoPushToken[shared]",
    "ExpoPushToken[unique]",
  ]);
  assertEquals(result.tokens, ["ExpoPushToken[unique]"]);
  assertEquals(result.duplicateTokens, 1);
});
