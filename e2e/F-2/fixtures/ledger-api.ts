// Fast preconditions through the real /api/v1 (via the same Vite proxy the UI uses). Pass `page.request`: it
// shares the page's cookie jar, so these act as the User the page is signed in as. Payload shapes are the
// contract in artifacts/F-2/02-flow.md (money as decimal-integer strings, dates as YYYY-MM-DD).
// Only preconditions go through here — the behaviour under test always goes through the UI.
import { expect, type APIRequestContext } from '@playwright/test';
import { localDate } from './test-data';

export interface CreatedWallet {
  id: string;
  name: string;
  currency: string;
  openingBalanceMinor: string;
  balanceMinor: string;
}

export interface RecordedTransaction {
  id: string;
  walletId: string;
  kind: 'income' | 'expense';
  amountMinor: string;
  occurredOn: string;
  note: string | null;
}

export async function createWalletViaApi(
  request: APIRequestContext,
  wallet: { name: string; currency: string; openingBalanceMinor: string },
): Promise<CreatedWallet> {
  const response = await request.post('/api/v1/wallets', { data: wallet });
  expect(response.status(), `create Wallet ${wallet.name}`).toBe(201);
  return (await response.json()) as CreatedWallet;
}

export async function recordTransactionViaApi(
  request: APIRequestContext,
  walletId: string,
  transaction: { kind: 'income' | 'expense'; amountMinor: string; occurredOn?: string; note?: string | null },
): Promise<RecordedTransaction> {
  const today = localDate(0);
  const response = await request.post(`/api/v1/wallets/${walletId}/transactions`, {
    data: { occurredOn: today, ...transaction, today },
  });
  expect(response.status(), `record ${transaction.kind} ${transaction.amountMinor}`).toBe(201);
  return (await response.json()) as RecordedTransaction;
}
