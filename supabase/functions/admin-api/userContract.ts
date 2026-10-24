import { isExpoPushToken } from "./pushNotificationContract.ts";

export type AdminUser = {
  id: string;
  email: string | null;
  nickname: string | null;
  fcmToken: string | null;
  hasPushToken: boolean;
  createdAt: string;
  updatedAt: string;
  lastAccessAt: string | null;
  status: string;
};

export function mapAdminUser(row: Record<string, unknown>): AdminUser {
  return {
    id: typeof row.id === "string" ? row.id : "",
    email: typeof row.email === "string" ? row.email : null,
    nickname: typeof row.nickname === "string" ? row.nickname : null,
    fcmToken: typeof row.fcm_token === "string" ? row.fcm_token : null,
    hasPushToken:
      row.push_provider === "expo" && isExpoPushToken(row.push_token),
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : "",
    lastAccessAt: typeof row.last_access_at === "string" ? row.last_access_at : null,
    status: typeof row.status === "string" ? row.status : "ACTIVE",
  };
}

export async function mapAdminUsersWithAccess(
  rows: Record<string, unknown>[],
  loadAccessTimes: (ids: string[]) => PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>,
): Promise<AdminUser[]> {
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.map(row => row.id).filter((id): id is string => typeof id === "string" && id.length > 0))];
  const { data, error } = await loadAccessTimes(ids);
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) throw new Error("Invalid user access response");
  const accessTimes = new Map<string, string>();
  for (const row of data) {
    if (row && typeof row === "object" && typeof row.user_id === "string" && typeof row.last_access_at === "string") {
      accessTimes.set(row.user_id, row.last_access_at);
    }
  }
  return rows.map(row => mapAdminUser({
    ...row,
    last_access_at: typeof row.id === "string" ? accessTimes.get(row.id) ?? null : null,
  }));
}
