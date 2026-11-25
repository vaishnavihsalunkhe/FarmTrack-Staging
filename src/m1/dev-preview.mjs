import {openFarmDatabase,stageLegacyImport} from './storage.mjs';
const fixture = () => ({
 profile:{name:'Synthetic Farmer'},
 crops:[{id:'test-soybean',name:'Soybean Test',area:1}],
 events:[{id:'test-sale',type:'Sale',crop:'test-soybean',date:'2026-10-15',amount:5000}],
 expenses:[{id:'test-fertilizer',category:'Fertilizer',crop:'test-soybean',date:'2026-10-15',amount:1000}],
 notes:[],schemes:[],prices:[]
});
const $=id=>document.getElementById(id);
const money=n=>'₹'+Number(n).toLocaleString('en-IN',{maximumFractionDigits:2});
const request=q=>new Promise((resolve,reject)=>{q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});
async function readAll(name){
 const db=await openFarmDatabase();
 try{return await request(db.transaction(name,'readonly').objectStore(name).getAll())}
 finally{db.close()}
}
async function addExpense(amount){
 const db=await openFarmDatabase();
 try{
  await new Promise((resolve,reject)=>{
   const tx=db.transaction('expenses','readwrite');
   tx.objectStore('expenses').add({id:crypto.randomUUID(),category:'Labour',crop:'test-soybean',date:new Date().toISOString().slice(0,10),amount});
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Transaction aborted'));
  });
 }finally{db.close()}
}
async function draw(){
 const [crops,events,expenses]=await Promise.all(['crops','events','expenses'].map(readAll));
 const cost=expenses.filter(x=>String(x.category||'').toLowerCase()!=='sale').reduce((v,x)=>v+Number(x.amount||0),0);
 const sales=events.filter(x=>x.type==='Sale').reduce((v,x)=>v+Number(x.amount||0),0);
 $('crops').textContent=String(crops.length);
 $('expenses').textContent=money(cost);
 $('sales').textContent=money(sales);
 $('profit').textContent=money(sales-cost);
 $('expenseCount').textContent=String(expenses.length);
 $('status').textContent='IndexedDB records loaded. No production data accessed.';
}
async function run(action){
 $('status').textContent='Processing…';
 try{await action();await draw()}catch(e){$('status').textContent='Error: '+e.message}
}
$('seed').addEventListener('click',()=>run(async()=>{
 const db=await openFarmDatabase();
 try{await stageLegacyImport({db,legacyText:JSON.stringify(fixture())})}
 finally{db.close()}
}));
$('add').addEventListener('click',()=>run(async()=>addExpense(500)));
$('refresh').addEventListener('click',()=>run(async()=>{}));
$('export').addEventListener('click',()=>run(async()=>{
 const [crops,events,expenses]=await Promise.all(['crops','events','expenses'].map(readAll));
 const file=new Blob([JSON.stringify({crops,events,expenses},null,2)],{type:'application/json'});
 const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download='farmtrack-m1-synthetic-data.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}));
if('serviceWorker' in navigator)navigator.serviceWorker.register('./dev-sw.js',{scope:'./'}).catch(e=>{console.warn('M1 preview worker unavailable',e)});
draw().catch(e=>{$('status').textContent='Database error: '+e.message});
