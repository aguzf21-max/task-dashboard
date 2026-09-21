import * as argon2 from 'argon2';
import { Injectable } from '@nestjs/common';

export const ARGON2ID_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const;

@Injectable()
export class PasswordService {
  hash(password: string): Promise<string> {
    return argon2.hash(password, ARGON2ID_OPTIONS);
  }

  verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }
}
