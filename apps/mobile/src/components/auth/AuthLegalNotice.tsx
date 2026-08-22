import { useCallback, useMemo } from "react";
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { type CommerceColorPalette } from "../../design/commerce";
import { useCommerceTheme } from "../../design/useCommerceTheme";
import {
  DEFAULT_PRIVACY_POLICY_URL,
  DEFAULT_TERMS_OF_SERVICE_URL,
  resolveAppInfo,
} from "../../lib/app-info";

const LEGAL_DOCUMENTS = resolveAppInfo({
  privacyPolicyUrl:
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL?.trim() ||
    DEFAULT_PRIVACY_POLICY_URL,
  termsOfServiceUrl:
    process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL?.trim() ||
    DEFAULT_TERMS_OF_SERVICE_URL,
});

export function AuthLegalNotice() {
  const { colors } = useCommerceTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const openDocument = useCallback(async (url: string | null) => {
    if (!url) {
      Alert.alert("문서를 열 수 없어요", "잠시 후 다시 시도해주세요.");
      return;
    }

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("문서를 열 수 없어요", "잠시 후 다시 시도해주세요.");
    }
  }, []);

  return (
    <View
      accessibilityLabel="인증 약관 안내"
      style={styles.container}
      testID="auth-legal-notice"
    >
      <Text style={styles.copy}>
        계속하면 만 14세 이상이며, 서비스 이용약관·커뮤니티 이용규칙에 동의하고
        개인정보처리방침을 확인한 것으로 봅니다.
      </Text>
      <View style={styles.links}>
        <Pressable
          accessible
          accessibilityLabel="서비스 이용약관 열기"
          accessibilityRole="link"
          hitSlop={4}
          onPress={() => void openDocument(LEGAL_DOCUMENTS.termsOfServiceUrl)}
          style={styles.linkTarget}
        >
          <Text style={styles.link}>서비스 이용약관</Text>
        </Pressable>
        <Pressable
          accessible
          accessibilityLabel="개인정보처리방침 열기"
          accessibilityRole="link"
          hitSlop={4}
          onPress={() => void openDocument(LEGAL_DOCUMENTS.privacyPolicyUrl)}
          style={styles.linkTarget}
        >
          <Text style={styles.link}>개인정보처리방침</Text>
        </Pressable>
      </View>
      <Text style={styles.support}>커뮤니티 문의 · tturrr10@gmail.com</Text>
    </View>
  );
}

const makeStyles = (colors: CommerceColorPalette) =>
  StyleSheet.create({
    container: {
      alignItems: "center",
      paddingHorizontal: 4,
    },
    copy: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18,
      textAlign: "center",
    },
    support: {
      color: colors.muted,
      fontSize: 11,
      lineHeight: 16,
      textAlign: "center",
    },
    link: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 18,
      textDecorationLine: "underline",
    },
    linkTarget: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 2,
    },
    links: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      justifyContent: "center",
    },
  });
