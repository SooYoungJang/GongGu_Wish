import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveOptionalSubmissionUserId } from "./auth.ts";

Deno.test("keeps requests without Authorization as guest submissions", async () => {
  const userId = await resolveOptionalSubmissionUserId(null, {} as never);
  assertEquals(userId, null);
});

Deno.test("derives submitter identity from a verified bearer token", async () => {
  const userId = await resolveOptionalSubmissionUserId(
    "Bearer valid-token",
    {
      auth: {
        getUser: async (token: string) => ({
          data: { user: token === "valid-token" ? { id: "user-1" } : null },
          error: null,
        }),
      },
    } as never,
  );
  assertEquals(userId, "user-1");
});

Deno.test("rejects malformed and expired credentials instead of falling back", async () => {
  await assertRejects(
    () => resolveOptionalSubmissionUserId("Basic token", {} as never),
    Error,
    "인증 정보가 유효하지 않습니다.",
  );
  await assertRejects(
    () =>
      resolveOptionalSubmissionUserId("Bearer expired", {
        auth: {
          getUser: async () => ({
            data: { user: null },
            error: new Error("expired"),
          }),
        },
      } as never),
    Error,
    "인증 정보가 유효하지 않습니다.",
  );
});
