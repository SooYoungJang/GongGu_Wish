# ADR: 단독 운영을 위한 Preview 우선 머지 승인 모델

- 상태: 승인됨
- 날짜: 2026-07-22

## 문맥

저장소 collaborator는 한 명이며 GitHub는 PR 작성자의 자기 승인을 허용하지 않는다. `develop` 또는 `main`에 필수 사람 승인 1명을 요구하면 필수 CI가 모두 성공해도 정상 PR 머지가 불가능하다. 반대로 관리자 우회나 직접 push를 일상적으로 사용하면 Preview 검증과 Production 격리의 안전장치가 약해진다.

## 결정

- `develop`과 `main`의 GitHub 필수 사람 승인 수를 모두 0으로 유지한다.
- 일반 작업은 최신 `origin/develop` 기반 `codex/*` 브랜치에서 시작하고, 필수 CI 성공 후 `develop` PR을 정상 머지한다.
- `main` PR 생성과 머지는 사용자가 현재 요청에서 Production 배포를 명시한 경우에만 허용한다. 이 명시적 요청을 단독 운영의 사람 승인으로 간주한다.
- Production 승격은 항상 최신 `develop → main` PR로 수행하고 `Preview Promotion Gate` 및 영향받은 필수 CI를 통과해야 한다.
- 두 브랜치 모두 직접 push, force push, branch deletion, 관리자 우회, 실패 검사 강제 머지를 금지한다.
- Preview와 Production은 데이터베이스, API, 관리자 웹, 모바일 배포 대상과 credential을 분리하며 Git 추적 코드와 migration만 승격한다.

## 이유

- 단독 collaborator 환경에서도 정상 PR 흐름을 중단 없이 실행할 수 있다.
- 사람 승인 대신 자동 검증을 제거하는 것이 아니라 strict required status checks를 기술적 머지 게이트로 유지한다.
- Production은 일반 작업과 분리된 사용자의 현재 명시적 명령과 `Preview Promotion Gate`라는 이중 조건을 갖는다.
- 작업 브랜치를 `main`으로 직접 전달하지 않아 Preview에서 검증한 통합 상태만 Production으로 승격된다.

## 대안

### 필수 사람 승인 1명 유지

별도 reviewer를 추가하면 가능하지만 현재 collaborator 구성에서는 작성자 자기 승인 제한으로 모든 머지가 막힌다.

### 관리자 권한으로 우회 머지

기술적으로 가능하지만 필수 검사와 branch protection을 우회하는 운영 습관을 만들기 때문에 채택하지 않는다.

### `main` 직접 push

PR diff, `Preview Promotion Gate`, 감사 가능한 승인 기록을 잃으므로 금지한다.

## 결과와 한계

- GitHub 자체는 채팅에서 내려진 Production 명령을 인식하지 못한다. 따라서 루트 `AGENTS.md`가 에이전트의 규범적 승인 경계이고, `docs/branch-strategy.md`와 계약 테스트가 드리프트를 감시한다.
- 오래된 브랜치나 별도 worktree에서 작업을 시작해도 최신 규칙을 놓치지 않도록 사용자 전역 `~/.codex/AGENTS.md`에는 이 저장소를 식별한 뒤 `origin/develop`의 최신 `AGENTS.md`를 먼저 읽는 bootstrap 규칙을 둔다. 전역 규칙은 다른 저장소에는 적용하지 않는다.
- 저장소 소유자가 GitHub UI에서 직접 수행하는 작업까지 이 규칙 파일이 기술적으로 차단하지는 않는다.
- collaborator가 추가되면 사람 승인 수를 다시 1 이상으로 올릴 수 있지만, 그 변경은 사용자 승인과 이 ADR을 대체하는 새 결정을 필요로 한다.
