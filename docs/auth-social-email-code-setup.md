# 모바일 Auth 설정 체크리스트

이 문서는 모바일 앱의 로그인/회원가입 플로우를 운영 환경에서 동작시키기 위한 외부 설정 목록이다.

## 앱에서 지원하는 방식

- Android: 카카오, 네이버, 이메일
- iOS: 카카오, 네이버, Apple, 이메일
- 이메일 회원가입: 링크 클릭 대신 앱 안에서 6자리 인증번호 입력
- 이메일 인증번호 입력 제한: 앱 UI 기준 5분

## Supabase Auth URL 설정

Supabase Dashboard > Authentication > URL Configuration에서 다음을 설정한다.

- Site URL: 운영 웹 URL. 운영 전 임시로는 `gongguwish://auth/callback` 사용 가능
- Additional Redirect URLs:
  - `gongguwish://auth/callback`

앱 scheme은 [apps/mobile/app.json](/Users/pc/Documents/RN_GongGu_Wish/apps/mobile/app.json)에 `gongguwish`로 설정되어 있다.
iOS 앱 설정에는 Apple 로그인 심사 대응을 위해 `ios.usesAppleSignIn: true`도 켜져 있다.

## OAuth Provider 설정

### Kakao

Supabase Dashboard > Authentication > Providers > Kakao를 활성화한다.

- Kakao REST API key를 Supabase `Client ID`로 등록
- Kakao Login Client Secret을 Supabase `Client Secret`으로 등록
- Kakao Developers Redirect URI에는 Supabase callback URL을 등록
  - `https://iosdoheblabfimkjnvfj.supabase.co/auth/v1/callback`
- Kakao 이메일 동의 항목을 쓰지 못하는 경우 Supabase Kakao provider에서 `Allow users without an email`을 켠다.

### Naver

Supabase 기본 provider 목록에는 Naver가 없으므로 Custom OAuth/OIDC provider로 설정한다.

- Custom provider identifier는 코드와 맞추기 위해 반드시 `naver`로 둔다.
- 앱 코드 provider 값은 `custom:naver`이다.
- Naver Developers callback URL에는 Supabase callback URL을 등록
  - `https://iosdoheblabfimkjnvfj.supabase.co/auth/v1/callback`

identifier를 `naver`가 아닌 다른 값으로 만들면 [authHelpers.ts](/Users/pc/Documents/RN_GongGu_Wish/apps/mobile/src/utils/authHelpers.ts)의 `custom:naver` 값을 같이 바꿔야 한다.

### Apple

iOS에서만 Apple 로그인 버튼을 노출한다.

- Apple Developer에서 Sign in with Apple 설정
- Expo/EAS 빌드 시 Apple Sign In capability가 포함되는지 확인한다.
- Supabase Dashboard > Authentication > Providers > Apple 활성화
- Apple callback/redirect 설정에는 Supabase callback URL을 등록
  - `https://iosdoheblabfimkjnvfj.supabase.co/auth/v1/callback`
- App Store 심사 기준상 카카오/네이버 같은 타사 로그인을 제공하면 Apple 로그인도 iOS에서 반드시 함께 노출되어야 한다.

## 앱 딥링크 확인

OAuth 완료 후 앱으로 돌아오는 URL은 `gongguwish://auth/callback`이다.

기기/시뮬레이터에서 다음을 확인한다.

- Kakao/Naver/Apple 로그인 후 브라우저에서 앱으로 복귀한다.
- 콜백 URL에 포함된 OAuth `code`가 앱에서 `exchangeCodeForSession`으로 세션 교환된다.
- Supabase Dashboard > Authentication > URL Configuration의 Additional Redirect URLs에 `gongguwish://auth/callback`이 정확히 등록되어 있다.

## 이메일 인증번호 설정

Supabase Dashboard > Authentication > Email Templates에서 Confirm signup 또는 Magic Link 템플릿을 링크 중심이 아니라 코드 중심으로 바꾼다.

필수:

- 메일 본문에 `{{ .Token }}`을 표시한다.
- `{{ .ConfirmationURL }}` 중심 CTA는 제거하거나 보조로만 둔다.
- 사용자가 앱 안의 인증번호 입력 화면에 6자리 코드를 입력하도록 안내한다.

예시 문구:

```text
공구위시 이메일 인증번호는 {{ .Token }} 입니다.
이 번호를 앱에 입력해 주세요. 5분이 지나면 다시 발급해야 합니다.
```

Supabase OTP 만료 시간도 가능하면 300초로 맞춘다. 앱 UI는 5분 타이머로 입력을 막지만, 실제 보안 만료는 Supabase Auth 설정이 최종 기준이다.

## 코드 기준점

- OAuth 시작/딥링크 세션 교환: [AuthContext.tsx](/Users/pc/Documents/RN_GongGu_Wish/apps/mobile/src/context/AuthContext.tsx)
- 플랫폼별 소셜 provider 목록: [authHelpers.ts](/Users/pc/Documents/RN_GongGu_Wish/apps/mobile/src/utils/authHelpers.ts)
- 로그인/회원가입 화면: [AuthScreen.tsx](/Users/pc/Documents/RN_GongGu_Wish/apps/mobile/src/screens/AuthScreen.tsx)
- Supabase PKCE/session storage 설정: [supabase.ts](/Users/pc/Documents/RN_GongGu_Wish/apps/mobile/src/lib/supabase.ts)
