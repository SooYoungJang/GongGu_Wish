# Instagram workers

이 폴더에는 기존 `instagrapi` 워커와 별도의 `Playwright` 공개 페이지 워커가
있습니다. 두 경로의 목적과 인증 정보를 섞지 않습니다.

## Playwright 공개 페이지 수집기

기능 플래그와 계정별 플래그가 모두 기본값 `false`입니다. Instagram/Meta 약관과
계정 권한을 운영자가 검토한 뒤, 기존 관리자 화면에서 계정별로 켜야 합니다.
검토 대상: [Instagram 이용 약관](https://www.facebook.com/help/instagram/581066165581870),
[Meta 자동화된 데이터 수집 약관](https://www.facebook.com/legal/automated_data_collection_terms).

수집 범위는 등록된 계정의 공개 프로필과 공개 게시물 URL뿐입니다. 비공개 API,
프록시 회전, CAPTCHA/로그인 벽 우회, stealth 플러그인은 사용하지 않습니다. 로그인
벽·challenge·403·429가 나오면 해당 계정 수집을 중단하고 관리자 상태에 오류를 남깁니다.

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
