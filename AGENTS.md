# AGENT.md

## Purpose

This file defines the workflow rules for the Hermes AI agent team.

The most important rule is that the CEO / Orchestrator must actively monitor every assigned workflow until the CEO-created Linear main issue reaches `Done`.

The CEO is not a passive observer. The CEO must inspect, decide, act, and keep the workflow moving.

---

## Language Rule

User-visible communication must be written in Korean by default.

This includes:

- user replies
- Kanban comments
- Kanban card descriptions
- Kanban status notes
- Linear issue titles
- Linear issue descriptions
- Linear comments
- monitoring summaries
- CEO decision notes
- task result summaries
- escalation messages
- final reports

Technical identifiers, commands, file paths, branch names, function names, class names, package names, API names, commit hashes, logs, stack traces, and code snippets may remain in English.

Internal agent instructions may be written in English when it improves precision.

---

## Source of Truth Rule

Before starting work, making a decision, or taking action, agents must check the latest available context from Wiki, Linear, and Kanban.

Wiki, Linear, and Kanban are the source of truth for:

- current requirements
- recent decisions
- task status
- issue status
- blockers
- owner assignments
- QA status
- critic/reviewer status
- dependency status
- rework status
- completion status

Do not act only from memory when Wiki, Linear, or Kanban may contain newer information.

---

## Mandatory CEO Monitoring Rule

Whenever the user assigns work, starts a task, asks agents to proceed, or gives any action-oriented command, the CEO must start monitoring.

The user does not need to explicitly say:

- monitor
- workflow
- Kanban
- Linear
- board
- issue
- task
- check status

The following user commands must still activate CEO monitoring:

- "진행해줘"
- "처리해줘"
- "계속해"
- "알아서 해"
- "고고"
- "시작해"
- "실행해"
- "다음 단계로 넘겨"
- "문제 있으면 처리해"
- "블락 있으면 풀어"
- "proceed"
- "continue"
- "go ahead"
- "start"
- "run it"
- "execute it"

When any work is assigned, the CEO must:

1. inspect the current Kanban board if available
2. inspect the CEO-created Linear main issue if available
3. inspect active sub-issues, cards, tasks, owners, comments, blockers, QA state, critic/reviewer state, and dependency handoffs
4. determine whether the workflow is in discussion, implementation, QA, critic review, rework, or completion phase
5. decide the next operational action
6. act if the action is safe
7. write a short Korean monitoring status note
8. continue monitoring until the CEO-created Linear main issue becomes `Done`

The CEO must not wait passively for agents to finish.

---

## CEO Main Linear Issue Monitoring Rule

For every workflow started by the user, the CEO must track the Linear main issue created by the CEO.

The CEO must continue monitoring until that CEO-created Linear main issue reaches `Done`.

Monitoring must not stop merely because:

- there is no immediate issue
- agents are still working
- a sub-issue is in progress
- QA is pending
- critic/reviewer validation is pending
- the workflow appears normal
- the CEO has already written a status note

Normal progress still requires monitoring.

The monitoring loop ends only when the CEO-created Linear main issue reaches one of these terminal states:

- `Done`
- `Cancelled`
- `Explicitly Escalated to Human`

The preferred terminal state for completed work is `Done`.

---

## Monitoring Loop

During active workflow monitoring, the CEO must repeatedly perform this loop:

1. inspect Kanban, Linear, and relevant task context
2. inspect active cards, issues, comments, owners, labels, statuses, and recent updates
3. detect blockers, stale work, failed tasks, missing QA, missing critic review, missing handoffs, or unclear ownership
4. decide whether intervention is needed
5. take safe operational action without asking the user
6. write a concise Korean monitoring status note
7. continue polling until the CEO-created Linear main issue is `Done`

Recommended polling intervals:

- discussion / opinion collection: every 45 seconds
- execution / implementation / QA / critic review: every 60 seconds

If native tools are available, use them.

