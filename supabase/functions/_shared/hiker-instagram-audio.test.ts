import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  extractPostAudioInfo,
  hasMp4AudioTrack,
  isInstagramCdnUrl,
  preferAudioVideoVersions,
  resolvePostAudio,
} from "./hiker-instagram-audio.ts";

const encoder = new TextEncoder();

function mp4Handler(handlerType: "soun" | "vide"): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set(encoder.encode("hdlr"), 4);
  bytes.set(encoder.encode(handlerType), 16);
  return bytes;
}

Deno.test("extractPostAudioInfo reads a playable Instagram music asset segment", () => {
  assertEquals(
    extractPostAudioInfo({
      music_metadata: {
        music_info: {
          music_asset_info: {
            fast_start_progressive_download_url:
              "https://scontent-test.cdninstagram.com/audio/post-track.m4a",
          },
          music_consumption_info: {
            audio_asset_start_time_in_ms: 4_500,
            overlap_duration_in_ms: 9_000,
          },
        },
      },
    }),
    {
      postAudioUrl:
        "https://scontent-test.cdninstagram.com/audio/post-track.m4a",
      postAudioStartTimeMs: 4_500,
      postAudioDurationMs: 9_000,
    },
  );
});

Deno.test("extractPostAudioInfo rejects muted, non-HTTPS, and lookalike audio assets", () => {
  assertEquals(
    extractPostAudioInfo({
      music_metadata: {
        progressive_download_url:
          "https://scontent-test.cdninstagram.com/audio/muted.m4a",
        should_mute_audio: true,
      },
    }),
    {
      postAudioUrl: null,
      postAudioStartTimeMs: null,
      postAudioDurationMs: null,
    },
  );
  assertEquals(
    isInstagramCdnUrl("http://scontent-test.cdninstagram.com/a.m4a"),
    false,
  );
  assertEquals(
    isInstagramCdnUrl("https://cdninstagram.com.example.com/a.m4a"),
    false,
  );
  assertEquals(
    isInstagramCdnUrl("https://cdninstagram.com:444/a.m4a"),
    false,
  );
  assertEquals(
    isInstagramCdnUrl("https://cdninstagram.com:443/a.m4a"),
    false,
  );
});

Deno.test("extractPostAudioInfo keeps fields and mute state scoped to one track", () => {
  assertEquals(
    extractPostAudioInfo({
      music_metadata: {
        music_info: {
          music_asset_info: {
            progressive_download_url:
              "https://scontent-test.cdninstagram.com/audio/primary.m4a",
          },
          music_consumption_info: {
            audio_asset_start_time_in_ms: 4_000,
            overlap_duration_in_ms: 20_000,
          },
        },
      },
      clips_metadata: {
        music_info: {
          music_asset_info: {
            progressive_download_url:
              "https://scontent-test.cdninstagram.com/audio/unrelated.m4a",
          },
          music_consumption_info: {
            audio_asset_start_time_in_ms: 99_000,
            overlap_duration_in_ms: 1_000,
            should_mute_audio: true,
          },
        },
      },
    }),
    {
      postAudioUrl: "https://scontent-test.cdninstagram.com/audio/primary.m4a",
      postAudioStartTimeMs: 4_000,
      postAudioDurationMs: 20_000,
    },
  );
});

Deno.test("resolvePostAudio uses the documented Hiker track endpoint when media only has an id", async () => {
  let requestedUrl = "";
  const result = await resolvePostAudio(
    {
      music_metadata: {
        music_info: {
          music_asset_info: { audio_cluster_id: "track-123" },
          music_consumption_info: {
            audio_asset_start_time_in_ms: 12_000,
            overlap_duration_in_ms: 30_000,
          },
        },
      },
    },
    "test-key",
    (async (input, init) => {
      requestedUrl = String(input);
      assertEquals(new Headers(init?.headers).get("x-access-key"), "test-key");
      return Response.json({
        response: {
          metadata: {
            music_info: {
              music_asset_info: {
                fast_start_progressive_download_url:
                  "https://instagram.test.fbcdn.net/audio/resolved-track.m4a",
              },
            },
          },
        },
      });
    }) as typeof fetch,
  );

  assert(requestedUrl.startsWith("https://api.hikerapi.com/v2/track/by/id?"));
  assert(requestedUrl.includes("track_id=track-123"));
  assert(requestedUrl.includes("safe_int=true"));
  assertEquals(result, {
    postAudioUrl: "https://instagram.test.fbcdn.net/audio/resolved-track.m4a",
    postAudioStartTimeMs: 12_000,
    postAudioDurationMs: 30_000,
    postAudioLookupStatus: "FOUND",
  });
});

Deno.test("resolvePostAudio distinguishes confirmed absence from retryable track failures", async () => {
  assertEquals(
    await resolvePostAudio({}, "test-key", fetch),
    {
      postAudioUrl: null,
      postAudioStartTimeMs: null,
      postAudioDurationMs: null,
      postAudioLookupStatus: "NONE",
    },
  );

  assertEquals(
    await resolvePostAudio(
      {
        music_metadata: {
          music_info: {
            music_asset_info: { audio_cluster_id: "retry-track" },
          },
        },
      },
      "test-key",
      (async () => {
        throw new TypeError("temporary network failure");
      }) as typeof fetch,
    ),
    {
      postAudioUrl: null,
      postAudioStartTimeMs: null,
      postAudioDurationMs: null,
      postAudioLookupStatus: "RETRYABLE",
    },
  );
});

