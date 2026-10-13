import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function getSystemUiRecoveryTap(xml, alreadyRecovered = false) {
  const nodes = [...xml.matchAll(/<node\b([^>]*)>/g)].map((match) =>
    Object.fromEntries(
      [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((attribute) => [
        attribute[1],
        attribute[2].replace(/&apos;/g, "'"),
      ]),
    ),
  );
  const isSystemUiAnr = nodes.some(
    (node) =>
      node.package === "android" &&
      node["resource-id"] === "android:id/alertTitle" &&
      node.text === "System UI isn't responding",
  );
  if (!isSystemUiAnr) return null;
  if (alreadyRecovered) {
    throw new Error("System UI remained unresponsive after recovery");
  }

  const wait = nodes.find(
    (node) =>
      node.package === "android" &&
      node["resource-id"] === "android:id/aerr_wait" &&
      node.enabled === "true" &&
      node.clickable === "true",
  );
  const bounds = wait?.bounds?.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/);
  if (!bounds) throw new Error("System UI Wait control was unavailable");
  const [left, top, right, bottom] = bounds.slice(1).map(Number);
  if (
    ![left, top, right, bottom].every(Number.isSafeInteger) ||
    left >= right ||
    top >= bottom
  ) {
    throw new Error("System UI Wait control bounds were invalid");
  }
  return [Math.floor((left + right) / 2), Math.floor((top + bottom) / 2)];
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const input = process.argv[2];
    const xml = readFileSync(input && input !== "-" ? input : 0, "utf8");
    const tap = getSystemUiRecoveryTap(xml, process.argv[3] === "true");
    if (tap) console.log(tap.join(" "));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
