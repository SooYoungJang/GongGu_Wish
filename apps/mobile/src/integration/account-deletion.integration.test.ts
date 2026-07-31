import { randomUUID } from "node:crypto";

import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  getLocalSupabaseConfig,
  hasLocalSupabaseConfig,
  type LocalSupabaseConfig,
} from "./localSupabaseHarness";

const describeLocal = hasLocalSupabaseConfig() ? describe : describe.skip;

type RequestOptions = {
  authorization?: string;
  body?: unknown;
  key: string;
  method?: "GET" | "POST" | "DELETE";
};

async function request(
  config: LocalSupabaseConfig,
  path: string,
  options: RequestOptions,
): Promise<{ payload: unknown; status: number }> {
  const headers: Record<string, string> = {
    apikey: options.key,
    "Content-Type": "application/json",
  };
  const authorization =
    options.authorization ??
    (options.key.split(".").length === 3 ? options.key : null);
  if (authorization) headers.Authorization = `Bearer ${authorization}`;

  const response = await fetch(`${config.url}${path}`, {
    method: options.method ?? "GET",
    headers,
    body:
      options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  return { payload, status: response.status };
}

describeLocal("local Supabase account deletion contract", () => {
  let config: LocalSupabaseConfig;
  let pendingUserId: string | null = null;

  beforeAll(() => {
    config = getLocalSupabaseConfig();
  });

  afterEach(async () => {
    if (!pendingUserId) return;
    const encodedId = encodeURIComponent(pendingUserId);
    await Promise.allSettled([
      request(config, `/rest/v1/users?id=eq.${encodedId}`, {
        method: "DELETE",
        key: config.serviceRoleKey,
      }),
      request(config, `/auth/v1/admin/users/${encodedId}`, {
        method: "DELETE",
        key: config.serviceRoleKey,
      }),
    ]);
    pendingUserId = null;
  });

  it("deletes the authenticated public profile and Auth user", async () => {
    const suffix = randomUUID();
    const email = `account-deletion-${suffix}@example.test`;
    const password = `Delete!${suffix}`;

    const created = await request(config, "/auth/v1/admin/users", {
      method: "POST",
      key: config.serviceRoleKey,
      body: { email, password, email_confirm: true },
    });
    expect(created.status).toBe(200);
    const userId = (created.payload as { id: string }).id;
    pendingUserId = userId;

    const profile = await request(config, "/rest/v1/users", {
      method: "POST",
      key: config.serviceRoleKey,
      body: { id: userId, email, updated_at: new Date().toISOString() },
    });
    expect(profile.status).toBe(201);

    const session = await request(
      config,
      "/auth/v1/token?grant_type=password",
      {
        method: "POST",
        key: config.anonKey,
        body: { email, password },
      },
    );
    expect(session.status).toBe(200);
    const accessToken = (session.payload as { access_token: string })
      .access_token;

    const deleted = await request(config, "/functions/v1/delete-account", {
      method: "POST",
      key: config.anonKey,
      authorization: accessToken,
      body: {},
    });
    expect(deleted).toEqual({ payload: { deleted: true }, status: 200 });

    const encodedId = encodeURIComponent(userId);
    const remainingProfiles = await request(
      config,
      `/rest/v1/users?id=eq.${encodedId}&select=id`,
      { key: config.serviceRoleKey },
    );
    expect(remainingProfiles).toEqual({ payload: [], status: 200 });

    const remainingAuthUser = await request(
      config,
      `/auth/v1/admin/users/${encodedId}`,
      { key: config.serviceRoleKey },
    );
    expect(remainingAuthUser.status).toBe(404);
    pendingUserId = null;
  });
});
