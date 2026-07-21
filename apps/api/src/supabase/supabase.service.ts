import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly adminClient: SupabaseClient;
  private readonly anonClient: SupabaseClient;
  private readonly supabaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL')?.trim();
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL is required');
    }
    this.supabaseUrl = supabaseUrl;
    const supabaseServiceKey =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey =
      this.configService.get<string>('SUPABASE_ANON_KEY') ?? '';

    // Admin client (service_role) — bypasses RLS, used for trusted operations
    this.adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Anon client (anon key) — respects RLS, used for public operations
    this.anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /** Admin client with service_role — bypasses RLS */
  get admin(): SupabaseClient {
    return this.adminClient;
  }

  /** Anon client — respects RLS, limited to public data */
  get anon(): SupabaseClient {
    return this.anonClient;
  }

  /**
   * Validate a Supabase JWT and return the user.
   * Uses supabase-js admin client to verify the token via Auth API.
   * Throws if token is invalid or expired.
   */
  async validateToken(token: string): Promise<{
    id: string;
    email: string | undefined;
    role: string;
    aud: string;
  }> {
    const { data, error } = await this.adminClient.auth.getUser(token);
    if (error || !data?.user) {
      throw new Error(`Supabase token validation failed: ${error?.message ?? 'No user'}`);
    }
    return {
      id: data.user.id,
      email: data.user.email ?? undefined,
      role: data.user.role ?? 'authenticated',
      aud: data.user.aud ?? 'authenticated',
    };
  }

  /**
   * Get the project reference ID.
   */
  get projectRef(): string {
    const match = this.supabaseUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/);
    if (!match) {
      throw new Error('SUPABASE_URL must use a Supabase project origin');
    }
    return match[1];
  }
}
