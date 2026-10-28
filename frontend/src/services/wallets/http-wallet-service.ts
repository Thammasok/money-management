import { sendJson, toApiError } from '../http/json-api';
import type {
  CreateWalletRequest,
  Currency,
  IWalletService,
  RecordTransactionRequest,
  Transaction,
  Wallet,
  WalletDetail,
  WalletSummary,
} from './wallet.types';

const API_BASE_URL = '/api/v1';

/**
 * The Ledger and Exchange Rates over HTTP: `/api/v1` on the page's own origin, with the httpOnly `sid` cookie and JSON
 * bodies (`sendJson`). `fetchFn` is injected (see `createServices`). Money stays a string end to end; ids are encoded
 * into the path, so no id can change which URL is asked.
 */
export class HttpWalletService implements IWalletService {
  /** The Currency list is a fixed snapshot: asked once per app load, and asked again only after a failure. */
  private currencies: Promise<Currency[]> | null = null;

  constructor(
    private readonly fetchFn: typeof fetch,
    private readonly baseUrl: string = API_BASE_URL,
  ) {}

  listCurrencies(): Promise<Currency[]> {
    this.currencies ??= this.request<{ currencies: Currency[] }>('GET', '/currencies').then(
      (body) => body.currencies,
      (failure: unknown) => {
        this.currencies = null;
        throw failure;
      },
    );
    return this.currencies;
  }

  async listWallets(): Promise<WalletSummary[]> {
    const body = await this.request<{ wallets: WalletSummary[] }>('GET', '/wallets');
    return body.wallets;
  }

  createWallet(request: CreateWalletRequest): Promise<Wallet> {
    return this.request<Wallet>('POST', '/wallets', request);
  }

  getWallet(walletId: string): Promise<WalletDetail> {
    return this.request<WalletDetail>('GET', `/wallets/${encodeURIComponent(walletId)}`);
  }

  recordTransaction(walletId: string, request: RecordTransactionRequest): Promise<Transaction> {
    return this.request<Transaction>(
      'POST',
      `/wallets/${encodeURIComponent(walletId)}/transactions`,
      request,
    );
  }

  private async request<Answer>(method: string, path: string, body?: unknown): Promise<Answer> {
    const response = await sendJson(this.fetchFn, `${this.baseUrl}${path}`, method, body);
    if (!response.ok) throw await toApiError(response);
    return (await response.json()) as Answer;
  }
}
