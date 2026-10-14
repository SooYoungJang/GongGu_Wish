const PATH = '/public/v1/group-buys/today';
const KST_OFFSET = 9 * 60 * 60 * 1000;

export function kstDay(now = Date.now()) {
  return new Date(now + KST_OFFSET).toISOString().slice(0, 10);
}

export function isPublicReadKey(key) {
  if (typeof key !== 'string') return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  try {
    const parts = key.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.role === 'anon';
  } catch { return false; }
}

function validPayload(data, date) {
  const dateOrNull = value => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value);
  const textOrNull = value => value === null || (typeof value === 'string' && value.length <= 1000);
  return data && data.date === date && data.timezone === 'Asia/Seoul'
    && Number.isSafeInteger(data.count) && data.count >= 0
    && Array.isArray(data.items) && data.items.length <= 3
    && data.items.length === Math.min(data.count, 3)
    && data.items.every(item => item && textOrNull(item.productName)
      && textOrNull(item.sellerName) && item.startDate === date
      && dateOrNull(item.endDate) && (!item.endDate || item.endDate >= date));
}

export async function todayCalendar(request, env, requestId, helpers, ctx) {
  const url = new URL(request.url);
  if (url.pathname !== PATH) return null;
  const error = (status, code, message, headers) => helpers.errorResponse(
    request, env, requestId, status, code, message, headers);
  if (request.method !== 'GET')
    return error(405, 'METHOD_NOT_ALLOWED', 'Method not allowed', { Allow: 'GET' });
  if (url.search) return error(400, 'INVALID_QUERY', 'Query parameters are not supported');
  if (request.headers.has('Authorization') || request.headers.has('apikey'))
    return error(400, 'CREDENTIALS_NOT_ALLOWED', 'This public route does not accept credentials');
  const origin = request.headers.get('Origin');
  if (origin && !helpers.configuredOrigins(env).has(origin))
    return error(403, 'ORIGIN_NOT_ALLOWED', 'Origin not allowed');
  let upstreamOrigin;
  try { upstreamOrigin = helpers.resolveDeploymentIdentity(env).supabaseOrigin; }
  catch { return error(503, 'CALENDAR_UNAVAILABLE', 'Calendar unavailable'); }
  if (!isPublicReadKey(env.TODAY_CALENDAR_ANON_KEY) || !env.TODAY_CALENDAR_RATE_LIMITER)
    return error(503, 'CALENDAR_UNAVAILABLE', 'Calendar unavailable');
  try {
    const { success } = await env.TODAY_CALENDAR_RATE_LIMITER.limit({ key: 'today-calendar' });
    if (!success) return error(429, 'RATE_LIMITED', 'Try again later', { 'Retry-After': '60' });
  } catch { return error(503, 'CALENDAR_UNAVAILABLE', 'Calendar unavailable'); }

  const now = Date.now();
  const date = kstDay(now);
  // Date-keyed cache prevents yesterday's payload crossing KST midnight.
  // Cache API is local to a Cloudflare location. Never cache errors or credentials.
  const cacheKey = new Request(`${url.origin}${PATH}?kst-day=${date}`);
  const cache = globalThis.caches?.default;
  try {
    const cached = await cache?.match(cacheKey);
    if (cached) {
      const data = await cached.json();
      if (validPayload(data, date) && kstDay() === date) return response(data);
    }
    const upstream = await fetch(new Request(
      `${upstreamOrigin}/rest/v1/rpc/get_today_group_buy_calendar`, {
        headers: { apikey: env.TODAY_CALENDAR_ANON_KEY, Accept: 'application/json' },
        signal: AbortSignal.timeout(5000), redirect: 'error',
      }));
    if (!upstream.ok) return error(502, 'CALENDAR_UNAVAILABLE', 'Calendar unavailable');
    const data = await upstream.json();
    // A midnight race returns a retriable error, never stale/incorrect date data.
    if (!validPayload(data, date) || kstDay() !== date)
      return error(502, 'CALENDAR_UNAVAILABLE', 'Calendar unavailable');
    const result = response(data);
    if (cache && ctx?.waitUntil)
      ctx.waitUntil(cache.put(cacheKey, result.clone()).catch(() => {}));
    return result;
  } catch { return error(502, 'CALENDAR_UNAVAILABLE', 'Calendar unavailable'); }

  function response(data) {
    // Explicit output whitelist, including on a cache hit.
    const body = { date: data.date, timezone: 'Asia/Seoul', count: data.count,
      items: data.items.map(item => ({ productName: item.productName,
        sellerName: item.sellerName, startDate: item.startDate, endDate: item.endDate })) };
    const headers = helpers.applyCors(helpers.securityHeaders(), request, env);
    const nextMidnight = Date.parse(`${date}T00:00:00+09:00`) + 86400000;
    const ttl = Math.min(60, Math.max(0, Math.floor((nextMidnight - Date.now()) / 1000)));
    headers.set('Cache-Control', ttl > 0 ? `public, max-age=${ttl}, must-revalidate` : 'no-store');
    return helpers.withRequestId(Response.json(body, { headers }), requestId);
  }
}
