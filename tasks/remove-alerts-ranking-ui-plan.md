# 구현 계획

1. 현재 Preview와 공통 렌더 경로를 확인한다.
2. 알림 컨트롤 부재와 랭킹 배지 구조를 고정하는 회귀 테스트를 먼저 실패시킨다.
3. `ProductReelPage` 전용 알림 UI와 dead code를 제거한다.
4. 랭킹 순위·추세 배지를 독립된 표면으로 정리한다.
5. 모바일 단위 테스트, lint, typecheck를 실행한다.
6. Android Preview에서 제품상세·릴스·랭킹을 확인하고 위키에 증거를 남긴다.
7. 독립 리뷰 후 PR을 `develop`에 전달하고 필수 CI/Preview Green을 확인해 병합한다.
