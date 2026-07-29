const GOOGLE_APP_ADS_LINE =
  /^google\.com, pub-(?!0{16},)\d{16}, DIRECT, f08c47fec0942fa0$/;

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const snippet = process.env.ADMOB_APP_ADS_TXT?.trim();
  if (!snippet || !GOOGLE_APP_ADS_LINE.test(snippet)) {
    return new Response("app-ads.txt is not configured\n", {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  return new Response(`${snippet}\n`, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
