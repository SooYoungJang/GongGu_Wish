# Implementation Plan: GON-259 공구 알림 상태와 로컬 푸시 예약 통합

## Overview

랭킹·상세·마이페이지에서 사용하는 공구 알림을 `groupBuyId` 기준으로 통합하고, 관심 저장 상태와 실제 로컬 푸시 예약 상태를 분리한다. 예약·권한·Expo 실행 환경·서버 미러링 실패를 숨기지 않으며, 빠른 중복 탭에서도 단일 상태 전이를 보장한다.

## Assumptions

- GON-258의 shared `groupBuyId` 계약을 현재 브랜치의 기준으로 사용한다.
- 기존 `GON-229` push-token/관리자 발송 흐름은 재사용하고, 공구 시작 예약만 별도 책임으로 둔다.
- 서버 미러링은 기존 모바일 API/Supabase 경계를 확장하며, 운영 DB migration·배포는 별도 승인 없이는 실행하지 않는다.

## Architecture Decisions

- `GroupBuyAlertState`는 `idle | pending | enabled | failed | unsupported | unavailable` discriminated union으로 외부에 노출한다.
- 예약 key와 저장 namespace는 `groupBuyId`를 포함하고 사용자 로그인 전후 namespace를 분리한다.
- 예약·취소·서버 미러링은 단일 service의 직렬화된 명령으로 실행하며, 실패 시 로컬 저장과 UI 상태를 이전 값으로 롤백한다.
- permission denied, Expo Go/native unsupported, missing date는 서로 다른 사용자 메시지와 상태로 매핑한다.

## Task List

### Phase 1: Existing flow and contract

- [ ] 기존 `useLocalDeals`, `notifications`, `StoreScreen`, API 저장 흐름과 GON-229 중복 경계 조사
- [ ] 상태/명령/오류 계약과 namespace migration 테스트 작성

### Phase 2: Reservation service

- [ ] 단일 notification service에 groupBuy 예약·취소·직렬화 구현
- [ ] 권한 거부·예약 실패·unsupported/unavailable 및 retry/rollback 구현
- [ ] 빠른 중복 탭과 동일 groupBuyId 중복 예약 방지 테스트

### Checkpoint: Core reservation

- [ ] mobile targeted tests, typecheck, lint 통과
- [ ] 예약 실패 시 `enabled`로 남지 않는지 확인

### Phase 3: UI and server mirror

- [ ] `GroupBuyAlertButton` 명칭·접근성 label·상태별 feedback 연결
- [ ] StoreScreen/상세/마이페이지 호출자를 `groupBuyId`로 통합
- [ ] server mirror idempotency와 namespace migration 연결

### Checkpoint: Complete

- [ ] full tests, build, lint, typecheck 통과
- [ ] Android/Expo 환경 차이 및 E2E 증거를 위키에 기록
- [ ] GON-258 선행 PR과 분리된 PR/CI 준비

## Risks and Mitigations

| Risk                                   | Impact | Mitigation                                                            |
| -------------------------------------- | ------ | --------------------------------------------------------------------- |
| 예약 성공 전 저장 상태만 먼저 반영됨   | High   | pending 상태와 실패 롤백을 단일 service에서 관리                      |
| 권한 거부/Expo Go 제약이 ON으로 표시됨 | High   | permission/native capability를 명시적 상태로 분리                     |
| 빠른 탭에서 duplicate schedule 발생    | High   | groupBuyId별 promise serialization과 idempotent schedule key          |
| 로그인 전후 저장 데이터가 섞임         | Medium | guest/user namespace와 migration을 별도 테스트                        |
| GON-229 발송 기능과 책임 중복          | Medium | token registration/admin broadcast는 유지하고 local schedule만 재사용 |
