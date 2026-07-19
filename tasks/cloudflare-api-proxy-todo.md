# Cloudflare API Proxy Tasks

## Task 1: Worker 계약과 테스트

**Acceptance criteria:** 허용/거부 경로, 메서드, API 키, CORS, 원본 장애 계약이 테스트로 표현된다.

**Verification:** `cd workers/api-proxy && npm test`

**Dependencies:** 없음

## Task 2: Worker 구현과 구성

**Acceptance criteria:** 고정 Supabase 원본만 호출하고 `api.gongguwish.com` Custom Domain이 코드로 선언된다.

**Verification:** `cd workers/api-proxy && npm run check`

**Dependencies:** Task 1

## Task 3: 모바일 URL 분리

**Acceptance criteria:** PostgREST/Edge Function은 프록시 URL을 선택할 수 있고 Auth 및 자동 E2E는 기존 동작을 유지한다.

**Verification:** `npm run build:mobile` 및 관련 Vitest

**Dependencies:** Task 2

## Task 4: 배포 및 검증

**Acceptance criteria:** Custom Domain TLS, health, 공개 데이터 전달, 차단 응답이 프로덕션에서 확인된다.

**Verification:** HTTPS smoke tests 및 Cloudflare 로그 확인

**Dependencies:** Task 2, Task 3

## Task 5: 문서화 및 전달

**Acceptance criteria:** 위키 기록, 의도한 파일만 포함한 커밋, PR, CI, 머지, 로컬 main fast-forward가 완료된다.

**Verification:** `git status`, PR 필수 체크

**Dependencies:** Task 4
