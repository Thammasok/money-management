// F-2 acceptance contract — authored at Stage 7.5, failing by design until implemented.
// Implementation tracks may NOT edit assertions, scenarios, or fixture shapes (.claude/rules/e2e-contract.md).
import { expect, test, type Page } from '@playwright/test';
import { signUpViaApi } from '../F-1/fixtures/auth-api';
import { createWalletViaApi, recordTransactionViaApi, type CreatedWallet } from './fixtures/ledger-api';
import { LEAP_DAY, localDate, Messages, uniqueEmail } from './fixtures/test-data';
import { CreateWalletPage } from './pages/create-wallet.page';
import { WalletPage } from './pages/wallet.page';

/** A signed-in User with one THB Wallet "Cash" (Opening Balance 1,000.00), opened in the page. */
async function openCashWallet(page: Page, prefix: string, openingBalanceMinor = '100000'): Promise<CreatedWallet> {
  await signUpViaApi(page.request, uniqueEmail(prefix));
  const cash = await createWalletViaApi(page.request, { name: 'Cash', currency: 'THB', openingBalanceMinor });
  await new WalletPage(page).goto(cash.id);
  return cash;
}

test.describe('F-2 Record Income and Expense', () => {
  // UT-9 · S-2 — an Income raises the Balance
  test('an Income raises the Balance', async ({ page }) => {
    const wallet = new WalletPage(page);
    await openCashWallet(page, 'income');

    await wallet.record({ kind: 'expense', amount: '125.50' });
    await expect(wallet.balance).toHaveText('THB 874.50');
    await wallet.record({ kind: 'income', amount: '2000' });
    await expect(wallet.balance).toHaveText('THB 2,874.50');
    await expect(wallet.rows).toHaveCount(2);
    await expect(wallet.field(wallet.rows.first(), 'kind')).toHaveText('Income');
    await expect(wallet.field(wallet.rows.first(), 'amount')).toHaveText('THB 2,000.00');
  });

  // UT-10 · S-3 — after a save the amount and note are cleared; Kind and date are kept
  test('the form keeps Kind and date and clears amount and note', async ({ page }) => {
    const wallet = new WalletPage(page);
    const yesterday = localDate(-1);
    await openCashWallet(page, 'form');

    await expect(wallet.date).toHaveValue(localDate(0));
    await expect(wallet.kindExpense).toBeChecked();

    await wallet.record({ kind: 'income', amount: '10', date: yesterday, note: 'Tip' });
    await expect(wallet.balance).toHaveText('THB 1,010.00');
    await expect(wallet.amount).toHaveValue('');
    await expect(wallet.note).toHaveValue('');
    await expect(wallet.kindIncome).toBeChecked();
    await expect(wallet.date).toHaveValue(yesterday);
    await expect(wallet.field(wallet.rows.first(), 'date')).toHaveText(yesterday);
  });

  // UT-11 · S-4, S-18 — JPY has no minor digits; a Balance may go negative
  test('a JPY Wallet has no decimals and may go negative', async ({ page }) => {
    const create = new CreateWalletPage(page);
    const wallet = new WalletPage(page);
    await signUpViaApi(page.request, uniqueEmail('yen'));

    await create.goto();
    await create.create('Yen Card', 'JPY', '0');
    await expect(wallet.balance).toHaveText('JPY 0');

    await wallet.record({ kind: 'expense', amount: '15.5' });
    await expect(wallet.error).toHaveText(Messages.invalidAmount);
    await expect(wallet.rows).toHaveCount(0);

    await wallet.record({ kind: 'expense', amount: '1500' });
    await expect(wallet.balance).toHaveText('-JPY 1,500');
    await expect(wallet.field(wallet.rows.first(), 'amount')).toHaveText('JPY 1,500');
    await expect(wallet.error).toBeHidden();
  });

  // UT-12 · S-7 — the note is optional
  test('a Transaction without a note', async ({ page }) => {
    const wallet = new WalletPage(page);
    await openCashWallet(page, 'nonote');

    await wallet.record({ kind: 'expense', amount: '40' });
    await expect(wallet.rows).toHaveCount(1);
    const row = wallet.rows.first();
    await expect(wallet.field(row, 'amount')).toHaveText('THB 40.00');
    await expect(wallet.field(row, 'note')).toHaveCount(0);
  });

  // UT-13 · S-9 — newest date first; on the same date the later-recorded first
  test('newest date first, ties by later recorded', async ({ page }) => {
    const wallet = new WalletPage(page);
    const cash = await openCashWallet(page, 'order');

    await recordTransactionViaApi(page.request, cash.id, { kind: 'expense', amountMinor: '100', occurredOn: localDate(0), note: 'A' });
    await recordTransactionViaApi(page.request, cash.id, { kind: 'expense', amountMinor: '200', occurredOn: localDate(-3), note: 'B' });
    await recordTransactionViaApi(page.request, cash.id, { kind: 'expense', amountMinor: '300', occurredOn: localDate(0), note: 'C' });
    await page.reload();

    await expect(wallet.rows.locator('[data-field="note"]')).toHaveText(['C', 'A', 'B']);
    await expect(wallet.rows.locator('[data-field="date"]')).toHaveText([localDate(0), localDate(0), localDate(-3)]);
  });

  // UT-14 · S-10 — today is accepted; a past leap day keeps its date through the whole stack (AD-1)
  test('today is accepted and a leap day keeps its date', async ({ page }) => {
    const wallet = new WalletPage(page);
    await openCashWallet(page, 'dates');

    await wallet.record({ kind: 'expense', amount: '5' });
    await expect(wallet.rows).toHaveCount(1);
    await expect(wallet.field(wallet.rows.first(), 'date')).toHaveText(localDate(0));

    await wallet.record({ kind: 'expense', amount: '7', date: LEAP_DAY, note: 'Leap' });
    await expect(wallet.rows).toHaveCount(2);
    const leap = wallet.rows.filter({ has: page.locator('[data-field="note"]', { hasText: 'Leap' }) });
    await expect(wallet.field(leap, 'date')).toHaveText(LEAP_DAY);
    await expect(wallet.balance).toHaveText('THB 988.00');

    await page.reload();
    await expect(wallet.field(leap, 'date')).toHaveText(LEAP_DAY);
    await expect(wallet.balance).toHaveText('THB 988.00');
  });

  // UT-15 · S-13 — typed amounts become exact minor units
  test('minor units are exact', async ({ page }) => {
    const wallet = new WalletPage(page);
    await openCashWallet(page, 'minor', '1');

    await expect(wallet.balance).toHaveText('THB 0.01');
    await wallet.record({ kind: 'income', amount: '0.1' });
    await expect(wallet.balance).toHaveText('THB 0.11');
    await expect(wallet.field(wallet.rows.first(), 'amount')).toHaveText('THB 0.10');
  });

  // UT-16 · S-17 — a date after today is refused by the API and nothing is saved
  test('a future date is refused', async ({ page }) => {
    const wallet = new WalletPage(page);
    await openCashWallet(page, 'future');

    await wallet.record({ kind: 'expense', amount: '10', date: localDate(1) });
    await expect(wallet.error).toContainText(Messages.futureDate);
    await expect(wallet.balance).toHaveText('THB 1,000.00');
    await expect(wallet.empty).toHaveText(Messages.noTransactions);
    await expect(wallet.rows).toHaveCount(0);
  });

  // UT-17 · S-18 — zero is refused by the API; text the Web App cannot read is refused before sending
  test('invalid amounts are refused', async ({ page }) => {
    const wallet = new WalletPage(page);
    await openCashWallet(page, 'amount');

    await wallet.record({ kind: 'expense', amount: '0' });
    await expect(wallet.error).toContainText(Messages.amountPositive);

    for (const typed of ['abc', '-5', '1.234']) {
      await wallet.record({ kind: 'expense', amount: typed });
      await expect(wallet.error, `amount "${typed}"`).toHaveText(Messages.invalidAmount);
    }

    await expect(wallet.rows).toHaveCount(0);
    await expect(wallet.balance).toHaveText('THB 1,000.00');
  });
});
