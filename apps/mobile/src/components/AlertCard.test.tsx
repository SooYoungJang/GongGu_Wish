import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { AlertCard } from './AlertCard';
import { ThemeProvider } from '../context/ThemeContext';
import type { GroupBuy } from '../types';

vi.mock('react-native', () => {
  const ReactMock = require('react');
  return {
    Pressable: ({ children, onPress, style, testID }: { children: React.ReactNode; onPress?: () => void; style?: unknown; testID?: string }) =>
      ReactMock.createElement('Pressable', { onPress, style, testID }, children),
    StyleSheet: { create: (styles: unknown) => styles },
    Text: ({ children, ...props }: { children: React.ReactNode }) => ReactMock.createElement('Text', props, children),
    View: ({ children, ...props }: { children: React.ReactNode }) => ReactMock.createElement('View', props, children),
    useColorScheme: () => 'light',
  };
});

const sampleGroupBuy: GroupBuy = {
  id: 'sample-alert',
  productName: '비건 선크림 공구',
  brandName: 'Sample Beauty',
  endDate: '2099-06-15T23:59:59+09:00',
  purchaseUrl: 'https://example.com',
  discountInfo: '20% 할인',
  summary: '공동구매 알림 요약입니다.',
  confidence: 0.82,
  rawPost: {
    postUrl: 'https://www.instagram.com/p/sample',
    influencer: {
      instagramUsername: 'sample_influencer',
    },
  },
};

function flattenText(node: TestRenderer.ReactTestRendererJSON | TestRenderer.ReactTestRendererJSON[] | null): string {
  if (!node) return '';
  if (Array.isArray(node)) return node.map(flattenText).join(' ');
  return node.children
    ?.map((child) => (typeof child === 'string' ? child : flattenText(child)))
    .join(' ') ?? '';
}

describe('AlertCard', () => {
  it('renders influencer, product, deadline, confidence, and time signal at a glance', () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <AlertCard item={sampleGroupBuy} onPress={vi.fn()} />
        </ThemeProvider>,
      );
    });

    const text = flattenText(renderer!.toJSON());
    const compactText = text.replace(/\s+/g, '');

    expect(compactText).toContain('@sample_influencer');
    expect(text).toContain('비건 선크림 공구');
    expect(text).toContain('Sample Beauty');
    expect(text).toContain('20% 할인');
    expect(text).toContain('마감');
    expect(text).toContain('신뢰도');
    expect(compactText).toContain('82%');
    expect(text).toContain('시간 정보');
    expect(text).not.toContain('♡');
    expect(text).not.toContain('💬');
    expect(text).not.toContain('↗');
  });

  it('keeps the whole alert card pressable', () => {
    const onPress = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <AlertCard item={sampleGroupBuy} onPress={onPress} />
        </ThemeProvider>,
      );
    });

    const pressable = renderer!.root.findByType('Pressable' as unknown as React.ElementType);
    act(() => pressable.props.onPress());

    expect(pressable.props.testID).toBe('alert-card-sample-alert');
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
