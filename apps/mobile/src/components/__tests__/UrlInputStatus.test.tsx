import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { colors } from '../../design/tokens';
import { Animated } from 'react-native';
import { UrlInputStatus } from '../UrlInputStatus';

vi.mock('../../context/ThemeContext', async () => {
  const tokens = await vi.importActual<typeof import('../../design/tokens')>('../../design/tokens');

  return {
    useTheme: () => ({
      colors: tokens.colors,
      shadows: tokens.shadows,
      isDark: false,
      themeMode: 'light',
      setThemeMode: vi.fn(),
      toggleTheme: vi.fn(),
      isRestoring: false,
    }),
  };
});

function flattenText(node: any): string {
  if (!node) return '';
  if (Array.isArray(node)) return node.map(flattenText).join(' ');
  const children = node.children || [];
  return children.map((c: any) =>
    typeof c === 'string' ? c : flattenText(c),
  ).join(' ');
}

function getAllByType(root: any, typeName: string) {
  return root.findAll((node: any) =>
    typeof node.type === 'string' && node.type === typeName,
  );
}

function renderStatus(status: 'idle' | 'loading' | 'success' | 'error') {
  let renderer: ReturnType<typeof TestRenderer.create>;
  act(function() {
    renderer = TestRenderer.create(
      React.createElement(UrlInputStatus, { status }),
    );
  });
  return renderer!;
}

describe('UrlInputStatus', function() {
  it('renders nothing for idle status', function() {
    const root = renderStatus('idle').toJSON();
    expect(root).toBeNull();
  });

  it('renders 3 pulsing dots for loading status', function() {
    const renderer = renderStatus('loading');
    const json = renderer.toJSON();
    expect(json).not.toBeNull();
    const dots = getAllByType(renderer.root, 'Animated.View');
    expect(dots).toHaveLength(3);
  });

  it('displays success checkmark icon', function() {
    const renderer = renderStatus('success');
    const text = flattenText(renderer.toJSON());
    expect(text).toContain('\u2713');
  });

  it('displays error X icon', function() {
    const renderer = renderStatus('error');
    const text = flattenText(renderer.toJSON());
    expect(text).toContain('\u2715');
  });

  it('renders success with icon text element', function() {
    const renderer = renderStatus('success');
    const json = renderer.toJSON();
    expect(json).not.toBeNull();
    const textElements = getAllByType(renderer.root, 'Text');
    expect(textElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders error with icon text element', function() {
    const renderer = renderStatus('error');
    const json = renderer.toJSON();
    expect(json).not.toBeNull();
    const textElements = getAllByType(renderer.root, 'Text');
    expect(textElements.length).toBeGreaterThanOrEqual(1);
  });

  it('starts the loading animation when status is loading', function() {
    const loopSpy = vi.spyOn(Animated, 'loop');

    act(function() {
      TestRenderer.create(
        React.createElement(UrlInputStatus, { status: 'loading' }),
      );
    });

    expect(loopSpy).toHaveBeenCalled();
    loopSpy.mockRestore();
  });

  it('uses correct tokens.ts colors for success and error icons', function() {
    // Verify success icon has backgroundColor === colors.primary
    const successRenderer = renderStatus('success');
    const successViews = getAllByType(successRenderer.root, 'View');
    const successIcon = successViews.find(function(v: any) {
      const style = v.props.style;
      return Array.isArray(style) && style.some(function(s: any) {
        return s && s.backgroundColor === colors.primary;
      });
    });
    expect(successIcon).toBeTruthy();

    // Verify error icon has backgroundColor === colors.error
    const errorRenderer = renderStatus('error');
    const errorViews = getAllByType(errorRenderer.root, 'View');
    const errorIcon = errorViews.find(function(v: any) {
      const style = v.props.style;
      return Array.isArray(style) && style.some(function(s: any) {
        return s && s.backgroundColor === colors.error;
      });
    });
    expect(errorIcon).toBeTruthy();
  });
});
