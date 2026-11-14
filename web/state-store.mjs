let opening;
function database(){if(!opening)opening=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Хранилище недоступно')),2500),r=indexedDB.open('veyww-local',1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>{clearTimeout(timer);r.result.onversionchange=()=>{r.result.close();opening=null;};resolve(r.result);};r.onerror=()=>{clearTimeout(timer);reject(r.error);};r.onblocked=()=>{clearTimeout(timer);reject(Error('Хранилище заблокировано'));};}).catch(error=>{opening=null;throw error;});return opening;}
export async function readState(key){try{const db=await database();const value=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Хранилище не ответило')),2500),r=db.transaction('state').objectStore('state').get(key);r.onsuccess=()=>{clearTimeout(timer);resolve(r.result);};r.onerror=()=>{clearTimeout(timer);reject(r.error);};});if(value)return value;}catch{}try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
export async function writeState(key,value){const copy=structuredClone(value);try{const db=await database();await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');const timer=setTimeout(()=>{try{tx.abort();}catch{}reject(Error('Хранилище не ответило'));},8000);tx.objectStore('state').put(copy,key);tx.oncomplete=()=>{clearTimeout(timer);resolve();};tx.onerror=tx.onabort=()=>{clearTimeout(timer);reject(tx.error);};});const text=JSON.stringify(copy);if(text.length<500000)try{localStorage.setItem(key,text);}catch{}return;}catch{
 const text=JSON.stringify(copy);
 try{localStorage.setItem(key,text);}
 catch(error){
  if(error?.name!=='QuotaExceededError')throw Error('Браузер не смог сохранить изменения. Сохрани резервную копию коллекции.');
  // These are disposable caches; account and collection keys are kept.
  try{
   localStorage.removeItem('catalog-cache-v4');
   localStorage.removeItem('daily-mix-v7');
   localStorage.setItem(key,text);
  }catch{throw Error('Хранилище браузера заполнено. Сохрани резервную копию коллекции.');}
 }
}}
export async function removeState(key){try{const db=await database();await new Promise(resolve=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').delete(key);tx.oncomplete=resolve;tx.onerror=resolve;});}catch{}localStorage.removeItem(key);}
