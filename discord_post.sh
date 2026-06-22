#!/bin/bash
source /Users/pc/.hermes/profiles/qa/.env 2>/dev/null
TOKEN=*** DISCORD_BOT_TOKEN /Users/pc/.hermes/profiles/qa/.env | cut -d= -f2)
curl -s -X POST "https://discord.com/api/v10/channels/1518280421882728489/messages" \
  -H "Authorization: Bot $TOKEN" \
  -H "Content-Type: application/json" \
  -H "User-Agent: DiscordBot (hermes-qa, 1.0)" \
  -d @/tmp/qa_message.json