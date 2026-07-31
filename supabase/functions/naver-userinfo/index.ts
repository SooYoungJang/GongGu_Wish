import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const NAVER_USERINFO_URL = 'https://openapi.naver.com/v1/nid/me';
const UPSTREAM_TIMEOUT_MS = 5_000;

type JsonRecord = Record<string, unknown>;

export interface NormalizedNaverUserInfo {
  sub: string;
  name?: string;
  nickname?: string;
  preferred_username?: string;
  picture?: string;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown, maxLength = 255): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return null;
  if (/[\u0000-\u001f\u007f]/u.test(normalized)) return null;
  return normalized;
}

function normalizeHttpsUrl(value: unknown): string | null {
  const candidate = normalizeText(value, 2_048);
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeNaverUserInfo(
  value: unknown,
): NormalizedNaverUserInfo | null {
  if (!isRecord(value) || value.resultcode !== '00') return null;
  if (!isRecord(value.response)) return null;

  const sub = normalizeText(value.response.id);
  if (!sub) return null;

  const nickname = normalizeText(value.response.nickname);
  const name = normalizeText(value.response.name) ?? nickname;
  const picture = normalizeHttpsUrl(value.response.profile_image);
  const claims: NormalizedNaverUserInfo = { sub };

  if (name) claims.name = name;
  if (nickname) {
    claims.nickname = nickname;
    claims.preferred_username = nickname;
  }
  if (picture) claims.picture = picture;

  // Naver does not provide an email_verified claim. Omitting email prevents
  // Supabase from linking identities based on an unverified optional field.
  return claims;
}

export function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+([^\s]+)$/iu.exec(header.trim());
  const token = match?.[1] ?? '';
  return token.length > 0 && token.length <= 8_192 ? token : null;
}

function json(body: unknown, status: number, extraHeaders?: HeadersInit) {
  const headers = new Headers(extraHeaders);
  headers.set('cache-control', 'no-store');
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('vary', 'Authorization');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(JSON.stringify(body), { status, headers });
}

export function createHandler(fetchImpl: typeof fetch = fetch) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET') {
      return json({ error: 'Method Not Allowed' }, 405, { allow: 'GET' });
    }

    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) return json({ error: 'Unauthorized' }, 401);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    try {
      const upstream = await fetchImpl(NAVER_USERINFO_URL, {
        method: 'GET',
        redirect: 'error',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      if (upstream.status === 401 || upstream.status === 403) {
        return json({ error: 'Unauthorized' }, 401);
      }
      if (upstream.status === 429) {
        return json({ error: 'Too Many Requests' }, 429);
      }
      if (!upstream.ok) return json({ error: 'Bad Gateway' }, 502);

      const claims = normalizeNaverUserInfo(await upstream.json());
      if (!claims) return json({ error: 'Bad Gateway' }, 502);

      return json(claims, 200);
    } catch {
      return json({ error: 'Bad Gateway' }, 502);
    } finally {
      clearTimeout(timeout);
    }
  };
}

if (import.meta.main) {
  serve(createHandler());
}
