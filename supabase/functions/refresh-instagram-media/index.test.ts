import {
  assert,
  assertEquals,
  assertFalse,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  buildPostAudioUpdatePatch,
  getOriginalInstagramUrl,
  handler,
  isInstagramCdnUrl,
  isUserPostAudioRecoveryAllowed,
  normalizeRefreshExecution,
  trustedInstagramPostUrl,
} from './index.ts';

Deno.test('recovers the original Instagram URL from raw-post group buys', () => {
  const rawPostUrl = 'https://www.instagram.com/reel/DUMMY_RAW_POST/';

  assertEquals(
    getOriginalInstagramUrl({
      raw_post: { post_url: rawPostUrl },
      submission: { instagram_url: null },
    }),
    rawPostUrl,
  );
});

Deno.test('recognizes Instagram media served from both CDN host families', () => {
  assert(
    isInstagramCdnUrl(
      'https://scontent-lga3-1.cdninstagram.com/o1/v/t2/f2/video.mp4?oe=6A5F0620',
    ),
  );
  assert(
    isInstagramCdnUrl(
      'https://instagram.frix7-1.fna.fbcdn.net/o1/v/t2/f2/video.mp4?oe=6A5F0620',
    ),
  );
});

Deno.test('does not treat lookalike hosts as Instagram CDNs', () => {
  assertFalse(isInstagramCdnUrl('https://example.com/cdninstagram.com/video.mp4'));
  assertFalse(isInstagramCdnUrl('https://fbcdn.net.example.com/video.mp4'));
});

Deno.test('accepts only canonical HTTPS Instagram post URLs for Hiker lookups', () => {
  assertEquals(
    trustedInstagramPostUrl('https://www.instagram.com/p/DXHIFUBiUQi/'),
    'https://www.instagram.com/p/DXHIFUBiUQi/',
  );
  assertEquals(
    trustedInstagramPostUrl('https://instagram.com/reel/DXHIFUBiUQi/?utm_source=test'),
    'https://instagram.com/reel/DXHIFUBiUQi/?utm_source=test',
  );
  assertEquals(trustedInstagramPostUrl('https://instagram.com.evil.test/p/DXHIFUBiUQi/'), null);
  assertEquals(trustedInstagramPostUrl('http://instagram.com/p/DXHIFUBiUQi/'), null);
  assertEquals(trustedInstagramPostUrl('https://instagram.com/accounts/login/'), null);
});

Deno.test('does not cache a retryable post audio lookup as confirmed absence', () => {
  assertEquals(buildPostAudioUpdatePatch({
    postAudioUrl: null,
    postAudioStartTimeMs: null,
    postAudioDurationMs: null,
    postAudioLookupStatus: 'RETRYABLE',
  }, '2026-07-28T00:00:00.000Z'), {});
});

Deno.test('persists confirmed post audio lookup results', () => {
  assertEquals(buildPostAudioUpdatePatch({
    postAudioUrl: null,
    postAudioStartTimeMs: null,
    postAudioDurationMs: null,
    postAudioLookupStatus: 'NONE',
  }, '2026-07-28T00:00:00.000Z'), {
    post_audio_url: null,
    post_audio_start_time_ms: null,
    post_audio_duration_ms: null,
    post_audio_checked_at: '2026-07-28T00:00:00.000Z',
  });
});

Deno.test('rejects unauthenticated refresh requests before invoking Hiker', async () => {
  const response = await handler(new Request('https://example.com/refresh-instagram-media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupBuyId: 'group-buy-1', force: true }),
  }));

  assertEquals(response.status, 401);
});

Deno.test('allows authenticated users to refresh only one row with fixed bounds', () => {
  assertEquals(
    normalizeRefreshExecution({
      groupBuyId: 'group-buy-1',
      force: true,
      limit: 999,
      refreshWindowHours: 999,
    }, 'user'),
    {
      mode: 'single',
      force: false,
      limit: 1,
      refreshWindowHours: 1,
      claimCooldownSeconds: 900,
    },
  );
});

Deno.test('allows user audio recovery only for the exact trusted URL stored on the row', () => {
  const storedUrl = 'https://scontent-test.cdninstagram.com/audio/failed-track.m4a?oe=6A5F0620';
  assert(isUserPostAudioRecoveryAllowed(storedUrl, storedUrl));
  assertFalse(isUserPostAudioRecoveryAllowed(storedUrl, `${storedUrl}&changed=true`));
  assertFalse(isUserPostAudioRecoveryAllowed(storedUrl, 'https://example.com/audio.m4a'));
  assertFalse(isUserPostAudioRecoveryAllowed(null, storedUrl));
});

Deno.test('rejects authenticated-user batch refreshes', async () => {
  await assertRejects(
    async () => normalizeRefreshExecution({ mode: 'batch' }, 'user'),
    Error,
    'Batch refresh requires a trusted caller',
  );
});

Deno.test('locks cron refreshes to safe batch parameters', () => {
  assertEquals(
    normalizeRefreshExecution({
      mode: 'batch',
      force: true,
      limit: 999,
      refreshWindowHours: 999,
    }, 'cron'),
    {
      mode: 'batch',
      force: false,
      limit: 100,
      refreshWindowHours: 1,
      claimCooldownSeconds: 3300,
    },
  );
});

Deno.test('bounds service batch input while preserving trusted force requests', () => {
  assertEquals(
    normalizeRefreshExecution({
      mode: 'batch',
      force: true,
      limit: 999,
      refreshWindowHours: 999,
    }, 'service'),
    {
      mode: 'batch',
      force: true,
      limit: 100,
      refreshWindowHours: 24,
      claimCooldownSeconds: 1,
    },
  );
});
