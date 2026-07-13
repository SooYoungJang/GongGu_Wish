import { useEffect } from 'react';

export type TabReselectNavigation = {
  addListener: (...args: ['tabPress', () => void]) => () => void;
  isFocused: () => boolean;
};

/** Runs a callback only when the already-focused tab is pressed again. */
export function useTabReselect(
  navigation: TabReselectNavigation,
  onReselect: () => void,
) {
  useEffect(() => {
    if (
      typeof navigation.addListener !== 'function' ||
      typeof navigation.isFocused !== 'function'
    ) {
      return undefined;
    }

    const unsubscribe = navigation.addListener('tabPress', () => {
      if (navigation.isFocused()) onReselect();
    });

    return unsubscribe;
  }, [navigation, onReselect]);
}
