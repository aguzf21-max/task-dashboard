import { HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'node:net';

@Injectable()
export class RedisSecurityService {
  constructor(private readonly config: ConfigService) {}

  async limit(key: string, maximum: number, seconds: number): Promise<void> {
    const script =
      "local c=redis.call('INCR',KEYS[1]); if c==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return {c,redis.call('TTL',KEYS[1])}";
    const response = await this.command(['EVAL', script, '1', key, String(seconds)]);
    const [count, retryAfter] = response.split(/\s+/).map(Number);
    if (count > maximum) {
      throw new HttpException(
        {
          statusCode: 429,
          title: 'Too Many Requests',
          detail: 'Authentication rate limit exceeded',
          retryAfter,
        },
        429,
      );
    }
  }

  async denylist(key: string, seconds: number): Promise<void> {
    if (seconds > 0) await this.command(['SET', `denylist:${key}`, '1', 'EX', String(seconds)]);
  }

  async isDenylisted(key: string): Promise<boolean> {
    return (await this.command(['EXISTS', `denylist:${key}`])) === '1';
  }

  private command(parts: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new ServiceUnavailableException('Redis security control is unavailable'));
      }, 2_000);
      socket.once('error', () =>
        reject(new ServiceUnavailableException('Redis security control is unavailable')),
      );
      socket.connect(
        this.config.getOrThrow<number>('REDIS_PORT'),
        this.config.getOrThrow<string>('REDIS_HOST'),
        () => {
          socket.write(
            `*${parts.length}\r\n${parts.map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`).join('')}`,
          );
        },
      );
      socket.once('data', (data: Buffer) => {
        clearTimeout(timer);
        socket.end();
        const response = data.toString();
        if (response.startsWith('-'))
          reject(new ServiceUnavailableException('Redis security control failed'));
        else if (response.startsWith('$')) {
          resolve(response.slice(response.indexOf('\r\n') + 2).trim());
        } else resolve(response.slice(1).trim());
      });
    });
  }
}
