import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { safeStorageFailure } from "./storageFailure.ts";
Deno.test("keeps protocol identifiers but excludes server details and credentials", () => {
  assertEquals(safeStorageFailure({ code: "42702", message: "SQL detail containing private input" }, 400), { storageCode: "42702", storageStatus: 400 });
  assertEquals(safeStorageFailure({ code: "PGRST000" }, 503), { storageCode: "PGRST000", storageStatus: 503 });
  assertEquals(safeStorageFailure({ code: "secret@example.test", message: "private text" }, 999), { storageCode: "OTHER", storageStatus: 0 });
  assertEquals(safeStorageFailure({ message: "Invalid API key: private-token" }, 401), { storageCode: "API_KEY_REJECTED", storageStatus: 401 });
});
