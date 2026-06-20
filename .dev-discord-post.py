import json, requests
from pathlib import Path

env = {}
for line in Path('/Users/pc/.hermes/profiles/dev/.env').read_text().splitlines():
    if '=' in line:
        k, v = line.split('=', 1)
        env[k] = v

token = env.get('DISCORD_BOT_TOKEN')
if not token:
    raise SystemExit('missing DISCORD_BOT_TOKEN')

headers = {'Authorization': f'Bot {token}', 'Content-Type': 'application/json'}
channel = '1516429519399944262'
title = '[Dev] 공구 프로젝트 미전환 화면 v2 토큰 적용 \u2014 정확한 경로 고정'

# Step 1: title-only message
r1 = requests.post(
    f'https://discord.com/api/v10/channels/{channel}/messages',
    headers=headers,
    json={'content': title},
    timeout=20
)
print('title_status:', r1.status_code)
msg = r1.json()
message_id = msg.get('id')
print('message_id:', message_id)

# Step 2: create thread
r2 = requests.post(
    f'https://discord.com/api/v10/channels/{channel}/messages/{message_id}/threads',
    headers=headers,
    json={'name': title, 'auto_archive_duration': 1440},
    timeout=20
)
print('thread_status:', r2.status_code)
print('thread_body:', r2.text[:500])
thread_id = r2.json().get('id')
print('thread_id:', thread_id)

# Step 3: body in thread
body = (
    "<@871440961216061471> 작업 결과 요약\n\n"
    "- 대상 파일 8개 중 지정된 미전환 페이지/토큰 파일을 v2 토큰으로 치환\n"
    "- 주요 치환: gray->neutral, blue->primary, red->error, green->success, amber/yellow->warning, bg-white->bg-neutral-0, bg-background-primary->bg-bg-primary\n"
    "- utils.test.tsx의 getStatusColor 기대값을 v2 status token 반환값으로 갱신\n"
    "- tokens.ts의 bg-amber-100/amber-800을 warning-*으로 정리\n"
    "- 변경 파일: apps/web/src/app/page.tsx, apps/web/src/app/admin/login/page.tsx, apps/web/src/app/admin/influencers/page.tsx, apps/web/src/app/(public)/submit/SubmitForm.tsx, apps/mobile/src/utils.test.tsx, apps/mobile/src/design/tokens.ts, apps/web/src/app/admin/AdminSidebar.tsx\n"
    "- 검증: typecheck 통과, build:web 통과, vitest에서 지정 대상 getStatusColor 테스트 통과 확인\n"
    "- open risks: 지정 대상 외 repo 전체에 여전히 legacy 색상/class 잔존 파일 존재(layout/e2e/ui-web 컴포넌트 등). 별도 마이그레이션 필요\n"
)
r3 = requests.post(
    f'https://discord.com/api/v10/channels/{thread_id}/messages',
    headers=headers,
    json={'content': body},
    timeout=20
)
print('body_status:', r3.status_code)
print('body_response:', r3.text[:600])
