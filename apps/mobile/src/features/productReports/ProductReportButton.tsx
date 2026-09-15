import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SText } from "../../components/ui/SText";
import { useOptionalAuth } from "../../context/AuthContext";
import { useCommerceTheme } from "../../design/useCommerceTheme";
import { useAuthGate } from "../../hooks/useAuthGate";
import { REPORT_REASONS, submitProductReport, type ProductReportReason } from "./api";

export function ProductReportButton({ groupBuyId, productName, onOpenChange }: { groupBuyId: string; productName: string; onOpenChange?: React.Dispatch<React.SetStateAction<boolean>> }) {
  const theme = useCommerceTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { requireAuth } = useAuthGate();
  const userId = useOptionalAuth()?.user?.id;
  const [visible, setVisible] = useState(false);
  const [reason, setReason] = useState<ProductReportReason | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const busyRef = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    onOpenChange?.(visible);
    return () => { onOpenChange?.(false); };
  }, [visible, onOpenChange]);
  useEffect(() => {
    generation.current += 1;
    setVisible(false); setReason(null); setError(null); setSent(false); setBusy(false); busyRef.current = false;
    return () => { generation.current += 1; };
  }, [groupBuyId, userId]);

  async function submit() {
    if (busyRef.current || !reason || !userId || !requireAuth()) return;
    const expected = generation.current;
    busyRef.current = true; setBusy(true); setError(null);
    try {
      await submitProductReport(userId, groupBuyId, reason);
      if (expected === generation.current) setSent(true);
    } catch (failure) {
      if (expected !== generation.current) return;
      setError(typeof failure === "object" && failure !== null && "status" in failure && failure.status === 429
        ? "오늘 보낼 수 있는 신고 수를 넘었어요. 나중에 다시 시도해 주세요."
        : "신고를 보내지 못했어요. 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      if (expected === generation.current) { busyRef.current = false; setBusy(false); }
    }
  }

  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="상품 정보가 달라요" hitSlop={8} style={({ pressed }) => [styles.entry, pressed && styles.pressed]} onPress={() => {
      if (requireAuth()) { setVisible(true); setSent(false); setError(null); }
    }}>
      <SText variant="caption" style={styles.entryText}>정보가 달라요</SText>
    </Pressable>
    <Modal transparent animationType="fade" visible={visible} onRequestClose={() => { if (!busyRef.current) setVisible(false); }}>
      <View style={styles.overlay}>
        <View accessibilityViewIsModal style={styles.dialog}>
          <ScrollView contentContainerStyle={styles.content}>
            <SText variant="cardTitle" accessibilityRole="header" style={styles.text}>{sent ? "신고를 접수했어요" : "어떤 정보가 다른가요?"}</SText>
            <SText variant="body" style={styles.text}>{productName}</SText>
            {sent ? <SText variant="body" style={styles.text}>운영자가 확인한 뒤 필요한 정보를 수정할게요.</SText> : <>
              {REPORT_REASONS.map(option => <Pressable key={option.value} accessibilityRole="radio"
                accessibilityState={{ checked: reason === option.value, disabled: busy }} disabled={busy}
                onPress={() => setReason(option.value)} style={[styles.option, reason === option.value && styles.selected]}>
                <SText variant="body" style={styles.text}>{reason === option.value ? "✓ " : ""}{option.label}</SText>
              </Pressable>)}
              {error ? <SText variant="body" accessibilityRole="alert" style={styles.text}>{error}</SText> : null}
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || !reason, busy }} disabled={busy || !reason}
                onPress={() => { void submit(); }} style={[styles.submit, (!reason || busy) && styles.disabled]}>
                <SText variant="body" style={styles.submitText}>{busy ? "보내는 중…" : "신고 보내기"}</SText>
              </Pressable>
            </>}
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => setVisible(false)} style={styles.option}>
              <SText variant="body" style={styles.text}>닫기</SText>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}

function makeStyles({ colors, spacing, radius }: ReturnType<typeof useCommerceTheme>) {
  return StyleSheet.create({
    entry: { paddingVertical: 5, paddingHorizontal: spacing.sm, alignSelf: "center", backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.22)", borderWidth: 1, borderRadius: radius.full },
    entryText: { color: "#FFFFFF", fontSize: 11, fontWeight: "600" },
    pressed: { opacity: 0.7 },
    overlay: { flex: 1, justifyContent: "center", padding: spacing.xl, backgroundColor: colors.overlay },
    dialog: { backgroundColor: colors.surface, borderRadius: radius.lg, maxHeight: "90%", width: "100%", maxWidth: 480, alignSelf: "center" },
    content: { padding: spacing.xl, gap: spacing.md },
    text: { color: colors.text },
    option: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
    selected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
    submit: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.accent },
    submitText: { color: colors.inverse, textAlign: "center" },
    disabled: { opacity: 0.5 },
  });
}
