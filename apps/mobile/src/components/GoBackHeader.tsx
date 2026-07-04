import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '../design/tokens';
import { useCommerceTheme } from '../design/useCommerceTheme';

interface GoBackHeaderProps {
  accessibilityLabel?: string;
  onPress?: () => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export function GoBackHeader({
  accessibilityLabel = '뒤로가기',
  onPress,
  color,
  style,
}: GoBackHeaderProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useCommerceTheme();
  const iconColor = color ?? colors.text;

  const handlePress = onPress ?? (() => navigation.goBack());

  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        { top: insets.top + spacing.xs, left: spacing.xs },
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.icon, { color: iconColor }]}>←</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    width: 44,
    zIndex: 10,
  },
  pressed: {
    opacity: 0.7,
  },
  icon: {
    fontSize: 30,
    fontWeight: '500',
    lineHeight: 36,
  },
});