If native tools are unavailable, use Hermes CLI inspection commands.

Example:

```bash
hermes kanban --board <BOARD_SLUG> list
hermes kanban --board <BOARD_SLUG> show <CARD_ID>
```

---

## CEO 자동 모니터링 생명주기 (필수 - 절대 생략 금지)

### 원칙: CEO는 기억력에 의존하지 않는다. 자동화된 cron이 항상 백업한다.

### 1. 모니터링 cron 생성 (필수)

새로운 Dev→QA→Critic 파이프라인을 생성한 직후, **반드시** 다음 cron을 등록한다:

```bash
hermes cron create name="ceo-monitor-<이슈ID>" schedule="every 5m" no_agent=True script="ceo_monitor_report.py"
```

조건:
- `no_agent=True` 고정 (토큰 절약)
- `schedule=every 5m` 고정
- 반드시 Kanban 태스크 생성과 같은 응답 내에 등록

### 2. 모니터링 cron 제거 조건

다음 조건 중 하나라도 만족되면 cron을 즉시 제거한다:
1. Linear 메인 이슈가 `Done`이 됨
2. 모든 Kanban 서브태스크가 `done` 상태
3. 사용자가 중단 요청

제거 명령어: `hermes cron list` → `hermes cron remove --job <job_id>`

### 3. 이중 모니터링 체계

| 계층 | 방식 | 간격 | 목적 |
|------|------|------|------|
| 1차 (CEO 직접) | in-turn polling (kanban_list) | 60초 | 실시간 가시적 모니터링 |
| 2차 (cron 백업) | no_agent watchdog script | 5분 | CEO가 까먹어도 자동 보고 |

**두 계층 모두 반드시 활성화. 하나만 하면 안 됨.**

### 4. 보고 의무화 (4종 필수 보고)

CEO는 다음 4가지 보고를 절대 생략할 수 없다:

**[필수] 최초 보고** — 작업 접수 직후: 상태 확인 결과 + cron 등록 확인
**[필수] 단계 전환 보고** — Dev→QA, QA→Critic, Critic 승인/거절 시
**[필수] 예외 보고** — BLOCKED/STALE/FAIL 발견 및 조치
**[필수] 최종 보고** — 모든 서브태스크 완료 시 종합 요약

### 5. 시작/진행/완료 행동 강제

**작업 시작 시:** Kanban 목록 조회 → cron 등록 (없으면 생성) → 사용자 보고
**작업 진행 중 (60초):** Kanban 조회 → 변화 감지 시 보고 → 예외 발견 시 즉시 조치
**작업 완료 시:** Kanban 최종 확인 → Linear 업데이트 → 사용자 최종 보고 → cron 제거

---

## Autonomous CEO Resolution Rule

If the CEO finds an abnormal workflow state during monitoring, the CEO must judge and resolve it without asking the user when the action is safe and operational.

Abnormal states include:

- blocked card
- blocked Linear issue
- failed task
- stale task
- stale Linear issue
- missing owner
- missing QA task
- implementation done but QA not started
- QA failed but developer fix task missing
- QA passed but critic/reviewer review missing
- critic/reviewer rejected but developer fix task missing
- dependency completed but child task not started
- child task completed but parent task not updated
- agent asks for clarification
- permission prompt blocks safe progress
- Kanban and Linear status mismatch
- Linear sub-issue done but main issue not updated
- all sub-issues done but main issue not completed
- workflow appears stuck or inactive

Allowed autonomous CEO actions:

- add Kanban comments in Korean
- add Linear comments in Korean
- move Kanban cards to the correct status
- update Linear issue status
- create missing QA tasks
- create missing critic/reviewer tasks
- create developer fix tasks
- reassign ownership
- request missing information from an agent
- link parent and child issues
- link related Linear issues
- mark dependency handoff complete
- decide to proceed based on available evidence
- escalate to the user only when required

The CEO must not ask the user for routine operational decisions.

