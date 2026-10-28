import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { LedgerRepository } from '../src/ledger/ledger.repository';
import type { NewTransaction } from '../src/ledger/transaction.entity';
import { createTestPool, insertUser, TEST_DATABASE_URL } from './support/database';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_MINOR = 999999999999999n;

// Data Access under test: nothing mocked — real Postgres, schema from Liquibase (changesets F-2/001, F-2/002).
describe('LedgerRepository (real Postgres)', () => {
  let pool: Pool;
  let repository: LedgerRepository;

  beforeAll(() => {
    pool = createTestPool();
    repository = new LedgerRepository(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  async function aStoredWallet(
    overrides: Partial<{
      userId: string;
      name: string;
      currency: string;
      openingBalanceMinor: bigint;
    }> = {},
  ) {
    return repository.insertWallet({
      userId: overrides.userId ?? (await insertUser(pool)),
      name: overrides.name ?? 'Cash',
      currency: overrides.currency ?? 'THB',
      openingBalanceMinor: overrides.openingBalanceMinor ?? 100000n,
    });
  }

  /** Three fresh UUIDs that differ only in their last character, so their order is known (the database is shared across runs). */
  const idsInAscendingOrder = (): [string, string, string] => {
    const prefix = randomUUID().slice(0, 35);
    return [`${prefix}1`, `${prefix}2`, `${prefix}3`];
  };

  const aNewTransaction = (walletId: string, overrides: Partial<NewTransaction> = {}) => ({
    walletId,
    kind: 'expense' as const,
    amountMinor: 12550n,
    occurredOn: '2026-10-29',
    note: 'Lunch',
    ...overrides,
  });

  describe('wallets', () => {
    it('stores a Wallet and returns it with a generated UUID and timestamps', async () => {
      // Arrange
      const userId = await insertUser(pool);

      // Act
      const wallet = await repository.insertWallet({
        userId,
        name: 'Cash',
        currency: 'THB',
        openingBalanceMinor: 100000n,
      });

      // Assert
      expect(wallet.id).toMatch(UUID_SHAPE);
      expect(wallet).toEqual({
        id: wallet.id,
        userId,
        name: 'Cash',
        currency: 'THB',
        openingBalanceMinor: 100000n,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it.each([
      ['the largest 15-digit Opening Balance', MAX_MINOR],
      ['the smallest (negative) 15-digit Opening Balance', -MAX_MINOR],
      ['zero', 0n],
    ])('IT-02: round-trips %s exactly as a bigint', async (_why, openingBalanceMinor) => {
      // Arrange
      const stored = await aStoredWallet({ openingBalanceMinor });

      // Act
      const found = await repository.findOwnedWallet(stored.userId, stored.id);

      // Assert
      expect(stored.openingBalanceMinor).toBe(openingBalanceMinor);
      expect(found?.openingBalanceMinor).toBe(openingBalanceMinor);
    });

    it('lists only the Wallets the User owns, newest first', async () => {
      // Arrange
      const userId = await insertUser(pool, 'lister');
      const first = await aStoredWallet({ userId, name: 'Cash' });
      const second = await aStoredWallet({ userId, name: 'Bank', currency: 'USD' });
      await aStoredWallet({ name: 'Somebody else’s' });

      // Act
      const wallets = await repository.listWalletsOwnedBy(userId);

      // Assert
      expect(wallets.map((wallet) => wallet.id)).toEqual([second.id, first.id]);
    });

    it('breaks a tie on createdAt by id, descending', async () => {
      // Arrange: three ids that differ only in their last character, so their order is known on every run
      const userId = await insertUser(pool, 'tie');
      const [low, middle, high] = idsInAscendingOrder();
      const insert = (id: string) =>
        pool.query(
          `INSERT INTO wallets (id, user_id, name, currency, opening_balance_minor, created_at)
           VALUES ($1, $2, 'Tied', 'THB', 0, '2026-10-29T10:00:00Z')`,
          [id, userId],
        );
      await insert(low);
      await insert(high);
      await insert(middle);

      // Act
      const wallets = await repository.listWalletsOwnedBy(userId);

      // Assert
      expect(wallets.map((wallet) => wallet.id)).toEqual([high, middle, low]);
    });

    it('lists nothing for a User with no Wallets', async () => {
      // Arrange
      const userId = await insertUser(pool, 'empty');

      // Act
      const wallets = await repository.listWalletsOwnedBy(userId);

      // Assert
      expect(wallets).toEqual([]);
    });

    it('finds a Wallet for its owner, and answers null for another User’s Wallet exactly as for a missing id', async () => {
      // Arrange
      const wallet = await aStoredWallet();
      const intruderId = await insertUser(pool, 'intruder');

      // Act
      const asOwner = await repository.findOwnedWallet(wallet.userId, wallet.id);
      const asIntruder = await repository.findOwnedWallet(intruderId, wallet.id);
      const missing = await repository.findOwnedWallet(wallet.userId, randomUUID());

      // Assert
      expect(asOwner).toEqual(wallet);
      expect(asIntruder).toBeNull();
      expect(missing).toBeNull();
    });
  });

  describe('transactions', () => {
    it('stores a Transaction and returns it with a generated UUID, the exact bigint amount and the date as a string', async () => {
      // Arrange
      const wallet = await aStoredWallet();

      // Act
      const transaction = await repository.insertTransaction(aNewTransaction(wallet.id));

      // Assert
      expect(transaction.id).toMatch(UUID_SHAPE);
      expect(transaction).toEqual({
        id: transaction.id,
        walletId: wallet.id,
        kind: 'expense',
        amountMinor: 12550n,
        occurredOn: '2026-10-29',
        note: 'Lunch',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('stores no note as null', async () => {
      // Arrange
      const wallet = await aStoredWallet();

      // Act
      const transaction = await repository.insertTransaction(
        aNewTransaction(wallet.id, { note: null }),
      );

      // Assert
      expect(transaction.note).toBeNull();
    });
  });

  describe('findOwnedWalletDetail', () => {
    it('answers the Wallet with Balance = Opening Balance and no Transactions when none were recorded', async () => {
      // Arrange
      const wallet = await aStoredWallet({ openingBalanceMinor: 1230n, currency: 'EUR' });

      // Act
      const detail = await repository.findOwnedWalletDetail(wallet.userId, wallet.id);

      // Assert
      expect(detail).toEqual({ wallet, balanceMinor: 1230n, transactions: [] });
    });

    it('derives the Balance as Opening Balance + Income − Expense (S-1, S-2)', async () => {
      // Arrange
      const wallet = await aStoredWallet({ openingBalanceMinor: 100000n });
      await repository.insertTransaction(aNewTransaction(wallet.id, { amountMinor: 12550n }));
      await repository.insertTransaction(
        aNewTransaction(wallet.id, { kind: 'income', amountMinor: 200000n, note: null }),
      );

      // Act
      const detail = await repository.findOwnedWalletDetail(wallet.userId, wallet.id);

      // Assert
      expect(detail?.balanceMinor).toBe(287450n);
    });

    it('derives a negative Balance when Expense exceeds what the Wallet holds (S-4)', async () => {
      // Arrange
      const wallet = await aStoredWallet({ currency: 'JPY', openingBalanceMinor: 0n });
      await repository.insertTransaction(aNewTransaction(wallet.id, { amountMinor: 1500n }));

      // Act
      const detail = await repository.findOwnedWalletDetail(wallet.userId, wallet.id);

      // Assert
      expect(detail?.balanceMinor).toBe(-1500n);
    });

    it('IT-02: sums 11 × 999999999999999 to the exact value, past 2^53, where a float would round', async () => {
      // Arrange
      const wallet = await aStoredWallet({ openingBalanceMinor: MAX_MINOR });
      for (let i = 0; i < 10; i++) {
        await repository.insertTransaction(
          aNewTransaction(wallet.id, { kind: 'income', amountMinor: MAX_MINOR, note: null }),
        );
      }

      // Act
      const detail = await repository.findOwnedWalletDetail(wallet.userId, wallet.id);

      // Assert
      const exact = 10999999999999989n;
      expect(detail?.balanceMinor).toBe(exact);
      expect(BigInt(Number(exact))).not.toBe(exact); // the premise: a float cannot hold this value
    });

    it('IT-02: sums three Expenses of 999999999999999 to exactly −2999999999999997', async () => {
      // Arrange
      const wallet = await aStoredWallet({ openingBalanceMinor: 0n });
      for (let i = 0; i < 3; i++) {
        await repository.insertTransaction(aNewTransaction(wallet.id, { amountMinor: MAX_MINOR }));
      }

      // Act
      const detail = await repository.findOwnedWalletDetail(wallet.userId, wallet.id);

      // Assert
      expect(detail?.balanceMinor).toBe(-2999999999999997n);
    });

    it('counts only the Wallet’s own Transactions in its Balance and its list', async () => {
      // Arrange
      const userId = await insertUser(pool, 'two-wallets');
      const cash = await aStoredWallet({ userId, openingBalanceMinor: 1000n });
      const bank = await aStoredWallet({ userId, name: 'Bank', openingBalanceMinor: 1000n });
      await repository.insertTransaction(aNewTransaction(cash.id, { amountMinor: 100n }));
      await repository.insertTransaction(aNewTransaction(bank.id, { amountMinor: 7n }));

      // Act
      const detail = await repository.findOwnedWalletDetail(userId, cash.id);

      // Assert
      expect(detail?.balanceMinor).toBe(900n);
      expect(detail?.transactions).toHaveLength(1);
      expect(detail?.transactions[0].walletId).toBe(cash.id);
    });

    it('lists the newest occurredOn first even when it was recorded earlier (S-9)', async () => {
      // Arrange
      const wallet = await aStoredWallet();
      const recent = await repository.insertTransaction(
        aNewTransaction(wallet.id, { occurredOn: '2026-10-29', note: 'recent' }),
      );
      const older = await repository.insertTransaction(
        aNewTransaction(wallet.id, { occurredOn: '2026-10-26', note: 'older' }),
      );

      // Act
      const detail = await repository.findOwnedWalletDetail(wallet.userId, wallet.id);

      // Assert
      expect(detail?.transactions.map((transaction) => transaction.id)).toEqual([
        recent.id,
        older.id,
      ]);
    });

    it('IT-04: lists the Transaction recorded later first when two share a date', async () => {
      // Arrange
      const wallet = await aStoredWallet();
      const first = await repository.insertTransaction(aNewTransaction(wallet.id, { note: 'A' }));
      const second = await repository.insertTransaction(aNewTransaction(wallet.id, { note: 'B' }));

      // Act
      const detail = await repository.findOwnedWalletDetail(wallet.userId, wallet.id);

      // Assert
      expect(detail?.transactions.map((transaction) => transaction.id)).toEqual([
        second.id,
        first.id,
      ]);
    });

    it('breaks a tie on date and createdAt by id, descending', async () => {
      // Arrange
      const wallet = await aStoredWallet();
      const [low, middle, high] = idsInAscendingOrder();
      const insert = (id: string) =>
        pool.query(
          `INSERT INTO transactions (id, wallet_id, kind, amount_minor, occurred_on, created_at)
           VALUES ($1, $2, 'expense', 1, '2026-10-29', '2026-10-29T10:00:00Z')`,
          [id, wallet.id],
        );
      await insert(low);
      await insert(high);
      await insert(middle);

      // Act
      const detail = await repository.findOwnedWalletDetail(wallet.userId, wallet.id);

      // Assert
      expect(detail?.transactions.map((transaction) => transaction.id)).toEqual([
        high,
        middle,
        low,
      ]);
    });

    it('answers null for another User’s Wallet and for a missing id, without a hint that the Wallet exists (S-20, S-21)', async () => {
      // Arrange
      const wallet = await aStoredWallet();
      await repository.insertTransaction(aNewTransaction(wallet.id));
      const intruderId = await insertUser(pool, 'intruder');

      // Act
      const asIntruder = await repository.findOwnedWalletDetail(intruderId, wallet.id);
      const missing = await repository.findOwnedWalletDetail(wallet.userId, randomUUID());

      // Assert
      expect(asIntruder).toBeNull();
      expect(missing).toBeNull();
    });

    it('releases its connection however it ends, so a pool of two never starves', async () => {
      // Arrange
      const wallet = await aStoredWallet();
      const failing = () => repository.findOwnedWalletDetail(wallet.userId, 'not-a-uuid');
      const working = () => repository.findOwnedWalletDetail(wallet.userId, wallet.id);

      // Act: three reads Postgres refuses (not a UUID), then six good ones, all on a pool of two connections
      const refused = await Promise.allSettled([failing(), failing(), failing()]);
      const served = await Promise.all(Array.from({ length: 6 }, working));

      // Assert: had a failed read kept its connection, the later reads would have waited forever
      expect(refused.map((outcome) => outcome.status)).toEqual([
        'rejected',
        'rejected',
        'rejected',
      ]);
      expect(served.map((detail) => detail?.wallet.id)).toEqual(Array(6).fill(wallet.id));
    });
  });

  // IT-01 (artifacts/F-2/06-api-test-plan.md): AD-1 — a Transaction's date is a calendar date; reading it back must
  // never depend on the timezone of the process.
  describe('IT-01: a DATE is read back as the exact string whatever the process timezone is', () => {
    const originalTimeZone = process.env.TZ;

    afterEach(() => {
      if (originalTimeZone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTimeZone;
      }
    });

    it.each([
      ['Asia/Bangkok', '2024-02-29'],
      ['Asia/Bangkok', '2024-12-31'],
      ['Asia/Bangkok', '0001-01-01'],
      ['America/Los_Angeles', '2024-02-29'],
      ['America/Los_Angeles', '2024-12-31'],
      ['America/Los_Angeles', '0001-01-01'],
    ])('under TZ=%s, %s goes in and comes out unchanged', async (timeZone, occurredOn) => {
      // Arrange
      process.env.TZ = timeZone;
      const wallet = await aStoredWallet();

      // Act
      const recorded = await repository.insertTransaction(
        aNewTransaction(wallet.id, { occurredOn }),
      );
      const detail = await repository.findOwnedWalletDetail(wallet.userId, wallet.id);

      // Assert
      expect(recorded.occurredOn).toBe(occurredOn);
      expect(detail?.transactions[0].occurredOn).toBe(occurredOn);
    });

    it('premise: pg’s own default parser WOULD have moved the day east of Greenwich — that is why the Pool is configured', async () => {
      // Arrange
      process.env.TZ = 'Asia/Bangkok';
      const plainPool = new Pool({ connectionString: TEST_DATABASE_URL, max: 1 });

      // Act
      const { rows } = await plainPool.query<{ day: Date }>("SELECT '2024-02-29'::date AS day");
      await plainPool.end();

      // Assert
      expect(rows[0].day).toBeInstanceOf(Date);
      expect(rows[0].day.toISOString()).toBe('2024-02-28T17:00:00.000Z');
    });
  });

  // IT-03: defence in depth — what the database itself refuses, whatever the application does.
  describe('IT-03: constraints', () => {
    it.each([
      ['wallets_user_id_fkey', 'wallets'],
      ['transactions_wallet_id_fkey', 'transactions'],
    ])('%s exists and is ON DELETE RESTRICT', async (constraint, table) => {
      // Arrange / Act
      const { rows } = await pool.query<{ delete_rule: string }>(
        `SELECT confdeltype AS delete_rule FROM pg_constraint
         WHERE conname = $1 AND conrelid = $2::regclass AND contype = 'f'`,
        [constraint, table],
      );

      // Assert
      expect(rows).toEqual([{ delete_rule: 'r' }]);
    });

    it('refuses to delete a User who owns a Wallet — nothing cascades away money data', async () => {
      // Arrange
      const wallet = await aStoredWallet();

      // Act
      const deletion = pool.query('DELETE FROM users WHERE id = $1', [wallet.userId]);

      // Assert
      await expect(deletion).rejects.toThrow(/wallets_user_id_fkey/);
    });

    it('refuses to delete a Wallet that has Transactions', async () => {
      // Arrange
      const wallet = await aStoredWallet();
      await repository.insertTransaction(aNewTransaction(wallet.id));

      // Act
      const deletion = pool.query('DELETE FROM wallets WHERE id = $1', [wallet.id]);

      // Assert
      await expect(deletion).rejects.toThrow(/transactions_wallet_id_fkey/);
    });

    it('refuses a Wallet for a User that does not exist', async () => {
      // Arrange / Act
      const insertion = repository.insertWallet({
        userId: randomUUID(),
        name: 'Orphan',
        currency: 'THB',
        openingBalanceMinor: 0n,
      });

      // Assert
      await expect(insertion).rejects.toThrow(/wallets_user_id_fkey/);
    });

    it('refuses a Transaction for a Wallet that does not exist', async () => {
      // Arrange / Act
      const insertion = repository.insertTransaction(aNewTransaction(randomUUID()));

      // Assert
      await expect(insertion).rejects.toThrow(/transactions_wallet_id_fkey/);
    });

    it.each([
      ['an empty name', { name: '' }, /wallets_name_length/],
      ['a 61-character name', { name: 'W'.repeat(61) }, /wallets_name_length/],
      ['a lower-case Currency code', { currency: 'thb' }, /wallets_currency_code/],
      ['a four-letter Currency code', { currency: 'THBX' }, /value too long|wallets_currency_code/],
    ])('refuses a Wallet with %s', async (_why, overrides, expected) => {
      // Arrange
      const userId = await insertUser(pool);

      // Act
      const insertion = repository.insertWallet({
        userId,
        name: 'Cash',
        currency: 'THB',
        openingBalanceMinor: 0n,
        ...overrides,
      });

      // Assert
      await expect(insertion).rejects.toThrow(expected);
    });

    it.each([
      ['a zero amount', { amountMinor: 0n }, /transactions_amount_minor_positive/],
      ['a negative amount', { amountMinor: -5n }, /transactions_amount_minor_positive/],
      [
        'a Kind that is neither income nor expense',
        { kind: 'transfer' },
        /transactions_kind_valid/,
      ],
      ['a 201-character note', { note: 'n'.repeat(201) }, /transactions_note_length/],
    ])('refuses a Transaction with %s', async (_why, overrides, expected) => {
      // Arrange
      const wallet = await aStoredWallet();

      // Act
      const insertion = repository.insertTransaction({
        ...aNewTransaction(wallet.id),
        ...overrides,
      } as NewTransaction);

      // Assert
      await expect(insertion).rejects.toThrow(expected);
    });
  });
});
