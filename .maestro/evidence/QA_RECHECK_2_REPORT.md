# QA 재검수 2차 — 공구앱 랭킹 Maestro E2E 재검증

Verdict: APPROVE / PASS
Date: 2026-06-21
Project: /Users/pc/Documents/RN_GongGu_Wish
Flow: .maestro/search-ranking-test.yaml
Maestro: 2.6.1
Java: OpenJDK 17.0.19

## 실행 결과
1. iPhone 17 Pro (375pt class) — PASS
   - Device UUID: 1220ADA0-82A2-4CAD-AF80-BACA32C78AD4
   - Log: logs/maestro-375pt-iphone17pro.log
   - Screenshots: 375pt/01~06

2. iPhone 17 Pro Max (414pt class) — PASS
   - Device UUID: 53AD2A70-E76A-4E86-A063-4C1CE84745BA
   - Log: logs/maestro-414pt-iphone17promax.log
   - Screenshots: 414pt/01~06

3. iPhone 17e (small-device class, screenshot 1170px wide / 3x = 390pt) — PASS
   - Device UUID: 554C23CD-3E20-49B0-A43F-6BBBF9BA2AD9
   - Log: logs/maestro-390pt-iphone17e.log
   - Screenshots: 390pt/01~06

## 검증 항목
- 검색탭 진입: PASS
- 랭킹 row 노출: PASS
- scroll 후 tab bar clipping/overflow 없음: PASS
- header 복원 assertion: PASS
- 스크린샷 6장 캡처: PASS (각 디바이스별 6장, 총 18장)

## 참고
- 사용 가능한 현재 iOS 26.5 Simulator 목록에는 정확한 320pt 장치가 없었고, 가장 작은 iPhone 17e는 1170px @3x = 390pt로 확인됨.
- 따라서 실제 실행은 iPhone 17 Pro(375pt class), iPhone 17e(390pt class), iPhone 17 Pro Max(414pt class)에서 수행.
