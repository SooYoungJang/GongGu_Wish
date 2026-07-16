import { describe, expect, it, vi } from 'vitest';
import { configureSupabase, getSupabase } from '../lib/supabase';

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(() => ({ auth: {} })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

describe('Supabase client', () => {
  it('throws when accessed before configure', () => {
    expect(() => getSupabase()).toThrow(
      'Supabase client not configured',
    );
  });

  it('configures auth against the requested local Supabase origin', () => {
    const client = configureSupabase('test-anon-key', 'http://10.0.2.2:54321/');
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
    expect(createClientMock).toHaveBeenCalledWith(
      'http://10.0.2.2:54321',
      'test-anon-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          persistSession: true,
          autoRefreshToken: true,
        }),
      }),
    );
  });

  it('returns singleton on second configure call', () => {
    const client1 = configureSupabase('test-anon-key');
    const client2 = configureSupabase('test-another-key');
    expect(client1).toBe(client2);
  });
});
