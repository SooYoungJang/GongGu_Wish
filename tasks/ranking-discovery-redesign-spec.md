# Spec: 랭킹 발견형 커머스 UI v2

## Objective

진행 중인 공구를 서버의 인기점수 순으로 보여 주되, 기술적인 집계 화면이 아니라 사용자가 3초 안에 “지금 무엇이 뜨는지” 파악하고 상세·알림 행동으로 이어지는 발견형 커머스 화면으로 재설계한다.

사용자는 구매 후보를 찾는 앱 이용자다. 성공은 상위 공구와 인기 근거가 첫 화면에서 이해되고, 모든 순위에서 상세 진입과 알림 설정을 같은 방식으로 사용할 수 있는 상태다.

## Tech Stack

- React Native 0.83, React 19, Expo 55, TypeScript
- React Navigation 7, TanStack Query 5
- React test renderer, Vitest 3, Maestro Android E2E
- 기존 `CommerceColorPalette`, spacing/radius/typography 토큰과 ranking 컴포넌트
- 서버 인기점수: `3 × deepViews + 2 × bookmarks + 2 × notifications + 1 × searchClicks`

## Commands

- Targeted tests: `npm test --workspace @gonggu/mobile -- src/components/ranking src/features/ranking/popularityPresentation.test.ts src/screens/StoreScreen.ranking.test.tsx`
- Mobile tests: `npm test --workspace @gonggu/mobile`
- Typecheck: `npm run typecheck --workspace @gonggu/mobile`
- Lint: `npm run lint --workspace @gonggu/mobile`
- Build: `npm run build --workspace @gonggu/mobile`
- Android E2E: `npm run test:e2e:mobile:gon263`

## Project Structure

- `apps/mobile/src/screens/StoreScreen.tsx`: 기간·정렬·카테고리 상태와 화면 orchestration
- `apps/mobile/src/components/ranking/RankingBasisBar.tsx`: 짧고 소비자 친화적인 인기지표 설명
- `apps/mobile/src/components/ranking/RankingTopCard.tsx`: 1위 hero와 2·3위 spotlight 표현
- `apps/mobile/src/components/ranking/RankingTopThree.tsx`: 상위 3개 반응형 배치
- `apps/mobile/src/components/ranking/SellerRankingRow.tsx`: 4위 이후 컴팩트 카드
- `apps/mobile/src/components/ranking/SellerRankingList.tsx`: 가상화 목록과 상태 화면
- `apps/mobile/src/components/ranking/*.test.tsx`: presentation·행동·접근성 회귀 테스트

## Code Style

```ts
const popularity = getPopularityPresentation(item.metrics, topScore);

return (
  <PopularitySignal
    index={popularity.index}
    reason={popularity.reason}
  />
);
```

- 사용자 카피는 `인기지수`, `인기점수 상승`, `저장 반응 있음`, `조회 반응 있음`처럼 임계값을 과장하지 않는 표현만 쓴다.
- 서버 정렬 순서는 바꾸지 않고, 사용자용 인기지수는 현재 응답의 최고 점수 대비 0~100으로 표시한다.
- 스타일은 `StyleSheet.create`와 기존 semantic token만 사용한다.
- 목록 callback과 item 컴포넌트는 안정화하고 render 안의 새 객체·함수를 최소화한다.

## Testing Strategy

- 순수 presentation: 점수 정규화, 인기 근거 선택, 0점 fallback을 unit test로 먼저 고정한다.
- 컴포넌트: 1위 hero, 2·3위 spotlight, 4위 이후 compact card, 상세·알림 action과 접근성 label을 검증한다.
- 화면: 기간·정렬·카테고리 전환, sticky filter, empty/error/stale 상태와 첫 콘텐츠 노출을 검증한다.
- 런타임: Android 320px·일반 글꼴·큰 글꼴·다크 모드에서 clipping, 가로 스크롤, 상세 진입, 알림 toggle을 확인하고 PNG/영상 증거를 위키에 보존한다.

## Boundaries

- Always: 실제 서버 인기점수와 네 신호만 사용하고 모든 순위에서 카드 탭은 상세, 알림은 44px 이상 보조 action으로 유지한다.
- Always: 360px 일반 글꼴에서 1위 공구 콘텐츠가 초기 viewport에 시작되며, 큰 글꼴에서는 고정 높이 없이 세로로 확장한다.
- Ask first: 새 dependency, DB/API schema, score weight, CI 또는 production 설정 변경.
- Never: `가장 많이 구매한`, 구매 수, 매출처럼 수집하지 않은 사실을 표시하거나 nested press target을 만든다.

## Success Criteria

- 랭킹 상단의 기술적 basis 패널이 짧은 인기지표 설명으로 축소되고 상품이 첫 화면의 중심이 된다.
- 1위는 대형 image-led hero, 2·3위는 spotlight, 4위부터는 정보 밀도가 낮은 세로 카드로 표시된다.
- 모든 카드에 순위, 상품 이미지·이름·가격·마감, 0~100 인기지수와 근거, 알림 action이 있다.
- 모든 순위의 카드 탭은 `Detail`, 알림 action은 기존 notification store를 사용한다.
- 기간·정렬·카테고리 필터와 search, refresh, empty/error/stale 동작이 유지된다.
- 320px, dark mode, fontScale 2.0, TalkBack에서 콘텐츠가 잘리지 않고 의미가 색상에만 의존하지 않는다.
- targeted/full tests, typecheck, lint, build, Android E2E와 필수 CI가 통과한다.

## Open Questions

- 없음. 실제 구매 추적과 score weight 변경은 범위에서 제외한다.
