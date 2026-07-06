# GongGu Admin Console

공구앱 운영용 Vercel 관리자 페이지입니다. 모바일 앱에서 접수된 위시 URL을 검수하고, 승인 가능한 건만 Hiker API로 조회한 뒤 `group_buys`에 등록합니다.

## 기능

- Supabase 이메일/비밀번호 로그인
- `app_metadata.role = "admin"` 또는 `app_metadata.roles`에 `admin`이 있는 계정만 접근
- 대시보드: 위시/검수 대기/공구/사용자 카운트
- 위시 검수: PENDING 큐 조회, Hiker 조회, 내용 보정, 승인 등록, 반려
- 공구 관리: 승인된 공구 상태, 날짜, 노출, 이달의 공구 순위, 미디어 정보 수정

## 로컬 실행

```sh
npm install
npm run admin:dev
```

기본 주소는 `http://localhost:5174`입니다.

## 환경 변수

`apps/admin/.env` 또는 Vercel Project Settings에 설정합니다.

```sh
VITE_SUPABASE_URL="https://iosdoheblabfimkjnvfj.supabase.co"
VITE_SUPABASE_ANON_KEY="..."
```

`SUPABASE_SERVICE_ROLE_KEY`는 웹앱에 넣지 않습니다. 관리자 변경 작업은 `supabase/functions/admin-api`가 Supabase Edge Function secret으로 처리합니다.

## Vercel 배포

1. Vercel에서 이 저장소를 연결
2. Root Directory: `apps/admin`
3. Framework Preset: `Vite`
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. 환경 변수 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 설정

`apps/admin/vercel.json`의 SPA rewrite가 `/index.html`로 라우팅합니다.

## Supabase Edge Function

관리자 콘솔은 아래 함수가 배포되어 있어야 합니다.

```sh
supabase functions deploy admin-api --project-ref iosdoheblabfimkjnvfj --use-api
```

`admin-api`는 요청자의 Supabase JWT를 검증하고 admin role일 때만 service role 작업을 실행합니다.
