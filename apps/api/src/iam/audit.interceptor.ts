import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { catchError, mergeMap, Observable, throwError } from 'rxjs';

import { TenantScopedDataSource } from '../database/tenant-scoped-data-source.service';
import { AuditService } from './audit.service';
import { AUDIT_EVENT, type AuditRouteMetadata } from './audit.decorator';

const blockedMetadata = /(password|token|secret|code|phi|diagnosis|clinical)/i;

function isAuditMetadata(value: unknown): value is AuditRouteMetadata {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { eventType?: unknown }).eventType === 'string' &&
    typeof (value as { entityType?: unknown }).entityType === 'string'
  );
}

export function sanitizeAuditMetadata(
  metadata: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (
      blockedMetadata.test(key) ||
      (!['string', 'number', 'boolean'].includes(typeof value) && value !== null)
    ) {
      throw new ServiceUnavailableException('Unsafe audit metadata was rejected');
    }

    result[key] = value as string | number | boolean | null;
  }
  return result;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly scoped: TenantScopedDataSource,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.getAllAndOverride<unknown>(AUDIT_EVENT, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isAuditMetadata(metadata)) return next.handle();
    const request = context.switchToHttp().getRequest<{
      tenantContext?: { id: string };
      user?: { sub: string };
      params: Record<string, string>;
    }>();
    if (!request.tenantContext)
      return throwError(
        () => new ServiceUnavailableException('Tenant context is required for audit'),
      );
    return next.handle().pipe(
      mergeMap((result) =>
        this.scoped.withTenant(request.tenantContext!.id, async (manager) => {
          await this.audit.write(manager, request.tenantContext!.id, {
            actorUserId: request.user?.sub,
            eventType: metadata.eventType,
            entityType: metadata.entityType,
            entityId: request.params.id,
            metadata: sanitizeAuditMetadata({ audited: true }),
          });
          return result as unknown;
        }),
      ),
      catchError((error: unknown) => throwError(() => error)),
    );
  }
}
