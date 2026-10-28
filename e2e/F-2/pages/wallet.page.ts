import type { Locator, Page } from '@playwright/test';

export type TransactionField = 'kind' | 'amount' | 'date' | 'note';

/** Wallet (`/wallets/:walletId`) — component IDs from artifacts/F-2/02-flow.md (the contract). */
export class WalletPage {
  readonly root: Locator;
  readonly nameHeading: Locator;
  readonly currency: Locator;
  readonly balance: Locator;
  readonly backLink: Locator;
  readonly form: Locator;
  readonly kindExpense: Locator;
  readonly kindIncome: Locator;
  readonly amount: Locator;
  readonly date: Locator;
  readonly note: Locator;
  readonly submit: Locator;
  readonly error: Locator;
  readonly list: Locator;
  readonly rows: Locator;
  readonly empty: Locator;
  readonly notFound: Locator;
  readonly loadError: Locator;

  constructor(private readonly page: Page) {
    this.root = page.locator('#wallet-page');
    this.nameHeading = page.locator('#wallet-name-heading');
    this.currency = page.locator('#wallet-currency');
    this.balance = page.locator('#wallet-balance');
    this.backLink = page.locator('#back-to-wallets-link');
    this.form = page.locator('#transaction-form');
    this.kindExpense = page.locator('#transaction-kind-expense');
    this.kindIncome = page.locator('#transaction-kind-income');
    this.amount = page.locator('#transaction-amount-input');
    this.date = page.locator('#transaction-date-input');
    this.note = page.locator('#transaction-note-input');
    this.submit = page.locator('#transaction-submit');
    this.error = page.locator('#transaction-error');
    this.list = page.locator('#transaction-list');
    this.rows = page.locator('#transaction-list [data-transaction-row]');
    this.empty = page.locator('#transaction-list-empty');
    this.notFound = page.locator('#wallet-not-found');
    this.loadError = page.locator('#wallet-load-error');
  }

  async goto(walletId: string): Promise<void> {
    await this.page.goto(`/wallets/${walletId}`);
  }

  field(row: Locator, field: TransactionField): Locator {
    return row.locator(`[data-field="${field}"]`);
  }

  /** Text of one field across all rows, in list order (newest first). */
  async columnTexts(field: TransactionField): Promise<string[]> {
    return this.rows.locator(`[data-field="${field}"]`).allTextContents();
  }

  /**
   * Fills and submits the record form. `date` omitted keeps the field's value (today by default);
   * `note` omitted leaves the note empty.
   */
  async record(t: { kind: 'income' | 'expense'; amount: string; date?: string; note?: string }): Promise<void> {
    await (t.kind === 'income' ? this.kindIncome : this.kindExpense).check();
    await this.amount.fill(t.amount);
    if (t.date !== undefined) await this.date.fill(t.date);
    if (t.note !== undefined) await this.note.fill(t.note);
    await this.submit.click();
  }
}
