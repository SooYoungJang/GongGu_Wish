import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  collectPostMedia,
  extractProfileImageUrl,
  lookupViaHikerAPI,
} from './index.ts';

Deno.test('collectPostMedia keeps every carousel slide and preserves first video url', () => {
  const media = {
    carousel_media: [
      {
        media_type: 2,
        image_versions2: {
          candidates: [{ url: 'https://scontent-test.cdninstagram.com/cover-1.jpg', width: 720, height: 720 }],
        },
        video_versions: [{ url: 'https://scontent-test.cdninstagram.com/video-1.mp4' }],
      },
      {
        media_type: 1,
        image_versions2: {
          candidates: [{ url: 'https://scontent-test.cdninstagram.com/image-2.jpg', width: 720, height: 720 }],
        },
      },
      {
        media_type: 2,
        image_versions2: {
          candidates: [{ url: 'https://scontent-test.cdninstagram.com/cover-3.jpg', width: 720, height: 720 }],
        },
        video_versions: [{ url: 'https://scontent-test.cdninstagram.com/video-3.mp4' }],
      },
    ],
  } as Record<string, unknown>;

  assertEquals(collectPostMedia(media), {
    imageUrl: 'https://scontent-test.cdninstagram.com/cover-1.jpg',
    thumbnailUrl: 'https://scontent-test.cdninstagram.com/cover-1.jpg',
    videoUrl: 'https://scontent-test.cdninstagram.com/video-1.mp4',
    mediaUrls: [
      'https://scontent-test.cdninstagram.com/video-1.mp4',
      'https://scontent-test.cdninstagram.com/image-2.jpg',
      'https://scontent-test.cdninstagram.com/video-3.mp4',
    ],
    mediaItems: [
      { url: 'https://scontent-test.cdninstagram.com/video-1.mp4', mediaType: 'VIDEO', thumbnailUrl: 'https://scontent-test.cdninstagram.com/cover-1.jpg' },
      { url: 'https://scontent-test.cdninstagram.com/image-2.jpg', mediaType: 'IMAGE', thumbnailUrl: 'https://scontent-test.cdninstagram.com/image-2.jpg' },
      { url: 'https://scontent-test.cdninstagram.com/video-3.mp4', mediaType: 'VIDEO', thumbnailUrl: 'https://scontent-test.cdninstagram.com/cover-3.jpg' },
    ],
    mediaType: 'VIDEO',
    postAudioUrl: null,
    postAudioStartTimeMs: null,
    postAudioDurationMs: null,
  });
});

Deno.test('collectPostMedia falls back to single video cover when there is no carousel', () => {
  const media = {
    media_type: 2,
    image_versions2: {
      candidates: [{ url: 'https://scontent-test.cdninstagram.com/video-cover.jpg', width: 720, height: 720 }],
    },
    video_versions: [{ url: 'https://scontent-test.cdninstagram.com/video.mp4' }],
  } as Record<string, unknown>;

  assertEquals(collectPostMedia(media), {
    imageUrl: 'https://scontent-test.cdninstagram.com/video-cover.jpg',
    thumbnailUrl: 'https://scontent-test.cdninstagram.com/video-cover.jpg',
    videoUrl: 'https://scontent-test.cdninstagram.com/video.mp4',
    mediaUrls: ['https://scontent-test.cdninstagram.com/video-cover.jpg'],
    mediaItems: [{ url: 'https://scontent-test.cdninstagram.com/video.mp4', mediaType: 'VIDEO', thumbnailUrl: 'https://scontent-test.cdninstagram.com/video-cover.jpg' }],
    mediaType: 'VIDEO',
    postAudioUrl: null,
    postAudioStartTimeMs: null,
    postAudioDurationMs: null,
  });
});

