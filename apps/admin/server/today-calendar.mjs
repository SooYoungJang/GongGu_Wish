const PROJECTS = {
  production: 'https://iosdoheblabfimkjnvfj.supabase.co',
  preview: 'https://xwblovggtvbpiusjfokq.supabase.co',
};
const OFFSET = 9 * 3600000;
export const kstDate = now => new Date(now + OFFSET).toISOString().slice(0, 10);
const cache = new Map();
export function publicKey(key) {
  if (typeof key !== 'string') return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  try { return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; }
  catch { return false; }
}
export function configuration(env) {
  const mode = env.VERCEL_ENV;
  const origin = (env.TODAY_CALENDAR_SUPABASE_URL ?? env.VITE_SUPABASE_URL)?.replace(/\/$/, '');
  const key = env.TODAY_CALENDAR_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY;
  if (!PROJECTS[mode] || origin !== PROJECTS[mode] || !publicKey(key)) return null;
  // This is an explicit operator attestation, not proof the Firewall is configured.
  // Keep the endpoint off until platform rate limiting has been verified.
  if (env.TODAY_CALENDAR_ENABLED !== 'true') return null;
  return { mode, origin, key };
}
function project(data, date) {
  if (!data || data.date !== date || data.timezone !== 'Asia/Seoul'
    || !Number.isSafeInteger(data.count) || data.count < 0
    || !Array.isArray(data.items) || data.items.length !== Math.min(data.count, 3)) return null;
  const items = [];
  for (const item of data.items) {
    const text = x => x === null || (typeof x === 'string' && x.length <= 1000);
    if (!item || !text(item.productName) || !text(item.sellerName) || item.startDate !== date
      || !(item.endDate === null || (typeof item.endDate === 'string'
        && /^\d{4}-\d{2}-\d{2}$/.test(item.endDate) && item.endDate >= date))) return null;
    items.push({ productName: item.productName, sellerName: item.sellerName,
      startDate: item.startDate, endDate: item.endDate });
  }
  return { date, timezone: 'Asia/Seoul', count: data.count, items };
}
export async function handleTodayCalendar(request, env, deps = {}) {
  const clock = deps.now ?? Date.now;
  const fetcher = deps.fetch ?? fetch;
  const storage = deps.cache ?? cache;
  const headers = { 'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store',
    'Vercel-CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer' };
  const error = (status, code) => Response.json({ error: { code, message: 'Calendar unavailable' } }, { status, headers });
  if (request.method !== 'GET') return error(405, 'METHOD_NOT_ALLOWED');
  if (new URL(request.url).search) return error(400, 'INVALID_QUERY');
  if (request.headers.has('authorization') || request.headers.has('apikey'))
    return error(400, 'CREDENTIALS_NOT_ALLOWED');
  const config = configuration(env);
  if (!config) return error(503, 'CALENDAR_DISABLED');
  const date = kstDate(clock());
  const cacheKey = `${config.mode}:${config.origin}:${date}`;
  const saved = storage.get(cacheKey);
  if (saved && saved.expires > clock()) return Response.json(saved.data, { headers });
  // Per-instance cache reduces DB reads but is NOT a distributed rate limiter.
  // No CDN stale responses, so yesterday's payload cannot survive KST midnight.
  storage.clear();
  try {
    const upstream = await fetcher(new Request(`${config.origin}/rest/v1/rpc/get_today_group_buy_calendar`, {
      headers: { apikey: config.key, Accept: 'application/json' },
      signal: AbortSignal.timeout(5000), redirect: 'error',
    }));
    if (!upstream.ok) return error(502, 'UPSTREAM_UNAVAILABLE');
    const data = project(await upstream.json(), date);
    if (!data || kstDate(clock()) !== date) return error(502, 'INVALID_CALENDAR');
    const midnight = Date.parse(`${date}T00:00:00+09:00`) + 86400000;
    storage.set(cacheKey, { data, expires: Math.min(clock() + 60000, midnight) });
    return Response.json(data, { headers });
  } catch { return error(502, 'UPSTREAM_UNAVAILABLE'); }
}
