import { DATABASE_NAME, DATABASE_VERSION, COLLECTIONS, LEGACY_KEY, migrateLegacy } from './migration.mjs';
// This module is intentionally NOT loaded by production or staging index.html.
// M1 activation requires a separate migration acceptance gate.
export function openFarmDatabase(indexedDBImpl = globalThis.indexedDB) {
  if (!indexedDBImpl) return Promise.reject(new Error('IndexedDB unavailable'));
  return new Promise((resolve,reject)=>{
    const request=indexedDBImpl.open(DATABASE_NAME,DATABASE_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      for(const name of COLLECTIONS) if(!db.objectStoreNames.contains(name)) db.createObjectStore(name,{keyPath:'id'});
      if(!db.objectStoreNames.contains('metadata')) db.createObjectStore('metadata',{keyPath:'key'});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error || new Error('Could not open database'));
    request.onblocked=()=>reject(new Error('Database upgrade blocked by another tab'));
  });
}
function transactionDone(tx) {
  return new Promise((resolve,reject)=>{
    tx.oncomplete=()=>resolve();
    tx.onabort=()=>reject(tx.error || new Error('Transaction aborted'));
    tx.onerror=()=>reject(tx.error || new Error('Transaction failed'));
  });
}
export async function stageLegacyImport({ db, legacyText }) {
  const migration=migrateLegacy(legacyText); // validate before writing
  const stores=[...COLLECTIONS,'metadata'];
  const tx=db.transaction(stores,'readwrite');
  const done=transactionDone(tx);
  // Only allow importing to a pristine database; no merging and no silent overwrite.
  const meta=tx.objectStore('metadata');
  const marker=meta.get('migration');
  marker.onsuccess=()=>{
    if(marker.result) { tx.abort(); return; }
    try {
      for(const name of COLLECTIONS){
        for(const record of migration.stores[name]) tx.objectStore(name).add(record);
      }
      meta.add({key:'migration',from:LEGACY_KEY,schemaVersion:DATABASE_VERSION,
        counts:migration.counts,completedAt:new Date().toISOString()});
      meta.add({key:'legacy-backup',raw:migration.rawSnapshot});
    } catch(error) {tx.abort();}
  };
  marker.onerror=()=>tx.abort();
  await done; // atomic success, else abort and legacy key stays untouched
  return migration.counts;
}
export async function migrateFromLocalStorage({storage=globalThis.localStorage,indexedDBImpl=globalThis.indexedDB}={}) {
  const raw=storage?.getItem(LEGACY_KEY);
  if(!raw) return {status:'no-legacy-data'};
  const db=await openFarmDatabase(indexedDBImpl);
  try { const counts=await stageLegacyImport({db,legacyText:raw});return {status:'imported',counts}; }
  finally {db.close();}
  // The caller never removes or rewrites LEGACY_KEY.
}
