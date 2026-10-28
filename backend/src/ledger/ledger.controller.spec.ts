import { BadRequestException, INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createLedgerServiceMock } from '../../test/support/mocks';
import type { AuthenticatedRequest } from '../identity/authenticated-request';
import { createValidationPipe } from '../validation-pipe';
import type {
  TransactionResponseDto,
  WalletDetailResponseDto,
  WalletResponseDto,
} from './dto/ledger-response.dto';
import { LedgerController } from './ledger.controller';
import { LEDGER_SERVICE } from './ledger.tokens';

const WALLET_ID = '3f6c1a52-9d7e-4b8a-a1c4-5e2f7d9b0c13';

const aWalletResponse = (): WalletResponseDto => ({
  id: WALLET_ID,
  name: 'Cash',
  currency: 'THB',
  openingBalanceMinor: '100000',
  balanceMinor: '100000',
  createdAt: '2026-10-29T10:00:00.123Z',
  updatedAt: '2026-10-29T10:00:00.123Z',
});

const aTransactionResponse = (): TransactionResponseDto => ({
  id: '9b1f0e2a-1c3d-4e5f-8a7b-6c5d4e3f2a10',
  walletId: WALLET_ID,
  kind: 'expense',
  amountMinor: '12550',
  occurredOn: '2026-10-29',
  note: 'Lunch',
  createdAt: '2026-10-29T10:00:01.000Z',
  updatedAt: '2026-10-29T10:00:01.000Z',
});

