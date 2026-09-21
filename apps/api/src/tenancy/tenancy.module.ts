import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Tenant } from '../database/tenant.entity';
import { TenantContext } from './tenant-context.service';
import { TenantMiddleware } from './tenant.middleware';
import { TenantResolutionService } from './tenant-resolution.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant])],
  providers: [TenantContext, TenantResolutionService, TenantMiddleware],
  exports: [TenantContext, TenantResolutionService],
})
export class TenancyModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).exclude('health', 'health/(.*)').forRoutes('*');
  }
}
