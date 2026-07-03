#!/usr/bin/env node
// Backfill media_urls/media_items/thumbnail_url/video_url/media_type for existing group_buys
// by re-looking up each submission's instagram_url through the fixed hiker-lookup
// edge function and updating via the admin-api edge function (service_role).
//
// Usage:
//   node scripts/backfill-media.mjs
//
// Reads EXPO_PUBLIC_SUPABASE_ANON_KEY from apps/mobile/.env or repo .env.
// Safe to re-run: skips rows whose media_urls already match the freshly looked-up set.

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const SUPABASE_URL = 'https://iosdoheblabfimkjnvfj.supabase.co';

async function loadAnonKey() {
  const candidates = [
    path.join(REPO_ROOT, 'apps/mobile/.env'),
    path.join(REPO_ROOT, '.env'),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const text = await readFile(file, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      const match =
        trimmed.match(/^EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)$/) ??
        trimmed.match(/^SUPABASE_ANON_KEY=(.+)$/);
      if (match) {
        return match[1].trim().replace(/^["']|["']$/g, '');
      }
    }
  }
  throw new Error('EXPO_PUBLIC_SUPABASE_ANON_KEY not found in .env files');
}

async function postJson(url, payload, apiKey) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response (${response.status}) from ${url}: ${text.slice(0, 200)}`);
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json;
}

async function lookupInstagram(url, apiKey) {
  return postJson(`${SUPABASE_URL}/functions/v1/hiker-lookup`, { url }, apiKey);
}

async function patchGroupBuy(groupBuyId, body, apiKey) {
  return postJson(
    `${SUPABASE_URL}/functions/v1/admin-api`,
    {
      path: `/admin/group-buys/${groupBuyId}`,
      method: 'PATCH',
      body,
    },
    apiKey,
  );
}

async function fetchSubmissions(apiKey) {
  const url = `${SUPABASE_URL}/rest/v1/gonggu_submissions?select=id,instagram_url,group_buy_id,product_name&group_buy_id=not.is.null&order=created_at.desc`;
  const response = await fetch(url, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch submissions: HTTP ${response.status}`);
  }
  return response.json();
}

function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

async function main() {
  const apiKey = await loadAnonKey();
  console.log('Loaded Supabase anon key (len=%d).', apiKey.length);

  const submissions = await fetchSubmissions(apiKey);
  console.log('Found %d submissions linked to a group_buy.', submissions.length);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const submission of submissions) {
    const { group_buy_id: groupBuyId, instagram_url: instagramUrl, product_name: productName } = submission;
    if (!instagramUrl || !groupBuyId) {
      console.log('SKIP  %s — missing url or group_buy_id', groupBuyId);
      skipped += 1;
      continue;
    }

    let info;
    try {
      info = await lookupInstagram(instagramUrl, apiKey);
    } catch (error) {
      console.log('FAIL  %s — hiker-lookup error: %s', groupBuyId, error.message);
      failed += 1;
      continue;
    }

    const mediaUrls = Array.isArray(info.mediaUrls) ? info.mediaUrls : [];
    const mediaItems = Array.isArray(info.mediaItems) ? info.mediaItems : [];
    if (mediaUrls.length === 0) {
      console.log('SKIP  %s — no media returned', groupBuyId);
      skipped += 1;
      continue;
    }

    // Re-fetch current row to compare and avoid no-op writes.
    let current;
    try {
      const resp = await fetch(
        `${SUPABASE_URL}/rest/v1/group_buys?select=media_urls,media_items&id=eq.${groupBuyId}`,
        { headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` } },
      );
      const rows = await resp.json();
      current = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    } catch {
      current = null;
    }

    if (current && arraysEqual(current.media_urls, mediaUrls) && JSON.stringify(current.media_items ?? []) === JSON.stringify(mediaItems)) {
      console.log('SKIP  %s — already up to date (%d items)', groupBuyId, mediaUrls.length);
      skipped += 1;
      continue;
    }

    const patchBody = {
      media_urls: mediaUrls,
      media_items: mediaItems,
      thumbnail_url: info.thumbnailUrl ?? mediaUrls[0] ?? null,
      video_url: info.videoUrl ?? null,
      media_type: info.mediaType ?? null,
    };

    try {
      await patchGroupBuy(groupBuyId, patchBody, apiKey);
      console.log(
        'OK    %s — %s — updated media_urls to %d item(s)',
        groupBuyId,
        (productName ?? '').slice(0, 30),
        mediaUrls.length,
      );
      updated += 1;
    } catch (error) {
      console.log('FAIL  %s — admin-api patch error: %s', groupBuyId, error.message);
      failed += 1;
    }

    // Be polite to the Hiker API rate limiter between requests.
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  console.log('\nBackfill complete: updated=%d, skipped=%d, failed=%d', updated, skipped, failed);
}

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
