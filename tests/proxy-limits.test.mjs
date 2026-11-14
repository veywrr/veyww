import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {createRequire} from 'node:module';const {serve}=createRequire(import.meta.url)('../desktop/server.cjs');
test('behind a trusted proxy login limits follow the real client and wrong passwords cannot lock the owner out',async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'music-proxy-test-'));const server=await serve(0,{dataDir:dir,trustProxy:true}),base='http://127.0.0.1:'+server.address().port;
 const post=(route,data,ip)=>fetch(base+'/account/'+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,'X-Forwarded-For':'203.0.113.250, '+ip},body:JSON.stringify(data)}).then(r=>r.status);
 try{assert.equal(await post('register',{nickname:'owner_test',password:'owner-test-password'},'198.51.100.1'),200);
  for(let i=0;i<12;i++)assert.equal(await post('login',{nickname:'owner_test',password:'wrong-password-'+i},'198.51.100.66'),401);
  assert.equal(await post('login',{nickname:'owner_test',password:'owner-test-password'},'198.51.100.66'),429);
  assert.equal(await post('login',{nickname:'owner_test',password:'owner-test-password'},'198.51.100.1'),200);
  for(let i=0;i<20;i++)assert.equal(await post('login',{nickname:'owner_test',password:'owner-test-password'},'198.51.100.1'),200);
 }finally{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
});
