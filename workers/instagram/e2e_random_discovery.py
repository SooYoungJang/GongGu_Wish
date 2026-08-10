"""Read-only Playwright smoke test for Instagram random account discovery."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import random
import re
import time
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

from public_main import PublicCollectionBlocked, PublicInstagramCollector
from public_parser import build_hashtag_url


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--storage-state", type=Path)
    parser.add_argument("--evidence-dir", type=Path, required=True)
    parser.add_argument("--hashtag", default="공구")
    parser.add_argument("--timeout-seconds", type=int, default=90)
    parser.add_argument("--headed", action="store_true")
    parser.add_argument("--mock", action="store_true")
    return parser.parse_args()


def mock_instagram(route) -> None:
    path = urlparse(route.request.url).path
    if path.startswith("/explore/tags/"):
        body = "".join(
            f'<a href="/p/discovery_{index}/">발견 게시물 {index}</a>'
            for index in range(15)
        )
    elif match := re.fullmatch(r"/p/discovery_(\d+)/", path):
        index = match.group(1)
        related_posts = "".join(
            f'<a href="/p/seller{index}_{post_index}/">같은 계정 {post_index}</a>'
            for post_index in range(1, 5)
        )
        body = f"""
        <html><head>
          <meta name="twitter:title"
                content="판매자 (@seller{index}) • Instagram 릴스">
        </head><body><main>
          <a href="/commenter/">먼저 렌더링된 댓글 작성자</a>
          <a href="/seller{index}/">seller{index}</a>
          <a href="/p/discovery_{index}/">공구 발견 게시물</a>
          <a href="/p/unrelated_{index}/">다른 계정 게시물</a>
          {related_posts}
        </main></body></html>
        """
    elif match := re.fullmatch(r"/seller(\d+)/", path):
        index = match.group(1)
        body = (
            '<main><div role="progressbar">불러오는 중</div>'
            f'<a href="/p/unrelated_{index}/">추천 게시물</a></main>'
        )
    elif match := re.fullmatch(r"/p/unrelated_(\d+)/", path):
        index = match.group(1)
        body = f"""
        <html><head>
          <meta name="twitter:title"
                content="다른 계정 (@other{index}) • Instagram 릴스">
        </head><body><main><a href="/other{index}/">other{index}</a></main></body></html>
        """
    elif match := re.fullmatch(r"/p/seller(\d+)_(\d+)/", path):
        seller_index, post_index = match.groups()
        body = f"""
        <html><head>
          <meta name="twitter:title"
                content="판매자 (@seller{seller_index}) • Instagram 릴스">
          <meta property="og:description" content="국내 배송 공동구매 {post_index}0,000원">
        </head><body><main>
          <a href="/commenter/">댓글 작성자</a>
          <a href="/seller{seller_index}/">seller{seller_index}</a>
          <time datetime="2026-08-{int(post_index):02d}T00:00:00+00:00"></time>
        </main></body></html>
        """
    else:
        body = "<html><body>Instagram fixture</body></html>"
    route.fulfill(status=200, content_type="text/html; charset=utf-8", body=body)


def main() -> None:
    args = parse_args()
    if not args.mock and (args.storage_state is None or not args.storage_state.is_file()):
        raise SystemExit("storageState file does not exist")
    args.evidence_dir.mkdir(parents=True, exist_ok=True)
    deadline = time.monotonic() + max(30, min(args.timeout_seconds, 300))

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=not args.headed)
        context_options = {
            "locale": "ko-KR",
            "timezone_id": "Asia/Seoul",
            "viewport": {"width": 1280, "height": 900},
        }
        if args.storage_state is not None:
            context_options["storage_state"] = str(args.storage_state)
        context = browser.new_context(
            **context_options,
        )
        if args.mock:
            context.route("https://www.instagram.com/**", mock_instagram)
        collector = PublicInstagramCollector(context, limit=3)
        accounts = collector.iter_discovered_accounts(
            hashtags=(args.hashtag,),
            scroll_passes=2,
            rng=random.Random(20260809),
            excluded_usernames=set(),
            should_continue=lambda: time.monotonic() < deadline,
        )
        try:
            try:
                username = next(accounts)
            except PublicCollectionBlocked as error:
                diagnostic_page = context.new_page()
                diagnostic_page.goto(
                    build_hashtag_url(args.hashtag),
                    wait_until="domcontentloaded",
                    timeout=30_000,
                )
                diagnostic_page.screenshot(
                    path=str(args.evidence_dir / "instagram-random-discovery-blocked.png"),
                    full_page=True,
                )
                print(
                    json.dumps(
                        {
                            "blocked": True,
                            "code": error.code,
                            "url": diagnostic_page.url,
                        },
                        ensure_ascii=False,
                    )
                )
                raise
            context.pages[-1].screenshot(
                path=str(
                    args.evidence_dir
                    / (
                        "instagram-random-discovery-mocked.png"
                        if args.mock
                        else "instagram-random-discovery-post.png"
                    )
                ),
                full_page=True,
            )
            posts = collector.collect_account(username)
            if not posts:
                raise RuntimeError(
                    "실제 랜덤 계정에서 검증 가능한 최신 게시물을 수집하지 못했습니다."
                )
        finally:
            accounts.close()
            context.close()
            browser.close()

    print(
        json.dumps(
            {
                "discoveredAccount": username,
                "latestPostCount": len(posts),
                "latestPostLimitRespected": len(posts) <= 3,
                "mocked": args.mock,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
