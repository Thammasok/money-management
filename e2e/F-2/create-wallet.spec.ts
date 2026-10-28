// F-2 acceptance contract — authored at Stage 7.5, failing by design until implemented.
// Implementation tracks may NOT edit assertions, scenarios, or fixture shapes (.claude/rules/e2e-contract.md).
import { expect, test } from '@playwright/test';
import { signUpViaApi } from '../F-1/fixtures/auth-api';
import { HomePage } from '../F-1/pages/home.page';
import { createWalletViaApi } from './fixtures/ledger-api';
import { Messages, uniqueEmail } from './fixtures/test-data';
import { CreateWalletPage } from './pages/create-wallet.page';
import { WalletListPage } from './pages/wallet-list.page';
import { WalletPage } from './pages/wallet.page';

const WALLET_URL = /\/wallets\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test.describe('F-2 Create Wallet', () => {
  // UT-2 · S-5 — Q-11: the Currency defaults to the Currency of the last-created Wallet
  test("the Currency defaults to the last-created Wallet's", async ({ page }) => {
    const create = new CreateWalletPage(page);
    await signUpViaApi(page.request, uniqueEmail('default'));

    await create.goto();
    await expect(create.submit).toBeEnabled();
    await expect(create.currency).toHaveValue('');

    await createWalletViaApi(page.request, { name: 'Bank', currency: 'THB', openingBalanceMinor: '0' });
    await createWalletViaApi(page.request, { name: 'Card', currency: 'USD', openingBalanceMinor: '0' });
    await create.goto();
    await expect(create.currency).toHaveValue('USD');
  });

  // UT-3 · S-8 — an Opening Balance may be negative; it is not Income
  test('a negative Opening Balance', async ({ page }) => {
    const create = new CreateWalletPage(page);
    const wallet = new WalletPage(page);
    await signUpViaApi(page.request, uniqueEmail('negative'));

    await create.goto();
    await create.create('Card', 'THB', '-2500.75');
    await expect(page).toHaveURL(WALLET_URL);
    await expect(wallet.balance).toHaveText('-THB 2,500.75');
    await expect(wallet.empty).toHaveText(Messages.noTransactions);
  });

  // UT-4 · S-11 — empty Home, then a new EUR Wallet with no Transactions
  test('a new EUR Wallet starts empty', async ({ page }) => {
    const list = new WalletListPage(page);
    const create = new CreateWalletPage(page);
    const wallet = new WalletPage(page);
    await signUpViaApi(page.request, uniqueEmail('empty'));

    await list.goto();
    await expect(list.empty).toHaveText(Messages.noWallets);
    await list.createWalletLink.click();
    await create.create('Empty', 'EUR', '12.3');

    await expect(page).toHaveURL(WALLET_URL);
    await expect(wallet.nameHeading).toHaveText('Empty');
    await expect(wallet.currency).toHaveText('EUR');
    await expect(wallet.balance).toHaveText('EUR 12.30');
    await expect(wallet.empty).toHaveText(Messages.noTransactions);
    await expect(wallet.rows).toHaveCount(0);
  });

  // UT-5 · S-14 — the API refuses a blank or over-long name; nothing is created
  test('a blank or over-long name is refused', async ({ page }) => {
    const create = new CreateWalletPage(page);
    const list = new WalletListPage(page);
    await signUpViaApi(page.request, uniqueEmail('name'));

    await create.goto();
    await create.create('', 'THB', '0');
    await expect(create.error).toContainText(Messages.walletName);
    await expect(page).toHaveURL(/\/wallets\/new$/);

    await create.create('W'.repeat(61), 'THB', '0');
    await expect(create.error).toContainText(Messages.walletNameLength);
    await expect(page).toHaveURL(/\/wallets\/new$/);

    await list.goto();
    await expect(list.empty).toHaveText(Messages.noWallets);
  });

  // UT-6 · S-15 — no Currency chosen (a first Wallet has no default)
  test('a Currency must be chosen', async ({ page }) => {
    const create = new CreateWalletPage(page);
    await signUpViaApi(page.request, uniqueEmail('currency'));

    await create.goto();
    await expect(create.submit).toBeEnabled();
    await create.create('Cash', null, '0');
    await expect(create.error).toHaveText(Messages.currency);
    await expect(page).toHaveURL(/\/wallets\/new$/);
  });

  // UT-7 · S-16 — the Web App refuses what it cannot turn into minor units, before sending
  test('an invalid Opening Balance is refused before sending', async ({ page }) => {
    const create = new CreateWalletPage(page);
    const list = new WalletListPage(page);
    await signUpViaApi(page.request, uniqueEmail('opening'));

    await create.goto();
    await create.create('Cash', 'THB', '12.345');
    await expect(create.error).toHaveText(Messages.invalidAmount);
    await expect(page).toHaveURL(/\/wallets\/new$/);

    await create.create('Cash', 'THB', 'abc');
    await expect(create.error).toHaveText(Messages.invalidAmount);

    await create.create('Yen', 'JPY', '15.5');
    await expect(create.error).toHaveText(Messages.invalidAmount);
    await expect(page).toHaveURL(/\/wallets\/new$/);

    await list.goto();
    await expect(list.empty).toHaveText(Messages.noWallets);
  });

  // UT-8 · Flow Step 2 — Cancel goes back to Home
  test('Cancel goes back to Home', async ({ page }) => {
    const create = new CreateWalletPage(page);
    const home = new HomePage(page);
    await signUpViaApi(page.request, uniqueEmail('cancel'));

    await create.goto();
    await expect(create.root).toBeVisible();
    await create.cancelLink.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(home.root).toBeVisible();
  });
});
