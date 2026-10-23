import AsyncStorage from "@react-native-async-storage/async-storage";

import { callEdgeFunction } from "../lib/postgrest-client";
import { isExpoPushToken } from "./pushToken";

const DEVICE_TOKEN_KEY = "@gonggu/device-push-token/v1";
const inFlightRegistrations = new Set<Promise<unknown>>();
let registrationRevision = 0;
let pausedRegistrations = 0;

export function capturePushRegistrationGuard(shouldContinue: () => boolean) {
  const revision = registrationRevision;
  return () => pausedRegistrations === 0 && revision === registrationRevision && shouldContinue();
}

export async function registerPushDeviceToken(
  token: string,
  authToken: string | undefined,
  shouldContinue: () => boolean,
) {
  if (!shouldContinue()) return false;
  // Remember the installation token even when OS permission is later revoked.
  await AsyncStorage.setItem(DEVICE_TOKEN_KEY, token);
  if (!shouldContinue()) return false;
  const registration = callEdgeFunction("register-push-token", { token, provider: "expo" }, { authToken });
  inFlightRegistrations.add(registration);
  try {
    await registration;
    return true;
  } finally {
    inFlightRegistrations.delete(registration);
  }
}

export async function signOutPushDevice<T>(authToken: string | undefined, signOut: () => Promise<T>): Promise<T> {
  registrationRevision += 1;
  pausedRegistrations += 1;
  try {
    // A registration already accepted by the server must finish before release.
    await Promise.allSettled([...inFlightRegistrations]);
    const token = authToken ? await AsyncStorage.getItem(DEVICE_TOKEN_KEY) : null;
    if (authToken && isExpoPushToken(token)) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await callEdgeFunction<{ data: { unregistered: boolean } }>(
          "register-push-token",
          { action: "unregister", token, provider: "expo" },
          { authToken, signal: controller.signal },
        );
        if (!response.data.unregistered) throw new Error("Push device release was not acknowledged");
      } catch {
        throw new Error("기기의 푸시 연결을 해제하지 못했어요. 네트워크를 확인한 뒤 로그아웃을 다시 시도해 주세요.");
      } finally {
        clearTimeout(timeout);
      }
    }
    return await signOut();
  } finally {
    pausedRegistrations -= 1;
  }
}
