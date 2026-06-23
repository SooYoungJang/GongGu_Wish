import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';

import { UrlInputStatus } from '../UrlInputStatus';

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
    // Loading renders 3 Animated.View dots (= View with mock) inside a container
    const views = getAllByType(renderer.root, 'View');
    // 1 container + 3 dot Animated.View = 4 View elements
    expect(views.length).toBeGreaterThanOrEqual(3);
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
});
