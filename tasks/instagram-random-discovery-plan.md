# Implementation Plan: Instagram 랜덤 계정 공구 발견

## Architecture decisions

- 지정 계정 scheduler와 분리된 opt-in 원샷 모드로 안전하게 제공한다.
- 계정 수가 아니라 새 공구 후보 수를 성공 기준으로 사용한다.
- 공구·한국·중복 판정은 기존 Preview collector의 단일 계약을 재사용한다.
- Instagram 페이지에서 얻은 값은 username과 canonical post URL로만 축소해 처리한다.

## Task list

### Phase 1: 발견 파서

- [x] 탐색 페이지의 게시물 URL을 제한 없이 중복 제거하는 파서 테스트와 구현
- [x] 게시물 HTML의 article 작성자 username 추출 테스트와 구현

### Checkpoint

- [x] `test_public_parser.py` 통과

### Phase 2: 목표 기반 Worker

- [x] 랜덤 hashtag/post 순회 generator 구현
- [x] 10계정을 넘어 탐색하고 새 후보 목표에서 멈추는 Worker 테스트와 구현
- [x] 시간·차단·소스 소진·선택적 비상 한도 종료 경로 구현

### Checkpoint

- [x] `test_public_main.py`와 전체 Worker 테스트 통과
- [x] `compileall` 통과

### Phase 3: 실행·검증

- [x] Preview 전용 랜덤 원샷 PowerShell wrapper 추가
- [x] 환경변수와 운영 경계를 README에 기록
- [x] 실제 Playwright 탐색과 읽기 전용 브라우저 증거 저장

### Checkpoint

- [x] 코드 리뷰와 보안 경계 확인
- [ ] PR 필수 CI와 merge SHA Preview Green 통과

## Risks and mitigations

| Risk               | Impact         | Mitigation                                           |
| ------------------ | -------------- | ---------------------------------------------------- |
| Instagram DOM 변경 | 발견 결과 0건  | 순수 parser fixture, 명확한 source-exhausted 로그    |
| 로그인·rate limit  | 계정 제한      | 기존 block 감지 재사용, 즉시 중단, CAPTCHA 우회 금지 |
| 무한 탐색          | 로컬 자원 소모 | 시간 예산 기본값, 탐색 소스 유한화, 선택적 비상 한도 |
| 잡음 계정          | 검수 품질 저하 | 기존 한국·공구 분류와 서버 중복 계약 재사용          |

## Open questions

- 없음.
