// F-1 acceptance contract — authored at Stage 7.5, failing by design until implemented.
// Implementation tracks may NOT edit assertions, scenarios, or fixture shapes (.claude/rules/e2e-contract.md).
import { expect, test } from '@playwright/test';
import { Messages, Passwords, uniqueEmail } from './fixtures/test-data';
import { HomePage } from './pages/home.page';
import { SignInPage } from './pages/sign-in.page';
import { SignUpPage } from './pages/sign-up.page';

test.describe('F-1 walking skeleton', () => {
  // UT-1 · S-1 ⭐ — sign up, sign out, sign back in
  test('a Visitor signs up, signs out, and signs back in', async ({ page }) => {
    const signIn = new SignInPage(page);
    const signUp = new SignUpPage(page);
    const home = new HomePage(page);
    const email = uniqueEmail('skeleton');

    await home.goto();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(signIn.root).toBeVisible();

    await signIn.goToSignUpLink.click();
    await expect(page).toHaveURL(/\/sign-up$/);
    await expect(signUp.root).toBeVisible();
    await expect(signUp.passwordRule).toContainText(Messages.passwordRule);

    await signUp.signUp(email, Passwords.valid);
    await expect(page).toHaveURL(/\/$/);
    await expect(home.root).toBeVisible();
    await expect(home.signedInEmail).toHaveText(email);

    await home.signOut();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(signIn.root).toBeVisible();

    await signIn.signIn(email, Passwords.valid);
    await expect(page).toHaveURL(/\/$/);
    await expect(home.signedInEmail).toHaveText(email);
  });
});
