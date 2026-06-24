import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * Legacy NestJS JWT login (admin only).
   * Kept during the 7-day parallel window.
   */
  async login(email: string, password: string) {
    // 관리자 계정 확인 (환경 변수에서 설정된 관리자 계정과 비교)
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
    const adminPasswordHash = this.configService.get<string>('ADMIN_PASSWORD_HASH');

    if (!adminEmail || !adminPasswordHash) {
      throw new UnauthorizedException('Admin credentials not configured');
    }

    if (email !== adminEmail) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, adminPasswordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // JWT 토큰 생성 (NestJS legacy)
    const payload = { sub: 'admin', email: adminEmail, role: 'admin' };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: 'admin',
        email: adminEmail,
        role: 'admin',
        authProvider: 'nestjs',
      },
    };
  }

  /**
   * Supabase email/password sign-in.
   * Returns a Supabase JWT session for use with the Data API.
   */
  async signInWithEmail(email: string, password: string) {
    const { data, error } = await this.supabaseService.anon.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      throw new UnauthorizedException(
        `Supabase login failed: ${error?.message ?? 'No session'}`,
      );
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role ?? 'authenticated',
        authProvider: 'supabase',
      },
    };
  }

  /**
   * Sign up a new user via Supabase Auth.
   */
  async signUp(email: string, password: string) {
    const { data, error } = await this.supabaseService.anon.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw new BadRequestException(
        `Signup failed: ${error.message}`,
      );
    }

    return {
      user: data.user
        ? {
            id: data.user.id,
            email: data.user.email,
            role: data.user.role ?? 'authenticated',
          }
        : null,
      session: data.session
        ? {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
          }
        : null,
    };
  }

  /**
   * Refresh a Supabase session token.
   */
  async refreshSession(refreshToken: string) {
    const { data, error } = await this.supabaseService.anon.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      throw new UnauthorizedException(
        `Token refresh failed: ${error?.message ?? 'No session'}`,
      );
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };
  }

  /**
   * Validate any token (legacy NestJS JWT).
   */
  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      return { userId: payload.sub, email: payload.email, role: payload.role };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
