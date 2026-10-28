import type { Locator, Page } from '@playwright/test';

/**
 * Home's Wallet list (F-2's part of `/`) — component IDs from artifacts/F-2/02-flow.md (the contract).
 * F-1's `HomePage` (e2e/F-1/pages/home.page.ts) still owns `#home-page`, the email, and Sign out.
 */
export class WalletListPage {
  readonly list: Locator;
  readonly rows: Locator;
  readonly empty: Locator;
  readonly error: Locator;
  readonly createWalletLink: Locator;

  constructor(private readonly page: Page) {
    this.list = page.locator('#wallet-list');
    this.rows = page.locator('#wallet-list [data-wallet-row]');
    this.empty = page.locator('#wallet-list-empty');
    this.error = page.locator('#wallet-list-error');
    this.createWalletLink = page.locator('#create-wallet-link');
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  rowFor(walletId: string): Locator {
    return this.page.locator(`#wallet-row-${walletId}`);
  }

  rowNamed(name: string): Locator {
    return this.rows.filter({ has: this.page.locator('[data-field="name"]', { hasText: name }) });
  }

  nameOf(row: Locator): Locator {
    return row.locator('[data-field="name"]');
  }

  currencyOf(row: Locator): Locator {
    return row.locator('[data-field="currency"]');
  }

  async open(name: string): Promise<void> {
    await this.nameOf(this.rowNamed(name)).click();
  }
}
