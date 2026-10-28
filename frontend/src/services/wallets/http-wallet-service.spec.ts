import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../http/api-error';
import { HttpWalletService } from './http-wallet-service';
import type { Currency, Transaction, Wallet, WalletDetail } from './wallet.types';

// Boundary under test: HttpWalletService, the only code that talks to the Ledger and Exchange Rates endpoints. The one
// thing mocked is `fetch`.

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** A service whose `fetch` answers every call with a fresh response made by `answer` (a body can be read only once). */
function serviceAnswering(answer: () => Response | Error) {
  const fetchFn = vi.fn<typeof fetch>(() => {
    const response = answer();
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
  });
  return { service: new HttpWalletService(fetchFn), fetchFn };
}

const CURRENCIES: Currency[] = [
  { code: 'JPY', name: 'Japanese Yen', minorDigits: 0 },
  { code: 'THB', name: 'Thai Baht', minorDigits: 2 },
];

const WALLET: Wallet = {
  id: '6c1f0a52-0b64-4d8e-9a53-5b0f6a2a7c11',
  name: 'Cash',
  currency: 'THB',
  openingBalanceMinor: '100000',
  balanceMinor: '100000',
  createdAt: '2026-10-29T03:00:00.000Z',
  updatedAt: '2026-10-29T03:00:00.000Z',
};

const TRANSACTION: Transaction = {
  id: '0d4a9b7e-3c2f-4a51-8e60-2f1b9c7d5e33',
  walletId: WALLET.id,
  kind: 'expense',
  amountMinor: '12550',
  occurredOn: '2026-10-29',
  note: 'Lunch',
  createdAt: '2026-10-29T03:05:00.000Z',
  updatedAt: '2026-10-29T03:05:00.000Z',
};

const NOT_SIGNED_IN = { statusCode: 401, message: 'Not signed in.', error: 'Unauthorized' };

