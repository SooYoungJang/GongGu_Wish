import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { validate } from "./index.ts";

const baseSubmission = {
  productName: "테스트 상품",
  instagramUrl: "https://www.instagram.com/p/example/",
};

Deno.test("public submission persists trusted post audio fields", () => {
  const result = validate({
    ...baseSubmission,
    postAudioUrl: "https://scontent-test.cdninstagram.com/audio/post-track.m4a",
    postAudioStartTimeMs: 12_000,
    postAudioDurationMs: 30_000,
  });

  if (!("data" in result)) throw new Error("expected valid submission");
  assertEquals(
    result.data.post_audio_url,
    "https://scontent-test.cdninstagram.com/audio/post-track.m4a",
  );
  assertEquals(result.data.post_audio_start_time_ms, 12_000);
  assertEquals(result.data.post_audio_duration_ms, 30_000);
  assertEquals(typeof result.data.post_audio_checked_at, "string");
});

Deno.test("public submission records an explicit no-audio result", () => {
  const result = validate({ ...baseSubmission, postAudioUrl: null });

  if (!("data" in result)) throw new Error("expected valid submission");
  assertEquals(result.data.post_audio_url, null);
  assertEquals(result.data.post_audio_start_time_ms, null);
  assertEquals(result.data.post_audio_duration_ms, null);
  assertEquals(typeof result.data.post_audio_checked_at, "string");
});

Deno.test("public submission leaves legacy requests eligible for backfill", () => {
  const result = validate(baseSubmission);

  if (!("data" in result)) throw new Error("expected valid submission");
  assertEquals(result.data.post_audio_checked_at, null);
});

Deno.test("public submission rejects untrusted audio URLs and invalid segments", () => {
  assertEquals(
    validate({
      ...baseSubmission,
      postAudioUrl: "https://attacker.example/audio.m4a",
    }),
    { error: "게시물 오디오 URL을 확인해주세요." },
  );
  assertEquals(
    validate({
      ...baseSubmission,
      postAudioUrl:
        "https://scontent-test.cdninstagram.com/audio/post-track.m4a",
      postAudioDurationMs: 0,
    }),
    { error: "게시물 오디오 재생 구간을 확인해주세요." },
  );
});
