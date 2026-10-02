"""Read-only browser fixture proving a background 429 interrupts paced navigation."""

import argparse
import json
from pathlib import Path
import time

from playwright.sync_api import sync_playwright

from public_main import PublicCollectionBlocked, PublicInstagramCollector
from public_parser import ProfilePostLink


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--evidence-dir", type=Path, required=True)
    args = parser.parse_args()
    args.evidence_dir.mkdir(parents=True, exist_ok=True)
    navigations = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1000, "height": 700})

        def fixture(route):
            if route.request.is_navigation_request():
                navigations.append(route.request.url)
                route.fulfill(content_type="text/html", body="""
                    <main><h1>Instagram pacing fixture</h1>
                    <p>Background HTTP 429 will stop the next page navigation.</p></main>
                    <script>setTimeout(() => fetch('/api/v1/fixture-rate-limit/'), 1000)</script>
                """)
            else:
                route.fulfill(status=429, headers={"retry-after": "28800"}, body="Rate limit fixture")

        context.route("https://www.instagram.com/**", fixture)
        collector = PublicInstagramCollector(context)
        # Discovery keeps this page alive while the account page is collected.
        collector._load_discovered_username(
            context.new_page(),
            ProfilePostLink("p:first", "https://www.instagram.com/p/first/", None),
            should_continue=lambda: True,
        )
        started = time.monotonic()
        try:
            collector.collect_account("second")
            raise AssertionError("A second navigation occurred after the background 429")
        except PublicCollectionBlocked as error:
            assert error.code == "HTTP_429"
            assert error.retry_after_seconds == 28800
            assert navigations == ["https://www.instagram.com/p/first/"]
            result = {
                "mocked": True, "blocked": error.code,
                "retryAfterSeconds": error.retry_after_seconds,
                "navigationCount": len(navigations),
                "interruptedAfterSeconds": round(time.monotonic() - started, 2),
            }
            evidence_page = context.new_page()
            evidence_page.set_content(
                "<h1>Instagram pacing fixture: PASS</h1><pre>" + json.dumps(result, indent=2) + "</pre>"
            )
            evidence_page.screenshot(path=str(args.evidence_dir / "background-429-stop.png"))
            (args.evidence_dir / "background-429-result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
            print(json.dumps(result))
        finally:
            context.close()
            browser.close()


if __name__ == "__main__":
    main()
