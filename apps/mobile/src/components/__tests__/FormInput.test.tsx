import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';

import { FormInput } from '../FormInput';

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

function renderFormInput(props: Record<string, any> = {}) {
  let renderer: ReturnType<typeof TestRenderer.create>;
  act(function() {
    renderer = TestRenderer.create(
      React.createElement(FormInput, {
        label: '테스트 필드',
        value: '',
        onChangeText: () => {},
        ...props,
      }),
    );
  });
  return renderer!;
}

describe('FormInput', function() {
  it('renders label and input', function() {
    const renderer = renderFormInput();
    const text = flattenText(renderer.toJSON());
    expect(text).toContain('테스트 필드');
  });

  it('displays error text when error prop is provided', function() {
    const renderer = renderFormInput({ error: '필수 입력 항목입니다.' });
    const text = flattenText(renderer.toJSON());
    expect(text).toContain('필수 입력 항목입니다.');
  });

  it('does not render error text when error prop is undefined', function() {
    const renderer = renderFormInput();
    const text = flattenText(renderer.toJSON());
    expect(text).not.toContain('undefined');
  });

  it('shows red border on the TextInput when error is present', function() {
    const renderer = renderFormInput({ error: '에러 메시지' });
    const textInputs = getAllByType(renderer.root, 'TextInput');
    expect(textInputs.length).toBe(1);
    const inputStyle = textInputs[0].props.style;
    const flatStyles = Array.isArray(inputStyle) ? inputStyle : [inputStyle];
    const hasErrorBorder = flatStyles.some((s: any) =>
      s && typeof s === 'object' && s.borderColor,
    );
    expect(hasErrorBorder).toBe(true);
  });
});
