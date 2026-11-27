import test from 'node:test';
import assert from 'node:assert/strict';
import {indexedDB} from 'fake-indexeddb';
import {FULL_DB_NAME,openFullDb,prepareLegacyImport,importLegacyText,readState,writeState} from '../src/m1/full-app-store.mjs';
const fixture=()=>({profile:{name:'Synthetic M1 Farmer'},crops:[{id:'c1',name:'Soybean',area:1}],events:[{id:'s1',type:'Sale',crop:'c1',amount:'5000'}],expenses:[{id:'x1',category:'Fertilizer',crop:'c1',amount:'1000'},{id:'x2',category:'Sale',eventId:'s1',crop:'c1',amount:'5000'}],notes:[{type:'observation',text:'Test'}],schemes:[],prices:[]});
const req=q=>new Promise((resolve,reject)=>{q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});
const wipe=()=>req(indexedDB.deleteDatabase(FULL_DB_NAME));
test('M1 file import preserves all original values and deduplicates legacy linked sale totals',async()=>{
 await wipe();
 const data=fixture();const text=JSON.stringify(data);
 const prepared=prepareLegacyImport(text);
 assert.equal(prepared.financials.salesCents,500000);
 assert.equal(prepared.financials.expensesCents,100000);
 assert.equal(prepared.financials.netCents,400000);
 const report=await importLegacyText(text,indexedDB);
 assert.equal(report.counts.events,1);
 const restored=await readState(indexedDB);
 assert.deepEqual(restored,{...data,notes:[{...data.notes[0],id:'legacy-notes-0'}]});
 const db=await openFullDb(indexedDB);
 const tx=db.transaction('state','readonly');
 const raw=await req(tx.objectStore('state').get('legacy-backup'));
 const metadata=await req(tx.objectStore('state').get('migration-report'));
 db.close();
 assert.equal(raw.raw,text);
 assert.equal(metadata.financials.netCents,400000);
});
test('legacy records without ids gain deterministic ids; source JSON stays untouched',async()=>{
 await wipe();
 const data=fixture();delete data.notes[0].id;
 const before=JSON.stringify(data);
 const result=prepareLegacyImport(before);
 assert.equal(result.candidate.notes[0].id,'legacy-notes-0');
 assert.equal(before,JSON.stringify(data));
 await importLegacyText(before,indexedDB);
 assert.equal((await readState(indexedDB)).notes[0].id,'legacy-notes-0');
});
test('import into nonempty database rejects without changing current records',async()=>{
 await wipe();
 const current=fixture();
 await writeState(current,indexedDB);
 await assert.rejects(importLegacyText(JSON.stringify(fixture()),indexedDB),/destination must be empty/i);
 assert.deepEqual(await readState(indexedDB),current);
});
test('malformed/duplicate records fail before any imported state is committed',async()=>{
 await wipe();
 const duplicate=fixture();duplicate.expenses.push({...duplicate.expenses[0]});
 await assert.rejects(importLegacyText(JSON.stringify(duplicate),indexedDB),/Duplicate record ID/);
 assert.deepEqual(await readState(indexedDB),{profile:{},crops:[],events:[],expenses:[],notes:[],schemes:[],prices:[]});
 await assert.rejects(importLegacyText('{broken',indexedDB),/invalid/i);
});
test('successful import cannot be silently repeated',async()=>{
 await wipe();
 const text=JSON.stringify(fixture());
 await importLegacyText(text,indexedDB);
 await assert.rejects(importLegacyText(text,indexedDB),/destination must be empty/i);
 assert.equal((await readState(indexedDB)).crops.length,1);
});
