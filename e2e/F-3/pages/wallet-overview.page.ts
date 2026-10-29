import type { Locator, Page } from '@playwright/test';
import { WalletListPage } from '../../F-2/pages/wallet-list.page';

/**
 * Home as the Wallet Overview (F-3) — component IDs from artifacts/F-3/02-flow.md (the contract). Extends F-2's
 * `WalletListPage` (rows, names, currencies, empty state) with each row's Balance / Archived mark and the
 * Currency Totals section, which lives outside `#wallet-list`.
 */
export class WalletOverviewPage extends WalletListPage {
  readonly balances: Locator;
  readonly totalsSection: Locator;
  readonly currencyTotals: Locator;

  constructor(page: Page) {
    super(page);
    this.balances = page.locator('#wallet-list [data-wallet-row] [data-field="balance"]');
    this.totalsSection = page.locator('#currency-totals');
    this.currencyTotals = page.locator('#currency-totals [data-currency-total]');
  }

  balanceOf(row: Locator): Locator {
    return row.locator('[data-field="balance"]');
  }

  /** Present only on an Archived Wallet's row. */
  archivedOf(row: Locator): Locator {
    return row.locator('[data-field="archived"]');
  }

  currencyTotal(code: string): Locator {
    return this.totalsSection.locator(`#currency-total-${code}`);
  }
}
