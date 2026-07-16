# Task Checklist: GON-258 공구 랭킹 계약·서버 집계 v2

## Contract

- [ ] Add shared ranking schemas and exported inferred types
- [ ] Add query validation for category, period, sort, limit, and cursor
- [ ] Add response validation for metrics, scoreVersion, and pageInfo

## Server

- [ ] Add `get_group_buy_rankings` migration/RPC
- [ ] Aggregate deep views, bookmarks, notifications, and search clicks per group buy
- [ ] Apply filters and sort before limit
- [ ] Add deterministic cursor pagination
- [ ] Replace seller/mock Edge response with group-buy response

## Consumers

- [ ] Replace mobile `SellerRanking` data contract with `GroupBuyRankingItem`
- [ ] Remove `representativeGroupBuyId` from ranking consumers
- [ ] Keep error and empty states distinct
- [ ] Use `groupBuyId` for detail navigation and notification sync
- [ ] Align Nest API ranking response with shared schema

## Verification

- [ ] RED tests fail before implementation
- [ ] Shared/mobile/API/Edge tests pass
- [ ] Typecheck, build, lint, and `git diff --check` pass
- [ ] Code review finds no correctness/security/architecture/performance blockers
- [ ] Wiki report and Linear status/comment updated
- [ ] Commit, push, PR, CI, merge, and local main fast-forward complete
