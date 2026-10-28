// F-2 cross-feature journey (dependency edge F-1 → F-2) — authored at Stage 7.5, failing by design.
// No precondition shortcut: the signed-in User is produced by driving F-1's real Sign Up / Sign In screens
// through F-1's committed page objects. Shared entity traced across the seam: the User who signed up owns
// the Wallet (Wallet.userId) — it is still theirs, with its Balance, after signing out and back in.
// Implementation tracks may NOT edit assertions, scenarios, or fixture shapes (.claude/rules/e2e-contract.md).
import { expect, test } from '@playwright/test';
import { Passwords } from '../../F-1/fixtures/test-data';
import { HomePage } from '../../F-1/pages/home.page';
import { SignInPage } from '../../F-1/pages/sign-in.page';
import { SignUpPage } from '../../F-1/pages/sign-up.page';
import { Messages, uniqueEmail } from '../fixtures/test-data';
import { CreateWalletPage } from '../pages/create-wallet.page';
import { WalletListPage } from '../pages/wallet-list.page';
import { WalletPage } from '../pages/wallet.page';

test.describe('Journey: F-1 Sign Up and Sign In → F-2 Record Income and Expense', () => {
  // UT-22 · S-24
  test('a User who signed up through the UI keeps their Wallet across sign-out and sign-in', async ({ page }) => {
    const signIn = new SignInPage(page);
    const signUp = new SignUpPage(page);
    const home = new HomePage(page);
    const list = new WalletListPage(page);
    const create = new CreateWalletPage(page);
    const wallet = new WalletPage(page);
    const email = uniqueEmail('journey');

    // F-1, for real
    await home.goto();
    await expect(page).toHaveURL(/\/sign-in$/);
    await signIn.goToSignUpLink.click();
    await signUp.signUp(email, Passwords.valid);
    await expect(home.signedInEmail).toHaveText(email);

    // F-2, as that User
    await expect(list.empty).toHaveText(Messages.noWallets);
    await list.createWalletLink.click();
    await create.create('Journey Cash', 'THB', '500');
    await expect(wallet.balance).toHaveText('THB 500.00');
    await wallet.record({ kind: 'income', amount: '250' });
    await expect(wallet.balance).toHaveText('THB 750.00');

    // across the F-1 boundary: sign out, sign back in
    await wallet.backLink.click();
    await home.signOut();
    await expect(page).toHaveURL(/\/sign-in$/);
    await signIn.signIn(email, Passwords.valid);
    await expect(home.signedInEmail).toHaveText(email);

    await expect(list.rows).toHaveCount(1);
    await list.open('Journey Cash');
    await expect(wallet.balance).toHaveText('THB 750.00');
    await expect(wallet.rows).toHaveCount(1);
    await expect(wallet.field(wallet.rows.first(), 'kind')).toHaveText('Income');
    await expect(wallet.field(wallet.rows.first(), 'amount')).toHaveText('THB 250.00');
  });
});
