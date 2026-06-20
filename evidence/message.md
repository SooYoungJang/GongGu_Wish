<@871440961216061471> **[QA] 토큰 통합 재검수 완료**

**판정: CONDITIONAL PASS**
- Critical/Major 차단 이슈 0건
- Minor 개선 2건 확인

**검수 결과**
1) packages/shared/src/tokens/ 패키지 존재 확인
2) packages/ui-web/src/styles/globals.css 새 토큰 적용 확인
3) apps/mobile/src/design/tokens.ts 새 토큰 적용 확인
4) Primary 색상 웹/모바일 동일 확인
5) Semantic 상태 색상 일관성 확인
6) packages/shared tsc 통과
7) packages/ui-web tsc 통과
8) apps/mobile tsc 통과

**Minor**
1) web globals.css dark mode에서 accent-500이 shared source value와 불일치(현재 0.55/0.2/7 → 0.6/0.21/7 권고)
2) mobile 일부 화면 하드코딩 hex 잔존(FormInput/AppButton/AdminScreen/HomeScreen/SubmitScreen/InfluencerGroupBuysScreen)

**증거**
- turbo typecheck 7/7 통과
- shared vitest 157/157 통과
- token-parity.log / accent-500-darkmode.patch / regression-typecheck.log 확보
