import { expect, test, type Page } from '@playwright/test';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled])';

/** Tabs through the page and returns the focusable elements that never received focus. */
async function unreachable(page: Page): Promise<string[]> {
  const total = await page.evaluate((sel) => [...document.querySelectorAll<HTMLElement>(sel)].filter((e) => e.checkVisibility()).length, FOCUSABLE);
  const reached = new Set<number>();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  // Scrollable regions (a long command in a code box) are focus stops too, so allow extra presses.
  for (let i = 0; i < total * 2 + 5; i++) {
    await page.keyboard.press('Tab');
    const index = await page.evaluate((sel) => {
      const all = [...document.querySelectorAll<HTMLElement>(sel)].filter((e) => e.checkVisibility());
      return all.indexOf(document.activeElement as HTMLElement);
    }, FOCUSABLE);
    if (index >= 0) reached.add(index);
  }
  return page.evaluate(
    ({ sel, reachedList }) =>
      [...document.querySelectorAll<HTMLElement>(sel)]
        .filter((e) => e.checkVisibility())
        .filter((_, i) => !reachedList.includes(i))
        .map((e) => e.outerHTML.slice(0, 80)),
    { sel: FOCUSABLE, reachedList: [...reached] },
  );
}

/** Controls with no accessible name. */
const unnamed = (page: Page) =>
  page.evaluate((sel) => {
    const nameOf = (e: HTMLElement) =>
      e.getAttribute('aria-label') ||
      (e as HTMLInputElement).labels?.[0]?.textContent?.trim() ||
      e.textContent?.trim() ||
      e.getAttribute('title') ||
      '';
    return [...document.querySelectorAll<HTMLElement>(sel)]
      .filter((e) => e.checkVisibility())
      .filter((e) => !nameOf(e))
      .map((e) => e.outerHTML.slice(0, 80));
  }, FOCUSABLE);

const pages = [
  ['search', './'],
  ['search results', './?q=fastify'],
  ['plugin', 'plugins/sdd-workflow/'],
  ['team setup', 'team/?plugins=react-frontend'],
  ["what's new", 'whats-new/'],
] as const;

test.describe('keyboard and accessibility', () => {
  for (const [name, path] of pages) {
    test(`NFR-4: every control on the ${name} page is reachable by keyboard and has a name`, async ({ page }) => {
      await page.goto(path);
      if (path.includes('q=')) await expect(page.locator('[data-status]')).toContainText('result');
      expect(await unreachable(page)).toEqual([]);
      expect(await unnamed(page)).toEqual([]);
    });
  }

  test('NFR-4: the chips and toggles work from the keyboard', async ({ page }) => {
    await page.goto('./?q=fasti');
    await expect(page.locator('[data-status]')).toContainText('result');
    await page.locator('[data-chip="skill"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-chip="skill"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-chip="all"]').focus();
    await page.keyboard.press('Space');
    const toggle = page.locator('[data-team-toggle]:visible').first();
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  test('NFR-4: the result count sits in a polite live region and the search box has a label', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('[data-status]')).toHaveAttribute('aria-live', 'polite');
    await expect(page.getByLabel('Search plugins, skills and agents')).toBeVisible();
  });

  test('NFR-4: headings keep one outline: a single h1 per page', async ({ page }) => {
    for (const [, path] of pages) {
      await page.goto(path);
      await expect(page.locator('h1')).toHaveCount(1);
    }
  });

  test('NFR-4: no page scrolls sideways at 320 px', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 320, height: 700 } });
    const page = await context.newPage();
    for (const [name, path] of pages) {
      await page.goto(path);
      if (path.includes('q=')) await expect(page.locator('[data-status]')).toContainText('result');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(overflow, name).toBeLessThanOrEqual(0);
    }
    await context.close();
  });
});
