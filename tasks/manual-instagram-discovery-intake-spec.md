# Spec: Instagram 수동 발견 검수 intake

## Objective

관리자가 공개 Instagram 공구 게시물을 직접 발견했을 때, 사실에 맞는 `MANUAL_DISCOVERY` 출처를 보존하면서 기존 `Playwright collection / 자동 수집 검수` 목록에 대기 후보로 등록할 수 있게 한다. 자동 수집 경로의 `PLAYWRIGHT_PUBLIC` 출처를 가장하지 않으며, 등록 자체가 승인·공개로 이어지지 않는다.

## Existing contract

- 대상은 `gonggu_submissions`가 아니라 `group_buys` 기반의 자동 수집 검수 목록이다.
- 일반 collector는 `PLAYWRIGHT_PUBLIC`만 받아 `raw_posts`와 `group_buys`에 저장한다.
- 자동 검수 목록, 편집 가드, 승인 RPC도 현재 `PLAYWRIGHT_PUBLIC`만 허용한다.
- `raw_posts.collection_source`는 `RawPostCollectionSource` enum이고, `group_buys.source_type`은 text다.

## Proposed behavior

### Admin intake

- `apps/admin`의 자동 수집 검수 화면에 `수동 발견 등록` 진입점을 추가한다.
- 관리자는 공개 Instagram 게시물 URL, 계정명, 게시물 캡션, 게시 시각을 입력한다. 이미지 URL은 선택 입력이며, URL과 텍스트는 서버에서 검증한다. `collected_at`은 서버 시각으로 기록한다.
- 입력 게시물 URL은 기존 canonical Instagram post/reel URL validator가 허용하는 URL이어야 한다. 비공개 계정, 로그인 벽, 임의 도메인은 지원하지 않는다.
- 새 입력은 별도의 초안 상태로 기존 후보 편집과 구분한다. 성공 뒤 같은 검수 목록을 갱신하고 원본 게시물 링크를 표시한다.

### Authenticated server write

- `supabase/functions/admin-api`에 `POST /admin/automatic-collection/manual-discoveries` 경로를 추가한다. 기존 Bearer 세션 및 admin role 검증을 통과한 운영자만 사용할 수 있다.
- 브라우저 payload의 출처, 상태, 승인 필드는 신뢰하지 않는다. 서버가 `MANUAL_DISCOVERY`, `group_buys.status = REVIEW_REQUIRED`, `collection_review_status = PENDING`을 고정한다.
- 서버가 `raw_posts`에 원문 URL, 게시물 ID, 캡션, 계정, 게시 시각을 저장하고, 동일한 raw post를 참조하는 검수용 `group_buys` 행을 만든다. `raw_posts.collection_source`와 `group_buys.source_type` 모두 `MANUAL_DISCOVERY`로 기록한다.
- 자동 후보 분류 결과가 낮거나 불완전해도, 관리자가 명시적으로 등록한 항목은 대기 검수 후보로 만들 수 있다. 파싱 결과는 제안 데이터일 뿐이며, 관리자 승인 전 노출하지 않는다.
- 생성 경로는 Playwright watchlist 활성화, 계정 수집 설정 변경, 승인 endpoint 호출을 하지 않는다.

### Provenance, duplicate handling, review

- `raw_posts.collection_source` enum에 `MANUAL_DISCOVERY`를 추가하고 Prisma enum을 동기화하는 additive migration을 만든다. 기존 행의 출처를 재분류하거나 소급 변경하지 않는다.
- 같은 canonical Instagram post ID 재요청은 멱등적으로 기존 수동 후보를 반환한다. 같은 게시물이 이미 다른 출처로 저장된 경우 기존 출처를 덮어쓰지 않고 중복 결과를 돌려준다.
- 자동 검수 목록의 source filter, 상세 편집 가드, 승인·반려 흐름은 `PLAYWRIGHT_PUBLIC`과 `MANUAL_DISCOVERY`를 모두 허용한다.
- 기존 승인 경로의 DB RPC도 두 출처를 허용하도록 additive migration에서 갱신한다. 승인 시 출처 값은 바뀌지 않으며, 승인은 여전히 별도의 명시적 관리자 동작이다.
- 목록, 상세, 감사 정보에는 `Playwright 수집` 또는 `수동 발견` 출처와 실제 Instagram 원본 링크를 표시한다.

