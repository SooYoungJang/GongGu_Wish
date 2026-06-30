import { ReactNode, useEffect, useState } from 'react';
import {
  Keyboard,
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
  bottomOffset = 16,
  testID,
}: KeyboardFormScreenProps) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const shouldShowStickyFooter =
    Boolean(footer) && (!showFooterWhenKeyboardVisible || keyboardVisible);

  return (
    <View style={[styles.root, style]} testID={testID}>
      <KeyboardAwareScrollView
        bottomOffset={footerHeight + bottomOffset}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
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
              onLayout={(event) => {
                setFooterHeight(event.nativeEvent.layout.height);
              }}
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
