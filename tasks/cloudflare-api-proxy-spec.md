# Spec: Cloudflare API Proxy

## Objective

`api.gongguwish.com`에서 동작하는 Cloudflare Worker를 통해 모바일 앱의 Supabase PostgREST 및 Edge Function 요청을 전달한다. 광고 차단기의 `*.supabase.co` DNS 차단이 활성화되어도 공개 데이터와 앱 기능 요청이 사용자 소유 도메인을 통해 동작해야 한다.

## Tech Stack

- Cloudflare Workers module syntax, JavaScript
- Wrangler 4.x
- Node.js 20+ built-in test runner
- Expo 55 / React Native 0.83
- Supabase PostgREST 및 Edge Functions

## Commands

- Install: `cd workers/api-proxy && npm install`
- Test: `cd workers/api-proxy && npm test`
- Check: `cd workers/api-proxy && npm run check`
- Local: `cd workers/api-proxy && npm run dev`
- Deploy: `cd workers/api-proxy && npm run deploy`
- Mobile typecheck: `npm run build:mobile`

## Project Structure

- `workers/api-proxy/src/index.js`: 고정 원본 및 allowlist 기반 프록시
- `workers/api-proxy/test/index.test.js`: 라우팅·헤더·오류 계약 테스트
- `workers/api-proxy/wrangler.jsonc`: Worker와 `api.gongguwish.com` 구성
- `apps/mobile/src/App.tsx`: 데이터 API 주소와 Supabase Auth 주소 분리
- `apps/mobile/.env.example`: 새 공개 환경변수 예시

## API Contract

- `GET /health`: Worker 상태를 반환하며 원본을 호출하지 않는다.
- `/rest/v1/*`: 모바일 앱이 사용하는 테이블/RPC와 HTTP 메서드만 허용한다.
- `/functions/v1/*`: 모바일 앱이 사용하는 Edge Function과 `POST`만 허용한다.
- 다른 경로는 `404`, 허용되지 않은 메서드는 `405`, API 키 누락은 `401`로 응답한다.
- 원본 호스트는 환경변수 `SUPABASE_ORIGIN`으로만 결정하며 요청이 원본 URL을 선택할 수 없다.

## Code Style

```js
export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};
```

- 작은 순수 함수로 라우트 검증과 CORS 판정을 분리한다.
- 오류 응답은 `{ "error": { "code", "message" } }` 형식을 사용한다.
- 비밀값과 인증 헤더를 로그에 기록하지 않는다.

## Testing Strategy

- Node 내장 테스트로 health, allowlist, 인증 헤더, 원본 전달, CORS, 원본 장애를 검증한다.
- 구현 전에 테스트가 실패하는 RED 단계를 확인한다.
- 배포 후 `https://api.gongguwish.com/health`와 실제 공개 데이터 요청을 확인한다.
- 모바일 타입 검사와 관련 테스트를 실행한다.

## Boundaries

- Always: HTTPS 고정 원본, 경로·메서드 allowlist, 일반화된 오류, no-store 응답, 사용자 변경 보존
- Ask first: Supabase Auth 프록시, 서비스 역할 키 사용, allowlist 외 API 공개, 요금제 변경
- Never: `service_role` 키 커밋/배포, 임의 URL 프록시, 인증 토큰 로깅, 사용자 작업 파일 커밋

## Success Criteria

- `api.gongguwish.com`의 TLS와 `/health`가 정상이다.
- 허용된 PostgREST/Edge Function 요청은 기존 Supabase 상태·본문·필수 헤더를 보존한다.
- 허용되지 않은 경로와 메서드는 원본 호출 전에 거부된다.
- Supabase Auth는 기존 직접 URL을 유지하고 데이터 API만 새 도메인을 사용한다.
- Worker 테스트, 모바일 테스트·타입 검사, 프로덕션 smoke test가 통과한다.
- 롤백은 앱 환경변수를 기존 Supabase 원본으로 변경하고 Worker 사용자 지정 도메인을 비활성화하는 방식으로 가능하다.

## Open Questions

- 없음. 사용자가 `api.gongguwish.com` Worker 배포와 DNS 변경을 승인했다.
