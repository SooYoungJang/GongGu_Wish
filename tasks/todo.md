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
- [ ] CI 로그가 실패 계층을 식별하고 Android E2E 증거가 위키에 인라인 기록됨
- [ ] 전체 게이트·PR CI·merge·main CI·로컬 main 동기화 완료