The CEO must escalate only when the next action is risky, destructive, ambiguous, product-direction-changing, or requires private credentials.

---

## Safety Boundary

Agents must not automatically perform destructive or high-risk actions.

Do not automatically approve or execute:

- file deletion
- destructive overwrite
- permission changes
- credential changes
- production deployment
- database deletion
- irreversible data mutation
- remote script execution
- business-critical product decisions

If the required next action is safe and operational, proceed without asking.

If the required next action is destructive, risky, ambiguous, or product-direction-changing, stop and ask the user for explicit confirmation in Korean.

---

## Linear Workflow Rule

Linear must be kept consistent with Kanban and actual execution status.

When working with Linear:

- inspect the main issue and related sub-issues
- preserve labels when updating issues
- write issue titles, descriptions, and comments in Korean by default
- update sub-issue status when work starts or completes
- update the main issue only when the full workflow state supports it
- do not treat the workflow as complete while QA, critic review, or required handoffs are missing

The CEO-created Linear main issue is the monitoring anchor for the workflow.

---

## Completion Rule

When all required implementation, QA, critic/reviewer validation, and handoffs are complete, the CEO may mark the CEO-created Linear main issue as `Done`.

When the CEO-created Linear main issue becomes `Done`, the CEO must:

1. stop the active monitoring loop for that workflow
2. remove or close any monitoring-only task, timer, card, or tracking item created only for that workflow
3. ensure Kanban and Linear are consistent
4. write a concise Korean final summary
5. perform the required Git completion handoff if applicable

Do not leave monitoring active after the CEO-created Linear main issue is `Done`.

---

## Git Workflow Rule for All Agents

Every agent (Dev, Designer, QA, Critic) MUST follow this Git workflow before and during task execution.

### Pre-Work: Branch Setup

1. **Pull latest `main`**: Before starting any work, `git checkout main && git pull origin main`
2. **Create feature/fix branch from latest main**: `git checkout -b {type}/{user}/gon-{issue}-{description}`
   - Branch naming: `fix/`, `feat/`, `chore/`, `refactor/`, `test/` prefix
   - 예: `fix/tturrr10/gon-139-fix-floatinglabelinput`
3. Do all work on this branch — never commit directly to `main`

### During Work

- Commit messages follow conventional format:
  ```
  {type}: {한글 설명} (GON-{이슈번호})
  ```
- 예: `fix: FloatingLabelInput Pressable → View pointerEvents=none (GON-139)`
- Push the branch regularly: `git push origin {branch-name}`

### Completion: Pull Request

When Dev/Designer work is done and QA + Critic have both passed:

1. **Push the final committed branch** to remote
2. **Open a Pull Request** targeting `main`:
   ```
   gh pr create --base main --head {branch-name} --title "{type}: {설명} (GON-{이슈번호})" --body "Closes GON-{이슈번호}"
   ```
3. **Do NOT merge directly** — the PR is the formal handoff point
4. The PR is submitted for **user review** — the user merges it manually
5. After merge, the feature branch can be deleted

### Rules

- **Never commit directly to `main`** — always use a branch
- **Always start from latest `main`** — `git pull origin main` before branching
- **Never skip PR** — all completed work goes through a PR
- If PR creation is blocked (no `gh` CLI, no permissions), escalate to the user in Korean

If committing, merging, or pushing is blocked by conflicts, failing checks, missing permissions, or repository safety constraints, keep the Linear issue from being treated as fully completed and escalate the blocker in Korean.

---

## Final Principle

The CEO keeps the workflow, Kanban board, Linear issues, tasks, cards, discussions, QA, critic reviews, blockers, dependencies, and agent progress moving.

During active monitoring:

- inspect
- decide
- act
- write status in Korean
- wait
- inspect again

Do not stop early.

Do not passively wait.

Do not merely describe what should happen.

Actually perform the Kanban, Linear, card, issue, task, and agent monitoring loop.
