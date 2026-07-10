import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { extractBearerToken } from './index.ts';

Deno.test('extractBearerToken accepts a case-insensitive Bearer header', () => {
  assertEquals(extractBearerToken('bearer access-token'), 'access-token');
});

Deno.test('extractBearerToken rejects missing or malformed headers', () => {
  assertEquals(extractBearerToken(null), null);
  assertEquals(extractBearerToken('Basic access-token'), null);
  assertEquals(extractBearerToken('Bearer'), null);
});
