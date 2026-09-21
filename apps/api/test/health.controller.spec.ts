import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { HealthController } from '../src/health/health.controller';
import { DependencyHealthService } from '../src/health/dependency-health.service';

describe('HealthController', () => {
  it('reports service health', async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('test'),
          },
        },
        {
          provide: DependencyHealthService,
          useValue: { check: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    expect(module.get(HealthController).health()).toEqual({
      status: 'ok',
      service: 'mentoring-api',
    });
  });
});
