import { expect, test, type Page } from '@playwright/test';

const badge = (page: Page) => page.locator('[data-team-count]');
const cardToggle = (page: Page, plugin: string) =>
  page
    .locator('[data-grid] .card')
    .filter({ has: page.getByRole('heading', { name: plugin, exact: true }) })
    .locator('[data-team-toggle]');

test.describe('team setup', () => {
  test('AC-20: plugin cards and plugin pages have an Add to team setup toggle', async ({ page }) => {
    await page.goto('./');
    for (const name of ['sdd-workflow', 'pr-review', 'node-backend', 'react-frontend']) {
      await expect(cardToggle(page, name)).toBeVisible();
      await expect(cardToggle(page, name)).toHaveText('+ Add to team setup');
    }
    await page.goto('plugins/pr-review/');
    const toggle = page.locator('[data-team-toggle]');
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveText('✓ In team setup');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  test('AC-20: only plugin cards have the toggle, not the artifact cards in search results', async ({ page }) => {
    await page.goto('./?q=review');
    await expect(page.locator('[data-status]')).toContainText('results');
    const shown = await page.locator('[data-grid] .card').evaluateAll((cs) =>
      cs.map((c) => [c.querySelector('.badge')!.textContent, !(c.querySelector('[data-team-toggle]') as HTMLElement).hidden]),
    );
    expect(shown.filter(([type]) => type !== 'Plugin').every(([, visible]) => visible === false)).toBe(true);
    expect(shown.filter(([type]) => type === 'Plugin').every(([, visible]) => visible === true)).toBe(true);
  });

  test('AC-36: the header counts the selected plugins and the count survives navigation', async ({ page }) => {
    await page.goto('./');
    await expect(badge(page)).toBeHidden();
    await cardToggle(page, 'sdd-workflow').click();
    await expect(badge(page)).toContainText('1');
    await cardToggle(page, 'pr-review').click();
    await expect(badge(page)).toContainText('2');
    await page.goto('whats-new/');
    await expect(badge(page)).toContainText('2');
    await page.goto('./');
    await cardToggle(page, 'sdd-workflow').click();
    await expect(badge(page)).toContainText('1');
    await expect(cardToggle(page, 'sdd-workflow')).toHaveAttribute('aria-pressed', 'false');
  });

  test('AC-24: with nothing selected the page says so and links to search', async ({ page }) => {
    await page.goto('team/');
    await expect(page.getByRole('heading', { name: 'No plugins selected' })).toBeVisible();
    const link = page.getByRole('link', { name: 'Browse plugins' });
    await expect(link).toHaveAttribute('href', '/gen-bin/');
    await expect(page.locator('[data-detail]')).toBeHidden();
  });

  test('AC-23: the URL follows the selection', async ({ page }) => {
    await page.goto('team/');
    await page.getByLabel(/^pr-review/).check();
    await expect.poll(() => new URL(page.url()).search).toBe('?plugins=pr-review');
    await page.getByLabel(/^SDD workflow/).check();
    await expect.poll(() => new URL(page.url()).search).toBe('?plugins=pr-review,sdd-workflow');
    await page.getByLabel(/^pr-review/).uncheck();
    await page.getByLabel(/^SDD workflow/).uncheck();
    await expect.poll(() => new URL(page.url()).search).toBe('');
  });

  test('AC-21, AC-22: shows the snippet and labels a dependency added for a plugin', async ({ page }) => {
    await page.goto('team/');
    await page.getByLabel(/^react-frontend/).check();
    const snippet = JSON.parse((await page.locator('[data-snippet]').textContent())!);
    expect(snippet.enabledPlugins).toEqual({ 'node-backend@gen-bin': true, 'react-frontend@gen-bin': true });
    expect(snippet.extraKnownMarketplaces['gen-bin'].source).toEqual({ source: 'github', repo: 'yrazub/gen-bin' });
    const dependency = page.locator('[data-row="node-backend"]');
    await expect(dependency).toContainText('Added as a dependency of react-frontend');
    await expect(dependency.locator('input')).toBeChecked();
    await expect(dependency.locator('input')).toBeDisabled();
    await expect(page.locator('[data-shell]')).toContainText('claude plugin install node-backend@gen-bin');
  });

  test('AC-37, EC-11: a ?plugins= link shows that selection and names the unknown ones as text', async ({ page }) => {
    await page.goto('team/?plugins=node-backend,ghost,%3Cb%3Ex%3C%2Fb%3E');
    await expect(page.getByLabel(/^node-backend/)).toBeChecked();
    await expect(page.getByLabel(/^pr-review/)).not.toBeChecked();
    await expect(page.locator('[data-unknown] li')).toHaveText(['Unknown plugin: ghost', 'Unknown plugin: <b>x</b>']);
    await expect(page.locator('[data-unknown] b')).toHaveCount(0);
    await expect(badge(page)).toContainText('1');
    await expect(page.locator('[data-share] code')).toContainText('?plugins=node-backend');
  });

  test('the snippet copy button copies the whole snippet', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('team/?plugins=pr-review');
    await page.getByRole('button', { name: 'Copy snippet' }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(JSON.parse(copied).enabledPlugins).toEqual({ 'pr-review@gen-bin': true });
  });

  test('EC-15: with storage blocked the selection still works while the page is open', async ({ browser }) => {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('blocked', 'SecurityError');
        },
      });
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('./');
    await cardToggle(page, 'pr-review').click();
    await expect(badge(page)).toContainText('1');
    await expect(cardToggle(page, 'pr-review')).toHaveAttribute('aria-pressed', 'true');
    await page.goto('team/?plugins=pr-review,node-backend');
    await expect(page.getByLabel(/^pr-review/)).toBeChecked();
    await expect(page.getByLabel(/^node-backend/)).toBeChecked();
    expect(errors).toEqual([]);
    await context.close();
  });
});
