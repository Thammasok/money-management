import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { LedgerRepository } from '../src/ledger/ledger.repository';
import type { NewTransaction } from '../src/ledger/transaction.entity';
import {
  backdateWallet,
  createTestPool,
  insertUser,
  TEST_DATABASE_URL,
  waitUntilWaitingForALock,
} from './support/database';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_MINOR = 999999999999999n;

// Data Access under test: nothing mocked — real Postgres, schema from Liquibase (changesets F-2/001, F-2/002, F-3/001).
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

  /** A stored Wallet whose timestamps are an hour old, so any change to it is provably later (see `backdateWallet`). */
  async function aBackdatedWallet(overrides: Parameters<typeof aStoredWallet>[0] = {}) {
    const stored = await aStoredWallet(overrides);
    await backdateWallet(pool, stored.id);
    const wallet = await repository.findOwnedWallet(stored.userId, stored.id);
    if (wallet === null) {
      throw new Error('expected the Wallet to exist');
    }
    return wallet;
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

  /** Records a Transaction in a Wallet that is expected to accept it (an Archived Wallet answers null instead). */
  async function aStoredTransaction(walletId: string, overrides: Partial<NewTransaction> = {}) {
    const transaction = await repository.insertTransaction(aNewTransaction(walletId, overrides));
    if (transaction === null) {
      throw new Error('expected the Wallet to accept the Transaction');
    }
    return transaction;
  }

  /** Archives a Wallet straight in SQL, the way only an owner can through the API — for tests that need one Archived. */
  async function archiveInSql(walletId: string): Promise<void> {
    await pool.query('UPDATE wallets SET archived_at = now(), updated_at = now() WHERE id = $1', [
      walletId,
    ]);
  }

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
        archivedAt: null,
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
      expect(wallets.map((item) => item.wallet.id)).toEqual([second.id, first.id]);
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
      expect(wallets.map((item) => item.wallet.id)).toEqual([high, middle, low]);
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

  // F-3 walking skeleton (S-1): the Wallet Overview reads every owned Wallet with its Balance, derived in SQL.
  describe('listWalletsOwnedBy — the Wallet Overview', () => {
    it('S-1: lists each owned Wallet with its Balance — Opening Balance + Income − Expense — newest first', async () => {
      // Arrange: Cash (with an Expense), Bank, Card — created in that order, across two Currencies
      const userId = await insertUser(pool, 'overview');
      const cash = await aStoredWallet({ userId, name: 'Cash', openingBalanceMinor: 100000n });
      const bank = await aStoredWallet({ userId, name: 'Bank', openingBalanceMinor: 250000n });
      const card = await aStoredWallet({
        userId,
        name: 'Card',
        currency: 'USD',
        openingBalanceMinor: 1000n,
      });
      await aStoredTransaction(cash.id, { amountMinor: 12550n });

      // Act
      const overview = await repository.listWalletsOwnedBy(userId);

      // Assert
      expect(overview).toEqual([
        { wallet: card, balanceMinor: 1000n },
        { wallet: bank, balanceMinor: 250000n },
        { wallet: cash, balanceMinor: 87450n },
      ]);
    });

    it('counts only each Wallet’s own Transactions, and only the owner’s Wallets, in the Balances', async () => {
      // Arrange
      const userId = await insertUser(pool, 'overview-own');
      const mine = await aStoredWallet({ userId, openingBalanceMinor: 1000n });
      const alsoMine = await aStoredWallet({ userId, name: 'Bank', openingBalanceMinor: 1000n });
      const theirs = await aStoredWallet({ name: 'Somebody else’s', openingBalanceMinor: 1000n });
      await aStoredTransaction(mine.id, { amountMinor: 100n });
      await aStoredTransaction(alsoMine.id, { kind: 'income', amountMinor: 7n, note: null });
      await aStoredTransaction(theirs.id, { amountMinor: 999n });

      // Act
      const overview = await repository.listWalletsOwnedBy(userId);

      // Assert
      expect(overview.map((item) => [item.wallet.id, item.balanceMinor])).toEqual([
        [alsoMine.id, 1007n],
        [mine.id, 900n],
      ]);
    });

    it('S-4: keeps an Archived Wallet in its place in the order, with its archivedAt and its Balance', async () => {
      // Arrange: Old is created first, so it is the oldest; archiving it must not move it
      const userId = await insertUser(pool, 'overview-archived');
      const old = await aStoredWallet({ userId, name: 'Old Card', openingBalanceMinor: 50000n });
      const recent = await aStoredWallet({ userId, name: 'Recent', openingBalanceMinor: 100n });
      await aStoredTransaction(old.id, { amountMinor: 2000n });
      await archiveInSql(old.id);

      // Act
      const overview = await repository.listWalletsOwnedBy(userId);

      // Assert
      expect(overview.map((item) => item.wallet.id)).toEqual([recent.id, old.id]);
      expect(overview[0].wallet.archivedAt).toBeNull();
      expect(overview[1].wallet.archivedAt).toBeInstanceOf(Date);
      expect(overview[1].balanceMinor).toBe(48000n);
    });

    it('S-7: derives a negative Balance, and a Balance of zero, exactly', async () => {
      // Arrange
      const userId = await insertUser(pool, 'overview-signs');
      const yen = await aStoredWallet({ userId, currency: 'JPY', openingBalanceMinor: 0n });
      const minus = await aStoredWallet({ userId, name: 'Minus', openingBalanceMinor: -250075n });
      await aStoredTransaction(yen.id, { amountMinor: 1500n });
      await aStoredTransaction(minus.id, { kind: 'income', amountMinor: 250075n, note: null });

      // Act
      const overview = await repository.listWalletsOwnedBy(userId);

      // Assert: newest first — Minus, then Yen
      expect(overview.map((item) => item.balanceMinor)).toEqual([0n, -1500n]);
    });

    it('IT-F3-02: reads Balances beyond 2^53 exactly, where a float would round (AC-1.5)', async () => {
      // Arrange: opening 999999999999999 + 10 Incomes of 999999999999999 = 10999999999999989, in two Wallets
      const userId = await insertUser(pool, 'overview-big');
      const first = await aStoredWallet({
        userId,
        currency: 'KRW',
        openingBalanceMinor: MAX_MINOR,
      });
      const second = await aStoredWallet({
        userId,
        name: 'Second',
        currency: 'KRW',
        openingBalanceMinor: MAX_MINOR,
      });
      for (const walletId of [first.id, second.id]) {
        for (let i = 0; i < 10; i++) {
          await aStoredTransaction(walletId, {
            kind: 'income',
            amountMinor: MAX_MINOR,
            note: null,
          });
        }
      }

      // Act
      const overview = await repository.listWalletsOwnedBy(userId);

      // Assert
      const exact = 10999999999999989n;
      expect(overview.map((item) => item.balanceMinor)).toEqual([exact, exact]);
      expect(BigInt(Number(exact))).not.toBe(exact); // the premise: a float cannot hold this value
    });
  });

  // F-3: rename and archive are ONE statement, owner-only, and all-or-nothing.
  describe('updateOwnedWallet — rename and archive', () => {
    it('S-3: renames the Wallet and answers it with its Balance; the Currency and the money are untouched and updatedAt moves on', async () => {
      // Arrange
      const wallet = await aBackdatedWallet({ name: 'Cash', openingBalanceMinor: 100000n });
      await aStoredTransaction(wallet.id, { amountMinor: 12550n });

      // Act
      const updated = await repository.updateOwnedWallet(wallet.userId, wallet.id, {
        name: 'Daily Cash',
        archive: false,
      });

      // Assert
      expect(updated).toEqual({
        wallet: { ...wallet, name: 'Daily Cash', updatedAt: expect.any(Date) },
        balanceMinor: 87450n,
      });
      expect(updated?.wallet.updatedAt.getTime()).toBeGreaterThan(wallet.updatedAt.getTime());
    });

    it('S-4: archives the Wallet — archivedAt is stamped with the same Postgres time as updatedAt — and keeps its name, money and Transactions', async () => {
      // Arrange
      const wallet = await aStoredWallet({ openingBalanceMinor: 50000n });
      const lunch = await aStoredTransaction(wallet.id, { amountMinor: 2000n });

      // Act
      const archived = await repository.updateOwnedWallet(wallet.userId, wallet.id, {
        name: null,
        archive: true,
      });
      const detail = await repository.findOwnedWalletDetail(wallet.userId, wallet.id);

      // Assert
      expect(archived?.wallet.archivedAt).toBeInstanceOf(Date);
      expect(archived?.wallet.archivedAt).toEqual(archived?.wallet.updatedAt);
      expect(archived?.wallet.name).toBe(wallet.name);
      expect(archived?.balanceMinor).toBe(48000n);
      expect(detail?.transactions).toEqual([lunch]);
    });

    it('IT-F3-04: renames and archives in ONE statement — both are applied together, with one timestamp (updatedAt = archivedAt)', async () => {
      // Arrange
      const wallet = await aStoredWallet({ name: 'Both' });

      // Act
      const updated = await repository.updateOwnedWallet(wallet.userId, wallet.id, {
        name: 'Both Done',
        archive: true,
      });

      // Assert
      expect(updated?.wallet.name).toBe('Both Done');
      expect(updated?.wallet.archivedAt).toBeInstanceOf(Date);
      expect(updated?.wallet.updatedAt).toEqual(updated?.wallet.archivedAt);
    });

    it('AC-2.5: renames an Archived Wallet — it stays archived, with the same archivedAt', async () => {
      // Arrange
      const wallet = await aStoredWallet({ name: 'Old Card' });
      await archiveInSql(wallet.id);
      const before = await repository.findOwnedWallet(wallet.userId, wallet.id);

      // Act
      const renamed = await repository.updateOwnedWallet(wallet.userId, wallet.id, {
        name: 'Old Visa',
        archive: false,
      });

      // Assert
      expect(renamed?.wallet.name).toBe('Old Visa');
      expect(renamed?.wallet.archivedAt).toEqual(before?.archivedAt);
    });

    it('S-13: refuses to archive an Archived Wallet — null, and the whole change is refused: a name sent along is not applied, nothing moves', async () => {
      // Arrange
      const wallet = await aStoredWallet({ name: 'Old Card' });
      await archiveInSql(wallet.id);
      const before = await repository.findOwnedWallet(wallet.userId, wallet.id);

      // Act
      const refused = await repository.updateOwnedWallet(wallet.userId, wallet.id, {
        name: 'Renamed with the archive',
        archive: true,
      });
      const after = await repository.findOwnedWallet(wallet.userId, wallet.id);

      // Assert
      expect(refused).toBeNull();
      expect(after).toEqual(before);
    });

    it('S-14: answers null for another User’s Wallet and for a missing id, and leaves the owner’s Wallet untouched', async () => {
      // Arrange
      const wallet = await aStoredWallet({ name: 'A-Cash' });
      const intruderId = await insertUser(pool, 'intruder');

      // Act
      const asIntruder = await repository.updateOwnedWallet(intruderId, wallet.id, {
        name: 'Mine now',
        archive: true,
      });
      const missing = await repository.updateOwnedWallet(wallet.userId, randomUUID(), {
        name: 'Nothing',
        archive: false,
      });
      const after = await repository.findOwnedWallet(wallet.userId, wallet.id);

      // Assert
      expect(asIntruder).toBeNull();
      expect(missing).toBeNull();
      expect(after).toEqual(wallet);
    });

    it('S-13: of two archives at the same moment exactly one wins — the other is refused (null)', async () => {
      // Arrange
      const wallet = await aStoredWallet();
      const archive = () =>
        repository.updateOwnedWallet(wallet.userId, wallet.id, { name: null, archive: true });

      // Act
      const outcomes = await Promise.all([archive(), archive()]);

      // Assert
      expect(outcomes.filter((outcome) => outcome !== null)).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome === null)).toHaveLength(1);
    });
  });

  describe('transactions', () => {
    it('stores a Transaction and returns it with a generated UUID, the exact bigint amount and the date as a string', async () => {
      // Arrange
      const wallet = await aStoredWallet();

      // Act
      const transaction = await aStoredTransaction(wallet.id);

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
      const transaction = await aStoredTransaction(wallet.id, { note: null });

      // Assert
      expect(transaction.note).toBeNull();
    });

    it('S-12: stores nothing and answers null for an Archived Wallet, whose history stays as it was', async () => {
      // Arrange
      const wallet = await aStoredWallet({ openingBalanceMinor: 10000n });
      const kept = await aStoredTransaction(wallet.id, { kind: 'income', amountMinor: 500n });
      await archiveInSql(wallet.id);

      // Act
      const transaction = await repository.insertTransaction(aNewTransaction(wallet.id));
      const detail = await repository.findOwnedWalletDetail(wallet.userId, wallet.id);

      // Assert
      expect(transaction).toBeNull();
      expect(detail?.transactions).toEqual([kept]);
      expect(detail?.balanceMinor).toBe(10500n);
    });

    it('answers null, not a foreign-key error, for a Wallet that does not exist', async () => {
      // Arrange
      const missingWalletId = randomUUID();

      // Act
      const transaction = await repository.insertTransaction(aNewTransaction(missingWalletId));

      // Assert
      expect(transaction).toBeNull();
    });

    // IT-F3-01 (artifacts/F-3/06-api-test-plan.md): the check "is the Wallet archived?" and the insert must not be
    // two steps an archive can slip between. The archive is held in flight on its own connection (row locked, not
    // committed): the insert starts meanwhile, must really wait, and may answer only once the archive's outcome is
    // known — refused after a commit, stored after a rollback. A plain check-then-insert (or a conditional INSERT
    // without the row lock) would not wait at all, and the helper below would time out.
    describe('IT-F3-01: archive versus record', () => {
      let monitor: Pool;

      beforeEach(() => {
        monitor = createTestPool();
      });

      afterEach(async () => {
        await monitor.end();
      });

      /** Runs an insert against a Wallet whose archive is in flight, ends that archive with `ending`, and answers the insert. */
      async function insertWhileAnArchiveIsInFlight(
        walletId: string,
        ending: 'COMMIT' | 'ROLLBACK',
      ) {
        const archiver = await pool.connect();
        try {
          await archiver.query('BEGIN');
          await archiver.query(
            'UPDATE wallets SET archived_at = now(), updated_at = now() WHERE id = $1',
            [walletId],
          );
          const insertion = repository.insertTransaction(aNewTransaction(walletId));
          await waitUntilWaitingForALock(monitor, 'INSERT INTO transactions');
          await archiver.query(ending);
          return await insertion;
        } finally {
          await archiver.query('ROLLBACK').catch(() => undefined); // a no-op once the archive has ended
          archiver.release();
        }
      }

      it('an insert that starts while an archive is in flight waits for it, and is refused (null) once the archive commits', async () => {
        // Arrange
        const wallet = await aStoredWallet();

        // Act
        const transaction = await insertWhileAnArchiveIsInFlight(wallet.id, 'COMMIT');
        const detail = await repository.findOwnedWalletDetail(wallet.userId, wallet.id);

        // Assert: nothing was stored, and the Wallet is archived
        expect(transaction).toBeNull();
        expect(detail?.transactions).toEqual([]);
        expect(detail?.wallet.archivedAt).toBeInstanceOf(Date);
      });

      it('an insert that waited for an archive that was rolled back is stored — it was refused only because the archive won, not because it waited', async () => {
        // Arrange
        const wallet = await aStoredWallet();

        // Act
        const transaction = await insertWhileAnArchiveIsInFlight(wallet.id, 'ROLLBACK');
        const detail = await repository.findOwnedWalletDetail(wallet.userId, wallet.id);

        // Assert
        expect(transaction?.walletId).toBe(wallet.id);
        expect(detail?.transactions).toHaveLength(1);
        expect(detail?.wallet.archivedAt).toBeNull();
      });
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
      const recent = await aStoredTransaction(wallet.id, {
        occurredOn: '2026-10-29',
        note: 'recent',
      });
      const older = await aStoredTransaction(wallet.id, {
        occurredOn: '2026-10-26',
        note: 'older',
      });

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
      const first = await aStoredTransaction(wallet.id, { note: 'A' });
      const second = await aStoredTransaction(wallet.id, { note: 'B' });

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
      const recorded = await aStoredTransaction(wallet.id, { occurredOn });
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

    it('refuses a Transaction for a Wallet that does not exist (raw SQL: the repository answers null before it gets that far)', async () => {
      // Arrange / Act
      const insertion = pool.query(
        `INSERT INTO transactions (wallet_id, kind, amount_minor, occurred_on)
         VALUES ($1, 'expense', 1, '2026-10-29')`,
        [randomUUID()],
      );

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

  // IT-F3-03 (artifacts/F-3/06-api-test-plan.md): the F-3 changeset is expand-only, so the F-2 release keeps working
  // on the new schema (the rollback drill of the deployment track).
  describe('IT-F3-03: wallets.archived_at', () => {
    it('is a nullable timestamptz with no default and no backfill', async () => {
      // Arrange / Act
      const { rows } = await pool.query(
        `SELECT data_type, is_nullable, column_default FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'wallets' AND column_name = 'archived_at'`,
      );

      // Assert
      expect(rows).toEqual([
        { data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null },
      ]);
    });

    it('leaves a Wallet that an F-2 release inserts — it never names the column — active', async () => {
      // Arrange
      const userId = await insertUser(pool);

      // Act
      const { rows } = await pool.query(
        `INSERT INTO wallets (user_id, name, currency, opening_balance_minor)
         VALUES ($1, 'Written by F-2', 'THB', 0) RETURNING archived_at`,
        [userId],
      );

      // Assert
      expect(rows).toEqual([{ archived_at: null }]);
    });
  });
});
