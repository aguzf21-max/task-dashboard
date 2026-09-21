import { Inject, Injectable, Scope, UnauthorizedException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { Request } from 'express';

import { TenantIdentity } from './tenant-context';

type TenantRequest = Request & { tenantContext?: TenantIdentity };

@Injectable({ scope: Scope.REQUEST })
export class TenantContext {
  constructor(@Inject(REQUEST) private readonly request: TenantRequest) {}

  get tenant(): TenantIdentity {
    if (!this.request.tenantContext) {
      throw new UnauthorizedException('Tenant context is required');
    }
    return this.request.tenantContext;
  }
}
