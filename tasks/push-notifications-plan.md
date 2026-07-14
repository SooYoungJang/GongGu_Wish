# Implementation Plan: 푸시 발송

## Phase 1: 계약과 저장

1. Supabase와 Prisma에 `push_token`, `push_provider`를 additive 방식으로 추가한다.
2. 인증된 `register-push-token` Edge Function을 추가한다.
3. Expo 발송 helper와 `admin-api` 발송 route의 입력/출력 계약을 고정한다.

## Phase 2: 모바일 등록

1. 권한 승인 후 `getExpoPushTokenAsync`를 호출한다.
2. EAS project ID를 사용해 토큰을 생성한다.
3. 로그인 사용자의 토큰을 Edge Function에 등록한다.
4. Expo Go, 권한 거부, project ID 누락을 안전하게 no-op 처리한다.

## Phase 3: 관리자 발송

1. 관리자 API client에 발송 메서드를 추가한다.
2. 제목·본문·선택 JSON 입력과 발송 확인 UI를 추가한다.
3. 성공/실패/무효 토큰 수를 표시한다.

## Phase 4: 검증과 인계

1. 컴포넌트/서비스 테스트, 타입 검사, 린트, 빌드를 실행한다.
2. 실제 발송에 필요한 Supabase migration, Edge Function deploy, EAS credential 절차를 기록한다.
3. 변경사항을 리뷰하고 의도한 파일만 커밋·푸시·PR 처리한다.

## 위험과 대응

| 위험 | 대응 |
|---|---|
| Expo Go에서 원격 푸시가 동작하지 않음 | development build 기준으로 검증하고 관리자 안내에 명시 |
| 기존 FCM 토큰과 Expo 토큰이 섞임 | `push_provider`를 별도 저장하고 발송 query에서 `expo`만 선택 |
| 죽은 토큰이 누적됨 | Expo ticket의 `DeviceNotRegistered` 결과를 저장소에서 정리 |
| 관리자 오발송 | UI 확인창과 서버 입력 검증을 모두 적용 |
