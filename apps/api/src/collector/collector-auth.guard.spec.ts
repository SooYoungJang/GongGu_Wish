import { ExecutionContext, UnauthorizedException } from "@nestjs/common";

import {
  CollectorAuthGuard,
  StrictCollectorAuthGuard,
} from "./collector-auth.guard";

function contextFor(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
}

describe("collector auth guards", () => {
  it("keeps the legacy path compatible when no token is configured", () => {
    const guard = new CollectorAuthGuard({
      get: jest.fn().mockReturnValue(undefined),
    } as never);
    expect(guard.canActivate(contextFor({ body: {} }))).toBe(true);
  });

  it("rejects Playwright ingestion without a configured token", () => {
    const guard = new CollectorAuthGuard({
      get: jest.fn().mockReturnValue(undefined),
    } as never);
    expect(() =>
      guard.canActivate(
        contextFor({ body: { collectionSource: "PLAYWRIGHT_PUBLIC" } }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it("requires the exact token for internal endpoints", () => {
    const config = { get: jest.fn().mockReturnValue("collector-secret") };
    const guard = new StrictCollectorAuthGuard(config as never);
    expect(() => guard.canActivate(contextFor({ headers: {} }))).toThrow(
      UnauthorizedException,
    );
    expect(
      guard.canActivate(
        contextFor({ headers: { "x-collector-token": "collector-secret" } }),
      ),
    ).toBe(true);
  });
});
