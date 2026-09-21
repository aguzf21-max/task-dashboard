import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIamCore1735776000000 implements MigrationInterface {
  name = 'CreateIamCore1735776000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "citext"');
    await queryRunner.query(`
      CREATE TABLE iam.roles (
        id smallserial PRIMARY KEY,
        name varchar(64) NOT NULL UNIQUE,
        hierarchy_level smallint NOT NULL UNIQUE CHECK (hierarchy_level BETWEEN 0 AND 6),
        permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      INSERT INTO iam.roles (name, hierarchy_level, permissions) VALUES
      ('Super Admin', 0, '["tenant:manage","platform:configure"]'),
      ('Director / Admin', 1, '["clinical:full","staff:manage","platform:configure"]'),
      ('Terapeuta Clínico', 2, '["clinical:record","agenda:manage","teleconsultation:use","tcc:formulate","nom004:report"]'),
      ('Recepción & Admisión', 3, '["agenda:manage","cash:minor","intake:minor","eni:deliver"]'),
      ('Mentor PRO Clínico', 4, '["mentor:use","assessment:battery","report:pdf","assessment:assigned"]'),
      ('Evaluado / Candidato', 5, '["results:own:read"]'),
      ('Familiar / Tutor', 6, '["minor:custody:read","consent:manage"]')
      ON CONFLICT (name) DO NOTHING;
    `);
    await queryRunner.query(`
      CREATE TABLE iam.users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
        email citext NOT NULL, password_hash text NOT NULL, display_name varchar(160) NOT NULL,
        is_active boolean NOT NULL DEFAULT true, email_verified_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (tenant_id, email)
      );
      CREATE TABLE iam.user_roles (
        tenant_id uuid NOT NULL, user_id uuid NOT NULL, role_id smallint NOT NULL REFERENCES iam.roles(id),
        assigned_by uuid, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id, user_id, role_id)
      );
      CREATE TABLE iam.sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, user_id uuid NOT NULL,
        family_id uuid NOT NULL DEFAULT gen_random_uuid(), revoked_at timestamptz, revoke_reason varchar(64),
        created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
        UNIQUE (tenant_id, id)
      );
      CREATE TABLE iam.refresh_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, session_id uuid NOT NULL,
        token_hash text NOT NULL, used_at timestamptz, revoked_at timestamptz, expires_at timestamptz NOT NULL,
        replaced_by uuid, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, token_hash)
      );
      CREATE TABLE iam.totp_secrets (
        tenant_id uuid NOT NULL, user_id uuid NOT NULL, encrypted_secret text NOT NULL,
        key_id varchar(128), last_used_step bigint, enabled_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (tenant_id, user_id)
      );
      CREATE TABLE iam.backup_codes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, user_id uuid NOT NULL,
        code_hash text NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, code_hash)
      );
      CREATE TABLE iam.consents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, subject_user_id uuid NOT NULL,
        purpose varchar(32) NOT NULL CHECK (purpose IN ('psicometria','clinica','matching_talento')),
        version varchar(64) NOT NULL, text_sha256 char(64) NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(),
        revoked_at timestamptz, ip_address inet, representative_user_id uuid, granted_by uuid,
        UNIQUE (tenant_id, subject_user_id, purpose, version)
      );
      CREATE TABLE iam.audit_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, actor_user_id uuid,
        event_type varchar(96) NOT NULL, entity_type varchar(96) NOT NULL, entity_id uuid,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb, ip_address inet, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX iam_users_tenant_email_idx ON iam.users(tenant_id, email);
      CREATE INDEX iam_sessions_tenant_user_idx ON iam.sessions(tenant_id, user_id);
      CREATE INDEX iam_refresh_tokens_session_idx ON iam.refresh_tokens(tenant_id, session_id);
      CREATE INDEX iam_audit_log_tenant_created_idx ON iam.audit_log(tenant_id, created_at DESC);
    `);
    for (const table of [
      'users',
      'user_roles',
      'sessions',
      'refresh_tokens',
      'totp_secrets',
      'backup_codes',
      'consents',
      'audit_log',
    ]) {
      await queryRunner.query(`ALTER TABLE iam.${table} ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE iam.${table} FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`
        CREATE POLICY ${table}_tenant_isolation ON iam.${table}
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
      `);
    }
    await queryRunner.query(`
      CREATE FUNCTION iam.block_audit_log_mutation() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'iam.audit_log is immutable'; END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER audit_log_immutable BEFORE UPDATE OR DELETE ON iam.audit_log
      FOR EACH ROW EXECUTE FUNCTION iam.block_audit_log_mutation();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TABLE iam.audit_log, iam.consents, iam.backup_codes, iam.totp_secrets, iam.refresh_tokens, iam.sessions, iam.user_roles, iam.users',
    );
    await queryRunner.query('DROP TABLE iam.roles');
    await queryRunner.query('DROP FUNCTION iam.block_audit_log_mutation()');
  }
}
