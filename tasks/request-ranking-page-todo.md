# Task Checklist: 홈 공구 요청 순위 페이지

## RED

- [ ] 홈 티커 탭이 새 route로 이동해야 한다는 회귀 테스트 작성
- [ ] 순위 화면의 ready/empty/error/accessibility 테스트 작성

## GREEN

- [ ] `GroupBuyRequestRankingsScreen` 구현
- [ ] `RootStackParamList`와 `App.tsx`에 route 등록
- [ ] `HomeScreen.tsx`의 ticker callback을 새 route로 연결

## Verification

- [ ] focused tests 통과
- [ ] 모바일 전체 tests 통과
- [ ] mobile typecheck/lint/build 통과
- [ ] 코드 리뷰·diff check 완료
- [ ] 위키 기록·PR·Preview Green 완료
