import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

export interface AuditEvent {
  actorUserId?: string;
  eventType: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, string | number | boolean | null>;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  async write(manager: EntityManager, tenantId: string, event: AuditEvent): Promise<void> {
    await manager.query(
      `INSERT INTO iam.audit_log (tenant_id, actor_user_id, event_type, entity_type, entity_id, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
      [
        tenantId,
        event.actorUserId ?? null,
        event.eventType,
        event.entityType,
        event.entityId ?? null,
        JSON.stringify(event.metadata ?? {}),
        event.ipAddress ?? null,
      ],
    );
  }
}
