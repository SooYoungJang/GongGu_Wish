"""Playwright worker for explicitly enabled public Instagram accounts.

This worker intentionally uses browser-visible public pages only. It does not
call Instagram's private APIs, rotate proxies, or bypass login/challenge pages.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import json
import logging
import os
import random
from typing import Any, Callable

import requests
from apscheduler.schedulers.blocking import BlockingScheduler
from dotenv import load_dotenv
from playwright.sync_api import BrowserContext, Page, sync_playwright

try:
    from .public_parser import (
        blocked_page_reason,
        extract_profile_posts,
        normalize_username,
        parse_post_html,
    )
except ImportError:
    from public_parser import (
        blocked_page_reason,
        extract_profile_posts,
        normalize_username,
        parse_post_html,
    )

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("instagram-public-worker")


class PublicCollectionError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class PublicCollectionBlocked(PublicCollectionError):
    pass


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        value = default
    return max(minimum, min(maximum, value))


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def isoformat(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat()


def bounded_next_run(
    base_seconds: int,
    jitter_seconds: int,
    *,
    failure_count: int = 0,
    blocked: bool = False,
    rng: random.Random | Any = random,
    clock: Callable[[], datetime] = now_utc,
) -> datetime:
    backoff_multiplier = 2 ** min(max(failure_count, 0), 4) if (blocked or failure_count) else 1
    base = min(6 * 60 * 60, base_seconds * backoff_multiplier)
    jitter = rng.uniform(-jitter_seconds, jitter_seconds) if jitter_seconds else 0
    delay = max(60, base + jitter)
    return clock() + timedelta(seconds=delay)


def load_storage_state() -> dict[str, Any]:
    raw = os.getenv("INSTAGRAM_PLAYWRIGHT_STORAGE_STATE_JSON")
    if not raw:
        raise PublicCollectionError(
            "MISSING_STORAGE_STATE",
            "INSTAGRAM_PLAYWRIGHT_STORAGE_STATE_JSON이 설정되지 않았습니다.",
        )
    try:
        state = json.loads(raw)
    except json.JSONDecodeError as error:
        raise PublicCollectionError("INVALID_STORAGE_STATE", "storageState JSON이 유효하지 않습니다.") from error
    if not isinstance(state, dict):
        raise PublicCollectionError("INVALID_STORAGE_STATE", "storageState는 JSON 객체여야 합니다.")
    return state


class InternalApiClient:
    def __init__(self, base_url: str, collector_token: str, session: requests.Session | None = None) -> None:
        self.base_url = base_url.rstrip("/")
        if not self.base_url.endswith("/api/v1"):
            self.base_url = f"{self.base_url}/api/v1"
        self.session = session or requests.Session()
        self.session.headers.update({
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-Collector-Token": collector_token,
        })

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        response = self.session.request(
            method,
            f"{self.base_url}/{path.lstrip('/')}",
            timeout=(10, 30),
            **kwargs,
        )
        if not response.ok:
            raise PublicCollectionError(f"API_HTTP_{response.status_code}", "내부 API 요청이 실패했습니다.")
        return response.json()

    def watchlist(self) -> list[dict[str, Any]]:
        payload = self._request("GET", "/internal/instagram/watchlist")
        items = payload.get("items") if isinstance(payload, dict) else None
        if not isinstance(items, list):
            raise PublicCollectionError("API_CONTRACT", "watchlist 응답 형식이 올바르지 않습니다.")
        return [item for item in items if isinstance(item, dict)]

    def collect_post(self, payload: dict[str, Any]) -> dict[str, Any]:
        result = self._request("POST", "/raw-posts/collect", json=payload)
        return result if isinstance(result, dict) else {}

    def update_status(
        self,
        influencer_id: str,
        *,
        status: str,
        attempt_at: datetime,
        next_run_at: datetime,
        error_code: str | None = None,
        error_message: str | None = None,
    ) -> None:
        body = {
            "status": status,
            "attemptAt": isoformat(attempt_at),
            "nextRunAt": isoformat(next_run_at),
        }
        if error_code:
            body["errorCode"] = error_code[:80]
        if error_message:
            body["errorMessage"] = error_message[:400]
        self._request("PATCH", f"/internal/instagram/influencers/{influencer_id}/status", json=body)


class PublicInstagramCollector:
    def __init__(self, context: BrowserContext, limit: int = 12) -> None:
        self.context = context
        self.limit = limit

    def _check_page(self, page: Page, response: Any) -> None:
        status_code = getattr(response, "status", None)
        try:
            body_text = page.locator("body").inner_text(timeout=5_000)
        except Exception:
            body_text = ""
        reason = blocked_page_reason(page.url, status_code, body_text)
        if reason:
            raise PublicCollectionBlocked(reason, "Instagram 공개 페이지 접근이 차단되었거나 로그인이 필요합니다.")

    def collect_account(self, username: str) -> list[dict[str, Any]]:
        normalized_username = normalize_username(username)
        page = self.context.new_page()
        try:
            profile_url = f"https://www.instagram.com/{normalized_username}/"
            response = page.goto(profile_url, wait_until="domcontentloaded", timeout=30_000)
            self._check_page(page, response)
            links = extract_profile_posts(page.content(), profile_url, limit=self.limit)
            posts: list[dict[str, Any]] = []
            for link in links:
                response = page.goto(link.post_url, wait_until="domcontentloaded", timeout=30_000)
                self._check_page(page, response)
                parsed = parse_post_html(page.content(), link.post_url, link.image_url)
                posts.append({
                    "instagramPostId": parsed.post_id,
                    "influencerUsername": normalized_username,
                    "caption": parsed.caption,
                    "postUrl": parsed.post_url,
                    "imageUrl": parsed.image_url,
                    "takenAt": parsed.taken_at or isoformat(now_utc()),
                    "collectedAt": isoformat(now_utc()),
                    "collectionSource": "PLAYWRIGHT_PUBLIC",
                })
            return posts
        except PublicCollectionError:
            raise
        except Exception as error:
            raise PublicCollectionError("BROWSER_ERROR", "공개 페이지 수집 중 브라우저 오류가 발생했습니다.") from error
        finally:
            page.close()


@dataclass
class PublicInstagramWorker:
    api: InternalApiClient
    collector: PublicInstagramCollector
    poll_interval_seconds: int = 900
    jitter_seconds: int = 300
    clock: Callable[[], datetime] = now_utc
    rng: random.Random | Any = random

    def run_once(self) -> int:
        accounts = self.api.watchlist()
        collected_count = 0
        for account in accounts:
            influencer_id = str(account.get("id", ""))
            username = str(account.get("instagramUsername", ""))
            if not influencer_id or not username:
                logger.warning("watchlist 항목에 식별자가 없어 건너뜁니다.")
                continue

            attempt_at = self.clock()
            failure_count = int(account.get("playwrightFailureCount") or 0)
            try:
                posts = self.collector.collect_account(username)
                for post in posts:
                    self.api.collect_post(post)
                next_run_at = bounded_next_run(
                    self.poll_interval_seconds,
                    self.jitter_seconds,
                    rng=self.rng,
                    clock=self.clock,
                )
                self.api.update_status(
                    influencer_id,
                    status="SUCCESS",
                    attempt_at=attempt_at,
                    next_run_at=next_run_at,
                )
                collected_count += len(posts)
                logger.info("@%s 공개 게시물 %d개 처리", username, len(posts))
            except PublicCollectionBlocked as error:
                next_run_at = bounded_next_run(
                    self.poll_interval_seconds,
                    self.jitter_seconds,
                    failure_count=failure_count + 1,
                    blocked=True,
                    rng=self.rng,
                    clock=self.clock,
                )
                self.api.update_status(
                    influencer_id,
                    status="BLOCKED",
                    attempt_at=attempt_at,
                    next_run_at=next_run_at,
                    error_code=error.code,
                    error_message=str(error),
                )
                logger.warning("@%s 공개 수집 중단: %s", username, error.code)
            except PublicCollectionError as error:
                next_run_at = bounded_next_run(
                    self.poll_interval_seconds,
                    self.jitter_seconds,
                    failure_count=failure_count + 1,
                    rng=self.rng,
                    clock=self.clock,
                )
                self.api.update_status(
                    influencer_id,
                    status="ERROR",
                    attempt_at=attempt_at,
                    next_run_at=next_run_at,
                    error_code=error.code,
                    error_message=str(error),
                )
                logger.error("@%s 공개 수집 실패: %s", username, error.code)
            except Exception:
                next_run_at = bounded_next_run(
                    self.poll_interval_seconds,
                    self.jitter_seconds,
                    failure_count=failure_count + 1,
                    rng=self.rng,
                    clock=self.clock,
                )
                self.api.update_status(
                    influencer_id,
                    status="ERROR",
                    attempt_at=attempt_at,
                    next_run_at=next_run_at,
                    error_code="UNEXPECTED_ERROR",
                    error_message="예상하지 못한 수집 오류가 발생했습니다.",
                )
                logger.exception("@%s 공개 수집 중 예기치 않은 오류", username)
        return collected_count


def main() -> None:
    if not env_bool("INSTAGRAM_PUBLIC_CRAWLER_ENABLED", False):
        logger.warning("Instagram 공개 수집기가 비활성화되어 있습니다.")
        return

    collector_token = os.getenv("INSTAGRAM_COLLECTOR_TOKEN")
    if not collector_token:
        raise SystemExit("INSTAGRAM_COLLECTOR_TOKEN이 필요합니다.")

    api = InternalApiClient(
        os.getenv("API_INTERNAL_BASE_URL", "http://localhost:3000"),
        collector_token,
    )
    poll_interval_seconds = env_int("INSTAGRAM_PUBLIC_POLL_INTERVAL_SECONDS", 900, 60, 86_400)
    jitter_seconds = env_int("INSTAGRAM_PUBLIC_JITTER_SECONDS", 300, 0, 3_600)
    limit = env_int("INSTAGRAM_PUBLIC_POST_LIMIT", 12, 1, 50)

    storage_state = load_storage_state()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=env_bool("INSTAGRAM_PLAYWRIGHT_HEADLESS", True),
        )
        context = browser.new_context(
            storage_state=storage_state,
            locale="ko-KR",
            timezone_id="Asia/Seoul",
            viewport={"width": 1280, "height": 900},
        )
        collector = PublicInstagramCollector(context, limit=limit)
        worker = PublicInstagramWorker(
            api,
            collector,
            poll_interval_seconds=poll_interval_seconds,
            jitter_seconds=jitter_seconds,
        )
        worker.run_once()

        scheduler = BlockingScheduler(timezone="Asia/Seoul")
        scheduler.add_job(
            worker.run_once,
            "interval",
            seconds=poll_interval_seconds,
            jitter=jitter_seconds,
            max_instances=1,
            coalesce=True,
        )
        try:
            scheduler.start()
        finally:
            context.close()
            browser.close()


if __name__ == "__main__":
    main()
