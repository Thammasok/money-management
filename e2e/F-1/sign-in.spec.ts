// F-1 acceptance contract — Sign In screen and the sign-in pause. Failing by design until implemented.
import { expect, test } from '@playwright/test';
import { failSignInsViaApi, signOutViaApi, signUpViaApi } from './fixtures/auth-api';
import { resetDb } from './fixtures/db-reset';
import { Messages, Passwords, SeedUser, uniqueEmail } from './fixtures/test-data';
import { HomePage } from './pages/home.page';
import { SignInPage } from './pages/sign-in.page';

test.describe('F-1 sign in', () => {
  let signIn: SignInPage;
  let home: HomePage;

  // UT-7 relies on the seeded User — make sure the `test` context is applied (no-op in mock mode).
  test.beforeAll(() => {
    resetDb();
  });

  test.beforeEach(async ({ page }) => {
    signIn = new SignInPage(page);
    home = new HomePage(page);
  });

  // UT-7 · S-2
  test('the seeded User signs in', async ({ page }) => {
    await signIn.goto();
    await signIn.signIn(SeedUser.email, SeedUser.password);

    await expect(page).toHaveURL(/\/$/);
    await expect(home.signedInEmail).toHaveText(SeedUser.email);
  });

  // UT-8 · S-6
  test('sign-in ignores the email letter case', async ({ page }) => {
    const user = await signUpViaApi(page.request, uniqueEmail('case'));
    await signOutViaApi(page.request);

    await signIn.goto();
    await signIn.signIn(user.email.toUpperCase(), user.password);

    await expect(page).toHaveURL(/\/$/);
    await expect(home.signedInEmail).toHaveText(user.email);
  });

  // UT-9 · S-17
  test('a wrong password is refused', async ({ page }) => {
    const user = await signUpViaApi(page.request, uniqueEmail('wrong-pass'));
    await signOutViaApi(page.request);

    await signIn.goto();
    await signIn.signIn(user.email, Passwords.wrong);

    await expect(signIn.error).toHaveText(Messages.badCredentials);
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  // UT-10 · S-18
  test('an email no User has gets the same message', async ({ page }) => {
    await signIn.goto();
    await signIn.signIn(uniqueEmail('ghost'), Passwords.valid);

    await expect(signIn.error).toHaveText(Messages.badCredentials);
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  // UT-11 · S-19
  test('after 10 failures sign-in is paused, even with the correct password', async ({ page }) => {
    const user = await signUpViaApi(page.request, uniqueEmail('locked'));
    await signOutViaApi(page.request);
    await failSignInsViaApi(page.request, user.email);

    await signIn.goto();
    await signIn.signIn(user.email, user.password);

    await expect(signIn.error).toContainText(Messages.pausedUiPrefix);
    await expect(signIn.error).toContainText(/\d{1,2}:\d{2}/);
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(home.root).toHaveCount(0);
  });

  // UT-12 · S-11
  test('the pause is per email', async ({ page }) => {
    await failSignInsViaApi(page.request, uniqueEmail('paused'));
    const free = await signUpViaApi(page.request, uniqueEmail('free'));
    await signOutViaApi(page.request);

    await signIn.goto();
    await signIn.signIn(free.email, free.password);

    await expect(page).toHaveURL(/\/$/);
    await expect(home.signedInEmail).toHaveText(free.email);
  });
});
