import { TenantScopedDataSource } from '../src/database/tenant-scoped-data-source.service';

describe('TenantScopedDataSource', () => {
  it('sets the validated tenant session setting before tenant-scoped work', async () => {
    const manager = { query: jest.fn().mockResolvedValue(undefined) };
    const dataSource = {
      transaction: (work: (transactionManager: typeof manager) => Promise<string>) => work(manager),
    };
    const service = new TenantScopedDataSource(dataSource as never);

    await expect(
      service.withTenant('018f4b04-4b7a-4f5a-8d7d-8d7f5f9f9001', () => Promise.resolve('ok')),
    ).resolves.toBe('ok');
    expect(manager.query).toHaveBeenCalledWith(
      "SELECT set_config('app.current_tenant_id', $1, true)",
      ['018f4b04-4b7a-4f5a-8d7d-8d7f5f9f9001'],
    );
  });
});
