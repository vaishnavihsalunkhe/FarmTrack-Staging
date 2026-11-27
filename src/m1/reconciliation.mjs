// M1-07: deterministic checks only; does not modify a caller's records.
// Mirrors the legacy FarmTrack sales/expense classification so discrepancies are visible.
export const RECORD_ARRAYS=['crops','events','expenses','notes','schemes','prices'];
const moneyCents=(value,description)=>{
  if(value===null||value===undefined||value==='')return 0;
  const n=Number(value);
  if(!Number.isFinite(n)||n<0)throw new Error(description+': invalid non-negative amount');
  const cents=Math.round(n*100);
  if(!Number.isSafeInteger(cents)||Math.abs(cents/100-n)>1e-7)throw new Error(description+': unsupported precision');
  return cents;
};
export function summarizeLegacy(data) {
  if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Invalid farm root');
  for(const k of RECORD_ARRAYS)if(!Array.isArray(data[k]))throw new Error('Missing '+k);
  const events=new Map();
  for(const e of data.events){
    if(!e||typeof e!=='object'||Array.isArray(e))throw new Error('Invalid farm event');
    if(e.id!=null){const id=String(e.id);if(events.has(id))throw new Error('Duplicate event ID: '+id);events.set(id,e)}
  }
  let expenses=0, sales=0, expenseEntries=0, saleEntries=0;
  for(const [i,e] of data.events.entries())if(String(e.type||'').toLowerCase()==='sale'){
    sales+=moneyCents(e.amount,'Sale event '+i);saleEntries++;
  }else moneyCents(e.amount,'Farm event '+i);
  for(const [i,x] of data.expenses.entries()){
    if(!x||typeof x!=='object'||Array.isArray(x))throw new Error('Invalid expense record');
    const amount=moneyCents(x.amount,'Expense '+i);
    const type=String(x.category||'').toLowerCase();
    const event=x.eventId==null?null:events.get(String(x.eventId));
    if(type==='sale'){
      if(x.eventId!=null && !event)throw new Error('Sale expense refers to missing event');
      if(event && String(event.type||'').toLowerCase()!=='sale')throw new Error('Sale expense linked to non-sale event');
      if(!event){sales+=amount;saleEntries++}
      continue;
    }
    if(event && String(event.type||'').toLowerCase()==='sale')continue; // historical duplicate
    expenses+=amount;expenseEntries++;
  }
  if(!Number.isSafeInteger(expenses)||!Number.isSafeInteger(sales))throw new Error('Financial sum exceeds safe range');
  return {
    counts:Object.fromEntries(RECORD_ARRAYS.map(k=>[k,data[k].length])),
    expensesCents:expenses, salesCents:sales, netCents:sales-expenses,
    expenseEntries, saleEntries
  };
}
export function reconcileLegacy(original,after) {
  const before=summarizeLegacy(original), migrated=summarizeLegacy(after);
  if(JSON.stringify(before)!==JSON.stringify(migrated))throw new Error('Financial or record-count reconciliation failed');
  for(const kind of RECORD_ARRAYS){
    // Do not silently edit notes, crop links, quantities, dates or financial amounts.
    const input=original[kind],output=after[kind];
    input.forEach((item,i)=>{
      const {id:ignored,...source}=item;
      const {id:generated,...dest}=output[i];
      if(JSON.stringify(source)!==JSON.stringify(dest))throw new Error('Field mismatch: '+kind+'['+i+']');
      if(item.id!=null && String(item.id)!==String(generated))throw new Error('ID mismatch: '+kind+'['+i+']');
    });
  }
  if(JSON.stringify(original.profile)!==JSON.stringify(after.profile))throw new Error('Profile mismatch');
  return {before,after:migrated};
}
