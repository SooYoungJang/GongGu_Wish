import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { AgeBand } from "./audiencePolicy";
import { useAudience } from "./AudienceContext";

const AGE_OPTIONS: ReadonlyArray<{
  ageBand: AgeBand;
  label: string;
  description: string;
}> = [
  {
    ageBand: "under13",
    label: "만 12세 이하",
    description: "현재 공구위시를 이용할 수 없어요.",
  },
  {
    ageBand: "age13",
    label: "만 13세",
    description: "로그인과 광고 없이 공개 콘텐츠를 둘러볼 수 있어요.",
  },
  {
    ageBand: "age14Plus",
    label: "만 14세 이상",
    description: "로그인, 알림과 맞춤 기능을 이용할 수 있어요.",
  },
];

export function AudienceGate({ children }: { children: React.ReactNode }) {
  const { ageBand, clearAgeBand, isHydrated, policy, selectAgeBand } =
    useAudience();
  const [pending, setPending] = useState(false);

  const handleSelection = useCallback(
    async (nextAgeBand: AgeBand) => {
      if (pending) return;
      setPending(true);
      try {
        await selectAgeBand(nextAgeBand);
      } finally {
        setPending(false);
      }
    },
    [pending, selectAgeBand],
  );

  const handleChangeSelection = useCallback(async () => {
    if (pending) return;
    setPending(true);
    try {
      await clearAgeBand();
    } finally {
      setPending(false);
    }
  }, [clearAgeBand, pending]);

  if (!isHydrated) {
    return (
      <SafeAreaView style={styles.centered} testID="audience-loading">
        <ActivityIndicator color="#ff5a5f" size="small" />
        <Text style={styles.loadingText}>이용 설정을 확인하고 있어요.</Text>
      </SafeAreaView>
    );
  }

  if (ageBand === null) {
    return (
      <SafeAreaView style={styles.container} testID="age-selection-screen">
        <View style={styles.content}>
          <Text accessibilityRole="header" style={styles.title}>
            연령 구간을 선택해 주세요
          </Text>
          <Text style={styles.body}>
            안전한 이용 범위를 정하기 위한 선택이에요. 생년월일은 수집하거나
            저장하지 않습니다.
          </Text>
          <View style={styles.optionList}>
            {AGE_OPTIONS.map((option) => (
              <Pressable
                accessibilityHint={option.description}
                accessibilityLabel={option.label}
                accessibilityRole="button"
                disabled={pending}
                key={option.ageBand}
                onPress={() => void handleSelection(option.ageBand)}
                style={({ pressed }) => [
                  styles.option,
                  pressed && styles.pressed,
                  pending && styles.disabled,
                ]}
                testID={`age-option-${option.ageBand}`}
              >
                <Text style={styles.optionLabel}>{option.label}</Text>
                <Text style={styles.optionDescription}>
                  {option.description}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.notice}>
            선택한 연령 구간은 이 기기에만 저장되며 설정에서 변경할 수 있어요.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!policy.canUseApp) {
    return (
      <SafeAreaView style={styles.centered} testID="under13-blocked-screen">
        <Text accessibilityRole="header" style={styles.title}>
          만 13세 이상부터 이용할 수 있어요
        </Text>
        <Text style={[styles.body, styles.centeredCopy]}>
          공구위시는 현재 만 13세 이상 이용자를 대상으로 제공됩니다.
        </Text>
        <Pressable
          accessibilityLabel="연령 구간 다시 선택"
          accessibilityRole="button"
          disabled={pending}
          onPress={() => void handleChangeSelection()}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
            pending && styles.disabled,
          ]}
          testID="change-age-selection"
        >
          <Text style={styles.primaryButtonText}>연령 구간 다시 선택</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  body: {
    color: "#4b5563",
    fontSize: 16,
    lineHeight: 24,
  },
  centered: {
    alignItems: "center",
    backgroundColor: "#fffaf8",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  centeredCopy: {
    marginTop: 12,
    textAlign: "center",
  },
  container: {
    backgroundColor: "#fffaf8",
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  disabled: {
    opacity: 0.55,
  },
  loadingText: {
    color: "#6b7280",
    fontSize: 14,
    marginTop: 12,
  },
  notice: {
    color: "#6b7280",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 18,
  },
  option: {
    backgroundColor: "#ffffff",
    borderColor: "#eadfdb",
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 72,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  optionDescription: {
    color: "#6b7280",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  optionLabel: {
    color: "#1f2937",
    fontSize: 17,
    fontWeight: "700",
  },
  optionList: {
    gap: 12,
    marginTop: 28,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#ff5a5f",
    borderRadius: 14,
    justifyContent: "center",
    marginTop: 28,
    minHeight: 50,
    paddingHorizontal: 22,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  title: {
    color: "#1f2937",
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 34,
    marginBottom: 12,
  },
});
