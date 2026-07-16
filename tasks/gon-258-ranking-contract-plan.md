# Implementation Plan: GON-258 공구 랭킹 계약·서버 집계 v2

## Overview

셀러 중심의 기존 랭킹 응답을 `groupBuyId`가 필수인 공구 랭킹 계약으로 교체한다. category·period·sort를 집계 전에 서버에서 적용하고, 결정적 tie-break와 opaque cursor를 제공하며, 실패를 mock/빈 배열로 숨기지 않는다.

## Architecture Decisions

- `packages/shared/src/schemas/ranking.ts`를 모바일·웹·API가 공유하는 계약의 source of truth로 둔다.
- 응답은 `GroupBuyRankingResponse`의 `data`와 `pageInfo`로 고정하고, 공구 식별자는 `groupBuyId` 하나만 사용한다.
- Supabase에는 기존 `get_popular_group_buys` 호환 함수를 남기고, 새 `get_group_buy_rankings` RPC를 additive migration으로 추가한다.
- Edge Function은 새 RPC를 호출해 category·sort·period·cursor를 DB에 전달하며 mock 데이터로 fallback하지 않는다.
- 모바일은 서버가 정렬·필터·페이지 크기를 결정한 결과를 그대로 소비하고, 네트워크 오류와 성공한 빈 결과를 다른 상태로 표시한다.
- `scoreVersion`은 응답에 포함해 점수 공식 변경을 추적한다.

## Task List

### Phase 1: Contract and RED tests

- [ ] shared ranking query/item/response Zod schema와 타입 추가
- [ ] 모바일 API·hook·Edge contract 테스트를 먼저 작성해 현재 mock/legacy 동작을 실패시키기
- [ ] DB RPC의 category·sort·cursor·scoreVersion acceptance 사례를 SQL 테스트/검증 기준으로 정리

### Phase 2: Server aggregation

- [ ] 새 migration에서 rolling period별 metric CTE와 score v2 계산 추가
- [ ] category와 sort를 LIMIT 전에 적용하고 groupBuyId tie-break로 고정
- [ ] cursor를 기준으로 다음 페이지를 중복 없이 반환
- [ ] seller-rankings Edge Function을 공구 응답으로 교체하고 mock fallback 제거

### Checkpoint: Server contract

- [ ] Edge contract tests pass
- [ ] Supabase migration syntax/CI test pass when local Deno/Supabase CLI is unavailable
- [ ] Mobile API parses the shared response and surfaces errors

### Phase 3: Consumers

- [ ] mobile ranking types/hook/list/screen을 `GroupBuyRankingItem`으로 전환
- [ ] ranking row metrics를 deep views/bookmarks/notifications/search clicks/score로 표시
- [ ] 공구 탭에서 `groupBuyId`로 상세 이동 및 알림 저장을 연결
- [ ] Nest API ranking output을 shared response shape으로 정렬

### Checkpoint: Consumer integration

- [ ] mobile ranking tests pass for filter-before-limit, sort, cursor, empty, error
- [ ] API typecheck/build pass
- [ ] no production mock ranking path remains

### Phase 4: Review and handoff

- [ ] full tests/typecheck/build/lint/diff check pass
- [ ] five-axis code review complete
- [ ] wiki report and activity log updated
- [ ] intended files committed, PR CI passes, Linear issue completed

## Acceptance Criteria

- `GroupBuyRankingItem.groupBuyId` is required and `representativeGroupBuyId` is absent from the contract.
- Category/sort/period are applied before the requested page limit.
- Equal sort values are ordered by deterministic `groupBuyId` tie-break.
- `pageInfo.nextCursor` produces no duplicate or missing rows across pages.
- `notifications` and `scoreVersion` are present in every successful item.
- RPC/Edge failure is an error state; successful zero rows is an empty state; neither uses mock data.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Existing screen expects seller-shaped fields | High | Add a thin mobile view-model adapter and migrate consumers in one slice |
| Cursor sort keys differ by mode | High | Encode sort mode and typed key in an opaque cursor; test every sort |
| Local Supabase/Deno tools unavailable | Medium | Keep Edge tests deterministic and rely on required CI for Deno/migration execution |
| Old clients call the existing RPC | Medium | Keep old RPC additive and version the new contract as `scoreVersion: v2` |

## Open Questions

- None blocking implementation. The first implementation will use rolling windows of 24h/168h/720h for today/weekly/monthly.
