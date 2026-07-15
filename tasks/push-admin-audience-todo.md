# Task Checklist: 관리자 푸시 대상 선택 발송

## Contract

- [x] `GET /admin/users`에 `hasPushToken` 추가
- [x] selected `userIds` 검증 테스트 보강
- [x] admin client payload 테스트 추가

## Admin UX

- [x] 전체/선택 발송 모드 전환
- [x] 사용자 검색·선택·현재 결과 전체 선택/해제
- [x] 토큰 미등록 사용자 disabled 및 안내
- [x] 글자 수·JSON 검증·미리보기·확인 단계
- [x] 성공/실패/무효 토큰 결과 요약
- [x] 반응형 및 키보드 접근성 스타일

## Verification

- [x] 관련 component/API/contract tests
- [x] admin typecheck/lint/build
- [x] 브라우저 핵심 흐름 확인
- [x] 위키 운영 메모와 검증 결과 기록
- [ ] 의도한 파일만 commit/push/PR/CI/merge