Deno.test("preferAudioVideoVersions keeps Hiker order except when another MP4 has an audio track", async () => {
  const silentUrl = "https://scontent-test.cdninstagram.com/video/silent.mp4";
  const audioUrl =
    "https://scontent-test.cdninstagram.com/video/with-audio.mp4";
  const requestedRanges: string[] = [];
  const preferred = await preferAudioVideoVersions(
    {
      video_versions: [{ url: silentUrl }, { url: audioUrl }],
    },
    (async (input, init) => {
      requestedRanges.push(new Headers(init?.headers).get("range") ?? "");
      const bytes = String(input) === audioUrl
        ? mp4Handler("soun")
        : mp4Handler("vide");
      return new Response(bytes.buffer as ArrayBuffer, {
        status: 206,
        headers: {
          "content-length": String(bytes.byteLength),
          "content-range": requestedRanges.at(-1)?.startsWith("bytes=-")
            ? `bytes ${2_000_000 - bytes.byteLength}-1999999/2000000`
            : `bytes 0-${bytes.byteLength - 1}/2000000`,
        },
      });
    }) as typeof fetch,
  );

  assertEquals(
    (preferred.video_versions as Array<{ url: string }>).map((item) =>
      item.url
    ),
    [audioUrl, silentUrl],
  );
  assert(requestedRanges.includes("bytes=0-1048575"));
  assert(hasMp4AudioTrack(mp4Handler("soun")));
  assertEquals(hasMp4AudioTrack(mp4Handler("vide")), false);
});

Deno.test("preferAudioVideoVersions rejects a range response that streams past the byte cap", async () => {
  const silentUrl =
    "https://scontent-test.cdninstagram.com/video/bounded-silent.mp4";
  const oversizedUrl =
    "https://scontent-test.cdninstagram.com/video/oversized-audio.mp4";
  let oversizedChunksProduced = 0;

  const preferred = await preferAudioVideoVersions(
    {
      video_versions: [{ url: silentUrl }, { url: oversizedUrl }],
    },
    (async (input, init) => {
      const range = new Headers(init?.headers).get("range") ?? "";
      if (String(input) === silentUrl) {
        const bytes = mp4Handler("vide");
        return new Response(bytes.buffer as ArrayBuffer, {
          status: 206,
          headers: {
            "content-length": String(bytes.byteLength),
            "content-range": range.startsWith("bytes=-")
              ? `bytes ${2_000_000 - bytes.byteLength}-1999999/2000000`
              : `bytes 0-${bytes.byteLength - 1}/2000000`,
          },
        });
      }

      const chunkSize = 64 * 1024;
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          oversizedChunksProduced += 1;
          const chunk = new Uint8Array(chunkSize);
          if (oversizedChunksProduced === 1) {
            chunk.set(mp4Handler("soun"));
          }
          controller.enqueue(chunk);
          if (oversizedChunksProduced >= 40) controller.close();
        },
      });
      return new Response(stream, {
        status: 206,
        headers: {
          "content-length": "32",
          "content-range": range.startsWith("bytes=-")
            ? "bytes 1951424-2999999/3000000"
            : "bytes 0-1048575/3000000",
        },
      });
    }) as typeof fetch,
  );

  assertEquals(
    (preferred.video_versions as Array<{ url: string }>).map((item) =>
      item.url
    ),
    [silentUrl, oversizedUrl],
  );
  assert(oversizedChunksProduced < 40);
});

Deno.test("preferAudioVideoVersions caps carousel probe fan-out and concurrency", async () => {
  let activeRequests = 0;
  let maxActiveRequests = 0;
  let totalRequests = 0;
  const carousel = Array.from({ length: 50 }, (_, itemIndex) => ({
    video_versions: Array.from({ length: 3 }, (_, versionIndex) => ({
      url:
        `https://scontent-test.cdninstagram.com/video/${itemIndex}-${versionIndex}.mp4`,
    })),
  }));

  const preferred = await preferAudioVideoVersions(
    { carousel_media: carousel },
    (async (_input, init) => {
      totalRequests += 1;
      activeRequests += 1;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
      await new Promise((resolve) => setTimeout(resolve, 1));
      activeRequests -= 1;
      const bytes = mp4Handler("vide");
      const range = new Headers(init?.headers).get("range") ?? "";
      return new Response(bytes.buffer as ArrayBuffer, {
        status: 206,
        headers: {
          "content-length": String(bytes.byteLength),
          "content-range": range.startsWith("bytes=-")
            ? `bytes ${2_000_000 - bytes.byteLength}-1999999/2000000`
            : `bytes 0-${bytes.byteLength - 1}/2000000`,
        },
      });
    }) as typeof fetch,
  );

  assertEquals((preferred.carousel_media as unknown[]).length, 50);
  assert(totalRequests <= 36);
  assert(maxActiveRequests <= 6);
});
