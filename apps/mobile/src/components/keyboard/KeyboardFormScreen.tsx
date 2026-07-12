import { ReactNode, useCallback, useEffect, useState } from 'react';
import {
  Keyboard,
  type LayoutChangeEvent,
  type ScrollViewProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from 'react-native-keyboard-controller';

type KeyboardFormScreenProps = {
  children: ReactNode;
  footer?: ReactNode;
  showFooterWhenKeyboardVisible?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  refreshControl?: ScrollViewProps['refreshControl'];
  stickyHeaderIndices?: ScrollViewProps['stickyHeaderIndices'];
  bottomOffset?: number;
  testID?: string;
};

export function KeyboardFormScreen({
  children,
  footer,
  showFooterWhenKeyboardVisible = false,
  contentContainerStyle,
  style,
  keyboardShouldPersistTaps = 'handled',
  refreshControl,
  stickyHeaderIndices,
  bottomOffset = 16,
  testID,
}: KeyboardFormScreenProps) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
  const needsKeyboardVisibility = Boolean(footer) && showFooterWhenKeyboardVisible;

  useEffect(() => {
    if (!needsKeyboardVisibility) return undefined;

    const setVisibleIfChanged = (nextVisible: boolean) => {
      setKeyboardVisible((current) => (current === nextVisible ? current : nextVisible));
    };

    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setVisibleIfChanged(true);
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setVisibleIfChanged(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [needsKeyboardVisibility]);

  const handleFooterLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    setFooterHeight((current) => (Math.abs(current - nextHeight) < 1 ? current : nextHeight));
  }, []);

  const shouldShowStickyFooter =
    Boolean(footer) && (!showFooterWhenKeyboardVisible || keyboardVisible);

  return (
    <View style={[styles.root, style]} testID={testID}>
      <KeyboardAwareScrollView
        bottomOffset={footerHeight + bottomOffset}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        refreshControl={refreshControl}
        stickyHeaderIndices={stickyHeaderIndices}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          shouldShowStickyFooter && styles.contentWithStickyFooter,
          contentContainerStyle,
        ]}
      >
        {children}
      </KeyboardAwareScrollView>

      {footer ? (
        <KeyboardStickyView enabled={shouldShowStickyFooter}>
          {shouldShowStickyFooter ? (
            <View
              style={[
                styles.footer,
              ]}
              onLayout={handleFooterLayout}
            >
              {footer}
            </View>
          ) : null}
        </KeyboardStickyView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  contentWithStickyFooter: {
    paddingBottom: 24,
  },
  footer: {
    // Padding/background are owned by the footer content itself so the
    // wrapper only measures layout height without double-applying insets.
  },
});
