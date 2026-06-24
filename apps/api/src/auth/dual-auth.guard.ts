import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Dual authentication guard that accepts EITHER:
 * - NestJS JWT (from the existing passport-jwt strategy), OR
 * - Supabase JWT (from the supabase-jwt strategy)
 *
 * This enables the 7-day parallel window where both auth systems
 * operate simultaneously. After the window closes, remove the
 * fallback to `jwt` strategy.
 */
@Injectable()
export class DualAuthGuard extends AuthGuard(['jwt', 'supabase-jwt']) {
  handleRequest<TUser = any>(err: any, user: any, info: any, context: ExecutionContext): TUser {
    // If either strategy succeeded, allow the request
    if (user) {
      return user;
    }

    // Both strategies failed — provide a helpful error
    if (info) {
      const messages: string[] = [];
      if (Array.isArray(info)) {
        for (const i of info) {
          if (i?.message) messages.push(i.message);
        }
      } else if (info?.message) {
        messages.push(info.message);
      }

      if (messages.length > 0) {
        throw new UnauthorizedException(
          `Authentication failed: ${messages.join('; ')}`,
        );
      }
    }

    throw err || new UnauthorizedException('Authentication required');
  }
}
