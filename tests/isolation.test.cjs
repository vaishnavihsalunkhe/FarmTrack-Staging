'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('staging uses unique localStorage namespace',()=>{
 const html=read('index.html');
 assert.match(html,/const KEY='farmtrack_staging_v1'/);
 assert.doesNotMatch(html,/const KEY='farmtrack_v1'/);
 assert.doesNotMatch(html,/farmtrack_recovery_raw/);
});
test('staging service worker never purges production cache',()=>{
 const sw=read('sw.js');
 assert.match(sw,/startsWith\("farmtrack-staging-"\)/);
 assert.doesNotMatch(sw,/keys\.filter\(k=>k!==CACHE\)/);
});
test('staging recovery targets only staging registrations and caches',()=>{
 const recovery=read('reset.html');
 assert.match(recovery,/FarmTrack-Staging/);
 assert.match(recovery,/startsWith\('farmtrack-staging-'\)/);
 assert.doesNotMatch(recovery,/regs\.map\(r=>r\.unregister\(\)\)/);
});
