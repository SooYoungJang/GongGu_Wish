import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { collectPostMedia } from './index.ts';

Deno.test('collectPostMedia keeps every carousel slide and preserves first video url', () => {
  const media = {
    carousel_media: [
      {
        media_type: 2,
        image_versions2: {
          candidates: [{ url: 'https://example.com/cover-1.jpg', width: 720, height: 720 }],
        },
        video_versions: [{ url: 'https://example.com/video-1.mp4' }],
      },
      {
        media_type: 1,
        image_versions2: {
          candidates: [{ url: 'https://example.com/image-2.jpg', width: 720, height: 720 }],
        },
      },
      {
        media_type: 2,
        image_versions2: {
          candidates: [{ url: 'https://example.com/cover-3.jpg', width: 720, height: 720 }],
        },
        video_versions: [{ url: 'https://example.com/video-3.mp4' }],
      },
    ],
  } as Record<string, unknown>;

  assertEquals(collectPostMedia(media), {
    imageUrl: 'https://example.com/cover-1.jpg',
    thumbnailUrl: 'https://example.com/cover-1.jpg',
    videoUrl: 'https://example.com/video-1.mp4',
    mediaUrls: [
      'https://example.com/video-1.mp4',
      'https://example.com/image-2.jpg',
      'https://example.com/video-3.mp4',
    ],
    mediaItems: [
      { url: 'https://example.com/video-1.mp4', mediaType: 'VIDEO', thumbnailUrl: 'https://example.com/cover-1.jpg' },
      { url: 'https://example.com/image-2.jpg', mediaType: 'IMAGE', thumbnailUrl: 'https://example.com/image-2.jpg' },
      { url: 'https://example.com/video-3.mp4', mediaType: 'VIDEO', thumbnailUrl: 'https://example.com/cover-3.jpg' },
    ],
    mediaType: 'VIDEO',
  });
});

Deno.test('collectPostMedia falls back to single video cover when there is no carousel', () => {
  const media = {
    media_type: 2,
    image_versions2: {
      candidates: [{ url: 'https://example.com/video-cover.jpg', width: 720, height: 720 }],
    },
    video_versions: [{ url: 'https://example.com/video.mp4' }],
  } as Record<string, unknown>;

  assertEquals(collectPostMedia(media), {
    imageUrl: 'https://example.com/video-cover.jpg',
    thumbnailUrl: 'https://example.com/video-cover.jpg',
    videoUrl: 'https://example.com/video.mp4',
    mediaUrls: ['https://example.com/video-cover.jpg'],
    mediaItems: [{ url: 'https://example.com/video.mp4', mediaType: 'VIDEO', thumbnailUrl: 'https://example.com/video-cover.jpg' }],
    mediaType: 'VIDEO',
  });
});
