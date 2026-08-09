# Spec: Instagram 랜덤 계정 공구 발견

## Objective

로컬 Playwright가 Instagram 탐색 결과에 노출된 게시물을 무작위 순서로 확인하고,
작성자 계정의 최신 게시물 3건 중 한국 공구 후보만 Preview DB의 자동 수집 검수로 보낸다.
지정 계정 watchlist 수집은 유지하되 랜덤 발견은 독립적인 원샷 실행 모드로 제공한다.

## Architecture

1. 한국 공구 해시태그 탐색 페이지에서 현재 노출된 게시물 URL을 수집한다.
2. 해시태그와 게시물 순서를 실행마다 섞는다.
3. 각 게시물의 공개 HTML에서 작성자 username을 추출한다.
4. watchlist 계정과 이미 본 계정을 제외하고 작성자 프로필의 최신 3건을 수집한다.
5. 기존 Preview `instagram-public-collector`가 한국·공구 여부와 중복을 판정한다.
6. 응답이 `created=true`이고 `groupBuyId`가 있을 때만 새 검수 후보로 센다.

계정 수에는 기본 하드 제한을 두지 않는다. 다음 조건 중 하나에서 종료한다.

- 새 공구 후보 목표 수 달성(기본 3건)
- 실행 시간 예산 만료(기본 15분)
- Instagram 로그인·challenge·403·429 감지
- 현재 탐색 소스 소진
- 운영자가 선택적으로 설정한 비상 계정 한도 도달

## Configuration

- `INSTAGRAM_RANDOM_DISCOVERY_ENABLED`: 랜덤 발견 활성화, 기본 `false`
- `INSTAGRAM_PUBLIC_WATCHLIST_ENABLED`: 지정 계정 수집 활성화, 기본 `true`
- `INSTAGRAM_PUBLIC_RUN_ONCE`: 첫 실행 뒤 scheduler 없이 종료, 기본 `false`
- `INSTAGRAM_DISCOVERY_TARGET_GROUP_BUYS`: 새 후보 목표, 기본 `3`
- `INSTAGRAM_DISCOVERY_TIME_BUDGET_SECONDS`: 시간 예산, 기본 `900`
- `INSTAGRAM_DISCOVERY_HASHTAGS`: 쉼표 구분 해시태그
- `INSTAGRAM_DISCOVERY_SCROLL_PASSES`: 탐색 페이지 스크롤 횟수, 기본 `3`
- `INSTAGRAM_DISCOVERY_EMERGENCY_MAX_ACCOUNTS`: 선택적 비상 한도, 기본 미설정

## Commands

- Focused tests: `python -m unittest workers/instagram/test_public_parser.py workers/instagram/test_public_main.py`
- Worker tests: `python -m unittest workers/instagram/test_target.py workers/instagram/test_public_main.py workers/instagram/test_public_parser.py`
- Syntax: `python -m compileall -q workers/instagram`
- Preview random run: `powershell -ExecutionPolicy Bypass -File scripts/run-instagram-random-discovery.ps1 -Target preview`

## Code style and project structure

- 순수 URL·HTML 정규화는 `workers/instagram/public_parser.py`에 둔다.
- Playwright 탐색과 종료 제어는 `workers/instagram/public_main.py`에 둔다.
- 외부 URL은 canonical Instagram HTTPS URL만 만들고 username은 기존 allowlist 정규식을 쓴다.
- 테스트는 같은 디렉터리의 `test_public_parser.py`, `test_public_main.py`에 추가한다.

## Testing strategy

- 파서 단위 테스트: 임의 HTML에서 게시물·작성자를 중복 없이 추출하고 예약 경로를 거부한다.
- Worker 단위 테스트: 10개를 넘어 탐색 가능, 목표 달성, 시간 만료, 차단, 선택적 비상 한도.
- 브라우저 E2E: 격리된 테스트 세션으로 실제 Instagram 탐색 페이지를 열고 로그·증거를 남긴다.
- Preview 통합: Production이 아닌 Preview collector 응답과 자동 수집 검수 노출을 확인한다.

## Boundaries

- Always: Preview 기본 저장, 최신 3건, URL allowlist, 중복 방지, 요청 시간 제한, 차단 즉시 중단
- Ask first: Production 실행, credential 변경, 탐색용 Instagram 계정 변경
- Never: CAPTCHA 우회, stealth 회피, like/follow/comment, cookie·token 로그, 임의 외부 URL 탐색

## Success criteria

- 랜덤 발견은 10계정에서 멈추지 않고 목표·시간·차단·소스 소진으로 종료한다.
- 각 계정은 최신 게시물 최대 3건만 제출한다.
- 새 한국 공구 후보만 목표 수에 포함되고 중복 응답은 포함되지 않는다.
- 전용 스크립트는 watchlist를 끄고 랜덤 발견을 원샷으로 Preview에 실행한다.
- Worker 테스트·구문 검사·실제 브라우저 증거·필수 CI·Preview Green이 통과한다.
- Production DB/Auth/Storage/secret은 변경하지 않는다.

## Open questions

- 없음. 사용자가 목표 기반 탐색과 설정 가능한 비상 한도를 승인했다.
