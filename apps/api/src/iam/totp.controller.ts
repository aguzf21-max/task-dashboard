import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import type { Request } from 'express';

import { TenantScopedDataSource } from '../database/tenant-scoped-data-source.service';
import { TenantContext } from '../tenancy/tenant-context.service';
import { AccessTokenGuard } from './access-token.guard';
import { AuditService } from './audit.service';
import type { AccessTokenClaims } from './token.service';
import { TotpService } from './totp.service';

class TotpCodeDto {
  @IsString()
  @Length(6, 32)
  code!: string;
}

class EnrollmentResponse {
  otpauthUrl!: string;
  recoveryCodes!: string[];
}

@Controller('auth/totp')
@UseGuards(AccessTokenGuard)
export class TotpController {
  constructor(
    private readonly scoped: TenantScopedDataSource,
    private readonly tenant: TenantContext,
    private readonly totp: TotpService,
    private readonly audit: AuditService,
  ) {}

  @Post('enroll')
  enroll(@Req() request: Request & { user: AccessTokenClaims }): Promise<EnrollmentResponse> {
    return this.scoped.withTenant(this.tenant.tenant.id, async (manager) => {
      const result = await this.totp.enroll(manager, this.tenant.tenant.id, request.user.sub);
      await this.audit.write(manager, this.tenant.tenant.id, {
        actorUserId: request.user.sub,
        eventType: 'totp.enrollment_started',
        entityType: 'user',
        entityId: request.user.sub,
      });
      return result;
    });
  }

  @Post('confirm')
  async confirm(
    @Req() request: Request & { user: AccessTokenClaims },
    @Body() body: TotpCodeDto,
  ): Promise<void> {
    await this.scoped.withTenant(this.tenant.tenant.id, async (manager) => {
      if (!(await this.totp.confirm(manager, this.tenant.tenant.id, request.user.sub, body.code))) {
        throw new UnauthorizedException('Invalid or inactive TOTP enrollment');
      }
      await this.audit.write(manager, this.tenant.tenant.id, {
        actorUserId: request.user.sub,
        eventType: 'totp.enabled',
        entityType: 'user',
        entityId: request.user.sub,
      });
    });
  }

  @Post('recovery')
  async recovery(
    @Req() request: Request & { user: AccessTokenClaims },
    @Body() body: TotpCodeDto,
  ): Promise<void> {
    await this.scoped.withTenant(this.tenant.tenant.id, async (manager) => {
      if (
        !(await this.totp.useRecoveryCode(
          manager,
          this.tenant.tenant.id,
          request.user.sub,
          body.code,
        ))
      ) {
        throw new UnauthorizedException('Invalid recovery code');
      }
      await this.audit.write(manager, this.tenant.tenant.id, {
        actorUserId: request.user.sub,
        eventType: 'totp.recovery_code_used',
        entityType: 'user',
        entityId: request.user.sub,
      });
    });
  }
}
