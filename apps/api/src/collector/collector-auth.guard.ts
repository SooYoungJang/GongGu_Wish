import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, timingSafeEqual } from "node:crypto";

type CollectorRequest = {
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function sameToken(expected: string, actual: string | undefined) {
  if (!actual) return false;
  return timingSafeEqual(digest(expected), digest(actual));
}

function providedToken(request: CollectorRequest) {
  const rawHeader = request.headers?.["x-collector-token"];
  return Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
}

@Injectable()
export class CollectorAuthGuard implements CanActivate {
  constructor(protected readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<CollectorRequest>();
    const configuredToken = this.configService.get<string>(
      "INSTAGRAM_COLLECTOR_TOKEN",
    );
    const provided = providedToken(request);
    const source =
      request.body &&
      typeof request.body === "object" &&
      "collectionSource" in request.body
        ? request.body.collectionSource
        : undefined;

    if (source === "MANUAL_DISCOVERY") {
      throw new UnauthorizedException(
        "수동 발견 게시물은 인증된 관리자 API로만 등록할 수 있습니다.",
      );
    }

    // The legacy instagrapi path remains compatible before a collector token
    // is configured. Playwright ingestion and all internal endpoints still
    // require an explicit token.
    if (!configuredToken && source !== "PLAYWRIGHT_PUBLIC") return true;

    if (!configuredToken || !sameToken(configuredToken, provided)) {
      throw new UnauthorizedException("collector 인증이 필요합니다.");
    }

    return true;
  }
}

@Injectable()
export class StrictCollectorAuthGuard extends CollectorAuthGuard {
  constructor(configService: ConfigService) {
    super(configService);
  }

  override canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<CollectorRequest>();
    const source =
      request.body &&
      typeof request.body === "object" &&
      "collectionSource" in request.body
        ? request.body.collectionSource
        : undefined;
    if (source === "MANUAL_DISCOVERY") {
      throw new UnauthorizedException(
        "수동 발견 게시물은 인증된 관리자 API로만 등록할 수 있습니다.",
      );
    }

    const configuredToken = this.configService.get<string>(
      "INSTAGRAM_COLLECTOR_TOKEN",
    );
    if (
      !configuredToken ||
      !sameToken(configuredToken, providedToken(request))
    ) {
      throw new UnauthorizedException("collector 인증이 필요합니다.");
    }
    return true;
  }
}
