import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';

import { TenantResolutionService } from '../src/tenancy/tenant-resolution.service';

const tenant = {
  id: '018f4b04-4b7a-4f5a-8d7d-8d7f5f9f9001',
  slug: 'acme',
  isActive: true,
};

describe('TenantResolutionService', () => {
  const repository = { findOneBy: jest.fn() };
  const service = new TenantResolutionService(repository as never);

  it('resolves an active UUID tenant', async () => {
    repository.findOneBy.mockResolvedValue(tenant);
    await expect(service.resolveHeaderTenant(tenant.id)).resolves.toEqual({
      id: tenant.id,
      slug: 'acme',
    });
  });

  it('rejects missing and malformed tenant identifiers', async () => {
    await expect(service.resolveHeaderTenant(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.resolveHeaderTenant('not-a-uuid')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects unknown and inactive tenants', async () => {
    repository.findOneBy
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...tenant, isActive: false });
    await expect(service.resolveHeaderTenant(tenant.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.resolveHeaderTenant(tenant.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});
