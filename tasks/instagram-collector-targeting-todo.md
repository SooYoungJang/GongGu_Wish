# Task list: Playwright 수집 환경별 저장 대상 분리

- [ ] Target resolver와 production gate를 테스트 우선으로 구현한다.
  - Acceptance: preview default, local explicit, production confirmation required
  - Verify: `python -m unittest workers/instagram/test_target.py`
  - Files: `workers/instagram/target.py`, `workers/instagram/test_target.py`

- [ ] Supabase collector Edge Function을 구현한다.
  - Acceptance: watchlist/collect/status와 token auth, idempotency
  - Verify: `deno test --allow-net supabase/functions`
  - Files: `supabase/functions/instagram-public-collector/index.ts`, tests

- [ ] Worker transport를 target별로 연결한다.
  - Acceptance: local Nest API 유지, preview/prod Edge action request 전송
  - Verify: worker tests, compileall, mocked transport tests
  - Files: `workers/instagram/public_main.py`, worker tests

- [ ] Preview/Production Edge Function 배포 경로와 운영 문서를 갱신한다.
  - Acceptance: 각 Supabase origin의 function route가 동작하고 secret은 문서에 없음
  - Verify: Edge Function tests, docs/contract checks
  - Files: `supabase/functions/instagram-public-collector`, `workers/instagram/README.md`

- [ ] affected CI와 Preview Green을 통과시킨다.
  - Acceptance: required checks pass, Production untouched
  - Verify: PR checks and exact merge SHA Preview
  - Files: no additional source files unless CI requires a contract update
