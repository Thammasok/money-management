import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Pool } from 'pg';
import request from 'supertest';
import { SUPPORTED_CURRENCIES } from '../src/rates/supported-currencies';
import { createTestApp } from './support/create-app';
import { createTestPool, uniqueEmail } from './support/database';

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

    it('lists the User’s Wallet with exactly id, name, currency and createdAt', async () => {
      // Arrange
      const user = as(await signUp('skeleton-list'));
      const wallet = (await user.createWallet(aWallet())).body;

      // Act
      const response = await user.listWallets();

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        wallets: [{ id: wallet.id, name: 'Cash', currency: 'THB', createdAt: wallet.createdAt }],
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
        expect((await user.listWallets()).body).toEqual({ wallets: [] });
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
      expect((await as(sid).listWallets()).body).toEqual({ wallets: [] });
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

      // Assert
      expect(response.body).toEqual({
        wallets: [{ id: mine.id, name: 'Mine', currency: 'THB', createdAt: mine.createdAt }],
      });
    });

    it('lists nothing for a User with no Wallets (S-11)', async () => {
      // Arrange
      const user = as(await signUp('list-none'));

      // Act
      const response = await user.listWallets();

      // Assert
      expect(response.body).toEqual({ wallets: [] });
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
      expect((await as(sid).listWallets()).body).toEqual({ wallets: [] });
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
      expect((await as(sid).listWallets()).body).toEqual({ wallets: [] });
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
