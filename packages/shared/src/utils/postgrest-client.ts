/**
 * PostgREST Client — Supabase REST API wrapper for shared package.
 *
 * This client is designed for use by the admin web app and any other consumer
 * of @gonggu/shared. It provides:
 *  - PostgREST GET/POST/PATCH/DELETE
 *  - Range/Content-Range pagination
 *  - Error handling
 *
 * The client can be configured at runtime via configurePostgrest().
 */

// ─── Configuration ───────────────────────────────────────────────────────────

const REST_VERSION = '/rest/v1';

let _supabaseUrl: string | undefined;
let _anonKey = '';

export function configurePostgrest(url: string, anonKey: string): void {
  const configuredUrl = url.trim().replace(/\/+$/, '');
  if (!configuredUrl) {
    throw new Error('Supabase origin must be configured');
  }

  _supabaseUrl = configuredUrl;
  _anonKey = anonKey;
}

export function getPostgrestUrl(): string {
  if (!_supabaseUrl) {
    throw new Error('Supabase origin must be configured');
  }
  return `${_supabaseUrl}${REST_VERSION}`;
}

// ─── Pagination Types ────────────────────────────────────────────────────────

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Convert app pagination (1-indexed) to PostgREST Range header.
 */
export function appPageToRange(page: number, limit: number): string {
  const start = (page - 1) * limit;
  const end = start + limit - 1;
  return `items=${start}-${end}`;
}

/**
 * Parse Content-Range header to PaginationMeta.
 */
export function parseContentRange(
  contentRange: string | null,
  page: number,
  limit: number,
): PaginationMeta {
  if (!contentRange) return { total: 0, page: 1, limit, totalPages: 0 };
  const match = contentRange.match(/items\s+\d+-\d+\/(\d+|\*)/);
  if (!match || match[1] === '*') {
    return { total: 0, page, limit, totalPages: 0 };
  }
  const total = parseInt(match[1], 10);
  return { total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─── Request Helpers ─────────────────────────────────────────────────────────

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (_anonKey) {
    headers['apikey'] = _anonKey;
  }
  return headers;
}

interface PostgrestErrorBody {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

export class PostgrestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'PostgrestError';
  }
}

function handleError(status: number, body: PostgrestErrorBody): never {
  const pgCode = body?.code ?? '';
  const messageMap: Record<string, string> = {
    PGRST116: '조회 결과가 없습니다.',
    PGRST200: '로그인이 만료되었습니다.',
    PGRST201: '인증 정보가 유효하지 않습니다.',
    PGRST301: '권한이 없습니다.',
    PGRST302: '접근 권한이 없습니다.',
    '42501': '권한이 없습니다.',
  };
  throw new PostgrestError(
    status,
    messageMap[pgCode] || body?.message || `API 오류 (${status})`,
    pgCode,
  );
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface PostgrestResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

/**
 * Low-level PostgREST request.
 */
export async function postgrestFetch<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    pagination?: { page: number; limit: number };
    headers?: Record<string, string>;
  } = {},
): Promise<PostgrestResponse<T>> {
  const { method = 'GET', pagination, body } = options;
  const baseUrl = getPostgrestUrl();
  const headers = buildHeaders();

  let range: string | undefined;
  if (pagination) {
    range = appPageToRange(pagination.page, pagination.limit);
    headers['Range'] = range;
    headers['Prefer'] = 'count=exact';
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...headers, ...options.headers },
    body: body ? JSON.stringify(body) : undefined,
  });

  let meta: PaginationMeta | undefined;
  const contentRange = response.headers.get('content-range');
  if (contentRange && pagination) {
    meta = parseContentRange(contentRange, pagination.page, pagination.limit);
  }

  if (response.status === 204) {
    return { data: undefined as unknown as T, meta };
  }

  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    handleError(response.status, responseBody as PostgrestErrorBody);
  }

  return { data: responseBody as T, meta };
}

/**
 * PostgREST GET.
 */
export async function postgrestGet<T>(
  path: string,
  options: { pagination?: { page: number; limit: number } } = {},
): Promise<PostgrestResponse<T>> {
  return postgrestFetch<T>(path, { ...options, method: 'GET' });
}

/**
 * PostgREST POST (INSERT).
 */
export async function postgrestPost<T>(
  path: string,
  body: unknown,
): Promise<T> {
  const { data } = await postgrestFetch<T>(path, {
    method: 'POST',
    body,
    headers: { Prefer: 'return=representation' },
  });
  return data;
}

/**
 * PostgREST PATCH (UPDATE).
 */
export async function postgrestPatch<T>(
  path: string,
  body: unknown,
): Promise<T> {
  const { data } = await postgrestFetch<T>(path, {
    method: 'PATCH',
    body,
    headers: { Prefer: 'return=representation' },
  });
  return data;
}

/**
 * PostgREST DELETE.
 */
export async function postgrestDelete<T = void>(path: string): Promise<T> {
  const { data } = await postgrestFetch<T>(path, { method: 'DELETE' });
  return data;
}
