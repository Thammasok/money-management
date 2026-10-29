// F-3 acceptance contract — authored at Stage 7.5, failing by design until implemented.
// Implementation tracks may NOT edit assertions, scenarios, or fixture shapes (.claude/rules/e2e-contract.md).
import { expect, test } from '@playwright/test';
import { signUpViaApi } from '../F-1/fixtures/auth-api';
import { createWalletViaApi, recordTransactionViaApi } from '../F-2/fixtures/ledger-api';
import { WalletPage } from '../F-2/pages/wallet.page';
import { archiveWalletViaApi } from './fixtures/ledger-api';
import { Messages, uniqueEmail } from './fixtures/test-data';
import { WalletManagementPage } from './pages/wallet-management.page';
import { WalletOverviewPage } from './pages/wallet-overview.page';

test.describe('F-3 Archive a Wallet', () => {
  // UT-8 · S-4 — archive after a confirmation; history kept; no new Transactions; still counted on the Overview
  test('archiving keeps the history and stops new Transactions', async ({ page }) => {
    const wallet = new WalletPage(page);
    const manage = new WalletManagementPage(page);
    const overview = new WalletOverviewPage(page);
    await signUpViaApi(page.request, uniqueEmail('archive'));
    const old = await createWalletViaApi(page.request, { name: 'Old Card', currency: 'THB', openingBalanceMinor: '50000' });
    await recordTransactionViaApi(page.request, old.id, { kind: 'expense', amountMinor: '2000', note: 'Last coffee' });

    await wallet.goto(old.id);
    await expect(manage.archivedNotice).toBeHidden();
    await expect(wallet.form).toBeVisible();
    await manage.archiveButton.click();
    await expect(manage.archiveConfirm).toContainText(Messages.archiveConfirm);
    await manage.confirmArchiveButton.click();

    await expect(manage.archivedNotice).toHaveText(Messages.archivedNotice);
    await expect(wallet.form).toBeHidden();
    await expect(manage.archiveButton).toBeHidden();
    await expect(manage.archiveConfirm).toBeHidden();
    await expect(wallet.balance).toHaveText('THB 480.00');
    await expect(wallet.rows).toHaveCount(1);
    await expect(wallet.field(wallet.rows.first(), 'note')).toHaveText('Last coffee');

    await page.reload();
    await expect(manage.archivedNotice).toHaveText(Messages.archivedNotice);
    await expect(wallet.form).toBeHidden();
    await expect(wallet.rows).toHaveCount(1);

    await wallet.backLink.click();
    const row = overview.rowFor(old.id);
    await expect(overview.archivedOf(row)).toHaveText(Messages.archivedMark);
    await expect(overview.balanceOf(row)).toHaveText('THB 480.00');
    await expect(overview.currencyTotal('THB')).toHaveText('THB 480.00');
  });

  // UT-9 · S-12 — the Wallet was archived elsewhere while this screen still shows the record form: 409, nothing saved
  test('recording into a Wallet archived elsewhere is refused', async ({ page }) => {
    const wallet = new WalletPage(page);
    await signUpViaApi(page.request, uniqueEmail('archived-record'));
    const cash = await createWalletViaApi(page.request, { name: 'Cash', currency: 'THB', openingBalanceMinor: '100000' });

    await wallet.goto(cash.id);
    await expect(wallet.form).toBeVisible();
    await archiveWalletViaApi(page.request, cash.id);

    await wallet.record({ kind: 'expense', amount: '10' });
    await expect(wallet.error).toContainText(Messages.archivedWallet);
    await expect(wallet.balance).toHaveText('THB 1,000.00');
    await expect(wallet.empty).toHaveText(Messages.noTransactions);
    await expect(wallet.rows).toHaveCount(0);
  });

  // UT-10 · S-5 — archive blocks only new Transactions; renaming still works and the Wallet stays archived
  test('an Archived Wallet can still be renamed', async ({ page }) => {
    const wallet = new WalletPage(page);
    const manage = new WalletManagementPage(page);
    await signUpViaApi(page.request, uniqueEmail('rename-archived'));
    const old = await createWalletViaApi(page.request, { name: 'Old Card', currency: 'THB', openingBalanceMinor: '0' });
    await archiveWalletViaApi(page.request, old.id);

    await wallet.goto(old.id);
    await expect(manage.archivedNotice).toHaveText(Messages.archivedNotice);
    await manage.rename('Old Visa');

    await expect(wallet.nameHeading).toHaveText('Old Visa');
    await expect(manage.archivedNotice).toHaveText(Messages.archivedNotice);
    await expect(wallet.form).toBeHidden();
    await page.reload();
    await expect(wallet.nameHeading).toHaveText('Old Visa');
  });
});
