# Implementation Plan: 홈 공구 요청 순위 페이지

## Overview

홈 공구 요청 티커의 탭 대상만 검색 화면에서 전용 순위 화면으로 바꾼다. 기존 요청 순위 RPC와 TanStack Query hook을 재사용하고, Root Stack에 새 화면을 등록한 뒤 모바일 회귀 테스트와 Preview 검증으로 전달한다.

## Architecture Decisions

- 기존 `GroupBuyRequestRanking` 계약과 `useGroupBuyRequestRankings`를 그대로 사용한다. DB/RPC limit은 변경하지 않는다.
- 기존 인기 공구 `StoreScreen`은 데이터 계약과 목적이 다르므로 재사용하지 않고, 요청 순위 전용 화면을 추가한다.
- 새 화면은 Root Stack route로 등록한다. 홈 탭의 GNB는 유지되고 뒤로가기는 stack pop으로 처리된다.
- 표시 상태는 `loading/error/empty/ready` 네 가지로 분리하고, 재시도는 query의 `refetch`를 호출한다.

## Task List

### Phase 1: Contract and RED tests

- [ ] Task 1: 새 Root Stack route와 홈 티커 탭 동작의 실패 테스트 추가
- [ ] Task 2: 요청 순위 화면의 성공·빈 상태·오류·접근성 테스트 추가

### Checkpoint: RED

- [ ] 새 테스트가 현재 코드에서 실패해 기존 검색 이동 동작을 증명한다.

### Phase 2: Vertical implementation

- [ ] Task 3: `GroupBuyRequestRankingsScreen`과 행 UI 구현
- [ ] Task 4: `RootStackParamList`·`App.tsx`·`HomeScreen.tsx` 연결

### Checkpoint: GREEN

- [ ] focused tests, typecheck, lint가 통과하고 홈→순위→뒤로 흐름이 동작한다.

### Phase 3: Review and delivery

- [ ] Task 5: 모바일 전체 테스트·build와 변경 diff 검토
- [ ] Task 6: 위키 보고서 작성, branch push, develop PR/Preview Green 확인

### Checkpoint: Complete

- [ ] 모든 success criteria 충족
- [ ] main/Production 미변경

## Dependency Graph

```text
GroupBuyRequestRanking hook
        │
        ├── GroupBuyRequestRankingsScreen + row UI
        │            │
        │            └── RootStack route registration
        │                         │
        └──────────── HomeScreen ticker navigation
```

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| 기존 Root Stack 타입과 route 등록 불일치 | High | route type·Stack.Screen·navigation call을 같은 slice에서 수정하고 typecheck 실행 |
| 요청 순위 응답 오류가 빈 배열로 보일 위험 | Medium | hook status를 그대로 분기하고 `AsyncStateNotice` error/empty를 별도 테스트 |
| 작은 화면에서 상품명이 잘림 | Medium | 2줄 제한·flex row·semantic spacing으로 320px 기준 테스트 |

## Verification Commands

- `npm test --workspace @gonggu/mobile -- src/screens/GroupBuyRequestRankingsScreen.test.tsx src/screens/HomeScreen.redesign.test.tsx`
- `npm test --workspace @gonggu/mobile`
- `npm run typecheck --workspace @gonggu/mobile`
- `npm run lint --workspace @gonggu/mobile`
- `npm run build --workspace @gonggu/mobile`
