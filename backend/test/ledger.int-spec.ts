import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Pool } from 'pg';
import request from 'supertest';
import { SUPPORTED_CURRENCIES } from '../src/rates/supported-currencies';
import { createTestApp } from './support/create-app';
import { backdateWallet, createTestPool, uniqueEmail } from './support/database';

const PASSWORD = 'Sunny-Day-42';
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** The run's "now", read once: a test that straddles local midnight must never see two different todays. */
const RUN_STARTED_AT = new Date();

/** The runner's local calendar date `offsetDays` from today — the same construction the Web App uses (never UTC). */
function localDate(offsetDays = 0): string {
  const date = new Date(RUN_STARTED_AT);
  date.setDate(date.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// The whole Ledger + Exchange Rates stack — guard, controller, service, repository, real Postgres — through HTTP.
// Every test signs up its own User, so tests never depend on each other or on earlier runs.
describe('Ledger (HTTP, real Postgres)', () => {
  let app: NestExpressApplication;
  let pool: Pool;

  beforeAll(async () => {
    app = await createTestApp();
    pool = createTestPool();
  });

  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  const server = () => app.getHttpServer();

  /** Signs a fresh User up through the real Identity module; returns the Session cookie the other calls send. */
  async function signUp(prefix = 'ledger'): Promise<string> {
    const response = await request(server())
      .post('/api/v1/users')
      .send({ email: uniqueEmail(prefix), password: PASSWORD })
      .expect(201);
    const cookies = (response.headers['set-cookie'] ?? []) as unknown as string[];
    const sid = cookies.find((cookie) => cookie.startsWith('sid='));
    if (sid === undefined) throw new Error('sign-up set no sid cookie');
    return sid.slice('sid='.length).split(';')[0];
  }

  const as = (sid: string) => ({
    createWallet: (body: object) =>
      request(server()).post('/api/v1/wallets').set('Cookie', `sid=${sid}`).send(body),
    listWallets: () => request(server()).get('/api/v1/wallets').set('Cookie', `sid=${sid}`),
    getWallet: (walletId: string) =>
      request(server()).get(`/api/v1/wallets/${walletId}`).set('Cookie', `sid=${sid}`),
    updateWallet: (walletId: string, body: object) =>
      request(server()).patch(`/api/v1/wallets/${walletId}`).set('Cookie', `sid=${sid}`).send(body),
    recordTransaction: (walletId: string, body: object) =>
      request(server())
        .post(`/api/v1/wallets/${walletId}/transactions`)
        .set('Cookie', `sid=${sid}`)
        .send(body),
    currencies: () => request(server()).get('/api/v1/currencies').set('Cookie', `sid=${sid}`),
  });

  const aWallet = (overrides: object = {}) => ({
    name: 'Cash',
    currency: 'THB',
    openingBalanceMinor: '100000',
    ...overrides,
  });

  const aTransaction = (overrides: object = {}) => ({
    kind: 'expense',
    amountMinor: '12550',
    occurredOn: localDate(),
    note: 'Lunch',
    today: localDate(),
    ...overrides,
  });

  // The skeleton journey (S-1) as independent slices, each through every layer down to Postgres; the whole
  // journey in one go is Bruno folder 02-walking-skeleton and the Playwright walking-skeleton spec.
  describe('walking skeleton: create a Wallet, record an Expense, see the Balance (S-1)', () => {
    it('creates a Wallet whose Balance is its Opening Balance, with a server-generated id and exactly the Wallet keys', async () => {
      // Arrange
      const user = as(await signUp('skeleton-create'));

      // Act
      const response = await user.createWallet(aWallet());

      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: expect.stringMatching(UUID_SHAPE),
        name: 'Cash',
        currency: 'THB',
        openingBalanceMinor: '100000',
        balanceMinor: '100000',
        archivedAt: null,
        createdAt: expect.stringMatching(ISO_INSTANT),
        updatedAt: expect.stringMatching(ISO_INSTANT),
      });
    });

    it('records an Expense and shows the derived Balance and the one Transaction, byte-identical to what was recorded', async () => {
      // Arrange
      const user = as(await signUp('skeleton-record'));
      const wallet = (await user.createWallet(aWallet())).body;

      // Act
      const recorded = await user.recordTransaction(wallet.id, aTransaction());
      const shown = await user.getWallet(wallet.id);

      // Assert
      expect(recorded.status).toBe(201);
      expect(recorded.body).toEqual({
        id: expect.stringMatching(UUID_SHAPE),
        walletId: wallet.id,
        kind: 'expense',
        amountMinor: '12550',
        occurredOn: localDate(),
        note: 'Lunch',
        createdAt: expect.stringMatching(ISO_INSTANT),
        updatedAt: expect.stringMatching(ISO_INSTANT),
      });
      expect(shown.status).toBe(200);
      expect(shown.body).toEqual({
        ...wallet,
        balanceMinor: '87450',
        transactions: [recorded.body],
      });
    });

    it('lists the User’s Wallet with exactly id, name, currency, Balance, archivedAt and createdAt, and its Currency Total', async () => {
      // Arrange
      const user = as(await signUp('skeleton-list'));
      const wallet = (await user.createWallet(aWallet())).body;

      // Act
      const response = await user.listWallets();

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        wallets: [
          {
            id: wallet.id,
            name: 'Cash',
            currency: 'THB',
            balanceMinor: '100000',
            archivedAt: null,
            createdAt: wallet.createdAt,
          },
        ],
        currencyTotals: [{ currency: 'THB', balanceMinor: '100000' }],
      });
    });

    it('serves the supported-Currency snapshot with ISO-4217 digits', async () => {
      // Arrange
      const user = as(await signUp('skeleton-currencies'));

      // Act
      const response = await user.currencies();

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.currencies).toHaveLength(30);
      expect(response.body.currencies).toContainEqual({
        code: 'JPY',
        name: 'Japanese Yen',
        minorDigits: 0,
      });
      expect(response.body.currencies).toContainEqual({
        code: 'THB',
        name: 'Thai Baht',
        minorDigits: 2,
      });
    });

    it.each([
      ['GET /currencies', () => request(server()).get('/api/v1/currencies')],
      ['GET /wallets', () => request(server()).get('/api/v1/wallets')],
      ['POST /wallets', () => request(server()).post('/api/v1/wallets').send({ name: 'x' })],
      [
        'GET /wallets/:id',
        () => request(server()).get('/api/v1/wallets/3f6c1a52-9d7e-4b8a-a1c4-5e2f7d9b0c13'),
      ],
      [
        'POST /wallets/:id/transactions',
        () =>
          request(server())
            .post('/api/v1/wallets/3f6c1a52-9d7e-4b8a-a1c4-5e2f7d9b0c13/transactions')
            .send({ kind: 'expense' }),
      ],
    ])('answers 401 "Not signed in." to %s without a Session (S-23)', async (_endpoint, call) => {
      // Arrange / Act
      const response = await call();

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        statusCode: 401,
        message: 'Not signed in.',
        error: 'Unauthorized',
      });
    });
  });

  describe('creating a Wallet', () => {
    it.each(SUPPORTED_CURRENCIES.map((currency) => currency.code))(
      'accepts the supported Currency %s (Exchange Rates and Ledger agree on the list)',
      async (currency) => {
        // Arrange
        const user = as(await signUp('currency-ok'));

        // Act
        const response = await user.createWallet(aWallet({ currency }));

        // Assert
        expect(response.status).toBe(201);
        expect(response.body.currency).toBe(currency);
      },
    );

    it.each([
      ['a blank name', { name: '   ' }, ['Enter a wallet name.']],
      ['a missing name', { name: undefined }, ['Enter a wallet name.']],
      [
        'a 61-character name',
        { name: 'W'.repeat(61) },
        ['Wallet name must be at most 60 characters.'],
      ],
      [
        '62 characters of heart emoji with variation selectors, which the database counts too',
        { name: '❤️'.repeat(31) },
        ['Wallet name must be at most 60 characters.'],
      ],
      ['an unknown Currency', { currency: 'XYZ' }, ['Choose a supported currency.']],
      ['BGN, which Frankfurter dropped', { currency: 'BGN' }, ['Choose a supported currency.']],
      ['a lower-case Currency code', { currency: 'thb' }, ['Choose a supported currency.']],
      ['a Currency code with a space', { currency: ' THB' }, ['Choose a supported currency.']],
      ['a missing Currency', { currency: undefined }, ['Choose a supported currency.']],
      [
        'an Opening Balance sent as a JSON number',
        { openingBalanceMinor: 1000 },
        ['Opening balance must be a whole number of minor units.'],
      ],
      [
        'an Opening Balance with decimals',
        { openingBalanceMinor: '12.50' },
        ['Opening balance must be a whole number of minor units.'],
      ],
      [
        'a missing Opening Balance',
        { openingBalanceMinor: undefined },
        ['Opening balance must be a whole number of minor units.'],
      ],
      [
        'a 16-digit Opening Balance',
        { openingBalanceMinor: '1234567890123456' },
        ['Opening balance is too large.'],
      ],
      [
        'a negative 16-digit Opening Balance',
        { openingBalanceMinor: '-1234567890123456' },
        ['Opening balance is too large.'],
      ],
      [
        'a blank name and an Opening Balance that is not a number — one message per field',
        { name: '', openingBalanceMinor: 'abc' },
        ['Enter a wallet name.', 'Opening balance must be a whole number of minor units.'],
      ],
      [
        'a blank name and an unknown Currency — the request’s shape is judged first, the Currency list is asked only of a well-formed request',
        { name: '', currency: 'XYZ' },
        ['Enter a wallet name.'],
      ],
    ])(
      'answers 400 for %s with exactly the catalogue message, and stores nothing',
      async (_why, overrides, messages) => {
        // Arrange
        const user = as(await signUp('create-refused'));

        // Act
        const response = await user.createWallet(aWallet(overrides));

        // Assert
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ statusCode: 400, message: messages, error: 'Bad Request' });
        expect((await user.listWallets()).body).toEqual({ wallets: [], currencyTotals: [] });
      },
    );

    it.each([
      ['zero', '0', '0'],
      ['a negative Opening Balance (S-8)', '-250075', '-250075'],
      ['negative zero, stored as zero', '-0', '0'],
      ['leading zeros, stored without them', '000150', '150'],
      ['the largest 15-digit value', '999999999999999', '999999999999999'],
      ['the smallest 15-digit negative value', '-999999999999999', '-999999999999999'],
    ])('stores an Opening Balance of %s canonically', async (_why, typed, stored) => {
      // Arrange
      const user = as(await signUp('opening'));

      // Act
      const response = await user.createWallet(aWallet({ openingBalanceMinor: typed }));

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.openingBalanceMinor).toBe(stored);
      expect(response.body.balanceMinor).toBe(stored);
    });

    it('trims the name and keeps it unique-free: two Wallets may share a name (S-12)', async () => {
      // Arrange
      const user = as(await signUp('names'));

      // Act
      const first = await user.createWallet(aWallet({ name: '  Savings  ' }));
      const second = await user.createWallet(aWallet({ name: 'Savings' }));

      // Assert
      expect(first.status).toBe(201);
      expect(first.body.name).toBe('Savings');
      expect(second.status).toBe(201);
      expect(second.body.id).not.toBe(first.body.id);
    });

    it('accepts a name of exactly 60 characters, including 30 heart emoji that are 60 characters to Postgres (S-14)', async () => {
      // Arrange
      const user = as(await signUp('name-60'));

      // Act
      const plain = await user.createWallet(aWallet({ name: 'W'.repeat(60) }));
      const hearts = await user.createWallet(aWallet({ name: '❤️'.repeat(30) }));

      // Assert
      expect(plain.status).toBe(201);
      expect(hearts.status).toBe(201);
      expect(hearts.body.name).toBe('❤️'.repeat(30));
    });

    it('stores a name without a NUL character instead of failing with a 500', async () => {
      // Arrange
      const user = as(await signUp('nul-name'));

      // Act
      const response = await user.createWallet(aWallet({ name: 'Ca\u0000sh' }));

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Cash');
    });

    it('chooses its own id, owner and Balance: undeclared fields in the body are dropped (whitelist)', async () => {
      // Arrange
      const user = as(await signUp('smuggle'));
      const smuggledId = '3f6c1a52-9d7e-4b8a-a1c4-5e2f7d9b0c13';

      // Act
      const response = await user.createWallet(
        aWallet({
          id: smuggledId,
          userId: '00000000-0000-4000-8000-000000000000',
          balanceMinor: '999',
          openingBalanceMinor: '10',
        }),
      );

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.id).not.toBe(smuggledId);
      expect(response.body.balanceMinor).toBe('10');
      expect(Object.keys(response.body).sort()).toEqual([
        'archivedAt',
        'balanceMinor',
        'createdAt',
        'currency',
        'id',
        'name',
        'openingBalanceMinor',
        'updatedAt',
      ]);
    });

    it('refuses a text body with 415, before anything is stored', async () => {
      // Arrange
      const sid = await signUp('text-wallet');

      // Act
      const response = await request(server())
        .post('/api/v1/wallets')
        .set('Cookie', `sid=${sid}`)
        .type('text/plain')
        .send('name=Cash&currency=THB&openingBalanceMinor=0');

      // Assert
      expect(response.status).toBe(415);
      expect(response.body).toEqual({
        statusCode: 415,
        message: 'Content-Type must be application/json',
        error: 'Unsupported Media Type',
      });
      expect((await as(sid).listWallets()).body).toEqual({ wallets: [], currencyTotals: [] });
    });
  });

  describe('listing Wallets', () => {
    it('lists the User’s Wallets newest first, and the newest one’s Currency is what a new Wallet defaults to (Q-11, S-5, S-6)', async () => {
      // Arrange
      const user = as(await signUp('list'));
      const cash = (await user.createWallet(aWallet({ name: 'Cash', currency: 'THB' }))).body;
      const bank = (await user.createWallet(aWallet({ name: 'Bank', currency: 'USD' }))).body;
      const card = (await user.createWallet(aWallet({ name: 'Card', currency: 'JPY' }))).body;

      // Act
      const response = await user.listWallets();

      // Assert
      expect(response.body.wallets.map((wallet: { id: string }) => wallet.id)).toEqual([
        card.id,
        bank.id,
        cash.id,
      ]);
      expect(response.body.wallets[0].currency).toBe('JPY');
    });

    it('never shows another User’s Wallets (S-20)', async () => {
      // Arrange
      const owner = as(await signUp('list-owner'));
      const other = as(await signUp('list-other'));
      await owner.createWallet(aWallet({ name: 'Owner’s' }));
      const mine = (await other.createWallet(aWallet({ name: 'Mine' }))).body;

      // Act
      const response = await other.listWallets();

      // Assert: only Mine — in the list and in the Currency Total (the other User's 100000 is not in it)
      expect(response.body).toEqual({
        wallets: [
          {
            id: mine.id,
            name: 'Mine',
            currency: 'THB',
            balanceMinor: '100000',
            archivedAt: null,
            createdAt: mine.createdAt,
          },
        ],
        currencyTotals: [{ currency: 'THB', balanceMinor: '100000' }],
      });
    });

    it('lists nothing, and no Currency Total, for a User with no Wallets (S-6, S-11)', async () => {
      // Arrange
      const user = as(await signUp('list-none'));

      // Act
      const response = await user.listWallets();

      // Assert
      expect(response.body).toEqual({ wallets: [], currencyTotals: [] });
    });
  });

  // F-3 walking skeleton (S-1): Home reads every owned Wallet with its derived Balance and the Currency Totals.
  describe('the Wallet Overview: Balances and Currency Totals (S-1)', () => {
    it('S-1: shows each Wallet’s Balance in its own Currency, newest first, and one Currency Total per Currency ordered by code', async () => {
      // Arrange
      const user = as(await signUp('overview-skeleton'));
      const cash = (
        await user.createWallet(aWallet({ name: 'Cash', openingBalanceMinor: '100000' }))
      ).body;
      const bank = (
        await user.createWallet(aWallet({ name: 'Bank', openingBalanceMinor: '250000' }))
      ).body;
      const card = (
        await user.createWallet(
          aWallet({ name: 'Card', currency: 'USD', openingBalanceMinor: '1000' }),
        )
      ).body;
      await user.recordTransaction(cash.id, aTransaction({ amountMinor: '12550' }));

      // Act
      const response = await user.listWallets();

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.wallets.map((wallet: { id: string }) => wallet.id)).toEqual([
        card.id,
        bank.id,
        cash.id,
      ]);
      expect(
        response.body.wallets.map((wallet: { balanceMinor: string }) => wallet.balanceMinor),
      ).toEqual(['1000', '250000', '87450']);
      expect(response.body.currencyTotals).toEqual([
        { currency: 'THB', balanceMinor: '337450' },
        { currency: 'USD', balanceMinor: '1000' },
      ]);
    });

    it('AC-1.2: a Transaction recorded later shows in the Balance and the Currency Total — they are derived on read, never stored', async () => {
      // Arrange
      const user = as(await signUp('overview-derived'));
      const cash = (await user.createWallet(aWallet())).body;
      const before = await user.listWallets();

      // Act
      await user.recordTransaction(
        cash.id,
        aTransaction({ kind: 'income', amountMinor: '25000', note: undefined }),
      );
      const after = await user.listWallets();

      // Assert
      expect(before.body.wallets[0].balanceMinor).toBe('100000');
      expect(after.body.wallets[0].balanceMinor).toBe('125000');
      expect(after.body.currencyTotals).toEqual([{ currency: 'THB', balanceMinor: '125000' }]);
    });

    it('S-7: shows a negative Balance, and a Balance and Currency Total of zero (that Currency keeps its line)', async () => {
      // Arrange
      const user = as(await signUp('overview-signs'));
      const yen = (
        await user.createWallet(aWallet({ name: 'Yen', currency: 'JPY', openingBalanceMinor: '0' }))
      ).body;
      const minus = (
        await user.createWallet(aWallet({ name: 'Minus', openingBalanceMinor: '-250075' }))
      ).body;
      await user.recordTransaction(yen.id, aTransaction({ amountMinor: '1500' }));
      await user.recordTransaction(
        minus.id,
        aTransaction({ kind: 'income', amountMinor: '250075', note: undefined }),
      );

      // Act
      const response = await user.listWallets();

      // Assert: newest first — Minus, then Yen
      expect(
        response.body.wallets.map((wallet: { balanceMinor: string }) => wallet.balanceMinor),
      ).toEqual(['0', '-1500']);
      expect(response.body.currencyTotals).toEqual([
        { currency: 'JPY', balanceMinor: '-1500' },
        { currency: 'THB', balanceMinor: '0' },
      ]);
    });

    it('S-8: adds Balances beyond 15 digits exactly — two KRW Wallets of 999999999999999 make a Currency Total of 1999999999999998', async () => {
      // Arrange
      const user = as(await signUp('overview-big'));
      const wallet = (name: string) =>
        aWallet({ name, currency: 'KRW', openingBalanceMinor: '999999999999999' });
      await user.createWallet(wallet('Big1'));
      await user.createWallet(wallet('Big2'));

      // Act
      const response = await user.listWallets();

      // Assert
      expect(response.body.currencyTotals).toEqual([
        { currency: 'KRW', balanceMinor: '1999999999999998' },
      ]);
    });

    it('IT-F3-02: adds Balances beyond 2^53 exactly (21999999999999978), where a float would round', async () => {
      // Arrange: each Wallet holds 999999999999999 + 10 Incomes of 999999999999999 = 10999999999999989
      const user = as(await signUp('overview-huge'));
      for (const name of ['Huge1', 'Huge2']) {
        const wallet = (
          await user.createWallet(
            aWallet({ name, currency: 'KRW', openingBalanceMinor: '999999999999999' }),
          )
        ).body;
        const incomes = Array.from({ length: 10 }, () =>
          user.recordTransaction(
            wallet.id,
            aTransaction({ kind: 'income', amountMinor: '999999999999999', note: undefined }),
          ),
        );
        await Promise.all(incomes);
      }

      // Act
      const response = await user.listWallets();

      // Assert
      const exact = '21999999999999978';
      expect(response.body.currencyTotals).toEqual([{ currency: 'KRW', balanceMinor: exact }]);
      expect(BigInt(Number(exact))).not.toBe(BigInt(exact)); // the premise: a float cannot hold this value
    });

    it('shows the same Balance in the Overview as on the Wallet screen', async () => {
      // Arrange
      const user = as(await signUp('overview-agree'));
      const wallet = (await user.createWallet(aWallet({ openingBalanceMinor: '5000' }))).body;
      await user.recordTransaction(wallet.id, aTransaction({ amountMinor: '1234' }));
      await user.recordTransaction(
        wallet.id,
        aTransaction({ kind: 'income', amountMinor: '99', note: undefined }),
      );

      // Act
      const overview = await user.listWallets();
      const detail = await user.getWallet(wallet.id);

      // Assert
      expect(overview.body.wallets[0].balanceMinor).toBe('3865');
      expect(detail.body.balanceMinor).toBe(overview.body.wallets[0].balanceMinor);
    });
  });

  describe('renaming a Wallet (S-3, S-10, S-11)', () => {
    /** A User with a Wallet whose timestamps are an hour old, so a later change is provably later (see `backdateWallet`). */
    async function aUserWithACashWallet() {
      const user = as(await signUp('rename'));
      const created = (await user.createWallet(aWallet({ openingBalanceMinor: '100000' }))).body;
      await backdateWallet(pool, created.id);
      const { createdAt, updatedAt } = (await user.getWallet(created.id)).body;
      return { user, wallet: { ...created, createdAt, updatedAt } };
    }

    it('S-3: renames the Wallet and answers it whole — same id, Currency and money, a later updatedAt — and the new name is what is read back, in the Wallet and in the Overview', async () => {
      // Arrange
      const { user, wallet } = await aUserWithACashWallet();
      await user.recordTransaction(wallet.id, aTransaction({ amountMinor: '12550' }));

      // Act
      const renamed = await user.updateWallet(wallet.id, { name: 'Daily Cash' });
      const shown = await user.getWallet(wallet.id);
      const overview = await user.listWallets();

      // Assert
      expect(renamed.status).toBe(200);
      expect(renamed.body).toEqual({
        id: wallet.id,
        name: 'Daily Cash',
        currency: 'THB',
        openingBalanceMinor: '100000',
        balanceMinor: '87450',
        archivedAt: null,
        createdAt: wallet.createdAt,
        updatedAt: expect.stringMatching(ISO_INSTANT),
      });
      expect(renamed.body.updatedAt > wallet.updatedAt).toBe(true);
      expect(shown.body.name).toBe('Daily Cash');
      expect(shown.body.transactions).toHaveLength(1);
      expect(overview.body.wallets[0].name).toBe('Daily Cash');
    });

    it('S-10: changes nothing but the name — currency, openingBalanceMinor, balanceMinor, archivedAt, id and userId in the body are dropped, and the name is trimmed', async () => {
      // Arrange
      const { user, wallet } = await aUserWithACashWallet();

      // Act
      const response = await user.updateWallet(wallet.id, {
        name: '  Bank Savings  ',
        currency: 'USD',
        openingBalanceMinor: '1',
        balanceMinor: '9',
        archivedAt: '2020-01-01T00:00:00.000Z',
        id: '00000000-0000-4000-8000-000000000000',
        userId: '00000000-0000-4000-8000-000000000000',
      });
      const shown = await user.getWallet(wallet.id);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Bank Savings');
      expect(shown.body).toMatchObject({
        id: wallet.id,
        currency: 'THB',
        openingBalanceMinor: '100000',
        balanceMinor: '100000',
        archivedAt: null,
      });
    });

    it('accepts the same name again — names are not unique', async () => {
      // Arrange
      const { user, wallet } = await aUserWithACashWallet();

      // Act
      const response = await user.updateWallet(wallet.id, { name: 'Cash' });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Cash');
    });

    it.each([
      ['exactly 60 characters', 'W'.repeat(60)],
      ['60 emoji, which are 120 UTF-16 units but 60 characters', '😀'.repeat(60)],
      [
        '30 heart emoji, which are 60 characters to Postgres (heart plus variation selector)',
        '❤️'.repeat(30),
      ],
    ])('S-11: accepts a name of %s', async (_why, name) => {
      // Arrange
      const { user, wallet } = await aUserWithACashWallet();

      // Act
      const response = await user.updateWallet(wallet.id, { name });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.name).toBe(name);
    });

    it('drops a NUL character from the name instead of failing with a 500', async () => {
      // Arrange
      const { user, wallet } = await aUserWithACashWallet();

      // Act
      const response = await user.updateWallet(wallet.id, { name: 'Ca\u0000sh2' });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Cash2');
    });

    it.each([
      ['a blank name', { name: '   ' }, ['Enter a wallet name.']],
      ['an empty name', { name: '' }, ['Enter a wallet name.']],
      ['a name that is a number', { name: 5 }, ['Enter a wallet name.']],
      [
        'a 61-character name',
        { name: 'W'.repeat(61) },
        ['Wallet name must be at most 60 characters.'],
      ],
      [
        '62 characters of heart emoji with variation selectors, which the database counts too',
        { name: '❤️'.repeat(31) },
        ['Wallet name must be at most 60 characters.'],
      ],
      ['archived: false', { archived: false }, ['Archived can only be set to true.']],
      ['archived: "true"', { archived: 'true' }, ['Archived can only be set to true.']],
      ['archived: 1', { archived: 1 }, ['Archived can only be set to true.']],
      [
        'a blank name and archived: false — one message per field, name first',
        { name: '', archived: false },
        ['Enter a wallet name.', 'Archived can only be set to true.'],
      ],
      ['no field at all', {}, ['Nothing to change.']],
      ['a null name only', { name: null }, ['Nothing to change.']],
      ['a null archived only', { archived: null }, ['Nothing to change.']],
      [
        'only fields a PATCH does not own — the Currency can never change',
        { currency: 'USD' },
        ['Nothing to change.'],
      ],
    ])(
      'answers 400 for %s with exactly the catalogue message, and changes nothing',
      async (_why, body, messages) => {
        // Arrange
        const { user, wallet } = await aUserWithACashWallet();

        // Act
        const response = await user.updateWallet(wallet.id, body);
        const shown = await user.getWallet(wallet.id);

        // Assert
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ statusCode: 400, message: messages, error: 'Bad Request' });
        expect(shown.body).toMatchObject({
          name: 'Cash',
          archivedAt: null,
          updatedAt: wallet.updatedAt,
        });
      },
    );

    it('refuses a body that is not an object (a JSON array) with a 400 — Nest’s own "object is expected" — and changes nothing', async () => {
      // Arrange
      const sid = await signUp('rename-array');
      const wallet = (await as(sid).createWallet(aWallet())).body;

      // Act
      const response = await request(server())
        .patch(`/api/v1/wallets/${wallet.id}`)
        .set('Cookie', `sid=${sid}`)
        .type('json')
        .send('[1,2,3]');
      const shown = await as(sid).getWallet(wallet.id);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toEqual(['Validation failed (object is expected)']);
      expect(shown.body).toMatchObject({ name: 'Cash', updatedAt: wallet.updatedAt });
    });

    it('ignores __proto__ and constructor keys instead of letting a body reach the prototype', async () => {
      // Arrange
      const sid = await signUp('rename-proto');
      const wallet = (await as(sid).createWallet(aWallet())).body;
      const body =
        '{"__proto__":{"admin":true},"constructor":{"prototype":{"polluted":true}},"name":"Proto"}';

      // Act
      const response = await request(server())
        .patch(`/api/v1/wallets/${wallet.id}`)
        .set('Cookie', `sid=${sid}`)
        .type('json')
        .send(body);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Proto');
      expect(({} as Record<string, unknown>).admin).toBeUndefined();
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('answers 400, not a stack overflow, for a body nested thousands of levels deep', async () => {
      // Arrange
      const sid = await signUp('rename-nested');
      const wallet = (await as(sid).createWallet(aWallet())).body;
      const nested = `{"name":${'['.repeat(20000)}${']'.repeat(20000)}}`;

      // Act
      const response = await request(server())
        .patch(`/api/v1/wallets/${wallet.id}`)
        .set('Cookie', `sid=${sid}`)
        .type('json')
        .send(nested);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Request body is nested too deeply.');
    });

    it('stores a name that looks like SQL or markup verbatim and gives it back as JSON', async () => {
      // Arrange
      const { user, wallet } = await aUserWithACashWallet();
      const name = "x'); DROP TABLE wallets; --<script>alert(1)</script>";

      // Act
      const renamed = await user.updateWallet(wallet.id, { name });
      const shown = await user.getWallet(wallet.id);

      // Assert
      expect(renamed.status).toBe(200);
      expect(shown.body.name).toBe(name);
      expect(shown.headers['content-type']).toMatch(/^application\/json/);
    });
  });

  describe('archiving a Wallet (S-4, S-5, S-12, S-13)', () => {
    /** A User with an old Wallet (its timestamps an hour old, see `backdateWallet`) holding one Transaction. */
    async function aUserWithAnOldWallet() {
      const user = as(await signUp('archive'));
      const created = (
        await user.createWallet(aWallet({ name: 'Old Card', openingBalanceMinor: '50000' }))
      ).body;
      await backdateWallet(pool, created.id);
      const { createdAt, updatedAt } = (await user.getWallet(created.id)).body;
      const wallet = { ...created, createdAt, updatedAt };
      const lastCoffee = (
        await user.recordTransaction(
          wallet.id,
          aTransaction({ amountMinor: '2000', note: 'Last coffee' }),
        )
      ).body;
      return { user, wallet, lastCoffee };
    }

    it('S-4: archives the Wallet — archivedAt is a server instant — and keeps its Balance, its Transactions and its place in the Overview, still counted in the Currency Total', async () => {
      // Arrange
      const { user, wallet, lastCoffee } = await aUserWithAnOldWallet();
      const newer = (
        await user.createWallet(aWallet({ name: 'Newer', openingBalanceMinor: '100' }))
      ).body;

      // Act
      const archived = await user.updateWallet(wallet.id, { archived: true });
      const shown = await user.getWallet(wallet.id);
      const overview = await user.listWallets();

      // Assert
      expect(archived.status).toBe(200);
      expect(archived.body).toEqual({
        ...wallet,
        balanceMinor: '48000',
        archivedAt: expect.stringMatching(ISO_INSTANT),
        updatedAt: archived.body.archivedAt,
      });
      expect(archived.body.archivedAt > wallet.createdAt).toBe(true);
      expect(shown.body.archivedAt).toBe(archived.body.archivedAt);
      expect(shown.body.transactions).toEqual([lastCoffee]);
      expect(overview.body.wallets.map((row: { id: string }) => row.id)).toEqual([
        newer.id,
        wallet.id,
      ]);
      expect(overview.body.wallets[1].archivedAt).toBe(archived.body.archivedAt);
      expect(overview.body.currencyTotals).toEqual([{ currency: 'THB', balanceMinor: '48100' }]);
    });

    it('IT-F3-04: a rename and an archive in one request are applied together — one statement, one timestamp (updatedAt = archivedAt)', async () => {
      // Arrange
      const { user, wallet } = await aUserWithAnOldWallet();

      // Act
      const response = await user.updateWallet(wallet.id, { name: 'Both Done', archived: true });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Both Done');
      expect(response.body.archivedAt).toMatch(ISO_INSTANT);
      expect(response.body.updatedAt).toBe(response.body.archivedAt);
    });

    it('S-13: archiving an Archived Wallet is a 409 "This wallet is already archived." — nothing changes, and a name sent along is not applied', async () => {
      // Arrange
      const { user, wallet } = await aUserWithAnOldWallet();
      const archived = (await user.updateWallet(wallet.id, { archived: true })).body;

      // Act
      const twice = await user.updateWallet(wallet.id, { archived: true });
      const withName = await user.updateWallet(wallet.id, { name: 'Renamed', archived: true });
      const shown = await user.getWallet(wallet.id);

      // Assert
      const conflict = {
        statusCode: 409,
        message: 'This wallet is already archived.',
        error: 'Conflict',
      };
      expect(twice.status).toBe(409);
      expect(twice.body).toEqual(conflict);
      expect(withName.status).toBe(409);
      expect(withName.body).toEqual(conflict);
      expect(shown.body).toMatchObject({
        name: 'Old Card',
        archivedAt: archived.archivedAt,
        updatedAt: archived.updatedAt,
      });
    });

    it('S-5: an Archived Wallet can still be renamed — it stays archived, with the same archivedAt', async () => {
      // Arrange
      const { user, wallet } = await aUserWithAnOldWallet();
      const archived = (await user.updateWallet(wallet.id, { archived: true })).body;

      // Act
      const renamed = await user.updateWallet(wallet.id, { name: 'Old Visa' });

      // Assert
      expect(renamed.status).toBe(200);
      expect(renamed.body.name).toBe('Old Visa');
      expect(renamed.body.archivedAt).toBe(archived.archivedAt);
    });

    it('S-12: an Archived Wallet accepts no new Transaction — 409 with the exact message, and nothing is stored', async () => {
      // Arrange
      const { user, wallet, lastCoffee } = await aUserWithAnOldWallet();
      await user.updateWallet(wallet.id, { archived: true });

      // Act
      const refused = await user.recordTransaction(wallet.id, aTransaction());
      const shown = await user.getWallet(wallet.id);

      // Assert
      expect(refused.status).toBe(409);
      expect(refused.body).toEqual({
        statusCode: 409,
        message: 'This wallet is archived and accepts no new transactions.',
        error: 'Conflict',
      });
      expect(shown.body.transactions).toEqual([lastCoffee]);
      expect(shown.body.balanceMinor).toBe('48000');
    });

    it('S-12: the request’s shape is judged first — a malformed Transaction for an Archived Wallet is a 400, not a 409', async () => {
      // Arrange
      const { user, wallet } = await aUserWithAnOldWallet();
      await user.updateWallet(wallet.id, { archived: true });

      // Act
      const response = await user.recordTransaction(wallet.id, aTransaction({ kind: 'transfer' }));

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toEqual(['Choose income or expense.']);
    });

    it('S-14: another User recording into an Archived Wallet gets the plain 404 — the 409 never reveals that the Wallet exists', async () => {
      // Arrange
      const { user, wallet } = await aUserWithAnOldWallet();
      await user.updateWallet(wallet.id, { archived: true });
      const intruder = as(await signUp('archive-intruder'));

      // Act
      const response = await intruder.recordTransaction(wallet.id, aTransaction());

      // Assert
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        statusCode: 404,
        message: 'Wallet not found.',
        error: 'Not Found',
      });
    });

    it('archiving one Wallet does not touch another: the other still records', async () => {
      // Arrange
      const { user, wallet } = await aUserWithAnOldWallet();
      const other = (await user.createWallet(aWallet({ name: 'Other' }))).body;
      await user.updateWallet(wallet.id, { archived: true });

      // Act
      const recorded = await user.recordTransaction(other.id, aTransaction());

      // Assert
      expect(recorded.status).toBe(201);
    });

    it('of two simultaneous archive requests exactly one succeeds and the other is a 409', async () => {
      // Arrange
      const { user, wallet } = await aUserWithAnOldWallet();

      // Act
      const responses = await Promise.all([
        user.updateWallet(wallet.id, { archived: true }),
        user.updateWallet(wallet.id, { archived: true }),
      ]);

      // Assert
      expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    });

    it('IT-F3-01: archiving while 24 Transactions are being recorded — every answer is a 201 or a 409, what is stored is exactly what was acknowledged, and afterwards nothing more is accepted', async () => {
      // Arrange
      const user = as(await signUp('archive-race'));
      const wallet = (await user.createWallet(aWallet({ openingBalanceMinor: '1000' }))).body;
      const record = () =>
        user.recordTransaction(wallet.id, aTransaction({ amountMinor: '3', note: undefined }));
      const archive = () => user.updateWallet(wallet.id, { archived: true });

      // Act: the archive is sent in the middle of the burst
      const answers = await Promise.all([
        ...Array.from({ length: 12 }, record),
        archive(),
        ...Array.from({ length: 12 }, record),
      ]);
      const archived = answers[12];
      const recordings = [...answers.slice(0, 12), ...answers.slice(13)];
      const shown = await user.getWallet(wallet.id);
      const afterwards = await record();

      // Assert
      expect(archived.status).toBe(200);
      const statuses = recordings.map((response) => response.status);
      expect(statuses.filter((status) => status !== 201 && status !== 409)).toEqual([]);
      const acknowledged = statuses.filter((status) => status === 201).length;
      expect(shown.body.transactions).toHaveLength(acknowledged);
      expect(shown.body.balanceMinor).toBe(String(1000 - 3 * acknowledged));
      expect(shown.body.archivedAt).toBe(archived.body.archivedAt);
      expect(afterwards.status).toBe(409);
    });
  });

  describe('who may rename or archive, and in which order the answers come (S-14, S-15)', () => {
    const notFound = { statusCode: 404, message: 'Wallet not found.', error: 'Not Found' };

    it('S-14: another User renaming or archiving answers 404 — identical to a missing Wallet — and leaves the owner’s Wallet as it was', async () => {
      // Arrange
      const owner = as(await signUp('patch-owner'));
      const intruder = as(await signUp('patch-intruder'));
      const wallet = (await owner.createWallet(aWallet({ name: 'A-Cash' }))).body;

      // Act
      const rename = await intruder.updateWallet(wallet.id, { name: 'Mine now' });
      const archive = await intruder.updateWallet(wallet.id, { archived: true });
      const untouched = await owner.getWallet(wallet.id);

      // Assert
      expect(rename.status).toBe(404);
      expect(rename.body).toEqual(notFound);
      expect(archive.status).toBe(404);
      expect(archive.body).toEqual(notFound);
      expect(untouched.body).toMatchObject({
        name: 'A-Cash',
        archivedAt: null,
        updatedAt: wallet.updatedAt,
      });
    });

    it('answers a missing Wallet, another User’s Wallet and a malformed id with the same 404, byte for byte', async () => {
      // Arrange
      const owner = as(await signUp('patch-same-owner'));
      const intruder = as(await signUp('patch-same-intruder'));
      const wallet = (await owner.createWallet(aWallet())).body;
      const ids = [wallet.id, '00000000-0000-4000-8000-000000000000', 'not-a-uuid'];

      // Act
      const answers = await Promise.all(ids.map((id) => intruder.updateWallet(id, { name: 'X' })));

      // Assert
      for (const answer of answers) {
        expect(answer.status).toBe(404);
        expect(answer.body).toEqual(notFound);
      }
    });

    it.each([
      ['a NUL character', '%00'],
      ['SQL', "'%3B%20DROP%20TABLE%20wallets%3B--"],
      ['a path-looking id', '..%2F..%2Fme'],
    ])('answers 404, never a 500, for an id that is %s', async (_why, encodedId) => {
      // Arrange
      const sid = await signUp('patch-weird-id');

      // Act
      const response = await request(server())
        .patch(`/api/v1/wallets/${encodedId}`)
        .set('Cookie', `sid=${sid}`)
        .send({ name: 'X' });

      // Assert
      expect(response.status).toBe(404);
      expect(response.body).toEqual(notFound);
    });

    it('S-14: judges the request’s shape before the Wallet — a malformed body for someone else’s or an unknown Wallet is a 400, never a 404', async () => {
      // Arrange
      const owner = as(await signUp('patch-shape-owner'));
      const intruder = as(await signUp('patch-shape-intruder'));
      const wallet = (await owner.createWallet(aWallet())).body;

      // Act
      const blankToForeign = await intruder.updateWallet(wallet.id, { name: '' });
      const emptyToForeign = await intruder.updateWallet(wallet.id, {});
      const emptyToMalformed = await intruder.updateWallet('not-a-uuid', {});

      // Assert
      expect(blankToForeign.status).toBe(400);
      expect(blankToForeign.body.message).toEqual(['Enter a wallet name.']);
      expect(emptyToForeign.status).toBe(400);
      expect(emptyToForeign.body.message).toEqual(['Nothing to change.']);
      expect(emptyToMalformed.status).toBe(400);
    });

    it.each([
      ['a rename', { name: 'X' }],
      ['an archive', { archived: true }],
      ['a body that is invalid anyway (401 comes before 400)', { name: '' }],
    ])('S-15: answers 401 "Not signed in." to %s without a Session', async (_what, body) => {
      // Arrange / Act
      const response = await request(server())
        .patch('/api/v1/wallets/3f6c1a52-9d7e-4b8a-a1c4-5e2f7d9b0c13')
        .send(body);

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        statusCode: 401,
        message: 'Not signed in.',
        error: 'Unauthorized',
      });
    });

    it('refuses a text body with 415, before anything else — and before the Session is even looked at', async () => {
      // Arrange
      const sid = await signUp('patch-text');
      const wallet = (await as(sid).createWallet(aWallet())).body;

      // Act
      const withSession = await request(server())
        .patch(`/api/v1/wallets/${wallet.id}`)
        .set('Cookie', `sid=${sid}`)
        .type('text/plain')
        .send('name=Hijacked');
      const withoutSession = await request(server())
        .patch(`/api/v1/wallets/${wallet.id}`)
        .type('text/plain')
        .send('name=Hijacked');
      const shown = await as(sid).getWallet(wallet.id);

      // Assert
      expect(withSession.status).toBe(415);
      expect(withoutSession.status).toBe(415);
      expect(shown.body.name).toBe('Cash');
    });
  });

  describe('recording a Transaction', () => {
    async function aSignedInUserWithAWallet(overrides: object = {}) {
      const user = as(await signUp('record'));
      const wallet = (await user.createWallet(aWallet(overrides))).body;
      return { user, wallet };
    }

    it('lets an Income raise the Balance (S-2)', async () => {
      // Arrange
      const { user, wallet } = await aSignedInUserWithAWallet();
      await user.recordTransaction(wallet.id, aTransaction());

      // Act
      const income = await user.recordTransaction(
        wallet.id,
        aTransaction({ kind: 'income', amountMinor: '200000', note: undefined }),
      );
      const shown = await user.getWallet(wallet.id);

      // Assert
      expect(income.status).toBe(201);
      expect(income.body.note).toBeNull();
      expect(shown.body.balanceMinor).toBe('287450');
    });

    it('lists the Transactions newest date first, a later-recorded one first within a date (S-9, IT-04)', async () => {
      // Arrange
      const { user, wallet } = await aSignedInUserWithAWallet({ openingBalanceMinor: '0' });
      const a = await user.recordTransaction(wallet.id, aTransaction({ note: 'A' }));
      const b = await user.recordTransaction(
        wallet.id,
        aTransaction({ note: 'B', occurredOn: localDate(-3) }),
      );
      const c = await user.recordTransaction(wallet.id, aTransaction({ note: 'C' }));

      // Act
      const shown = await user.getWallet(wallet.id);

      // Assert
      expect(shown.body.transactions.map((transaction: { id: string }) => transaction.id)).toEqual([
        c.body.id,
        a.body.id,
        b.body.id,
      ]);
    });

    it.each([
      ['exactly today', 0],
      ['yesterday', -1],
    ])('accepts a date of %s', async (_why, offsetDays) => {
      // Arrange
      const { user, wallet } = await aSignedInUserWithAWallet();

      // Act
      const response = await user.recordTransaction(
        wallet.id,
        aTransaction({ occurredOn: localDate(offsetDays) }),
      );

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.occurredOn).toBe(localDate(offsetDays));
    });

    it.each(['2024-02-29', '2024-12-31', '0001-01-01'])(
      'keeps the date %s exactly, on the way in and on the way out (S-10, AD-1)',
      async (occurredOn) => {
        // Arrange
        const { user, wallet } = await aSignedInUserWithAWallet();

        // Act
        const recorded = await user.recordTransaction(wallet.id, aTransaction({ occurredOn }));
        const shown = await user.getWallet(wallet.id);

        // Assert
        expect(recorded.body.occurredOn).toBe(occurredOn);
        expect(shown.body.transactions[0].occurredOn).toBe(occurredOn);
      },
    );

    it('derives an exact negative Balance in a Wallet of zero-digit Currency, past 2^53 (S-4)', async () => {
      // Arrange
      const { user, wallet } = await aSignedInUserWithAWallet({
        name: 'Yen Card',
        currency: 'JPY',
        openingBalanceMinor: '0',
      });
      await user.recordTransaction(
        wallet.id,
        aTransaction({ kind: 'income', amountMinor: '999999999999999' }),
      );
      await user.recordTransaction(wallet.id, aTransaction({ amountMinor: '999999999999999' }));
      await user.recordTransaction(wallet.id, aTransaction({ amountMinor: '1500' }));

      // Act
      const shown = await user.getWallet(wallet.id);

      // Assert
      expect(shown.body.balanceMinor).toBe('-1500');
    });

    it('stores an amount canonically: leading zeros are dropped', async () => {
      // Arrange
      const { user, wallet } = await aSignedInUserWithAWallet({ openingBalanceMinor: '0' });

      // Act
      const response = await user.recordTransaction(
        wallet.id,
        aTransaction({ amountMinor: '007' }),
      );

      // Assert
      expect(response.body.amountMinor).toBe('7');
    });

    it('trims a note, stores a blank note as no note, and drops a NUL character (S-12)', async () => {
      // Arrange
      const { user, wallet } = await aSignedInUserWithAWallet();

      // Act
      const trimmed = await user.recordTransaction(wallet.id, aTransaction({ note: '  Coffee  ' }));
      const blank = await user.recordTransaction(wallet.id, aTransaction({ note: '   ' }));
      const nul = await user.recordTransaction(wallet.id, aTransaction({ note: 'Lun\u0000ch' }));

      // Assert
      expect(trimmed.body.note).toBe('Coffee');
      expect(blank.body.note).toBeNull();
      expect(nul.status).toBe(201);
      expect(nul.body.note).toBe('Lunch');
    });

    it('accepts a note of exactly 200 characters, 100 heart emoji included', async () => {
      // Arrange
      const { user, wallet } = await aSignedInUserWithAWallet();

      // Act
      const plain = await user.recordTransaction(
        wallet.id,
        aTransaction({ note: 'n'.repeat(200) }),
      );
      const hearts = await user.recordTransaction(
        wallet.id,
        aTransaction({ note: '❤️'.repeat(100) }),
      );

      // Assert
      expect(plain.status).toBe(201);
      expect(hearts.status).toBe(201);
    });

    it('chooses its own id and Wallet: undeclared fields in the body are dropped (whitelist)', async () => {
      // Arrange
      const { user, wallet } = await aSignedInUserWithAWallet();
      const smuggledId = '3f6c1a52-9d7e-4b8a-a1c4-5e2f7d9b0c13';

      // Act
      const response = await user.recordTransaction(
        wallet.id,
        aTransaction({ id: smuggledId, walletId: '00000000-0000-4000-8000-000000000000' }),
      );

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.walletId).toBe(wallet.id);
      expect(response.body.id).not.toBe(smuggledId);
    });

    it('counts every one of 25 simultaneous Transactions: no lost write, and the Balance agrees with the list', async () => {
      // Arrange
      const { user, wallet } = await aSignedInUserWithAWallet({ openingBalanceMinor: '1000' });

      // Act
      const responses = await Promise.all(
        Array.from({ length: 25 }, () =>
          user.recordTransaction(wallet.id, aTransaction({ amountMinor: '3', note: undefined })),
        ),
      );
      const shown = await user.getWallet(wallet.id);

      // Assert
      expect(responses.map((response) => response.status)).toEqual(Array(25).fill(201));
      expect(shown.body.transactions).toHaveLength(25);
      expect(shown.body.balanceMinor).toBe('925');
    });

    it.each([
      [
        'a kind that is neither income nor expense',
        { kind: 'transfer' },
        ['Choose income or expense.'],
      ],
      [
        'an amount sent as a JSON number',
        { amountMinor: 12550 },
        ['Amount must be a whole number of minor units.'],
      ],
      [
        'an amount with decimals',
        { amountMinor: '12.5' },
        ['Amount must be a whole number of minor units.'],
      ],
      [
        'a negative amount',
        { amountMinor: '-5' },
        ['Amount must be a whole number of minor units.'],
      ],
      ['an amount of zero', { amountMinor: '0' }, ['Amount must be greater than 0.']],
      ['a 16-digit amount', { amountMinor: '1234567890123456' }, ['Amount is too large.']],
      ['a date that does not exist', { occurredOn: '2026-02-30' }, ['Enter a valid date.']],
      ['a date in day/month/year order', { occurredOn: '29/02/2024' }, ['Enter a valid date.']],
      [
        'year 0000, which Postgres has no day of (IT-05)',
        { occurredOn: '0000-01-01' },
        ['Enter a valid date.'],
      ],
      ['a date after today (S-17)', { occurredOn: localDate(1) }, ["Date can't be in the future."]],
      [
        'a note of 201 characters',
        { note: 'n'.repeat(201) },
        ['Note must be at most 200 characters.'],
      ],
      [
        'a note of 202 characters made of heart emoji with variation selectors',
        { note: '❤️'.repeat(101) },
        ['Note must be at most 200 characters.'],
      ],
      ['a note that is not text', { note: 5 }, ['Note must be at most 200 characters.']],
      ['no today', { today: undefined }, ['today must be a valid date (YYYY-MM-DD).']],
      [
        'a today that is not a date — the future-date check is skipped',
        { today: 'tomorrow', occurredOn: localDate(1) },
        ['today must be a valid date (YYYY-MM-DD).'],
      ],
    ])(
      'answers 400 for %s with exactly the catalogue message, and saves nothing',
      async (_why, overrides, messages) => {
        // Arrange
        const { user, wallet } = await aSignedInUserWithAWallet();

        // Act
        const response = await user.recordTransaction(wallet.id, aTransaction(overrides));

        // Assert
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ statusCode: 400, message: messages, error: 'Bad Request' });
        const shown = await user.getWallet(wallet.id);
        expect(shown.body.transactions).toEqual([]);
        expect(shown.body.balanceMinor).toBe('100000');
      },
    );

    it('refuses a text body with 415, before anything is saved', async () => {
      // Arrange
      const sid = await signUp('text-transaction');
      const user = as(sid);
      const wallet = (await user.createWallet(aWallet())).body;

      // Act
      const response = await request(server())
        .post(`/api/v1/wallets/${wallet.id}/transactions`)
        .set('Cookie', `sid=${sid}`)
        .type('text/plain')
        .send('kind=expense&amountMinor=1');

      // Assert
      expect(response.status).toBe(415);
      expect((await user.getWallet(wallet.id)).body.transactions).toEqual([]);
    });
  });

  describe('visibility: a Wallet that is not yours does not exist (S-20, S-21, S-22)', () => {
    const notFound = { statusCode: 404, message: 'Wallet not found.', error: 'Not Found' };

    it('answers 404 to another User for reading and for recording, saves nothing, and keeps the owner’s Wallet untouched', async () => {
      // Arrange
      const owner = as(await signUp('visibility-owner'));
      const intruder = as(await signUp('visibility-intruder'));
      const wallet = (await owner.createWallet(aWallet({ openingBalanceMinor: '5000' }))).body;

      // Act
      const read = await intruder.getWallet(wallet.id);
      const write = await intruder.recordTransaction(wallet.id, aTransaction());

      // Assert
      expect(read.status).toBe(404);
      expect(read.body).toEqual(notFound);
      expect(write.status).toBe(404);
      expect(write.body).toEqual(notFound);
      const untouched = await owner.getWallet(wallet.id);
      expect(untouched.body.transactions).toEqual([]);
      expect(untouched.body.balanceMinor).toBe('5000');
    });

    it('answers a missing Wallet, another User’s Wallet and a malformed id with the same 404, byte for byte', async () => {
      // Arrange
      const owner = as(await signUp('same-owner'));
      const intruder = as(await signUp('same-intruder'));
      const wallet = (await owner.createWallet(aWallet())).body;
      const ids = [wallet.id, '00000000-0000-4000-8000-000000000000', 'not-a-uuid'];

      // Act
      const reads = await Promise.all(ids.map((id) => intruder.getWallet(id)));
      const writes = await Promise.all(
        ids.map((id) => intruder.recordTransaction(id, aTransaction())),
      );

      // Assert
      for (const response of [...reads, ...writes]) {
        expect(response.status).toBe(404);
        expect(response.body).toEqual(notFound);
      }
    });

    it.each([
      ['a NUL character', '%00'],
      ['SQL', "'%3B%20DROP%20TABLE%20wallets%3B--"],
      ['a path-looking id', '..%2F..%2Fme'],
    ])('answers 404, never a 500, for an id that is %s', async (_why, encodedId) => {
      // Arrange
      const sid = await signUp('weird-id');

      // Act
      const read = await request(server())
        .get(`/api/v1/wallets/${encodedId}`)
        .set('Cookie', `sid=${sid}`);

      // Assert
      expect(read.status).toBe(404);
      expect(read.body).toEqual(notFound);
    });

    it('finds the User’s own Wallet by an upper-case id', async () => {
      // Arrange
      const user = as(await signUp('uppercase'));
      const wallet = (await user.createWallet(aWallet())).body;

      // Act
      const response = await user.getWallet(wallet.id.toUpperCase());

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(wallet.id);
    });

    it('judges the request’s shape before the Wallet: a bad body for an unknown Wallet is a 400, never a 404 (S-22)', async () => {
      // Arrange
      const user = as(await signUp('shape-first'));

      // Act
      const toUnknown = await user.recordTransaction(
        '00000000-0000-4000-8000-000000000000',
        aTransaction({ kind: 'transfer' }),
      );
      const toMalformed = await user.recordTransaction(
        'not-a-uuid',
        aTransaction({ kind: 'transfer' }),
      );

      // Assert
      expect(toUnknown.status).toBe(400);
      expect(toUnknown.body.message).toEqual(['Choose income or expense.']);
      expect(toMalformed.status).toBe(400);
    });
  });

  describe('hostile input is data, or a 4xx — never a 500', () => {
    const postRaw = (sid: string, path: string, json: string) =>
      request(server()).post(path).set('Cookie', `sid=${sid}`).type('json').send(json);

    it('answers 400, not a stack overflow, for a body nested thousands of levels deep', async () => {
      // Arrange
      const sid = await signUp('nested');
      const nested = `{"name":${'['.repeat(20000)}${']'.repeat(20000)},"currency":"THB","openingBalanceMinor":"1"}`;

      // Act
      const response = await postRaw(sid, '/api/v1/wallets', nested);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        statusCode: 400,
        message: 'Request body is nested too deeply.',
        error: 'Bad Request',
      });
      expect((await as(sid).listWallets()).body).toEqual({ wallets: [], currencyTotals: [] });
    });

    it('answers 413 for a body over the 100 KB limit and stores nothing', async () => {
      // Arrange: Nest logs the body-parser's rejection as an ERROR with a stack — expected here, so keep the run quiet
      const sid = await signUp('too-big');
      const huge = JSON.stringify(aWallet({ name: 'x'.repeat(200 * 1024) }));
      const quietLogger = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      // Act
      const response = await postRaw(sid, '/api/v1/wallets', huge);
      quietLogger.mockRestore();

      // Assert
      expect(response.status).toBe(413);
      expect((await as(sid).listWallets()).body).toEqual({ wallets: [], currencyTotals: [] });
    });

    it.each([
      ['SQL', "x'); DROP TABLE wallets; --"],
      ['a script tag', '<script>alert(1)</script>'],
      ['a template placeholder', '${process.env.DATABASE_URL}'],
    ])('stores %s verbatim as a name and gives it back unchanged, as JSON', async (_why, name) => {
      // Arrange
      const user = as(await signUp('hostile-text'));

      // Act
      const created = await user.createWallet(aWallet({ name }));
      const listed = await user.listWallets();

      // Assert: stored as text, escaped only by JSON, and the tables are all still there
      expect(created.status).toBe(201);
      expect(created.body.name).toBe(name);
      expect(listed.body.wallets[0].name).toBe(name);
      expect(listed.headers['content-type']).toMatch(/^application\/json/);
      expect(listed.headers['x-content-type-options']).toBe('nosniff');
      const { rows } = await pool.query<{ wallets: string | null; transactions: string | null }>(
        "SELECT to_regclass('wallets')::text AS wallets, to_regclass('transactions')::text AS transactions",
      );
      expect(rows[0]).toEqual({ wallets: 'wallets', transactions: 'transactions' });
    });

    it('ignores __proto__ and constructor keys instead of letting a body reach the prototype', async () => {
      // Arrange
      const sid = await signUp('proto');
      const body =
        '{"__proto__":{"admin":true},"constructor":{"prototype":{"polluted":true}},' +
        '"name":"Proto","currency":"THB","openingBalanceMinor":"1"}';

      // Act
      const response = await postRaw(sid, '/api/v1/wallets', body);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Proto');
      expect(({} as Record<string, unknown>).admin).toBeUndefined();
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('treats a body that is not an object as a body with every field missing', async () => {
      // Arrange
      const sid = await signUp('array-body');

      // Act
      const response = await postRaw(sid, '/api/v1/wallets', '[1,2,3]');

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toEqual([
        'Enter a wallet name.',
        'Choose a supported currency.',
        'Opening balance must be a whole number of minor units.',
      ]);
    });
  });
});
