// F-3 acceptance contract — authored at Stage 7.5, failing by design until implemented.
// Implementation tracks may NOT edit assertions, scenarios, or fixture shapes (.claude/rules/e2e-contract.md).
import { expect, test } from '@playwright/test';
import { signUpViaApi } from '../F-1/fixtures/auth-api';
import { createWalletViaApi, recordTransactionViaApi } from '../F-2/fixtures/ledger-api';
import { WalletPage } from '../F-2/pages/wallet.page';
import { Messages, uniqueEmail } from './fixtures/test-data';
import { WalletOverviewPage } from './pages/wallet-overview.page';

test.describe('F-3 Wallet Overview', () => {
  // UT-2 · S-2 — Balances are derived on read: a Transaction recorded in the UI shows on the Overview
  test('a recorded Transaction shows on the Overview', async ({ page }) => {
    const overview = new WalletOverviewPage(page);
    const wallet = new WalletPage(page);
    await signUpViaApi(page.request, uniqueEmail('overview-rec'));
    const cash = await createWalletViaApi(page.request, { name: 'Cash', currency: 'THB', openingBalanceMinor: '100000' });

    await overview.goto();
    await expect(overview.balanceOf(overview.rowFor(cash.id))).toHaveText('THB 1,000.00');
    await expect(overview.currencyTotal('THB')).toHaveText('THB 1,000.00');

    await overview.open('Cash');
    await wallet.record({ kind: 'income', amount: '250' });
    await expect(wallet.balance).toHaveText('THB 1,250.00');
    await wallet.backLink.click();

    await expect(page).toHaveURL(/\/$/);
    await expect(overview.balanceOf(overview.rowFor(cash.id))).toHaveText('THB 1,250.00');
    await expect(overview.currencyTotals).toHaveText(['THB 1,250.00']);
  });

  // UT-3 · S-6 — no Wallets, no Currency Totals
  test('no Wallets — no Currency Totals', async ({ page }) => {
    const overview = new WalletOverviewPage(page);
    await signUpViaApi(page.request, uniqueEmail('overview-empty'));

    await overview.goto();
    await expect(overview.empty).toHaveText(Messages.noWallets);
    await expect(overview.rows).toHaveCount(0);
    await expect(overview.totalsSection).toBeHidden();
    await expect(overview.currencyTotals).toHaveCount(0);
  });

  // UT-4 · S-7 — negative and zero Balances and Currency Totals, each in its own Currency's digits
  test('negative and zero Balances and Currency Totals', async ({ page }) => {
    const overview = new WalletOverviewPage(page);
    await signUpViaApi(page.request, uniqueEmail('overview-neg'));
    const yen = await createWalletViaApi(page.request, { name: 'Yen', currency: 'JPY', openingBalanceMinor: '0' });
    await recordTransactionViaApi(page.request, yen.id, { kind: 'expense', amountMinor: '1500' });
    const minus = await createWalletViaApi(page.request, { name: 'Minus', currency: 'THB', openingBalanceMinor: '-250075' });
    await recordTransactionViaApi(page.request, minus.id, { kind: 'income', amountMinor: '250075' });

    await overview.goto();
    await expect(overview.rows.locator('[data-field="name"]')).toHaveText(['Minus', 'Yen']);
    await expect(overview.balances).toHaveText(['THB 0.00', '-JPY 1,500']);
    await expect(overview.currencyTotals).toHaveText(['-JPY 1,500', 'THB 0.00']);
    await expect(overview.currencyTotal('JPY')).toHaveText('-JPY 1,500');
    await expect(overview.currencyTotal('THB')).toHaveText('THB 0.00');
  });
});
