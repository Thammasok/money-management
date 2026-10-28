// F-1 acceptance contract — Sign Up screen. Failing by design until implemented.
import { expect, test } from '@playwright/test';
import { signOutViaApi, signUpViaApi } from './fixtures/auth-api';
import { Messages, Passwords, uniqueEmail } from './fixtures/test-data';
import { HomePage } from './pages/home.page';
import { SignUpPage } from './pages/sign-up.page';

test.describe('F-1 sign up', () => {
  let signUp: SignUpPage;
  let home: HomePage;

  test.beforeEach(async ({ page }) => {
    signUp = new SignUpPage(page);
    home = new HomePage(page);
    await signUp.goto();
    await expect(signUp.root).toBeVisible();
  });

  // UT-2 · S-5
  test('the email is stored trimmed and lower-cased', async ({ page }) => {
    const email = uniqueEmail('mixed');
    const typed = `  ${email.toUpperCase().replace('@EXAMPLE.TEST', '@Example.TEST')}  `;

    await signUp.signUp(typed, Passwords.valid);

    await expect(page).toHaveURL(/\/$/);
    await expect(home.signedInEmail).toHaveText(email);
  });

  // UT-3 · S-7
  test('the shortest valid password is accepted', async ({ page }) => {
    await signUp.signUp(uniqueEmail('short'), Passwords.minValid);

    await expect(page).toHaveURL(/\/$/);
    await expect(home.root).toBeVisible();
  });

  // UT-4 · S-14
  test('an email that is already registered is refused', async ({ page }) => {
    const email = uniqueEmail('taken');
    await signUpViaApi(page.request, email);
    await signOutViaApi(page.request);

    await signUp.signUp(email.toUpperCase(), Passwords.valid);

    await expect(signUp.error).toContainText(Messages.taken);
    await expect(page).toHaveURL(/\/sign-up$/);
    await expect(home.root).toHaveCount(0);
  });

  // UT-5 · S-15
  test('a password that breaks the rule is refused', async ({ page }) => {
    await signUp.signUp(uniqueEmail('weak'), Passwords.noSymbol);

    await expect(signUp.error).toContainText(Messages.passwordRule);
    await expect(page).toHaveURL(/\/sign-up$/);
    await expect(home.root).toHaveCount(0);
  });

  // UT-6 · S-16
  test('something that is not an email address is refused', async ({ page }) => {
    await signUp.signUp('not-an-email', Passwords.valid);

    await expect(signUp.error).toContainText(Messages.email);
    await expect(page).toHaveURL(/\/sign-up$/);
  });
});
