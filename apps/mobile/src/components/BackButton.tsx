import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useCommerceTheme } from '../design/useCommerceTheme';

export interface BackButtonProps {
  accessibilityLabel?: string;
  color?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Shared back control for stack screens and custom screen headers.
 * Parents own placement; the button keeps the settings header's transparent
 * surface and 44pt touch target wherever it is embedded.
 */
export function BackButton({
  accessibilityLabel = '뒤로가기',
  color,
  onPress,
  style,
  testID = 'back-button',
}: BackButtonProps) {
  const navigation = useNavigation();
  const { colors } = useCommerceTheme();
  const handlePress = onPress ?? (() => navigation.goBack());

  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={handlePress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
      testID={testID}
    >
      <Text style={[styles.icon, { color: color ?? colors.text }]}>←</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    height: 44,
    justifyContent: 'center',
    width: 44,
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
