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

## GON-263 Implementation Plan: 핵심 계약·랭킹·영상 회귀 검증

실제 로컬 Supabase 경계와 네이티브 앱 여정을 분리해 검증한다. 단위 테스트의 mock 성공만으로 완료하지 않고, CI에서 migration → Auth/Edge/PostgREST → 모바일 공개 응답을 한 번에 통과시키며 Android에서 동일한 사용자 여정과 영상 수명주기를 녹화한다.

### Decisions

- 모바일 Supabase URL은 `EXPO_PUBLIC_SUPABASE_URL`로 주입하고, 미설정 시 기존 production URL을 유지한다.
- 계약 검증은 production 데이터를 변경하지 않고 CI의 로컬 Supabase에만 fixture를 만들고 정리한다.
- 실패 로그는 `setup`, `admin-save`, `admin-list`, `public-fetch`, `ranking` 단계로 구분한다.
- Maestro 흐름은 Android/iOS 공용 selector를 사용하되, 현재 Windows 환경의 실행 증거는 Android에서 수집한다.
- 각 구현 slice는 관련 테스트를 먼저 실패시킨 뒤 최소 변경으로 통과시키고 원자적으로 커밋한다.

### Tasks

- [x] 로컬 Supabase URL 주입 계약 테스트와 구현
- [x] 가격 200000·홈 배너 false의 Admin Edge → DB → Admin list → Public REST 검증
- [x] 랭킹 category/sort/period/cursor의 실제 RPC/Edge 일관성 검증
- [x] 알림 실패·빠른 중복 탭·빈값/오류/no-mock 회귀 테스트 보강
- [x] 홈 → 캘린더 → 상세, 랭킹 → 마이 → 상세 공용 Maestro 여정 추가
- [x] Reels blur/background/back/100 swipes와 Android sheet/back 회귀 흐름 추가
- [x] Android 실행·녹화 증거와 플랫폼 공용 재현 절차 기록
- [x] 전체 테스트·린트·타입·빌드, 독립 리뷰, PR CI와 main CI 완료

### Checkpoints

- Contract: 로컬 Supabase에서 migration과 실제 HTTP 경계 검증 통과
- Domain: 랭킹·알림·canonical data·no-mock 회귀 테스트 통과
- Native: Android 핵심 여정과 영상 수명주기 녹화 및 로그 보존
- Delivery: 위키·Linear 갱신, PR merge, 로컬 `main` fast-forward

## GON-264 Implementation Plan: 접근성·Dynamic Type·오류·캐시 정책

React Native 0.83과 TanStack Query 5의 공식 API를 기준으로 숨겨진 중복 UI를 접근성 트리에서 제외하고, 큰 글꼴에서도 캘린더와 랭킹 레이아웃이 콘텐츠 높이에 맞게 확장되도록 한다. 네트워크 데이터는 전역 Query 정책과 GET no-store 요청 경계를 통해 즉시 stale 처리하고, 화면마다 다른 empty/error/retry 표현을 공통 상태 컴포넌트로 통일한다.

### Decisions

- `AppState`를 TanStack `focusManager`에 연결하고 전역 `staleTime: 0`, mount/focus/reconnect 재검증, transient 오류 1회 재시도 정책을 한 곳에서 관리한다.
- PostgREST GET 요청은 `Cache-Control: no-cache, no-store, max-age=0`로 HTTP cache를 우회하며, Query cache는 화면 전환 성능을 위해 메모리에서 유지하되 항상 stale로 취급한다.
- RN 0.83에 없는 `dialog` accessibility role은 만들지 않고 `accessibilityViewIsModal`, Android 중요도, 제목 label, `Modal.onShow` announcement를 사용한다.
- 숨겨진 GNB는 `display: none`, sticky 원본은 `accessibilityElementsHidden`과 `importantForAccessibility="no-hide-descendants"`로 트리에서 제외한다.
- `useWindowDimensions().fontScale`을 레이아웃 입력으로 사용해 캘린더 row height와 랭킹 상위 카드 배열을 동적으로 계산한다.
- 오류가 나도 이전 데이터가 있으면 stale 경고와 retry를 함께 보여주고, 첫 요청 실패·empty 상태는 공통 `AsyncStateNotice`로 구분한다.

### Tasks

