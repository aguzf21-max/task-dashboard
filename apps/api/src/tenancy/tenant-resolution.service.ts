import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { Repository } from 'typeorm';

import { Tenant } from '../database/tenant.entity';
import { TenantIdentity } from './tenant-context';

@Injectable()
export class TenantResolutionService {
  constructor(@InjectRepository(Tenant) private readonly tenants: Repository<Tenant>) {}

  async resolveHeaderTenant(value: string | undefined): Promise<TenantIdentity> {
    if (!value) throw new UnauthorizedException('Tenant context is required');
    if (!isUUID(value, '4')) throw new BadRequestException('X-Tenant-Id must be a UUID');
    const tenant = await this.tenants.findOneBy({ id: value });
    if (!tenant || !tenant.isActive) throw new NotFoundException('Active tenant was not found');
    return { id: tenant.id, slug: tenant.slug };
  }
}
