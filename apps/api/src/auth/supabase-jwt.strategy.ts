import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SupabaseService } from '../supabase/supabase.service';
import { ConfigService } from '@nestjs/config';

/**
 * Passport strategy that validates a Supabase JWT.
 *
 * This strategy decodes the JWT header to determine the algorithm:
 * - RS256 (default Supabase): Verifies using JWKS from Supabase Auth.
 * - HS256 (custom JWT secret): Verifies using the shared JWT_SECRET.
 *
 * Used alongside the existing NestJS JWT strategy during the
 * 7-day parallel window.
 */
@Injectable()
export class SupabaseJwtStrategy extends PassportStrategy(Strategy, 'supabase-jwt') {
  constructor(
    private readonly supabaseService: SupabaseService,
    configService: ConfigService,
  ) {
    const supabaseUrl = configService.get<string>('SUPABASE_URL')?.trim();
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL is required');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: (
        _request: any,
        rawJwtToken: string,
        done: (err: any, secretOrKey?: string) => void,
      ) => {
        try {
          // Decode header to determine algorithm
          const parts = rawJwtToken.split('.');
          if (parts.length !== 3) {
            return done(new Error('Invalid JWT format'));
          }
          const header = JSON.parse(
            Buffer.from(parts[0], 'base64url').toString('utf-8'),
          );

          if (header.alg === 'HS256') {
            // Custom JWT using shared secret
            const secret = configService.get<string>('JWT_SECRET');
            if (!secret) {
              return done(new Error('JWT_SECRET not configured'));
            }
            done(null, secret);
          } else if (header.alg === 'RS256') {
            // Standard Supabase JWT — fetch JWKS from Supabase Auth
            this.fetchJwkPublicKey(supabaseUrl, header.kid)
              .then((key) => {
                if (!key) {
                  return done(new Error('No matching JWK key found'));
                }
                done(null, key);
              })
              .catch(done);
          } else {
            done(new Error(`Unsupported JWT algorithm: ${header.alg}`));
          }
        } catch (err) {
          done(err);
        }
      },
      algorithms: ['RS256', 'HS256'],
      // JWT audience and issuer validation
      ...(configService.get<string>('SUPABASE_JWT_AUD')
        ? { aud: configService.get<string>('SUPABASE_JWT_AUD') }
        : {}),
      ...(configService.get<string>('SUPABASE_JWT_ISSUER')
        ? { issuer: configService.get<string>('SUPABASE_JWT_ISSUER') }
        : {}),
    });
  }

  async validate(payload: {
    sub: string;
    email?: string;
    role?: string;
    aud?: string;
    app_metadata?: Record<string, unknown>;
  }) {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid Supabase token: missing sub');
    }
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role ?? 'authenticated',
      aud: payload.aud ?? 'authenticated',
      authProvider: 'supabase',
    };
  }

  private async fetchJwkPublicKey(
    supabaseUrl: string,
    kid?: string,
  ): Promise<string | null> {
    try {
      const response = await fetch(
        `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      );
      if (!response.ok) {
        throw new Error(`JWKS fetch failed: ${response.statusText}`);
      }
      const jwks: { keys: Array<{ kid?: string; kty: string; n: string; e: string }> } =
        await response.json();

      // Find the matching key by kid, or use the first one
      const jwk = kid
        ? jwks.keys.find((k) => k.kid === kid)
        : jwks.keys[0];

      if (!jwk) return null;

      // Convert JWK to PEM public key using Node.js crypto
      const { publicKey } = await this.jwkToPem(jwk);
      return publicKey;
    } catch {
      return null;
    }
  }

  private async jwkToPem(jwk: {
    kty: string;
    n: string;
    e: string;
  }): Promise<{ publicKey: string }> {
    // Use Node.js built-in crypto to convert JWK → PEM
    const crypto = await import('node:crypto');
    const key = crypto.createPublicKey({
      key: jwk,
      format: 'jwk',
    });
    return { publicKey: key.export({ type: 'spki', format: 'pem' }) as string };
  }
}
