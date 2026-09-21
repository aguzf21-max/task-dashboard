import dataSource from './data-source';
import { Tenant } from './tenant.entity';

async function seed(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Development seed is disabled in production');
  }
  const slug = process.env.DEVELOPMENT_TENANT_SLUG ?? 'local-tenant';
  await dataSource.initialize();
  try {
    const tenants = dataSource.getRepository(Tenant);
    let tenant = await tenants.findOneBy({ slug });
    if (!tenant) tenant = await tenants.save(tenants.create({ slug }));
    await dataSource.query("SELECT set_config('app.current_tenant_id', $1, false)", [tenant.id]);
    await dataSource.query(
      `INSERT INTO operations.tenant_settings (tenant_id)
       VALUES ($1) ON CONFLICT (tenant_id) DO NOTHING`,
      [tenant.id],
    );
    console.log(`Development tenant ready: ${tenant.slug} (${tenant.id})`);
  } finally {
    await dataSource.destroy();
  }
}

void seed();