## Project structure and style

- Admin UI/client: `apps/admin/src/App.tsx`, `apps/admin/src/lib/adminApi.ts`, `apps/admin/src/types.ts` 및 기존 자동 수집 검수 테스트.
- Admin server/API contract: `supabase/functions/admin-api/index.ts`, `automaticCollectionReviewContract.ts` 및 인접 Deno contract tests.
- Persistence: 새 `supabase/migrations/<timestamp>_*.sql`; `apps/api/prisma/schema.prisma`의 enum 동기화.
- Edge Function은 기존 Deno TypeScript 입력 검증·admin auth 패턴과 인접 `*.test.ts` 계약 테스트를 따른다. Admin UI는 기존 React/TypeScript 컴포넌트와 adminApi Bearer 요청 패턴을 따른다.

## Commands

```sh
npm run admin:test
npm run admin:typecheck
npm run admin:lint
npm run admin:build
npm run test:e2e:admin
npm run db:generate
npm test -- --filter=@gonggu/api
npm run typecheck -- --filter=@gonggu/api
deno check supabase/functions/admin-api/index.ts
deno test --allow-net supabase/functions
```

관련 영향 분석에서 Supabase migration/integration 검사가 선택되면 그 검사를 추가 실행한다. CI 성공과 정확한 merge SHA의 Preview 확인 전에는 완료로 보지 않는다.

## Testing strategy

- Admin API 계약: 비관리자 거부, 입력 URL/필드 검증, 출처·상태의 서버 고정, 중복 멱등성, watchlist 비변경.
- DB/Edge 계약: raw post와 review candidate의 연결, `MANUAL_DISCOVERY` 저장, `REVIEW_REQUIRED`/`PENDING`, 승인 전 비노출, RPC 승인 가드.
- Admin 단위/E2E: 등록 성공 후 자동 수집 검수 목록에 나타남, 출처 badge와 원본 링크 확인, 생성 시 승인 endpoint가 호출되지 않음, 중복 알림과 기존 Playwright 흐름 유지.
- 영향받는 workspace 및 Supabase CI, 필수 PR 검사와 Preview Green을 확인한다.

## Boundaries

- Always: admin 인증, 서버 고정 출처, 원문 링크 보존, 중복 방지, 검수 대기만 생성, 승인 후에만 노출.
- Never: `PLAYWRIGHT_PUBLIC`으로 수동 발견을 가장하기, 자동 승인, 기존 출처 덮어쓰기, 브라우저의 service-role/collector token, CAPTCHA·로그인 벽 우회, like/follow/comment, Production 쓰기.
- Ask first: destructive schema/data changes, credential changes, Production 배포 또는 Production 데이터 변경.
- Scope 제외: 해시태그 자동 탐색/새 crawler 구현, Instagram 인증 수집, 공개 제출(`public-submission`) 경로 변경.

## Success criteria

1. admin만 수동 발견 후보를 등록할 수 있다.
2. 등록된 게시물과 후보의 출처는 `MANUAL_DISCOVERY`로 저장되며 같은 자동 수집 검수 목록에서 확인된다.
3. 신규 후보는 항상 `REVIEW_REQUIRED`/`PENDING`이고, 등록 요청만으로 승인·공개되지 않는다.
4. 중복 재요청은 기존 출처를 훼손하지 않고 멱등적으로 처리된다.
5. 기존 `PLAYWRIGHT_PUBLIC` 수집·검수·승인 흐름이 계속 통과한다.
6. 관련 테스트, 필수 CI, Preview 검증이 모두 성공하고 Production은 변경되지 않는다.

## Assumptions

- 운영자는 공개 Instagram 게시물에서 확인한 원문 URL, 계정명, 캡션, 게시 시각을 제공할 수 있다.
- 사용자가 찾은 후보를 기존 자동 수집 검수 화면에 추가하는 것이 목표이며, 이 변경에서 자동 탐색 crawler를 새로 만들 필요는 없다.
- `REVIEW_REQUIRED` 상태의 숨겨진 `group_buys` 행은 현재 자동 수집 검수 목록의 저장 계약이며, 승인 전 공개 상품이 아니다.
