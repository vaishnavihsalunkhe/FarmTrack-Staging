import { migrateFromLocalStorage, openFarmDatabase } from './storage.mjs';
import { COLLECTIONS, LEGACY_KEY } from './migration.mjs';
const $=id=>document.getElementById(id);
$('run').addEventListener('click',async()=>{
  $('output').textContent='Validating and migrating STAGING data (legacy records will not be deleted)…';
  try {
    const result=await migrateFromLocalStorage();
    const db=await openFarmDatabase();
    const tx=db.transaction([...COLLECTIONS,'metadata'],'readonly');
    const checks=await Promise.all(COLLECTIONS.map(name=>new Promise((resolve,reject)=>{
      const q=tx.objectStore(name).count();q.onsuccess=()=>resolve([name,q.result]);q.onerror=()=>reject(q.error);
    })));
    db.close();
    $('output').textContent=JSON.stringify({result,storedCounts:Object.fromEntries(checks),legacyStillPresent:localStorage.getItem(LEGACY_KEY)!==null},null,2);
  }catch(e){$('output').textContent='Migration not confirmed: '+e.message+'. The legacy localStorage data has not been intentionally removed.';}
});
