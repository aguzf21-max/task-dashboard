import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { sign, verify, type JwtPayload, type SignOptions } from 'jsonwebtoken';

export interface AccessTokenClaims extends JwtPayload {
  sub: string;
  tenantId: string;
  roles: string[];
  mfa: boolean;
  sid?: string;
}

@Injectable()
export class TokenService {
  constructor(private readonly config: ConfigService) {}

  issueAccessToken(claims: AccessTokenClaims): string {
    return sign(claims, this.privateKey(), {
      algorithm: 'RS256',
      expiresIn: this.config.getOrThrow<string>('ACCESS_TOKEN_TTL') as SignOptions['expiresIn'],
      issuer: 'mentoring-pro-360',
      audience: 'mentoring-api',
    });
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    try {
      return verify(token, this.publicKey(), {
        algorithms: ['RS256'],
        issuer: 'mentoring-pro-360',
        audience: 'mentoring-api',
      }) as AccessTokenClaims;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  createRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private privateKey(): string {
    return readFileSync(this.config.getOrThrow<string>('JWT_PRIVATE_KEY_PATH'), 'utf8');
  }

  private publicKey(): string {
    return readFileSync(this.config.getOrThrow<string>('JWT_PUBLIC_KEY_PATH'), 'utf8');
  }
}
