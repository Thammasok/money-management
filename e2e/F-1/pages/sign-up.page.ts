import type { Locator, Page } from '@playwright/test';

/** Sign Up screen — component IDs from artifacts/F-1/02-flow.md (the contract). */
export class SignUpPage {
  readonly root: Locator;
  readonly form: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly passwordRule: Locator;
  readonly submit: Locator;
  readonly error: Locator;
  readonly goToSignInLink: Locator;

  constructor(private readonly page: Page) {
    this.root = page.locator('#sign-up-page');
    this.form = page.locator('#sign-up-form');
    this.email = page.locator('#sign-up-email');
    this.password = page.locator('#sign-up-password');
    this.passwordRule = page.locator('#sign-up-password-rule');
    this.submit = page.locator('#sign-up-submit');
    this.error = page.locator('#sign-up-error');
    this.goToSignInLink = page.locator('#go-to-sign-in-link');
  }

  async goto(): Promise<void> {
    await this.page.goto('/sign-up');
  }

  async signUp(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}
