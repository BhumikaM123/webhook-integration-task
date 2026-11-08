import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { JwtClaims } from './types';

export interface AuthenticatedRequest extends Request { user: JwtClaims; }

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required');
    try {
      const claims = await this.jwt.verifyAsync<JwtClaims>(auth.slice(7));
      if (!claims.tenant_id || !claims.investor_id) throw new UnauthorizedException('Required JWT claims missing');
      request.user = claims;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired JWT');
    }
  }
}
