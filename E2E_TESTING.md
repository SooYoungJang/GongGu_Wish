# E2E 테스트 가이드

## 개요

이 프로젝트는 세 가지 E2E 테스트 스위트를 운영합니다:

| 대상 | 도구 | 위치 | 실행 |
|------|------|------|------|
| Admin 웹 | Playwright | `apps/admin/e2e/` | `npm run test:e2e:admin` |
| Web (사용자) | Playwright | `apps/web/e2e/` | `npm run test:e2e:web` |
| Mobile (RN) | Maestro | `.maestro/` | `npm run test:e2e:mobile` |

## Admin E2E (Playwright)

### 설정

```bash
cd apps/admin
npm install
npx playwright install chromium
```

### 환경 변수

Playwright config는 `apps/admin/playwright.config.ts`에 있습니다.

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `E2E_ADMIN_EMAIL` | `admin@gonggu.local` | 로그인 이메일 |
| `E2E_ADMIN_PASSWORD` | `Admin123!@#` | 로그인 비밀번호 |
| `E2E_BASE_URL` | `http://localhost:5174` | 테스트 대상 URL (지정 시 webServer 스킵) |
| `PORT` | `5174` | dev 서버 포트 |

### 테스트 파일

| 파일 | 검증 항목 |
|------|-----------|
| `01-auth.spec.ts` | 로그인 화면 렌더링, 빈 입력/잘못된 자격증명 에러, 올바른 로그인 후 대시보드 진입 |
| `02-dashboard.spec.ts` | 대시보드 섹션 렌더링, static 카드 클릭 무반응, 검수 대기 이동 버튼 |
| `03-submissions.spec.ts` | 검수 탭 목록 표시, 상세 패널 자동 미노출, 상태 필터, 카드 클릭 |
| `04-groupbuys.spec.ts` | 공구 탭 목록 표시, 상세 패널 자동 미노출 |
| `05-users.spec.ts` | 사용자 탭 목록 표시, 인라인 에디터 자동 미노출 |
| `06-cdn-refresh.spec.ts` | CDN 탭 패널 표시, 상태 필터, 상세 패널 미노출 |
| `07-tab-switch.spec.ts` | 하단 탭바 표시, 탭 전환 시 상세 초기화, 전체 탭 순회 |

### 실행

```bash
# 전체 (dev 서버 자동 시작)
npm run test:e2e:admin

# UI 모드 (디버깅)
cd apps/admin && npx playwright test --ui

# 특정 파일
cd apps/admin && npx playwright test 01-auth.spec.ts

# 특정 브라우저
cd apps/admin && npx playwright test --project="Mobile Chrome"

# 외부 URL 대상 (dev 서버 생략)
E2E_BASE_URL=https://staging.example.com npm run test:e2e:admin
```

## Mobile E2E (Maestro)

### 사전 요구사항

- Maestro CLI 설치: `curl -Ls "https://get.maestro.mobile.dev" | bash`
- Expo dev 서버 실행: `npm run mobile:start`
- 시뮬레이터/에뮬레이터 실행 중

### 플로우 파일

| 파일 | 검증 항목 |
|------|-----------|
| `full-app-flow.yaml` | 홈 → 검색 → 랭킹 → 제출 → 마이페이지 전체 플로우 + 스크린샷 |
| `home-nav-flow.yaml` | 탭바 전체 순회 (홈/검색/Submit/MY), 탭바 무결성 |
| `no-hscroll-flow.yaml` | 각 화면 세로 스크롤만 동작, 가로 스크롤 없음 |
| `ranking-tab-verify.yaml` | 랭킹 탭 진입 + 셀러 랭킹 로드 |
| `search-ranking-test.yaml` | 검색 → 랭킹 필터 |

### 실행

```bash
# 전체 플로우
npm run test:e2e:mobile

# 개별 플로우
maestro test .maestro/full-app-flow.yaml
maestro test .maestro/home-nav-flow.yaml
maestro test .maestro/no-hscroll-flow.yaml
```

## CI 연동

### Admin Playwright CI

`.github/workflows/ci.yml`에 다음 잡 추가 가능:

```yaml
  admin-e2e:
    name: Admin E2E (Playwright)
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    defaults:
      run:
        working-directory: apps/admin
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: apps/admin/playwright-report
```

### Mobile Maestro CI

Maestro는 iOS/Android 시뮬레이터가 필요하므로 macOS runner에서 실행:

```yaml
  mobile-e2e:
    name: Mobile E2E (Maestro)
    runs-on: macos-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run mobile:start &
      - uses: futureware-tech/simulator-action@v3
        with:
          model: iPhone 15
      - run: maestro test .maestro/full-app-flow.yaml
```

