import { useCallback, useMemo } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useInfiniteQuery } from "@tanstack/react-query";
import { CenteredBackHeader } from "../components/CenteredBackHeader";
import { AsyncStateNotice } from "../components/ui/AsyncStateNotice";
import { SText } from "../components/ui/SText";
import { useAuth } from "../context/AuthContext";
import { useCommerceTheme } from "../design/useCommerceTheme";
import { fetchMyGroupBuyRequests, type MyRequestCursor } from "../features/groupBuyRequests/myRequestsApi";
import type { RootStackParamList } from "../types";

const statusLabels = { OPEN: "진행 중", FULFILLED: "요청 완료", HIDDEN: "접수 종료" };

export function MyGroupBuyRequestsScreen({ navigation }: NativeStackScreenProps<RootStackParamList, "MyGroupBuyRequests">) {
  const { user, isLoading } = useAuth();
  const { colors } = useCommerceTheme();
  const styles = useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 20, gap: 12, flexGrow: 1 },
    row: { padding: 16, gap: 8, borderRadius: 12, backgroundColor: colors.surface, borderColor: colors.borderLight, borderWidth: StyleSheet.hairlineWidth },
    text: { color: colors.text },
    muted: { color: colors.muted },
    action: { minHeight: 48, justifyContent: "center", alignItems: "center" },
  }), [colors]);
  const requests = useInfiniteQuery({
    queryKey: ["my-group-buy-requests", user?.id ?? null],
    queryFn: ({ pageParam }) => fetchMyGroupBuyRequests(user!.id, pageParam),
    initialPageParam: null as MyRequestCursor | null,
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: Boolean(user),
    gcTime: 0,
  });
  const { refetch } = requests;
  useFocusEffect(useCallback(() => { if (user) void refetch(); }, [user?.id, refetch]));
  const items = requests.data?.pages.flatMap(page => page.items) ?? [];
  const retry = () => requests.isFetchNextPageError ? requests.fetchNextPage() : requests.refetch();
  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
      <CenteredBackHeader title="내 공구 요청" onBack={() => navigation.goBack()} />
      {isLoading ? <ActivityIndicator color={colors.accent} /> : !user ? (
        <AsyncStateNotice variant="empty" title="로그인 후 요청을 확인할 수 있어요" message="계정에 연결된 공구 요청을 모아서 보여드려요." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.content}
          refreshing={requests.isRefetching && !requests.isFetchingNextPage}
          onRefresh={() => { void requests.refetch(); }}
          onEndReached={() => { if (requests.hasNextPage && !requests.isFetching && !requests.isFetchNextPageError) void requests.fetchNextPage(); }}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={<SText variant="caption" style={styles.muted}>계정에 연결된 요청만 표시돼요. 같은 기기의 최근 30일 비회원 요청은 로그인 후 다시 요청하면 연결돼요.</SText>}
          renderItem={({ item }) => <View style={styles.row}>
            <SText variant="cardTitle" style={styles.text}>{item.productName}</SText>
            <SText variant="label" style={styles.text}>{statusLabels[item.status]}</SText>
            <SText variant="caption" style={styles.muted}>{new Date(item.requestedAt).toLocaleDateString("ko-KR")} 요청</SText>
          </View>}
          ListEmptyComponent={requests.isPending ? <ActivityIndicator color={colors.accent} /> : !requests.isError ? <AsyncStateNotice variant="empty" title="아직 연결된 요청이 없어요" message="원하는 상품을 공구 요청으로 남겨보세요." /> : null}
          ListFooterComponent={requests.isError ? <AsyncStateNotice variant="error" title="요청을 불러오지 못했어요" message="연결 상태를 확인하고 다시 시도해주세요." onRetry={retry} isRetrying={requests.isFetching} /> : requests.isFetchingNextPage ? <ActivityIndicator color={colors.accent} /> : requests.hasNextPage ? <Pressable accessibilityRole="button" style={styles.action} onPress={() => { if (!requests.isFetching) void requests.fetchNextPage(); }}><SText variant="label" style={styles.text}>더 보기</SText></Pressable> : null}
        />
      )}
    </SafeAreaView>
  );
}
