import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Socket } from 'node:net';

@Injectable()
export class DependencyHealthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async check(): Promise<void> {
    await this.dataSource.query('SELECT 1');
    await this.pingRedis();
  }

  private pingRedis(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error('Redis health check timed out'));
      }, 2_000);
      socket.once('error', reject);
      socket.connect(
        this.config.getOrThrow<number>('REDIS_PORT'),
        this.config.getOrThrow<string>('REDIS_HOST'),
        () => {
          socket.write('PING\r\n');
        },
      );
      socket.once('data', (data: Buffer) => {
        clearTimeout(timeout);
        socket.end();
        if (data.toString() === '+PONG\r\n') resolve();
        else reject(new Error('Redis health check returned an unexpected response'));
      });
    });
  }
}
