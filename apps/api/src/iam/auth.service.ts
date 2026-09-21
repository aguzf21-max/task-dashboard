import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { TenantScopedDataSource } from '../database/tenant-scoped-data-source.service';
import { TenantIdentity } from '../tenancy/tenant-context';
import { AuditService } from './audit.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { MFA_REQUIRED_ROLES } from './roles';
import { RedisSecurityService } from './redis-security.service';

interface UserRow {
  id: string;
  password_hash: string;
  is_active: boolean;
  roles: string[];
}
@Injectable()
export class AuthService {
  constructor(
    private readonly scoped: TenantScopedDataSource,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly redis: RedisSecurityService,
  ) {}

  async login(
    tenant: TenantIdentity,
    email: string,
    password: string,
    ipAddress: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.scoped.withTenant(tenant.id, async (manager) => {
      await this.redis.limit(`auth:login:${ipAddress}`, 5, 900);
      const rows = await manager.query<UserRow[]>(
        `SELECT u.id, u.password_hash, u.is_active, coalesce(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') roles
         FROM iam.users u LEFT JOIN iam.user_roles ur ON ur.user_id = u.id AND ur.tenant_id = u.tenant_id
         LEFT JOIN iam.roles r ON r.id = ur.role_id WHERE u.tenant_id = $1 AND u.email = $2 GROUP BY u.id`,
        [tenant.id, email],
      );
      const user = rows[0];
      if (!user || !user.is_active || !(await this.passwords.verify(user.password_hash, password)))
        throw new UnauthorizedException('Invalid credentials');
      if (
        user.roles.some((role) =>
          MFA_REQUIRED_ROLES.includes(role as (typeof MFA_REQUIRED_ROLES)[number]),
        )
      ) {
        const totp = await manager.query<{ enabled_at: Date | null }[]>(
          'SELECT enabled_at FROM iam.totp_secrets WHERE tenant_id = $1 AND user_id = $2',
          [tenant.id, user.id],
        );
        if (!totp[0]?.enabled_at) {
          await this.audit.write(manager, tenant.id, {
            actorUserId: user.id,
            eventType: 'auth.mfa_enrollment_required',
            entityType: 'user',
            entityId: user.id,
          });
          throw new UnauthorizedException('Multi-factor enrollment is required');
        }
      }
      const refreshToken = this.tokens.createRefreshToken();
      const hash = await this.passwords.hash(refreshToken);
      const expiresAt = new Date(
        Date.now() + this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS') * 86_400_000,
      );
      const session = await manager.query<{ id: string; family_id: string }[]>(
        `INSERT INTO iam.sessions (tenant_id, user_id, expires_at) VALUES ($1,$2,$3) RETURNING id, family_id`,
        [tenant.id, user.id, expiresAt],
      );
      await manager.query(
        `INSERT INTO iam.refresh_tokens (tenant_id, session_id, token_hash, expires_at) VALUES ($1,$2,$3,$4)`,
        [tenant.id, session[0].id, hash, expiresAt],
      );
      await this.audit.write(manager, tenant.id, {
        actorUserId: user.id,
        eventType: 'auth.login',
        entityType: 'session',
        entityId: session[0].id,
      });
      return {
        accessToken: this.tokens.issueAccessToken({
          sub: user.id,
          tenantId: tenant.id,
          roles: user.roles,
          mfa: false,
          sid: session[0].id,
        }),
        refreshToken,
      };
    });
  }

  async logout(tenant: TenantIdentity, sessionId: string, actorUserId?: string): Promise<void> {
    await this.scoped.withTenant(tenant.id, async (manager) => {
      await manager.query(
        `UPDATE iam.sessions SET revoked_at = now(), revoke_reason = 'logout' WHERE tenant_id = $1 AND id = $2`,
        [tenant.id, sessionId],
      );
      await this.redis.denylist(
        `session:${sessionId}`,
        this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS') * 86_400,
      );
      await manager.query(
        `UPDATE iam.refresh_tokens SET revoked_at = now() WHERE tenant_id = $1 AND session_id = $2`,
        [tenant.id, sessionId],
      );
      await this.audit.write(manager, tenant.id, {
        actorUserId,
        eventType: 'auth.logout',
        entityType: 'session',
        entityId: sessionId,
      });
    });
  }

