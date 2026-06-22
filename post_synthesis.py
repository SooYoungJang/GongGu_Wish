import subprocess, json

with open('/Users/pc/.hermes/profiles/ceo/.env') as f:
    env = f.read()

token = None
for line in env.split('\n'):
    if line.startswith('DISCORD_BOT_TOKEN='):
        token = line.split('=', 1)[1].strip().strip('"').strip("'")
        break

if not token:
    print("TOKEN NOT FOUND")
    exit(1)

TID = '1518635985074651287'
H = {
    'Authorization': f'Bot {token}',
    'Content-Type': 'application/json',
    'User-Agent': 'DiscordBot (hermes-ceo, 1.0)'
}

body = '<@871440961216061471> TFT 팀원 여러분!\n\n'
body += '## CEO 최종 결정 - 디자인 시스템 v2 전수조사\n\n'
body += '### 의견 수렴 결과\n\n'
body += 'PM(김다미): 3Phase Plan + 리스크 레지스터\n'
body += 'Designer(츄-마케터): 브랜드 컬러 전환 확인, 컴포넌트별 v2 토큰 갭 분석\n'
body += 'Dev(팀쿡-개발자): 23 files 완료 + 5컴포넌트+2스크린 미적용\n'
body += 'QA(서현진): AC1~AC4 제안 (static analysis, token coverage 등)\n\n'
body += '### 결정\n\n'
body += 'Phase 1 - Dev 마이그레이션: AppButton, FormInput, ScreenHeader, InfoRow, SearchBar, InstagramCard + DetailScreen, SubmitScreen\n'
body += 'Phase 2 - QA 검수: 전체 스크린 스크린샷 기반 검증\n'
body += 'Phase 3 - Critic 반박 검증\n\n'
body += 'GO! 실행 진행합니다.'

r = subprocess.run(['curl', '-s', '-X', 'POST', f'https://discord.com/api/v10/channels/{TID}/messages',
    '-H', f'Authorization: {H["Authorization"]}',
    '-H', f'Content-Type: {H["Content-Type"]}',
    '-H', f'User-Agent: {H["User-Agent"]}',
    '-d', json.dumps({'content': body})], capture_output=True, text=True)
result = json.loads(r.stdout)
print(f'Synthesis: {result.get("id", "FAIL")}')
if 'id' not in result:
    print(json.dumps(result, indent=2)[:300])
