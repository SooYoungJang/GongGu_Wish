import { randomUUID } from "node:crypto";

import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  getLocalSupabaseConfig,
  hasLocalSupabaseConfig,
  type LocalSupabaseConfig,
} from "./localSupabaseHarness";

const describeLocal = hasLocalSupabaseConfig() ? describe : describe.skip;

type RequestOptions = {
  body?: unknown;
  key: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  prefer?: string;
};

type PublicUser = {
  email: string | null;
  id: string;
  nickname: string | null;
};

async function request(
  config: LocalSupabaseConfig,
  path: string,
  options: RequestOptions,
): Promise<{ payload: unknown; status: number }> {
  const headers: Record<string, string> = {
    apikey: options.key,
    Authorization: `Bearer ${options.key}`,
    "Content-Type": "application/json",
  };
  if (options.prefer) headers.Prefer = options.prefer;

  const response = await fetch(`${config.url}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
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

describeLocal("local Supabase Auth profile provisioning contract", () => {
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

  async function createAuthUser(
    email: string,
    metadata: Record<string, unknown>,
    appMetadata?: Record<string, unknown>,
  ): Promise<string> {
    const created = await request(config, "/auth/v1/admin/users", {
      method: "POST",
      key: config.serviceRoleKey,
      body: {
        email,
        password: `Profile!${randomUUID()}`,
        email_confirm: true,
        user_metadata: metadata,
        ...(appMetadata ? { app_metadata: appMetadata } : {}),
      },
    });
    expect(created.status).toBe(200);
    const userId = (created.payload as { id: string }).id;
    pendingUserId = userId;
    return userId;
  }

  async function readPublicUser(userId: string) {
    return request(
      config,
      `/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=id,email,nickname`,
      { key: config.serviceRoleKey },
    );
  }

  it("creates a public.users profile when an email Auth user is created", async () => {
    const suffix = randomUUID();
    const email = `email-profile-${suffix}@example.test`;
    const nickname = `Email ${suffix.slice(0, 8)}`;
    const userId = await createAuthUser(email, {
      nickname,
      marketing_opt_in: true,
    });

    const profile = await readPublicUser(userId);

    expect(profile).toEqual({
      payload: [{ id: userId, email, nickname } satisfies PublicUser],
      status: 200,
    });
  });

  it("creates a public.users profile from Kakao-style Auth metadata", async () => {
    const suffix = randomUUID();
    const email = `kakao-profile-${suffix}@example.test`;
    const nickname = `Kakao ${suffix.slice(0, 8)}`;
    const userId = await createAuthUser(
      email,
      {
        avatar_url: "https://example.test/kakao-avatar.png",
        full_name: `Kakao User ${suffix.slice(0, 8)}`,
        nickname,
        provider_id: `kakao-${suffix}`,
      },
      { provider: "kakao", providers: ["kakao"] },
    );

    const profile = await readPublicUser(userId);

    expect(profile).toEqual({
      payload: [{ id: userId, email, nickname } satisfies PublicUser],
      status: 200,
    });
  });

  it("creates a public.users profile for a Kakao-style Auth user without email", async () => {
    const suffix = randomUUID();
    const phoneDigits = suffix.replace(/\D/g, "").padEnd(7, "0").slice(0, 7);
    const phone = `+1555${phoneDigits}`;
    const nickname = `Kakao Phone ${suffix.slice(0, 8)}`;
    const created = await request(config, "/auth/v1/admin/users", {
      method: "POST",
      key: config.serviceRoleKey,
      body: {
        phone,
        password: `Profile!${suffix}`,
        phone_confirm: true,
        user_metadata: { nickname, provider_id: `kakao-${suffix}` },
        app_metadata: { provider: "kakao", providers: ["kakao"] },
      },
    });
    expect(created.status).toBe(200);
    const userId = (created.payload as { id: string }).id;
    pendingUserId = userId;

    const profile = await readPublicUser(userId);

    expect(profile).toEqual({
      payload: [
        {
          id: userId,
          email: `${userId}@oauth.gonggu.invalid`,
          nickname,
        } satisfies PublicUser,
      ],
      status: 200,
    });
  });

  it("does not overwrite an existing public profile on later Auth metadata changes", async () => {
    const suffix = randomUUID();
    const email = `existing-profile-${suffix}@example.test`;
    const userId = await createAuthUser(email, {
      nickname: "Initial Auth Name",
    });
    const existingProfile = {
      id: userId,
      email,
      nickname: "Admin Edited Name",
      updated_at: new Date().toISOString(),
    };
    const current = await readPublicUser(userId);
    const saved = await request(
      config,
      `/rest/v1/users?id=eq.${encodeURIComponent(userId)}`,
      current.status === 200 &&
        Array.isArray(current.payload) &&
        current.payload.length > 0
        ? {
            method: "PATCH",
            key: config.serviceRoleKey,
            body: existingProfile,
          }
        : {
            method: "POST",
            key: config.serviceRoleKey,
            body: existingProfile,
          },
    );
    expect([200, 201, 204]).toContain(saved.status);

    const updatedAuth = await request(
      config,
      `/auth/v1/admin/users/${encodeURIComponent(userId)}`,
      {
        method: "PUT",
        key: config.serviceRoleKey,
        body: { user_metadata: { nickname: "Changed Auth Name" } },
      },
    );
    expect(updatedAuth.status).toBe(200);

    const profile = await readPublicUser(userId);
    expect(profile).toEqual({
      payload: [
        {
          id: userId,
          email,
          nickname: "Admin Edited Name",
        } satisfies PublicUser,
      ],
      status: 200,
    });
  });
});
