# Spec: Playwright 수집 환경별 저장 대상 분리

## Objective

로컬 Windows에서 Playwright 브라우저를 실행하되 수집 결과의 저장 대상은
환경별로 명시적으로 분리한다.

- 기본 로컬 실행은 Preview Supabase DB에 저장한다.
- `local`은 완전한 로컬 Nest API/DB 테스트에만 사용한다.
- Production 저장은 별도 허용값과 사전 테스트 통과가 없으면 실행되지 않는다.
- Preview와 Production은 같은 수집 계약을 사용하지만 서로 다른 Supabase 프로젝트와
  collector secret을 사용한다.

## Architecture

현재 `apps/api` Nest API는 로컬 PostgreSQL 실행용이고,
`api-preview.gongguwish.com`은 Supabase REST/Edge Function proxy다. 따라서
Preview/Production 저장은 새 `instagram-public-collector` Supabase Edge Function을
통해 수행한다. Worker는 Instagram 브라우저만 로컬에서 실행하고, DB credential은
보유하지 않는다.

| target              | 브라우저 실행    | 저장 게이트웨이          | 데이터베이스        |
| ------------------- | ---------------- | ------------------------ | ------------------- |
| `local`             | local Playwright | local Nest API           | local PostgreSQL    |
| `preview` (default) | local Playwright | Preview Edge Function    | Preview Supabase    |
| `production`        | local Playwright | Production Edge Function | Production Supabase |

## Collector contract

Worker는 `POST /functions/v1/instagram-public-collector`에 다음 action을 보낸다.

- `watchlist`: 활성화된 Playwright 계정 목록과 다음 실행 상태 반환
- `collect`: 원문 게시물의 id/caption/url/media/time/source를 idempotent하게 저장하고
  한국 공구 후보이면 `REVIEW_REQUIRED` 공구 생성
- `status`: 계정의 성공/실패/차단 상태와 다음 실행 시각 갱신

모든 요청은 `X-Collector-Token`으로 인증한다. Edge Function은 service-role client로
DB를 쓰지만 service-role key를 Worker나 브라우저에 전달하지 않는다.

## Commands

- Worker unit tests: `python -m unittest workers/instagram/test_target.py workers/instagram/test_public_main.py workers/instagram/test_public_parser.py`
- Worker syntax: `python -m compileall workers/instagram`
- Edge tests: `deno test --allow-net supabase/functions`
- Local complete run: `INSTAGRAM_COLLECTION_TARGET=local python workers/instagram/public_main.py`
- Preview run: `INSTAGRAM_COLLECTION_TARGET=preview python workers/instagram/public_main.py`
- Production run: `INSTAGRAM_COLLECTION_TARGET=production INSTAGRAM_ALLOW_PRODUCTION_WRITES=true python workers/instagram/public_main.py`

Production 실행 명령은 wrapper가 테스트를 먼저 통과시키고, 명시적 허용값이 없으면
실행하지 않는다. 실제 Production 수집은 이 작업에서 실행하지 않는다.

## Boundaries

- Always: Preview 기본값, target별 고정 origin, secret 미커밋, 중복 게시물 idempotency,
  관리자 검수 전 공개 금지
- Ask first: Production 데이터 수집 실행, Production secret 변경, DB migration,
  기존 Preview/Production 데이터 복사
- Never: Worker에 service-role key 저장, target URL 임의 override, Preview에서 Production
  origin 접근, 테스트 실패 상태의 Production 실행

## Success criteria

- target 누락 시 Preview로만 해석되고 local/production으로 조용히 fallback하지 않는다.
- Preview target은 Preview Supabase origin만 사용한다.
- Production target은 `INSTAGRAM_ALLOW_PRODUCTION_WRITES=true`와 테스트 통과 없이는
  실행되지 않는다.
- local/Preview/Production이 각각 올바른 watchlist/collect/status 경로를 사용한다.
- 같은 Instagram 게시물을 재수집해도 raw post와 group buy가 중복 생성되지 않는다.
- Worker unit/syntax, Edge Function tests, affected CI와 Preview Green이 통과한다.
- 이 변경으로 Production DB/Auth/Storage/secret에는 쓰기가 발생하지 않는다.

## Open questions

- 없음. 기존 환경 계약의 Preview/Production Supabase project ref와 Worker origin을
  사용한다.