Deno.test('collectPostMedia exposes carousel post music without replacing embedded video media', () => {
  const media = {
    carousel_media: [
      {
        media_type: 2,
        image_versions2: {
          candidates: [{ url: 'https://scontent-test.cdninstagram.com/carousel-cover.jpg', width: 720, height: 720 }],
        },
        video_versions: [{ url: 'https://scontent-test.cdninstagram.com/carousel-video.mp4' }],
      },
    ],
    music_metadata: {
      music_info: {
        music_asset_info: {
          progressive_download_url: 'https://scontent-test.cdninstagram.com/audio/carousel-track.m4a',
        },
        music_consumption_info: {
          audio_asset_start_time_in_ms: 12_000,
          overlap_duration_in_ms: 30_000,
        },
      },
    },
  } as Record<string, unknown>;

  const normalized = collectPostMedia(media) as Record<string, unknown>;

  assertEquals(
    {
      videoUrl: normalized.videoUrl,
      mediaItems: normalized.mediaItems,
      postAudioUrl: normalized.postAudioUrl,
      postAudioStartTimeMs: normalized.postAudioStartTimeMs,
      postAudioDurationMs: normalized.postAudioDurationMs,
    },
    {
      videoUrl: 'https://scontent-test.cdninstagram.com/carousel-video.mp4',
      mediaItems: [
        {
          url: 'https://scontent-test.cdninstagram.com/carousel-video.mp4',
          mediaType: 'VIDEO',
          thumbnailUrl: 'https://scontent-test.cdninstagram.com/carousel-cover.jpg',
        },
      ],
      postAudioUrl: 'https://scontent-test.cdninstagram.com/audio/carousel-track.m4a',
      postAudioStartTimeMs: 12_000,
      postAudioDurationMs: 30_000,
    },
  );
});

Deno.test('collectPostMedia rejects untrusted Hiker visual media URLs', () => {
  assertEquals(collectPostMedia({
    image_versions2: {
      candidates: [{ url: 'https://attacker.example/image.jpg', width: 720, height: 720 }],
    },
    video_versions: [
      { url: 'javascript:alert(1)' },
      { url: 'https://cdninstagram.com.example.com/video.mp4' },
    ],
  }), {
    imageUrl: null,
    thumbnailUrl: null,
    videoUrl: null,
    mediaUrls: [],
    mediaItems: [],
    mediaType: null,
    postAudioUrl: null,
    postAudioStartTimeMs: null,
    postAudioDurationMs: null,
  });
});

Deno.test('extractProfileImageUrl prefers a trusted HD profile image across user and owner', () => {
  assertEquals(extractProfileImageUrl({
    user: {
      profile_pic_url: 'https://scontent-test.cdninstagram.com/profile-standard.jpg',
    },
    owner: {
      profile_pic_url_hd: 'https://scontent-test.cdninstagram.com/profile-hd.jpg',
    },
  }), 'https://scontent-test.cdninstagram.com/profile-hd.jpg');
});

Deno.test('extractProfileImageUrl rejects an untrusted HD URL and falls back to the trusted standard URL', () => {
  assertEquals(extractProfileImageUrl({
    user: {
      profile_pic_url_hd: 'https://attacker.example/profile-hd.jpg',
      profile_pic_url: 'https://scontent-test.cdninstagram.com/profile-standard.jpg',
    },
  }), 'https://scontent-test.cdninstagram.com/profile-standard.jpg');
});

Deno.test('lookupViaHikerAPI exposes profileImageUrl from the existing media payload without another request', async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = (() => {
    requestCount += 1;
    return Promise.resolve(new Response(JSON.stringify({
      media_or_ad: {
        owner: {
          username: 'gonggu_creator',
          profile_pic_url: 'https://scontent-test.cdninstagram.com/profile.jpg',
        },
        image_versions2: {
          candidates: [{
            url: 'https://scontent-test.cdninstagram.com/post.jpg',
            width: 720,
            height: 720,
          }],
        },
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
  }) as typeof fetch;

  try {
    const result = await lookupViaHikerAPI(
      'https://www.instagram.com/p/test-post/',
      'test-api-key',
    );

    assertEquals(result.profileImageUrl, 'https://scontent-test.cdninstagram.com/profile.jpg');
    assertEquals(requestCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('lookupViaHikerAPI falls back to the trusted top-level user profile image', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => Promise.resolve(new Response(JSON.stringify({
    user: {
      username: 'top_level_creator',
      profile_pic_url_hd: 'https://scontent-test.cdninstagram.com/top-level-profile-hd.jpg',
      profile_pic_url: 'https://scontent-test.cdninstagram.com/top-level-profile.jpg',
    },
    media_or_ad: {
      image_versions2: {
        candidates: [{
          url: 'https://scontent-test.cdninstagram.com/top-level-post.jpg',
          width: 720,
          height: 720,
        }],
      },
    },
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }))) as typeof fetch;

  try {
    const result = await lookupViaHikerAPI(
      'https://www.instagram.com/p/top-level-user/',
      'test-api-key',
    );

    assertEquals({
      username: result.username,
      profileImageUrl: result.profileImageUrl,
    }, {
      username: 'top_level_creator',
      profileImageUrl: 'https://scontent-test.cdninstagram.com/top-level-profile-hd.jpg',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
