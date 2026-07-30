# Spec: 릴스·제품 상세 네이티브 미디어 광고

## Objective

- 릴스 피드에 일반 공구 영상과 같은 페이지 단위의 네이티브 미디어 광고를 삽입한다.
- 제품 상세 콘텐츠 하단에 네이티브 미디어 광고를 한 개 배치한다.
- Android와 iOS에서 동일한 React Native 계약을 사용한다.
- 향후 구독 시스템이 `adsRemoved=true`를 제공하면 광고 SDK 초기화와 광고 요청을 모두 차단한다.
- 광고가 비활성화되거나 로드에 실패하면 빈 공간이나 탐색 중단 없이 원래 콘텐츠만 표시한다.

## Tech Stack

- Expo `~55.0.27`
- React Native `0.83.6`
- React `19.2.7`
- `react-native-google-mobile-ads` `16.0.1`
- `react-native-pager-view` `8.0.0`
- Vitest `3.x`

## Commands

- Targeted tests: `npx vitest run src/ads src/components/ads src/screens/reelsAdPlacement.test.ts`
- Mobile tests: `npm test --workspace=@gonggu/mobile`
- Typecheck: `npm run typecheck --workspace=@gonggu/mobile`
- Lint: `npm run lint --workspace=@gonggu/mobile`
- Preview config: `npm run config:preview --workspace=@gonggu/mobile`
- Production config: `npm run config:production --workspace=@gonggu/mobile`

## Project Structure

- `apps/mobile/src/ads/`: 플랫폼별 광고 설정, SDK 초기화, 구독 광고 제거 경계
- `apps/mobile/src/components/ads/`: 공통 네이티브 미디어 광고 뷰
- `apps/mobile/src/screens/ReelsScreen.tsx`: 릴스 페이저 광고 페이지 통합
- `apps/mobile/src/screens/DetailScreen.tsx`: 상세 하단 광고 통합
- `apps/mobile/app.config.js`: Android/iOS AdMob 앱 ID와 광고 단위 검증
- `apps/mobile/src/**/*.test.*`: 순수 배치 로직과 설정 fail-closed 검증

## Code Style

```ts
const adAccess = resolveAdAccess({
  adsRemoved,
  runtimeConfig,
});

if (!adAccess.enabled) return null;
```

- 기존 디자인 토큰과 `StyleSheet.create`를 사용한다.
- 광고 단위 종류는 `home | reels | detail`로 명시한다.
- 플랫폼/환경 설정은 유효하지 않으면 광고를 끄는 fail-closed 방식을 유지한다.
- 광고 객체는 화면에서 제거될 때 반드시 `destroy()`한다.

## Product Behavior

- 릴스 광고는 유기 콘텐츠 8개를 먼저 보여준 뒤, 이후 유기 콘텐츠 10개마다 최대 한 번 삽입한다.
- 릴스 광고는 한 페이지를 차지하고 기본 음소거로 시작한다.
- 상세 광고는 주요 상세 콘텐츠와 액션을 가리지 않는 하단 영역에 표시한다.
- 네이티브 광고에는 `광고` 표기, AdChoices 공간, 광고 제목과 CTA를 유지한다.
- 광고 소재에 영상이 없으면 SDK가 제공하는 이미지를 표시한다.
- Preview는 Google 공식 테스트 앱/광고 단위 ID를 사용한다.
- Production은 각 플랫폼의 앱 ID와 `home`, `reels`, `detail` 광고 단위가 모두 같은 publisher에 속할 때만 활성화한다.

## Subscription Boundary

- `AdsProvider`는 `adAccessResolved?: boolean`과 `adsRemoved?: boolean` 입력을 받는다.
- 구독 상태 확인 중 `adAccessResolved=false`이면 유료 사용자에게 광고가 잠깐 보이지 않도록 모든 광고를 보류한다.
- `adsRemoved=true`이면 `enabled=false`, 모든 광고 단위 ID는 `null`이 된다.
- 구독 상태가 실행 중 변경되면 마운트된 광고 컴포넌트가 광고 객체를 정리한다.
- 실제 결제, 영수증 검증, 구독 복원은 이번 범위에 포함하지 않는다.

## Testing Strategy

- 순수 단위 테스트: 릴스 광고 위치 계산, 플랫폼별 테스트/Production ID 선택, 구독 광고 제거 우선순위
- 설정 테스트: iOS/Android 앱 ID와 세 광고 단위의 형식·publisher 일치 검증
- 컴포넌트 테스트: 광고 로드 실패 시 null, 광고 제거 시 요청 차단, 접근성 표기
- 회귀 테스트: 기존 홈 광고 위치와 E2E 광고 차단 유지
- 런타임 검증: 연결 가능한 Android/iOS 개발 빌드에서 Preview 테스트 광고 로드 확인

## Boundaries

- Always: 테스트 광고 사용, 광고 객체 정리, 구독 광고 제거 우선 적용, 로드 실패 시 콘텐츠 유지
- Ask first: 실제 AdMob Production ID 등록, Production 빌드 또는 배포, 구독 결제 구현
- Never: Production에서 Google 테스트 광고 노출, 핵심 액션을 광고로 가리기, 광고 클릭 유도 문구 추가

## Success Criteria

- Android/iOS Preview 런타임 설정이 각각 공식 테스트 네이티브 광고 단위를 반환한다.
- 릴스 광고 배치 함수가 첫 8개 콘텐츠 이전에는 광고를 넣지 않는다.
- 광고 활성 상태에서 릴스와 상세가 서로 다른 광고 단위를 요청한다.
- `adsRemoved=true`이면 어떤 화면에서도 광고 요청이 발생하지 않는다.
- 기존 홈 광고 동작과 자동화 E2E 광고 차단이 유지된다.
- 타입 검사, 린트, 관련 테스트가 통과한다.

## Sources

- https://docs.page/invertase/react-native-google-mobile-ads
- https://docs.page/invertase/react-native-google-mobile-ads/native-ads
- https://developers.google.com/admob/android/native
- https://developers.google.com/admob/ios/native
- https://developers.google.com/admob/ios/quick-start
