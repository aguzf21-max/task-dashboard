import { ARGON2ID_OPTIONS, PasswordService } from '../src/iam/password.service';

describe('PasswordService', () => {
  it('uses the required Argon2id work factors and verifies passwords', async () => {
    expect(ARGON2ID_OPTIONS).toMatchObject({ memoryCost: 65536, timeCost: 3, parallelism: 4 });
    const service = new PasswordService();
    const hash = await service.hash('a-long-test-password');
    await expect(service.verify(hash, 'a-long-test-password')).resolves.toBe(true);
    await expect(service.verify(hash, 'wrong-password')).resolves.toBe(false);
  });
});
