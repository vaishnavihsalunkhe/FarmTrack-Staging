import { test, expect } from '@playwright/test';

test('IndexedDB device preview recalculates and survives offline restart', async ({ page,context }) => {
  await page.goto('/src/m1/dev-preview.html');
  await expect(page.locator('#status')).toContainText('IndexedDB records loaded');
  await page.getByRole('button',{name:'Initialize sample farm'}).click();
  await expect(page.locator('#profit')).toHaveText('₹4,000');
  await expect(page.locator('#crops')).toHaveText('1');
  await page.getByRole('button',{name:'Add ₹500 Labour expense'}).click();
  await expect(page.locator('#profit')).toHaveText('₹3,500');
  await expect(page.locator('#expenses')).toHaveText('₹1,500');
  await expect(page.locator('#expenseCount')).toHaveText('2');
  await page.reload();
  await expect(page.locator('#profit')).toHaveText('₹3,500');
  await expect(page.evaluate(async () => {
    const registration=await navigator.serviceWorker.ready;
    await registration.update();
    return !!registration.active;
  })).toBe(true);
  await context.setOffline(true);
  try {
    await page.reload({waitUntil:'load'});
    await expect(page.locator('#profit')).toHaveText('₹3,500');
    await expect(page.locator('#crops')).toHaveText('1');
  } finally {await context.setOffline(false)}
});
test('device preview does not read production localStorage key',async({page})=>{
  await page.goto('/src/m1/dev-preview.html');
  await page.evaluate(()=>localStorage.setItem('farmtrack_v1',JSON.stringify({crops:[{id:'private',name:'Production'}]})));
  await page.reload();
  await expect(page.locator('#crops')).toHaveText('0');
  expect(await page.evaluate(()=>localStorage.getItem('farmtrack_v1'))).toContain('Production');
});
