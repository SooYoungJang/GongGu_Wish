# Task Checklist: GON-259 공구 알림 상태 통합

## Task 1: Contract and inventory

- [ ] 기존 관심 저장·예약·푸시 미러링 호출자를 목록화
- [ ] `GroupBuyAlertState`, command, failure mapping 계약 작성
- [ ] `groupBuyId` 필수화와 guest/user namespace migration 테스트
- Verify: contract/service unit tests

## Task 2: Reservation service

- [ ] 예약·취소를 단일 notification service로 이동
- [ ] pending/enabled/failed/unsupported/unavailable 전이 구현
- [ ] permission denied, missing date, Expo Go/native unsupported 처리
- [ ] 빠른 중복 탭 직렬화, duplicate schedule 방지, 실패 rollback
- Verify: service tests and mobile typecheck

## Task 3: Consumers and server mirror

- [ ] StoreScreen/상세/마이페이지 알림 버튼을 `groupBuyId`로 연결
- [ ] 서버 mirror idempotency/retry 경계 연결
- [ ] GON-229 token registration/admin broadcast와 중복 구현 방지
- Verify: component/screen tests and API contract tests

## Task 4: Final verification

- [ ] mobile tests, workspace tests, typecheck, lint, build
- [ ] Android/Expo 실행 환경에서 권한 거부·예약 실패·빠른 탭 검증
- [ ] 위키 회귀 포인트와 E2E evidence 기록
- [ ] intended files commit/push/PR/CI
