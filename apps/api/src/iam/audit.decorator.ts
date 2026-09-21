import { SetMetadata } from '@nestjs/common';

export const AUDIT_EVENT = 'iam:audit-event';
export interface AuditRouteMetadata {
  eventType: string;
  entityType: string;
}

/** Explicit route metadata only. Services must write the event in their existing transaction; metadata must exclude PHI. */
export const Audit = (eventType: string, entityType: string) =>
  SetMetadata(AUDIT_EVENT, { eventType, entityType } satisfies AuditRouteMetadata);
