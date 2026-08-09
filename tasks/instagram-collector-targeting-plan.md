# Implementation Plan: Playwright 수집 환경별 저장 대상 분리

## Phase 1: Contract and safety foundation

- [ ] `workers/instagram/target.py`에 `local|preview|production` target resolver 추가
- [ ] Preview 고정 origin, Production 명시 허용값, URL mismatch fail-closed 규칙 추가
- [ ] target resolver RED/GREEN 테스트 작성

### Checkpoint

- target 누락은 Preview로 resolve
- Preview/Production mismatch와 Production 미승인은 실패
- secret/DB credential은 코드에 없음

## Phase 2: Remote collector gateway

- [ ] `supabase/functions/instagram-public-collector/index.ts` 추가
- [ ] watchlist/collect/status action contract 구현
- [ ] collector token 인증, service-role DB access, idempotent raw post 저장 구현
- [ ] 한국 공구 판정과 shared caption parser 계약 연결
- [ ] Edge Function contract tests 추가

### Checkpoint

- Preview function이 기존 schema에 맞는 response를 반환
- 중복 collect가 중복 row를 만들지 않음
- unauthorized request가 거부됨

## Phase 3: Worker integration and operator workflow

- [ ] `public_main.py`가 local은 Nest API, preview/production은 Edge Function transport를 사용하도록 연결
- [ ] Production wrapper가 worker tests를 먼저 실행하도록 추가
- [ ] README에 Preview 기본 실행과 Production 승인 경계 기록
- [ ] Preview/Production Edge Function을 각 Supabase origin에 배포하고 action contract를 확인

### Checkpoint

- local fake API 테스트가 유지됨
- Preview payload가 collector action contract와 일치
- Production은 테스트 실패/허용값 누락 시 저장 요청을 만들지 않음

## Phase 4: Verification and delivery

- [ ] Worker unittest/compileall
- [ ] Deno Edge/Cloudflare tests
- [ ] affected API/Edge/Worker CI
- [ ] Preview exact-SHA smoke
- [ ] develop merge 및 위키 기록

## Risks and mitigations

| Risk                               | Impact   | Mitigation                                                    |
| ---------------------------------- | -------- | ------------------------------------------------------------- |
| Edge Function schema mapping drift | High     | Existing migration names and contract tests 사용              |
| Production accidental write        | Critical | Fixed origin + explicit env gate + preflight tests            |
| Duplicate Instagram posts          | High     | Existing instagramPostId/contentHash uniqueness contract 유지 |
| Worker target override             | High     | allowlist resolver와 mismatch fail-closed                     |
