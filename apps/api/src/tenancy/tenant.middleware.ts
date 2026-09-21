import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';

import { TenantResolutionService } from './tenant-resolution.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly config: ConfigService,
    private readonly resolution: TenantResolutionService,
  ) {}

  async use(
    request: Request & { tenantContext?: unknown },
    _response: Response,
    next: NextFunction,
  ) {
    if (!this.config.getOrThrow<boolean>('TENANCY_DEVELOPMENT_HEADER_ENABLED')) {
      throw new UnauthorizedException('No production tenant resolver has been configured');
    }
    const header = request.header('X-Tenant-Id');
    request.tenantContext = await this.resolution.resolveHeaderTenant(header);
    next();
  }
}
