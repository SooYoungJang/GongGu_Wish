import { ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";

import { AdminRoleGuard } from "./admin-role.guard";

function contextFor(user?: { role?: string }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe("AdminRoleGuard", () => {
  const guard = new AdminRoleGuard();

  it("allows an admin API token", () => {
    expect(guard.canActivate(contextFor({ role: "admin" }))).toBe(true);
  });

  it("rejects authenticated non-admin tokens", () => {
    expect(() => guard.canActivate(contextFor({ role: "authenticated" }))).toThrow(
      ForbiddenException,
    );
  });

  it("rejects requests without an authenticated role", () => {
    expect(() => guard.canActivate(contextFor())).toThrow(ForbiddenException);
  });
});
