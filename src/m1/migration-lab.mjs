import {prepareLegacyImport,importLegacyText,readState} from './full-app-store.mjs';
import {reconcileLegacy} from './reconciliation.mjs';
const $=id=>document.getElementById(id);
let loaded=null;
$('file').addEventListener('change',()=>{
 loaded=null;$('validate').disabled=!$('file').files?.length;$('import').disabled=true;$('approval').checked=false;$('approval').disabled=true;$('report').textContent='Selected file is not yet validated.';
});
$('validate').addEventListener('click',async()=>{
 try {
  const file=$('file').files?.[0];if(!file)throw new Error('Choose synthetic JSON test data');
  if(file.size>2*1024*1024)throw new Error('Test file exceeds 2 MB');
  const text=await file.text();
  const prepared=prepareLegacyImport(text);
  loaded={text,prepared};
  $('report').textContent=JSON.stringify({counts:prepared.counts,financials:prepared.financials},null,2);
  $('approval').disabled=false;$('result').textContent='Validation passed. Import requires your explicit approval.';
 }catch(err){loaded=null;$('approval').disabled=true;$('import').disabled=true;$('report').textContent='Validation failed: '+err.message;}
});
$('approval').addEventListener('change',()=>{$('import').disabled=!loaded||!$('approval').checked;});
$('import').addEventListener('click',async()=>{
 if(!loaded||!$('approval').checked)return;
 $('import').disabled=true;
 try {
  const report=await importLegacyText(loaded.text);
  const saved=await readState();
  const reconciliation=reconcileLegacy(loaded.prepared.candidate,saved);
  $('result').textContent='IMPORT VERIFIED\n'+JSON.stringify({counts:report.counts,netCents:reconciliation.after.netCents},null,2);
 }catch(err){$('result').textContent='Import rejected; existing IndexedDB state was not intentionally replaced: '+err.message;}
});
