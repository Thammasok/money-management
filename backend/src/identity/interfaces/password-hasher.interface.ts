/** Slow, salted password hashing (argon2id). In-process; real in integration tests. */
export interface IPasswordHasher {
  /** Returns a self-describing hash string (PHC format: algorithm, parameters, salt, hash). */
  hash(password: string): Promise<string>;
  /** True only when `password` produced `passwordHash`. Never throws for a wrong password. */
  verify(passwordHash: string, password: string): Promise<boolean>;
}
