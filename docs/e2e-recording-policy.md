# E2E 녹화 게이트

## 규칙

- React Native 모바일: Maestro 테스트와 `maestro record --local` 녹화를 함께 실행한다.
- Admin/Web: Playwright 테스트에서 `video: "on"`을 사용한다.
- 녹화 파일이 없거나, 손상됐거나, duration이 0초면 E2E를 실패로 처리한다.
- 녹화 실패는 기본 3회 시도한다. 3회 모두 실패하면 명령은 exit code 1로 종료한다.
- 화면 캡처를 이어 붙인 폴백 영상은 정식 증적으로 인정하지 않는다.
- Obsidian 첨부본은 원본 녹화와 별도로 최대 `480×854`, H.264 MP4, 무음, `CRF 30`으로 압축한다.
- 모바일 문서에는 압축본만 링크하고 원본 녹화는 증적 보관 위치에만 둔다.

## 실행 명령

```powershell
npm run test:e2e:mobile
npm run test:e2e:admin
npm run test:e2e:web
```

모바일 실행 스크립트는 각 흐름을 테스트한 뒤 녹화하고, `ffprobe`로 duration을 확인한다. Playwright 실행 스크립트는 테스트 성공 후 `test-results/e2e-recording-attempt-*`에서 WebM/MP4를 찾아 같은 검증을 수행한다.

## 재시도 설정

- 모바일: `-Attempts 3`, `-RecordTimeoutSeconds 90`
- 웹: `E2E_RECORD_ATTEMPTS=3`
- `FFPROBE_PATH`를 지정하면 해당 ffprobe를 사용한다. 지정하지 않으면 PATH와 Windows WinGet 설치 경로를 탐색한다.

## 결과 보관

- Obsidian: `e2e-evidence/mobile/<date>/result.md`, `videos/`
- 관리자 웹: `e2e-evidence/admin/<date>/result.md`, `videos/`
- 모든 결과 문서에는 시작 기준, 목표, 성공 여부, 실패 원인, 의심점, 재현 명령을 기록한다.

## Obsidian 영상 압축 명령

```powershell
powershell -ExecutionPolicy Bypass -File scripts/compress-e2e-video.ps1 `
  -InputPath input.mp4 `
  -OutputPath output-obsidian.mp4
```
