import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { Pressable, Text } from 'react-native';

import { BackButton } from '../BackButton';
import { ThemeProvider } from '../../context/ThemeContext';

describe('BackButton', () => {
  it('exposes one settings-style, accessible back control', () => {
    const onPress = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <BackButton onPress={onPress} />
        </ThemeProvider>,
      );
    });

    const button = renderer!.root.findByType(Pressable);
    const icon = renderer!.root.findByType(Text);
    const style = button.props.style({ pressed: false });

    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('뒤로가기');
    expect(button.props.testID).toBe('back-button');
    expect(style[0]).toMatchObject({
      height: 44,
      width: 44,
      backgroundColor: 'transparent',
    });
    expect(icon.props.children).toBe('←');

    act(() => {
      button.props.onPress();
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
