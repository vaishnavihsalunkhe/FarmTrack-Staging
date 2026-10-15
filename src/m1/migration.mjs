// Pure migration helpers. Never mutate the source records.
export const LEGACY_KEY = 'farmtrack_staging_v1';
export const DATABASE_NAME = 'farmtrack-staging-m1';
export const DATABASE_VERSION = 1;
export const COLLECTIONS = ['crops','events','expenses','notes','schemes','prices'];
const clone = value => JSON.parse(JSON.stringify(value));
export function validateLegacy(raw) {
  let data;
  try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch { throw new Error('Legacy JSON is invalid'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Legacy root is invalid');
  for (const collection of COLLECTIONS) {
    if (!Array.isArray(data[collection]) || data[collection].some(x=>!x||typeof x!=='object'||Array.isArray(x))) throw new Error('Invalid collection: '+collection);
  }
  if (!data.profile || typeof data.profile!=='object' || Array.isArray(data.profile)) throw new Error('Invalid farmer profile');
  return clone(data);
}
export function migrateLegacy(raw) {
  const data = validateLegacy(raw);
  const seen = new Set();
  const stores = {};
  for (const collection of COLLECTIONS) {
    stores[collection] = data[collection].map((item,position)=>{
      // Missing IDs are deterministic across retries. Duplicate explicit IDs are rejected,
      // never silently overwritten in IndexedDB.
      const record = { ...item, id: String(item.id ?? 'legacy-'+collection+'-'+position) };
      const key = collection+':'+record.id;
      if (seen.has(key)) throw new Error('Duplicate record ID: '+key);
      seen.add(key);
      return record;
    });
  }
  return {profile: data.profile, stores, counts:Object.fromEntries(COLLECTIONS.map(name=>[name,stores[name].length])), rawSnapshot:JSON.stringify(data)};
}
