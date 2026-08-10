# Instagram workers

이 폴더에는 기존 `instagrapi` 워커와 별도의 `Playwright` 공개 페이지 워커가
있습니다. 두 경로의 목적과 인증 정보를 섞지 않습니다.

## Playwright 공개 페이지 수집기

기능 플래그와 계정별 플래그가 모두 기본값 `false`입니다. 지정 계정 수집은 기존
관리자 화면에서 계정별로 켜고, 랜덤 계정 발견은 별도 원샷 스크립트로만 켭니다.
Instagram/Meta 약관과 계정 권한을 운영자가 검토한 뒤 실행해야 합니다.
검토 대상: [Instagram 이용 약관](https://www.facebook.com/help/instagram/581066165581870),
[Meta 자동화된 데이터 수집 약관](https://www.facebook.com/legal/automated_data_collection_terms).

수집 범위는 등록된 계정 또는 Instagram 해시태그 탐색에 현재 노출된 계정의 공개
프로필과 공개 게시물 URL뿐입니다. 비공개 API, 프록시 회전, CAPTCHA/로그인 벽 우회,
stealth 플러그인은 사용하지 않습니다. 로그인 벽·challenge·403·429가 나오면 즉시
수집을 중단합니다.

### 설치

```bash
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r workers/instagram/requirements.txt
python -m playwright install chromium
```

### 로그인 세션 준비

비밀번호를 워커나 저장소에 넣지 않습니다. 운영자가 브라우저에서 직접 로그인해
임시 `storageState`를 만들고, JSON 전체를 Secret Manager의
`INSTAGRAM_PLAYWRIGHT_STORAGE_STATE_JSON`으로 주입합니다.

```bash
python workers/instagram/public_session_setup.py .\storage-state.tmp.json
```

생성된 파일은 커밋하지 말고 Secret Manager로 옮긴 뒤 삭제합니다.

### 환경변수

```text
INSTAGRAM_PUBLIC_CRAWLER_ENABLED=false
INSTAGRAM_COLLECTOR_TOKEN=<API와 공유하는 별도 secret>
INSTAGRAM_PLAYWRIGHT_STORAGE_STATE_JSON=<Secret Manager 주입값>
INSTAGRAM_COLLECTION_TARGET=preview
# local target일 때만 사용: http://127.0.0.1:3000
API_INTERNAL_BASE_URL=http://127.0.0.1:3000
INSTAGRAM_PUBLIC_POLL_INTERVAL_SECONDS=900
INSTAGRAM_PUBLIC_JITTER_SECONDS=300
INSTAGRAM_PUBLIC_POST_LIMIT=3
INSTAGRAM_PLAYWRIGHT_HEADLESS=true
INSTAGRAM_PUBLIC_WATCHLIST_ENABLED=true
INSTAGRAM_RANDOM_DISCOVERY_ENABLED=false
INSTAGRAM_PUBLIC_RUN_ONCE=false
INSTAGRAM_DISCOVERY_TARGET_GROUP_BUYS=3
INSTAGRAM_DISCOVERY_TIME_BUDGET_SECONDS=900
INSTAGRAM_DISCOVERY_SCROLL_PASSES=3
INSTAGRAM_DISCOVERY_HASHTAGS=공구,공동구매,공구오픈,공구마감,마켓오픈,오픈예정
# 선택값. 0 또는 미설정이면 계정 수 제한 없음
INSTAGRAM_DISCOVERY_EMERGENCY_MAX_ACCOUNTS=0
```

`900 ± 300초` 지터는 계정 요청을 한 시각에 몰리지 않게 하는 운영용 분산값입니다.
접근 제한을 피하기 위한 우회 수단으로 사용하지 않습니다.

### 실행

기본 실행은 로컬 Playwright 브라우저가 Preview Supabase의
`instagram-public-collector` Edge Function으로 결과를 저장합니다. Worker에는
service-role key나 DB password를 넣지 않습니다.

```bash
powershell -ExecutionPolicy Bypass -File scripts/run-instagram-public-collector.ps1 -Target preview
```

`-Target local`을 명시하면 기존 로컬 Nest API의
`GET /api/v1/internal/instagram/watchlist`와 `POST /api/v1/raw-posts/collect`를
사용합니다. Preview/Production target은 각 Supabase 프로젝트의
`POST /functions/v1/instagram-public-collector` action contract를 사용합니다.

한국 신호 3개 중 2개(한글 캡션, 원화 가격, 국내 배송/커머스)를 만족하는 공구 후보만
`REVIEW_REQUIRED`로 생성하며, 제품명·카테고리·구매 URL·일정을 관리자가 보완하기
전에는 앱에 공개되지 않습니다.

### 랜덤 계정 공구 발견

아래 명령은 지정 계정 watchlist를 끄고 Instagram의 한국 공구 해시태그 탐색에
노출된 게시물과 작성자 계정을 무작위 순서로 확인합니다. 각 계정에서는 기존과 같이
최신 게시물 최대 3건만 Preview collector에 제출합니다.

```bash
powershell -ExecutionPolicy Bypass -File scripts/run-instagram-random-discovery.ps1 `
  -Target preview -TargetGroupBuys 3 -TimeBudgetSeconds 900
```

기본 계정 수 하드 제한은 없습니다. 새 공구 검수 후보 3건을 찾거나, 15분이 지나거나,
탐색 결과를 모두 확인하거나, Instagram 차단 화면을 감지하면 종료합니다. 운영상
비상 한도가 필요할 때만 `-EmergencyMaxAccounts 50`처럼 명시합니다. 중복 게시물이나
이미 존재하는 공구는 목표 수에 포함하지 않습니다.

탐색 범위는 `-Hashtags 공구,공동구매,공구오픈`처럼 바꿀 수 있습니다. URL은 항상
Instagram HTTPS 해시태그·게시물·프로필 allowlist 안에서만 생성되며, 페이지에서 읽은
임의 외부 URL로 이동하지 않습니다.

저장 없이 탐색·최신 3건 동작을 확인하려면 읽기 전용 smoke를 실행합니다. 먼저
로컬 fixture를 사용한 결정적 브라우저 E2E를 실행할 수 있습니다.

```bash
python workers/instagram/e2e_random_discovery.py --mock `
  --evidence-dir .\test-results\instagram-random-discovery
```

실제 Instagram 로그인 세션을 확인할 때는 `storageState` 경로를 전달합니다. 이 명령은
cookie나 storageState 내용을 출력하지 않으며 로그인·challenge 화면에서는 즉시 실패합니다.

```bash
python workers/instagram/e2e_random_discovery.py `
  --storage-state .\storage-state.tmp.json `
  --evidence-dir .\test-results\instagram-random-discovery
```

### Production 실행 경계

Production target은 기본적으로 차단됩니다. 로컬 Worker 테스트와 compileall을
먼저 통과시킨 뒤 래퍼가 preflight 표식을 세우고, 운영자가 명시적으로 실행해야
합니다. 이 명령도 실제 Production 저장을 수행하므로 테스트 완료 후에만 실행합니다.

```bash
powershell -ExecutionPolicy Bypass -File scripts/run-instagram-public-collector.ps1 `
  -Target production -AllowProductionWrites
```

Production 실행은 이 명령을 직접 호출한 경우에만 가능하며, 이 저장소의 일반
`develop` PR/Preview 검증이 Production 수집을 자동 실행하지는 않습니다.

### 집에서 한 번 로그인한 뒤 원격 Production 수집

집에서 한 번 만든 Instagram 로그인 세션을 GitHub `production` Environment
Secret으로 등록하면, 이후에는 PC가 켜져 있지 않아도 GitHub Actions에서 원격으로
원샷 수집할 수 있습니다. 원격 실행은 GitHub Actions 사용량을 사용하며, 실행할 때마다
실제 Production DB에 수집 결과가 저장됩니다.

1. 집에서 저장소를 최신 `main`으로 받은 뒤 로그인 세션 파일을 만듭니다. 이 창에서
   Instagram에 직접 로그인하고, 완료 후 같은 창에서 Enter를 누릅니다.

   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r workers/instagram/requirements.txt
   python -m playwright install chromium
   python workers/instagram/public_session_setup.py `
     "$env:TEMP\gonggu-wish-instagram-storage-state.json"
   ```

2. 생성된 세션과 현재 Windows 사용자 환경에 저장된 collector token을 GitHub
   `production` Environment Secret으로 올립니다. 이 명령은 Secret 값을 화면이나
   프로세스 인자에 출력하지 않습니다.

   ```powershell
   powershell -ExecutionPolicy Bypass -File `
     scripts/configure-instagram-public-collector-secrets.ps1 `
     -StorageStatePath "$env:TEMP\gonggu-wish-instagram-storage-state.json" `
     -UseCurrentUserCollectorToken
   ```

   `-UseCurrentUserCollectorToken`을 사용하지 않으려면 GitHub Secret 화면에서
   `INSTAGRAM_COLLECTOR_TOKEN`을 별도로 등록합니다. 세션 파일은 GitHub에 업로드한
   뒤 로컬에서도 삭제합니다. `storageState`는 Instagram 로그인 쿠키를 포함하므로
   누구에게도 보내거나 저장소에 커밋하지 않습니다.

3. GitHub의 `Actions → Instagram Public Collector → Run workflow`에서 branch를
   `main`으로 선택합니다. `both`는 지정 계정 watchlist와 랜덤 한국 공구 탐색을
   모두 실행하고, `watchlist` 또는 `random`만 선택할 수도 있습니다. 랜덤 탐색의
   후보 목표는 1~20건, 시간 예산은 60~1800초 범위입니다.

4. `실제 Production DB에 저장` 확인란을 체크해 실행합니다. Production Environment
   승인 요청이 표시되면 승인해야 수집기가 시작됩니다. 워커는 자체 테스트와
   `compileall`을 먼저 통과한 뒤 최신 3건·진행/예정 공구·중복 방지 규칙으로
   `instagram-public-collector`에 저장합니다.

5. 완료 후 관리자 페이지의 `자동 수집 검수` 탭에서 원본 링크를 열어 확인합니다.
   후보는 관리자가 공구 등록 또는 반려해야 앱에 반영됩니다.

이 워크플로는 현재 반복 스케줄 없이 수동 원샷으로만 동작합니다. Instagram 세션이
만료되거나 challenge/login wall이 감지되면 실행이 실패하므로, 집에서 새 세션을
만들어 `INSTAGRAM_PLAYWRIGHT_STORAGE_STATE_JSON` Secret을 교체한 뒤 다시 실행합니다.

## 기존 instagrapi 워커

기존 `main.py`는 레거시 수집 경로입니다.

필수 환경변수:

- `INSTAGRAM_USERNAME`
- `INSTAGRAM_PASSWORD`
- `API_INTERNAL_BASE_URL`

선택 환경변수:

- `INSTAGRAM_PROXY_URL`
- `INSTAGRAM_SESSION_FILE`
- `INSTAGRAM_POLL_INTERVAL_SECONDS`
- `INSTAGRAM_COLLECTOR_TOKEN` (API에서 토큰을 켠 경우)

새 공개 수집 기능을 켜려면 `main.py`가 아니라 `public_main.py`를 실행합니다.