// Controller under test: the real transport (routing, the global ValidationPipe, status codes), the business logic mocked.
describe('LedgerController', () => {
  let app: INestApplication;
  let ledger: ReturnType<typeof createLedgerServiceMock>;

  beforeEach(async () => {
    ledger = createLedgerServiceMock();
    const moduleRef = await Test.createTestingModule({
      controllers: [LedgerController],
      providers: [{ provide: LEDGER_SERVICE, useValue: ledger }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());
    // Stands in for the SessionGuard, which attaches who is signed in to the request on protected routes.
    app.use((req: unknown, _res: unknown, next: () => void) => {
      (req as AuthenticatedRequest).identity = {
        user: { userId: 'user-1' },
        sessionId: 'session-1',
      };
      next();
    });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  describe('POST /api/v1/wallets', () => {
    it('creates the Wallet for the signed-in User and answers 201 with it (S-1)', async () => {
      // Arrange
      ledger.createWallet.mockResolvedValue(aWalletResponse());

      // Act
      const response = await request(server())
        .post('/api/v1/wallets')
        .send({ name: 'Cash', currency: 'THB', openingBalanceMinor: '100000' });

      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toEqual(aWalletResponse());
      expect(ledger.createWallet).toHaveBeenCalledWith('user-1', {
        name: 'Cash',
        currency: 'THB',
        openingBalanceMinor: '100000',
      });
    });

    it('answers what the business logic throws: the 400 for an unsupported Currency passes through unchanged (S-15)', async () => {
      // Arrange
      ledger.createWallet.mockRejectedValue(
        new BadRequestException({
          statusCode: 400,
          message: ['Choose a supported currency.'],
          error: 'Bad Request',
        }),
      );

      // Act
      const response = await request(server())
        .post('/api/v1/wallets')
        .send({ name: 'Cash', currency: 'XYZ', openingBalanceMinor: '100000' });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        statusCode: 400,
        message: ['Choose a supported currency.'],
        error: 'Bad Request',
      });
    });

    it('answers 400 with every message and never reaches the business logic when the body breaks the rules (S-14, S-16)', async () => {
      // Arrange
      const body = { name: '   ', currency: 'THB', openingBalanceMinor: 'abc' };

      // Act
      const response = await request(server()).post('/api/v1/wallets').send(body);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        statusCode: 400,
        message: ['Enter a wallet name.', 'Opening balance must be a whole number of minor units.'],
        error: 'Bad Request',
      });
      expect(ledger.createWallet).not.toHaveBeenCalled();
    });

    it('hands the business logic the trimmed name and only the declared fields — a body cannot choose its id or owner', async () => {
      // Arrange
      ledger.createWallet.mockResolvedValue(aWalletResponse());

      // Act
      await request(server()).post('/api/v1/wallets').send({
        id: 'smuggled',
        userId: 'smuggled',
        name: '  Cash  ',
        currency: 'THB',
        openingBalanceMinor: '100000',
      });

      // Assert
      expect(ledger.createWallet).toHaveBeenCalledWith('user-1', {
        name: 'Cash',
        currency: 'THB',
        openingBalanceMinor: '100000',
      });
    });
  });

  describe('GET /api/v1/wallets', () => {
    it('answers 200 with the signed-in User’s Wallets', async () => {
      // Arrange
      ledger.listWallets.mockResolvedValue({
        wallets: [
          { id: WALLET_ID, name: 'Cash', currency: 'THB', createdAt: '2026-10-29T10:00:00.123Z' },
        ],
      });

      // Act
      const response = await request(server()).get('/api/v1/wallets');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.wallets).toHaveLength(1);
      expect(ledger.listWallets).toHaveBeenCalledWith('user-1');
    });
  });

  describe('GET /api/v1/wallets/:walletId', () => {
    it('answers 200 with the Wallet, its Balance and its Transactions, asking for the id in the path', async () => {
      // Arrange
      const detail: WalletDetailResponseDto = {
        ...aWalletResponse(),
        balanceMinor: '87450',
        transactions: [aTransactionResponse()],
      };
      ledger.getWallet.mockResolvedValue(detail);

      // Act
      const response = await request(server()).get(`/api/v1/wallets/${WALLET_ID}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual(detail);
      expect(ledger.getWallet).toHaveBeenCalledWith('user-1', WALLET_ID);
    });

    it('passes an id that is not a UUID on as it is — the business logic answers 404, never the pipe with a 400 (S-21)', async () => {
      // Arrange
      ledger.getWallet.mockRejectedValue(new NotFoundException('Wallet not found.'));

      // Act
      const response = await request(server()).get('/api/v1/wallets/not-a-uuid');

      // Assert
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        statusCode: 404,
        message: 'Wallet not found.',
        error: 'Not Found',
      });
      expect(ledger.getWallet).toHaveBeenCalledWith('user-1', 'not-a-uuid');
    });
  });

  describe('POST /api/v1/wallets/:walletId/transactions', () => {
    const body = {
      kind: 'expense',
      amountMinor: '12550',
      occurredOn: '2026-10-29',
      note: 'Lunch',
      today: '2026-10-29',
    };

    it('records the Transaction in the Wallet of the path for the signed-in User and answers 201 (S-1)', async () => {
      // Arrange
      ledger.recordTransaction.mockResolvedValue(aTransactionResponse());

      // Act
      const response = await request(server())
        .post(`/api/v1/wallets/${WALLET_ID}/transactions`)
        .send(body);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toEqual(aTransactionResponse());
      expect(ledger.recordTransaction).toHaveBeenCalledWith('user-1', WALLET_ID, body);
    });

    it('passes an id that is not a UUID on as it is, so the business logic answers 404 (S-21)', async () => {
      // Arrange
      ledger.recordTransaction.mockRejectedValue(new NotFoundException('Wallet not found.'));

      // Act
      const response = await request(server())
        .post('/api/v1/wallets/not-a-uuid/transactions')
        .send(body);

      // Assert
      expect(response.status).toBe(404);
      expect(ledger.recordTransaction).toHaveBeenCalledWith('user-1', 'not-a-uuid', body);
    });

    it('answers 400 with every message and never reaches the business logic when the body breaks the rules (S-17, S-19)', async () => {
      // Arrange
      const invalid = { ...body, kind: 'gift', amountMinor: '0', occurredOn: '2026-10-30' };

      // Act
      const response = await request(server())
        .post(`/api/v1/wallets/${WALLET_ID}/transactions`)
        .send(invalid);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        statusCode: 400,
        message: [
          'Choose income or expense.',
          'Amount must be greater than 0.',
          "Date can't be in the future.",
        ],
        error: 'Bad Request',
      });
      expect(ledger.recordTransaction).not.toHaveBeenCalled();
    });

    it('validates the shape before the Wallet is looked up: a bad body for a Wallet that does not exist is a 400, not a 404 (S-22)', async () => {
      // Arrange
      const invalid = { ...body, kind: 'transfer' };

      // Act
      const response = await request(server())
        .post('/api/v1/wallets/not-a-uuid/transactions')
        .send(invalid);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toEqual(['Choose income or expense.']);
      expect(ledger.recordTransaction).not.toHaveBeenCalled();
    });

    it('hands the business logic the trimmed note, no note as null, and only the declared fields — a body cannot choose its id or its Wallet', async () => {
      // Arrange
      ledger.recordTransaction.mockResolvedValue(aTransactionResponse());

      // Act
      await request(server())
        .post(`/api/v1/wallets/${WALLET_ID}/transactions`)
        .send({
          ...body,
          id: 'smuggled',
          walletId: '00000000-0000-4000-8000-000000000000',
          note: '   ',
        });

      // Assert
      expect(ledger.recordTransaction).toHaveBeenCalledWith('user-1', WALLET_ID, {
        ...body,
        note: null,
      });
    });
  });
});
