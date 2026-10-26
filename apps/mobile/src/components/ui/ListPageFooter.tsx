import { ActivityIndicator, Pressable, View } from "react-native";
import { useCommerceTheme } from "../../design/useCommerceTheme";
import { AsyncStateNotice } from "./AsyncStateNotice";
import { SText } from "./SText";

export type ListPagination = {
  hasMore: boolean;
  isLoading: boolean;
  isError: boolean;
  onLoadMore: () => void;
};

export function ListPageFooter({ pagination, label = "더 보기" }: { pagination?: ListPagination; label?: string }) {
  const { colors, spacing } = useCommerceTheme();
  if (!pagination || (!pagination.hasMore && !pagination.isError)) return null;
  return (
    <View style={{ padding: spacing.md }}>
      {pagination.isLoading ? (
        <ActivityIndicator accessibilityLabel="다음 목록 불러오는 중" color={colors.accent} />
      ) : pagination.isError ? (
        <AsyncStateNotice
          compact
          onRetry={pagination.onLoadMore}
          title="다음 목록을 불러오지 못했어요"
          message="지금 보던 목록은 유지됩니다. 다시 시도해 주세요."
          variant="error"
        />
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={pagination.onLoadMore}>
          <SText variant="button" style={{ color: colors.accent, textAlign: "center" }}>{label}</SText>
        </Pressable>
      )}
    </View>
  );
}
