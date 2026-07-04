import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { fetchGroupBuyById } from '../api';
import { AppButton } from '../components/AppButton';
import { SText } from '../components/ui/SText';
import { spacing } from '../design/tokens';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';
import type { FeedDetailScreenProps } from '../types';
import { DetailScreen } from './DetailScreen';

function LoadingView({ s, colors }: { s: ReturnType<typeof makeStyles>; colors: ColorPalette }) {
  return (
    <SafeAreaView edges={['bottom', 'top']} style={s.safeArea}>
      <View style={s.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    </SafeAreaView>
  );
}

function ErrorView({ s, navigation }: { s: ReturnType<typeof makeStyles>; navigation: FeedDetailScreenProps['navigation'] }) {
  return (
    <SafeAreaView edges={['bottom', 'top']} style={s.safeArea}>
      <View style={s.centered}>
        <SText variant="subtitle" style={s.errorText}>
          피드를 불러올 수 없습니다.
        </SText>
        <AppButton variant="secondary" onPress={() => navigation.goBack()}>
          뒤로 가기
        </AppButton>
      </View>
    </SafeAreaView>
  );
}

export function FeedDetailScreen({ route, navigation }: FeedDetailScreenProps) {
  const { feedId } = route.params;
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const { data: groupBuy, isLoading, isError } = useQuery({
    queryKey: ['group-buy', feedId],
    queryFn: () => fetchGroupBuyById(feedId),
  });

  if (isLoading) return <LoadingView s={s} colors={colors} />;
  if (isError || !groupBuy) return <ErrorView s={s} navigation={navigation} />;

  return (
    <DetailScreen
      route={{
        key: route.key,
        name: 'Detail',
        params: { groupBuy },
      } as FeedDetailScreenProps['route'] & { name: 'Detail' }}
      navigation={navigation as any}
    />
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.bg },
    centered: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      padding: spacing['2xl'],
    },
    errorText: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: spacing.lg },
  });
}
