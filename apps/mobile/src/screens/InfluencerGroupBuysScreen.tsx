import { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { fetchGroupBuysByInfluencer } from "../api";
import { CenteredBackHeader } from "../components/CenteredBackHeader";
import { DealCard } from "../components/DealCard";
import { categoryForGroupBuy } from "../components/home/DealCardGrid";
import { InstagramIdentity } from "../components/ui/InstagramIdentity";
import { SText } from "../components/ui/SText";
import { useCommerceTheme } from "../design/useCommerceTheme";
import type { InfluencerGroupBuysScreenProps } from "../types";

export function InfluencerGroupBuysScreen({
  navigation,
  route,
}: InfluencerGroupBuysScreenProps) {
  const { influencerUsername, influencerProfileImageUrl } = route.params;
  const normalizedUsername = influencerUsername.replace(/^@/, "");
  const theme = useCommerceTheme();
  const { colors } = theme;
  const s = useMemo(() => makeStyles(theme), [theme]);

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ["group-buys", "influencer", normalizedUsername],
    queryFn: () => fetchGroupBuysByInfluencer(normalizedUsername),
  });

  const groupBuys = data ?? [];
  const profileImageUrl =
    influencerProfileImageUrl ??
    groupBuys[0]?.rawPost.influencer.profileImageUrl ??
    null;

  return (
    <SafeAreaView edges={["top", "bottom"]} style={s.safeArea}>
      <View style={s.container}>
        <CenteredBackHeader
          backButtonTestID="influencer-group-buys-back-button"
          onBack={() => navigation.goBack()}
          testID="influencer-group-buys-header"
          title="인플루언서 공구"
        />

        <InstagramIdentity
          avatarTestID="influencer-group-buys-profile-avatar"
          profileImageUrl={profileImageUrl}
          size="title"
          style={s.profileRow}
          textStyle={s.titleIdentityText}
          username={normalizedUsername}
        />

        {isError ? (
          <View style={s.notice}>
            <SText variant="caption" style={s.noticeText}>
              네트워크 연결 상태를 확인해주세요. 공구 정보를 불러오지 못했어요.
            </SText>
          </View>
        ) : null}

        <FlatList
          columnWrapperStyle={s.cardRow}
          contentContainerStyle={s.listContent}
          data={groupBuys}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            isFetching ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <View style={s.emptyState}>
                <SText variant="cardTitle" style={s.emptyTitle}>
                  아직 표시할 공구가 없어요
                </SText>
                <SText variant="body" style={s.emptyDescription}>
                  이 인플루언서의 승인된 공동구매가 등록되면 여기에서 확인할 수
                  있습니다.
                </SText>
              </View>
            )
          }
          numColumns={2}
          refreshControl={
            <RefreshControl
              onRefresh={refetch}
              refreshing={isFetching}
              tintColor={colors.accent}
            />
          }
          renderItem={({ item, index }) => (
            <DealCard
              category={categoryForGroupBuy(item, index)}
              item={item}
              onPress={() => navigation.navigate("Detail", { groupBuy: item })}
              style={s.dealCard}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useCommerceTheme>) {
  const { colors, radius, spacing, typography } = theme;

  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.bg },
    container: { flex: 1, backgroundColor: colors.bg },
    profileRow: {
      paddingBottom: spacing.lg,
      paddingHorizontal: spacing.screen,
      paddingTop: spacing.sm,
    },
    titleIdentityText: typography.pageTitle,
    notice: {
      backgroundColor: colors.warningSoft,
      borderCurve: "continuous",
      borderRadius: radius.lg,
      marginBottom: spacing.lg,
      marginHorizontal: spacing.screen,
      padding: spacing.md,
    },
    noticeText: { color: colors.warning, textAlign: "center" },
    listContent: {
      flexGrow: 1,
      gap: spacing.cardGap,
      paddingBottom: spacing.xxl,
      paddingHorizontal: spacing.screen,
    },
    cardRow: { gap: spacing.cardGap },
    dealCard: { flexGrow: 0 },
    emptyState: {
      alignItems: "center",
      backgroundColor: colors.panelBg,
      borderColor: colors.border,
      borderCurve: "continuous",
      borderRadius: radius.xl,
      borderWidth: 1,
      padding: spacing.xxl,
    },
    emptyTitle: { marginBottom: spacing.xs, textAlign: "center" },
    emptyDescription: { textAlign: "center" },
  });
}
