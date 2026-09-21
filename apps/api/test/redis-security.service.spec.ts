import { HttpException, ServiceUnavailableException } from '@nestjs/common';

import { RedisSecurityService } from '../src/iam/redis-security.service';

describe('RedisSecurityService rate limiting', () => {
  const config = { getOrThrow: jest.fn().mockReturnValue(6379) };

  it('uses the supplied identity key and rejects above threshold with retry details', async () => {
    const service = new RedisSecurityService(config as never);
    const command = jest
      .fn<Promise<string>, [string[]]>()
      .mockResolvedValueOnce('5 900')
      .mockResolvedValueOnce('6 899');
    (service as unknown as { command: typeof command }).command = command;
    await expect(service.limit('auth:login:ip-a', 5, 900)).resolves.toBeUndefined();
    await expect(service.limit('auth:login:ip-b', 5, 900)).rejects.toBeInstanceOf(HttpException);
    expect(command.mock.calls[0][0]).toContain('auth:login:ip-a');
    expect(command.mock.calls[1][0]).toContain('auth:login:ip-b');
  });

  it('surfaces Redis failure instead of allowing the authentication action', async () => {
    const service = new RedisSecurityService(config as never);
    (service as unknown as { command: jest.Mock }).command = jest
      .fn()
      .mockRejectedValue(new ServiceUnavailableException('Redis security control is unavailable'));
    await expect(service.limit('auth:login:ip-a', 5, 900)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
