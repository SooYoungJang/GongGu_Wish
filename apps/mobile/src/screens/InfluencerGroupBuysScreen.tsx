import { useMemo } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { fetchGroupBuysByInfluencer } from '../api';
import { AlertCard } from '../components/AlertCard';
import { AppButton } from '../components/AppButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SText } from '../components/ui/SText';
import { spacing } from '../design/tokens';
import { commerceRadius } from '../design/commerce';
import type { InfluencerGroupBuysScreenProps } from '../types';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';

export function InfluencerGroupBuysScreen({ navigation, route }: InfluencerGroupBuysScreenProps) {
  const { influencerUsername, influencerDisplayName } = route.params;
  const normalizedUsername = influencerUsername.replace(/^@/, '');
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ['group-buys', 'influencer', normalizedUsername],
    queryFn: () => fetchGroupBuysByInfluencer(normalizedUsername),
    retry: false,
  });

  const groupBuys = data ?? [];

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.safeArea}>
      <View style={s.container}>
        <ScreenHeader
          eyebrow="Influencer GongGu"
          title={`@${normalizedUsername}`}
          subtitle={influencerDisplayName ? `${influencerDisplayName}의 공동구매 목록` : '인플루언서 공동구매 목록'}
        >
          <AppButton onPress={() => navigation.goBack()} variant="secondary" style={s.backButton}>
            검색으로 돌아가기
          </AppButton>
        </ScreenHeader>

        {isError ? (
          <View style={s.notice}>
            <SText variant="caption" style={{ color: colors.noticeText, textAlign: 'center' }}>네트워크 연결 상태를 확인해주세요. 공구 정보를 불러오지 못했어요.</SText>
          </View>
        ) : null}

        <FlatList
          contentContainerStyle={s.listContent}
          data={groupBuys}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            isFetching ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <View style={s.emptyState}>
                <SText variant="cardTitle" style={{ marginBottom: spacing.xs, textAlign: 'center' }}>아직 표시할 공구가 없어요</SText>
                <SText variant="body" style={{ textAlign: 'center' }}>이 인플루언서의 승인된 공동구매가 등록되면 여기에서 확인할 수 있습니다.</SText>
              </View>
            )
          }
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <AlertCard item={item} onPress={() => navigation.navigate('Detail', { groupBuy: item })} />
          )}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.bg },
    container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
    backButton: { alignSelf: 'flex-start', marginTop: 0, paddingHorizontal: spacing.lg, paddingVertical: 10 },
    notice: {
      backgroundColor: colors.warningSoft,
      borderRadius: commerceRadius.lg,
      marginBottom: spacing.lg,
      padding: spacing.md,
    },
    listContent: { flexGrow: 1, paddingBottom: 122 },
    emptyState: {
      alignItems: 'center',
      backgroundColor: colors.panelBg,
      borderColor: colors.border,
      borderRadius: commerceRadius.xl,
      borderWidth: 1,
      marginTop: spacing.md,
      padding: spacing['2xl'],
    },
  });
}
