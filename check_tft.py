import subprocess, json, re, time

with open('/Users/pc/.hermes/profiles/ceo/.env') as f:
    content = f.read()

# Find token by looking for the DISCORD_BOT_TOKEN line
idx = content.find('DISCORD_BOT_TOKEN=')
if idx >= 0:
    rest = content[idx:]
    rest = rest.split('\n')[0]  # First line
    rest = rest.replace('DISCORD_BOT_TOKEN=', '')
    TOKEN = rest.strip().strip('"').strip("'")
else:
    print("TOKEN NOT FOUND")
    exit(1)

TFT_THREAD = '1518635985074651287'

HEADERS = {
    'Authorization': f'Bot {TOKEN}',
    'Content-Type': 'application/json',
    'User-Agent': 'DiscordBot (hermes-ceo, 1.0)'
}

print("Checking TFT thread for discussion messages...")
time.sleep(8)

resp = subprocess.run(
    ['curl', '-s', f'https://discord.com/api/v10/channels/{TFT_THREAD}/messages?limit=20',
     '-H', f'Authorization: {HEADERS["Authorization"]}',
     '-H', f'Content-Type: {HEADERS["Content-Type"]}',
     '-H', f'User-Agent: {HEADERS["User-Agent"]}'],
    capture_output=True, text=True
)
messages = json.loads(resp.stdout)
if isinstance(messages, list):
    for m in reversed(messages):
        author = m.get('author', {}).get('username', 'unknown')
        content = m.get('content', '')[:500]
        msg_id = m.get('id', '')
        ts = m.get('timestamp', '')[:19]
        print(f'[{author}] ({ts}) id={msg_id}')
        print(content)
        print('---')
else:
    print(f'Error: {json.dumps(messages, indent=2)[:500]}')
