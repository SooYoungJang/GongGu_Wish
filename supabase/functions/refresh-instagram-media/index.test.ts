import { assert, assertFalse } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { isInstagramCdnUrl } from './index.ts';

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
