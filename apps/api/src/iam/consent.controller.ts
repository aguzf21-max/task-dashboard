import { Body, Controller, Get, Ip, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { IsIn, IsString, IsUUID, Length } from 'class-validator';

import { TenantContext } from '../tenancy/tenant-context.service';
import { AccessTokenGuard } from './access-token.guard';
import { ConsentPurpose, ConsentService } from './consent.service';
import { Permissions } from './roles.decorator';
import type { AccessTokenClaims } from './token.service';

class GrantConsentDto {
  @IsUUID() subjectUserId!: string;
  @IsIn(['psicometria', 'clinica', 'matching_talento']) purpose!: ConsentPurpose;
  @IsString() @Length(1, 64) version!: string;
  @IsString() @Length(1, 100_000) text!: string;
  @IsUUID() grantedBy!: string;
}

@Controller('consents')
@UseGuards(AccessTokenGuard)
export class ConsentController {
  constructor(
    private readonly consents: ConsentService,
    private readonly tenant: TenantContext,
  ) {}

  @Post()
  @Permissions('consent:manage')
  grant(@Body() body: GrantConsentDto, @Ip() ip: string): Promise<void> {
    return this.consents.grant(
      this.tenant.tenant,
      body.subjectUserId,
      body.purpose,
      body.version,
      body.text,
      body.grantedBy,
      ip,
    );
  }

  @Get(':subjectUserId/:purpose/active')
  active(
    @Param('subjectUserId') subjectUserId: string,
    @Param('purpose') purpose: ConsentPurpose,
  ): Promise<void> {
    return this.consents.assertActive(this.tenant.tenant, subjectUserId, purpose);
  }

  @Get(':subjectUserId')
  list(@Param('subjectUserId') subjectUserId: string) {
    return this.consents.list(this.tenant.tenant, subjectUserId);
  }

  @Post(':subjectUserId/:purpose/revoke')
  @Permissions('consent:manage')
  revoke(
    @Param('subjectUserId') subjectUserId: string,
    @Param('purpose') purpose: ConsentPurpose,
    @Req() request: Request & { user: AccessTokenClaims },
    @Ip() ip: string,
  ): Promise<void> {
    return this.consents.revoke(this.tenant.tenant, subjectUserId, purpose, request.user.sub, ip);
  }
}
