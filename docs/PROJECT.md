# GongGu Wish

Instagram group-buy monitoring service.

## Scope

- No OpenAI API usage.
- Local LLM parsing through JSONL export/import.
- Backend stores raw posts, exports parsing candidates, imports parsed results, supports review and notifications.
- Raw post data is preserved.
- Parsed data is schema validated before import.

## Layout

- Root: Expo React Native mobile app.
- `apps/api`: NestJS, Prisma, PostgreSQL, Redis, BullMQ, Firebase Admin SDK.
- `workers/instagram`: Python worker with instagrapi and APScheduler.
- `exports`: JSONL input for local LLM.
- `imports`: JSONL output from local LLM.

## Setup

```bash
cp .env.example .env
docker compose up -d
npm install
npm --prefix apps/api install
npm run db:generate
npm run db:migrate
```

## API

```bash
npm run api:dev
```

Swagger:

```text
http://localhost:3000/docs
```

## Mobile

```bash
npm run start
npm run ios
npm run android
```

## Instagram Worker

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r workers/instagram/requirements.txt
npm run worker:instagram
```

## Raw Export

```bash
npm run export:raw-posts
npm run export:raw-posts -- --limit=100
npm run export:raw-posts -- --output=exports/raw_posts.jsonl
npm run export:raw-posts -- --from=2026-06-01 --to=2026-06-12
```

Export 대상:

- `raw_posts.parsing_status = PENDING`
- `raw_posts.is_candidate = true`
- 아직 `group_buys`에 연결되지 않은 Raw Post

Export 이후:

- `raw_posts.parsing_status = EXPORTED`
- `raw_posts.exported_at = now()`

JSONL 한 줄 예시:

```json
{"raw_post_id":"123","instagram_post_id":"ABC123","influencer_username":"some_influencer","caption":"오늘 공구 오픈합니다...","post_url":"https://instagram.com/p/ABC123","image_url":"https://...","taken_at":"2026-06-12T10:00:00.000Z"}
```

## Parsed Import

```bash
npm run import:parsed-group-buys -- imports/parsed_group_buys.jsonl
npm run import:parsed-group-buys -- --dry-run imports/parsed_group_buys.jsonl
```

Import behavior:

- `is_group_buy=true && confidence >= 0.7`: `group_buys.status=APPROVED`
- `is_group_buy=true && confidence < 0.7`: `group_buys.status=REVIEW_REQUIRED`
- `is_group_buy=false`: `raw_posts.parsing_status=NOT_GROUP_BUY`
- `parse_error` exists: `raw_posts.parsing_status=FAILED`

Parsed JSONL 한 줄은 반드시 아래 형태를 지켜야 합니다.

```json
{"raw_post_id":"123","is_group_buy":true,"product_name":"제품명","brand_name":"브랜드명","start_date":"2026-06-12T00:00:00+09:00","end_date":"2026-06-15T23:59:59+09:00","purchase_url":"https://example.com","discount_info":"20% 할인","summary":"제품 공동구매가 진행 중입니다.","confidence":0.82,"parse_error":null}
```

로컬 LLM은 OpenAI API 없이 export된 JSONL을 읽고, 동일한 `raw_post_id`를 가진 JSONL 결과 파일만 생성하면 됩니다.

## Tests

```bash
npm run typecheck
npm --prefix apps/api run typecheck
npm run api:test
```
