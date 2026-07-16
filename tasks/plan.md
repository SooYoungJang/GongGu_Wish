# Implementation Plan: 관리자 상세 실시간 앱 프리뷰

## Overview

DB/API 계약을 additive 방식으로 확장한 뒤 Hiker 자동 추론과 홈 배너 판정 로직을 테스트 우선으로 구현하고, 관리자 상세 UI와 실제 앱 홈을 연결한다. 마지막으로 미사용 월간 UI를 제거하고 브라우저 E2E 증거를 위키에 반영한다.

## Architecture Decisions

- `priceKrw`, `isHomeBanner`, `homeBannerStartDate`, `homeBannerEndDate`를 submission과 group buy에 모두 저장해 저장 후 승인 전후가 일관되게 한다.
- 홈 배너 기간은 공구 시작/마감과 독립된 date-only 범위이며 양끝을 포함한다.
- 기존 승인·미종료 공구는 additive migration 실행일부터 기존 종료일까지 backfill하고, 새 행은 기본 비노출이다.
- 프리뷰는 React Native를 웹에 임베드하지 않고 현재 앱의 데이터 우선순위·카피·레이아웃을 웹 전용 표현 컴포넌트로 재현한다.
- `is_monthly_featured`와 `is_all_day` DB 컬럼은 호환성을 위해 유지하되 관리자 입력과 미사용 월간 캐러셀을 제거한다.

## Task List

### Phase 1: Contract and logic

- [x] 가격·홈 배너 스케줄 계약 테스트와 additive migration 작성
- [x] `admin-api` select/map/patch/approve 경로에 새 필드와 검증 연결
- [x] 모바일 타입·매핑·홈 배너 활성 기간 필터와 가격 우선 표시 연결

### Checkpoint: Contract

- [x] API/공유/모바일 관련 단위 테스트와 타입 검사 통과

### Phase 2: Admin experience

- [x] Hiker 제품명·카테고리·미디어 타입 추론 로직을 테스트 우선 구현
- [x] 필드 전체 클릭과 중앙 표시를 지원하는 접근 가능한 달력 구현
- [x] 홈 배너·공구 카드·상세 화면 실시간 프리뷰 구현
- [x] 양 상세 폼에 가격·홈 배너 기간을 연결하고 종일/월간/미디어 타입 수동 입력 제거

### Checkpoint: Admin

- [x] 관리자 단위 테스트, 타입 검사, 린트, 빌드 통과

### Phase 3: Deprecation and verification

- [x] caller가 없는 월간 캐러셀 및 전용 관리자 helper 제거
- [x] 데스크톱·모바일 Playwright E2E와 시각 검증 수행
- [x] 위키 운영 문서·E2E 증거 갱신

### Checkpoint: Complete

- [x] 전체 수용 기준과 코드 리뷰 게이트 통과
- [ ] 의도한 파일만 커밋·푸시하고 PR CI 통과 후 merge

## Risks and Mitigations

| Risk                                           | Impact | Mitigation                                               |
| ---------------------------------------------- | ------ | -------------------------------------------------------- |
| 새 boolean 기본값 때문에 기존 홈 배너가 사라짐 | High   | 기존 승인·활성 행을 현재 공구 기간으로 backfill          |
| 날짜의 시간대 경계에서 하루 일찍 종료          | High   | date-only 로컬 비교와 inclusive 종료일 테스트            |
| Hiker 휴리스틱이 잘못된 값을 덮어씀            | Medium | 기존 관리자 입력은 보존하고 빈 값만 자동 채움            |
| 웹 프리뷰와 앱 카피가 어긋남                   | Medium | 앱의 실제 우선순위와 가격/상태 규칙을 테스트 사례로 복제 |
| DB column drop이 롤백을 어렵게 함              | High   | 이번 변경은 additive-only, legacy 컬럼 drop 금지         |

## Open Questions

- 없음.

## GON-260 Implementation Plan: 랭킹 UI 리디자인

GON-258에서 확정한 공구 랭킹 계약과 GON-259의 공구 알림 상태를 기존 모바일 랭킹 화면에 연결한다. 화면 제목과 집계 설명을 명확히 하고, 상위 1위 hero·2~3위 compact·4위 이후 일반 목록을 분리하며, 필터 영역과 각 클릭 목적지의 접근성 경계를 보강한다.

### Decisions

- 기존 `usePopularGroupBuys`, `GroupBuyAlertButton`, detail/seller navigation 계약을 재사용한다.
- `StoreScreen`은 orchestration만 담당하고 순위별 presentation은 ranking component로 분리한다.
- 필터의 서버 요청 상태와 시각적 basis를 같은 값에서 만들고, 측정된 sticky header 높이로 목록 inset을 유지한다.
- 가격·상품명·이미지가 누락된 공구도 기존 보수적인 fallback을 사용한다.

### Tasks

- [x] 기존 랭킹 컴포넌트·StoreScreen 흐름과 의존성 확인
- [x] 상위 1~3위 grouping/label/click target 회귀 테스트 작성
- [x] 상위 3위 hero/compact presentation 구현
- [x] 4위 이후 목록·집계 설명·sticky filter header 연결
- [x] null 가격·미디어 fallback·접근성 target 자동 검증
- [x] workspace test/typecheck/build/lint 실행
- [ ] 코드 리뷰 및 Linear/wiki/PR/CI/main 동기화
