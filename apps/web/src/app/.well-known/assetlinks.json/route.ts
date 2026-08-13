const PRODUCTION_ANDROID_APP_LINKS = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "com.gonggu.wish",
      sha256_cert_fingerprints: [
        "6F:7F:CA:68:AD:F9:52:27:20:9B:3D:5F:D5:61:35:C7:91:5A:A3:C2:8C:13:89:64:BF:B9:34:E7:29:19:0D:0C",
      ],
    },
  },
];

export function GET() {
  return Response.json(PRODUCTION_ANDROID_APP_LINKS, {
    headers: {
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
