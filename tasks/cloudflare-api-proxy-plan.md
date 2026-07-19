# Implementation Plan: Cloudflare API Proxy

## Overview

Supabase Auth는 직접 연결로 유지하고, 모바일의 PostgREST 및 Edge Function 전송 계층만 `api.gongguwish.com` Worker로 분리한다. Worker는 고정 원본과 코드 allowlist를 사용해 SSRF 및 의도하지 않은 API 공개를 막는다.

## Architecture Decisions

- Auth와 데이터 API의 base URL을 분리해 OAuth 동작과 세션 복구를 변경하지 않는다.
- Worker는 Supabase anon key를 저장하지 않고 앱이 보내는 공개 키/JWT를 그대로 전달한다.
- Custom Domain을 Wrangler 구성의 source of truth로 관리한다.
- GET도 캐시하지 않아 가격·배너 변경보다 오래된 응답이 우선하지 않게 한다.

## Dependency Graph

Worker 계약 및 테스트 → Worker 구현·구성 → 모바일 URL 분리 → 배포·DNS → 실서비스 smoke test → 커밋·PR·CI

## Task List

### Phase 1: Foundation

- [x] Worker 계약 테스트를 RED 상태로 작성한다.
- [x] 최소 프록시 구현과 Wrangler Custom Domain 구성을 추가한다.

### Checkpoint: Worker

- [x] Worker 테스트와 문법 검사가 통과한다.
- [x] 알 수 없는 경로·메서드가 원본 호출 전에 차단된다.

### Phase 2: Mobile Integration

- [x] `EXPO_PUBLIC_API_PROXY_URL`을 PostgREST 전용 base URL로 연결한다.
- [x] 기존 E2E 로컬 Supabase 설정과 Supabase Auth URL을 보존한다.

### Checkpoint: Integration

- [x] 모바일 관련 테스트, 타입 검사, 린트가 통과한다.

### Phase 3: Production

- [x] Wrangler로 Worker와 `api.gongguwish.com`을 배포한다.
- [x] health, 공개 데이터, 차단 경로, 보안 헤더를 실서비스에서 확인한다.
- [ ] 위키 기록, 의도한 파일 커밋, PR/CI/머지 절차를 완료한다.

### Checkpoint: Complete

- [ ] 모든 성공 기준을 충족한다.
- [ ] 롤백 경로가 확인됐다.

## Risks and Mitigations

| Risk                              | Impact | Mitigation                          |
| --------------------------------- | -----: | ----------------------------------- |
| 프록시가 임의 Supabase API를 공개 |   High | 리소스·함수·메서드 allowlist        |
| Auth URL까지 바뀌어 OAuth 실패    |   High | Auth와 데이터 API base URL 분리     |
| 원본 오류가 내부 정보 노출        | Medium | 네트워크 예외를 일반화된 502로 변환 |
| 가격/배너 응답이 오래 캐시됨      | Medium | `Cache-Control: no-store`           |
| 기존 로컬 E2E 깨짐                | Medium | 자동 E2E에서는 기존 로컬 URL 우선   |

## Rollback

1. 모바일 배포에서 `EXPO_PUBLIC_API_PROXY_URL`을 제거해 Supabase 직접 연결로 되돌린다.
2. 필요하면 Cloudflare Worker의 Custom Domain을 비활성화한다.
3. 데이터베이스 변경은 없으므로 데이터 롤백은 필요 없다.

## Open Questions

- 없음.
