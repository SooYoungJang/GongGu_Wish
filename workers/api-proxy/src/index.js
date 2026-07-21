const MAX_BODY_BYTES = 1024 * 1024;

const REST_RULES = new Map([
  ["group_buys", new Set(["GET"])],
  ["influencers", new Set(["GET"])],
  ["search_logs", new Set(["POST"])],
  ["group_buy_views", new Set(["POST"])],
  ["group_buy_bookmarks", new Set(["POST", "DELETE"])],
  ["group_buy_notifications", new Set(["POST", "DELETE"])],
  ["rpc/get_popular_search_terms", new Set(["POST"])],
  ["rpc/get_popular_group_buys", new Set(["POST"])],
]);

const FUNCTION_RULES = new Map([
  ["seller-rankings", new Set(["POST"])],
  ["hiker-lookup", new Set(["POST"])],
  ["refresh-instagram-media", new Set(["POST"])],
  ["delete-account", new Set(["POST"])],
  ["admin-api", new Set(["POST"])],
  ["public-submission", new Set(["POST"])],
  ["register-push-token", new Set(["POST"])],
]);

const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "accept-profile",
  "apikey",
  "authorization",
  "content-profile",
  "content-type",
  "prefer",
  "range",
  "x-client-info",
];

function securityHeaders(headers = new Headers()) {
  headers.set("Cache-Control", "no-store");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  return headers;
}

