import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import type sharpType from "sharp";

const webRequire = createRequire(import.meta.url);
// Resolve from Next itself: a separate Admin installation is not evidence
// that the image optimizer is using the same native dependency.
const nextRequire = createRequire(webRequire.resolve("next/package.json"));
const sharp = nextRequire("sharp") as typeof sharpType;
const { getSharp, optimizeImage } = webRequire(
  "next/dist/server/image-optimizer",
) as typeof import("next/dist/server/image-optimizer");

describe("Next image runtime", () => {
  it("loads the explicitly pinned, patched Sharp from Next's resolution path", () => {
    expect(sharp.versions.sharp).toBe("0.35.5");
    expect(nextRequire.resolve("sharp")).toBe(webRequire.resolve("sharp"));
    expect(getSharp(undefined)).toBe(sharp);
  });

  it.each(["png", "jpeg", "webp", "avif"] as const)(
    "resizes and round-trips a normal %s image",
    async (format) => {
      const input = await sharp({
        create: {
          width: 16,
          height: 12,
          channels: 3,
          background: "#ff8040",
        },
      }).toFormat(format).toBuffer();
      // Exercise Next's loader allowlist and AVIF gate, not only Sharp directly.
      const output = await optimizeImage({
        buffer: input,
        contentType: `image/${format}`,
        quality: 75,
        width: 8,
        height: 6,
      });
      const metadata = await sharp(output).metadata();
      expect(metadata.width).toBe(8);
      expect(metadata.height).toBe(6);
    },
  );

  it("renders an ordinary inline SVG without external resources", async () => {
    const input = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="12"><rect width="16" height="12" fill="orange"/></svg>',
    );
    const output = await optimizeImage({
      buffer: input,
      contentType: "image/png",
      quality: 75,
      width: 8,
      height: 6,
    });
    expect(await sharp(output).metadata()).toMatchObject({
      width: 8,
      height: 6,
      format: "png",
    });
  });
});
