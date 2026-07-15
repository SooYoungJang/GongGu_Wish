# Task Checklist: 푸시 발송

## 계약·백엔드

- [x] Supabase migration 작성
- [x] Prisma schema/migration 동기화
- [x] 인증된 push token 등록 Edge Function 작성
- [x] Expo 발송 helper와 `admin-api` route 작성
- [x] 입력 검증, 실패 집계, 무효 토큰 정리

## 모바일

- [x] Expo project ID 확인과 토큰 발급
- [x] 로그인 사용자 토큰 등록 연결
- [x] 권한 거부/Expo Go/project ID 누락 처리
- [x] 서비스 테스트 작성

## 관리자

- [x] admin API client 메서드 추가
- [x] 전체/선택 대상 발송 패널과 사용자 검색·선택 구현
- [x] JSON 데이터 입력, 미리보기, 확인 단계 구현
- [x] 확인창·로딩·오류·결과 표시
- [x] 컴포넌트 테스트 작성

## 검증·운영

- [x] 타입 검사·린트·단위 테스트·빌드
- [x] 가능한 Edge Function 문법 검사
- [x] 실제 기기 검증 절차와 운영 메모 위키 기록
- [ ] Supabase migration/Edge Function 배포와 EAS credentials 등록
- [ ] 실제 development build 원격 발송 E2E
- [ ] 의도한 파일만 커밋·푸시·PR·CI·merge
