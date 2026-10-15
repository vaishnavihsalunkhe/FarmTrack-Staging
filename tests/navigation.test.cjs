'use strict';
const test=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const main=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes("function show(page)"));
assert.ok(main,'main script not found');
function startup(seed){
 const elements=new Map();
 const get=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',classList:{add(){},remove(){}},style:{}});return elements.get(id)};
 const nav=[{classList:{remove(){},add(){}}}];
 let saved=structuredClone(seed);
 const localStorage={getItem:key=>key==='farmtrack_v1'?JSON.stringify(saved):null,setItem(key,value){if(key==='farmtrack_v1')saved=JSON.parse(value)}};
 const ctx=vm.createContext({document:{querySelectorAll:()=>nav,getElementById:get},localStorage,console,Date,Number,String,Array,Object,JSON,Intl,setTimeout(){},alert(){},confirm(){return false}});
 new vm.Script(main,{filename:'farmtrack-main.js'}).runInContext(ctx,{timeout:1500});
 const render=page=>{vm.runInContext("show("+JSON.stringify(page)+")",ctx,{timeout:1500});return get('app').innerHTML};
 return {home:get('app').innerHTML,render,readSaved(){return structuredClone(saved)},input(id,value){get(id).value=value},eval(code){return vm.runInContext(code,ctx,{timeout:1500})}};
}
const seed={profile:{name:'Test Farmer'},crops:[{id:'c1',name:'Soybean',area:1,stage:'Growing'}],events:[{id:'s1',type:'Sale',crop:'c1',date:'2026-10-10',amount:3500}],expenses:[{id:'e1',category:'Fertilizer',crop:'c1',date:'2026-10-08',amount:900}],notes:[],schemes:[],prices:[]};
test('launch renders dashboard with synthetic crop',()=>{const app=startup(seed);assert.match(app.home,/Test Farmer/);assert.match(app.home,/Soybean/)});
test('diary tab renders records',()=>assert.match(startup(seed).render('diary'),/Farm Diary/));
test('finance expenses tab excludes sale values',()=>{const app=startup(seed);const h=app.render('economics');assert.match(h,/900/);assert.doesNotMatch(h,/3,500/)});
test('finance sales tab displays sale, excludes expenses',()=>{const app=startup(seed);app.eval("financeTab('sales')");const h=app.render('economics');assert.match(h,/3,500/);assert.doesNotMatch(h,/900/);});
test('profit & loss computes correct net',()=>{const app=startup(seed);app.eval("financeTab('profit')");const h=app.render('economics');assert.match(h,/3,500/);assert.match(h,/900/);assert.match(h,/2,600/);});
test('sales recorded as legacy linked expenses do not reduce profit',()=>{const old=structuredClone(seed);old.expenses.push({id:'sale-old',eventId:'s1',category:'Sale',amount:3500});const app=startup(old);app.eval("financeTab('profit')");assert.match(app.render('economics'),/2,600/);});
test('modules tab renders',()=>assert.match(startup(seed).render('modules'),/Farm modules/));
test('blank initial storage still launches',()=>assert.match(startup({}).home,/Quick actions/));

test('saving offline Labour expense persists it and refreshes profit immediately',()=>{
 const fixture=structuredClone(seed);
 fixture.events[0].amount=5000;
 fixture.expenses[0].amount=1000;
 const app=startup(fixture);
 app.input('x_cat','Labour');
 app.input('x_crop','c1');
 app.input('x_date','2026-10-15');
 app.input('x_amount','500');
 app.input('x_note','Offline test');
 app.eval('saveExpense()');
 const saved=app.readSaved();
 assert.equal(saved.expenses.length,2);
 assert.equal(Number(saved.expenses[1].amount),500);
 const profit=app.render('economics');
 assert.match(profit,/3,500/);
 assert.match(profit,/1,500/);
 assert.match(profit,/Profit & Loss/);
});
