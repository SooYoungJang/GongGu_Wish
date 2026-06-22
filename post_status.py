import subprocess, json, os

env_path = '/Users/pc/.hermes/profiles/ceo/.env'
found_token = None

with open(env_path) as f:
    for raw_line in f:
        if 'DISCORD_BOT_TOKEN' in raw_line and '=' in raw_line:
            parts = raw_line.split('=', 1)
            if len(parts) == 2:
                val = parts[1].strip()
                if val:
                    found_token = val.strip('"').strip("'")
            break

if not found_token or found_token == '***':
    print(f"TOKEN PROBLEM: {repr(found_token)}")
    exit(1)

H = {
    'Authorization': f'Bot {found_token}',
    'Content-Type': 'application/json',
    'User-Agent': 'DiscordBot (hermes-ceo, 1.0)'
}

CEO_CH = '1518634575033532719'

body = '<@871440961216061471> 님, 진행상황 보고드립니다!\n\n'
body += '## TFT 오케스트레이션 완료 - 디자인 시스템 v2 전수조사\n\n'
body += '### 1. TFT 토론 완료\n'
body += '- PM, Designer, Dev, QA, Critic 모두 #tft-토론 스레드에서 의견 제시 완료\n'
body += '- CEO 결정: GO - SText 마이그레이션 실행\n\n'
body += '### 2. 실행 태스크 (Phase 2)\n'
body += '- Dev: 11개 파일 Text-SText 마이그레이션 (실행 대기)\n'
body += '- QA: SText 검수 (Dev 완료 후)\n'
body += '- Critic: QA 반박 검증 (QA 완료 후)\n\n'
body += '### 3. TFT 스레드\n'
body += 'https://discord.com/channels/1516429497460658176/1518635985074651287\n\n'
body += '모니터링 중입니다! Dev가 시작하면 알림 드리겠습니다.'

r = subprocess.run(['curl', '-s', '-X', 'POST', f'https://discord.com/api/v10/channels/{CEO_CH}/messages',
    '-H', f'Authorization: {H["Authorization"]}',
    '-H', f'Content-Type: {H["Content-Type"]}',
    '-H', f'User-Agent: {H["User-Agent"]}',
    '-d', json.dumps({'content': body})], capture_output=True, text=True)
result = json.loads(r.stdout)
print(f'Status posted: {result.get("id", "FAIL")}')
if 'id' not in result:
    print(json.dumps(result, indent=2)[:300])
