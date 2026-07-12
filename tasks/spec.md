# Spec: 관리자 상세 실시간 앱 프리뷰와 홈 배너 운영

## Objective

관리자가 위시 검수 및 공구 관리 상세에서 저장 전 폼 상태가 실제 앱에 어떻게 보이는지 즉시 확인하고, Hiker 조회 이후 반복 입력을 줄이며, 홈 배너의 노출 여부와 기간을 명시적으로 통제할 수 있게 한다.

## Tech Stack

- 관리자: React 19, TypeScript, Vite, Vitest, Playwright
- 앱: React Native 0.83, Expo 55, Vitest
- 데이터/API: Supabase Postgres, Edge Function `admin-api`
- 계약: Prisma 모델과 `packages/shared` Zod 스키마를 Supabase 컬럼과 동기화

## Commands

- 관리자 테스트: `npm run admin:test`
- 관리자 타입 검사: `npm run admin:typecheck`
- 관리자 린트: `npm run admin:lint`
- 관리자 빌드: `npm run admin:build`
- 앱 테스트: `npm test --workspace @gonggu/mobile`
- 앱 타입 검사: `npm run typecheck --workspace @gonggu/mobile`
- 공유 스키마 테스트: `npm test --workspace @gonggu/shared`
- 관리자 E2E: `npm run test:e2e:admin`

## Project Structure

- `apps/admin/src/`: 상세 편집, 프리뷰, 날짜 선택, Hiker 자동 추론
- `apps/admin/e2e/`: 데스크톱·모바일 관리자 브라우저 검증
- `apps/mobile/src/`: 실제 홈 배너 필터링과 가격 표시
- `packages/shared/src/schemas/`: 공구 계약
- `supabase/functions/admin-api/`: 관리자 읽기·수정·승인 경계
- `supabase/migrations/`: 가격과 홈 배너 운영 필드의 additive migration

## Code Style

```ts
type HomeBannerSchedule = {
  isHomeBanner: boolean;
  homeBannerStartDate: string;
  homeBannerEndDate: string;
};

function isHomeBannerActive(schedule: HomeBannerSchedule, today: string) {
  return schedule.isHomeBanner
    && schedule.homeBannerStartDate <= today
    && today <= schedule.homeBannerEndDate;
}
```

- API 응답은 camelCase, DB 컬럼은 snake_case를 유지한다.
- 날짜 범위는 `YYYY-MM-DD`의 양끝을 포함한다.
- 가격은 nullable 원 단위 안전 정수 `priceKrw`로 다룬다.
- 프리뷰는 서버 복제 상태가 아니라 현재 폼 상태만 렌더링한다.

## Testing Strategy

- 순수 로직: Hiker 제품명/카테고리/미디어 타입 추론, 가격 검증, 홈 배너 기간 판정을 Vitest로 먼저 고정한다.
- API 계약: patch 정규화와 승인 시 submission → group buy 복사를 테스트한다.
- 컴포넌트: 중앙 달력과 프리뷰의 실시간 갱신을 Testing Library로 검증한다.
- E2E: 데스크톱과 320px 모바일에서 필드 전체 클릭, 중앙 달력, 프리뷰, 제거된 입력을 Playwright로 확인하고 증거를 위키에 저장한다.

## Boundaries

- Always: 기존 사용자 파일을 보존하고, 입력을 API 경계에서 검증하며, 배너 기간은 inclusive로 처리한다.
- Ask first: 프로덕션 배포, 실제 DB migration 적용, 기존 데이터의 파괴적 변환.
- Never: `is_monthly_featured`/`is_all_day` 컬럼을 이번 변경에서 drop하거나, Hiker 응답을 신뢰해 사용자 수정값을 덮어쓴다.

## Success Criteria

- 위시 검수·공구 관리 상세에 홈 배너, 공구 카드, 상세 화면 프리뷰가 있고 입력 즉시 갱신된다.
- Hiker 조회 후 빈 제품명과 카테고리가 추론되어 채워지고 미디어 타입은 관리자 선택 없이 자동 산출된다.
- 가격을 입력·저장·승인·조회할 수 있으며 홈 배너는 명시 가격을 우선 표시한다.
- 홈 배너 토글과 별도 시작/종료일이 양 상세에 있고 해당 기간에만 실제 앱 홈 배너에 포함된다.
- 시작일·마감일·배너 기간 필드 전체를 눌러 중앙 달력을 열 수 있다.
- 관리자에서 종일 공구와 이달의 공구 입력이 사라지고, 호출되지 않던 월간 캐러셀 코드가 제거된다.
- 관련 단위/타입/린트/빌드/E2E와 필수 CI가 통과한다.

## Open Questions

- 없음. 기존 승인·미종료 공구는 migration 실행일부터 기존 종료일까지 자동 승계해 미래 시작 공구의 `D+N` 경험도 유지한다.
