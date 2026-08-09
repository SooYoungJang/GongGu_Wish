"""Playwright worker for explicitly enabled public Instagram accounts.

This worker intentionally uses browser-visible public pages only. It does not
call Instagram's private APIs, rotate proxies, or bypass login/challenge pages.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
import json
import logging
import os
import random
import time
from typing import Any, Callable, Iterator

import requests
from apscheduler.schedulers.blocking import BlockingScheduler
from dotenv import load_dotenv
from playwright.sync_api import BrowserContext, Page, sync_playwright

try:
    from .public_parser import (
        blocked_page_reason,
        build_hashtag_url,
        extract_discovery_post_links,
        extract_post_username,
        extract_profile_posts,
        normalize_username,
        parse_post_html,
    )
    from .target import resolve_collection_target
except ImportError:
    from public_parser import (
        blocked_page_reason,
        build_hashtag_url,
        extract_discovery_post_links,
        extract_post_username,
        extract_profile_posts,
        normalize_username,
        parse_post_html,
    )
    from target import resolve_collection_target

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("instagram-public-worker")
MAX_POSTS_PER_ACCOUNT = 3
DEFAULT_DISCOVERY_HASHTAGS = (
    "공구",
    "공동구매",
    "공구오픈",
    "공구마감",
    "마켓오픈",
    "오픈예정",
)


class PublicCollectionError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class PublicCollectionBlocked(PublicCollectionError):
    pass


@dataclass(frozen=True)
class RandomDiscoveryConfig:
    enabled: bool = False
    target_group_buys: int = 3
    hashtags: tuple[str, ...] = DEFAULT_DISCOVERY_HASHTAGS
    scroll_passes: int = 3
    time_budget_seconds: int = 900
    emergency_max_accounts: int | None = None


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


def load_random_discovery_config() -> RandomDiscoveryConfig:
    raw_hashtags = os.getenv(
        "INSTAGRAM_DISCOVERY_HASHTAGS",
        ",".join(DEFAULT_DISCOVERY_HASHTAGS),
    )
    hashtags: list[str] = []
    for raw_hashtag in raw_hashtags.split(","):
        hashtag = raw_hashtag.strip().lstrip("#")
        if not hashtag or hashtag in hashtags:
            continue
        try:
            build_hashtag_url(hashtag)
        except ValueError as error:
            raise PublicCollectionError(
                "INVALID_DISCOVERY_HASHTAG",
                "Instagram 탐색 해시태그 설정이 올바르지 않습니다.",
            ) from error
        hashtags.append(hashtag)
    if not hashtags:
        raise PublicCollectionError(
            "MISSING_DISCOVERY_HASHTAG",
            "Instagram 탐색 해시태그가 하나 이상 필요합니다.",
        )

    emergency_max_accounts = env_int(
        "INSTAGRAM_DISCOVERY_EMERGENCY_MAX_ACCOUNTS",
        0,
        0,
        10_000,
    )
    return RandomDiscoveryConfig(
        enabled=env_bool("INSTAGRAM_RANDOM_DISCOVERY_ENABLED", False),
        target_group_buys=env_int(
            "INSTAGRAM_DISCOVERY_TARGET_GROUP_BUYS",
            3,
            1,
            50,
        ),
        hashtags=tuple(hashtags),
        scroll_passes=env_int("INSTAGRAM_DISCOVERY_SCROLL_PASSES", 3, 0, 10),
        time_budget_seconds=env_int(
            "INSTAGRAM_DISCOVERY_TIME_BUDGET_SECONDS",
            900,
            60,
            3_600,
        ),
        emergency_max_accounts=emergency_max_accounts or None,
    )


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def isoformat(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat()


def _taken_at_sort_key(post: dict[str, Any]) -> tuple[int, datetime]:
    value = post.get("takenAt")
    if not isinstance(value, str) or not value.strip():
        return (0, datetime.min.replace(tzinfo=timezone.utc))
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return (0, datetime.min.replace(tzinfo=timezone.utc))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return (1, parsed.astimezone(timezone.utc))


def latest_posts(
    posts: list[dict[str, Any]],
    limit: int = MAX_POSTS_PER_ACCOUNT,
) -> list[dict[str, Any]]:
    """Return at most the newest three posts; undated posts are considered last."""
    bounded_limit = max(1, min(int(limit), MAX_POSTS_PER_ACCOUNT))
    return sorted(posts, key=_taken_at_sort_key, reverse=True)[:bounded_limit]


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


class SupabaseCollectorApi:
    def __init__(
        self,
        function_url: str,
        collector_token: str,
        session: requests.Session | None = None,
    ) -> None:
        self.function_url = function_url.rstrip("/")
        self.session = session or requests.Session()
        self.session.headers.update(
            {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "X-Collector-Token": collector_token,
            }
        )

    def _request(self, action: str, **payload: Any) -> Any:
        response = self.session.request(
            "POST",
            self.function_url,
            timeout=(10, 30),
            json={"action": action, **payload},
        )
        if not response.ok:
            raise PublicCollectionError(
                f"API_HTTP_{response.status_code}",
                "Supabase collector 요청이 실패했습니다.",
            )
        return response.json()

    def watchlist(self) -> list[dict[str, Any]]:
        payload = self._request("watchlist")
        items = payload.get("items") if isinstance(payload, dict) else None
        if not isinstance(items, list):
            raise PublicCollectionError(
                "API_CONTRACT",
                "Supabase collector watchlist 응답 형식이 올바르지 않습니다.",
            )
        return [item for item in items if isinstance(item, dict)]

    def collect_post(self, payload: dict[str, Any]) -> dict[str, Any]:
        result = self._request("collect", post=payload)
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
        body: dict[str, Any] = {
            "influencerId": influencer_id,
            "status": status,
            "attemptAt": isoformat(attempt_at),
            "nextRunAt": isoformat(next_run_at),
        }
        if error_code:
            body["errorCode"] = error_code[:80]
        if error_message:
            body["errorMessage"] = error_message[:400]
        self._request("status", **body)


class PublicInstagramCollector:
    def __init__(self, context: BrowserContext, limit: int = MAX_POSTS_PER_ACCOUNT) -> None:
        self.context = context
        self.limit = max(1, min(int(limit), MAX_POSTS_PER_ACCOUNT))

    def _check_page(self, page: Page, response: Any) -> None:
        status_code = getattr(response, "status", None)
        try:
            body_text = page.locator("body").inner_text(timeout=5_000)
        except Exception:
            body_text = ""
        reason = blocked_page_reason(page.url, status_code, body_text)
        if reason:
            raise PublicCollectionBlocked(reason, "Instagram 공개 페이지 접근이 차단되었거나 로그인이 필요합니다.")

    def iter_discovered_accounts(
        self,
        *,
        hashtags: tuple[str, ...],
        scroll_passes: int,
        rng: random.Random | Any,
        excluded_usernames: set[str],
        should_continue: Callable[[], bool],
    ) -> Iterator[str]:
        page = self.context.new_page()
        seen = {normalize_username(username) for username in excluded_usernames}
        shuffled_hashtags = list(dict.fromkeys(hashtags))
        rng.shuffle(shuffled_hashtags)
        try:
            for hashtag in shuffled_hashtags:
                if not should_continue():
                    return
                hashtag_url = build_hashtag_url(hashtag)
                response = page.goto(
                    hashtag_url,
                    wait_until="domcontentloaded",
                    timeout=30_000,
                )
                self._check_page(page, response)
                for _ in range(max(0, scroll_passes)):
                    if not should_continue():
                        return
                    page.mouse.wheel(0, 4_000)
                    page.wait_for_timeout(750)
                    self._check_page(page, response)

                links = extract_discovery_post_links(page.content(), hashtag_url)
                rng.shuffle(links)
                for link in links:
                    if not should_continue():
                        return
                    response = page.goto(
                        link.post_url,
                        wait_until="domcontentloaded",
                        timeout=30_000,
                    )
                    self._check_page(page, response)
                    if not should_continue():
                        return
                    username = extract_post_username(page.content())
                    if not username or username in seen:
                        continue
                    seen.add(username)
                    yield username
        except PublicCollectionError:
            raise
        except Exception as error:
            raise PublicCollectionError(
                "DISCOVERY_BROWSER_ERROR",
                "Instagram 랜덤 계정 탐색 중 브라우저 오류가 발생했습니다.",
            ) from error
        finally:
            page.close()

    def collect_account(self, username: str) -> list[dict[str, Any]]:
        normalized_username = normalize_username(username)
        page = self.context.new_page()
        try:
            profile_url = f"https://www.instagram.com/{normalized_username}/"
            response = page.goto(profile_url, wait_until="domcontentloaded", timeout=30_000)
            self._check_page(page, response)
            links = extract_profile_posts(
                page.content(),
                profile_url,
                limit=min(self.limit * 2, MAX_POSTS_PER_ACCOUNT * 2),
            )
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
                    "takenAt": parsed.taken_at,
                    "collectedAt": isoformat(now_utc()),
                    "collectionSource": "PLAYWRIGHT_PUBLIC",
                })
            selected = latest_posts(posts, self.limit)
            for post in selected:
                if not post["takenAt"]:
                    post["takenAt"] = post["collectedAt"]
            return selected
        except PublicCollectionError:
            raise
        except Exception as error:
            raise PublicCollectionError("BROWSER_ERROR", "공개 페이지 수집 중 브라우저 오류가 발생했습니다.") from error
        finally:
            page.close()


@dataclass
class PublicInstagramWorker:
    api: InternalApiClient | SupabaseCollectorApi
    collector: PublicInstagramCollector
    poll_interval_seconds: int = 900
    jitter_seconds: int = 300
    clock: Callable[[], datetime] = now_utc
    rng: random.Random | Any = random
    watchlist_enabled: bool = True
    discovery: RandomDiscoveryConfig = field(default_factory=RandomDiscoveryConfig)
    monotonic: Callable[[], float] = time.monotonic

    def _run_random_discovery(self, excluded_usernames: set[str]) -> int:
        config = self.discovery
        if not config.enabled:
            return 0

        deadline = self.monotonic() + config.time_budget_seconds
        submitted_count = 0
        scanned_accounts = 0
        new_candidates = 0
        stop_reason = "SOURCE_EXHAUSTED"
        time_budget_exhausted = False

        def should_continue() -> bool:
            nonlocal time_budget_exhausted
            if self.monotonic() < deadline:
                return True
            time_budget_exhausted = True
            return False

        accounts = self.collector.iter_discovered_accounts(
            hashtags=config.hashtags,
            scroll_passes=config.scroll_passes,
            rng=self.rng,
            excluded_usernames=excluded_usernames,
            should_continue=should_continue,
        )
        try:
            for username in accounts:
                if self.monotonic() >= deadline:
                    stop_reason = "TIME_BUDGET"
                    break
                if (
                    config.emergency_max_accounts is not None
                    and scanned_accounts >= config.emergency_max_accounts
                ):
                    stop_reason = "EMERGENCY_ACCOUNT_LIMIT"
                    break

                scanned_accounts += 1
                try:
                    posts = self.collector.collect_account(username)
                    for post in posts:
                        result = self.api.collect_post(post)
                        submitted_count += 1
                        if result.get("created") is True and result.get("groupBuyId"):
                            new_candidates += 1
                            if new_candidates >= config.target_group_buys:
                                stop_reason = "TARGET_REACHED"
                                break
                    if new_candidates >= config.target_group_buys:
                        break
                except PublicCollectionBlocked as error:
                    stop_reason = error.code
                    logger.warning("랜덤 계정 탐색 중 Instagram 차단 감지: %s", error.code)
                    break
                except PublicCollectionError as error:
                    logger.error("랜덤 계정 @%s 수집 실패: %s", username, error.code)
        except PublicCollectionBlocked as error:
            stop_reason = error.code
            logger.warning("Instagram 탐색 소스 접근 중단: %s", error.code)
        except PublicCollectionError as error:
            stop_reason = error.code
            logger.error("Instagram 탐색 소스 실패: %s", error.code)
        finally:
            close = getattr(accounts, "close", None)
            if callable(close):
                close()

        if time_budget_exhausted and stop_reason == "SOURCE_EXHAUSTED":
            stop_reason = "TIME_BUDGET"

        logger.info(
            "Instagram 랜덤 탐색 완료: accounts=%d posts=%d newCandidates=%d stop=%s",
            scanned_accounts,
            submitted_count,
            new_candidates,
            stop_reason,
        )
        return submitted_count

    def run_once(self) -> int:
        accounts = self.api.watchlist() if self.watchlist_enabled else []
        watchlist_usernames = {
            str(account.get("instagramUsername", "")).strip().lower()
            for account in accounts
            if str(account.get("instagramUsername", "")).strip()
        }
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
        return collected_count + self._run_random_discovery(watchlist_usernames)


def main() -> None:
    if not env_bool("INSTAGRAM_PUBLIC_CRAWLER_ENABLED", False):
        logger.warning("Instagram 공개 수집기가 비활성화되어 있습니다.")
        return

    watchlist_enabled = env_bool("INSTAGRAM_PUBLIC_WATCHLIST_ENABLED", True)
    discovery = load_random_discovery_config()
    run_once = env_bool("INSTAGRAM_PUBLIC_RUN_ONCE", False)
    if not watchlist_enabled and not discovery.enabled:
        logger.warning("Instagram watchlist와 랜덤 발견이 모두 비활성화되어 있습니다.")
        return

    collector_token = os.getenv("INSTAGRAM_COLLECTOR_TOKEN")
    if not collector_token:
        raise SystemExit("INSTAGRAM_COLLECTOR_TOKEN이 필요합니다.")

    target = resolve_collection_target()
    if target.transport == "supabase_function":
        api = SupabaseCollectorApi(target.endpoint, collector_token)
    else:
        api = InternalApiClient(target.endpoint, collector_token)
    logger.info(
        "Instagram 공개 수집 저장 대상: target=%s transport=%s",
        target.name,
        target.transport,
    )
    poll_interval_seconds = env_int("INSTAGRAM_PUBLIC_POLL_INTERVAL_SECONDS", 900, 60, 86_400)
    jitter_seconds = env_int("INSTAGRAM_PUBLIC_JITTER_SECONDS", 300, 0, 3_600)
    limit = env_int(
        "INSTAGRAM_PUBLIC_POST_LIMIT",
        MAX_POSTS_PER_ACCOUNT,
        1,
        MAX_POSTS_PER_ACCOUNT,
    )

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
            watchlist_enabled=watchlist_enabled,
            discovery=discovery,
        )
        try:
            worker.run_once()
            if run_once:
                return

            scheduler = BlockingScheduler(timezone="Asia/Seoul")
            scheduler.add_job(
                worker.run_once,
                "interval",
                seconds=poll_interval_seconds,
                jitter=jitter_seconds,
                max_instances=1,
                coalesce=True,
            )
            scheduler.start()
        finally:
            context.close()
            browser.close()


if __name__ == "__main__":
    main()
