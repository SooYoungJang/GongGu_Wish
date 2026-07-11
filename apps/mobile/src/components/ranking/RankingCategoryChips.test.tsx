import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { RankingCategoryChips } from './RankingCategoryChips';
import { ThemeProvider } from '../../context/ThemeContext';
import { RANKING_CATEGORIES, RANKING_CATEGORY_LABELS } from '../../features/ranking/types';

vi.mock('react-native', () => {
  const ReactMock = require('react');
  const passthrough =
    (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement(type, props, children);

  return {
    Modal: ({ children, visible, ...props }: { children?: React.ReactNode; visible?: boolean }) =>
      visible ? ReactMock.createElement('Modal', props, children) : null,
    Pressable: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement('Pressable', props, children),
    ScrollView: passthrough('ScrollView'),
    StyleSheet: { create: (styles: unknown) => styles },
    Text: passthrough('Text'),
    View: passthrough('View'),
    useColorScheme: () => 'light',
  };
});

function withTheme(ui: React.ReactElement) {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

function flattenText(node: TestRenderer.ReactTestRendererJSON | TestRenderer.ReactTestRendererJSON[] | null): string {
  if (!node) return '';
  if (Array.isArray(node)) return node.map(flattenText).join(' ');
  return node.children?.map((child) => (typeof child === 'string' ? child : flattenText(child))).join(' ') ?? '';
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flattenStyle));
  return style && typeof style === 'object' ? (style as Record<string, unknown>) : {};
}

describe('RankingCategoryChips', () => {
  it('keeps sort controls visible and collapses categories into a picker', () => {
    const onChange = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(
          <RankingCategoryChips
            value="all"
            categories={RANKING_CATEGORIES}
            sort="popular"
            onChange={onChange}
            onChangeSort={vi.fn()}
          />,
        ),
      );
    });

    const initialText = flattenText(renderer!.toJSON()).replace(/\s+/g, ' ');
    expect(initialText).toContain('카테고리 전체');
    expect(initialText).toContain('급상승');
    expect(renderer!.root.findAllByType('Modal' as unknown as React.ElementType)).toHaveLength(0);

    const trigger = renderer!.root.findByProps({
      accessibilityLabel: '카테고리 전체 선택',
    });
    act(() => trigger.props.onPress());

    expect(renderer!.root.findAllByType('Modal' as unknown as React.ElementType)).toHaveLength(1);
    expect(flattenText(renderer!.toJSON())).toContain('카테고리 선택');

    const beautyOption = renderer!.root.findByProps({
      accessibilityLabel: '뷰티 카테고리',
    });
    act(() => beautyOption.props.onPress());

    expect(onChange).toHaveBeenCalledWith('beauty');
    expect(renderer!.root.findAllByType('Modal' as unknown as React.ElementType)).toHaveLength(0);
  });

  it('shows only the selected category name and keeps the trigger compact', () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(
          <RankingCategoryChips
            value="sports"
            categories={RANKING_CATEGORIES}
            sort="popular"
            onChange={vi.fn()}
            onChangeSort={vi.fn()}
          />,
        ),
      );
    });

    const text = flattenText(renderer!.toJSON()).replace(/\s+/g, ' ');
    const trigger = renderer!.root.findByProps({
      accessibilityLabel: '스포츠 선택',
    });
    const triggerStyle = flattenStyle(trigger.props.style({ pressed: false }));

    expect(text).toContain('스포츠');
    expect(text).not.toContain('카테고리 스포츠');
    expect(RANKING_CATEGORY_LABELS.baby).toBe('육아');
    expect(triggerStyle.minHeight).toBeLessThanOrEqual(38);
  });

  it('renders sort and category controls as independent filter layers', () => {
    let sortRenderer: TestRenderer.ReactTestRenderer;
    let categoryRenderer: TestRenderer.ReactTestRenderer;

    act(() => {
      sortRenderer = TestRenderer.create(
        withTheme(
          <RankingCategoryChips
            mode="sort"
            value="all"
            categories={RANKING_CATEGORIES}
            sort="popular"
            onChange={vi.fn()}
            onChangeSort={vi.fn()}
          />,
        ),
      );
      categoryRenderer = TestRenderer.create(
        withTheme(
          <RankingCategoryChips
            mode="category"
            value="all"
            categories={RANKING_CATEGORIES}
            sort="popular"
            onChange={vi.fn()}
            onChangeSort={vi.fn()}
          />,
        ),
      );
    });

    const sortText = flattenText(sortRenderer!.toJSON()).replace(/\s+/g, ' ');
    const categoryText = flattenText(categoryRenderer!.toJSON()).replace(/\s+/g, ' ');

    expect(sortText).toContain('급상승');
    expect(sortText).not.toContain('카테고리 전체');
    expect(categoryText).toContain('카테고리 전체');
    expect(categoryText).not.toContain('급상승');
  });
});
