import {test,expect} from '@playwright/test';
const url='/src/m1/full-app.html';
test('full app loads on empty IndexedDB and creates crop, expense and sale without using localStorage', async({page})=>{
 await page.goto(url);
 await expect(page.locator('#storageStatus')).toContainText('IndexedDB ready');
 await expect(page.locator('#app')).toContainText('Quick actions');
 await expect(page.locator('#app')).toContainText('Add your first crop');
 await page.getByRole('button',{name:/Add crop/i}).first().click();
 await page.locator('#c_name').fill('Synthetic Soybean');
 await page.locator('#c_area').fill('1');
 await page.locator('#form').getByRole('button',{name:'Save'}).click();
 await expect(page.locator('#storageStatus')).toContainText('Saved in IndexedDB');
 await expect(page.locator('#app')).toContainText('Synthetic Soybean');
 await page.getByRole('button',{name:/Add expense/i}).first().click();
 await page.locator('#x_amount').fill('1000');
 await page.locator('#form').getByRole('button',{name:'Save'}).click();
 await expect(page.locator('#storageStatus')).toContainText('Saved in IndexedDB');
 await expect(page.locator('#app')).toContainText('1,000');
 // A sale is an event and must not also increase expenses.
 await page.locator('#n-economics').click();
 await page.getByRole('button',{name:'Sales',exact:true}).click();
 await page.getByRole('button',{name:/\+ Sale/}).click();
 await page.locator('#e_amount').fill('5000');
 await page.locator('#form').getByRole('button',{name:'Save'}).click();
 await expect(page.locator('#storageStatus')).toContainText('Saved in IndexedDB');
 await page.locator('#n-economics').click();
 await page.getByRole('button',{name:'Profit & Loss'}).click();
 await expect(page.locator('#app')).toContainText('₹4,000');
 await page.reload();
 await expect(page.locator('#storageStatus')).toContainText('IndexedDB ready');
 await page.locator('#n-economics').click();
 await page.getByRole('button',{name:'Profit & Loss'}).click();
 await expect(page.locator('#app')).toContainText('₹4,000');
 expect(await page.evaluate(()=>localStorage.getItem('farmtrack_v1'))).toBeNull();
 expect(await page.evaluate(()=>localStorage.getItem('farmtrack_staging_v1'))).toBeNull();
});
test('M1 full app starts without importing existing staging or production localStorage',async({page})=>{
 await page.goto(url);
 await page.evaluate(()=>{
 localStorage.setItem('farmtrack_v1',JSON.stringify({profile:{name:'PROD TEST'},crops:[{id:'p1',name:'Never import production'}]}));
 localStorage.setItem('farmtrack_staging_v1',JSON.stringify({profile:{name:'STAGING TEST'},crops:[{id:'s1',name:'Never import staging'}]}));
 });
 await page.reload();
 await expect(page.locator('#storageStatus')).toContainText('IndexedDB ready');
 await expect(page.locator('#app')).toContainText('Add your first crop');
 await expect(page.locator('#app')).not.toContainText('Never import');
});
