# Implementation Plan: 인증 시 커뮤니티 이용규칙 동의

## Architecture Decisions

- `age14Plus` audience state와 `comment_terms_acceptances`를 합치지 않는다. 한 인증 안내에서 함께 설명하되, 목적·버전·철회/변경 이력을 분리한다.
- `accept_comment_terms` RPC의 기존 멱등성을 인증 완료 경계에서 재사용한다. 댓글 시트는 약관 수집 UI가 아니라 작성 UI만 담당한다.
- 동의 저장이 실패하면 성공한 인증 세션을 화면 이동으로 숨기지 않고 사용자에게 오류를 보여 재시도 가능하게 한다.

## Task List

### Phase 1: Contract and RED tests

- [x] 인증 안내가 커뮤니티 이용규칙 동의를 포함하는 회귀 테스트 추가
- [x] 인증 완료 시 동의 RPC 호출 및 실패 시 이동 보류 테스트 추가
- [x] 댓글 시트의 per-comment checkbox 제거 계약 테스트 추가

### Phase 2: Implementation

- [x] `AuthLegalNotice` 문구를 기존 14+·서비스 약관·개인정보 안내와 함께 갱신
- [x] 명시적 인증 완료 후 `acceptCommentTerms(COMMENT_TERMS_VERSION)`를 한 번 실행
- [x] `CommentSheet`의 동의 상태·체크박스·submit 전 동의 분기 제거

### Checkpoint: Mobile

- [x] focused tests GREEN
- [x] mobile 전체 test/typecheck/lint 통과

### Phase 3: Delivery

- [x] 코드 리뷰 및 diff/security 점검
- [ ] 위키 기록, PR CI, develop Preview Green 확인
- [ ] 로컬 develop fast-forward 동기화

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| 동의 RPC 실패 후 인증은 됐지만 화면이 멈춤 | High | 오류를 명시하고 navigation ref를 되돌려 재시도 허용 |
| OAuth·이메일 인증 경로 중 일부 누락 | High | 공통 `authCompletionRevision` 경계를 검증하는 테스트 추가 |
| 기존 로그인 세션이 acceptance row 없음 | Medium | 강제 로그아웃/암묵적 자동동의 없이 다음 명시적 인증에서 기록하고, 서버 TERMS_REQUIRED를 유지 |
| 연령 확인과 커뮤니티 동의 이력 혼동 | High | 별도 RPC·versioned table을 유지하고 UI 문구만 묶음 |

## Verification Checkpoints

1. RED: 새 인증/댓글 계약 테스트가 기존 구현에서 실패하는지 확인
2. GREEN: 최소 구현 후 focused tests와 typecheck
3. Delivery: full mobile suite, lint, CI Preview Green
