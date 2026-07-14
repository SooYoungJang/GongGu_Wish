# ADR: Expo Push Service를 통한 공통 원격 푸시

- 상태: 승인됨
- 날짜: 2026-07-14

## 문맥

앱은 Expo Notifications를 사용하고 있으며 iOS와 Android에 관리자 발송을 제공해야 한다. 기존 API에는 Firebase Admin 기반의 승인 알림 코드와 `fcm_token` 호환 필드가 있지만, 현재 모바일 토큰 등록 경로와 관리자 UI는 연결되어 있지 않다.

## 결정

새 기능은 Expo Push Service를 사용한다. 모바일은 `getExpoPushTokenAsync`로 토큰을 발급하고, Supabase 인증 Edge Function에 등록한다. 관리자는 기존 `admin-api` Edge Function을 통해 Expo Push API로 발송한다. 토큰 제공자는 `push_provider`로 구분하고 기존 `fcm_token`은 당장 제거하지 않는다.

## 이유

- 기존 Expo 앱 구조와 바로 맞는다.
- 한 번의 관리자 발송 계약으로 iOS/Android를 처리할 수 있다.
- Expo Push Service가 반환하는 ticket 오류로 무효 토큰을 정리할 수 있다.
- 향후 직접 FCM/APNs가 필요해져도 provider 필드로 점진적으로 확장할 수 있다.

## 운영 전제

- 원격 푸시는 Expo Go가 아닌 development build/release build에서 검증한다.
- EAS project ID와 iOS/Android push credentials는 환경과 EAS에 등록한다.
- Supabase migration과 Edge Function 배포는 운영 승인 후 실행한다.

## 참고

- [Expo push notifications setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [Expo notifications API](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Expo push service overview](https://docs.expo.dev/push-notifications/what-you-need-to-know/)
