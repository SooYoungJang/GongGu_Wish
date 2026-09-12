const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const events = new Set(["js_error", "query_error", "search_results", "detail_open", "bookmark_set", "reminder_set", "purchase_link_open"]);
const screens = new Set(["Startup", "Unknown", "MainTabs", "Ranking", "Reels", "Home", "Search", "MyPage", "CalendarScreen", "Detail", "FeedDetail", "InfluencerGroupBuys", "SearchScreen", "GroupBuyRequestRankings", "MyGroupBuyRequests", "Admin", "Login", "Submit", "Settings"]);
const errors = new Set(["Error", "TypeError", "RangeError", "ReferenceError", "SyntaxError", "ApiError", "Unknown"]);
const values = new Set(["zero", "some", "many", "on", "off", "success", "failed"]);
const fields = new Set(["id", "eventName", "screen", "appVersion", "releaseId", "platform", "errorKind", "httpStatus", "value"]);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export function parseTelemetryBatch(value: unknown) {
  if (!record(value) || Object.keys(value).some(k => k !== "sessionId" && k !== "events") || typeof value.sessionId !== "string" || !uuid.test(value.sessionId) || !Array.isArray(value.events) || !value.events.length || value.events.length > 20) throw new Error("Invalid telemetry batch");
  for (const event of value.events) {
    if (!record(event) || Object.keys(event).some(key => !fields.has(key)) ||
      typeof event.id !== "string" || !uuid.test(event.id) || !events.has(String(event.eventName)) || !screens.has(String(event.screen)) ||
      typeof event.appVersion !== "string" || !/^[0-9][0-9A-Za-z.+-]{0,39}$/.test(event.appVersion) ||
      typeof event.releaseId !== "string" || !(event.releaseId === "native" || uuid.test(event.releaseId)) ||
      !["android", "ios", "web", "unknown"].includes(String(event.platform)) ||
      !(event.errorKind === null || errors.has(String(event.errorKind))) ||
      !(event.httpStatus === null || typeof event.httpStatus === "number" && Number.isInteger(event.httpStatus) && event.httpStatus >= 0 && event.httpStatus <= 599) ||
      !(event.value === null || values.has(String(event.value)))) throw new Error("Invalid telemetry event");
  }
  return { sessionId: value.sessionId, events: value.events as Record<string, unknown>[] };
}
