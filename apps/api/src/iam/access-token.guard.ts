import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { REQUIRED_PERMISSIONS, REQUIRED_ROLES } from './roles.decorator';
import { MFA_REQUIRED_ROLES, ROLE_PERMISSIONS, RoleName } from './roles';
import { TokenService, AccessTokenClaims } from './token.service';
import { RedisSecurityService } from './redis-security.service';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly reflector: Reflector,
    private readonly redis: RedisSecurityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: { authorization?: string }; user?: AccessTokenClaims }>();
    const token = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new UnauthorizedException('Bearer access token is required');
    const claims = this.tokens.verifyAccessToken(token);
    if (claims.sid && (await this.redis.isDenylisted(`session:${claims.sid}`))) {
      throw new UnauthorizedException('Session has been revoked');
    }
    const roles = claims.roles as RoleName[];
    const requiredRoles =
      this.reflector.getAllAndOverride<RoleName[]>(REQUIRED_ROLES, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (requiredRoles.length && !requiredRoles.some((role) => roles.includes(role)))
      throw new UnauthorizedException('Required role is missing');
    if (MFA_REQUIRED_ROLES.some((role) => roles.includes(role)) && !claims.mfa)
      throw new UnauthorizedException('Multi-factor authentication is required');
    const permissions = new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role] ?? []));
    if (requiredPermissions.some((permission) => !permissions.has(permission)))
      throw new UnauthorizedException('Required permission is missing');
    request.user = claims;
    return true;
  }
}
