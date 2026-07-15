import { isExpoPushToken } from "./pushNotificationContract.ts";

export type AdminUser = {
  id: string;
  email: string | null;
  nickname: string | null;
  fcmToken: string | null;
  hasPushToken: boolean;
  createdAt: string;
  updatedAt: string;
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
    status: typeof row.status === "string" ? row.status : "ACTIVE",
  };
}
