# AGENTS.md

이 파일은 에이전트가 작업을 시작하기 전 반드시 읽고 따라야 할 규칙을 정의한다.

## 개발 시작 규칙 (필수)

모든 개발 작업은 시작할 때 반드시 아래 agent-skills 스킬을 먼저 사용해 시작한다. 작업 유형에 맞는 스킬을 발견하고 적용하기 위함이다.

[$agent-skills:using-agent-skills](C:\Users\장수영.codex\plugins\cache\agent-skills\agent-skills\1.0.0\skills\using-agent-skills\SKILL.md)

## e2e 테스트 증거 및 앱 중요사항 기록 (필수)

e2e 테스트를 실행하면 반드시 증거를 남긴다. 증거는 아래 폴더에 저장한다.

C:\Users\장수영\Documents\my_llm_wiki

증거뿐만 아니라 앱과 관련된 중요 사항(회귀 포인트, 플랫폼별 차이, 알려진 이슈, 검증 결과 등)이 있으면 같이 폴더에 기록한다.
위키 리포트에서는 PNG/JPG/WebP 증거를 `![설명](상대경로)`로 인라인 표시하고, MP4/WebM 증거를 `<video controls preload="metadata" src="상대경로"></video>`와 원본 링크로 함께 제공한다. 링크 목록만으로 증거를 남기지 않는다.

## 문서 작성 규칙 (필수)

문서를 작성할 때는 항상 `@wiki` 문서 작성 스킬을 사용한다. 위키에 기록하는 모든 산출물은 `@wiki` 스킬의 규칙과 구조를 따른다.

