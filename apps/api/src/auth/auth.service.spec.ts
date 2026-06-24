import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { AuthService } from './auth.service';
import { SupabaseService } from '../supabase/supabase.service';

// ─── Mocks ─────────────────────────────────────────────────────────────────

function createSupabaseMock() {
  const signInWithPassword = jest.fn();
  const signUp = jest.fn();
  const refreshSession = jest.fn();
  const getUser = jest.fn();

  return {
    anon: {
      auth: { signInWithPassword, signUp, refreshSession },
    },
    admin: {
      auth: { getUser },
    },
    validateToken: jest.fn(),
    projectRef: 'test-project',
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let supabaseMock: ReturnType<typeof createSupabaseMock>;
  let configService: ConfigService;

  const mockAdminEmail = 'admin@gonggu.app';
  const mockPasswordHash = bcrypt.hashSync('testPassword123', 10);

  beforeEach(async () => {
    supabaseMock = createSupabaseMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-nest-jwt-token'),
            verify: jest.fn().mockReturnValue({
              sub: 'admin',
              email: mockAdminEmail,
              role: 'admin',
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'ADMIN_EMAIL':
                  return mockAdminEmail;
                case 'ADMIN_PASSWORD_HASH':
                  return mockPasswordHash;
                case 'JWT_EXPIRES_IN':
                  return '24h';
                default:
                  return undefined;
              }
            }),
          },
        },
        {
          provide: SupabaseService,
          useValue: supabaseMock,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  // ─── Legacy login ──────────────────────────────────────────────────────

  describe('login (legacy NestJS JWT)', () => {
    it('should return JWT for valid admin credentials', async () => {
      const result = await service.login(mockAdminEmail, 'testPassword123');

      expect(result.accessToken).toBe('mock-nest-jwt-token');
      expect(result.user).toEqual({
        id: 'admin',
        email: mockAdminEmail,
        role: 'admin',
        authProvider: 'nestjs',
      });
    });

    it('should throw for wrong email', async () => {
      await expect(
        service.login('wrong@email.com', 'testPassword123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for wrong password', async () => {
      await expect(
        service.login(mockAdminEmail, 'wrongPassword'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when admin credentials not configured', async () => {
      const badConfig = new ConfigService({});
      const badService = new AuthService(
        jwtService,
        badConfig,
        supabaseMock as any,
      );

      // Create a new instance without ADMIN_EMAIL causing config.get to return undefined
      jest.spyOn(badConfig, 'get').mockReturnValue(undefined);

      await expect(
        badService.login(mockAdminEmail, 'testPassword123'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── Supabase signIn ───────────────────────────────────────────────────

  describe('signInWithEmail (Supabase)', () => {
    it('should return session on successful login', async () => {
      supabaseMock.anon.auth.signInWithPassword.mockResolvedValue({
        data: {
          session: {
            access_token: 'supabase-jwt',
            refresh_token: 'refresh-token',
          },
          user: {
            id: 'user-uuid',
            email: 'user@example.com',
            role: 'authenticated',
          },
        },
        error: null,
      });

      const result = await service.signInWithEmail(
        'user@example.com',
        'password123',
      );

      expect(result.accessToken).toBe('supabase-jwt');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user).toEqual({
        id: 'user-uuid',
        email: 'user@example.com',
        role: 'authenticated',
        authProvider: 'supabase',
      });
    });

    it('should throw on failed login', async () => {
      supabaseMock.anon.auth.signInWithPassword.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Invalid login credentials' },
      });

      await expect(
        service.signInWithEmail('user@example.com', 'wrong'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── Supabase signUp ───────────────────────────────────────────────────

  describe('signUp', () => {
    it('should create a new user', async () => {
      supabaseMock.anon.auth.signUp.mockResolvedValue({
        data: {
          user: {
            id: 'new-user-uuid',
            email: 'newuser@example.com',
            role: 'authenticated',
          },
          session: {
            access_token: 'new-session-jwt',
            refresh_token: 'new-refresh-token',
          },
        },
        error: null,
      });

      const result = await service.signUp(
        'newuser@example.com',
        'password123',
      );

      expect(result.user).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.user!.email).toBe('newuser@example.com');
    });

    it('should throw on signup failure', async () => {
      supabaseMock.anon.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' },
      });

      await expect(
        service.signUp('existing@example.com', 'password123'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── Token refresh ─────────────────────────────────────────────────────

  describe('refreshSession', () => {
    it('should refresh a valid session', async () => {
      supabaseMock.anon.auth.refreshSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'new-jwt',
            refresh_token: 'new-refresh',
          },
        },
        error: null,
      });

      const result = await service.refreshSession('valid-refresh-token');
      expect(result.accessToken).toBe('new-jwt');
      expect(result.refreshToken).toBe('new-refresh');
    });

    it('should throw on invalid refresh token', async () => {
      supabaseMock.anon.auth.refreshSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid refresh token' },
      });

      await expect(
        service.refreshSession('bad-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── Legacy token validation ───────────────────────────────────────────

  describe('validateToken', () => {
    it('should return payload for valid token', async () => {
      const result = await service.validateToken('valid-jwt');
      expect(result).toEqual({
        userId: 'admin',
        email: mockAdminEmail,
        role: 'admin',
      });
    });

    it('should throw for invalid token', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('jwt malformed');
      });

      await expect(service.validateToken('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
