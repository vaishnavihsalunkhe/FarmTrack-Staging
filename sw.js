const CACHE="farmtrack-staging-v2";
const ASSETS=["./","./index.html","./manifest.json","./icon.svg","./icons/icon-192.svg","./icons/icon-512.svg"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("farmtrack-staging-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  const isNav=e.request.mode==="navigate"||e.request.destination==="document";
  if(isNav){
    e.respondWith(fetch(e.request,{cache:"no-store"}).then(r=>{
      if(r.ok)caches.open(CACHE).then(c=>c.put("./index.html",r.clone()));
      return r;
    }).catch(()=>caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{
    if(r.ok)caches.open(CACHE).then(c=>c.put(e.request,r.clone()));
    return r;
  })));
});
