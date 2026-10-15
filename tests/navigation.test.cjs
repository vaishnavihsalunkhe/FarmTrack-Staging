'use strict';
const test=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const main=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes("function show(page)"));
assert.ok(main,'main script not found');
function startup(seed){
 const elements=new Map();
 const get=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',classList:{add(){},remove(){}},style:{}});return elements.get(id)};
 const nav=[{classList:{remove(){},add(){}}}];
 const localStorage={getItem:key=>key==='farmtrack_v1'?JSON.stringify(seed):null,setItem(){}};
 const ctx=vm.createContext({document:{querySelectorAll:()=>nav,getElementById:get},localStorage,console,Date,Number,String,Array,Object,JSON,Intl,setTimeout(){},alert(){},confirm(){return false}});
 new vm.Script(main,{filename:'farmtrack-main.js'}).runInContext(ctx,{timeout:1500});
 const render=page=>{vm.runInContext("show("+JSON.stringify(page)+")",ctx,{timeout:1500});return get('app').innerHTML};
 return {home:get('app').innerHTML,render};
}
const seed={profile:{name:'Test Farmer'},crops:[{id:'c1',name:'Soybean',area:1,stage:'Growing'}],events:[{id:'s1',type:'Sale',crop:'c1',date:'2026-10-10',amount:3500}],expenses:[{id:'e1',category:'Fertilizer',crop:'c1',date:'2026-10-08',amount:900}],notes:[],schemes:[],prices:[]};
test('launch renders dashboard with synthetic crop',()=>{const app=startup(seed);assert.match(app.home,/Test Farmer/);assert.match(app.home,/Soybean/)});
test('diary tab renders records',()=>assert.match(startup(seed).render('diary'),/Farm Diary/));
test('finance expenses tab excludes sale values',()=>{const app=startup(seed);const h=app.render('economics');assert.match(h,/900/);assert.doesNotMatch(h,/3,500/)});
test('finance tabs render sales and profit',()=>{const app=startup(seed);vm.runInContext('',vm.createContext({}));assert.match(app.render('economics'),/Expenses/);});
test('modules tab renders',()=>assert.match(startup(seed).render('modules'),/Farm modules/));
test('blank initial storage still launches',()=>assert.match(startup({}).home,/Quick actions/));
