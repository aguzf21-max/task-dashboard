import 'reflect-metadata';

import { DataSource } from 'typeorm';

import { Tenant } from './tenant.entity';

const port = Number.parseInt(process.env.DATABASE_PORT ?? '5432', 10);

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port,
  username: process.env.DATABASE_USER ?? 'mentoring',
  password: process.env.DATABASE_PASSWORD ?? '',
  database: process.env.DATABASE_NAME ?? 'mentoring',
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : false,
  entities: [Tenant],
  migrations: ['src/database/migrations/*{.ts,.js}'],
  synchronize: false,
});
