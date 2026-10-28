// F-1 acceptance contract — staying signed in, signing out, and the signed-in-only route.
// Failing by design until implemented.
import { expect, test } from '@playwright/test';
import { Passwords, uniqueEmail } from './fixtures/test-data';
import { HomePage } from './pages/home.page';
import { SignInPage } from './pages/sign-in.page';
import { SignUpPage } from './pages/sign-up.page';

test.describe('F-1 session', () => {
  // UT-13 · S-3
  test('a signed-in User stays signed in after reloading', async ({ page }) => {
    const signUp = new SignUpPage(page);
    const home = new HomePage(page);
    const email = uniqueEmail('reload');

    await signUp.goto();
    await signUp.signUp(email, Passwords.valid);
    await expect(home.signedInEmail).toHaveText(email);

    await page.reload();

    await expect(page).toHaveURL(/\/$/);
    await expect(home.signedInEmail).toHaveText(email);
  });

  // UT-14 · S-4
  test('signing out ends only the current Session', async ({ page, browser }, testInfo) => {
    const email = uniqueEmail('two-browsers');
    const signUpA = new SignUpPage(page);
    const homeA = new HomePage(page);

    await signUpA.goto();
    await signUpA.signUp(email, Passwords.valid);
    await expect(homeA.signedInEmail).toHaveText(email);

    const contextB = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
    try {
      const pageB = await contextB.newPage();
      const signInB = new SignInPage(pageB);
      const homeB = new HomePage(pageB);
      await signInB.goto();
      await signInB.signIn(email, Passwords.valid);
      await expect(homeB.signedInEmail).toHaveText(email);

      await homeA.signOut();
      await expect(page).toHaveURL(/\/sign-in$/);

      await pageB.reload();
      await expect(pageB).toHaveURL(/\/$/);
      await expect(homeB.signedInEmail).toHaveText(email);
    } finally {
      await contextB.close();
    }
  });

  // UT-15 · S-8
  test('a signed-in User opening Sign In or Sign Up is sent Home', async ({ page }) => {
    const signUp = new SignUpPage(page);
    const signIn = new SignInPage(page);
    const home = new HomePage(page);

    await signUp.goto();
    await signUp.signUp(uniqueEmail('public-only'), Passwords.valid);
    await expect(home.root).toBeVisible();

    await signIn.goto();
    await expect(page).toHaveURL(/\/$/);
    await expect(home.root).toBeVisible();

    await signUp.goto();
    await expect(page).toHaveURL(/\/$/);
    await expect(home.root).toBeVisible();
  });

  // UT-16 · S-21
  test('opening Home while signed out shows Sign In', async ({ page }) => {
    const signIn = new SignInPage(page);
    const home = new HomePage(page);

    await home.goto();

    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(signIn.root).toBeVisible();
    await expect(home.root).toHaveCount(0);
  });
});
