import type { Locator, Page } from '@playwright/test';

/** Home (signed-in only) — component IDs from artifacts/F-1/02-flow.md (the contract). */
export class HomePage {
  readonly root: Locator;
  readonly signedInEmail: Locator;
  readonly signOutButton: Locator;

  constructor(private readonly page: Page) {
    this.root = page.locator('#home-page');
    this.signedInEmail = page.locator('#signed-in-email');
    this.signOutButton = page.locator('#sign-out-button');
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  async signOut(): Promise<void> {
    await this.signOutButton.click();
  }
}
