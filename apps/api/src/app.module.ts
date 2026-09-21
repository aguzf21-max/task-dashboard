import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { HealthController } from './health/health.controller';
import { DependencyHealthService } from './health/dependency-health.service';
import { validateEnvironment } from './config/environment.validation';
import { DatabaseModule } from './database/database.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { IamModule } from './iam/iam.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/api/.env', '.env'],
      validate: validateEnvironment,
    }),
    DatabaseModule,
    TenancyModule,
    IamModule,
  ],
  controllers: [HealthController],
  providers: [DependencyHealthService],
})
export class AppModule {}
