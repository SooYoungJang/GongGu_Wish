const MAX_BODY_BYTES = 1024 * 1024;
const PREVIEW_APP_LINK_HOST = "api-preview.gongguwish.com";
const PREVIEW_ANDROID_APP_LINKS = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "com.gonggu.wish.preview",
      sha256_cert_fingerprints: [
        "49:83:0D:45:2F:80:FC:9B:AF:6E:09:01:39:6B:CD:23:1E:DE:F2:26:1E:DC:49:D8:8D:D3:8C:9D:5A:60:DA:57",
      ],
    },
  },
];

const REST_RULES = new Map([
  ["group_buys", new Set(["GET"])],
  ["influencers", new Set(["GET"])],
  ["search_logs", new Set(["POST"])],
  ["group_buy_views", new Set(["POST"])],
  ["group_buy_bookmarks", new Set(["POST", "DELETE"])],
  ["group_buy_notifications", new Set(["POST", "DELETE"])],
  ["rpc/get_popular_search_terms", new Set(["POST"])],
  ["rpc/get_popular_group_buys", new Set(["POST"])],
  ["rpc/get_group_buy_request_rankings", new Set(["POST"])],
  ["rpc/list_comment_roots", new Set(["POST"])],
  ["rpc/list_comment_children", new Set(["POST"])],
  ["rpc/create_comment", new Set(["POST"])],
  ["rpc/report_comment", new Set(["POST"])],
  ["rpc/block_user_from_comment", new Set(["POST"])],
  ["rpc/accept_comment_terms", new Set(["POST"])],
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

function resolveDeploymentIdentity(env) {
  const environment = String(env.APP_ENV ?? "");
  const commitSha = String(env.CF_VERSION_METADATA?.tag ?? "");
  const supabaseOrigin = resolveUpstreamOrigin(env.SUPABASE_ORIGIN);
  const expectedOrigins = {
    preview: "https://xwblovggtvbpiusjfokq.supabase.co",
    production: "https://iosdoheblabfimkjnvfj.supabase.co",
  };
  if (
    expectedOrigins[environment] !== supabaseOrigin ||
    !/^[0-9a-f]{40}$/.test(commitSha)
  ) {
    throw new Error("Invalid deployment identity");
  }
  return {
    environment,
    commitSha,
    supabaseOrigin,
    supabaseProjectRef: new URL(supabaseOrigin).hostname.split(".")[0],
  };
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
  let identity;
  try {
    identity = resolveDeploymentIdentity(env);
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
  const body =
    request.method === "HEAD"
      ? null
      : JSON.stringify({
          status: "ok",
          environment: identity.environment,
          commitSha: identity.commitSha,
          supabaseProjectRef: identity.supabaseProjectRef,
        });
  return withRequestId(new Response(body, { status: 200, headers }), requestId);
}

function previewAppLinkResponse(request, env, url, requestId) {
  if (env.APP_ENV !== "preview" || url.hostname !== PREVIEW_APP_LINK_HOST) {
    return null;
  }
  if (url.username || url.password || url.port || url.search || url.hash) {
    return null;
  }
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  if (url.pathname === "/.well-known/assetlinks.json") {
    const headers = securityHeaders();
    headers.set("Cache-Control", "public, max-age=300");
    headers.set("Content-Type", "application/json; charset=utf-8");
    return withRequestId(
      new Response(
        request.method === "HEAD"
          ? null
          : JSON.stringify(PREVIEW_ANDROID_APP_LINKS),
        { status: 200, headers },
      ),
      requestId,
    );
  }

  const match = url.pathname.match(/^\/group-buy\/([^/]+)$/);
  if (!match) return null;
  let groupBuyId;
  try {
    groupBuyId = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  if (
    !groupBuyId ||
    groupBuyId.length > 128 ||
    /[\\/\u0000-\u001f\u007f]/.test(groupBuyId)
  ) {
    return null;
  }

  const headers = securityHeaders();
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
  );
  const appUrl = `gongguwish-preview://group-buy/${encodeURIComponent(groupBuyId)}`;
  const body =
    request.method === "HEAD"
      ? null
      : `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>공구위시 Preview</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #fff4ea; color: #4b2e25; font-family: system-ui, sans-serif; }
      main { padding: 32px; text-align: center; }
      a { display: inline-block; margin-top: 16px; padding: 14px 22px; border-radius: 999px; background: #f0445e; color: white; font-weight: 700; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>
      <h1>공구위시 Preview</h1>
      <p>앱이 자동으로 열리지 않았다면 아래 버튼을 눌러주세요.</p>
      <a href="${appUrl}">앱에서 공구 보기</a>
    </main>
  </body>
</html>`;
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

  let identity;
  try {
    identity = resolveDeploymentIdentity(env);
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

  const upstreamUrl = `${identity.supabaseOrigin}${url.pathname}${url.search}`;
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
  const appLinkResponse = previewAppLinkResponse(request, env, url, requestId);
  if (appLinkResponse) return appLinkResponse;
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
