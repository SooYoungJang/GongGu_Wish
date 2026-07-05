# apps/mobile 작업 가이드

이 디렉토리는 React Native (Expo) 모바일 앱 코드베이스다.

## 디자인 시스템 (필수)

UI 작업 전 반드시 아래 문서를 먼저 읽는다.

src/design/DESIGN_SYSTEM.md

이 문서는 색상, 간격, 라운드, 타이포그래피 토큰과 useCommerceTheme() 훅, 그리고 재사용 컴포넌트(CommerceCard, CommerceChip, CommerceSearchField, CommerceSectionTitle, CommerceSurface)와 SText 의 사용법을 정의한다. 새 컴포넌트를 만들기 전에 기존 디자인 시스템으로 해결되는지 먼저 확인한다.

## 주요 명령

```sh
npm start          # Expo dev 서버 (포트 8081)
npm run typecheck  # tsc --noEmit
npm test           # vitest run --passWithNoTests
npm run lint       # eslint src
```

## 디렉토리 구조

```sh
src/design/                 # 디자인 토큰 (commerce.ts, tokens.ts, tokensDark.ts), 테마 훅
src/components/commerce/     # 재사용 커머스 컴포넌트 (CommerceUI.tsx)
src/components/ui/           # 프리미티브 (SText, LineGlyphs)
src/components/ranking/      # 셀러 랭킹 도메인 컴포넌트
src/components/              # 도메인 컴포넌트 (DealCard, AlertCard, AppButton, ...)
src/screens/                 # 화면 단위 (HomeScreen, SearchScreen, MyPageScreen, ...)
src/context/                 # ThemeContext (ThemeProvider, useTheme)
src/features/                # 도메인 타입/훅 (ranking/types.ts, useSellerRankings.ts)
```

## 테마 접근 규칙

새 코드에서 색상이나 토큰을 쓸 때는 src/design/tokens.ts 에서 직접 import 하지 않는다. useCommerceTheme() 훅을 사용한다. 이 규칙은 라이트/다크 모드 자동 전환을 보장한다. 자세한 내용은 DESIGN_SYSTEM.md 참조.

## 그 외

src_back/ 디렉토리는 백업/이전 버전 소스이므로 참고용으로만 쓴다. 새 작업은 src/ 에서 한다.
evidence/, screenshots/ 는 QA 산출물이므로 커밋하지 않는다.

## 플랫폼 규칙 (필수)

모든 모바일 앱 작업은 iOS와 Android 양쪽 모두를 대상으로 한다. 한쪽만 구현하지 않는다.

- 네이티브 기능(푸시 알림, 권한, 백그라운드 처리, 카메라, 저장소 등)을 다룰 때는 iOS와 Android 설정을 항상 같이 처리한다.
- `app.json`의 플랫폼별 설정(`ios`, `android`)을 변경할 때 두 플랫폼 섹션을 모두 확인한다.
- 플랫폼 분기가 필요한 코드는 `Platform.select` 또는 `Platform.OS`를 사용하고, iOS/Android/default를 모두 명시한다.
- iOS는 `infoPlist` 권한 사유, `UIBackgroundModes` 등 Info.plist 설정이 필요할 수 있으니 누락하지 않는다.
- Android는 `AndroidManifest.xml` 권한, notification channel 등 설정이 필요할 수 있으니 누락하지 않는다.
- 검증 시 iOS 시뮬레이터와 Android 에뮬레이터 양쪽에서 동작을 확인하는 것을 원칙으로 한다.

## 릴스 바텀시트/미디어 애니메이션 교훈 (필수)

릴스 화면에서 더보기/검색 바텀시트와 영상·이미지 영역을 수정할 때는 아래 원칙을 따른다.

- 닫힌 상태의 릴스 미디어는 화면을 꽉 채워야 한다. 바텀시트가 없을 때 미디어를 미리 축소하거나 상하 여백을 만들지 않는다.
- 바텀시트가 올라오면 미디어가 바텀시트 뒤에 가려지는 방식이 아니라, 인스타그램 릴스처럼 바텀시트 위의 남은 영역으로 위치가 올라가야 한다.
- 바텀시트가 열릴 때 헤더/우측 액션/하단 정보 등 릴스 크롬은 자연스럽게 사라지고, 미디어는 헤더가 있던 영역까지 활용할 수 있어야 한다.
- 미디어를 단순히 작게 스케일만 하면 주요 피사체가 바텀시트 뒤에 남을 수 있다. 풀스크린 미디어의 중심을 열린 프레임 중심으로 이동시키는 계산을 함께 해야 한다.
- 바텀시트 열림/닫힘에 `withSpring` 같은 바운스 애니메이션을 기본으로 쓰지 않는다. 사용자가 명시하지 않는 한 `withTiming`과 완만한 cubic easing을 사용한다.
- 더보기 바텀시트와 검색 바텀시트는 같은 미디어 프레임 계산을 공유해야 한다. 한쪽만 자연스럽고 다른 쪽이 다르게 움직이면 안 된다.
- Android 실제 기기에서 키보드, 바텀시트, 영상 transform이 동시에 움직일 때 성능 문제가 잘 드러난다. JS 스레드 애니메이션보다 Reanimated shared value 기반 네이티브 스레드 애니메이션을 우선한다.
- Expo Go에서 확인할 수 있도록 수정 후에는 8081 Metro를 재시작하고, 캐시 영향이 의심되면 `npx expo start --clear --port 8081`로 재실행한다.
- 관련 회귀 테스트에는 최소한 “바텀시트가 열린 높이”, “미디어 프레임이 바텀시트 위에서 끝나는지”, “미디어 내부 translate가 프레임 중심으로 이동하는지”, “바운스 spring을 쓰지 않는지”를 검증한다.
