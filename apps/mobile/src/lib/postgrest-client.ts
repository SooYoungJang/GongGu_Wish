/**
 * PostgREST Client — Supabase REST API wrapper.
 *
 * Handles:
 *  - Base URL construction (SUPABASE_URL + /rest/v1)
 *  - apikey header (publishable anon key)
 *  - Auth JWT → Authorization: Bearer
 *  - Range / Content-Range pagination
 *  - PostgREST error codes → app ApiError
 *  - snake_case → camelCase response mapping
 */
import { ApiError, type PaginationMeta, type PaginationParams } from './api-types';
import { DEFAULT_SUPABASE_URL, resolveSupabaseUrl } from './supabase-config';

import { mapPostgrestToApp } from '../utils/postgrest-mapper';

// ─── Configuration ───────────────────────────────────────────────────────────

const REST_VERSION = '/rest/v1/';
let _supabaseUrl = DEFAULT_SUPABASE_URL;
export let API_BASE_URL = `${_supabaseUrl}${REST_VERSION}`;

// The anon key is configured at module init.
// In a real build, this is set via EXPO_PUBLIC_SUPABASE_ANON_KEY or a config module.
let _anonKey: string = '';

/**
 * Configure the PostgREST client with the Supabase anon key.
 * Must be called before any API requests.
 */
export function configurePostgrest(anonKey: string, supabaseUrl?: string): void {
  _anonKey = anonKey;
  _supabaseUrl = resolveSupabaseUrl(supabaseUrl);
  API_BASE_URL = `${_supabaseUrl}${REST_VERSION}`;
}

export function getAnonKey(): string {
  return _anonKey;
}

function buildUrl(path: string): string {
  const url = new URL(path, API_BASE_URL);
  // ponytail: React Native fetch is stricter than curl; encode PostgREST query selectors at the boundary.
  return url.toString();
}

function safeKeyInfo(key: string) {
  return { exists: key.length > 0, length: key.length, prefix: key.slice(0, 8) };
}

// ─── Pagination Helpers ──────────────────────────────────────────────────────

/**
 * Convert app-style pagination (1-indexed page, limit) to PostgREST Range header.
 */
export function appPageToRange(page: number, limit: number): string {
  const start = (page - 1) * limit;
  const end = start + limit - 1;
  return `${start}-${end}`;
}

/**
 * Parse a PostgREST Content-Range header into app PaginationMeta.
 *
 * Format: "items 0-19/100" or "items 0-19/*"
 */
export function parseContentRange(
  contentRange: string | null,
  requestedPage: number,
  requestedLimit: number,
): PaginationMeta {
  if (!contentRange) {
    return { total: 0, page: 1, limit: requestedLimit, totalPages: 0 };
  }
  const match = contentRange.match(/items\s+\d+-\d+\/(\d+|\*)/);
  if (!match || match[1] === '*') {
    return { total: 0, page: requestedPage, limit: requestedLimit, totalPages: 0 };
  }
  const total = parseInt(match[1], 10);
  return {
    total,
    page: requestedPage,
    limit: requestedLimit,
    totalPages: Math.ceil(total / requestedLimit),
  };
}

// ─── Auth Token ──────────────────────────────────────────────────────────────

/**
 * Get the auth token from secure storage.
 * Delegates to auth utility to avoid circular imports.
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const { getAuthToken } = await import('../utils/auth');
    return getAuthToken();
  } catch {
    return null; // ponytail: dynamic import fails on some Expo Go devices; apikey alone suffices for public reads
  }
}

// ─── Header Builder ──────────────────────────────────────────────────────────

interface PostgrestHeaders {
  range?: string;
  prefer?: string;
  contentType?: string;
}

async function buildHeaders(opts?: PostgrestHeaders): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': opts?.contentType ?? 'application/json',
    apikey: _anonKey,
  };

  const token = await getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (opts?.range) {
    headers['Range'] = opts.range;
  }
  if (opts?.prefer) {
    headers['Prefer'] = opts.prefer;
  }

  return headers;
}

// ─── Error Handling ──────────────────────────────────────────────────────────

/**
 * Mapping of PostgREST error codes to user-friendly messages.
 */
const POSTGREST_ERROR_MAP: Record<string, { message: string; status: number }> = {
  PGRST116: { message: '조회 결과가 없습니다.', status: 200 }, // 0 rows — not really an error
  PGRST200: { message: '로그인이 만료되었습니다. 다시 로그인해주세요.', status: 401 },
  PGRST201: { message: '인증 정보가 유효하지 않습니다.', status: 401 },
  PGRST301: { message: '권한이 없습니다.', status: 403 },
  PGRST302: { message: '접근 권한이 없습니다.', status: 403 },
  '42501': { message: '권한이 없습니다.', status: 403 },
};

