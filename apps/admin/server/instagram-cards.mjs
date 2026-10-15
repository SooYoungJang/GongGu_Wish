import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { supportedGlyphs } from "./instagram-glyphs.mjs";
import { kstDate, publicKey } from "./today-calendar.mjs";
const assets = (name) => new URL(`./instagram-assets/${name}`, import.meta.url);
const projects = {
  production: "https://iosdoheblabfimkjnvfj.supabase.co",
  preview: "https://xwblovggtvbpiusjfokq.supabase.co",
};
const cache = new Map();
const pending = new Map();
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
const clean = (v, max) =>
  typeof v === "string" &&
  v.trim() &&
  v.length <= max &&
  !/[\u0000-\u001f\u007f]/.test(v);
export function cardConfiguration(env) {
  const mode = env.VERCEL_ENV;
  const origin = env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  const key = env.VITE_SUPABASE_ANON_KEY;
  // Separate opt-in: do not enable the existing disabled calendar feed as a side effect.
  // This flag is operator attestation, NOT a distributed rate limiter.
  if (
    env.INSTAGRAM_CARDS_ENABLED !== "true" ||
    !projects[mode] ||
    origin !== projects[mode] ||
    !publicKey(key)
  )
    return null;
  return { mode, origin, key };
}
export function selectOngoing(rows, now) {
  if (!Array.isArray(rows) || rows.length > 3) return null;
  const date = kstDate(now);
  const items = [];
  for (const r of rows) {
    const utc = (value) =>
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|\+00:00)?$/.test(
        value,
      )
        ? Date.parse(/Z$|\+00:00$/.test(value) ? value : `${value}Z`)
        : NaN;
    const start = utc(r.start_date),
      end = utc(r.end_date);
    if (
      r.status !== "APPROVED" ||
      (r.source_type === "MANUAL_DISCOVERY" &&
        r.collection_review_status !== "APPROVED") ||
      !clean(r.product_name, 180) ||
      !clean(r.instagram_username, 30) ||
      !/^[A-Za-z0-9_.]{1,30}$/.test(r.instagram_username) ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start > now ||
      kstDate(end) <= date
    )
      return null;
    if (
      ![...r.product_name].every((c) => supportedGlyphs.has(c.codePointAt(0)))
    )
      continue;
    items.push({
      productName: r.product_name.trim(),
      sellerName: r.instagram_username,
      startDate: kstDate(start),
      endDate: kstDate(end),
    });
  }
  return { date, items };
}
export async function renderOngoing(data) {
  const [{ Resvg }, { default: sharp }] = await Promise.all([
    import("@resvg/resvg-js"),
    import("sharp"),
  ]);
  const icon = (await readFile(assets("icon.png"))).toString("base64");
  const text = (x, y, s, size = 36, bold = false, color = "white") =>
    `<text x="${x}" y="${y}" font-family="Gonggu Korean" font-size="${size}" font-weight="${bold ? 700 : 400}" fill="${color}">${escape(s)}</text>`;
  const short = (s, n) =>
    Array.from(s).length > n
      ? Array.from(s)
          .slice(0, n - 1)
          .join("") + "…"
      : s;
  const md = (s) => s.slice(5).replace("-", ".");
  const rows = data.items
    .map((v, i) => {
      const y = 556 + i * 183;
      return (
        `<rect x="72" y="${y}" width="936" height="157" rx="24" fill="white"/>` +
        text(104, y + 64, short(v.productName, 22), 38, true, "#442145") +
        text(104, y + 123, "@" + v.sellerName, 29, false, "#74516F") +
        text(
          746,
          y + 123,
          `${md(v.startDate)} - ${md(v.endDate)}`,
          27,
          true,
          "#74516F",
        )
      );
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#ff8524"/><stop offset=".52" stop-color="#ff2d66"/><stop offset="1" stop-color="#6f21ce"/></linearGradient></defs><rect width="1080" height="1350" fill="url(#g)"/><image x="72" y="68" width="120" height="120" href="data:image/png;base64,${icon}"/>${text(218, 126, "공구위시", 42, true)}${text(218, 169, data.date.replaceAll("-", ".") + " · 앱 등록 일정 기준", 24)}${text(72, 320, "지금 진행 중인", 67, true)}${text(72, 418, "공구 모아보기", 67, true)}${text(76, 493, "오늘 오픈이 아닌, 진행 중인 공구예요", 31)}${rows}${text(76, 1161, "일정은 변경될 수 있어요. 구매 전 판매자 공지를 확인하세요.", 25)}<path d="M72 1210H1008" stroke="white" stroke-width="2"/>${text(72, 1280, "공구위시 · Google Play에서 만나요", 32, true)}</svg>`;
  const png = new Resvg(svg, {
    font: {
      fontFiles: [
        fileURLToPath(assets("GongguKorean-Regular.otf")),
        fileURLToPath(assets("GongguKorean-Bold.otf")),
      ],
      loadSystemFonts: false,
      defaultFontFamily: "Gonggu Korean",
    },
  })
    .render()
    .asPng();
  return sharp(png).toColourspace("srgb").jpeg({ quality: 90 }).toBuffer();
}
export async function handleInstagramCard(request, env, deps = {}) {
  const headers = {
    "Cache-Control": "no-store",
    "CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
  const error = (status, code) =>
    Response.json(
      { error: { code, message: "Card unavailable" } },
      { status, headers },
    );
  const url = new URL(request.url);
  if (!["GET", "HEAD"].includes(request.method))
    return error(405, "METHOD_NOT_ALLOWED");
  if (
    request.headers.has("authorization") ||
    request.headers.has("apikey") ||
    [...url.searchParams.keys()].some((k) => k !== "date") ||
    url.searchParams.getAll("date").length > 1
  )
    return error(400, "INVALID_REQUEST");
  const config = cardConfiguration(env);
  if (!config) return error(503, "CARDS_DISABLED");
  const now = deps.now ?? Date.now,
    clock = now(),
    date = kstDate(clock);
  const pathDate = /\/ongoing\/(\d{4}-\d{2}-\d{2})\.jpg$/.exec(
    url.pathname,
  )?.[1];
  const requestedDate = url.searchParams.get("date") ?? pathDate;
  if (!requestedDate && url.pathname.endsWith("/ongoing.jpg"))
    return new Response(null, {
      status: 307,
      headers: {
        ...headers,
        Location: `/public/v1/instagram/ongoing/${date}.jpg`,
      },
    });
  if (requestedDate !== date || (pathDate && pathDate !== requestedDate))
    return error(404, "DATE_NOT_CURRENT");
  const storage = deps.cache ?? cache,
    inflight = deps.pending ?? pending,
    key = `${config.mode}:${date}`;
  let saved = storage.get(key);
  if (!saved || saved.expires <= clock) {
    try {
      if (!inflight.has(key)) {
        const job = (async () => {
          // UTC-naive persisted timestamps, known future KST endings only.
          const tomorrow = new Date(
            Date.parse(`${date}T00:00:00+09:00`) + 86400000,
          )
            .toISOString()
            .replace("Z", "");
          const q = new URLSearchParams({
            select:
              "product_name,instagram_username,start_date,end_date,status,source_type,collection_review_status",
            status: "eq.APPROVED",
            or: "(source_type.neq.MANUAL_DISCOVERY,source_type.is.null,collection_review_status.eq.APPROVED)",
            start_date: `lte.${new Date(clock).toISOString().replace("Z", "")}`,
            end_date: `gte.${tomorrow}`,
            instagram_username: "not.is.null",
            order: "end_date.asc,product_name.asc,id.asc",
            limit: "3",
          });
          const response = await (deps.fetch ?? fetch)(
            `${config.origin}/rest/v1/group_buys?${q}`,
            {
              headers: { apikey: config.key, Accept: "application/json" },
              signal: AbortSignal.timeout(5000),
              redirect: "error",
            },
          );
          if (!response.ok) throw { status: 502, code: "UPSTREAM_UNAVAILABLE" };
          const data = selectOngoing(await response.json(), clock);
          if (!data || kstDate(now()) !== date)
            throw { status: 502, code: "INVALID_LISTINGS" };
          if (!data.items.length)
            throw { status: 404, code: "NO_ONGOING_LISTINGS" };
          const image = await (deps.render ?? renderOngoing)(data);
          if (kstDate(now()) !== date)
            throw { status: 502, code: "DATE_CHANGED" };
          if (image.length >= 8000000)
            throw { status: 502, code: "IMAGE_TOO_LARGE" };
          const midnight = Date.parse(`${date}T00:00:00+09:00`) + 86400000;
          const result = { image, expires: midnight };
          storage.clear();
          storage.set(key, result);
          return result;
        })();
        inflight.set(key, job);
      }
      saved = await inflight.get(key);
    } catch (e) {
      return error(e?.status ?? 502, e?.code ?? "UPSTREAM_UNAVAILABLE");
    } finally {
      inflight.delete(key);
    }
  }
  if (kstDate(now()) !== date) return error(502, "DATE_CHANGED");
  // Successful date-keyed snapshot lasts only until KST midnight.
  // Owner accepts intraday snapshot staleness. Errors/empty results stay no-store.
  // No stale-while-revalidate or stale-if-error; old date paths fail closed.
  const ttl = Math.max(0, Math.floor((saved.expires - now()) / 1000));
  return new Response(request.method === "HEAD" ? null : saved.image, {
    headers: {
      ...headers,
      "Cache-Control": "public, max-age=0, must-revalidate",
      "CDN-Cache-Control": `public, s-maxage=${ttl}, must-revalidate`,
      "Vercel-CDN-Cache-Control": `public, s-maxage=${ttl}, must-revalidate`,
      "Content-Type": "image/jpeg",
      "Content-Length": String(saved.image.length),
    },
  });
}
