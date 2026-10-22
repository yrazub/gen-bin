import { expect, test } from '@playwright/test';
import { LARGE } from '../../playwright.config';

test('NFR-3: a query on 300 artifacts shows its first cards in under 50 ms, excluding the debounce', async ({ page }) => {
  await page.goto(LARGE);
  await expect(page.locator('[data-grid] .card')).toHaveCount(20);
  await page.locator('#q').focus();
  await page.waitForTimeout(500); // the index has loaded

  const times = await page.evaluate(async () => {
    const input = document.querySelector<HTMLInputElement>('#q')!;
    const grid = document.querySelector<HTMLElement>('[data-grid]')!;
    const status = document.querySelector<HTMLElement>('[data-status]')!;
    const idle = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // The page calls history.replaceState the moment its debounce timer fires, just before it
    // searches, so the time from that call to the status line changing is the query's own cost.
    // (Headless Chromium fires a 150 ms timer ~90 ms late; that is not the page's time.)
    let fired = 0;
    const replaceState = history.replaceState.bind(history);
    history.replaceState = (...args: Parameters<History['replaceState']>) => {
      fired = performance.now();
      return replaceState(...args);
    };

    const measure = async (q: string) => {
      const done = new Promise<number>((resolve) => {
        const observer = new MutationObserver(() => {
          observer.disconnect();
          resolve(performance.now());
        });
        observer.observe(status, { childList: true, characterData: true, subtree: true });
      });
      input.value = q;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const shownAt = await done;
      // Let the rest of the cards render before the next query.
      let count = -1;
      while (count !== grid.children.length) {
        count = grid.children.length;
        await idle(150);
      }
      return { q, ms: shownAt - fired, shown: grid.children.length };
    };

    await measure('warm'); // a first query pays one-off JIT costs, like any page's first call
    const results = [];
    for (const q of ['review', 'cache', 'schema route', 'retry timeout', 'deploy', 'sess']) results.push(await measure(q));
    return results;
  });

  console.log('first results (ms from the debounce firing):', times.map((r) => `${r.q}=${r.ms.toFixed(1)} (${r.shown} cards)`).join(', '));
  for (const r of times) expect(r.shown, r.q).toBeGreaterThan(0);
  expect(Math.max(...times.map((r) => r.ms))).toBeLessThan(50);
});
