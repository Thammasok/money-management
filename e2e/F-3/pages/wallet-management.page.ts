import type { Locator, Page } from '@playwright/test';

/**
 * Rename and Archive on the Wallet screen (`/wallets/:walletId`) — component IDs from artifacts/F-3/02-flow.md (the
 * contract). F-2's `WalletPage` still owns the heading, Balance, record form and Transaction list.
 */
export class WalletManagementPage {
  readonly renameButton: Locator;
  readonly renameForm: Locator;
  readonly renameInput: Locator;
  readonly renameSubmit: Locator;
  readonly renameCancel: Locator;
  readonly renameError: Locator;
  readonly archiveButton: Locator;
  readonly archiveConfirm: Locator;
  readonly confirmArchiveButton: Locator;
  readonly cancelArchiveButton: Locator;
  readonly archiveError: Locator;
  readonly archivedNotice: Locator;

  constructor(page: Page) {
    this.renameButton = page.locator('#rename-wallet-button');
    this.renameForm = page.locator('#rename-wallet-form');
    this.renameInput = page.locator('#rename-wallet-input');
    this.renameSubmit = page.locator('#rename-wallet-submit');
    this.renameCancel = page.locator('#cancel-rename-wallet-button');
    this.renameError = page.locator('#rename-wallet-error');
    this.archiveButton = page.locator('#archive-wallet-button');
    this.archiveConfirm = page.locator('#archive-wallet-confirm');
    this.confirmArchiveButton = page.locator('#confirm-archive-wallet-button');
    this.cancelArchiveButton = page.locator('#cancel-archive-wallet-button');
    this.archiveError = page.locator('#archive-wallet-error');
    this.archivedNotice = page.locator('#wallet-archived-notice');
  }

  /** Opens the rename form, replaces the name, and saves. */
  async rename(name: string): Promise<void> {
    await this.renameButton.click();
    await this.renameInput.fill(name);
    await this.renameSubmit.click();
  }

  /** Opens the confirmation and confirms. */
  async archive(): Promise<void> {
    await this.archiveButton.click();
    await this.confirmArchiveButton.click();
  }
}
