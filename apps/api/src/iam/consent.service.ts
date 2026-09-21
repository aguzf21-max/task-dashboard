import { ForbiddenException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

import { TenantScopedDataSource } from '../database/tenant-scoped-data-source.service';
import { TenantIdentity } from '../tenancy/tenant-context';
import { AuditService } from './audit.service';

export type ConsentPurpose = 'psicometria' | 'clinica' | 'matching_talento';

@Injectable()
export class ConsentService {
  constructor(
    private readonly scoped: TenantScopedDataSource,
    private readonly audit: AuditService,
  ) {}

  async grant(
    tenant: TenantIdentity,
    subjectUserId: string,
    purpose: ConsentPurpose,
    version: string,
    text: string,
    actorUserId: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.scoped.withTenant(tenant.id, async (manager) => {
      await manager.query(
        `INSERT INTO iam.consents (tenant_id, subject_user_id, purpose, version, text_sha256, granted_by, ip_address)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (tenant_id, subject_user_id, purpose, version) DO UPDATE SET revoked_at = NULL, granted_at = now(), granted_by = EXCLUDED.granted_by, ip_address = EXCLUDED.ip_address`,
        [
          tenant.id,
          subjectUserId,
          purpose,
          version,
          createHash('sha256').update(text, 'utf8').digest('hex'),
          actorUserId,
          ipAddress ?? null,
        ],
      );
      await this.audit.write(manager, tenant.id, {
        actorUserId,
        eventType: 'consent.granted',
        entityType: 'consent',
        metadata: { purpose, version },
        ipAddress,
      });
    });
  }

  async assertActive(
    tenant: TenantIdentity,
    subjectUserId: string,
    purpose: ConsentPurpose,
  ): Promise<void> {
    await this.scoped.withTenant(tenant.id, async (manager) => {
      const rows = await manager.query<{ id: string }[]>(
        'SELECT id FROM iam.consents WHERE tenant_id = $1 AND subject_user_id = $2 AND purpose = $3 AND revoked_at IS NULL LIMIT 1',
        [tenant.id, subjectUserId, purpose],
      );
      if (!rows[0]) throw new ForbiddenException(`Active ${purpose} consent is required`);
    });
  }

  async revoke(
    tenant: TenantIdentity,
    subjectUserId: string,
    purpose: ConsentPurpose,
    actorUserId: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.scoped.withTenant(tenant.id, async (manager) => {
      const rows = await manager.query<{ id: string }[]>(
        'UPDATE iam.consents SET revoked_at = now() WHERE tenant_id = $1 AND subject_user_id = $2 AND purpose = $3 AND revoked_at IS NULL RETURNING id',
        [tenant.id, subjectUserId, purpose],
      );
      if (!rows[0]) throw new ForbiddenException(`No active ${purpose} consent exists`);
      await this.audit.write(manager, tenant.id, {
        actorUserId,
        eventType: 'consent.revoked',
        entityType: 'consent',
        entityId: rows[0].id,
        metadata: { purpose },
        ipAddress,
      });
    });
  }

  list(tenant: TenantIdentity, subjectUserId: string) {
    return this.scoped.withTenant(tenant.id, (manager) =>
      manager.query<
        { purpose: ConsentPurpose; version: string; granted_at: Date; revoked_at: Date | null }[]
      >(
        'SELECT purpose, version, granted_at, revoked_at FROM iam.consents WHERE tenant_id = $1 AND subject_user_id = $2 ORDER BY granted_at DESC',
        [tenant.id, subjectUserId],
      ),
    );
  }
}
