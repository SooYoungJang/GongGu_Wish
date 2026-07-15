# Spec: 관리자 푸시 대상 선택 발송

## Objective

관리자가 푸시 메시지를 전체 사용자 또는 검색·선택한 특정 사용자에게 보낼 수 있게 한다. 대상 수와 푸시 가능 여부를 발송 전에 명확히 보여 주어 오발송을 줄이고, 기존 Expo Push Service 계약은 유지한다.

## Assumptions and Boundaries

- 기존 `POST /admin/notifications`의 `userIds` 계약을 재사용한다.
- `userIds`를 생략하면 전체 발송, 배열을 보내면 선택 사용자 발송이다.
- 사용자 목록에는 raw `push_token`을 내려주지 않고 `hasPushToken`만 노출한다.
- 예약 발송, 세그먼트, 발송 이력/통계는 이번 범위에 포함하지 않는다.
- 기존 `fcm_token` 필드와 관리자 인증/권한 검사는 유지한다.

## API Contract

- `GET /admin/users` response item에 `hasPushToken: boolean`을 additive하게 추가한다.
- `POST /admin/notifications` request는 기존 `title`, `body`, `data`, optional `userIds`를 사용한다.
- response는 기존 `targeted`, `sent`, `failed`, `invalidTokensRemoved`, `provider`를 유지한다.

## UX Acceptance Criteria

- [ ] `전체 발송`과 `선택 발송` 모드를 명확히 전환할 수 있다.
- [ ] 선택 발송은 이메일/닉네임 검색, 사용자별 체크, 현재 검색 결과 전체 선택/해제를 지원한다.
- [ ] 푸시 토큰이 없는 사용자는 선택할 수 없고 이유가 표시된다.
- [ ] 제목/본문 글자 수, JSON 오류, 대상 수를 발송 전에 보여준다.
- [ ] 발송 전 확인 단계에서 대상 범위와 예상 인원을 다시 표시한다.
- [ ] 발송 후 대상·성공·실패·무효 토큰 정리 결과를 표시한다.
- [ ] 모바일 화면과 키보드 탐색에서도 사용할 수 있다.

## Testing Strategy

- `PushNotificationPanel` component tests: mode switching, selection, validation, confirmation, payload.
- `adminApi` test: `userIds` payload forwarding and `hasPushToken` response mapping.
- `pushNotificationContract` test: selected user IDs are trimmed, deduplicated, and bounded.
- Admin typecheck, lint, unit tests, and production build.

## Security

- 관리자 Edge Function의 기존 `requireAdmin`을 변경하지 않는다.
- 서버에서 사용자 ID·메시지 길이·데이터 크기를 계속 재검증한다.
- raw push token은 API response와 화면에 노출하지 않는다.

## Commands

```powershell
rtk npm run test --workspace @gonggu/admin
rtk npm run build --workspace @gonggu/admin
rtk npm run lint --workspace @gonggu/admin
```
