import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import type { IPasswordHasher } from './interfaces/password-hasher.interface';

/**
 * argon2id (the library's default algorithm) with the OWASP-minimum parameters. The seeded User's hash in
 * db/changelog/F-1/004-seed-test-user.yaml was computed with the same ones. `verify` reads the parameters from
 * the stored hash, so hashes made with other parameters keep verifying if these ever change.
 */
const HASH_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

@Injectable()
export class Argon2PasswordHasher implements IPasswordHasher {
  hash(password: string): Promise<string> {
    return hash(password, HASH_OPTIONS);
  }

  verify(passwordHash: string, password: string): Promise<boolean> {
    return verify(passwordHash, password);
  }
}
