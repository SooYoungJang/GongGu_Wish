"""Create a Playwright storageState after a human completes Instagram login."""

from __future__ import annotations

import argparse
from pathlib import Path

from playwright.sync_api import sync_playwright


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="Secret Manager에 업로드할 임시 storageState 경로")
    args = parser.parse_args()

    print("브라우저에서 직접 로그인한 뒤 이 터미널로 돌아와 Enter를 누르세요.")
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=False)
        context = browser.new_context(locale="ko-KR", timezone_id="Asia/Seoul")
        page = context.new_page()
        page.goto("https://www.instagram.com/accounts/login/", wait_until="domcontentloaded")
        input()
        args.output.parent.mkdir(parents=True, exist_ok=True)
        context.storage_state(path=str(args.output))
        context.close()
        browser.close()
    print("storageState를 저장했습니다. 파일을 저장소에 커밋하지 말고 Secret Manager로 옮기세요.")


if __name__ == "__main__":
    main()
