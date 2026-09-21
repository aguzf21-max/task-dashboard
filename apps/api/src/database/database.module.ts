import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Tenant } from './tenant.entity';
import { TenantScopedDataSource } from './tenant-scoped-data-source.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.getOrThrow<string>('DATABASE_HOST'),
        port: config.getOrThrow<number>('DATABASE_PORT'),
        username: config.getOrThrow<string>('DATABASE_USER'),
        password: config.getOrThrow<string>('DATABASE_PASSWORD'),
        database: config.getOrThrow<string>('DATABASE_NAME'),
        ssl: config.getOrThrow<boolean>('DATABASE_SSL') ? { rejectUnauthorized: true } : false,
        entities: [Tenant],
        synchronize: false,
      }),
    }),
  ],
  providers: [TenantScopedDataSource],
  exports: [TenantScopedDataSource],
})
export class DatabaseModule {}