describe('HttpWalletService.listCurrencies', () => {
  it('asks GET /api/v1/currencies and returns the list', async () => {
    // Arrange
    const { service, fetchFn } = serviceAnswering(() =>
      jsonResponse(200, { currencies: CURRENCIES }),
    );

    // Act
    const currencies = await service.listCurrencies();

    // Assert
    expect(currencies).toEqual(CURRENCIES);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('/api/v1/currencies');
    expect(init?.method).toBe('GET');
    expect(init?.credentials).toBe('same-origin');
    expect(init?.body).toBeUndefined();
  });

  it('asks only once: the next call reuses the answer (the list does not change while the app is open)', async () => {
    // Arrange
    const { service, fetchFn } = serviceAnswering(() =>
      jsonResponse(200, { currencies: CURRENCIES }),
    );
    await service.listCurrencies();

    // Act
    const again = await service.listCurrencies();

    // Assert
    expect(again).toEqual(CURRENCIES);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('shares one request between callers that ask before the first answer has come', async () => {
    // Arrange
    const { service, fetchFn } = serviceAnswering(() =>
      jsonResponse(200, { currencies: CURRENCIES }),
    );

    // Act
    await Promise.all([service.listCurrencies(), service.listCurrencies()]);

    // Assert
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('asks again after a failure instead of remembering it', async () => {
    // Arrange
    const answers = [jsonResponse(502, {}), jsonResponse(200, { currencies: CURRENCIES })];
    const { service, fetchFn } = serviceAnswering(() => answers.shift()!);
    await expect(service.listCurrencies()).rejects.toBeInstanceOf(ApiError);

    // Act
    const currencies = await service.listCurrencies();

    // Assert
    expect(currencies).toEqual(CURRENCIES);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('rejects with the 401 message when nobody is signed in', async () => {
    // Arrange
    const { service } = serviceAnswering(() => jsonResponse(401, NOT_SIGNED_IN));

    // Act
    const failure = service.listCurrencies();

    // Assert
    await expect(failure).rejects.toEqual(
      expect.objectContaining({ status: 401, messages: ['Not signed in.'] }),
    );
  });
});

describe('HttpWalletService.listWallets', () => {
  it('asks GET /api/v1/wallets and returns the summaries in the order they come', async () => {
    // Arrange
    const summaries = [
      { id: 'b', name: 'Bank', currency: 'USD', createdAt: '2026-10-29T04:00:00.000Z' },
      { id: 'a', name: 'Cash', currency: 'THB', createdAt: '2026-10-29T03:00:00.000Z' },
    ];
    const { service, fetchFn } = serviceAnswering(() => jsonResponse(200, { wallets: summaries }));

    // Act
    const wallets = await service.listWallets();

    // Assert
    expect(wallets).toEqual(summaries);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('/api/v1/wallets');
    expect(init?.method).toBe('GET');
  });

  it('rejects with an ApiError for any other failure, even without a JSON body', async () => {
    // Arrange
    const { service } = serviceAnswering(
      () => new Response('<html>Bad gateway</html>', { status: 502 }),
    );

    // Act
    const failure = service.listWallets();

    // Assert
    await expect(failure).rejects.toEqual(expect.objectContaining({ status: 502, messages: [] }));
  });

  it('rejects when a 200 answer is not JSON — a proxy’s fallback page must not be taken for the Wallets', async () => {
    // Arrange
    const { service } = serviceAnswering(
      () =>
        new Response('<!doctype html><title>Money Management</title>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        }),
    );

    // Act
    const failure = service.listWallets();

    // Assert
    await expect(failure).rejects.toBeInstanceOf(SyntaxError);
  });

  it('lets a transport failure through unchanged', async () => {
    // Arrange
    const offline = new TypeError('Failed to fetch');
    const { service } = serviceAnswering(() => offline);

    // Act
    const failure = service.listWallets();

    // Assert
    await expect(failure).rejects.toBe(offline);
  });
});

describe('HttpWalletService.createWallet', () => {
  it('posts the Wallet as JSON to /api/v1/wallets and returns the created Wallet', async () => {
    // Arrange
    const { service, fetchFn } = serviceAnswering(() => jsonResponse(201, WALLET));

    // Act
    const wallet = await service.createWallet({
      name: 'Cash',
      currency: 'THB',
      openingBalanceMinor: '100000',
    });

    // Assert
    expect(wallet).toEqual(WALLET);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('/api/v1/wallets');
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('same-origin');
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(init?.body))).toEqual({
      name: 'Cash',
      currency: 'THB',
      openingBalanceMinor: '100000',
    });
  });

  it('rejects with every message of a 400', async () => {
    // Arrange
    const messages = [
      'Enter a wallet name.',
      'Opening balance must be a whole number of minor units.',
    ];
    const { service } = serviceAnswering(() =>
      jsonResponse(400, { statusCode: 400, message: messages, error: 'Bad Request' }),
    );

    // Act
    const failure = service.createWallet({ name: '', currency: 'THB', openingBalanceMinor: '1.5' });

    // Assert
    await expect(failure).rejects.toEqual(expect.objectContaining({ status: 400, messages }));
    await expect(failure).rejects.toBeInstanceOf(ApiError);
  });
});

describe('HttpWalletService.getWallet', () => {
  it('asks GET /api/v1/wallets/{id} and returns the Wallet with its Transactions as they come', async () => {
    // Arrange
    const detail: WalletDetail = { ...WALLET, balanceMinor: '87450', transactions: [TRANSACTION] };
    const { service, fetchFn } = serviceAnswering(() => jsonResponse(200, detail));

    // Act
    const wallet = await service.getWallet(WALLET.id);

    // Assert
    expect(wallet).toEqual(detail);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe(`/api/v1/wallets/${WALLET.id}`);
    expect(init?.method).toBe('GET');
    expect(init?.body).toBeUndefined();
  });

  it('encodes the id into the path, so no id can change which URL is asked', async () => {
    // Arrange
    const { service, fetchFn } = serviceAnswering(() => jsonResponse(404, {}));

    // Act
    await service.getWallet('a/b?c#d').catch(() => undefined);

    // Assert
    expect(fetchFn.mock.calls[0]![0]).toBe('/api/v1/wallets/a%2Fb%3Fc%23d');
  });

  it('rejects with status 404 and the backend’s message for a Wallet that is not found', async () => {
    // Arrange
    const { service } = serviceAnswering(() =>
      jsonResponse(404, { statusCode: 404, message: 'Wallet not found.', error: 'Not Found' }),
    );

    // Act
    const failure = service.getWallet('not-a-uuid');

    // Assert
    await expect(failure).rejects.toEqual(
      expect.objectContaining({ status: 404, messages: ['Wallet not found.'] }),
    );
  });
});

describe('HttpWalletService.recordTransaction', () => {
  it('posts the Transaction as JSON to /api/v1/wallets/{id}/transactions and returns it', async () => {
    // Arrange
    const { service, fetchFn } = serviceAnswering(() => jsonResponse(201, TRANSACTION));
    const request = {
      kind: 'expense' as const,
      amountMinor: '12550',
      occurredOn: '2026-10-29',
      note: 'Lunch',
      today: '2026-10-29',
    };

    // Act
    const transaction = await service.recordTransaction(WALLET.id, request);

    // Assert
    expect(transaction).toEqual(TRANSACTION);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe(`/api/v1/wallets/${WALLET.id}/transactions`);
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(init?.body))).toEqual(request);
  });

  it('rejects with every message of a 400, so none is lost', async () => {
    // Arrange
    const messages = ['Amount must be greater than 0.', "Date can't be in the future."];
    const { service } = serviceAnswering(() =>
      jsonResponse(400, { statusCode: 400, message: messages, error: 'Bad Request' }),
    );

    // Act
    const failure = service.recordTransaction(WALLET.id, {
      kind: 'expense',
      amountMinor: '0',
      occurredOn: '2026-10-30',
      today: '2026-10-29',
    });

    // Assert
    await expect(failure).rejects.toEqual(expect.objectContaining({ status: 400, messages }));
  });

  it('rejects with 404 when the Wallet is not the person’s', async () => {
    // Arrange
    const { service } = serviceAnswering(() =>
      jsonResponse(404, { statusCode: 404, message: 'Wallet not found.', error: 'Not Found' }),
    );

    // Act
    const failure = service.recordTransaction(WALLET.id, {
      kind: 'income',
      amountMinor: '100',
      occurredOn: '2026-10-29',
      today: '2026-10-29',
    });

    // Assert
    await expect(failure).rejects.toEqual(expect.objectContaining({ status: 404 }));
  });
});
