// F-3 acceptance contract — authored at Stage 7.5, failing by design until implemented.
// Implementation tracks may NOT edit assertions, scenarios, or fixture shapes (.claude/rules/e2e-contract.md).
//
// Journey F-2 → F-3 (epic.md: F-3 depends on F-2). The Wallet and its Transaction are produced by driving F-2's real
// screens through F-2's committed page objects — no API shortcut for them. The seam asserted: the shared entity Wallet
// (same id, name, Currency) and the Balance derived from the Transaction F-2 recorded arrive intact on F-3's Overview,
// and F-3's archive switches off F-2's record form while keeping that Transaction. (Sign-up is F-1, a transitive
// dependency — taken by API; F-2's own journey covers the F-1 → F-2 seam through the real Sign Up screen.)
import { expect, test } from '@playwright/test';
import { signUpViaApi } from '../../F-1/fixtures/auth-api';
import { CreateWalletPage } from '../../F-2/pages/create-wallet.page';
import { WalletPage } from '../../F-2/pages/wallet.page';
import { uniqueEmail } from '../fixtures/test-data';
import { WalletManagementPage } from '../pages/wallet-management.page';
import { WalletOverviewPage } from '../pages/wallet-overview.page';

const WALLET_URL = /\/wallets\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

test.describe('Journey F-2 → F-3', () => {
  // UT-11 · S-16
  test('a Wallet created and used through F-2 screens is listed with its Balance and can be archived', async ({ page }) => {
    const overview = new WalletOverviewPage(page);
    const create = new CreateWalletPage(page);
    const wallet = new WalletPage(page);
    const manage = new WalletManagementPage(page);
    await signUpViaApi(page.request, uniqueEmail('journey3'));

    // F-2: create and record through the real screens
    await overview.goto();
    await overview.createWalletLink.click();
    await create.create('Travel', 'USD', '100');
    await expect(page).toHaveURL(WALLET_URL);
    const walletId = WALLET_URL.exec(page.url())![1];
    await wallet.record({ kind: 'expense', amount: '30' });
    await expect(wallet.balance).toHaveText('USD 70.00');
    await wallet.backLink.click();

    // F-3: the same Wallet (same id) on the Overview with the Balance F-2's Transaction produced
    const row = overview.rowFor(walletId);
    await expect(overview.nameOf(row)).toHaveText('Travel');
    await expect(overview.currencyOf(row)).toHaveText('USD');
    await expect(overview.balanceOf(row)).toHaveText('USD 70.00');
    await expect(overview.currencyTotal('USD')).toHaveText('USD 70.00');

    // F-3 archive switches off F-2's record form; F-2's Transaction stays
    await overview.open('Travel');
    await expect(page).toHaveURL(new RegExp(`/wallets/${walletId}$`));
    await manage.archive();
    await expect(manage.archivedNotice).toBeVisible();
    await expect(wallet.form).toBeHidden();
    await expect(wallet.rows).toHaveCount(1);
    await expect(wallet.field(wallet.rows.first(), 'amount')).toHaveText('USD 30.00');
    await expect(wallet.balance).toHaveText('USD 70.00');
  });
});
