import { validateEnvironment } from '../src/config/environment.validation';

describe('validateEnvironment', () => {
  it('supplies practical defaults for local development', () => {
    expect(validateEnvironment({})).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_HOST: 'localhost',
      REDIS_PORT: 6379,
    });
  });

  it('rejects production configurations missing protected values', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'production' })).toThrow(
      'DATABASE_PASSWORD must be set in production',
    );
  });

  it('accepts production configuration with key paths and a KMS key', () => {
    expect(
      validateEnvironment({
        NODE_ENV: 'production',
        DATABASE_PASSWORD: 'database-password',
        JWT_PRIVATE_KEY_PATH: '/run/secrets/jwt-private.pem',
        JWT_PUBLIC_KEY_PATH: '/run/secrets/jwt-public.pem',
        KMS_KEY_ID: 'projects/example/locations/us/keyRings/app/cryptoKeys/data',
        TENANCY_DEVELOPMENT_HEADER_ENABLED: false,
        IAM_ENCRYPTION_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
      }),
    ).toMatchObject({ NODE_ENV: 'production', KMS_KEY_ID: expect.any(String) });
  });
});
