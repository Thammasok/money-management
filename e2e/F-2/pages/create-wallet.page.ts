import type { Locator, Page } from '@playwright/test';

/** Create Wallet (`/wallets/new`) — component IDs from artifacts/F-2/02-flow.md (the contract). */
export class CreateWalletPage {
  readonly root: Locator;
  readonly form: Locator;
  readonly name: Locator;
  readonly currency: Locator;
  readonly openingBalance: Locator;
  readonly submit: Locator;
  readonly error: Locator;
  readonly cancelLink: Locator;

  constructor(private readonly page: Page) {
    this.root = page.locator('#create-wallet-page');
    this.form = page.locator('#create-wallet-form');
    this.name = page.locator('#wallet-name-input');
    this.currency = page.locator('#wallet-currency-select');
    this.openingBalance = page.locator('#wallet-opening-balance-input');
    this.submit = page.locator('#create-wallet-submit');
    this.error = page.locator('#create-wallet-error');
    this.cancelLink = page.locator('#cancel-create-wallet-link');
  }

  async goto(): Promise<void> {
    await this.page.goto('/wallets/new');
  }

  /**
   * Fills and submits the form. `currency` null leaves the select as it is (its default); '' picks the empty
   * "Choose a currency" option. The opening balance is typed as a person would type it ("1000", "-2500.75").
   */
  async create(name: string, currency: string | null, openingBalance: string): Promise<void> {
    await this.name.fill(name);
    if (currency !== null) await this.currency.selectOption(currency);
    await this.openingBalance.fill(openingBalance);
    await this.submit.click();
  }
}
