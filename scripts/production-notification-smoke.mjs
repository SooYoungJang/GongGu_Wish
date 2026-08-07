function requireValue(value, name) {
  if (!value || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

function normalizeUrl(value) {
  return requireValue(value, "SUPABASE_URL").replace(/\/+$/, "");
}

async function requestJson(fetchImpl, url, init) {
  const response = await fetchImpl(url, init);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: text || "non-JSON response" };
  }
  if (!response.ok) {
    const code =
      body && typeof body.code === "string" ? body.code : "HTTP_ERROR";
    throw new Error(`${code} (${response.status})`);
  }
  return body;
}

function headers(anonKey, accessToken) {
  return {
    "Content-Type": "application/json",
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
  };
}

async function invokePreferences(
  fetchImpl,
  baseUrl,
  anonKey,
  accessToken,
  body,
) {
  return requestJson(fetchImpl, `${baseUrl}/functions/v1/register-push-token`, {
    method: "POST",
    headers: headers(anonKey, accessToken),
    body: JSON.stringify(body),
  });
}

function assertPreferencesEqual(actual, expected) {
  const comparable = (value) =>
    JSON.stringify({
      pushEnabled: value.pushEnabled,
      deadlineRemindersEnabled: value.deadlineRemindersEnabled,
      submissionApprovalEnabled: value.submissionApprovalEnabled,
      marketingPushEnabled: value.marketingPushEnabled,
      reminderDays: value.reminderDays,
      followedInfluencers: value.followedInfluencers,
      followedBrands: value.followedBrands,
    });
  if (comparable(actual) !== comparable(expected)) {
    throw new Error("notification preferences did not round-trip");
  }
}

export async function runNotificationSmoke({
  supabaseUrl,
  anonKey,
  email,
  password,
  fetchImpl = globalThis.fetch,
}) {
  const baseUrl = normalizeUrl(supabaseUrl);
  const publicKey = requireValue(anonKey, "SUPABASE_ANON_KEY");
  const smokeEmail = requireValue(email, "SUPABASE_SMOKE_EMAIL");
  const smokePassword = requireValue(password, "SUPABASE_SMOKE_PASSWORD");
  if (typeof fetchImpl !== "function") throw new Error("fetch is required");

  const session = await requestJson(
    fetchImpl,
    `${baseUrl}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: publicKey,
      },
      body: JSON.stringify({ email: smokeEmail, password: smokePassword }),
    },
  );
  const accessToken = requireValue(session.access_token, "access_token");

  const read = () =>
    invokePreferences(fetchImpl, baseUrl, publicKey, accessToken, {
      action: "read",
    });
  const beforeResponse = await read();
  const before = beforeResponse?.data?.preferences;
  if (!before || typeof before !== "object") {
    throw new Error("notification preference read returned no preferences");
  }

  const target = {
    ...before,
    deadlineRemindersEnabled: !before.deadlineRemindersEnabled,
    // Marketing consent has audit timestamps, so the canary leaves it unchanged.
    submissionApprovalEnabled: !before.submissionApprovalEnabled,
  };
  let writeStarted = false;
  try {
    writeStarted = true;
    const writeResponse = await invokePreferences(
      fetchImpl,
      baseUrl,
      publicKey,
      accessToken,
      { preferences: target },
    );
    if (writeResponse?.data?.preferencesSynced !== true) {
      throw new Error("notification preference write was not acknowledged");
    }
    const afterResponse = await read();
    assertPreferencesEqual(afterResponse?.data?.preferences, target);
    return { status: "passed" };
  } finally {
    if (writeStarted) {
      await invokePreferences(fetchImpl, baseUrl, publicKey, accessToken, {
        preferences: before,
      });
    }
  }
}

function main() {
  runNotificationSmoke({
    supabaseUrl: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    email: process.env.SUPABASE_SMOKE_EMAIL,
    password: process.env.SUPABASE_SMOKE_PASSWORD,
  })
    .then(() => process.stdout.write("Production notification smoke passed.\n"))
    .catch((error) => {
      process.stderr.write(
        `Production notification smoke failed: ${error.message}\n`,
      );
      process.exitCode = 1;
    });
}

import { pathToFileURL } from "node:url";

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
