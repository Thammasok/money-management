// Fast preconditions through the real /api/v1 (via the same Vite proxy the UI uses). Pass `page.request`: it shares
// the page's cookie jar, so these act as the User the page is signed in as. Payload shapes are the contract in
// artifacts/F-3/02-flow.md. Only preconditions go through here — the behaviour under test always goes through the UI.
// F-2's createWalletViaApi / recordTransactionViaApi are reused from e2e/F-2/fixtures/ledger-api.ts.
import { expect, type APIRequestContext } from '@playwright/test';

export interface ManagedWallet {
  id: string;
  name: string;
  currency: string;
  openingBalanceMinor: string;
  balanceMinor: string;
  archivedAt: string | null;
}

/** PATCH /api/v1/wallets/{id} { archived: true } — "archived elsewhere" (another tab, the API). */
export async function archiveWalletViaApi(request: APIRequestContext, walletId: string): Promise<ManagedWallet> {
  const response = await request.patch(`/api/v1/wallets/${walletId}`, { data: { archived: true } });
  expect(response.status(), `archive Wallet ${walletId}`).toBe(200);
  const wallet = (await response.json()) as ManagedWallet;
  expect(wallet.archivedAt, 'archivedAt set').not.toBeNull();
  return wallet;
}

/** PATCH /api/v1/wallets/{id} { name } */
export async function renameWalletViaApi(request: APIRequestContext, walletId: string, name: string): Promise<ManagedWallet> {
  const response = await request.patch(`/api/v1/wallets/${walletId}`, { data: { name } });
  expect(response.status(), `rename Wallet ${walletId}`).toBe(200);
  return (await response.json()) as ManagedWallet;
}