interface PostgrestErrorBody {
  code?: string;
  error?: string;
  message?: string;
  errors?: { field: string; message: string; code: string }[];
  details?: string | null;
  hint?: string | null;
}

function handlePostgrestError(status: number, body: PostgrestErrorBody): never {
  const pgCode = body?.code ?? '';
  const mapped = POSTGREST_ERROR_MAP[pgCode];

  if (mapped) {
    throw new ApiError(mapped.status, mapped.message);
  }

  // PGRST116 with actual empty results — return empty body
  if (pgCode === 'PGRST116') {
    throw new ApiError(200, body.message || '');
  }

  // Generic error
  const displayMessage = body?.message || `API 오류 (${status})`;
  throw new ApiError(status, displayMessage);
}

function parseApiErrorBody(status: number, text: string): ApiError {
  if (text) {
    try {
      const body = JSON.parse(text) as PostgrestErrorBody;
      const message = body.error || body.message || `Edge Function error: ${status}`;
      return new ApiError(status, message, body.errors);
    } catch {
      return new ApiError(status, text);
    }
  }

  return new ApiError(status, `Edge Function error: ${status}`);
}

// ─── Public Request Methods ──────────────────────────────────────────────────

export interface PostgrestResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

/**
 * Low-level PostgREST query.
 * Returns raw (unmapped) data + optional pagination meta.
 */
export async function postgrestFetch<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    pagination?: PaginationParams;
    prefer?: string;
    headers?: Record<string, string>;
    signal?: AbortSignal;
  } = {},
): Promise<PostgrestResponse<T>> {
  const { method = 'GET', pagination, prefer, body, signal } = options;

  let range: string | undefined;
  if (pagination) {
    range = appPageToRange(pagination.page, pagination.limit);
  }

  const headers = await buildHeaders({
    range,
    prefer: prefer ?? (pagination ? 'count=exact' : undefined),
  });

  const requestUrl = buildUrl(path);
  const requestHeaders = { ...headers, ...options.headers };

  console.log('[PostgREST] request', {
    url: requestUrl,
    method,
    apikey: safeKeyInfo(requestHeaders.apikey ?? ''),
    hasAuthorization: Boolean(requestHeaders.Authorization),
  });

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    console.log('[PostgREST] fetch failed', {
      url: requestUrl,
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      cause: error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined,
    });
    throw error;
  }

  // Parse pagination meta from Content-Range
  let meta: PaginationMeta | undefined;
  const contentRange = response.headers.get('content-range');
  if (contentRange && pagination) {
    meta = parseContentRange(contentRange, pagination.page, pagination.limit);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return { data: undefined as unknown as T, meta };
  }

  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    handlePostgrestError(response.status, responseBody as PostgrestErrorBody);
  }

  return { data: responseBody as T, meta };
}

/**
 * PostgREST GET — returns data mapped to camelCase.
 */
export async function postgrestGet<T>(
  path: string,
  options: {
    pagination?: PaginationParams;
    prefer?: string;
    signal?: AbortSignal;
  } = {},
): Promise<PostgrestResponse<T>> {
  const { data, meta } = await postgrestFetch<T>(path, { ...options, method: 'GET' });
  const mapped = mapPostgrestToApp<T>(data);
  return { data: mapped, meta };
}

/**
 * PostgREST POST — create a row (INSERT).
 */
export async function postgrestPost<T>(
  path: string,
  body: unknown,
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  const { data } = await postgrestFetch<T>(path, {
    method: 'POST',
    body,
    prefer: 'return=representation',
    signal: options.signal,
  });
  return mapPostgrestToApp<T>(data);
}

/**
 * PostgREST PATCH — update rows (UPDATE).
 */
export async function postgrestPatch<T>(
  path: string,
  body: unknown,
  options: { signal?: AbortSignal; prefer?: string } = {},
): Promise<T> {
  const { data } = await postgrestFetch<T>(path, {
    method: 'PATCH',
    body,
    prefer: options.prefer ?? 'return=representation',
    signal: options.signal,
  });
  return mapPostgrestToApp<T>(data);
}

/**
 * PostgREST DELETE — delete rows.
 */
export async function postgrestDelete<T = void>(
  path: string,
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  const { data } = await postgrestFetch<T>(path, {
    method: 'DELETE',
    signal: options.signal,
  });
  return data;
}

/**
 * Edge Function call — POST to /functions/v1/{name}.
 */
export async function callEdgeFunction<T>(
  functionName: string,
  body: unknown,
  options: { method?: string; signal?: AbortSignal; authToken?: string | null } = {},
): Promise<T> {
  const url = `${_supabaseUrl}/functions/v1/${functionName}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: _anonKey,
  };

  const token = options.authToken ?? await getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: options.method ?? 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: options.signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw parseApiErrorBody(response.status, errorText);
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}
