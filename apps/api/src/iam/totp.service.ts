import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import { EntityManager } from 'typeorm';

import { EnvelopeCryptoService } from './crypto.service';
import { PasswordService } from './password.service';

@Injectable()
export class TotpService {
  constructor(
    private readonly crypto: EnvelopeCryptoService,
    private readonly passwords: PasswordService,
  ) {}

  beginEnrollment(): { secret: string; otpauthUrl: string } {
    const secret = authenticator.generateSecret();
    return { secret, otpauthUrl: authenticator.keyuri('user', 'Mentoring PRO 360', secret) };
  }

  async enroll(
    manager: EntityManager,
    tenantId: string,
    userId: string,
  ): Promise<{ otpauthUrl: string; recoveryCodes: string[] }> {
    const { secret, otpauthUrl } = this.beginEnrollment();
    const recoveryCodes = Array.from({ length: 8 }, () =>
      authenticator.generateSecret().slice(0, 12).toUpperCase(),
    );
    await manager.query(
      `INSERT INTO iam.totp_secrets (tenant_id, user_id, encrypted_secret, enabled_at, last_used_step)
       VALUES ($1, $2, $3, NULL, NULL)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET encrypted_secret = EXCLUDED.encrypted_secret, enabled_at = NULL, last_used_step = NULL`,
      [tenantId, userId, this.crypto.encrypt(secret)],
    );
    await manager.query(
      'DELETE FROM iam.backup_codes WHERE tenant_id = $1 AND user_id = $2 AND used_at IS NULL',
      [tenantId, userId],
    );
    for (const recoveryCode of recoveryCodes) {
      await manager.query(
        'INSERT INTO iam.backup_codes (tenant_id, user_id, code_hash) VALUES ($1, $2, $3)',
        [tenantId, userId, await this.passwords.hash(recoveryCode)],
      );
    }
    return { otpauthUrl, recoveryCodes };
  }

  async verify(
    manager: EntityManager,
    tenantId: string,
    userId: string,
    code: string,
  ): Promise<boolean> {
    const rows = await manager.query<{ encrypted_secret: string; last_used_step: string | null }[]>(
      'SELECT encrypted_secret, last_used_step FROM iam.totp_secrets WHERE tenant_id = $1 AND user_id = $2 AND enabled_at IS NOT NULL FOR UPDATE',
      [tenantId, userId],
    );
    const record = rows[0];
    const step = Math.floor(Date.now() / 30_000);
    if (
      !record ||
      record.last_used_step === String(step) ||
      !authenticator.check(code, this.crypto.decrypt(record.encrypted_secret))
    )
      return false;
    await manager.query(
      'UPDATE iam.totp_secrets SET last_used_step = $1 WHERE tenant_id = $2 AND user_id = $3',
      [step, tenantId, userId],
    );
    return true;
  }

  async confirm(
    manager: EntityManager,
    tenantId: string,
    userId: string,
    code: string,
  ): Promise<boolean> {
    const rows = await manager.query<{ encrypted_secret: string }[]>(
      'SELECT encrypted_secret FROM iam.totp_secrets WHERE tenant_id = $1 AND user_id = $2 AND enabled_at IS NULL FOR UPDATE',
      [tenantId, userId],
    );
    const secret = rows[0] ? this.crypto.decrypt(rows[0].encrypted_secret) : undefined;
    if (!secret || !authenticator.check(code, secret)) return false;
    await manager.query(
      'UPDATE iam.totp_secrets SET enabled_at = now(), last_used_step = $1 WHERE tenant_id = $2 AND user_id = $3',
      [Math.floor(Date.now() / 30_000), tenantId, userId],
    );
    return true;
  }

  async useRecoveryCode(
    manager: EntityManager,
    tenantId: string,
    userId: string,
    code: string,
  ): Promise<boolean> {
    const rows = await manager.query<{ id: string; code_hash: string }[]>(
      'SELECT id, code_hash FROM iam.backup_codes WHERE tenant_id = $1 AND user_id = $2 AND used_at IS NULL FOR UPDATE',
      [tenantId, userId],
    );
    const match = (
      await Promise.all(
        rows.map(async (item) =>
          (await this.passwords.verify(item.code_hash, code)) ? item : undefined,
        ),
      )
    ).find(Boolean);
    if (!match) return false;
    await manager.query(
      'UPDATE iam.backup_codes SET used_at = now() WHERE tenant_id = $1 AND id = $2 AND used_at IS NULL',
      [tenantId, match.id],
    );
    return true;
  }
}
