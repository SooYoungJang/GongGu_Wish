import { ConfigService } from '@nestjs/config';

import { SupabaseJwtStrategy } from '../auth/supabase-jwt.strategy';
import { SupabaseService } from './supabase.service';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: { getUser: jest.fn() },
  })),
}));

describe('SupabaseService configuration', () => {
  it('fails closed when SUPABASE_URL is missing', () => {
    const configService = new ConfigService({
      SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    });

    expect(() => new SupabaseService(configService)).toThrow(/SUPABASE_URL/);
  });

  it('derives the project ref only from the configured Supabase origin', () => {
    const configService = new ConfigService({
      SUPABASE_URL: 'https://xwblovggtvbpiusjfokq.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    });

    expect(new SupabaseService(configService).projectRef).toBe(
      'xwblovggtvbpiusjfokq',
    );
  });

  it('fails closed before configuring JWT verification without SUPABASE_URL', () => {
    const configService = new ConfigService({ JWT_SECRET: 'test-secret' });

    expect(
      () =>
        new SupabaseJwtStrategy(
          {} as SupabaseService,
          configService,
        ),
    ).toThrow(/SUPABASE_URL/);
  });
});
