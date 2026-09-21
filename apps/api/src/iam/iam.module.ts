import { Module } from '@nestjs/common';

import { AuditService } from './audit.service';
import { EnvelopeCryptoService } from './crypto.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { TotpService } from './totp.service';
import { AccessTokenGuard } from './access-token.guard';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ConsentService } from './consent.service';
import { ConsentController } from './consent.controller';
import { TotpController } from './totp.controller';
import { RedisSecurityService } from './redis-security.service';
import { AuditInterceptor } from './audit.interceptor';

@Module({
  controllers: [AuthController, ConsentController, TotpController],
  providers: [
    AccessTokenGuard,
    AuditService,
    AuthService,
    ConsentService,
    EnvelopeCryptoService,
    PasswordService,
    TokenService,
    TotpService,
    RedisSecurityService,
    AuditInterceptor,
  ],
  exports: [
    AccessTokenGuard,
    AuditService,
    AuthService,
    ConsentService,
    EnvelopeCryptoService,
    PasswordService,
    TokenService,
    TotpService,
    RedisSecurityService,
    AuditInterceptor,
  ],
})
export class IamModule {}
