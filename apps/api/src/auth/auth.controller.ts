import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

import { AuthService } from './auth.service';
import { DualAuthGuard } from './dual-auth.guard';

// ─── DTOs ───────────────────────────────────────────────────────────────────

class LoginDto {
  @ApiProperty({ example: 'admin@gonggu.app', description: '관리자 이메일' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'securePassword123', description: '비밀번호 (최소 8자)' })
  @IsString()
  @MinLength(8)
  password!: string;
}

class SignUpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'securePassword123' })
  @IsString()
  @MinLength(8)
  password!: string;
}

class RefreshDto {
  @ApiProperty({ description: 'Supabase refresh token' })
  @IsString()
  refreshToken!: string;
}

// ─── Controller ─────────────────────────────────────────────────────────────

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * LEGACY: NestJS JWT login (admin only).
   * Kept during 7-day parallel window.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[LEGACY] 관리자 로그인 (NestJS JWT)' })
  @ApiResponse({ status: 200, description: '로그인 성공' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  /**
   * Supabase email/password sign-in.
   * Returns a Supabase JWT for use with Data API and RLS.
   */
  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supabase 이메일 로그인' })
  @ApiResponse({ status: 200, description: '로그인 성공 (Supabase JWT)' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async signIn(@Body() dto: LoginDto) {
    return this.authService.signInWithEmail(dto.email, dto.password);
  }

  /**
   * Sign up a new user via Supabase Auth.
   */
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Supabase 회원가입' })
  @ApiResponse({ status: 201, description: '회원가입 성공' })
  @ApiResponse({ status: 400, description: '회원가입 실패' })
  async signUp(@Body() dto: SignUpDto) {
    return this.authService.signUp(dto.email, dto.password);
  }

  /**
   * Refresh a Supabase session token.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supabase 토큰 갱신' })
  @ApiResponse({ status: 200, description: '토큰 갱신 성공' })
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refreshSession(dto.refreshToken);
  }

  /**
   * Get the current user's profile from their JWT.
   * Requires a valid NestJS JWT or Supabase JWT.
   */
  @Post('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(DualAuthGuard)
  @ApiOperation({ summary: '현재 사용자 정보 (Supabase or NestJS JWT)' })
  @ApiResponse({ status: 200, description: '사용자 정보' })
  @ApiResponse({ status: 401, description: '인증 필요' })
  async me(@Request() req: any) {
    return {
      user: req.user,
    };
  }
}
