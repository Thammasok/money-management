// F-3 acceptance contract — authored at Stage 7.5, failing by design until implemented.
// Implementation tracks may NOT edit assertions, scenarios, or fixture shapes (.claude/rules/e2e-contract.md).
import { expect, test } from '@playwright/test';
import { signUpViaApi } from '../F-1/fixtures/auth-api';
import { createWalletViaApi, recordTransactionViaApi } from '../F-2/fixtures/ledger-api';
import { uniqueEmail } from './fixtures/test-data';
import { WalletOverviewPage } from './pages/wallet-overview.page';

test.describe('F-3 walking skeleton', () => {
  // UT-1 · S-1 ⭐ — every Wallet with its Balance in its own Currency, and one Currency Total per Currency
  test('the Wallet Overview shows each Balance and the Currency Totals', async ({ page }) => {
    const overview = new WalletOverviewPage(page);
    await signUpViaApi(page.request, uniqueEmail('overview-skel'));
    const cash = await createWalletViaApi(page.request, { name: 'Cash', currency: 'THB', openingBalanceMinor: '100000' });
    const bank = await createWalletViaApi(page.request, { name: 'Bank', currency: 'THB', openingBalanceMinor: '250000' });
    const card = await createWalletViaApi(page.request, { name: 'Card', currency: 'USD', openingBalanceMinor: '1000' });
    await recordTransactionViaApi(page.request, cash.id, { kind: 'expense', amountMinor: '12550' });

    await overview.goto();
    await expect(overview.rows.locator('[data-field="name"]')).toHaveText(['Card', 'Bank', 'Cash']);
    await expect(overview.balances).toHaveText(['USD 10.00', 'THB 2,500.00', 'THB 874.50']);
    await expect(overview.balanceOf(overview.rowFor(cash.id))).toHaveText('THB 874.50');
    await expect(overview.balanceOf(overview.rowFor(bank.id))).toHaveText('THB 2,500.00');
    await expect(overview.balanceOf(overview.rowFor(card.id))).toHaveText('USD 10.00');
    await expect(overview.rows.locator('[data-field="archived"]')).toHaveCount(0);

    await expect(overview.totalsSection).toBeVisible();
    await expect(overview.currencyTotals).toHaveText(['THB 3,374.50', 'USD 10.00']);
    await expect(overview.currencyTotal('THB')).toHaveText('THB 3,374.50');
    await expect(overview.currencyTotal('USD')).toHaveText('USD 10.00');
  });
});
