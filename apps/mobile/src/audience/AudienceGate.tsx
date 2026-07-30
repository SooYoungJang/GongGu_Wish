import { ActivityIndicator, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAudience } from "./AudienceContext";

export function AudienceGate({ children }: { children: React.ReactNode }) {
  const { isHydrated } = useAudience();

  if (!isHydrated) {
    return (
      <SafeAreaView style={styles.centered} testID="audience-loading">
        <ActivityIndicator color="#ff5a5f" size="small" />
        <Text style={styles.loadingText}>이용 설정을 확인하고 있어요.</Text>
      </SafeAreaView>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    backgroundColor: "#fffaf8",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  loadingText: {
    color: "#6b7280",
    fontSize: 14,
    marginTop: 12,
  },
});
