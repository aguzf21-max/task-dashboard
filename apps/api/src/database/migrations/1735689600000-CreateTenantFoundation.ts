import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenantFoundation1735689600000 implements MigrationInterface {
  name = 'CreateTenantFoundation1735689600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    for (const schema of ['iam', 'assessment', 'clinical', 'intelligence', 'operations']) {
      await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    }
    await queryRunner.query(`
      CREATE TABLE operations.tenants (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug varchar(63) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$'),
        domain varchar(255) UNIQUE,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query('CREATE INDEX tenants_active_idx ON operations.tenants (is_active)');
    await queryRunner.query(`
      CREATE TABLE operations.tenant_settings (
        tenant_id uuid PRIMARY KEY REFERENCES operations.tenants(id) ON DELETE RESTRICT,
        settings_version integer NOT NULL DEFAULT 1 CHECK (settings_version > 0),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query('ALTER TABLE operations.tenant_settings ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE operations.tenant_settings FORCE ROW LEVEL SECURITY');
    await queryRunner.query(`
      CREATE POLICY tenant_settings_isolation ON operations.tenant_settings
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE operations.tenant_settings');
    await queryRunner.query('DROP TABLE operations.tenants');
    for (const schema of ['operations', 'intelligence', 'clinical', 'assessment', 'iam']) {
      await queryRunner.query(`DROP SCHEMA "${schema}"`);
    }
  }
}