- [x] Query client 기본 정책·AppState focus bridge·query error 관측을 RED/GREEN으로 구현
- [x] PostgREST GET no-store 헤더와 화면별 retry override 제거
- [x] GNB/sticky duplicate 접근성 제외와 배너 자동 회전 접근성 선호 반영
- [x] DealCard의 상품명·가격·판매자·마감 label 보강
- [x] 캘린더 fontScale 기반 row/card 높이와 scroll offset 연결
- [x] 랭킹 상위 카드·일반 행·필터를 큰 글꼴에서 확장 가능한 구조로 변경
- [x] 캘린더·랭킹·마이·제보 Modal의 제목·격리·announcement 적용
- [x] 공통 stale/empty/error/retry UI를 홈·캘린더·랭킹·검색·Reels에 적용
- [x] 광범위 LogBox ignore 제거, 전체 테스트·Android TalkBack/큰 글꼴 런타임 증거 검증
- [x] 위키·Linear·PR·CI·merge·main 동기화

### Checkpoints

- Foundation: Query/cache 정책 단위 테스트와 기존 API 테스트 통과
- Accessibility: 중복 트리·label·motion·modal 컴포넌트 테스트 통과
- Dynamic Type: fontScale 1.0/2.0 레이아웃 테스트와 Android 큰 글꼴 화면 검증
- Delivery: 전체 workspace gate, Android E2E 증거, 코드 리뷰, PR/main CI 통과

### Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| 모든 query를 stale로 두어 요청량 증가 | Medium | in-flight dedupe와 화면 focus 경계만 사용하고 polling은 추가하지 않음 |
| 큰 글꼴에서 FlatList offset 불일치 | High | fontScale별 동일 height 함수를 row style/getItemLayout/fallback offset이 공유 |
| modal announcement 중복 발화 | Medium | visible effect 대신 `Modal.onShow`에서 1회만 발표 |
| stale 데이터가 최신 가격·배너처럼 보임 | High | background refetch 실패 시 stale 경고와 retry 노출, GET no-store 적용 |

### Open Questions

- 없음. Android를 런타임 검증 기준으로 사용하며 iOS 빌드는 이번에도 실행하지 않는다.

## GON-229 Implementation Plan: Android 푸시 선호·예약·딥링크

기존 Expo Push Service와 GON-259 per-group-buy 알림 store를 유지하면서 사용자 선호를 local/server 양쪽에 저장한다. Android DATE trigger 다중 예약과 React Navigation linking을 연결하고, admin-api audience 선택은 같은 선호 계약으로 필터링한다.

### Decisions

- FCM 직접 구현 대신 승인된 Expo Push Service ADR을 따른다.
- 기존 사용자는 현재 동작을 유지하도록 모든 boolean을 true, reminder days를 `[1, 3, 7]`로 migration한다.
- preference는 AsyncStorage에 즉시 반영하고 인증 사용자는 `register-push-token` Edge Function으로 upsert한다.
- local reminder는 공구 종료일 기준 미래 D-7·D-3·D-1을 모두 예약하며 legacy 단일 ID를 계속 취소한다.
- notification payload는 `gongguwish://group-buy/:groupBuyId`로 canonicalize하고 React Navigation linking이 cold/live response를 함께 처리한다.
- 운영 push credential 실발송과 iOS 검증은 범위에서 제외한다.

### Phases

1. 선호·payload·audience·reminder contract와 additive migration을 RED/GREEN으로 고정
2. AsyncStorage/context·Edge preference sync·token unregister 구현
3. Settings와 Detail follow UX, 다중 reminder 저장·재조정 구현
4. notification response linking과 ID-only Detail loader 구현
5. Android Maestro/ADB 증거, workspace gate, review, PR CI

### Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| push OFF인데 token이 남음 | High | 서버 sync에서 token/provider를 원자적으로 null 처리하고 audience도 push_enabled filter |
| legacy 단일 알림이 취소되지 않음 | High | singular+array ID를 dedupe해 모두 취소하는 migration-free reader |
| cold start에서 navigator 준비 전 이동 유실 | High | React Navigation 공식 linking의 getInitialURL/subscribe 사용 |
| 잘못된 payload가 임의 URL을 엶 | High | scheme·host·ID allowlist와 typed audience validation |
| 기존 사용자 전체 알림이 갑자기 꺼짐 | High | DB·local normalization 기본값을 기존 활성 상태로 고정 |

### Delivery Boundary

- 로컬 구현·검증·PR CI까지 자동 진행한다.
- additive migration이 production에 적용되는 main merge는 별도 승인 후 실행한다.
