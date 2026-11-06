// The paths people use every day, checked on a phone-sized screen with a fake backend.
import { test, expect, devices } from '@playwright/test';
import { mockSupabase, members } from './mock.js';

test.use({ ...devices['Pixel 7'] });

let errors;
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
});
test.afterEach(() => expect(errors, 'no uncaught errors').toEqual([]));

test('home shows every member and the search filters them', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('./#/students');
  await expect(page.locator('.scard')).toHaveCount(members.length);
  await page.getByPlaceholder('دوّر باسم أو تخصص').fill('سارة');
  await expect(page.locator('.scard')).toHaveCount(1);
});

test('a profile opens from the home grid', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('./#/students');
  await page.locator('.scard').first().click();
  await expect(page.locator('.pcard')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'عنّي' })).toBeVisible();
});

test('stories wheel shows faces and opens a story', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('./#/stories');
  const items = page.locator('.wheel .witem');
  await expect(items.first()).toBeVisible();
  await page.locator('.wheel .witem[aria-selected="true"]').click();
  await expect(page.locator('.txt2')).toBeVisible();
});

test('course page shows its students', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('./#/course/1');
  await expect(page.locator('.chero h1')).toHaveText('تصميم واجهات المستخدم');
  await expect(page.locator('.cards .scard')).toHaveCount(members.length);
});

test('help page explains the basics, not staff tools', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('./#/help');
  await expect(page.getByText('الشارات: فضي، ذهبي، ماسي')).toBeVisible();
  await expect(page.getByText('لوحة الإدارة')).toHaveCount(0);
});

test('the panel is closed to students', async ({ page }) => {
  await mockSupabase(page, { signedIn: true, role: 'student' });
  await page.goto('./#/panel');
  await expect(page.getByText('هاي الصفحة للإدارة والمدربين بس.')).toBeVisible();
});

test('staff see the insights tab', async ({ page }) => {
  await mockSupabase(page, { signedIn: true, role: 'admin' });
  await page.goto('./#/panel');
  await page.getByRole('tab', { name: 'الإحصائيات' }).click();
  await expect(page.getByText('طلاب ما نزّلوا ستوري هالأسبوع')).toBeVisible();
  await expect(page.locator('.bars .bar')).toHaveCount(14);
});

test('offline banner appears without internet', async ({ page, context }) => {
  await mockSupabase(page);
  await page.goto('./#/students');
  await expect(page.locator('.scard').first()).toBeVisible();
  await context.setOffline(true);
  await expect(page.locator('.offline')).toBeVisible();
});
