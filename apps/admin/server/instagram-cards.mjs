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
export const postingCycle = (now) => kstDate(now - 21 * 3600000);
export const cycleExpiry = (cycle) =>
  Date.parse(`${cycle}T21:00:00+09:00`) + 86400000;
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
  if (!Array.isArray(rows) || rows.length > 12) return null;
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
      thumbnailUrl: validThumbnailUrl(r.thumbnail_url) ? r.thumbnail_url : null,
    });
  }
  return { date, items };
}
export const validThumbnailUrl = (value) => {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      (!u.port || u.port === "443") &&
      ["cdninstagram.com", "fbcdn.net"].some((h) =>
        u.hostname.endsWith("." + h),
      ) &&
      u.pathname.startsWith("/v/") &&
      u.href.length <= 4096
    );
  } catch {
    return false;
  }
};
export async function fetchThumbnail(url, fetcher = fetch) {
  if (!validThumbnailUrl(url)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  let reader;
  try {
    const r = await fetcher(url, {
      signal: controller.signal,
      redirect: "error",
      headers: { Accept: "image/jpeg,image/png,image/webp" },
    });
    if (
      !r.ok ||
      !/^image\/(jpeg|png|webp)(;|$)/i.test(
        r.headers.get("content-type") ?? "",
      ) ||
      Number(r.headers.get("content-length")) > 2000000
    )
      return null;
    if (!r.body) return null;
    reader = r.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2000000) {
        controller.abort();
        return null;
      }
      chunks.push(value);
    }
    const { default: sharp } = await import("sharp");
    const source = Buffer.concat(chunks);
    // Decode a bounded static raster, strip metadata, and embed only normalized pixels.
    const image = sharp(source, {
      limitInputPixels: 16000000,
      animated: false,
      failOn: "warning",
    });
    const meta = await image.metadata();
    if (
      !["jpeg", "png", "webp"].includes(meta.format) ||
      !meta.width ||
      !meta.height ||
      (meta.pages ?? 1) > 1
    )
      return null;
    return await image
      .rotate()
      .resize(224, 224, { fit: "contain", background: "#ffffff" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    controller.abort();
    if (reader) await reader.cancel().catch(() => {});
  }
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
  const photos = await Promise.all(
    data.items.map((v) =>
      v.photoPixels !== undefined
        ? v.photoPixels
        : fetchThumbnail(v.thumbnailUrl),
    ),
  );
  const rows = data.items
    .map((v, i) => {
      const y = 470 + i * 218;
      const photo = photos[i];
      const split = (s, n) => {
        const chars = Array.from(s);
        return chars.length > n
          ? [chars.slice(0, n).join(""), short(chars.slice(n).join(""), n)]
          : [s];
      };
      const name = split(v.productName, 19);
      return (
        `<rect x="72" y="${y}" width="936" height="198" rx="24" fill="white"/>` +
        (photo
          ? `<image x="92" y="${y + 15}" width="168" height="168" href="data:image/jpeg;base64,${photo.toString("base64")}"/>`
          : `<rect x="92" y="${y + 15}" width="168" height="168" rx="12" fill="#f4efec"/>` +
            text(105, y + 108, "사진 없음", 27, false, "#74516F")) +
        name
          .map((line, j) =>
            text(286, y + 51 + j * 42, line, 32, true, "#442145"),
          )
          .join("") +
        text(286, y + 137, "@" + v.sellerName, 27, false, "#74516F") +
        text(
          286,
          y + 176,
          `${md(v.startDate)} - ${md(v.endDate)}`,
          26,
          true,
          "#74516F",
        )
      );
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#ff8524"/><stop offset=".52" stop-color="#ff2d66"/><stop offset="1" stop-color="#6f21ce"/></linearGradient></defs><rect width="1080" height="1350" fill="url(#g)"/><image x="72" y="68" width="120" height="120" href="data:image/png;base64,${icon}"/>${text(218, 126, "공구위시", 42, true)}${text(218, 169, data.date.replaceAll("-", ".") + " · 앱 등록 일정 기준", 24)}${text(72, 302, "지금 진행 중인", 62, true)}${text(72, 385, "공구 모아보기", 62, true)}${text(76, 440, "오늘 오픈이 아닌, 진행 중인 공구예요", 31)}${rows}${text(76, 1161, "일정은 변경될 수 있어요. 구매 전 판매자 공지를 확인하세요.", 25)}<path d="M72 1210H1008" stroke="white" stroke-width="2"/>${text(72, 1280, "공구위시 · Google Play에서 만나요", 32, true)}</svg>`;
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
    date = postingCycle(clock);
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
            Date.parse(`${kstDate(clock)}T00:00:00+09:00`) + 86400000,
          )
            .toISOString()
            .replace("Z", "");
          const q = new URLSearchParams({
            select:
              "product_name,instagram_username,start_date,end_date,status,source_type,collection_review_status,thumbnail_url",
            status: "eq.APPROVED",
            or: "(source_type.neq.MANUAL_DISCOVERY,source_type.is.null,collection_review_status.eq.APPROVED)",
            start_date: `lte.${new Date(clock).toISOString().replace("Z", "")}`,
            end_date: `gte.${tomorrow}`,
            instagram_username: "not.is.null",
            order: "end_date.asc,product_name.asc,id.asc",
            limit: "12",
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
          if (!data || postingCycle(now()) !== date)
            throw { status: 502, code: "INVALID_LISTINGS" };
          if (!data.items.length)
            throw { status: 404, code: "NO_ONGOING_LISTINGS" };
          const photos = await Promise.all(
            data.items.map((v) =>
              fetchThumbnail(v.thumbnailUrl, deps.thumbnailFetch ?? fetch),
            ),
          );
          const withPhotos = data.items
            .map((v, i) => ({ ...v, photoPixels: photos[i] }))
            .filter((v) => v.photoPixels)
            .slice(0, 3);
          if (withPhotos.length < 2)
            throw { status: 404, code: "INSUFFICIENT_PHOTO_LISTINGS" };
          const prepared = { ...data, items: withPhotos };
          const image = await (deps.render ?? renderOngoing)(prepared);
          if (postingCycle(now()) !== date)
            throw { status: 502, code: "DATE_CHANGED" };
          if (image.length >= 8000000)
            throw { status: 502, code: "IMAGE_TOO_LARGE" };
          const expires = cycleExpiry(date);
          const result = {
            image,
            expires,
            photoCount: withPhotos.length,
            itemCount: withPhotos.length,
          };
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
  if (postingCycle(now()) !== date) return error(502, "DATE_CHANGED");
  // Successful posting-cycle-keyed snapshot lasts only until next21:00 KST.
  // Owner accepts intraday snapshot staleness. Errors/empty results stay no-store.
  // No stale-while-revalidate or stale-if-error; old date paths fail closed.
  headers["X-Instagram-Photo-Count"] = String(saved.photoCount);
  headers["X-Instagram-Item-Count"] = String(saved.itemCount);
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