  async rotateRefreshToken(
    tenant: TenantIdentity,
    rawToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.scoped.withTenant(tenant.id, async (manager) => {
      const rows = await manager.query<
        Array<{
          id: string;
          session_id: string;
          token_hash: string;
          used_at: Date | null;
          revoked_at: Date | null;
          expires_at: Date;
          family_id: string;
          user_id: string;
          roles: string[];
        }>
      >(
        `SELECT rt.id, rt.session_id, rt.token_hash, rt.used_at, rt.revoked_at, rt.expires_at, s.family_id, s.user_id,
         coalesce(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') roles
         FROM iam.refresh_tokens rt JOIN iam.sessions s ON s.id = rt.session_id
         LEFT JOIN iam.user_roles ur ON ur.user_id = s.user_id AND ur.tenant_id = s.tenant_id
         LEFT JOIN iam.roles r ON r.id = ur.role_id WHERE rt.tenant_id = $1 GROUP BY rt.id, s.id`,
        [tenant.id],
      );
      const token = (
        await Promise.all(
          rows.map(async (candidate) =>
            (await this.passwords.verify(candidate.token_hash, rawToken)) ? candidate : undefined,
          ),
        )
      ).find(Boolean);
      if (!token) throw new UnauthorizedException('Invalid refresh token');
      await this.redis.limit(`auth:refresh:${token.user_id}`, 10, 60);
      if (token.used_at || token.revoked_at || new Date(token.expires_at) <= new Date()) {
        await manager.query(
          `UPDATE iam.sessions SET revoked_at = now(), revoke_reason = 'refresh_token_reuse' WHERE tenant_id = $1 AND family_id = $2`,
          [tenant.id, token.family_id],
        );
        await this.redis.denylist(
          `session-family:${token.family_id}`,
          this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS') * 86_400,
        );
        await manager.query(
          `UPDATE iam.refresh_tokens SET revoked_at = now() WHERE tenant_id = $1 AND session_id IN (SELECT id FROM iam.sessions WHERE tenant_id = $1 AND family_id = $2)`,
          [tenant.id, token.family_id],
        );
        await this.audit.write(manager, tenant.id, {
          actorUserId: token.user_id,
          eventType: 'auth.refresh_reuse_detected',
          entityType: 'session',
          entityId: token.session_id,
        });
        throw new UnauthorizedException('Refresh token reuse detected; session family revoked');
      }
      const next = this.tokens.createRefreshToken();
      const nextHash = await this.passwords.hash(next);
      const inserted = await manager.query<{ id: string }[]>(
        `INSERT INTO iam.refresh_tokens (tenant_id, session_id, token_hash, expires_at) VALUES ($1,$2,$3,$4) RETURNING id`,
        [tenant.id, token.session_id, nextHash, token.expires_at],
      );
      await manager.query(
        'UPDATE iam.refresh_tokens SET used_at = now(), replaced_by = $1 WHERE tenant_id = $2 AND id = $3',
        [inserted[0].id, tenant.id, token.id],
      );
      await this.audit.write(manager, tenant.id, {
        actorUserId: token.user_id,
        eventType: 'auth.refresh_rotated',
        entityType: 'session',
        entityId: token.session_id,
      });
      return {
        accessToken: this.tokens.issueAccessToken({
          sub: token.user_id,
          tenantId: tenant.id,
          roles: token.roles,
          mfa: false,
          sid: token.session_id,
        }),
        refreshToken: next,
      };
    });
  }
}
