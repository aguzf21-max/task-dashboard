import { Body, Controller, HttpCode, Ip, Post, Res } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import type { Response } from 'express';
import { Req } from '@nestjs/common';
import type { Request } from 'express';

import { TenantContext } from '../tenancy/tenant-context.service';
import { AuthService } from './auth.service';

class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(12) password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tenant: TenantContext,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: LoginDto,
    @Ip() ip: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(this.tenant.tenant, body.email, body.password, ip);
    response.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return { accessToken: result.accessToken };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = request.headers.cookie
      ?.split('; ')
      .find((value) => value.startsWith('refresh_token='))
      ?.slice('refresh_token='.length);
    if (!refreshToken) throw new Error('Refresh token cookie is required');
    const result = await this.auth.rotateRefreshToken(this.tenant.tenant, refreshToken);
    response.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return { accessToken: result.accessToken };
  }
}
