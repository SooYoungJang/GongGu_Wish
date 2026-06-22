import subprocess
import json

# Read the .env file and find the token
with open('/Users/pc/.hermes/profiles/ceo/.env') as f:
    env_content = f.read()

# Find DISCORD_BOT_TOKEN=... line
token_line = None
for line in env_content.split('\n'):
    if line.startswith('DISCORD_BOT_TOKEN='):
        token_line = line
        break

if not token_line:
    # Try another pattern
    for line in env_content.split('\n'):
        if 'DISCORD_BOT_TOKEN' in line and '=' in line:
            token_line = line
            break

if token_line:
    TOKEN = token_line.split('=', 1)[1].strip().strip('"').strip("'")
else:
    print("TOKEN NOT FOUND")
    exit(1)

TFT_THREAD = '1518635985074651287'

HEADERS = {
    'Authorization': f'Bot {TOKEN}',
    'Content-Type': 'application/json',
    'User-Agent': 'DiscordBot (hermes-ceo, 1.0)'
}

import time
time.sleep(2)

resp = subprocess.run(
    ['curl', '-s', f'https://discord.com/api/v10/channels/{TFT_THREAD}/messages?limit=30',
     '-H', f'Authorization: {HEADERS["Authorization"]}',
     '-H', f'Content-Type: {HEADERS["Content-Type"]}',
     '-H', f'User-Agent: {HEADERS["User-Agent"]}'],
    capture_output=True, text=True
)
messages = json.loads(resp.stdout)
if isinstance(messages, list):
    print(f"Total messages: {len(messages)}")
    for m in reversed(messages):
        author = m.get('author', {}).get('username', 'unknown')
        content = m.get('content', '')[:300]
        msg_id = m.get('id', '')
        ts = m.get('timestamp', '')[:19]
        print(f'[{author}] ({ts}) id={msg_id}')
        print(content)
        print('---')
else:
    print(f'Error: {json.dumps(messages, indent=2)[:500]}')
