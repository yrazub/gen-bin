import { expect, test } from '@playwright/test';
import { EMPTY } from '../../playwright.config';

test.describe('an empty marketplace', () => {
  test('AC-30: the search page says no plugins are published and hides the search box', async ({ page }) => {
    await page.goto(EMPTY);
    await expect(page.getByRole('heading', { name: 'No plugins published yet' })).toBeVisible();
    await expect(page.locator('#q')).toHaveCount(0);
    await expect(page.locator('.card')).toHaveCount(0);
    await expect(page.getByRole('link', { name: "What's new" }).last()).toBeVisible();
  });

  test('EC-1: team setup and What\'s new show their empty states', async ({ page }) => {
    await page.goto(`${EMPTY}team/`);
    await expect(page.getByRole('heading', { name: 'No plugins published yet' })).toBeVisible();
    await page.goto(`${EMPTY}whats-new/`);
    await expect(page.getByRole('heading', { name: 'No releases yet' })).toBeVisible();
  });
});
