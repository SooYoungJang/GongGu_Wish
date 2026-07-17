# Task Checklist: 관리자 상세 실시간 앱 프리뷰

## Task 1: 가격·홈 배너 데이터 계약

- [x] `gonggu_submissions`와 `group_buys`에 가격/배너 필드 추가
- [x] 관리자 API가 필드를 검증·반환·수정·승인 복사
- [x] 기존 활성 공구의 배너 기간 backfill
- Verify: API 단위 테스트, shared/mobile 타입 검사

## Task 2: 실제 앱 홈 배너 연결

- [x] `priceKrw`를 할인 문자열 파싱보다 우선 표시
- [x] 토글이 켜지고 오늘이 inclusive 범위 안인 공구만 배너 표시
- [x] 일반 주간/추천 목록에는 배너 필터를 적용하지 않음
- Verify: `HomeScreen` 및 기간 판정 Vitest

## Task 3: Hiker 자동 완성

- [x] caption/hashtag에서 빈 제품명과 카테고리 추론
- [x] media items/video URL에서 미디어 타입 자동 산출
- [x] 기존 관리자 입력 보존
- Verify: 추론 helper Vitest와 Hiker 적용 테스트

## Task 4: 날짜 UX와 프리뷰

- [x] 필드 전체 클릭 가능한 중앙 달력
- [x] 홈 배너·공구 카드·상세 프리뷰가 양 상세 폼에서 실시간 갱신
- [x] 320px부터 데스크톱까지 가로 스크롤 없이 동작
- Verify: component test와 Playwright Desktop/Mobile Chrome/Mobile Safari

## Task 5: 레거시 UI 제거와 완료 검증

- [x] 종일 공구·이달의 공구·미디어 타입 수동 입력 제거
- [x] 호출되지 않는 월간 캐러셀과 전용 helper/test 제거
- [x] 테스트·린트·타입·빌드·E2E 증거를 위키에 기록
- [x] 독립 review와 후속 재검토 통과
- [ ] commit, push, PR, CI, merge, local main fast-forward
- Verify: repo-wide 영향 테스트와 CI

## GON-260 체크리스트

- [x] 랭킹 관련 기존 컴포넌트와 `StoreScreen` 흐름 확인
- [x] 상위 1~3위 grouping/label/click target 회귀 테스트 작성
- [x] 상위 3위 hero/compact presentation 구현
- [x] 4위 이후 목록·집계 설명·sticky filter header 연결
- [x] null 가격·미디어 fallback·접근성 target 자동 검증
- [x] workspace test/typecheck/build/lint 실행
- [ ] 코드 리뷰 및 Linear/wiki/PR/CI/main 동기화

## GON-263 체크리스트

- [x] `EXPO_PUBLIC_SUPABASE_URL`이 PostgREST/Auth/Edge에 동일하게 적용됨
- [x] `priceKrw=200000`이 Admin save → DB → Admin list → public mobile 응답에서 보존됨
- [x] `isHomeBanner=false` 저장 후 preview/RN home 공개 응답에서 노출되지 않음
- [x] 랭킹 category/sort/period/cursor가 실제 RPC와 Edge 응답에서 일치함
- [x] 알림 권한 거부·예약 실패·빠른 중복 탭 회귀가 자동 검증됨
- [x] 랭킹 → 마이 → 상세와 홈 → 캘린더 → 상세가 canonical id/data를 유지함
- [x] Reels blur/background/hardware back/100 swipes와 sheet 우선 닫기가 재현됨
- [x] empty/error/stale 경로가 mock fallback으로 바뀌지 않음
- [x] CI 로그가 실패 계층을 식별하고 Android E2E 증거가 위키에 인라인 기록됨
- [x] 전체 게이트·PR CI·merge·main CI·로컬 main 동기화 완료

## GON-264 체크리스트

### Task 1: Query·HTTP cache 기반

- [x] 전역 stale/retry/refetch/gc 정책과 transient 오류 판정 테스트
- [x] React Native `AppState`가 Query focus 상태를 갱신
- [x] GET 요청 no-store 헤더와 query 실패 구조화 로그 검증
- Verify: query-client/postgrest 단위 테스트, mobile typecheck

### Task 2: 접근성 트리·label·motion

- [x] 숨은 GNB와 sticky 원본이 TalkBack 트리에 남지 않음
- [x] DealCard가 상품명·가격·판매자·마감 상태를 한 label로 읽음
- [x] Reduce Motion 또는 스크린리더 사용 시 홈 배너 자동 회전이 정지
- Verify: App/Home/DealCard RED-GREEN 테스트

### Task 3: Dynamic Type

- [x] 캘린더 row/card/scroll offset이 fontScale 2.0에서도 일치
- [x] 랭킹 상위 카드가 큰 글꼴에서 세로 배열되고 텍스트가 잘리지 않음
- [x] 고정 control height는 minHeight+padding으로 전환
- Verify: Calendar/Ranking component test, Android 큰 글꼴 screenshot

### Task 4: Modal·비동기 상태

- [x] 4개 Modal에 제목·modal isolation·onShow announcement 적용
- [x] 공통 stale/empty/error/retry 상태를 주요 데이터 화면에 적용
- [x] 광범위 LogBox ignore 제거 후 관측 가능한 오류 0건 확인
- Verify: modal/state component test, TalkBack 탐색, logcat

### Task 5: 완료 검증과 배송

- [x] mobile/workspace test·typecheck·lint·build 통과
- [x] Android 좁은 화면·큰 글꼴·다크 모드·TalkBack E2E 증거 위키 기록
- [x] 코드 리뷰, PR CI, squash merge, main CI, 로컬 main 동기화

## GON-229 체크리스트

### Task 1: Preference·DB·Edge contract

- [ ] preference normalize/default/storage contract 테스트
- [ ] additive Supabase·Prisma migration과 schema parity
- [ ] register/unregister token과 preference upsert 경계 검증
- [ ] admin-api audience 선호 필터와 구조화 결과/로그 검증

### Task 2: Android 다중 reminder

- [ ] endDate 기준 D-7·D-3·D-1 미래 trigger 계산
- [ ] 다중 native ID 저장·legacy 호환·전체 취소
- [ ] 선호 변경 시 기존 알림 재조정

### Task 3: Settings·follow UX

- [ ] push/마감/신규 제보 switch와 OS 권한 상태 분리
- [ ] D-1·D-3·D-7 선택과 최소 1개 guard
- [ ] Detail 인플루언서·브랜드 follow와 Settings 관리 chip
- [ ] loading/error/retry·접근성 label/state 검증

### Task 4: Notification deep link

- [ ] 안전한 payload URL canonicalization
- [ ] foreground/background/cold-start response linking
- [ ] ID-only Detail fetch loading/error/retry 화면

### Task 5: Android 배송

- [ ] targeted/mobile/workspace test·typecheck·lint·build
- [ ] Android 설정·follow·deep-link Maestro와 PNG/logcat 증거 위키 기록
- [ ] 독립 리뷰·PR CI 통과
- [ ] 운영 migration 승인 후 squash merge·main CI·로컬 main 동기화·Linear Done
