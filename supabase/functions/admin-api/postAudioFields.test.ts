import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { normalizePostAudioPatch } from "./index.ts";

Deno.test("admin post audio patch persists a trusted source and segment", () => {
  const patch = normalizePostAudioPatch({
    postAudioUrl: "https://scontent-test.cdninstagram.com/audio/post-track.m4a",
    postAudioStartTimeMs: 12_000,
    postAudioDurationMs: 30_000,
  });

  assertEquals(
    patch.post_audio_url,
    "https://scontent-test.cdninstagram.com/audio/post-track.m4a",
  );
  assertEquals(patch.post_audio_start_time_ms, 12_000);
  assertEquals(patch.post_audio_duration_ms, 30_000);
  assertEquals(typeof patch.post_audio_checked_at, "string");
});

Deno.test("admin post audio patch clears stale segment data with its URL", () => {
  const patch = normalizePostAudioPatch({ postAudioUrl: null });

  assertEquals(patch.post_audio_url, null);
  assertEquals(patch.post_audio_start_time_ms, null);
  assertEquals(patch.post_audio_duration_ms, null);
  assertEquals(typeof patch.post_audio_checked_at, "string");
});

Deno.test("admin post audio patch preserves untouched rows", () => {
  assertEquals(normalizePostAudioPatch({ productName: "새 상품" }), {});
});

Deno.test("admin post audio patch rejects untrusted URLs and invalid segments", () => {
  assertThrows(() =>
    normalizePostAudioPatch({
      postAudioUrl: "https://attacker.example/audio.m4a",
    })
  );
  assertThrows(() => normalizePostAudioPatch({ postAudioStartTimeMs: -1 }));
  assertThrows(() => normalizePostAudioPatch({ postAudioDurationMs: 0 }));
});
