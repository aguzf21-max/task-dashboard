import * as Joi from 'joi';

export interface ValidatedEnvironment {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_HOST: string;
  DATABASE_PORT: number;
  DATABASE_NAME: string;
  DATABASE_USER: string;
  DATABASE_PASSWORD: string;
  DATABASE_SSL: boolean;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD: string;
  SMTP_HOST: string;
  SMTP_PORT: number;
  ALLOWED_CORS_ORIGINS: string;
  JWT_PRIVATE_KEY_PATH?: string;
  JWT_PUBLIC_KEY_PATH?: string;
  AES_KEY?: string;
  KMS_KEY_ID?: string;
  TENANCY_DEVELOPMENT_HEADER_ENABLED: boolean;
  ACCESS_TOKEN_TTL: string;
  REFRESH_TOKEN_TTL_DAYS: number;
  IAM_ENCRYPTION_KEY?: string;
  REDIS_SECURITY_REQUIRED: boolean;
}

const environmentSchema = Joi.object<ValidatedEnvironment>({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_HOST: Joi.string().hostname().default('localhost'),
  DATABASE_PORT: Joi.number().port().default(5432),
  DATABASE_NAME: Joi.string()
    .pattern(/^[A-Za-z0-9_]+$/)
    .default('mentoring'),
  DATABASE_USER: Joi.string()
    .pattern(/^[A-Za-z0-9_]+$/)
    .default('mentoring'),
  DATABASE_PASSWORD: Joi.string().allow('').default(''),
  DATABASE_SSL: Joi.boolean().default(false),
  REDIS_HOST: Joi.string().hostname().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  SMTP_HOST: Joi.string().hostname().default('localhost'),
  SMTP_PORT: Joi.number().port().default(1025),
  ALLOWED_CORS_ORIGINS: Joi.string().min(1).default('http://localhost:3001'),
  JWT_PRIVATE_KEY_PATH: Joi.string().trim().optional(),
  JWT_PUBLIC_KEY_PATH: Joi.string().trim().optional(),
  AES_KEY: Joi.string().min(32).optional(),
  KMS_KEY_ID: Joi.string().trim().optional(),
  TENANCY_DEVELOPMENT_HEADER_ENABLED: Joi.boolean().default(true),
  ACCESS_TOKEN_TTL: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('15m'),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).max(30).default(7),
  IAM_ENCRYPTION_KEY: Joi.string().base64().optional(),
  REDIS_SECURITY_REQUIRED: Joi.boolean().default(true),
}).unknown(true);

export function validateEnvironment(config: Record<string, unknown>): ValidatedEnvironment {
  const result = environmentSchema.validate(config, {
    abortEarly: false,
    convert: true,
  });

  if (result.error) {
    throw new Error(`Invalid environment configuration: ${result.error.message}`);
  }

  const environment = result.value;
  if (environment.NODE_ENV !== 'production') {
    return environment;
  }

  const productionErrors: string[] = [];
  if (!environment.DATABASE_PASSWORD) {
    productionErrors.push('DATABASE_PASSWORD must be set in production');
  }
  if (!environment.JWT_PRIVATE_KEY_PATH) {
    productionErrors.push('JWT_PRIVATE_KEY_PATH must be set in production');
  }
  if (!environment.JWT_PUBLIC_KEY_PATH) {
    productionErrors.push('JWT_PUBLIC_KEY_PATH must be set in production');
  }
  if (!environment.AES_KEY && !environment.KMS_KEY_ID) {
    productionErrors.push('either AES_KEY or KMS_KEY_ID must be set in production');
  }
  if (!environment.IAM_ENCRYPTION_KEY) {
    productionErrors.push('IAM_ENCRYPTION_KEY must be set in production');
  }
  if (environment.TENANCY_DEVELOPMENT_HEADER_ENABLED) {
    productionErrors.push('TENANCY_DEVELOPMENT_HEADER_ENABLED must be false in production');
  }

  if (productionErrors.length > 0) {
    throw new Error(`Invalid production environment configuration: ${productionErrors.join('; ')}`);
  }

  return environment;
}
