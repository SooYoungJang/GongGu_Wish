# Spec: 홈 공구 요청 순위 페이지

## Objective

홈 화면 하단의 공구 요청 순위 티커를 누르면 검색 화면에서 특정 상품을 요청하는 흐름 대신, 최근 공구 요청 순위를 한 번에 확인할 수 있는 전용 페이지로 이동한다. 사용자는 순위·상품명·요청 수를 빠르게 비교하고 뒤로가기로 홈으로 돌아올 수 있어야 한다.

## Tech Stack

- React Native 0.83, React 19, Expo 55, TypeScript
- React Navigation 7 Native Stack
- TanStack Query 5
- React Test Renderer, Vitest 3
- 기존 `CommerceColorPalette`, spacing/radius/typography 토큰과 `AsyncStateNotice`

## Commands

- Focused test: `npm test --workspace @gonggu/mobile -- src/screens/GroupBuyRequestRankingsScreen.test.tsx src/screens/HomeScreen.redesign.test.tsx`
- Mobile tests: `npm test --workspace @gonggu/mobile`
- Typecheck: `npm run typecheck --workspace @gonggu/mobile`
- Lint: `npm run lint --workspace @gonggu/mobile`
- Build: `npm run build --workspace @gonggu/mobile`

## Project Structure

- `apps/mobile/src/screens/GroupBuyRequestRankingsScreen.tsx`: 요청 순위 전용 화면
- `apps/mobile/src/screens/GroupBuyRequestRankingsScreen.test.tsx`: 로딩·성공·빈 결과·오류와 접근성 회귀 테스트
- `apps/mobile/src/screens/HomeScreen.tsx`: 티커 탭을 새 Root Stack route로 연결
- `apps/mobile/src/App.tsx`, `apps/mobile/src/types.ts`: Root Stack route와 화면 등록

## Code Style

화면은 서버 상태를 `useGroupBuyRequestRankings`로 읽고, 프레젠테이션은 순수한 행 컴포넌트로 분리한다. 기존 semantic theme token과 44px 이상 터치 타깃을 사용한다.

```tsx
<Pressable
  accessibilityLabel={`${ranking.rank}위 ${ranking.productName}`}
  accessibilityRole="button"
  onPress={() => onPressRanking?.(ranking)}
  style={s.row}
>
  <SText style={s.rank} variant="cardTitle">{ranking.rank}</SText>
  <View style={s.copy}>
    <SText numberOfLines={2} style={s.productName} variant="label">
      {ranking.productName}
    </SText>
    <SText style={s.requestCount} variant="caption">
      {`${ranking.requestCount.toLocaleString("ko-KR")}명이 요청했어요`}
    </SText>
  </View>
</Pressable>
```

## Testing Strategy

- 화면 단위 테스트에서 서버 성공 데이터가 순위 순서로 모두 표시되는지 확인한다.
- query의 로딩·에러·성공한 빈 배열 상태를 `AsyncStateNotice` 계약으로 검증한다.
- 헤더 뒤로가기와 행의 접근성 label/role을 검증한다.
- 홈 테스트에서 티커 탭이 `SearchScreen` initial query가 아니라 `GroupBuyRequestRankings` route로 이동하는지 검증한다.
- 최종적으로 모바일 전체 테스트·typecheck·lint·build를 실행한다.

## Boundaries

- Always: 기존 `fetchGroupBuyRequestRankings`/hook과 서버 정렬 순서를 재사용하고, 새 화면에는 빈 상태·오류·재시도 UI를 제공한다.
- Ask first: DB/RPC limit 변경, 새 dependency, 기존 인기 공구 랭킹 탭의 동작 변경.
- Never: 검색어를 자동 입력해 요청 CTA를 띄우는 새 경로를 유지하거나, 서버가 제공하지 않은 요청 수를 추정해 표시하지 않는다.

## Success Criteria

- 홈 티커 탭이 `GroupBuyRequestRankings` Root Stack 화면을 연다.
- 화면이 현재 RPC가 제공하는 최대 10개 순위를 서버 순서대로 표시한다.
- 각 행에 순위, 상품명, 요청 수가 표시되고 접근성 역할/라벨이 있다.
- 로딩·오류·빈 결과·재시도 상태가 화면에서 구분된다.
- 뒤로가기로 홈으로 돌아오며 SearchScreen의 initial query와 요청 유도 카드는 이 흐름에서 열리지 않는다.
- 모바일 focused/full tests, typecheck, lint, build가 통과한다.

## Open Questions

- 없음. 요청 CTA는 기존 SearchScreen에 남겨두고 이번 화면은 순위 탐색에 집중한다.