function configuredOrigins(env) {
  return new Set(
    String(env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function applyCors(headers, request, env) {
  const origin = request.headers.get("Origin");
  if (origin && configuredOrigins(env).has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return headers;
}

function jsonError(request, env, status, code, message, extraHeaders = {}) {
  const headers = applyCors(
    securityHeaders(new Headers(extraHeaders)),
    request,
    env,
  );
  headers.set("Content-Type", "application/json; charset=utf-8");
  return Response.json({ error: { code, message } }, { status, headers });
}

function decodedPathParts(pathname, prefix) {
  const raw = pathname.slice(prefix.length).replace(/\/$/, "");
  if (!raw) return null;

  try {
    const parts = raw.split("/").map(decodeURIComponent);
    return parts.every((part) => /^[a-z0-9_-]+$/.test(part)) ? parts : null;
  } catch {
    return null;
  }
}

function matchRoute(pathname) {
  if (pathname.startsWith("/rest/v1/")) {
    const parts = decodedPathParts(pathname, "/rest/v1/");
    if (!parts) return null;
    const methods = REST_RULES.get(parts.join("/"));
    return methods ? { kind: "rest", methods } : null;
  }

  if (pathname.startsWith("/functions/v1/")) {
    const parts = decodedPathParts(pathname, "/functions/v1/");
    if (!parts || parts.length !== 1) return null;
    const methods = FUNCTION_RULES.get(parts[0]);
    return methods ? { kind: "function", methods } : null;
  }

  return null;
}

function resolveUpstreamOrigin(rawOrigin) {
  const url = new URL(String(rawOrigin ?? ""));
  if (
    url.protocol !== "https:" ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("Invalid upstream origin");
  }
  return url.origin;
}

function forwardedHeaders(request, requestId) {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  headers.set("X-Request-ID", requestId);
  return headers;
}

function withRequestId(response, requestId) {
  response.headers.set("X-Request-ID", requestId);
  return response;
}

async function requestBody(request) {
  if (request.method === "GET" || request.method === "HEAD") return undefined;

  const declaredLength = Number(request.headers.get("Content-Length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES)
    return null;
  if (!request.body) return undefined;

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function errorResponse(
  request,
  env,
  requestId,
  status,
  code,
  message,
  extraHeaders,
) {
  return withRequestId(
    jsonError(request, env, status, code, message, extraHeaders),
    requestId,
  );
}

function healthResponse(request, env, requestId) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return errorResponse(
      request,
      env,
      requestId,
      405,
      "METHOD_NOT_ALLOWED",
      "Method not allowed",
      {
        Allow: "GET, HEAD",
      },
    );
  }

  const headers = applyCors(securityHeaders(), request, env);
  headers.set("Content-Type", "application/json; charset=utf-8");
  const environment = String(env.APP_ENV ?? "");
  const commitSha = String(env.CF_VERSION_METADATA?.tag ?? "");
  let supabaseOrigin;
  try {
    supabaseOrigin = resolveUpstreamOrigin(env.SUPABASE_ORIGIN);
  } catch {
    return errorResponse(
      request,
      env,
      requestId,
      500,
      "INVALID_DEPLOYMENT_IDENTITY",
      "Invalid deployment identity",
    );
  }
  const expectedOrigins = {
    preview: "https://xwblovggtvbpiusjfokq.supabase.co",
    production: "https://iosdoheblabfimkjnvfj.supabase.co",
  };
  if (
    expectedOrigins[environment] !== supabaseOrigin ||
    !/^[0-9a-f]{40}$/.test(commitSha)
  ) {
    return errorResponse(
      request,
      env,
      requestId,
      500,
      "INVALID_DEPLOYMENT_IDENTITY",
      "Invalid deployment identity",
    );
  }
  const supabaseProjectRef = new URL(supabaseOrigin).hostname.split(".")[0];
  const body =
    request.method === "HEAD"
      ? null
      : JSON.stringify({
          status: "ok",
          environment,
          commitSha,
          supabaseProjectRef,
        });
  return withRequestId(new Response(body, { status: 200, headers }), requestId);
}

function preflightResponse(request, env, requestId, methods) {
  const headers = applyCors(securityHeaders(), request, env);
  headers.set(
    "Access-Control-Allow-Headers",
    "apikey, authorization, content-type, prefer, range",
  );
  headers.set("Access-Control-Allow-Methods", [...methods].join(", "));
  headers.set("Access-Control-Max-Age", "86400");
  return withRequestId(new Response(null, { status: 204, headers }), requestId);
}

async function proxyRequest(request, env, url, requestId) {
  const body = await requestBody(request);
  if (body === null) {
    return errorResponse(
      request,
      env,
      requestId,
      413,
      "PAYLOAD_TOO_LARGE",
      "Payload too large",
    );
  }

  let upstreamOrigin;
  try {
    upstreamOrigin = resolveUpstreamOrigin(env.SUPABASE_ORIGIN);
  } catch {
    return errorResponse(
      request,
      env,
      requestId,
      500,
      "PROXY_MISCONFIGURED",
      "Proxy is not configured",
    );
  }

  const upstreamUrl = `${upstreamOrigin}${url.pathname}${url.search}`;
  const upstreamRequest = new Request(upstreamUrl, {
    method: request.method,
    headers: forwardedHeaders(request, requestId),
    body,
    redirect: "manual",
  });

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(upstreamRequest);
  } catch {
    console.error(
      JSON.stringify({
        event: "upstream_unavailable",
        requestId,
        method: request.method,
        route: url.pathname,
      }),
    );
    return errorResponse(
      request,
      env,
      requestId,
      502,
      "UPSTREAM_UNAVAILABLE",
      "Upstream service unavailable",
    );
  }

  const responseHeaders = new Headers(upstreamResponse.headers);
  responseHeaders.delete("Set-Cookie");
  responseHeaders.delete("Server");
  applyCors(securityHeaders(responseHeaders), request, env);
  console.log(
    JSON.stringify({
      event: "proxy_request_completed",
      requestId,
      method: request.method,
      route: url.pathname,
      status: upstreamResponse.status,
    }),
  );

  return withRequestId(
    new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    }),
    requestId,
  );
}

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  const requestId = request.headers.get("CF-Ray") ?? crypto.randomUUID();
  if (url.pathname === "/health")
    return healthResponse(request, env, requestId);

  const route = matchRoute(url.pathname);
  if (!route) {
    return errorResponse(
      request,
      env,
      requestId,
      404,
      "ROUTE_NOT_FOUND",
      "Route not found",
    );
  }

  const origin = request.headers.get("Origin");
  if (origin && !configuredOrigins(env).has(origin)) {
    return errorResponse(
      request,
      env,
      requestId,
      403,
      "ORIGIN_NOT_ALLOWED",
      "Origin not allowed",
    );
  }

  if (request.method === "OPTIONS") {
    return preflightResponse(request, env, requestId, route.methods);
  }

  if (!route.methods.has(request.method)) {
    return errorResponse(
      request,
      env,
      requestId,
      405,
      "METHOD_NOT_ALLOWED",
      "Method not allowed",
      {
        Allow: [...route.methods].join(", "),
      },
    );
  }

  if (!request.headers.get("apikey")) {
    return errorResponse(
      request,
      env,
      requestId,
      401,
      "API_KEY_REQUIRED",
      "API key required",
    );
  }

  return proxyRequest(request, env, url, requestId);
}

export default {
  fetch: handleRequest,
};
