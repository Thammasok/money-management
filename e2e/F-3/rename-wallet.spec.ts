// F-3 acceptance contract — authored at Stage 7.5, failing by design until implemented.
// Implementation tracks may NOT edit assertions, scenarios, or fixture shapes (.claude/rules/e2e-contract.md).
import { expect, test } from '@playwright/test';
import { signUpViaApi } from '../F-1/fixtures/auth-api';
import { createWalletViaApi } from '../F-2/fixtures/ledger-api';
import { WalletPage } from '../F-2/pages/wallet.page';
import { Messages, uniqueEmail } from './fixtures/test-data';
import { WalletManagementPage } from './pages/wallet-management.page';
import { WalletOverviewPage } from './pages/wallet-overview.page';

test.describe('F-3 Rename a Wallet', () => {
  // UT-5 · S-3 — the new name is stored and shown everywhere; nothing else changes
  test('renaming changes the name everywhere', async ({ page }) => {
    const wallet = new WalletPage(page);
    const manage = new WalletManagementPage(page);
    const overview = new WalletOverviewPage(page);
    await signUpViaApi(page.request, uniqueEmail('rename'));
    const cash = await createWalletViaApi(page.request, { name: 'Cash', currency: 'THB', openingBalanceMinor: '100000' });

    await wallet.goto(cash.id);
    await expect(wallet.nameHeading).toHaveText('Cash');
    await expect(manage.renameForm).toBeHidden();
    await manage.renameButton.click();
    await expect(manage.renameInput).toHaveValue('Cash');
    await manage.renameInput.fill('Daily Cash');
    await manage.renameSubmit.click();

    await expect(wallet.nameHeading).toHaveText('Daily Cash');
    await expect(manage.renameForm).toBeHidden();
    await expect(manage.renameError).toBeHidden();
    await expect(wallet.balance).toHaveText('THB 1,000.00');
    await expect(wallet.currency).toHaveText('THB');

    await page.reload();
    await expect(wallet.nameHeading).toHaveText('Daily Cash');

    await wallet.backLink.click();
    await expect(overview.nameOf(overview.rowFor(cash.id))).toHaveText('Daily Cash');
    await expect(overview.balanceOf(overview.rowFor(cash.id))).toHaveText('THB 1,000.00');
  });

  // UT-6 · S-11 — the API's name rules, shown inline; the name is unchanged
  test('a blank or over-long name is refused', async ({ page }) => {
    const wallet = new WalletPage(page);
    const manage = new WalletManagementPage(page);
    await signUpViaApi(page.request, uniqueEmail('rename-invalid'));
    const cash = await createWalletViaApi(page.request, { name: 'Cash', currency: 'THB', openingBalanceMinor: '100000' });

    await wallet.goto(cash.id);
    await manage.rename('');
    await expect(manage.renameError).toContainText(Messages.walletName);
    await expect(manage.renameForm).toBeVisible();
    await expect(wallet.nameHeading).toHaveText('Cash');

    await manage.renameInput.fill('W'.repeat(61));
    await manage.renameSubmit.click();
    await expect(manage.renameError).toContainText(Messages.walletNameLength);
    await expect(manage.renameError).not.toContainText(Messages.walletName);
    await expect(wallet.nameHeading).toHaveText('Cash');

    await page.reload();
    await expect(wallet.nameHeading).toHaveText('Cash');
  });

  // UT-7 · S-9 — Cancel (rename) and Keep wallet (archive) send nothing
  test('cancelling rename and archive changes nothing', async ({ page }) => {
    const wallet = new WalletPage(page);
    const manage = new WalletManagementPage(page);
    const overview = new WalletOverviewPage(page);
    await signUpViaApi(page.request, uniqueEmail('cancel'));
    const cash = await createWalletViaApi(page.request, { name: 'Cash', currency: 'THB', openingBalanceMinor: '100000' });

    await wallet.goto(cash.id);
    await manage.renameButton.click();
    await manage.renameInput.fill('Something else');
    await manage.renameCancel.click();
    await expect(manage.renameForm).toBeHidden();
    await expect(wallet.nameHeading).toHaveText('Cash');

    await expect(manage.archiveConfirm).toBeHidden();
    await manage.archiveButton.click();
    await expect(manage.archiveConfirm).toBeVisible();
    await manage.cancelArchiveButton.click();
    await expect(manage.archiveConfirm).toBeHidden();
    await expect(manage.archivedNotice).toBeHidden();
    await expect(manage.archiveButton).toBeVisible();
    await expect(wallet.form).toBeVisible();

    await page.reload();
    await expect(wallet.nameHeading).toHaveText('Cash');
    await expect(wallet.form).toBeVisible();
    await wallet.backLink.click();
    await expect(overview.archivedOf(overview.rowFor(cash.id))).toHaveCount(0);
  });
});
