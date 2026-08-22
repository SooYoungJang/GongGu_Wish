import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  type ListRenderItemInfo,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { CenteredBackHeader } from "../components/CenteredBackHeader";
import { AsyncStateNotice } from "../components/ui/AsyncStateNotice";
import { SText } from "../components/ui/SText";
import { commerceRadius, commerceSpacing } from "../design/commerce";
import { useCommerceTheme } from "../design/useCommerceTheme";
import {
  useGroupBuyRequestRankings,
  type GroupBuyRequestRanking,
} from "../features/groupBuyRequests";
import type { RootStackParamList } from "../types";

type GroupBuyRequestRankingsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "GroupBuyRequestRankings"
>;

const numberFormatter = new Intl.NumberFormat("ko-KR");

interface RankingRowProps {
  rank: number;
  productName: string;
  requestCount: number;
}

function RankingRowSeparator() {
  return <View style={separatorStyles.container} />;
}

function getRankingKey(item: GroupBuyRequestRanking) {
  return item.requestId;
}

const separatorStyles = StyleSheet.create({
  container: {
    height: commerceSpacing.sm,
  },
});

function RankingRow({ rank, productName, requestCount }: RankingRowProps) {
  const { colors } = useCommerceTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const formattedCount = numberFormatter.format(requestCount);

  return (
    <View
      accessible
      accessibilityLabel={`${rank}위 ${productName}, ${formattedCount}명 요청`}
      style={styles.row}
    >
      <View style={styles.rankBadge}>
        <SText style={styles.rankText} variant="label">
          {rank}
        </SText>
      </View>
      <View style={styles.rowCopy}>
        <SText numberOfLines={2} style={styles.productName} variant="cardTitle">
          {productName}
        </SText>
        <SText style={styles.requestCount} variant="body">
          {`${formattedCount}명이 요청했어요`}
        </SText>
      </View>
    </View>
  );
}

export function GroupBuyRequestRankingsScreen({
  navigation,
}: GroupBuyRequestRankingsScreenProps) {
  const { colors, isDark } = useCommerceTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data, isFetching, refetch, status } = useGroupBuyRequestRankings();
  const rankings = data ?? [];
  const handleBack = useCallback(() => navigation.goBack(), [navigation]);
  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);
  const renderRanking = useCallback(
    ({ item }: ListRenderItemInfo<GroupBuyRequestRanking>) => (
      <RankingRow
        productName={item.productName}
        rank={item.rank}
        requestCount={item.requestCount}
      />
    ),
    [],
  );

  const content = (() => {
    if (status === "pending") {
      return (
        <View style={styles.stateContainer} testID="request-ranking-loading">
          <ActivityIndicator color={colors.accent} size="small" />
          <SText style={styles.stateMessage} variant="body">
            공구 요청 순위를 불러오는 중이에요
          </SText>
        </View>
      );
    }

    if (status === "error") {
      return (
        <AsyncStateNotice
          isRetrying={isFetching}
          message="잠시 후 다시 시도해주세요."
          onRetry={refetch}
          testID="request-ranking-error-state"
          title="공구 요청 순위를 불러오지 못했어요"
          variant="error"
        />
      );
    }

    if (rankings.length === 0) {
      return (
        <AsyncStateNotice
          message="원하는 공구를 요청하면 다음 순위에 반영돼요."
          testID="request-ranking-empty-state"
          title="아직 공구 요청 순위가 없어요"
          variant="empty"
        />
      );
    }

    return (
      <FlatList<GroupBuyRequestRanking>
        contentContainerStyle={styles.listContent}
        data={rankings}
        keyExtractor={getRankingKey}
        onRefresh={handleRefresh}
        refreshing={isFetching}
        renderItem={renderRanking}
        ListHeaderComponent={
          <View style={styles.intro}>
            <SText style={styles.introTitle} variant="subtitle">
              지금 가장 많이 요청된 공구예요
            </SText>
            <SText style={styles.introMessage} variant="caption">
              요청이 모이면 공구가 시작될 가능성이 높아져요.
            </SText>
          </View>
        }
        ItemSeparatorComponent={RankingRowSeparator}
      />
    );
  })();

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <CenteredBackHeader onBack={handleBack} title="공구 요청 순위" />
      <View style={styles.content}>{content}</View>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useCommerceTheme>["colors"]) {
  return StyleSheet.create({
    screen: {
      backgroundColor: colors.bg,
      flex: 1,
    },
    content: {
      flex: 1,
    },
    listContent: {
      padding: commerceSpacing.screen,
      paddingBottom: commerceSpacing.xxl,
    },
    intro: {
      gap: 4,
      marginBottom: commerceSpacing.lg,
    },
    introTitle: {
      color: colors.text,
      fontWeight: "800",
    },
    introMessage: {
      color: colors.muted,
    },
    row: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.borderLight,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      minHeight: 82,
      padding: commerceSpacing.lg,
      borderRadius: commerceRadius.md,
    },
    rankBadge: {
      alignItems: "center",
      backgroundColor: colors.accentSoft,
      height: 36,
      justifyContent: "center",
      marginRight: 12,
      width: 36,
      borderRadius: commerceRadius.full,
    },
    rankText: {
      color: colors.accent,
      fontWeight: "900",
    },
    rowCopy: {
      flex: 1,
      gap: 4,
    },
    productName: {
      color: colors.text,
    },
    requestCount: {
      color: colors.muted,
    },
    stateContainer: {
      alignItems: "center",
      flex: 1,
      gap: 12,
      justifyContent: "center",
      padding: 24,
    },
    stateMessage: {
      color: colors.muted,
      textAlign: "center",
    },
  });
}
