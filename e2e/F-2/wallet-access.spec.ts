// F-2 acceptance contract — authored at Stage 7.5, failing by design until implemented.
// Implementation tracks may NOT edit assertions, scenarios, or fixture shapes (.claude/rules/e2e-contract.md).
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { signOutViaApi, signUpViaApi } from '../F-1/fixtures/auth-api';
import { SignInPage } from '../F-1/pages/sign-in.page';
import { createWalletViaApi } from './fixtures/ledger-api';
import { Messages, uniqueEmail } from './fixtures/test-data';
import { WalletListPage } from './pages/wallet-list.page';
import { WalletPage } from './pages/wallet.page';

test.describe('F-2 only my Wallets', () => {
  // UT-19 · S-20 — another User's Wallet looks exactly like one that does not exist
  test("another User's Wallet is not found", async ({ page }) => {
    const wallet = new WalletPage(page);
    const list = new WalletListPage(page);
    await signUpViaApi(page.request, uniqueEmail('owner'));
    const theirs = await createWalletViaApi(page.request, { name: 'A-Cash', currency: 'THB', openingBalanceMinor: '5000' });
    await signOutViaApi(page.request);
    await signUpViaApi(page.request, uniqueEmail('intruder'));

    await wallet.goto(theirs.id);
    await expect(wallet.notFound).toHaveText(Messages.walletNotFound);
    await expect(wallet.balance).toHaveCount(0);
    await expect(wallet.form).toHaveCount(0);
    await expect(page.getByText('A-Cash')).toHaveCount(0);

    await list.goto();
    await expect(list.empty).toHaveText(Messages.noWallets);
  });

  // UT-20 · S-21 — unknown and malformed ids
  test('unknown and malformed ids are not found', async ({ page }) => {
    const wallet = new WalletPage(page);
    await signUpViaApi(page.request, uniqueEmail('unknown'));

    await wallet.goto(randomUUID());
    await expect(wallet.notFound).toHaveText(Messages.walletNotFound);

    await wallet.goto('not-a-uuid');
    await expect(wallet.notFound).toHaveText(Messages.walletNotFound);
    await wallet.backLink.click();
    await expect(page).toHaveURL(/\/$/);
  });

  // UT-21 · S-23 — every F-2 screen needs a signed-in User
  test('a signed-out Visitor is sent to Sign In', async ({ page }) => {
    const signIn = new SignInPage(page);

    await page.goto('/wallets/new');
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(signIn.root).toBeVisible();

    await page.goto(`/wallets/${randomUUID()}`);
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(signIn.root).toBeVisible();
  });
});
