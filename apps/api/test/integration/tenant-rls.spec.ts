import dataSource from '../../src/database/data-source';
import { TenantScopedDataSource } from '../../src/database/tenant-scoped-data-source.service';

const integration = process.env.RUN_POSTGRES_INTEGRATION === 'true' ? describe : describe.skip;

integration('PostgreSQL tenant RLS', () => {
  const firstTenant = '11111111-1111-4111-8111-111111111111';
  const secondTenant = '22222222-2222-4222-8222-222222222222';

  beforeAll(async () => {
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.query(
      `INSERT INTO operations.tenants (id, slug) VALUES ($1, 'rls-first'), ($2, 'rls-second')
       ON CONFLICT (id) DO NOTHING`,
      [firstTenant, secondTenant],
    );
    await dataSource.query("SELECT set_config('app.current_tenant_id', $1, false)", [firstTenant]);
    await dataSource.query(
      'INSERT INTO operations.tenant_settings (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING',
      [firstTenant],
    );
    await dataSource.query("SELECT set_config('app.current_tenant_id', $1, false)", [secondTenant]);
    await dataSource.query(
      'INSERT INTO operations.tenant_settings (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING',
      [secondTenant],
    );
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('exposes only the transaction tenant row', async () => {
    const scoped = new TenantScopedDataSource(dataSource);
    const rows = await scoped.withTenant(firstTenant, (manager) =>
      manager.query('SELECT tenant_id FROM operations.tenant_settings ORDER BY tenant_id'),
    );
    expect(rows).toEqual([{ tenant_id: firstTenant }]);
  });
});
