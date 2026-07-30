import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const assetDir = fileURLToPath(new URL(".", import.meta.url));
const mobileRoot = path.resolve(assetDir, "../..");

const iconSource = path.join(mobileRoot, "assets", "app-icon.png");
const iconOutput = path.join(assetDir, "app-icon-512.png");
const featureSource = path.join(assetDir, "feature-graphic.svg");
const featureOutput = path.join(assetDir, "feature-graphic-1024x500.png");

await sharp(iconSource)
  .resize(512, 512, { fit: "cover", kernel: sharp.kernel.lanczos3 })
  .ensureAlpha(1)
  .png({ adaptiveFiltering: true, compressionLevel: 9 })
  .toFile(iconOutput);

await sharp(featureSource)
  .flatten({ background: "#ffffff" })
  .removeAlpha()
  .png({ adaptiveFiltering: true, compressionLevel: 9 })
  .toFile(featureOutput);

const expectedAssets = [
  {
    file: "app-icon-512.png",
    width: 512,
    height: 512,
    channels: 4,
    maxBytes: 1024 * 1024,
  },
  {
    file: "feature-graphic-1024x500.png",
    width: 1024,
    height: 500,
    channels: 3,
  },
  ...["ranking", "reels", "detail", "activity"].map((name, index) => ({
    file: `phone-0${index + 1}-${name}.png`,
    width: 1080,
    height: 1920,
  })),
];

for (const expected of expectedAssets) {
  const filePath = path.join(assetDir, expected.file);
  const [metadata, fileStat] = await Promise.all([
    sharp(filePath).metadata(),
    stat(filePath),
  ]);

  if (
    metadata.format !== "png" ||
    metadata.width !== expected.width ||
    metadata.height !== expected.height
  ) {
    throw new Error(
      `${expected.file}: expected PNG ${expected.width}x${expected.height}, got ${metadata.format} ${metadata.width}x${metadata.height}`,
    );
  }

  if (expected.channels && metadata.channels !== expected.channels) {
    throw new Error(
      `${expected.file}: expected ${expected.channels} channels, got ${metadata.channels}`,
    );
  }

  if (expected.maxBytes && fileStat.size > expected.maxBytes) {
    throw new Error(
      `${expected.file}: ${fileStat.size} bytes exceeds ${expected.maxBytes}`,
    );
  }

  console.log(
    `${expected.file}: ${metadata.width}x${metadata.height}, ${metadata.channels} channels, ${fileStat.size} bytes`,
  );
}