[@wiki](plugin://wiki@llm-wiki)

## 브랜치 및 배포 흐름 (필수)

### 기본 개발 작업

사용자가 별도 흐름을 명시하지 않은 모든 기능 추가, 버그 수정, 리팩터링, 설정 및 문서 변경은 다음 순서를 따른다.

1. 작업 시작 전에 원격을 갱신하고 최신 `origin/develop`을 기준으로 삼는다.
2. `develop`에서 직접 작업하거나 직접 push하지 않고 `codex/<task-name>` 작업 브랜치 또는 별도 worktree를 만든다.
3. 구현과 검증이 끝나면 작업 브랜치를 원격에 push하고 `develop` 대상 PR을 만든다.
4. 필수 CI 실패를 수정하며 끝까지 확인하고, 모두 통과하면 사용자가 중단하라고 하지 않는 한 `develop`에 머지한다.
5. 변경 파일을 문서·workspace·DB·Edge Functions·Worker·Admin·Mobile로 분류하고, 영향받은 검사와 Preview 배포만 실행한다.
6. 영향받은 구성요소의 정확한 merge SHA 배포와 필요한 실제 smoke test가 `Preview Green`을 통과할 때까지 작업을 완료로 간주하지 않는다. 영향 없는 구성요소는 마지막으로 검증된 Preview 배포를 재사용한다.
7. Markdown 등 문서-only 변경은 가벼운 정책·문서 검증과 no-op Preview manifest만 실행하며 앱·DB·API를 빌드하거나 배포하지 않는다.
8. Preview 실패를 우회하거나 건너뛰어 `main`에 반영하지 않는다.

일반 개발 요청은 `main` 대상 PR 생성, `main` 머지 또는 Production 배포를 승인하지 않는다.

### Production 승격

`develop`을 `main`으로 승격하는 작업은 사용자가 현재 요청에서 “프로덕션 배포해”, “main에 올려”처럼 명시적으로 요청한 경우에만 수행한다. 이 명령은 정상적인 `develop → main` PR·머지와 기존 Production 배포 파이프라인 실행을 승인한다.

1. 최신 `origin/develop` SHA와 그 SHA의 성공한 `Preview Green`을 확인한다.
2. `develop`과 `main`의 전체 diff, Production에 적용될 migration과 배포 범위를 확인한다.
3. 개별 작업 브랜치를 `main`으로 직접 보내거나 cherry-pick하지 않고, 반드시 최신 `develop`에서 `main`으로 PR을 만든다.
4. `Preview Promotion Gate`와 모든 필수 CI를 통과한 경우에만 `main`에 머지한다.
5. `main` 머지 뒤 전체 `main...develop` diff에서 영향받은 Production DB migration, RLS, Edge Functions, Cloudflare Worker, 관리자 웹, 모바일 Build/OTA 결과와 실제 Production identity를 끝까지 확인한다.
6. 실패한 필수 검사를 강제 우회하지 않는다. `main` 머지 뒤 배포가 실패하면 안전한 수정 후 재배포하고, 파괴적인 rollback은 별도 승인을 받는다.
7. 완료 후 로컬 `main`을 `origin/main`과 fast-forward 방식으로 동기화한다.

승격은 Git에 추적된 코드와 migration만 전달한다. Preview의 데이터 행, Auth 사용자, Storage 객체, secret, 배포 credential, 빌드 artifact는 Production으로 복사하지 않는다. 사용자의 Production 배포 요청도 파괴적 migration, 데이터 삭제, credential 생성·교체·삭제까지 자동 승인하지는 않는다.

### CI 영향도 실행 규칙

- `Change Plan & Policy` job은 PR에서는 base SHA와 head SHA, branch push에서는 이전 SHA와 현재 SHA를 비교한다.
- `AGENTS.md`, `docs/**`, `**/*.md`만 바뀐 경우 무거운 workspace build/test와 모든 외부 배포를 생략한다.
- `apps/admin`, `apps/mobile`, `apps/api`, `apps/web`, `packages/*` 변경은 해당 workspace와 의존 workspace만 lint, typecheck, build, test한다.
- PostgreSQL service와 Prisma test setup은 API가 영향받을 때의 전용 API test job에서만 실행한다.
- `supabase/migrations`, `supabase/functions`, `workers/api-proxy`, Admin, Mobile은 각각 관련된 계약 검사와 배포 job만 실행한다.
- root dependency 또는 공유 패키지 변경은 영향받을 수 있는 모든 consumer를 보수적으로 검사한다.
- 분류되지 않은 새 경로나 빈 diff는 누락 방지를 위해 전체 영향으로 처리한다.
- `develop → main` PR에서도 `main` base와 최신 `develop` head의 전체 diff를 다시 계산하므로 여러 작업을 모아 승격해도 필요한 Production 단계가 빠지지 않는다.

## 작업 완료 자동화 규칙 (필수)

사용자가 커밋이나 배포 흐름을 명시적으로 중단하지 않는 한, 개발 작업 완료 후 아래 절차를 자동으로 수행한다.

1. 변경 범위에 맞는 테스트, 린트, 타입 검사를 실행한다.
2. 앱의 중요 변경사항과 E2E 증거를 위키에 반영한다.
3. `codex/` 브랜치에서 의도한 파일만 커밋하고 원격에 푸시한다.
4. `develop` 대상 PR을 생성하고 필수 CI를 끝까지 확인한다.
5. CI 실패가 있으면 원인을 수정하고 다시 검증한다.
6. 필수 CI가 모두 통과하면 PR을 머지한다.
7. 로컬 `develop`을 `origin/develop`과 fast-forward 방식으로 최신화한다.

위 절차는 기본 개발 작업의 `develop` 반영과 Preview 검증까지를 의미한다. `main` 대상 PR 생성·병합과 Production 배포는 위 `Production 승격` 규칙에 따른 명시적 요청이 있을 때만 수행한다.

필수 테스트나 CI가 실패한 상태에서는 머지하지 않는다. 프로덕션 배포, 데이터베이스 변경 등 안전 경계에 포함된 작업은 별도 승인 규칙을 따른다.

## 언어 규칙

사용자에게 보이는 모든 커뮤니케이션은 기본적으로 한국어로 작성한다.

기술 식별자(명령어, 파일 경로, 브랜치명, 함수명, 클래스명, API명, 커밋 해시, 로그, 스택 트레이스, 코드 스니펫)는 영어로 유지할 수 있다.

## 안전 경계

에이전트는 파괴적이거나 고위험 작업을 자동으로 수행하지 않는다.

자동으로 승인하거나 실행하지 않을 항목:

- 파일 삭제 (사용자가 명시하지 않은 경우)
- 파괴적 덮어쓰기
- 권한 변경
- 크리덴셜 변경
- 프로덕션 배포
- 데이터베이스 삭제
- 되돌릴 수 없는 데이터 변경

단, 사용자가 현재 요청에서 Production 배포를 명시하면 위 `Production 승격` 절차의 일반적인 `develop → main` 머지와 기존 Production 배포는 승인된 것으로 본다. 파괴적 DB 변경과 credential 변경은 여전히 별도 승인이 필요하다.

필요한 다음 작업이 안전하고 운영적인 경우 묻지 않고 진행한다.
필요한 다음 작업이 파괴적, 고위험, 모호하거나 제품 방향을 변경하는 경우 한국어로 사용자에게 명시적 확인을 요청한다.
