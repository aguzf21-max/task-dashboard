import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DependencyHealthService } from './dependency-health.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly dependencies: DependencyHealthService,
  ) {}

  @Get()
  health() {
    return {
      status: 'ok',
      service: 'mentoring-api',
    };
  }

  @Get('ready')
  async readiness() {
    try {
      await this.dependencies.check();
    } catch {
      throw new ServiceUnavailableException('Database or Redis is unavailable');
    }
    return {
      status: 'ready',
      environment: this.configService.getOrThrow<string>('NODE_ENV'),
    };
  }
}
