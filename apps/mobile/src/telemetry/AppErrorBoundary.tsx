import { Component, type PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { telemetry } from "./telemetry";

// Plain native components also work when a theme/auth provider itself fails.
export class AppErrorBoundary extends Component<PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) {
    telemetry.record("js_error", null, error);
    void telemetry.flush();
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>화면을 불러오지 못했어요</Text>
      <Text style={styles.body}>다시 시도해 주세요. 계속 문제가 생기면 앱을 닫았다가 다시 열어 주세요.</Text>
      <Pressable accessibilityRole="button" onPress={() => this.setState({ failed: false })} style={styles.button}>
        <Text style={styles.label}>다시 시도</Text>
      </Pressable>
    </View>;
  }
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", backgroundColor: "#FFFFFF", padding: 32, gap: 20 },
  title: { fontSize: 22, fontWeight: "700", color: "#191919" },
  body: { fontSize: 16, lineHeight: 24, color: "#444444" },
  button: { minHeight: 48, backgroundColor: "#222222", borderRadius: 12, justifyContent: "center", alignItems: "center", padding: 12 },
  label: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
});
