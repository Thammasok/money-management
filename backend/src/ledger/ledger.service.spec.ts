import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  createExchangeRatesServiceMock,
  createLedgerRepositoryMock,
} from '../../test/support/mocks';
import type { CreateWalletDto } from './dto/create-wallet.dto';
import type { RecordTransactionDto } from './dto/record-transaction.dto';
import type { UpdateWalletDto } from './dto/update-wallet.dto';
import { LedgerService } from './ledger.service';
import type { Transaction } from './transaction.entity';
import type { Wallet } from './wallet.entity';

const USER_ID = '0f100000-0000-4000-8000-0000000000a1';
const WALLET_ID = '3f6c1a52-9d7e-4b8a-a1c4-5e2f7d9b0c13';
const CREATED_AT = new Date('2026-10-29T10:00:00.123Z');
const UPDATED_AT = new Date('2026-10-29T10:00:00.456Z');

// Business Logic under test: Data Access and Exchange Rates are mocked; the rules (Currency check, canonical money,
// visibility → 404, response shapes) are real.
describe('LedgerService', () => {
  let repository: ReturnType<typeof createLedgerRepositoryMock>;
  let rates: ReturnType<typeof createExchangeRatesServiceMock>;
  let service: LedgerService;

  beforeEach(() => {
    repository = createLedgerRepositoryMock();
    rates = createExchangeRatesServiceMock();
    service = new LedgerService(repository, rates);
  });

  const aWallet = (overrides: Partial<Wallet> = {}): Wallet => ({
    id: WALLET_ID,
    userId: USER_ID,
    name: 'Cash',
    currency: 'THB',
    openingBalanceMinor: 100000n,
    archivedAt: null,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  });

  const aTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
    id: '9b1f0e2a-1c3d-4e5f-8a7b-6c5d4e3f2a10',
    walletId: WALLET_ID,
    kind: 'expense',
    amountMinor: 12550n,
    occurredOn: '2026-10-29',
    note: 'Lunch',
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  });

  const walletInput = (overrides: Partial<CreateWalletDto> = {}): CreateWalletDto => ({
    name: 'Cash',
    currency: 'THB',
    openingBalanceMinor: '100000',
    ...overrides,
  });

  const transactionInput = (
    overrides: Partial<RecordTransactionDto> = {},
  ): RecordTransactionDto => ({
    kind: 'expense',
    amountMinor: '12550',
    occurredOn: '2026-10-29',
    note: 'Lunch',
    today: '2026-10-29',
    ...overrides,
  });

  const walletNotFoundBody = {
    statusCode: 404,
    message: 'Wallet not found.',
    error: 'Not Found',
  };

  describe('createWallet', () => {
    it('asks Exchange Rates whether the Currency is supported, stores the Wallet for the User, and answers it with Balance = Opening Balance (S-1)', async () => {
      // Arrange
      rates.isSupportedCurrency.mockReturnValue(true);
      repository.insertWallet.mockResolvedValue(aWallet());

      // Act
      const response = await service.createWallet(USER_ID, walletInput());

      // Assert
      expect(rates.isSupportedCurrency).toHaveBeenCalledWith('THB');
      expect(repository.insertWallet).toHaveBeenCalledWith({
        userId: USER_ID,
        name: 'Cash',
        currency: 'THB',
        openingBalanceMinor: 100000n,
      });
      expect(response).toEqual({
        id: WALLET_ID,
        name: 'Cash',
        currency: 'THB',
        openingBalanceMinor: '100000',
        balanceMinor: '100000',
        archivedAt: null,
        createdAt: '2026-10-29T10:00:00.123Z',
        updatedAt: '2026-10-29T10:00:00.456Z',
      });
    });

    it('never shows the owner: the response has exactly the Wallet keys (no userId)', async () => {
      // Arrange
      rates.isSupportedCurrency.mockReturnValue(true);
      repository.insertWallet.mockResolvedValue(aWallet());

      // Act
      const response = await service.createWallet(USER_ID, walletInput());

      // Assert
      expect(Object.keys(response).sort()).toEqual([
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

    it('refuses a Currency Exchange Rates does not support with 400 "Choose a supported currency." and stores nothing (S-15)', async () => {
      // Arrange
      rates.isSupportedCurrency.mockReturnValue(false);

      // Act
      const failure = service.createWallet(USER_ID, walletInput({ currency: 'XYZ' }));

      // Assert
      await expect(failure).rejects.toBeInstanceOf(BadRequestException);
      await expect(failure).rejects.toMatchObject({
        response: {
          statusCode: 400,
          message: ['Choose a supported currency.'],
          error: 'Bad Request',
        },
      });
      expect(rates.isSupportedCurrency).toHaveBeenCalledWith('XYZ');
      expect(repository.insertWallet).not.toHaveBeenCalled();
    });

    it.each([
      ['leading zeros are dropped', '000150', 150n, '150'],
      ['negative zero is zero', '-0', 0n, '0'],
      ['a negative Opening Balance is kept (S-8)', '-250075', -250075n, '-250075'],
      [
        'the largest 15-digit value is kept exactly',
        '999999999999999',
        999999999999999n,
        '999999999999999',
      ],
    ])('stores the canonical amount: %s', async (_why, typed, stored, shown) => {
      // Arrange
      rates.isSupportedCurrency.mockReturnValue(true);
      repository.insertWallet.mockImplementation((newWallet) =>
        Promise.resolve(aWallet({ openingBalanceMinor: newWallet.openingBalanceMinor })),
      );

      // Act
      const response = await service.createWallet(
        USER_ID,
        walletInput({ openingBalanceMinor: typed }),
      );

      // Assert
      expect(repository.insertWallet).toHaveBeenCalledWith(
        expect.objectContaining({ openingBalanceMinor: stored }),
      );
      expect(response.openingBalanceMinor).toBe(shown);
      expect(response.balanceMinor).toBe(shown);
    });
  });

  describe('listWallets — the Wallet Overview', () => {
    const CARD_ID = 'c0000000-0000-4000-8000-000000000003';
    const BANK_ID = 'b0000000-0000-4000-8000-000000000002';
    const CASH_ID = 'a0000000-0000-4000-8000-000000000001';

    it('S-1: answers each Wallet with its Balance in the order the repository gives them (newest first), and one Currency Total per Currency', async () => {
      // Arrange
      const card = aWallet({
        id: CARD_ID,
        name: 'Card',
        currency: 'USD',
        openingBalanceMinor: 1000n,
      });
      const bank = aWallet({ id: BANK_ID, name: 'Bank', openingBalanceMinor: 250000n });
      const cash = aWallet({ id: CASH_ID, name: 'Cash' });
      repository.listWalletsOwnedBy.mockResolvedValue([
        { wallet: card, balanceMinor: 1000n },
        { wallet: bank, balanceMinor: 250000n },
        { wallet: cash, balanceMinor: 87450n },
      ]);

      // Act
      const response = await service.listWallets(USER_ID);

      // Assert
      expect(repository.listWalletsOwnedBy).toHaveBeenCalledWith(USER_ID);
      expect(response).toEqual({
        wallets: [
          {
            id: CARD_ID,
            name: 'Card',
            currency: 'USD',
            balanceMinor: '1000',
            archivedAt: null,
            createdAt: '2026-10-29T10:00:00.123Z',
          },
          {
            id: BANK_ID,
            name: 'Bank',
            currency: 'THB',
            balanceMinor: '250000',
            archivedAt: null,
            createdAt: '2026-10-29T10:00:00.123Z',
          },
          {
            id: CASH_ID,
            name: 'Cash',
            currency: 'THB',
            balanceMinor: '87450',
            archivedAt: null,
            createdAt: '2026-10-29T10:00:00.123Z',
          },
        ],
        currencyTotals: [
          { currency: 'THB', balanceMinor: '337450' },
          { currency: 'USD', balanceMinor: '1000' },
        ],
      });
    });

    it('never shows more than the overview keys: no userId, no Opening Balance', async () => {
      // Arrange
      repository.listWalletsOwnedBy.mockResolvedValue([
        { wallet: aWallet(), balanceMinor: 100000n },
      ]);

      // Act
      const response = await service.listWallets(USER_ID);

      // Assert
      expect(Object.keys(response).sort()).toEqual(['currencyTotals', 'wallets']);
      expect(Object.keys(response.wallets[0]).sort()).toEqual([
        'archivedAt',
        'balanceMinor',
        'createdAt',
        'currency',
        'id',
        'name',
      ]);
      expect(Object.keys(response.currencyTotals[0]).sort()).toEqual(['balanceMinor', 'currency']);
    });

    it('S-4: shows an Archived Wallet in place, with its archivedAt as an ISO instant, and still counts it in its Currency Total', async () => {
      // Arrange
      const archivedAt = new Date('2026-10-29T11:30:00.789Z');
      repository.listWalletsOwnedBy.mockResolvedValue([
        { wallet: aWallet({ id: BANK_ID, name: 'Old Card', archivedAt }), balanceMinor: 48000n },
      ]);

      // Act
      const response = await service.listWallets(USER_ID);

      // Assert
      expect(response.wallets[0].archivedAt).toBe('2026-10-29T11:30:00.789Z');
      expect(response.currencyTotals).toEqual([{ currency: 'THB', balanceMinor: '48000' }]);
    });

    it('S-6: answers no Wallets and no Currency Totals for a User with no Wallets', async () => {
      // Arrange
      repository.listWalletsOwnedBy.mockResolvedValue([]);

      // Act
      const response = await service.listWallets(USER_ID);

      // Assert
      expect(response).toEqual({ wallets: [], currencyTotals: [] });
    });

    it('S-7: shows a negative Balance and a Currency Total of zero as signed decimal strings', async () => {
      // Arrange
      repository.listWalletsOwnedBy.mockResolvedValue([
        { wallet: aWallet({ id: CARD_ID, currency: 'JPY' }), balanceMinor: -1500n },
        { wallet: aWallet({ id: BANK_ID }), balanceMinor: -250075n },
        { wallet: aWallet({ id: CASH_ID }), balanceMinor: 250075n },
      ]);

      // Act
      const response = await service.listWallets(USER_ID);

      // Assert
      expect(response.wallets.map((wallet) => wallet.balanceMinor)).toEqual([
        '-1500',
        '-250075',
        '250075',
      ]);
      expect(response.currencyTotals).toEqual([
        { currency: 'JPY', balanceMinor: '-1500' },
        { currency: 'THB', balanceMinor: '0' },
      ]);
    });

    it('S-8: shows Currency Totals beyond 2^53 as exact decimal strings (AC-1.5)', async () => {
      // Arrange
      repository.listWalletsOwnedBy.mockResolvedValue([
        { wallet: aWallet({ id: CARD_ID, currency: 'KRW' }), balanceMinor: 999999999999999n },
        { wallet: aWallet({ id: BANK_ID, currency: 'KRW' }), balanceMinor: 10999999999999989n },
        { wallet: aWallet({ id: CASH_ID, currency: 'KRW' }), balanceMinor: 10999999999999989n },
      ]);

      // Act
      const response = await service.listWallets(USER_ID);

      // Assert
      expect(response.currencyTotals).toEqual([
        { currency: 'KRW', balanceMinor: '22999999999999977' },
      ]);
    });
  });

  describe('getWallet', () => {
    it('answers the Wallet with its derived Balance and its Transactions in the order the repository gives them', async () => {
      // Arrange
      const lunch = aTransaction();
      const salary = aTransaction({
        id: '8a1f0e2a-1c3d-4e5f-8a7b-6c5d4e3f2a11',
        kind: 'income',
        amountMinor: 200000n,
        note: null,
      });
      repository.findOwnedWalletDetail.mockResolvedValue({
        wallet: aWallet(),
        balanceMinor: 287450n,
        transactions: [salary, lunch],
      });

      // Act
      const response = await service.getWallet(USER_ID, WALLET_ID);

      // Assert
      expect(repository.findOwnedWalletDetail).toHaveBeenCalledWith(USER_ID, WALLET_ID);
      expect(response).toEqual({
        id: WALLET_ID,
        name: 'Cash',
        currency: 'THB',
        openingBalanceMinor: '100000',
        balanceMinor: '287450',
        archivedAt: null,
        createdAt: '2026-10-29T10:00:00.123Z',
        updatedAt: '2026-10-29T10:00:00.456Z',
        transactions: [
          {
            id: salary.id,
            walletId: WALLET_ID,
            kind: 'income',
            amountMinor: '200000',
            occurredOn: '2026-10-29',
            note: null,
            createdAt: '2026-10-29T10:00:00.123Z',
            updatedAt: '2026-10-29T10:00:00.456Z',
          },
          {
            id: lunch.id,
            walletId: WALLET_ID,
            kind: 'expense',
            amountMinor: '12550',
            occurredOn: '2026-10-29',
            note: 'Lunch',
            createdAt: '2026-10-29T10:00:00.123Z',
            updatedAt: '2026-10-29T10:00:00.456Z',
          },
        ],
      });
    });

    it('shows a negative Balance as a signed decimal string, exact past 2^53', async () => {
      // Arrange
      repository.findOwnedWalletDetail.mockResolvedValue({
        wallet: aWallet({ openingBalanceMinor: 0n }),
        balanceMinor: -2999999999999997n,
        transactions: [],
      });

      // Act
      const response = await service.getWallet(USER_ID, WALLET_ID);

      // Assert
      expect(response.balanceMinor).toBe('-2999999999999997');
    });

    it('keeps occurredOn exactly as stored — a plain date string, never re-parsed (AD-1)', async () => {
      // Arrange
      repository.findOwnedWalletDetail.mockResolvedValue({
        wallet: aWallet(),
        balanceMinor: 99300n,
        transactions: [aTransaction({ occurredOn: '2024-02-29' })],
      });

      // Act
      const response = await service.getWallet(USER_ID, WALLET_ID);

      // Assert
      expect(response.transactions[0].occurredOn).toBe('2024-02-29');
    });

    it('answers 404 "Wallet not found." when the repository finds no such Wallet for this User (missing or another User’s alike — S-20, S-21)', async () => {
      // Arrange
      repository.findOwnedWalletDetail.mockResolvedValue(null);

      // Act
      const failure = service.getWallet(USER_ID, WALLET_ID);

      // Assert
      await expect(failure).rejects.toBeInstanceOf(NotFoundException);
      await expect(failure).rejects.toMatchObject({ response: walletNotFoundBody });
    });

    it.each([
      ['empty', ''],
      ['not a UUID', 'not-a-uuid'],
      ['a number', '123'],
      ['one character short', '3f6c1a52-9d7e-4b8a-a1c4-5e2f7d9b0c1'],
      ['one character long', '3f6c1a52-9d7e-4b8a-a1c4-5e2f7d9b0c133'],
      ['wrapped in braces (Postgres would accept it)', '{3f6c1a52-9d7e-4b8a-a1c4-5e2f7d9b0c13}'],
      ['without hyphens (Postgres would accept it)', '3f6c1a529d7e4b8aa1c45e2f7d9b0c13'],
      ['not hexadecimal', 'gf6c1a52-9d7e-4b8a-a1c4-5e2f7d9b0c13'],
      ['SQL', "'; DROP TABLE wallets; --"],
      ['a NUL character', '\u0000'],
    ])(
      'answers 404 for an id that is %s, without querying the database',
      async (_why, walletId) => {
        // Arrange / Act
        const failure = service.getWallet(USER_ID, walletId);

        // Assert
        await expect(failure).rejects.toMatchObject({ response: walletNotFoundBody });
        expect(repository.findOwnedWalletDetail).not.toHaveBeenCalled();
      },
    );

    it('accepts an upper-case UUID', async () => {
      // Arrange
      repository.findOwnedWalletDetail.mockResolvedValue(null);

      // Act
      const failure = service.getWallet(USER_ID, WALLET_ID.toUpperCase());

      // Assert: it reached the repository (so it is answered 404 because it is not found, not because of its shape)
      await expect(failure).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.findOwnedWalletDetail).toHaveBeenCalledWith(
        USER_ID,
        WALLET_ID.toUpperCase(),
      );
    });
  });

  describe('updateWallet — rename and archive', () => {
    const ARCHIVED_AT = new Date('2026-10-29T11:30:00.789Z');
    const LATER = new Date('2026-10-29T12:00:00.000Z');

    const nothingToChangeBody = {
      statusCode: 400,
      message: ['Nothing to change.'],
      error: 'Bad Request',
    };

    it('S-3: renames the Wallet for its owner in one repository call and answers it with its Balance, Currency and money unchanged', async () => {
      // Arrange
      repository.updateOwnedWallet.mockResolvedValue({
        wallet: aWallet({ name: 'Daily Cash', updatedAt: LATER }),
        balanceMinor: 87450n,
      });

      // Act
      const response = await service.updateWallet(USER_ID, WALLET_ID, { name: 'Daily Cash' });

      // Assert
      expect(repository.updateOwnedWallet).toHaveBeenCalledTimes(1);
      expect(repository.updateOwnedWallet).toHaveBeenCalledWith(USER_ID, WALLET_ID, {
        name: 'Daily Cash',
        archive: false,
      });
      expect(response).toEqual({
        id: WALLET_ID,
        name: 'Daily Cash',
        currency: 'THB',
        openingBalanceMinor: '100000',
        balanceMinor: '87450',
        archivedAt: null,
        createdAt: '2026-10-29T10:00:00.123Z',
        updatedAt: '2026-10-29T12:00:00.000Z',
      });
    });

    it('S-4: archives the Wallet and answers it with archivedAt as an ISO instant and its Balance kept', async () => {
      // Arrange
      repository.updateOwnedWallet.mockResolvedValue({
        wallet: aWallet({ archivedAt: ARCHIVED_AT, updatedAt: ARCHIVED_AT }),
        balanceMinor: 250000n,
      });

      // Act
      const response = await service.updateWallet(USER_ID, WALLET_ID, { archived: true });

      // Assert
      expect(repository.updateOwnedWallet).toHaveBeenCalledWith(USER_ID, WALLET_ID, {
        name: null,
        archive: true,
      });
      expect(response.archivedAt).toBe('2026-10-29T11:30:00.789Z');
      expect(response.balanceMinor).toBe('250000');
    });

    it('asks for a rename and an archive together in ONE repository call, so both are applied or neither', async () => {
      // Arrange
      repository.updateOwnedWallet.mockResolvedValue({
        wallet: aWallet({ name: 'Both Done', archivedAt: ARCHIVED_AT, updatedAt: ARCHIVED_AT }),
        balanceMinor: 100000n,
      });

      // Act
      await service.updateWallet(USER_ID, WALLET_ID, { name: 'Both Done', archived: true });

      // Assert
      expect(repository.updateOwnedWallet).toHaveBeenCalledTimes(1);
      expect(repository.updateOwnedWallet).toHaveBeenCalledWith(USER_ID, WALLET_ID, {
        name: 'Both Done',
        archive: true,
      });
    });

    it.each([
      ['a null archived', { name: 'Cash', archived: null }, { name: 'Cash', archive: false }],
      ['a null name', { name: null, archived: true as const }, { name: null, archive: true }],
    ])('treats %s as "not changing"', async (_why, input: UpdateWalletDto, change) => {
      // Arrange
      repository.updateOwnedWallet.mockResolvedValue({ wallet: aWallet(), balanceMinor: 1n });

      // Act
      await service.updateWallet(USER_ID, WALLET_ID, input);

      // Assert
      expect(repository.updateOwnedWallet).toHaveBeenCalledWith(USER_ID, WALLET_ID, change);
    });

    it('AC-2.5: renames an Archived Wallet like any other — it stays archived', async () => {
      // Arrange
      repository.updateOwnedWallet.mockResolvedValue({
        wallet: aWallet({ name: 'Old Visa', archivedAt: ARCHIVED_AT, updatedAt: LATER }),
        balanceMinor: 48000n,
      });

      // Act
      const response = await service.updateWallet(USER_ID, WALLET_ID, { name: 'Old Visa' });

      // Assert
      expect(response.name).toBe('Old Visa');
      expect(response.archivedAt).toBe('2026-10-29T11:30:00.789Z');
    });

    it('never shows the owner: the response has exactly the Wallet keys (no userId)', async () => {
      // Arrange
      repository.updateOwnedWallet.mockResolvedValue({ wallet: aWallet(), balanceMinor: 1n });

      // Act
      const response = await service.updateWallet(USER_ID, WALLET_ID, { name: 'Cash' });

      // Assert
      expect(Object.keys(response).sort()).toEqual([
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

    it.each([
      ['neither field', {}],
      ['a null name only', { name: null }],
      ['a null archived only', { archived: null }],
      ['both null', { name: null, archived: null }],
    ])(
      'S-13: answers 400 "Nothing to change." for %s, before the Wallet is looked up',
      async (_why, input: UpdateWalletDto) => {
        // Arrange / Act
        const failure = service.updateWallet(USER_ID, WALLET_ID, input);

        // Assert
        await expect(failure).rejects.toBeInstanceOf(BadRequestException);
        await expect(failure).rejects.toMatchObject({ response: nothingToChangeBody });
        expect(repository.updateOwnedWallet).not.toHaveBeenCalled();
        expect(repository.findOwnedWallet).not.toHaveBeenCalled();
      },
    );

    it('S-14: judges the request’s shape before the id: "Nothing to change." for a malformed id is a 400, never a 404', async () => {
      // Arrange / Act
      const failure = service.updateWallet(USER_ID, 'not-a-uuid', {});

      // Assert
      await expect(failure).rejects.toMatchObject({ response: nothingToChangeBody });
    });

    it('S-14: answers 404 "Wallet not found." when nothing was applied and the Wallet is not visible to the User', async () => {
      // Arrange
      repository.updateOwnedWallet.mockResolvedValue(null);
      repository.findOwnedWallet.mockResolvedValue(null);

      // Act
      const failure = service.updateWallet(USER_ID, WALLET_ID, { name: 'Mine now' });

      // Assert
      await expect(failure).rejects.toBeInstanceOf(NotFoundException);
      await expect(failure).rejects.toMatchObject({ response: walletNotFoundBody });
      expect(repository.findOwnedWallet).toHaveBeenCalledWith(USER_ID, WALLET_ID);
    });

    it('S-13: answers 409 "This wallet is already archived." when nothing was applied although the Wallet is the User’s — and applies nothing else', async () => {
      // Arrange
      repository.updateOwnedWallet.mockResolvedValue(null);
      repository.findOwnedWallet.mockResolvedValue(aWallet({ archivedAt: ARCHIVED_AT }));

      // Act
      const failure = service.updateWallet(USER_ID, WALLET_ID, {
        name: 'Rename with archive',
        archived: true,
      });

      // Assert
      await expect(failure).rejects.toBeInstanceOf(ConflictException);
      await expect(failure).rejects.toMatchObject({
        response: {
          statusCode: 409,
          message: 'This wallet is already archived.',
          error: 'Conflict',
        },
      });
      expect(repository.updateOwnedWallet).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['empty', ''],
      ['not a UUID', 'not-a-uuid'],
      ['wrapped in braces (Postgres would accept it)', '{3f6c1a52-9d7e-4b8a-a1c4-5e2f7d9b0c13}'],
      ['without hyphens (Postgres would accept it)', '3f6c1a529d7e4b8aa1c45e2f7d9b0c13'],
      ['a NUL character', '\u0000'],
    ])(
      'S-14: answers 404 for an id that is %s, without querying the database',
      async (_why, walletId) => {
        // Arrange / Act
        const failure = service.updateWallet(USER_ID, walletId, { name: 'Cash' });

        // Assert
        await expect(failure).rejects.toMatchObject({ response: walletNotFoundBody });
        expect(repository.updateOwnedWallet).not.toHaveBeenCalled();
        expect(repository.findOwnedWallet).not.toHaveBeenCalled();
      },
    );
  });

  describe('recordTransaction', () => {
    it('checks the Wallet is visible to the User, stores the Transaction in it, and answers it (S-1)', async () => {
      // Arrange
      repository.findOwnedWallet.mockResolvedValue(aWallet());
      repository.insertTransaction.mockResolvedValue(aTransaction());

      // Act
      const response = await service.recordTransaction(USER_ID, WALLET_ID, transactionInput());

      // Assert
      expect(repository.findOwnedWallet).toHaveBeenCalledWith(USER_ID, WALLET_ID);
      expect(repository.insertTransaction).toHaveBeenCalledWith({
        walletId: WALLET_ID,
        kind: 'expense',
        amountMinor: 12550n,
        occurredOn: '2026-10-29',
        note: 'Lunch',
      });
      expect(response).toEqual({
        id: '9b1f0e2a-1c3d-4e5f-8a7b-6c5d4e3f2a10',
        walletId: WALLET_ID,
        kind: 'expense',
        amountMinor: '12550',
        occurredOn: '2026-10-29',
        note: 'Lunch',
        createdAt: '2026-10-29T10:00:00.123Z',
        updatedAt: '2026-10-29T10:00:00.456Z',
      });
    });

    it('never stores `today`: it only served the future-date check', async () => {
      // Arrange
      repository.findOwnedWallet.mockResolvedValue(aWallet());
      repository.insertTransaction.mockResolvedValue(aTransaction());

      // Act
      await service.recordTransaction(
        USER_ID,
        WALLET_ID,
        transactionInput({ today: '2030-01-01' }),
      );

      // Assert
      expect(Object.keys(repository.insertTransaction.mock.calls[0][0]).sort()).toEqual([
        'amountMinor',
        'kind',
        'note',
        'occurredOn',
        'walletId',
      ]);
    });

    it.each([
      ['an absent note', undefined],
      ['a null note', null],
    ])('stores %s as null (S-7)', async (_why, note) => {
      // Arrange
      repository.findOwnedWallet.mockResolvedValue(aWallet());
      repository.insertTransaction.mockResolvedValue(aTransaction({ note: null }));

      // Act
      await service.recordTransaction(USER_ID, WALLET_ID, transactionInput({ note }));

      // Assert
      expect(repository.insertTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ note: null }),
      );
    });

    it.each([
      ['leading zeros are dropped', '007', 7n],
      ['the smallest amount is 1', '1', 1n],
      ['the largest 15-digit amount is kept exactly', '999999999999999', 999999999999999n],
    ])('stores the canonical amount: %s', async (_why, typed, stored) => {
      // Arrange
      repository.findOwnedWallet.mockResolvedValue(aWallet());
      repository.insertTransaction.mockResolvedValue(aTransaction({ amountMinor: stored }));

      // Act
      await service.recordTransaction(USER_ID, WALLET_ID, transactionInput({ amountMinor: typed }));

      // Assert
      expect(repository.insertTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ amountMinor: stored }),
      );
    });

    it('answers 404 "Wallet not found." and stores nothing when the Wallet is not visible to the User (S-20)', async () => {
      // Arrange
      repository.findOwnedWallet.mockResolvedValue(null);

      // Act
      const failure = service.recordTransaction(USER_ID, WALLET_ID, transactionInput());

      // Assert
      await expect(failure).rejects.toBeInstanceOf(NotFoundException);
      await expect(failure).rejects.toMatchObject({ response: walletNotFoundBody });
      expect(repository.insertTransaction).not.toHaveBeenCalled();
    });

    it('answers 404 for an id that is not a UUID, without querying the database (S-21)', async () => {
      // Arrange / Act
      const failure = service.recordTransaction(USER_ID, 'not-a-uuid', transactionInput());

      // Assert
      await expect(failure).rejects.toMatchObject({ response: walletNotFoundBody });
      expect(repository.findOwnedWallet).not.toHaveBeenCalled();
      expect(repository.insertTransaction).not.toHaveBeenCalled();
    });

    it('S-12: answers 409 "This wallet is archived and accepts no new transactions." when the repository refuses the insert because the Wallet is Archived', async () => {
      // Arrange: the Wallet is visible, and the insert (which carries the archived check itself) answers null
      repository.findOwnedWallet.mockResolvedValue(aWallet());
      repository.insertTransaction.mockResolvedValue(null);

      // Act
      const failure = service.recordTransaction(USER_ID, WALLET_ID, transactionInput());

      // Assert
      await expect(failure).rejects.toBeInstanceOf(ConflictException);
      await expect(failure).rejects.toMatchObject({
        response: {
          statusCode: 409,
          message: 'This wallet is archived and accepts no new transactions.',
          error: 'Conflict',
        },
      });
    });

    it('S-12: the 404 comes first — a Wallet that is not visible is "not found", archived or not, and nothing is inserted', async () => {
      // Arrange
      repository.findOwnedWallet.mockResolvedValue(null);
      repository.insertTransaction.mockResolvedValue(null);

      // Act
      const failure = service.recordTransaction(USER_ID, WALLET_ID, transactionInput());

      // Assert
      await expect(failure).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.insertTransaction).not.toHaveBeenCalled();
    });
  });
});
