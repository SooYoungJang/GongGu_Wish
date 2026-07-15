# Spec: 실제 푸시 발송과 관리자 발송 화면

## 목표

로그인한 모바일 사용자의 Expo Push Token을 안전하게 등록하고, 관리자 페이지에서 전체 또는 지정 사용자에게 제목·본문·JSON 데이터를 포함한 푸시를 실제 발송한다.

## 결정된 범위

- 발송 제공자는 Expo Push Service를 사용한다. 현재 모바일 앱이 Expo Notifications를 사용하고 iOS/Android를 같은 계약으로 처리할 수 있기 때문이다.
- 관리자 화면은 전체 발송과 검색·선택 사용자 발송을 모두 제공한다.
- 모바일은 Supabase 인증 JWT로 `register-push-token` Edge Function을 호출한다.
- 관리자는 기존 `admin-api` Edge Function의 `/admin/notifications` 경로를 호출한다.
- 기존 `fcm_token` 컬럼과 Firebase Admin 코드는 호환성을 위해 유지한다.

## 데이터 계약

- `users.push_token`: Expo Push Token
- `users.push_provider`: 현재 `expo`
- 모바일 등록 응답: `{ registered: true, provider: "expo" }`
- 관리자 발송 응답: `targeted`, `sent`, `failed`, `invalidTokensRemoved`, `provider`

## 보안·운영 경계

- 서비스 롤 키와 Expo/EAS 자격 증명은 저장소에 넣지 않는다.
- 토큰은 로그와 관리자 응답에 노출하지 않는다.
- 관리자 사용자 목록에는 raw `push_token` 대신 `hasPushToken`만 반환한다.
- 관리자 발송 전 UI에서 확인하고, 서버에서 제목·본문·데이터 크기와 대상 수를 다시 검증한다.
- 실제 DB migration 적용, Edge Function 배포, EAS credential 등록은 운영 단계에서 별도 실행한다.
- Expo Go에서는 원격 푸시를 검증하지 않고 development build 또는 release build를 사용한다.

## 성공 기준

- 인증된 실제 기기에서 앱 시작 후 Expo Push Token이 서버에 저장된다.
- 관리자 페이지에서 제목과 본문을 입력해 전송할 수 있다.
- Expo Push Service 성공/실패 수가 관리자 화면에 표시된다.
- `DeviceNotRegistered` 토큰은 다음 발송 대상에서 제외되도록 저장값이 정리된다.
- 모바일·관리자 테스트와 타입 검사/린트/빌드가 통과한다.
