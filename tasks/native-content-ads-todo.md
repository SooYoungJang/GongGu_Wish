# Todo: 릴스·제품 상세 네이티브 미디어 광고

- [x] 광고 런타임 계약 실패 테스트 작성
  - Acceptance: Android/iOS 테스트 ID, 세 placement, `adsRemoved` 우선순위가 테스트로 고정됨
  - Verify: `npx vitest run src/ads/adConfig.test.ts`

- [x] Expo AdMob 설정 실패 테스트 작성
  - Acceptance: iOS/Android 앱 ID와 세 광고 단위의 누락·형식·publisher 불일치가 거부됨
  - Verify: `npx vitest run src/ads/appConfig.test.ts`

- [x] 릴스 광고 배치 실패 테스트 작성
  - Acceptance: 첫 광고 위치와 반복 간격, 빈 목록, 광고 비활성 상태가 테스트로 고정됨
  - Verify: `npx vitest run src/screens/reelsAdPlacement.test.ts`

- [x] 플랫폼 공통 AdsProvider 및 구독 경계 구현
  - Acceptance: Android/iOS에서 초기화 가능하고 `adsRemoved`가 광고 요청을 차단함
  - Verify: 관련 단위/컴포넌트 테스트

- [x] 공통 네이티브 미디어 광고 컴포넌트 구현
  - Acceptance: `home`, `reels`, `detail` 레이아웃과 광고 단위 선택, 객체 정리가 동작함
  - Verify: 관련 컴포넌트 테스트와 타입 검사

- [x] 릴스·상세 화면 통합
  - Acceptance: 릴스 광고 슬롯과 상세 하단 광고가 콘텐츠 탐색을 방해하지 않음
  - Verify: 화면 테스트 및 가능한 런타임 확인

- [x] 전체 품질 게이트와 위키 기록
  - Acceptance: 테스트·타입·린트·Expo config 검증 결과가 기록됨
  - Verify: 명령 출력과 위키 보고서

- [ ] 커밋·푸시·develop PR·CI·머지
  - Acceptance: 필수 CI 통과 후 `develop`에 반영됨
  - Verify: GitHub PR 상태
