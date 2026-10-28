// F-2 acceptance contract — authored at Stage 7.5, failing by design until implemented.
// Implementation tracks may NOT edit assertions, scenarios, or fixture shapes (.claude/rules/e2e-contract.md).
import { expect, test } from '@playwright/test';
import { signUpViaApi } from '../F-1/fixtures/auth-api';
import { localDate, Messages, uniqueEmail } from './fixtures/test-data';
import { CreateWalletPage } from './pages/create-wallet.page';
import { WalletListPage } from './pages/wallet-list.page';
import { WalletPage } from './pages/wallet.page';

const WALLET_URL = /\/wallets\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test.describe('F-2 walking skeleton', () => {
  // UT-1 · S-1 ⭐ — create a Wallet, record an Expense, see the Balance, come back
  test('a User creates a Wallet, records an Expense, and sees the Balance', async ({ page }) => {
    const list = new WalletListPage(page);
    const create = new CreateWalletPage(page);
    const wallet = new WalletPage(page);
    const today = localDate(0);
    await signUpViaApi(page.request, uniqueEmail('wallet-skel'));

    await list.goto();
    await expect(list.empty).toHaveText(Messages.noWallets);
    await expect(list.rows).toHaveCount(0);

    await list.createWalletLink.click();
    await expect(page).toHaveURL(/\/wallets\/new$/);
    await expect(create.root).toBeVisible();
    await create.create('Cash', 'THB', '1000');

    await expect(page).toHaveURL(WALLET_URL);
    const walletUrl = page.url();
    await expect(wallet.nameHeading).toHaveText('Cash');
    await expect(wallet.currency).toHaveText('THB');
    await expect(wallet.balance).toHaveText('THB 1,000.00');
    await expect(wallet.empty).toHaveText(Messages.noTransactions);
    await expect(wallet.date).toHaveValue(today);

    await wallet.record({ kind: 'expense', amount: '125.50', note: 'Lunch' });
    await expect(wallet.balance).toHaveText('THB 874.50');
    await expect(wallet.rows).toHaveCount(1);
    const row = wallet.rows.first();
    await expect(wallet.field(row, 'kind')).toHaveText('Expense');
    await expect(wallet.field(row, 'amount')).toHaveText('THB 125.50');
    await expect(wallet.field(row, 'date')).toHaveText(today);
    await expect(wallet.field(row, 'note')).toHaveText('Lunch');
    await expect(wallet.empty).toBeHidden();

    await page.reload();
    await expect(wallet.balance).toHaveText('THB 874.50');
    await expect(wallet.rows).toHaveCount(1);
    await expect(wallet.field(wallet.rows.first(), 'note')).toHaveText('Lunch');

    await wallet.backLink.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(list.rows).toHaveCount(1);
    await expect(list.nameOf(list.rows.first())).toHaveText('Cash');
    await expect(list.currencyOf(list.rows.first())).toHaveText('THB');
    await expect(list.empty).toBeHidden();

    await list.open('Cash');
    await expect(page).toHaveURL(walletUrl);
    await expect(wallet.balance).toHaveText('THB 874.50');
  });
});
