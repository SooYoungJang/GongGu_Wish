import { canRecordBehaviorSignals, subscribeBehaviorSignalsPolicy } from "../audience/behaviorSignalsPolicy";

export type EventName = "js_error" | "query_error" | "search_results" | "detail_open" | "bookmark_set" | "reminder_set" | "purchase_link_open";
type Value = "zero" | "some" | "many" | "on" | "off" | "success" | "failed";
type Metadata = { appVersion: string; releaseId: string; platform: string };
type Event = Metadata & { id: string; eventName: EventName; screen: string; errorKind: string | null; httpStatus: number | null; value: Value | null };
type Batch = { sessionId: string; events: Event[] };
type Transport = (batch: Batch, signal: AbortSignal) => Promise<void>;
const screens = new Set(["Startup", "Unknown", "MainTabs", "Ranking", "Reels", "Home", "Search", "MyPage", "CalendarScreen", "Detail", "FeedDetail", "InfluencerGroupBuys", "SearchScreen", "GroupBuyRequestRankings", "MyGroupBuyRequests", "Admin", "Login", "Submit", "Settings"]);
const errorKinds = new Set(["Error", "TypeError", "RangeError", "ReferenceError", "SyntaxError", "ApiError"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ephemeral correlation only; never used as an authentication or device identifier.
function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const n = Math.floor(Math.random() * 16);
    return (c === "x" ? n : (n & 3) | 8).toString(16);
  });
}

export function safeErrorFields(error: unknown) {
  const name = error instanceof Error ? error.name : "Unknown";
  const status = error instanceof Error && "status" in error ? error.status : null;
  return {
    errorKind: errorKinds.has(name) ? name : "Unknown",
    httpStatus: typeof status === "number" && Number.isInteger(status) && status >= 0 && status <= 599 ? status : null,
  };
}

export function createTelemetry(allowed: () => boolean = canRecordBehaviorSignals) {
  let metadata: Metadata | null = null;
  let transport: Transport | null = null;
  let screen = "Startup", sessionId = uuid(), generation = 0;
  let queue: { event: Event; attempts: number }[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | null = null;
  let running = false;
  const cancelTimer = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const clear = () => {
    generation += 1;
    queue = [];
    sessionId = uuid();
    cancelTimer();
    controller?.abort();
  };
  const schedule = (delay = 5000) => {
    if (timer !== undefined || !queue.length || !allowed()) return;
    timer = setTimeout(() => { timer = undefined; void flush(); }, delay);
  };
  async function flush() {
    if (!allowed()) { clear(); return; }
    if (running || !transport || !queue.length) return;
    cancelTimer();
    running = true;
    const expected = generation, batch = queue.slice(0, 20), sender = transport;
    const currentController = new AbortController();
    controller = currentController;
    const timeout = setTimeout(() => currentController.abort(), 8000);
    let retry = false;
    try {
      await sender({ sessionId, events: batch.map(entry => entry.event) }, currentController.signal);
      if (expected === generation) {
        const sent = new Set(batch.map(entry => entry.event.id));
        queue = queue.filter(entry => !sent.has(entry.event.id));
      }
    } catch {
      if (expected === generation) {
        batch.forEach(entry => { entry.attempts += 1; });
        queue = queue.filter(entry => entry.attempts < 3);
        retry = true;
      }
    } finally {
      clearTimeout(timeout);
      if (controller === currentController) controller = null;
      running = false;
      if (!allowed()) clear();
      else schedule(retry ? 30000 : 5000);
    }
  }
  return {
    configure(next: Metadata, sender: Transport) {
      metadata = {
        appVersion: /^[0-9][0-9A-Za-z.+-]{0,39}$/.test(next.appVersion) ? next.appVersion : "0",
        releaseId: uuidPattern.test(next.releaseId) ? next.releaseId : "native",
        platform: ["android", "ios", "web"].includes(next.platform) ? next.platform : "unknown",
      };
      transport = sender;
    },
    setScreen(name: string | undefined) { screen = screens.has(name ?? "") ? name! : "Unknown"; },
    record(eventName: EventName, value: Value | null = null, error?: unknown) {
      if (!allowed()) { clear(); return; }
      if (!metadata || queue.length >= 50) return;
      const fields = error === undefined ? { errorKind: null, httpStatus: null } : safeErrorFields(error);
      queue.push({ event: { ...metadata, id: uuid(), eventName, screen, ...fields, value }, attempts: 0 });
      schedule();
    },
    flush,
    clear,
  };
}

export const telemetry = createTelemetry();
subscribeBehaviorSignalsPolicy(() => { if (!canRecordBehaviorSignals()) telemetry.clear(); });
