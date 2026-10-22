import { expect, test, type Page } from '@playwright/test';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

const PLUGINS = ['sdd-workflow', 'pr-review', 'node-backend', 'react-frontend'];
const status = (page: Page) => page.locator('[data-status]');
const cards = (page: Page) => page.locator('[data-grid] .card');
const search = async (page: Page, q: string) => {
  await page.locator('#q').fill(q);
  await expect(status(page)).toContainText(/result/);
};

test.describe('search page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
  });

  test('AC-9: an empty box shows one card per plugin, in catalog order', async ({ page }) => {
    await expect(cards(page).locator('h3')).toHaveText(PLUGINS);
    await expect(status(page)).toHaveText('Showing all 4 plugins');
  });

  test('AC-2: shows matches within 300 ms of the last keystroke, best first', async ({ page }) => {
    const input = page.locator('#q');
    await input.focus(); // loads the index, as a visitor's first click would
    await page.waitForTimeout(300);
    // Timestamps taken in the page, so the test's own polling does not count.
    await page.evaluate(() => {
      const w = window as unknown as { __lastKey: number; __shownAt: number };
      document.querySelector('#q')!.addEventListener('input', () => (w.__lastKey = performance.now()), true);
      new MutationObserver(() => (w.__shownAt = performance.now())).observe(document.querySelector('[data-status]')!, {
        childList: true, characterData: true, subtree: true,
      });
    });
    await input.pressSequentially('fasti');
    await expect(status(page)).toHaveText('4 results for "fasti"');
    const [lastKey, shownAt] = await page.evaluate(() => {
      const w = window as unknown as { __lastKey: number; __shownAt: number };
      return [w.__lastKey, w.__shownAt];
    });
    console.log(`AC-2: results ${(shownAt - lastKey).toFixed(0)} ms after the last keystroke`);
    expect(shownAt - lastKey).toBeLessThan(300);
    await expect(cards(page).first().locator('h3')).toHaveText('fastify-best-practices');
  });

  test('AC-5: a card shows type, invocable name, plugin, description, version and a source link', async ({ page }) => {
    await search(page, 'specification');
    const card = cards(page).filter({ hasText: 'spec-creator' });
    await expect(card.locator('.badge')).toHaveText('Agent');
    await expect(card.locator('[data-f="invocable"]')).toHaveText('@agent-sdd-workflow:spec-creator');
    await expect(card.locator('[data-f="plugin-link"]')).toHaveText('sdd-workflow');
    await expect(card.locator('[data-f="version"]')).toHaveText('v0.1.0');
    await expect(card.locator('[data-f="description"]')).toContainText('written specification');
    await expect(card.locator('[data-f="source"]')).toHaveAttribute(
      'href',
      /^https:\/\/github\.com\/yrazub\/gen-bin\/blob\/[^/]+\/plugins\/sdd-workflow\/agents\/spec-creator\.md$/,
    );
    await expect(card.locator('h3 a')).toHaveAttribute('href', '/gen-bin/plugins/sdd-workflow/');
    await expect(card.locator('code')).toHaveText('/plugin install sdd-workflow@gen-bin');

    await search(page, 'devdigest');
    await expect(cards(page).filter({ hasText: 'Hook' })).toHaveCount(0);
    await search(page, 'block-paths');
    const hook = cards(page).first();
    await expect(hook.locator('[data-f="invocable"]')).toHaveText('PreToolUse · Write|Edit');
  });

  test('AC-6: the copy button copies the install command and says "Copied" for 2 s', async ({ page }) => {
    const button = cards(page).first().locator('button[data-copy]');
    await button.click();
    await expect(button).toHaveText('✓ Copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('/plugin install sdd-workflow@gen-bin');
    await page.waitForTimeout(1500);
    await expect(button).toHaveText('✓ Copied');
    await expect(button).toHaveText('Copy', { timeout: 1500 });
  });

  test('EC-12: without the clipboard API the command is selected and the button says so', async ({ page }) => {
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: undefined }));
    const button = cards(page).first().locator('button[data-copy]');
    await button.click();
    await expect(button).toHaveText('Press Ctrl/Cmd+C');
    expect(await page.evaluate(() => getSelection()?.toString())).toBe('/plugin install sdd-workflow@gen-bin');
  });

  test('AC-7: highlights the query words in the name and the description', async ({ page }) => {
    await search(page, 'fastify');
    const card = cards(page).filter({ hasText: 'fastify-best-practices' });
    await expect(card.locator('h3 mark')).toHaveText('fastify');
    await search(page, 'servers');
    await expect(cards(page).filter({ hasText: 'fastify-best-practices' }).locator('[data-f="description"] mark')).toHaveText('servers');
  });

  test('AC-8: offers the type filter options with counts', async ({ page }) => {
    const chips = page.locator('[data-chip]');
    await expect(chips).toHaveCount(7);
    expect(await chips.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.chip))).toEqual([
      'all', 'plugin', 'skill', 'agent', 'command', 'hook', 'mcp',
    ]);
    await search(page, 'fasti');
    await expect(page.locator('[data-chip="skill"]')).toHaveText(/^Skills\s*3$/);
    await expect(page.locator('[data-chip="all"]')).toHaveText(/^All\s*4$/);
  });

  test('AC-34: a type filter shows only cards of that type', async ({ page }) => {
    await search(page, 'fasti');
    await page.locator('[data-chip="skill"]').click();
    await expect(cards(page)).toHaveCount(3);
    await expect(cards(page).locator('.badge')).toHaveText(['Skill', 'Skill', 'Skill']);
    await expect(page.locator('[data-chip="skill"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-chip="agent"]').click();
    await expect(cards(page)).toHaveCount(0);
  });

  test('AC-10: no matches shows the query and a control that clears it and the filter', async ({ page }) => {
    await page.locator('[data-chip="skill"]').click();
    await page.locator('#q').fill('zzzzqx');
    await expect(page.locator('[data-no-matches-text]')).toHaveText('No matches for "zzzzqx"');
    await expect(cards(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Clear search and filters' }).click();
    await expect(page.locator('#q')).toHaveValue('');
    await expect(page.locator('[data-chip="all"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(status(page)).toHaveText('Showing all 4 plugins');
    await expect(cards(page)).toHaveCount(4);
    expect(new URL(page.url()).search).toBe('');
  });

  test('AC-11: the URL follows the query and the filter', async ({ page }) => {
    await search(page, 'review');
    await expect.poll(() => new URL(page.url()).search).toBe('?q=review&type=all');
    await page.locator('[data-chip="agent"]').click();
    await expect.poll(() => new URL(page.url()).search).toBe('?q=review&type=agent');
  });

  test('AC-35: opening a link with q and type shows that search', async ({ page }) => {
    await page.goto('./?q=review&type=agent');
    await expect(status(page)).toHaveText('1 result for "review"');
    await expect(page.locator('#q')).toHaveValue('review');
    await expect(page.locator('[data-chip="agent"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(cards(page).locator('h3')).toHaveText(['architecture-reviewer']);
  });

  test('AC-35: an unknown type is ignored', async ({ page }) => {
    await page.goto('./?q=review&type=bogus');
    await expect(page.locator('[data-chip="all"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(status(page)).toContainText('results for "review"');
  });

  test('EC-9: HTML in the query is shown as text and never run', async ({ page }) => {
    const query = '<img src=x onerror="window.__xss=1"> *"';
    await page.locator('#q').fill(query);
    await expect(page.locator('[data-no-matches-text]')).toHaveText(`No matches for "${query}"`);
    await expect(page.locator('[data-no-matches] img')).toHaveCount(0);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    await expect(status(page)).toHaveText('Showing all 4 plugins'.replace('Showing all 4 plugins', `0 results for "${query}"`));
  });
});

test.describe('plugin page install panel', () => {
  test('AC-15: shows three install commands, each with a copy button', async ({ page }) => {
    await page.goto('plugins/node-backend/');
    const rows = page.locator('.install .copy');
    await expect(rows).toHaveCount(3);
    await expect(rows.locator('code')).toHaveText([
      '/plugin marketplace add yrazub/gen-bin',
      '/plugin install node-backend@gen-bin',
      'claude plugin install node-backend@gen-bin',
    ]);
    const second = rows.nth(1).locator('button');
    await second.click();
    await expect(second).toHaveText('✓ Copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('/plugin install node-backend@gen-bin');
  });
});
