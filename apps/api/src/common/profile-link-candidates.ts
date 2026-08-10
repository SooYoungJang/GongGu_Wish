export type ProfileLinkCandidate = {
  url: string;
  label: string | null;
  source: "PLAYWRIGHT_PROFILE";
};

const TRACKING_QUERY_KEYS = new Set([
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "ref",
  "referrer",
]);

function isPrivateOrReservedIpv4(hostname: string) {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some((part) => part > 255)) return true;
  const [a, b, c] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function isUnsafeHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "instagram.com" ||
    host.endsWith(".instagram.com") ||
    host === "instagr.am" ||
    host.endsWith(".instagr.am") ||
    !host.includes(".") ||
    host.includes(":") ||
    isPrivateOrReservedIpv4(host)
  );
}

function normalizeUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (!candidate || candidate.length > 2_048) return null;
  try {
    const url = new URL(candidate);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      isUnsafeHost(url.hostname)
    ) {
      return null;
    }
    for (const key of [...url.searchParams.keys()]) {
      const normalizedKey = key.toLowerCase();
      if (
        normalizedKey.startsWith("utm_") ||
        TRACKING_QUERY_KEYS.has(normalizedKey)
      ) {
        url.searchParams.delete(key);
      }
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeLabel(value: unknown) {
  if (typeof value !== "string") return null;
  const label = value.trim();
  return label ? label.slice(0, 200) : null;
}

export function normalizeProfileLinkCandidates(
  value: unknown,
): ProfileLinkCandidate[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: ProfileLinkCandidate[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const url = normalizeUrl(record.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    result.push({
      url,
      label: normalizeLabel(record.label),
      source: "PLAYWRIGHT_PROFILE",
    });
    if (result.length >= 5) break;
  }
  return result;
}

export function profileLinkCandidatesFromSnapshot(
  value: unknown,
): ProfileLinkCandidate[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return normalizeProfileLinkCandidates(
    (value as Record<string, unknown>).profileLinkCandidates,
  );
}

export function singleProfilePurchaseUrl(value: unknown) {
  const candidates = normalizeProfileLinkCandidates(value);
  return candidates.length === 1 ? candidates[0].url : undefined;
}