## 테스트 작성 가이드

### Admin (Playwright)

- 인증이 필요한 테스트는 `./auth`에서 `test`와 `adminPage` fixture 임포트
- `adminPage` fixture는 자동으로 로그인 처리 후 페이지 반환
- 한국어 텍스트로 셀렉터 작성 (`text=대시보드`)
- `optional: true`로 데이터 의존적 요소 우회 (목록이 비어있을 수 있음)
- 모바일 뷰포트 테스트는 `--project="Mobile Chrome"` / `"Mobile Safari"`

### Mobile (Maestro)

- `clearState: true`로 시작하면 로그아웃 상태 보장
- `waitForAnimationToEnd`를 액션 사이에 배치
- `optional: true`로 조건부 어설션 (데이터가 없을 수 있음)
- 한국어 텍스트 매칭 시 인코딩 주의 — 가능한 짧은 텍스트 사용
- 스크린샷으로 증거 수집


## 전체 테스트 인벤토리

### Admin Playwright (17개 spec)

| 파일 | 검증 항목 |
|------|-----------|
| `01-auth.spec.ts` | 로그인 화면, 빈/잘못된 자격증명 에러, 정상 로그인 |
| `02-dashboard.spec.ts` | 대시보드 섹션, static 카드 클릭 무반응, 검수 이동 |
| `03-submissions.spec.ts` | 검수 탭 목록, 상세 자동 미노출, 필터, 카드 클릭 |
| `04-groupbuys.spec.ts` | 공구 탭 목록, 상세 자동 미노출 |
| `05-users.spec.ts` | 사용자 탭 목록, 인라인 에디터 자동 미노출 |
| `06-cdn-refresh.spec.ts` | CDN 탭 패널, 상태 필터, 상세 미노출 |
| `07-tab-switch.spec.ts` | 하단 탭바, 탭 전환 시 상세 초기화, 전체 탭 순회 |
| `08-auth-logout.spec.ts` | 로그아웃, 로그인 중 비활성화, 새로고침, 세션 유지, 부분 입력 에러 |
| `09-dashboard-stats.spec.ts` | 통계 카드, 섹션별 데이터/빈 상태, operator 정보 |
| `10-submissions-bulk.spec.ts` | 벌크 바, 선택 카운트, 선택 해제/반려/승인 버튼, 체크박스 선택 |
| `11-submissions-detail.spec.ts` | 카드→상세 열기, 목록으로, Hiker 보강, 폼 필드 |
| `12-groupbuys-detail.spec.ts` | 카드→상세 열기, 폼 필드, 저장 버튼, 노출 토글, 닫기 |
| `13-users-actions.spec.ts` | 인라인 에디터 열기, 닉네임 필드, 정지/차단/활성화 버튼, 저장, 검색 |
| `14-search-filter.spec.ts` | 검수/공구/CDN 상태 필터, 검색어 입력, 만료됨 필터 |
| `15-pagination.spec.ts` | 검수/공구/사용자 페이지네이션, 메타 정보 |
| `16-mobile-layout.spec.ts` | 사이드바 숨김, 하단 탭바, 테이블→카드 전환, 가로 스크롤 없음, 태블릿 내비 |
| `17-notice-feedback.spec.ts` | 새로고침 알림, 빈 상태, CDN 새로고침 피드백 |

### Mobile Maestro (10개 flow)

| 파일 | 검증 항목 |
|------|-----------|
| `full-app-flow.yaml` | 홈→검색→랭킹→제출→마이페이지 전체 플로우 |
| `home-nav-flow.yaml` | 탭바 전체 순회, 무결성 |
| `no-hscroll-flow.yaml` | 각 화면 세로 스크롤만, 가로 스크롤 없음 |
| `detail-flow.yaml` | 딜 카드 탭→상세→스크롤→뒤로 |
| `calendar-flow.yaml` | 캘린더 진입, 주간 스와이프, 날짜 탭, 딜 스크롤 |
| `reels-flow.yaml` | 릴스 진입, 상하 스와이프, 더보기 버튼, 닫기 |
| `submit-form-flow.yaml` | 제출 폼 입력(상품명/브랜드/Instagram URL), 빈 제출 검증 |
| `mypage-flow.yaml` | 마이페이지 스크롤, 테마 토글, 홈 복귀 |
| `search-filter-flow.yaml` | 검색어 입력, 랭킹 탭, 카테고리 필터 |
| `store-flow.yaml` | 스토어/인플루언서 진입, 스크롤, 카드 탭 |
