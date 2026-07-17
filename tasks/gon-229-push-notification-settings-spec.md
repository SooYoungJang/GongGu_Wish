# Spec: GON-229 Android 푸시 알림 선호·예약·딥링크

## Objective

Android 사용자가 앱 푸시 수신, 공구 마감 임박, 신규 제보 알림을 각각 제어하고 D-1·D-3·D-7 중 원하는 시점을 선택한다. 공구 상세에서 인플루언서와 브랜드를 알림 대상으로 팔로우하며, 로컬·원격 알림을 탭하면 canonical 공구 상세로 이동한다. 기존 Expo Push Service와 GON-259 공구 알림 저장소를 확장하고 FCM 직접 발송 경로를 새로 만들지 않는다.

## Assumptions

- 런타임 승인 기준은 Android이며 Windows에서 iOS build/simulator는 실행하지 않는다.
- Expo SDK 55의 `expo-notifications`와 React Navigation 7 linking 계약을 사용한다.
- 기존 사용자 동작을 보존하기 위해 서버 선호 기본값은 모두 활성화하고 reminder days는 `[1, 3, 7]`로 둔다.
- 운영 push credential을 사용하는 실발송은 하지 않는다. 로컬 예약·notification response·서버 audience filter 계약과 Android development/release build로 검증한다.
- 사용자 선호를 원격 발송에 적용하기 위한 additive DB migration은 PR에 포함하되 운영 적용은 main merge 승인 경계로 둔다.

## Tech Stack

- React Native 0.83, Expo SDK 55, `expo-notifications` 55
- React Navigation 7, TanStack Query 5
- AsyncStorage offline-first preference cache
- Supabase Postgres, Edge Functions, Expo Push Service
- Vitest, Deno test, Maestro, Android ADB

## Contract

### User preferences

```ts
type NotificationPreferences = {
  pushEnabled: boolean;
  deadlineRemindersEnabled: boolean;
  newSubmissionsEnabled: boolean;
  reminderDays: Array<1 | 3 | 7>;
  followedInfluencers: string[];
  followedBrands: string[];
};
```

- 로컬 키는 인증 사용자와 guest namespace를 분리한다.
- 서버 `users` row에는 동등한 boolean·smallint[]·text[] 필드를 additive하게 저장한다.
- 입력은 경계에서 trim, case-insensitive dedupe, bounded length/count, reminder-day allowlist로 정규화한다.
- `pushEnabled=false`는 저장된 push token을 제거하며 이후 앱 시작에서 재등록하지 않는다.

### Notification payload

```ts
type NotificationData = {
  notificationType?: "general" | "new_submission" | "deadline" | "influencer" | "brand";
  groupBuyId?: string;
  influencerUsername?: string;
  brandName?: string;
  url?: `gongguwish://group-buy/${string}`;
};
```

- `groupBuyId`가 있으면 앱/Edge 경계에서 같은 canonical URL을 만든다.
- URL scheme과 non-empty ID를 검증하고 다른 scheme·host·malformed payload는 무시한다.
- Edge 발송은 `pushEnabled`를 항상 적용하고 notification type에 따라 신규 제보·마감·팔로우 선호를 추가 필터링한다.

### Local reminder

- 공구 `endDate`를 기준으로 선택된 D-7·D-3·D-1 중 미래 시점만 Android DATE trigger로 예약한다.
- content data에 `groupBuyId`, `notificationType: "deadline"`, canonical URL을 넣는다.
- 한 공구에 여러 native notification ID를 저장하고 해제·선호 변경 시 모두 취소한다.
- legacy 단일 ID는 읽고 취소할 수 있게 유지한다.

## Commands

```powershell
rtk npm test --workspace @gonggu/mobile
rtk npm run typecheck --workspace @gonggu/mobile
rtk npm run lint --workspace @gonggu/mobile
rtk deno test --allow-net supabase/functions
rtk npm test
rtk npm run typecheck
rtk npm run build
rtk npm run lint
```

Android E2E는 기존 GON-263 Android release harness에 GON-229 Maestro flow를 연결한다. iOS 명령은 실행하지 않는다.

## Project Structure

- `apps/mobile/src/context/NotificationPreferencesContext.tsx`: namespace별 선호 cache와 optimistic update
- `apps/mobile/src/services/notificationPreferences.ts`: 정규화·저장·Edge sync 계약
- `apps/mobile/src/services/notifications.ts`: Android 다중 reminder와 response listener
- `apps/mobile/src/navigation/notificationLinking.ts`: initial/live notification URL integration
- `apps/mobile/src/screens/SettingsScreen.tsx`: 선호·날짜·팔로우 관리 UX
- `apps/mobile/src/screens/DetailScreen.tsx`: seller/brand 팔로우와 ID-only detail loader
- `supabase/migrations/20260717000001_add_notification_preferences.sql`: additive user preference fields
- `supabase/functions/register-push-token/`: authenticated preference/token upsert
- `supabase/functions/admin-api/`: preference-aware Expo audience filtering
- `.maestro/`, `scripts/`: Android evidence flow

## Code Style

```ts
const next = normalizeNotificationPreferences({
  ...preferences,
  reminderDays: [7, 3, 1],
});

await updatePreferences(next);
```

- module boundary는 typed input/output을 먼저 정의한다.
- 외부 payload와 DB row는 untrusted data로 보고 normalize 후 사용한다.
- 로그는 stable event name과 bounded metadata만 남기고 token·email·user ID를 기록하지 않는다.
- 기존 API는 optional field 추가로만 확장한다.

## Testing Strategy

- Pure contract: preference normalization, payload URL parsing, audience matching, reminder dates
- Service: permission, multi-schedule, cancellation, token register/unregister, response subscription
- Component: Settings switch/day/follow chips, Detail seller/brand toggle, ID-only detail loading states
- Edge: preference validation, user upsert payload, audience filter, malformed target rejection
- Integration: migration/schema parity, existing admin/general push backward compatibility
- Android E2E: settings persistence, D-day selection, detail follow, app URL/detail transition, notification tree screenshots and logcat

## Boundaries

- Always: backward-compatible defaults, authenticated own-row writes, token redaction, retryable UI, Android evidence
- Ask before main merge: production migration and automatic Edge Function deployment
- Never: commit credentials, log raw push token, send production test push, build or claim iOS verification

## Success Criteria

- 세 가지 설정과 D-1·D-3·D-7 선택이 재실행 후 유지되고 인증 사용자는 서버 선호와 동기화된다.
- push OFF 사용자는 token이 제거되고 모든 원격 audience에서 제외된다.
- 신규 제보, 마감, 인플루언서, 브랜드 audience가 각각 opt-in 사용자만 선택한다.
- 공구 알림 한 건이 선택된 미래 reminder를 모두 예약하고 해제 시 모든 ID를 취소한다.
- foreground/background/cold-start notification response와 app URL이 같은 공구 상세를 연다.
- Android runtime evidence, 전체 테스트·타입·빌드·린트, PR CI가 통과한다.

## Open Questions

- 없음. 사용자 요청에 따라 iOS는 완료 조건에서 제외한다.
