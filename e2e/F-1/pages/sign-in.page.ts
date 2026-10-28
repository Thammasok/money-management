import type { Locator, Page } from '@playwright/test';

/** Sign In screen — component IDs from artifacts/F-1/02-flow.md (the contract). */
export class SignInPage {
  readonly root: Locator;
  readonly form: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly error: Locator;
  readonly goToSignUpLink: Locator;

  constructor(private readonly page: Page) {
    this.root = page.locator('#sign-in-page');
    this.form = page.locator('#sign-in-form');
    this.email = page.locator('#sign-in-email');
    this.password = page.locator('#sign-in-password');
    this.submit = page.locator('#sign-in-submit');
    this.error = page.locator('#sign-in-error');
    this.goToSignUpLink = page.locator('#go-to-sign-up-link');
  }

  async goto(): Promise<void> {
    await this.page.goto('/sign-in');
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}
