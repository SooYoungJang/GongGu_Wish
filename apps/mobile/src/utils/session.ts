import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = '@gonggu/session-id/v1';

let cached: string | null = null;

/**
 * Returns a stable per-install anonymous session id.
 * Used to dedupe popularity signals (views/bookmarks) from anon users without PII.
 * Generated once and persisted in AsyncStorage.
 */
export async function getSessionId(): Promise<string> {
  if (cached) return cached;
  let id = await AsyncStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(SESSION_KEY, id);
  }
  cached = id;
  return id;
}
