import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { SText } from "../../components/ui/SText";
import { useAuth } from "../../context/AuthContext";
import { useNotificationPreferences } from "../../context/NotificationPreferencesContext";
import { useAuthGate } from "../../hooks/useAuthGate";
import { useCommerceTheme } from "../../design/useCommerceTheme";
import { registerForPushNotifications } from "../../services/notifications";
import { setMyRequestNotification } from "./myRequestsApi";

export function RequestNotificationToggle({ userId, requestId, enabled, closed, onSettings, onChanged }: { userId: string; requestId: string; enabled: boolean; closed: boolean; onSettings: () => void; onChanged: () => void }) {
  const { user, session } = useAuth();
  const { preferences, ready } = useNotificationPreferences();
  const { canAuthenticate } = useAuthGate();
  const { colors } = useCommerceTheme();
  const [selected, setSelected] = useState(enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const latest = useRef({ userId: user?.id, canAuthenticate, pushEnabled: preferences.pushEnabled });
  latest.current = { userId: user?.id, canAuthenticate, pushEnabled: preferences.pushEnabled };
  useEffect(() => {
    generation.current++; busy.current = false; setSaving(false); setError(null); setSelected(enabled);
    return () => { generation.current++; };
  }, [userId, requestId, enabled]);
  async function toggle() {
    if (busy.current || !ready || !canAuthenticate || user?.id !== userId || (closed && !selected)) return;
    if (!selected && !preferences.pushEnabled) {
      Alert.alert("푸시 알림을 먼저 켜주세요", "설정에서 푸시 알림을 켠 뒤 이 요청의 완료 알림을 선택해주세요.", [{ text: "닫기", style: "cancel" }, { text: "설정 열기", onPress: onSettings }]);
      return;
    }
    const revision = generation.current;
    const current = () => revision === generation.current && latest.current.userId === userId && latest.current.canAuthenticate;
    busy.current = true; setSaving(true); setError(null);
    try {
      const next = !selected;
      if (next) {
        if (!session?.access_token) throw new Error("다시 로그인한 뒤 알림을 선택해주세요.");
        const registration = await registerForPushNotifications(session.access_token, { requestPermission: true, shouldContinue: () => current() && latest.current.pushEnabled });
        if (!current()) return;
        if (registration.status !== "registered") throw new Error("기기 알림 권한과 연결 상태를 확인한 뒤 다시 시도해주세요.");
      }
      if (!current() || (next && !latest.current.pushEnabled)) return;
      await setMyRequestNotification(userId, requestId, next);
      if (current()) { setSelected(next); onChanged(); }
    } catch {
      if (current()) setError("알림 설정을 저장하지 못했어요. 요청이 완료되었는지 확인하거나 다시 시도해주세요.");
    } finally {
      if (current()) { busy.current = false; setSaving(false); }
    }
  }
  if (closed && !selected) return null;
  return <View>
    <Pressable accessibilityRole="switch" accessibilityLabel="이 요청의 완료 알림" accessibilityState={{ checked: selected, disabled: saving || !ready }} disabled={saving || !ready} onPress={() => void toggle()} style={{ minHeight: 48, justifyContent: "center" }}>
      <SText variant="label" style={{ color: colors.accent }}>{saving ? "저장 중..." : selected ? "완료 알림 받는 중 · 끄기" : "공구 등록 시 알림 받기"}</SText>
    </Pressable>
    {error ? <SText variant="caption" accessibilityLiveRegion="polite" style={{ color: colors.muted }}>{error}</SText> : null}
  </View>;
}
