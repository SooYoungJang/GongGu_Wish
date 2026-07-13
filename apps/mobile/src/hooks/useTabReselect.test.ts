import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { useTabReselect, type TabReselectNavigation } from './useTabReselect';

function createNavigation() {
  let listener: (() => void) | undefined;
  let focused = true;

  const navigation: TabReselectNavigation & {
    emitTabPress: () => void;
    setFocused: (nextFocused: boolean) => void;
  } = {
    addListener: vi.fn((...args: ['tabPress', () => void]) => {
      listener = args[1];
      return vi.fn();
    }),
    isFocused: () => focused,
    emitTabPress: () => listener?.(),
    setFocused: (nextFocused) => {
      focused = nextFocused;
    },
  };

  return navigation;
}

function Harness({
  navigation,
  onReselect,
}: {
  navigation: TabReselectNavigation;
  onReselect: () => void;
}) {
  useTabReselect(navigation, onReselect);
  return null;
}

describe('useTabReselect', () => {
  it('runs only when the currently focused tab is pressed again', () => {
    const navigation = createNavigation();
    const onReselect = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        React.createElement(Harness, { navigation, onReselect }),
      );
    });

    act(() => navigation.emitTabPress());
    expect(onReselect).toHaveBeenCalledTimes(1);

    act(() => {
      navigation.setFocused(false);
      navigation.emitTabPress();
    });
    expect(onReselect).toHaveBeenCalledTimes(1);

    renderer!.unmount();
    expect(navigation.addListener).toHaveBeenCalledWith(
      'tabPress',
      expect.any(Function),
    );
  });
});
