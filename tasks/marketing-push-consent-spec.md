# Spec: 마케팅 광고성 푸시 발송

## Objective

기존 Expo 푸시 발송 기능에 광고성 마케팅 발송 모드를 추가한다. 사용자가 명시적으로 동의한 경우에만 마케팅 푸시를 받을 수 있고, 동의 철회는 서버 발송 대상에서 즉시 제외되어야 한다. 공구 오픈·마감 등 사용자가 설정한 서비스 알림은 기존 동작을 유지한다.

## Scope and boundaries

- 기존 `POST /admin/notifications`와 `register-push-token` 계약을 확장한다.
- 회원가입의 선택 동의와 마이페이지의 동의·철회를 `public.users`에 저장한다.
- 관리자 화면에 `마케팅 수신동의 사용자` 발송 모드를 추가한다.
- 마케팅 푸시는 서버에서 `(광고)`를 제목 앞에 붙이고 `push_enabled = true` 및 `marketing_push_enabled = true`인 사용자만 대상으로 한다.
- 예약 발송, 캠페인 저장·이력·통계, 이메일·SMS 발송은 이번 범위에 포함하지 않는다.
- 기존 서비스 알림 대상 필터와 일반 관리자 푸시의 의미는 변경하지 않는다.

## API contract

- `NotificationPreferences.marketingPushEnabled: boolean`을 additive하게 추가한다. 기본값은 `false`다.
- `POST /admin/notifications`에 선택적 `marketing: boolean`을 추가한다. `true`이면 서버가 마케팅 대상 필터와 `(광고)` 표기를 강제한다.
- 기존 응답의 `targeted`, `sent`, `failed`, `preferenceFiltered`, `invalidTokensRemoved`, `provider`를 유지한다.

## Acceptance criteria

- 회원가입에서 선택 동의한 사용자는 서버 프로필에 동의 상태가 기록된다.
- 신규 사용자와 기존 미동의 사용자는 마케팅 수신이 기본 해제다.
- 마이페이지에서 마케팅 수신을 켜면 필요한 경우에만 OS 푸시 권한을 요청하고, 끄면 서버 상태가 즉시 철회된다.
- 관리자 마케팅 발송은 동의하지 않은 사용자에게 토큰이 있어도 전송하지 않는다.
- 마케팅 제목은 중복 없이 `(광고)`로 시작하고, 기존 서비스 알림 제목은 변경하지 않는다.
- 입력 검증·권한 검증·토큰 비노출·실패한 토큰 정리는 기존 보안 계약을 유지한다.

## Commands

```powershell
rtk npm run test --workspace=@gonggu/mobile -- --run
rtk npm run typecheck --workspace=@gonggu/mobile
rtk npm run lint --workspace=@gonggu/mobile
rtk npm run test --workspace=@gonggu/admin -- --run
rtk npm run build --workspace=@gonggu/admin
rtk npm run lint --workspace=@gonggu/admin
rtk deno test supabase/functions/admin-api/pushNotificationContract.test.ts supabase/functions/admin-api/pushNotifications.test.ts supabase/functions/register-push-token/contract.test.ts
rtk git diff --check
```

## Security

- 클라이언트의 동의 여부를 신뢰하지 않고 발송 Edge Function에서 최종 필터링한다.
- raw push token은 관리자 응답·로그·UI에 노출하지 않는다.
- 마케팅 메시지는 서버에서 표기를 강제해 관리자 입력 누락을 방지한다.
- 동의 시각·버전·출처와 철회 시각을 프로필에 남겨 처리 근거를 보존한다.
- 서비스 롤과 Expo 자격 증명은 저장소에 추가하지 않는다.

## Testing strategy

- Deno contract tests: 동의 필드 기본값·정규화·마케팅 대상 필터·제목 표기.
- mobile unit tests: 로컬/원격 preference round-trip 및 설정 토글 동작.
- admin component tests: 마케팅 발송 모드 payload와 확인 단계.
- 기존 모바일·관리자 전체 테스트와 타입체크·린트를 완료한다.
