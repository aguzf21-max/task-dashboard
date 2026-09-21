import { TotpService } from '../src/iam/totp.service';

describe('TotpService', () => {
  const crypto = {
    encrypt: jest.fn((value: string) => `encrypted:${value}`),
    decrypt: jest.fn((value: string) => value.replace('encrypted:', '')),
  };
  const passwords = {
    hash: jest.fn((value: string) => Promise.resolve(`hash:${value}`)),
    verify: jest.fn((hash: string, value: string) => Promise.resolve(hash === `hash:${value}`)),
  };

  beforeEach(() => jest.clearAllMocks());

  it('enrolls exactly eight codes without writing plaintext codes', async () => {
    const manager = { query: jest.fn().mockResolvedValue([]) };
    const service = new TotpService(crypto as never, passwords);
    const enrollment = await service.enroll(
      manager as never,
      '018f4b04-4b7a-4f5a-8d7d-8d7f5f9f9001',
      '018f4b04-4b7a-4f5a-8d7d-8d7f5f9f9002',
    );
    expect(enrollment.recoveryCodes).toHaveLength(8);
    expect(enrollment.otpauthUrl).toMatch(/^otpauth:\/\//);
    const insertArguments = manager.query.mock.calls.filter(([sql]) =>
      String(sql).includes('INSERT INTO iam.backup_codes'),
    );
    expect(insertArguments).toHaveLength(8);
    expect(passwords.hash).toHaveBeenCalledTimes(8);
  });

  it('consumes a recovery code once', async () => {
    const manager = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ id: 'code-id', code_hash: 'hash:RECOVERY' }])
        .mockResolvedValueOnce([]),
    };
    const service = new TotpService(crypto as never, passwords);
    await expect(
      service.useRecoveryCode(manager as never, 'tenant', 'user', 'RECOVERY'),
    ).resolves.toBe(true);
    expect(manager.query).toHaveBeenLastCalledWith(
      expect.stringContaining('UPDATE iam.backup_codes SET used_at'),
      ['tenant', 'code-id'],
    );
  });
});
