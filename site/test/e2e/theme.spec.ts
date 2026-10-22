import { expect, test, type Page } from '@playwright/test';

const DARK_BG = 'rgb(13, 17, 23)';
const LIGHT_BG = 'rgb(255, 255, 255)';
const background = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const choice = (page: Page, name: 'system' | 'light' | 'dark') => page.locator(`[data-theme-choice="${name}"]`);
const dataTheme = (page: Page) => page.evaluate(() => document.documentElement.getAttribute('data-theme'));

test.describe('theme control', () => {
  test('AC-40: the header has System, Light and Dark, with System selected by default', async ({ page }) => {
    await page.goto('./');
    const group = page.getByRole('group', { name: 'Theme' });
    await expect(group.getByRole('button')).toHaveCount(3);
    await expect(choice(page, 'system')).toHaveAttribute('aria-label', 'System theme');
    await expect(choice(page, 'light')).toHaveAttribute('aria-label', 'Light theme');
    await expect(choice(page, 'dark')).toHaveAttribute('aria-label', 'Dark theme');
    await expect(choice(page, 'system')).toHaveAttribute('aria-pressed', 'true');
    await expect(choice(page, 'light')).toHaveAttribute('aria-pressed', 'false');
    expect(await dataTheme(page)).toBeNull();
  });

  test('AC-41: System follows the operating system colour scheme', async ({ browser }) => {
    for (const [scheme, expected] of [['dark', DARK_BG], ['light', LIGHT_BG]] as const) {
      const context = await browser.newContext({ colorScheme: scheme });
      const page = await context.newPage();
      await page.goto('./');
      expect(await background(page)).toBe(expected);
      await context.close();
    }
  });

  test('AC-42: a choice applies at once and to every page opened later', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light' });
    const page = await context.newPage();
    await page.goto('./');
    await choice(page, 'dark').click();
    expect(await dataTheme(page)).toBe('dark');
    expect(await background(page)).toBe(DARK_BG);
    await expect(choice(page, 'dark')).toHaveAttribute('aria-pressed', 'true');
    await expect(choice(page, 'system')).toHaveAttribute('aria-pressed', 'false');

    await page.getByRole('link', { name: "What's new" }).click();
    await expect(page).toHaveURL(/whats-new/);
    expect(await dataTheme(page)).toBe('dark');
    expect(await background(page)).toBe(DARK_BG);
    await expect(choice(page, 'dark')).toHaveAttribute('aria-pressed', 'true');

    await page.goto('plugins/node-backend/');
    expect(await background(page)).toBe(DARK_BG);

    await choice(page, 'system').click();
    expect(await dataTheme(page)).toBeNull();
    expect(await background(page)).toBe(LIGHT_BG);
    await page.goto('./');
    expect(await dataTheme(page)).toBeNull();
    await context.close();
  });

  test('AC-42: Light wins over a dark operating system', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();
    await page.goto('./');
    await choice(page, 'light').click();
    expect(await background(page)).toBe(LIGHT_BG);
    await page.reload();
    expect(await dataTheme(page)).toBe('light');
    expect(await background(page)).toBe(LIGHT_BG);
    await context.close();
  });

  test('AC-43: a stored choice is applied before the page body exists, so before first paint', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light' });
    await context.addInitScript(() => {
      try {
        localStorage.setItem('gen-bin:theme', 'dark');
      } catch {}
      const w = window as unknown as { __themeSetWhen?: string };
      new MutationObserver(() => {
        w.__themeSetWhen ??= document.body ? 'after-body' : 'before-body';
      }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-theme'] });
    });
    const page = await context.newPage();
    const response = await page.goto('./');

    // The inline script sits in <head>, ahead of the body and of any stylesheet link...
    const html = (await response!.text()).replace(/\s+/g, ' ');
    const script = html.indexOf('gen-bin:theme');
    expect(script).toBeGreaterThan(-1);
    expect(script).toBeLessThan(html.indexOf('<body'));
    // ...and it ran while the parser had not reached <body> yet.
    expect(await page.evaluate(() => (window as unknown as { __themeSetWhen?: string }).__themeSetWhen)).toBe('before-body');
    expect(await dataTheme(page)).toBe('dark');
    expect(await background(page)).toBe(DARK_BG);
    await context.close();
  });

  test('EC-18: a stored value other than light or dark is ignored', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light' });
    await context.addInitScript(() => localStorage.setItem('gen-bin:theme', 'sepia'));
    const page = await context.newPage();
    await page.goto('./');
    expect(await dataTheme(page)).toBeNull();
    await expect(choice(page, 'system')).toHaveAttribute('aria-pressed', 'true');
    expect(await background(page)).toBe(LIGHT_BG);
    await context.close();
  });

  test('EC-15: with storage blocked the choice still applies to the open page', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light' });
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
    await choice(page, 'dark').click();
    expect(await background(page)).toBe(DARK_BG);
    expect(errors).toEqual([]);
    await context.close();
  });
});
