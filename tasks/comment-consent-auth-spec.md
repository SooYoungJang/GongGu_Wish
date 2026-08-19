# Spec: 인증 시 커뮤니티 이용규칙 동의

## Objective

로그인·회원가입 화면의 기존 `만 14세 이상` 확인 안내에 `커뮤니티 이용규칙` 동의를 포함한다. 인증이 성공하면 현재 `community-v1` 동의를 계정 단위로 한 번 기록하고, 댓글 시트에서 매번 체크박스를 요구하지 않는다.

## Tech Stack and Commands

- React Native / Expo / TypeScript
- Supabase PostgREST RPC와 versioned acceptance row
- Focused test: `npm test -- --run src/components/auth/AuthLegalNotice.test.tsx`
- Mobile verification: `npm test`, `npm run typecheck`, `npm run lint`

## Project Structure

- `apps/mobile/src/components/auth/AuthLegalNotice.tsx`: 인증 약관 안내
- `apps/mobile/src/context/AuthContext.tsx`: 명시적 인증 성공 세션 경계
- `apps/mobile/src/screens/AuthScreen.tsx`: 인증 완료 후 이동
- `apps/mobile/src/features/comments/CommentSheet.tsx`: 댓글 작성 UI
- `apps/mobile/src/features/comments/api.ts`: 동의 RPC 호출
- `apps/mobile/src/**/__tests__`: 회귀 테스트

## Code Style

기존 `AuthLegalNotice`의 문구·접근성 링크와 `acceptCommentTerms(COMMENT_TERMS_VERSION)` API를 재사용한다. 동의 버전은 클라이언트에서 임의로 만들지 않고 상수로 제한하며, 서버의 `(user_id, terms_version)` primary key와 RPC 멱등성에 의존한다.

## Testing Strategy

- 인증 안내에 14세·커뮤니티 이용규칙·기존 약관 문구가 함께 노출되고 필수 체크박스가 없음을 테스트한다.
- 인증 성공 후 동의 RPC가 한 번 실행되고 실패 시 이동하지 않는 경계를 테스트한다.
- 댓글 시트에는 기존 동의 체크박스가 없고, 작성 요청에 terms version 계약이 유지됨을 테스트한다.
- 모바일 전체 Vitest, typecheck, lint를 실행한다.

## Boundaries

- Always: 계정·버전별 서버 동의 기록과 `create_comment` 검증을 유지하고, 동의 실패를 조용히 무시하지 않는다.
- Ask first: 인증 제공자·DB 권한·기존 약관 의미를 변경하지 않는다.
- Never: 연령 확인과 커뮤니티 동의 데이터를 같은 필드로 합치거나, 클라이언트만으로 동의를 우회하지 않는다.

## Success Criteria

- 인증 화면에서 계속하기 문구가 커뮤니티 이용규칙 동의를 명시한다.
- 이메일·소셜·이메일 인증 완료 등 모든 명시적 인증 완료 경로가 `community-v1` 동의를 기록한다.
- 댓글 시트에서 계정당 매번 체크하지 않고 바로 작성할 수 있다.
- 동의 RPC 실패는 인증 완료 후 임의 이동으로 숨겨지지 않는다.
- 기존 댓글 RLS/RPC 및 모바일 회귀가 모두 통과한다.

## Open Questions

- 이미 로그인된 기존 세션은 다음 명시적 로그인/재인증 때 새 버전 동의를 기록한다. 현재 세션을 강제로 로그아웃시키거나 자동 동의시키지는 않는다.
