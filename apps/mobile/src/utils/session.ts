import AsyncStorage from '@react-native-async-storage/async-storage';

import { canRecordBehaviorSignals } from '../audience/behaviorSignalsPolicy';

const SESSION_KEY = '@gonggu/session-id/v1';

let cached: string | null = null;

/**
 * Returns a stable per-install anonymous session id.
 * Used to dedupe popularity signals (views/bookmarks) from anon users without PII.
 * Generated once and persisted in AsyncStorage.
 */
export async function getSessionId(): Promise<string | null> {
  if (!canRecordBehaviorSignals()) return null;
  if (cached) return cached;
  let id = await AsyncStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(SESSION_KEY, id);
  }
  cached = id;
  return id;
}

export async function clearSessionId(): Promise<void> {
  cached = null;
  await AsyncStorage.removeItem(SESSION_KEY);
}
