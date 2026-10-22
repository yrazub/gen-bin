import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

test.describe('without JavaScript', () => {
  test('AC-39: the search page shows one card per plugin and a notice that search needs JavaScript', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('[data-grid] .card h3')).toHaveText(['sdd-workflow', 'pr-review', 'node-backend', 'react-frontend']);
    // Playwright's text selectors skip <noscript>, so find the notice by its class.
    await expect(page.locator('p.notice')).toHaveText('Search needs JavaScript. All plugins are listed below.');
    await expect(page.locator('p.notice')).toBeVisible();
    await expect(page.locator('#q')).toBeHidden();
    await expect(page.getByRole('link', { name: 'sdd-workflow' }).first()).toHaveAttribute('href', '/gen-bin/plugins/sdd-workflow/');
  });

  test('AC-32: a plugin page shows its full content', async ({ page }) => {
    await page.goto('plugins/sdd-workflow/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('SDD workflow');
    await expect(page.getByRole('heading', { name: 'Install' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Contents' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What this plugin runs' })).toBeVisible();
    await expect(page.getByRole('complementary').getByText('${CLAUDE_PLUGIN_ROOT}/scripts/block-paths.sh')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'README' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Release notes' })).toBeVisible();
    await expect(page.getByText('Spec creator and implementer agents')).toBeVisible();
    await expect(page.locator('.install code').nth(1)).toHaveText('/plugin install sdd-workflow@gen-bin');
  });

  test("AC-32: What's new shows every release", async ({ page }) => {
    await page.goto('whats-new/');
    await expect(page.locator('li.release')).toHaveCount(5);
    await expect(page.getByText('Drizzle ORM patterns skill')).toBeVisible();
  });

  test('AC-41: follows the operating system colour scheme', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: 'dark' });
    const page = await context.newPage();
    await page.goto('./');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(13, 17, 23)');
    await context.close();
  });
});
