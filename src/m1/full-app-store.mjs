// M1-06 development only. All state lives in a separately named IndexedDB.
// No automatic access to production or staging localStorage.
import {migrateLegacy} from './migration.mjs';
export const FULL_DB_NAME='farmtrack-m1-full-development-v1';
export const EMPTY_STATE=()=>({profile:{},crops:[],events:[],expenses:[],notes:[],schemes:[],prices:[]});
const copy=x=>JSON.parse(JSON.stringify(x));
const request=q=>new Promise((resolve,reject)=>{q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});
export function openFullDb(impl=globalThis.indexedDB){
  if(!impl) return Promise.reject(new Error('IndexedDB is unavailable'));
  return new Promise((resolve,reject)=>{
    const q=impl.open(FULL_DB_NAME,1);
    q.onupgradeneeded=()=>{
      const db=q.result;
      if(!db.objectStoreNames.contains('state'))db.createObjectStore('state',{keyPath:'key'});
    };
    q.onsuccess=()=>resolve(q.result);
    q.onerror=()=>reject(q.error || new Error('Unable to open M1 database'));
    q.onblocked=()=>reject(new Error('Database open was blocked'));
  });
}
export function validateState(data){
  if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Invalid farm data root');
  if(!data.profile||typeof data.profile!=='object'||Array.isArray(data.profile))throw new Error('Invalid profile');
  for(const k of ['crops','events','expenses','notes','schemes','prices']){
    if(!Array.isArray(data[k])||data[k].some(x=>!x||typeof x!=='object'||Array.isArray(x)))throw new Error('Invalid '+k);
  }
  return copy(data);
}
export async function readState(impl=globalThis.indexedDB){
  const db=await openFullDb(impl);
  try{
    const result=await request(db.transaction('state','readonly').objectStore('state').get('current'));
    return result?validateState(result.value):EMPTY_STATE();
  }finally{db.close()}
}
export async function writeState(data,impl=globalThis.indexedDB){
  const snapshot=validateState(data);
  const db=await openFullDb(impl);
  try {
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('state','readwrite');
      tx.objectStore('state').put({key:'current',value:snapshot,updatedAt:new Date().toISOString()});
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error||new Error('Write failed'));
      tx.onabort=()=>reject(tx.error||new Error('Write aborted'));
    });
    return snapshot;
  }finally{db.close()}
}
// Explicit opt-in only. Requires an empty development database.
// Original text is preserved alongside the imported data in the same transaction.
export async function importLegacyText(text,impl=globalThis.indexedDB){
  const migrated=migrateLegacy(text);
  const snapshot=validateState(JSON.parse(migrated.rawSnapshot));
  const db=await openFullDb(impl);
  try{
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('state','readwrite');
      const store=tx.objectStore('state');
      const q=store.get('current');
      q.onsuccess=()=>{
        if(q.result){tx.abort();return;}
        store.add({key:'legacy-backup',raw:text});
        store.add({key:'current',value:snapshot,updatedAt:new Date().toISOString()});
      };
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error||new Error('Import failed'));
      tx.onabort=()=>reject(tx.error||new Error('Import rejected: destination already contains records'));
    });
    return migrated.counts;
  }finally{db.close()}
}
// Serialize writes and take a copy immediately: callers cannot alter an in-flight snapshot.
// Errors propagate so the UI can warn the farmer rather than silently losing data.
let pending=Promise.resolve();
export function queueWrite(data){
  const snapshot=validateState(data);
  const task=pending.catch(()=>{}).then(()=>writeState(snapshot));
  pending=task;
  return task;
}
