import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import * as apiModule from '../../api';
import { ApiError } from '../../api';
import { SubmitScreen } from '../SubmitScreen';

// ─── Mocks (must be before imports — vitest hoists them) ────────────────────

vi.mock('../../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api')>();
  return {
    postPublicJson: vi.fn(),
    lookupInstagramUrl: vi.fn(),
    ApiError: actual.ApiError,
  };
});

vi.mock('expo-secure-store', () => ({
  default: {
    getItemAsync: vi.fn(),
    setItemAsync: vi.fn(),
    deleteItemAsync: vi.fn(),
  },
}));

vi.mock('@gonggu/shared/hooks', () => ({
  useSubmissionGuard: () => ({ isDispatched: false, guard: () => true, reset: vi.fn() }),
}));

vi.mock('react-native-safe-area-context', () => {
  const ReactMock = require('react');
  return {
    SafeAreaView: function(props: { children?: React.ReactNode; [key: string]: any }) { return ReactMock.createElement('SafeAreaView', props, props.children); },
    useSafeAreaInsets: function() { return { top: 0, right: 0, bottom: 24, left: 0 }; },
  };
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function flattenText(node: any): string {
  if (!node) return '';
  if (Array.isArray(node)) return node.map(flattenText).join(' ');
  var children = node.children || [];
  return children.map(function(c: any) {
    return typeof c === 'string' ? c : flattenText(c);
  }).join(' ');
}

function getAllByType(root: any, typeName: string) {
  return root.findAll(function(node: any) {
    return typeof node.type === 'string' && node.type === typeName;
  });
}

function renderSubmit(props?: Record<string, any>) {
  const opts = props || {};
  const navigation = opts.navigation || { navigate: vi.fn(), goBack: vi.fn() };
  const route = opts.route || { params: {}, key: 'Submit', name: 'Submit' };
  let renderer: ReturnType<typeof TestRenderer.create>;
  act(function() {
    renderer = TestRenderer.create(
      React.createElement(SubmitScreen, { navigation: navigation, route: route }),
    );
  });
  return renderer!;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SubmitScreen', function() {
  beforeEach(function() {
    vi.clearAllMocks();
  });

  it('renders the form header text', function() {
    var renderer = renderSubmit();
    var text = flattenText(renderer.toJSON());
    expect(text).toContain('공구 제보하기');
    expect(text).toContain('발견한 공구를 알려주세요');
    expect(text).toContain('인스타그램 게시물 URL만 입력하면 이미지와 정보를 자동으로 불러옵니다');
  });

  it('renders required Instagram URL label', function() {
    var renderer = renderSubmit();
    var text = flattenText(renderer.toJSON());
    expect(text).toContain('인스타그램 게시물 URL');
    expect(text).toContain('필수');
  });

  it('renders additional info section', function() {
    var renderer = renderSubmit();
    var text = flattenText(renderer.toJSON());
    expect(text).toContain('추가 정보');
  });

  it('renders submit and cancel buttons', function() {
    var renderer = renderSubmit();
    var text = flattenText(renderer.toJSON());
    expect(text).toContain('공구 제보하기');
    expect(text).toContain('취소하고 돌아가기');
  });

  it('renders TextInput for Instagram URL with correct placeholder', function() {
    var renderer = renderSubmit();
    var textInputs = getAllByType(renderer.root, 'TextInput');
    expect(textInputs.length).toBeGreaterThanOrEqual(1);
    expect(textInputs[0].props.placeholder).toBe('https://www.instagram.com/p/...');
  });

  it('shows validation error when Instagram URL is too short', function() {
    var renderer = renderSubmit();
    var textInputs = getAllByType(renderer.root, 'TextInput');
    var urlInput = textInputs[0];

    act(function() {
      urlInput.props.onChangeText('ab');
    });

    var pressables = getAllByType(renderer.root, 'Pressable');
    for (var i = 0; i < pressables.length; i++) {
      if (typeof pressables[i].props.onPress === 'function') {
        act(function() {
          pressables[i].props.onPress();
        });
        break;
      }
    }

    var text = flattenText(renderer.toJSON());
    expect(text).toContain('인스타그램 게시물 URL을 입력해주세요');
  });

  it('shows validation error for invalid URL format', function() {
    var renderer = renderSubmit();
    var textInputs = getAllByType(renderer.root, 'TextInput');
    var urlInput = textInputs[0];

    act(function() {
      urlInput.props.onChangeText('abcde');
    });

    var pressables = getAllByType(renderer.root, 'Pressable');
    for (var i = 0; i < pressables.length; i++) {
      if (typeof pressables[i].props.onPress === 'function') {
        act(function() {
          pressables[i].props.onPress();
        });
        break;
      }
    }

    var text = flattenText(renderer.toJSON());
    expect(text).toContain('인스타그램 URL 형식이 올바르지 않습니다');
  });

  it('shows validation error when product name is empty', function() {
    var renderer = renderSubmit();
    var textInputs = getAllByType(renderer.root, 'TextInput');

    act(function() {
      textInputs[0].props.onChangeText('https://www.instagram.com/p/ABC123/');
    });

    var pressables = getAllByType(renderer.root, 'Pressable');
    for (var i = 0; i < pressables.length; i++) {
      if (typeof pressables[i].props.onPress === 'function') {
        act(function() {
          pressables[i].props.onPress();
        });
        break;
      }
    }

    var text = flattenText(renderer.toJSON());
    expect(text).toContain('제품명은 2자 이상 필수입니다');
  });

  it('calls postPublicJson on valid submit', function() {
    vi.mocked(apiModule.postPublicJson).mockResolvedValue({ id: 'abc-123' });

    var renderer = renderSubmit();
    var textInputs = getAllByType(renderer.root, 'TextInput');

    act(function() {
      textInputs[0].props.onChangeText('https://www.instagram.com/p/ABC123/');
    });
    act(function() {
      textInputs[1].props.onChangeText('Test Product');
    });

    var pressables = getAllByType(renderer.root, 'Pressable');
    for (var i = 0; i < pressables.length; i++) {
      if (typeof pressables[i].props.onPress === 'function') {
        act(function() {
          pressables[i].props.onPress();
        });
        break;
      }
    }

    expect(apiModule.postPublicJson).toHaveBeenCalledWith('/submissions', expect.objectContaining({
      instagramUrl: 'https://www.instagram.com/p/ABC123/',
      productName: 'Test Product',
    }));
  });

  it('shows success feedback after successful submit', async function() {
    vi.mocked(apiModule.postPublicJson).mockResolvedValue({ id: 'abc-123' });

    var renderer = renderSubmit();
    var textInputs = getAllByType(renderer.root, 'TextInput');

    act(function() {
      textInputs[0].props.onChangeText('https://www.instagram.com/p/ABC123/');
    });
    act(function() {
      textInputs[1].props.onChangeText('Test Product');
    });

    var pressables = getAllByType(renderer.root, 'Pressable');
    for (var i = 0; i < pressables.length; i++) {
      if (typeof pressables[i].props.onPress === 'function') {
        act(function() {
          pressables[i].props.onPress();
        });
        break;
      }
    }

    // Flush microtasks so the async handleSubmit completes
    await act(async function() {
      await new Promise(function(resolve) { setTimeout(resolve, 0); });
    });

    var text = flattenText(renderer.toJSON());
    expect(text).toContain('제보가 접수되었습니다');
  });

  it('shows submitting text while in progress', function() {
    vi.mocked(apiModule.postPublicJson).mockReturnValue(new Promise(function() {}));

    var renderer = renderSubmit();
    var textInputs = getAllByType(renderer.root, 'TextInput');

    act(function() {
      textInputs[0].props.onChangeText('https://www.instagram.com/p/ABC123/');
    });
    act(function() {
      textInputs[1].props.onChangeText('Test Product');
    });

    var pressables = getAllByType(renderer.root, 'Pressable');
    for (var i = 0; i < pressables.length; i++) {
      if (typeof pressables[i].props.onPress === 'function') {
        act(function() {
          pressables[i].props.onPress();
        });
        break;
      }
    }

    var text = flattenText(renderer.toJSON());
    expect(text).toContain('제출 중');
  });

  // ─── Error handling tests ─────────────────────────────────────────

  it('shows rate limit message on 429 error', async function() {
    vi.mocked(apiModule.postPublicJson).mockRejectedValue(
      new ApiError(429, 'Too Many Requests'),
    );

    var renderer = renderSubmit();
    var textInputs = getAllByType(renderer.root, 'TextInput');

    act(function() {
      textInputs[0].props.onChangeText('https://www.instagram.com/p/ABC123/');
    });
    act(function() {
      textInputs[1].props.onChangeText('Test Product');
    });

    var pressables = getAllByType(renderer.root, 'Pressable');
    for (var i = 0; i < pressables.length; i++) {
      if (typeof pressables[i].props.onPress === 'function') {
        act(function() {
          pressables[i].props.onPress();
        });
        break;
      }
    }

    // Flush microtasks
    await act(async function() {
      await new Promise(function(resolve) { setTimeout(resolve, 0); });
    });

    var text = flattenText(renderer.toJSON());
    expect(text).toContain('잠시 후 다시 시도해주세요');
  });

  it('shows network error message on network failure', async function() {
    vi.mocked(apiModule.postPublicJson).mockRejectedValue(
      new ApiError(0, '네트워크 연결을 확인해주세요.'),
    );

    var renderer = renderSubmit();
    var textInputs = getAllByType(renderer.root, 'TextInput');

    act(function() {
      textInputs[0].props.onChangeText('https://www.instagram.com/p/ABC123/');
    });
    act(function() {
      textInputs[1].props.onChangeText('Test Product');
    });

    var pressables = getAllByType(renderer.root, 'Pressable');
    for (var i = 0; i < pressables.length; i++) {
      if (typeof pressables[i].props.onPress === 'function') {
        act(function() {
          pressables[i].props.onPress();
        });
        break;
      }
    }

    await act(async function() {
      await new Promise(function(resolve) { setTimeout(resolve, 0); });
    });

    var text = flattenText(renderer.toJSON());
    expect(text).toContain('네트워크 연결을 확인해주세요');
  });

  it('shows validation error message on 400 with field errors', async function() {
    vi.mocked(apiModule.postPublicJson).mockRejectedValue(
      new ApiError(400, '유효성 검증 실패', [
        { field: 'productName', message: '제품명은 2자 이상 입력해주세요.', code: 'too_small' },
      ]),
    );

    var renderer = renderSubmit();
    var textInputs = getAllByType(renderer.root, 'TextInput');

    act(function() {
      textInputs[0].props.onChangeText('https://www.instagram.com/p/ABC123/');
    });
    act(function() {
      textInputs[1].props.onChangeText('Valid Product');
    });

    var pressables = getAllByType(renderer.root, 'Pressable');
    for (var i = 0; i < pressables.length; i++) {
      if (typeof pressables[i].props.onPress === 'function') {
        act(function() {
          pressables[i].props.onPress();
        });
        break;
      }
    }

    await act(async function() {
      await new Promise(function(resolve) { setTimeout(resolve, 0); });
    });

    var text = flattenText(renderer.toJSON());
    expect(text).toContain('제품명은 2자 이상 입력해주세요');
  });

  it('disables button and shows spinner while submitting', function() {
    vi.mocked(apiModule.postPublicJson).mockReturnValue(new Promise(function() {}));

    var renderer = renderSubmit();
    var textInputs = getAllByType(renderer.root, 'TextInput');

    act(function() {
      textInputs[0].props.onChangeText('https://www.instagram.com/p/ABC123/');
    });
    act(function() {
      textInputs[1].props.onChangeText('Test Product');
    });

    var pressables = getAllByType(renderer.root, 'Pressable');
    for (var i = 0; i < pressables.length; i++) {
      if (typeof pressables[i].props.onPress === 'function') {
        act(function() {
          pressables[i].props.onPress();
        });
        break;
      }
    }

    // Check button is disabled
    var submitPressable = getAllByType(renderer.root, 'Pressable');
    var foundSubmit = false;
    for (var i = 0; i < submitPressable.length; i++) {
      var p = submitPressable[i];
      if (p.props.disabled === true) {
        foundSubmit = true;
        break;
      }
    }
    expect(foundSubmit).toBe(true);

    // Check ActivityIndicator is rendered
    var indicators = getAllByType(renderer.root, 'ActivityIndicator');
    expect(indicators.length).toBeGreaterThanOrEqual(1);
  });
});
