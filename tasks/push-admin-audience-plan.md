# Implementation Plan: 관리자 푸시 대상 선택 발송

## Dependency Graph

```text
users.push_token
    -> admin-api GET /admin/users (hasPushToken)
        -> adminApi.listUsers / TypeScript types
            -> PushNotificationPanel audience selector
                -> existing POST /admin/notifications (userIds)
```

## Phase 1: Contract and safety

1. `admin-api` 사용자 목록에 `push_token` 존재 여부만 additive하게 반환한다.
2. `pushNotificationContract`의 selected IDs 검증을 테스트로 고정한다.
3. admin client가 selected IDs를 기존 발송 route로 전달하는 계약을 테스트한다.

## Phase 2: Vertical UI slice

1. 전체/선택 모드와 검색 결과 사용자 목록을 만든다.
2. 토큰이 있는 사용자만 선택 가능하게 하고 선택 수·검색 결과 수를 표시한다.
3. 제목/본문/JSON 입력, 미리보기, 확인 단계, 결과 요약을 연결한다.

## Phase 3: Verification

1. component/API/contract tests를 통과시킨다.
2. typecheck, lint, build를 실행한다.
3. 브라우저에서 전체 발송과 선택 발송의 핵심 흐름을 확인한다.

## Risks and Mitigations

| Risk                                  | Impact | Mitigation                                    |
| ------------------------------------- | ------ | --------------------------------------------- |
| 토큰 없는 사용자를 선택해 0건 발송    | Medium | `hasPushToken` 기반 disabled 처리와 대상 안내 |
| 검색 결과가 바뀌며 선택 대상이 사라짐 | Medium | 선택 ID를 별도로 보존하고 발송 전 요약에 표시 |
| 전체 발송 오발송                      | High   | 모드 라벨, 대상 수, 명시적 확인 단계          |
| raw 토큰 노출                         | High   | 서버 map 단계에서 boolean만 반환              |
