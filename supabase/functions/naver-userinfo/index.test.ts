import {
  assert,
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  createHandler,
  normalizeNaverUserInfo,
} from './index.ts';

Deno.test('normalizeNaverUserInfo maps the nested Naver profile to standard claims', () => {
  const result = normalizeNaverUserInfo({
    resultcode: '00',
    message: 'success',
    response: {
      id: 'naver-user-id',
      email: 'unverified@example.com',
      nickname: 'wish-user',
      name: '홍길동',
      profile_image: 'https://example.com/profile.png',
    },
  });

  assertEquals(result, {
    sub: 'naver-user-id',
    name: '홍길동',
    nickname: 'wish-user',
    preferred_username: 'wish-user',
    picture: 'https://example.com/profile.png',
  });
  assert(result && !('email' in result));
  assert(result && !('email_verified' in result));
});

Deno.test('normalizeNaverUserInfo rejects unsuccessful or identifier-less responses', () => {
  assertEquals(
    normalizeNaverUserInfo({ resultcode: '01', response: { id: 'user' } }),
    null,
  );
  assertEquals(
    normalizeNaverUserInfo({ resultcode: '00', response: {} }),
    null,
  );
});

Deno.test('naver userinfo rejects requests without a bearer token before calling Naver', async () => {
  let fetchCalled = false;
  const fetchMock: typeof fetch = () => {
    fetchCalled = true;
    throw new Error('fetch should not be called');
  };

  const response = await createHandler(fetchMock)(
    new Request('https://example.test/functions/v1/naver-userinfo'),
  );

  assertEquals(response.status, 401);
  assertEquals(await response.json(), { error: 'Unauthorized' });
  assertEquals(fetchCalled, false);
});

Deno.test('naver userinfo forwards the token only to Naver and returns normalized claims', async () => {
  let requestedUrl = '';
  let authorization = '';
  let redirectPolicy: RequestRedirect | undefined;
  const fetchMock: typeof fetch = (input, init) => {
    requestedUrl = String(input);
    authorization = new Headers(init?.headers).get('authorization') ?? '';
    redirectPolicy = init?.redirect;
    return Promise.resolve(
      Response.json({
        resultcode: '00',
        message: 'success',
        response: {
          id: 'naver-user-id',
          email: 'unverified@example.com',
          nickname: 'wish-user',
        },
      }),
    );
  };

  const response = await createHandler(fetchMock)(
    new Request('https://example.test/functions/v1/naver-userinfo', {
      headers: { authorization: 'Bearer naver-access-token' },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(requestedUrl, 'https://openapi.naver.com/v1/nid/me');
  assertEquals(authorization, 'Bearer naver-access-token');
  assertEquals(redirectPolicy, 'error');
  assertEquals(await response.json(), {
    sub: 'naver-user-id',
    name: 'wish-user',
    nickname: 'wish-user',
    preferred_username: 'wish-user',
  });
  assertEquals(response.headers.get('cache-control'), 'no-store');
});

Deno.test('naver userinfo does not expose upstream authentication errors', async () => {
  const fetchMock: typeof fetch = () =>
    Promise.resolve(
      new Response('upstream body containing sensitive details', { status: 401 }),
    );

  const response = await createHandler(fetchMock)(
    new Request('https://example.test/functions/v1/naver-userinfo', {
      headers: { authorization: 'Bearer naver-access-token' },
    }),
  );

  assertEquals(response.status, 401);
  assertEquals(await response.json(), { error: 'Unauthorized' });
});
