import subprocess
import json
import re

with open('/Users/pc/.hermes/profiles/ceo/.env') as f:
    content = f.read()

match = re.search(r'DISCORD_BOT_TOKEN=(.+)', content)
if match:
    TOKEN = match.group(1).strip().strip('"\'')
else:
    print("TOKEN NOT FOUND")
    exit(1)

TFT_THREAD = '1518635985074651287'

HEADERS = {
    'Authorization': f'Bot {TOKEN}',
    'Content-Type': 'application/json',
    'User-Agent': 'DiscordBot (hermes-ceo, 1.0)'
}

kickoff_body = (
    "<@871440961216061471> 님, TFT 팀원 여러분!\n\n"
    "## 🎯 [디자인 시스템 v2 전수조사] TFT 킥오프\n\n"
    "**📌 주제**: 공구위시앱 모든 화면에 새로바뀐 디자인 시스템(v2)이 적용되었는지 확인\n"
    "**👥 참석**: PM, Designer, Dev, QA, Critic\n"
    "**🎯 목표**:\n"
    "1. 모든 스크린/컴포넌트가 v2 디자인 토큰 사용중인지 확인\n"
    "2. 미적용 화면/컴포넌트는 SText + v2 coral 브랜드 컬러로 마이그레이션\n"
    "3. 전체 적용 완료 시 스크린샷 촬영 및 제출\n\n"
    "### 📋 현재 상황 분석\n"
    "- 최근 PR (f0119ee): SText migration + brand color refresh (coral #ff385c) 적용\n"
    "- 마이그레이션된 파일: HomeScreen, CalendarScreen, FeedDetailScreen, StoreScreen, AdminScreen, InfluencerGroupBuysScreen, ranking screens, AlertCard, DealCard\n"
    "- **아직 확인 필요**:\n"
    "  - DetailScreen: design tokens 사용중, SText 미적용\n"
    "  - SubmitScreen: design tokens 사용중, SText 미적용\n"
    "  - AppButton, FormInput, ScreenHeader, InfoRow, SearchBar: <Text> 사용\n"
    "  - 전체 앱 bg/primary 컬러 일관성 확인\n"
    "  - 8개 스크린 모두 v2 coral 브랜드 컬러 일관 적용 확인\n\n"
    "각자 의견을 남겨주세요!"
)

resp = subprocess.run(
    ['curl', '-s', '-X', 'POST', f'https://discord.com/api/v10/channels/{TFT_THREAD}/messages',
     '-H', f'Authorization: {HEADERS["Authorization"]}',
     '-H', f'Content-Type: {HEADERS["Content-Type"]}',
     '-H', f'User-Agent: {HEADERS["User-Agent"]}',
     '-d', json.dumps({'content': kickoff_body})],
    capture_output=True, text=True
)
result = json.loads(resp.stdout)
print(f'Kickoff message posted: {result.get("id", "FAILED")}')
if 'id' not in result:
    print(f'Error: {json.dumps(result, indent=2)[:500]}')
