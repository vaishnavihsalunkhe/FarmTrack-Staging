// M1-06 development only. All state lives in a separately named IndexedDB.
// No automatic access to production or staging localStorage.
import {migrateLegacy} from './migration.mjs';
import {reconcileLegacy} from './reconciliation.mjs';
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
// Explicit file-based import, never reads localStorage. Reject occupied databases.
// A legacy backup and reconciled data are written in one IndexedDB transaction.
export function prepareLegacyImport(text){
  const migrated=migrateLegacy(text);
  const source=JSON.parse(migrated.rawSnapshot);
  const candidate=validateState(source);
  for(const [name,records] of Object.entries(migrated.stores))candidate[name]=records;
  const reconciliation=reconcileLegacy(source,candidate);
  return {candidate,counts:migrated.counts,financials:reconciliation.before};
}
export async function importLegacyText(text,impl=globalThis.indexedDB){
  const prepared=prepareLegacyImport(text);
  const db=await openFullDb(impl);
  try{
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('state','readwrite');
      const store=tx.objectStore('state');
      const q=store.get('current');
      q.onsuccess=()=>{
        if(q.result){tx.abort();return;}
        try{
          store.add({key:'legacy-backup',raw:text});
          store.add({key:'current',value:prepared.candidate,updatedAt:new Date().toISOString()});
          store.add({key:'migration-report',counts:prepared.counts,financials:prepared.financials});
        }catch(e){tx.abort()}
      };
      q.onerror=()=>tx.abort();
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error||new Error('Import transaction failed'));
      tx.onabort=()=>reject(tx.error||new Error('Import rejected. Destination must be empty; nothing was replaced.'));
    });
    const after=await readState(impl);
    reconcileLegacy(prepared.candidate,after);
    return {counts:prepared.counts,financials:prepared.financials};
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
