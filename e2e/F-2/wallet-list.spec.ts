// F-2 acceptance contract — authored at Stage 7.5, failing by design until implemented.
// Implementation tracks may NOT edit assertions, scenarios, or fixture shapes (.claude/rules/e2e-contract.md).
import { expect, test } from '@playwright/test';
import { signUpViaApi } from '../F-1/fixtures/auth-api';
import { createWalletViaApi } from './fixtures/ledger-api';
import { uniqueEmail } from './fixtures/test-data';
import { WalletListPage } from './pages/wallet-list.page';
import { WalletPage } from './pages/wallet.page';

test.describe('F-2 Wallet list on Home', () => {
  // UT-18 · S-6 — newest-created first; each row opens its Wallet
  test('Wallets are listed newest first and open', async ({ page }) => {
    const list = new WalletListPage(page);
    const wallet = new WalletPage(page);
    await signUpViaApi(page.request, uniqueEmail('list'));
    const cash = await createWalletViaApi(page.request, { name: 'Cash', currency: 'THB', openingBalanceMinor: '0' });
    const bank = await createWalletViaApi(page.request, { name: 'Bank', currency: 'USD', openingBalanceMinor: '0' });

    await list.goto();
    await expect(list.rows.locator('[data-field="name"]')).toHaveText(['Bank', 'Cash']);
    await expect(list.rows.locator('[data-field="currency"]')).toHaveText(['USD', 'THB']);
    await expect(list.rowFor(bank.id)).toBeVisible();
    await expect(list.rowFor(cash.id)).toBeVisible();
    await expect(list.empty).toBeHidden();

    await list.open('Cash');
    await expect(page).toHaveURL(new RegExp(`/wallets/${cash.id}$`));
    await expect(wallet.nameHeading).toHaveText('Cash');
    await expect(wallet.balance).toHaveText('THB 0.00');
  });
});
