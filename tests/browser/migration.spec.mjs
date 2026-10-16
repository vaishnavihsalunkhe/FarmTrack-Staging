import {test,expect} from '@playwright/test';
const key='farmtrack_staging_v1';
const fixture=()=>({profile:{name:'Synthetic Test'},crops:[{id:'crop1',name:'Soybean'},{id:'crop2',name:'Groundnut'}],events:[{id:'sale1',type:'Sale',amount:5000}],expenses:[{id:'exp1',category:'Fertilizer',amount:1000},{id:'exp2',category:'Labour',amount:500}],notes:[],schemes:[],prices:[]});
async function prepare(page){
 await page.goto('/src/m1/test-harness.html');
 await page.evaluate(({key,data})=>localStorage.setItem(key,JSON.stringify(data)),{key,data:fixture()});
}
async function dbData(page){return page.evaluate(async()=>{
 const {openFarmDatabase}=await import('/src/m1/storage.mjs');
 const db=await openFarmDatabase();
 const getAll=name=>new Promise((resolve,reject)=>{const r=db.transaction(name,'readonly').objectStore(name).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 const [crops,events,expenses]=await Promise.all(['crops','events','expenses'].map(getAll));
 db.close();return {crops,events,expenses};
});}
test('real browser migration preserves records, finance and legacy data',async({page})=>{
 await prepare(page);
 await page.getByRole('button',{name:'Run migration test'}).click();
 await expect(page.locator('#output')).toContainText('"status": "imported"');
 const x=await dbData(page);
 expect(x.crops.map(c=>c.id).sort()).toEqual(['crop1','crop2']);
 expect(x.events.length).toBe(1);expect(x.expenses.length).toBe(2);
 expect(x.events[0].amount-x.expenses.reduce((a,b)=>a+b.amount,0)).toBe(3500);
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key)).toEqual(fixture());
 await page.reload();expect((await dbData(page)).expenses.length).toBe(2);
});
test('invalid JSON fails without importing records',async({page})=>{
 await page.goto('/src/m1/test-harness.html');
 await page.evaluate(key=>localStorage.setItem(key,'{invalid'),key);
 await page.getByRole('button',{name:'Run migration test'}).click();
 await expect(page.locator('#output')).toContainText('Migration not confirmed');
 const x=await dbData(page);expect(x.expenses.length).toBe(0);
});
test('repeat import is rejected without duplication',async({page})=>{
 await prepare(page);
 await page.getByRole('button',{name:'Run migration test'}).click();
 await expect(page.locator('#output')).toContainText('"status": "imported"');
 await page.getByRole('button',{name:'Run migration test'}).click();
 await expect(page.locator('#output')).toContainText('Migration not confirmed');
 expect((await dbData(page)).expenses.length).toBe(2);
});
