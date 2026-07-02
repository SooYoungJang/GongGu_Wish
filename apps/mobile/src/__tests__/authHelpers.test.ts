import { describe, expect, it } from 'vitest';

import { getSocialProvidersForPlatform } from '../utils/authHelpers';

describe('authHelpers', () => {
  it('Android에서는 카카오와 네이버 로그인만 노출한다', () => {
    const providers = getSocialProvidersForPlatform('android').map((item) => item.provider);

    expect(providers).toEqual(['kakao', 'custom:naver']);
  });

  it('iOS에서는 카카오, 네이버, Apple 로그인을 노출한다', () => {
    const providers = getSocialProvidersForPlatform('ios').map((item) => item.provider);

    expect(providers).toEqual(['kakao', 'custom:naver', 'apple']);
  });
});
