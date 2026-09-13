import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveServerKey } from "./serverKey.ts";

Deno.test("prefers the provisioned secret key over a rejected legacy JWT", () => {
  const values: Record<string, string> = {
    SUPABASE_SECRET_KEYS: JSON.stringify({ default: "sb_secret_test", other: "sb_secret_other" }),
    SUPABASE_SERVICE_ROLE_KEY: "expired.legacy.jwt",
  };
  assertEquals(resolveServerKey(name => values[name]), "sb_secret_test");
});

Deno.test("supports legacy-only local environments and fails closed on bad configuration", () => {
  assertEquals(resolveServerKey(name => name === "SUPABASE_SERVICE_ROLE_KEY" ? "local.service.jwt" : undefined), "local.service.jwt");
  assertThrows(() => resolveServerKey(() => undefined));
  for (const dictionary of ["invalid", "null", "[]", "{}", '{"default":1}', '{"default":"anon-key"}']) {
    assertThrows(() => resolveServerKey(name => name === "SUPABASE_SECRET_KEYS" ? dictionary : "legacy.jwt"), Error, "Invalid server key configuration");
  }
});
