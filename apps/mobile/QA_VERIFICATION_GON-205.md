# QA 재검증 절차 — GON-205 Android 키패드 위 버튼 고정

> Dev Rework 3 — GON-211
> Target commit: `{작성자가 커밋 SHA 기입}`

---

## 1. 사전 조건

- [ ] 최신 main 브랜치에 Dev Rework 3 커밋이 포함되어 있는지 확인
- [ ] Metro cache 초기화: `npx expo start -c`
- [ ] APK 재빌드 후 기존 앱 삭제 후 재설치 (stale APK 방지)
- [ ] Android 에뮬레이터 또는 실제 기기 준비 (API 33+ 권장)

---

## 2. 런타임 식별 마커 확인

앱 실행 후 `adb logcat | grep "GON-211"` 또는 Metro 로그에서 확인:

```
[AuthScreen] GON-211 runtime marker: gon-211-<timestamp>
```

화면에 표시되는 `testID`는 QA 도구(예: `react-native-test-app`)로 확인 가능:
- `auth-screen-gon-211-<timestamp>` — 루트 컨테이너 testID
- `auth-action-bar` — 고정 액션바 testID

로그에 GON-211 마커가 보이면 최신 코드 반영 확인 완료.

---

## 3. 로그인 탭 검증

### 3.1 이메일 입력 포커스
1. 로그인 탭 선택
2. 이메일 입력창 탭
3. 키보드 올라오는 것 확인
4. [PASS] 화면 하단에 고정 `ActionBarArea`(로그인 버튼) 표시
5. [PASS] ScrollView 내부 인라인 버튼은 숨김
6. [FAIL] 고정 액션바가 표시되지 않거나 인라인 버튼이 보임

### 3.2 비밀번호 입력 포커스
1. 이메일 입력 후 비밀번호 입력창 탭
2. [PASS] 이전 input과 관계없이 고정 액션바 유지
3. [PASS] 포커스 이동 시 action bar 깜빡임 없음

### 3.3 키보드 닫기
1. 하드웨어 백버튼 또는 키보드 닫기 버튼
2. [PASS] 고정 액션바 사라짐
3. [PASS] ScrollView 내부 인라인 버튼 원래 위치에 표시

### 3.4 중복 포커스/블러
1. 동일 입력창 빠르게 두 번 탭
2. [PASS] action bar 상태 일관됨 (깜빡이거나 깨지지 않음)

---

## 4. 회원가입 탭 검증

### 4.1 Step 1 → 2 전환
1. 회원가입 탭 선택
2. 이메일/비밀번호/확인 입력 후 "다음" 버튼 탭
3. [PASS] Step 2로 전환되며 고정 액션바가 그대로 보임
4. [PASS] transition 중 action bar가 사라졌다 나타나지 않음

### 4.2 Step 2 → 3 전환
1. 닉네임/전화번호 입력 후 "다음" 버튼 탭
2. [PASS] Step 3로 전환되며 고정 액션바 표시
3. [PASS] transition 중 action bar 유지

### 4.3 Step 2 → 1 (이전) 전환
1. Step 2에서 "이전" 버튼 탭
2. [PASS] Step 1로 전환, 고정 액션바 유지

### 4.4 Step 3 키보드 닫힘
1. Step 3에서 백버튼으로 키보드 닫기
2. [PASS] 고정 액션바 사라짐, 인라인 버튼 표시

---

## 5. 탭 전환 검증

### 5.1 로그인 → 회원가입 탭
1. 로그인 탭에서 이메일 입력 포커스 (action bar 표시)
2. 회원가입 탭 탭
3. [PASS] action bar 초기화 (표시 안 됨)
4. [PASS] 회원가입 Step 1 인라인 버튼 표시

### 5.2 회원가입 → 로그인 탭
1. 회원가입 Step 1에서 이메일 포커스
2. 로그인 탭 탭
3. [PASS] action bar 초기화
4. [PASS] 로그인 인라인 버튼 표시

---

## 6. 최종 판정

| 항목 | 결과 | 비고 |
|------|------|------|
| 고정 액션바 표시 (키보드 UP) | PASS/FAIL | |
| 인라인 버튼 복귀 (키보드 DOWN) | PASS/FAIL | |
| 중복 focus/blur 안정성 | PASS/FAIL | |
| 탭 전환 안정성 | PASS/FAIL | |
| Step 전환 안정성 | PASS/FAIL | |
| 최신 빌드 식별 가능 | PASS/FAIL | |

**최종 판정: PASS / FAIL**

---

## Screenshot 가이드

각 PASS 항목별 스크린샷 필수 첨부:
1. 로그인 이메일 포커스 → 고정 액션바
2. 회원가입 Step 1 포커스 → 고정 액션바 (다음)
3. 회원가입 Step 2 고정 액션바 (다음 + 이전)
4. 회원가입 Step 3 고정 액션바 (가입 완료 + 이전)
5. 키보드 닫힘 → 인라인 버튼 복귀
