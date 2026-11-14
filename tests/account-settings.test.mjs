import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {createRequire} from 'node:module';
const {serve}=createRequire(import.meta.url)('../desktop/server.cjs');
test('changing credentials verifies the current password, retains collection, rotates sessions and rejects occupied names',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'veyww-settings-')),server=await serve(0,{dataDir:dir}),base='http://127.0.0.1:'+server.address().port;
 async function request(route,data,cookie=''){const r=await fetch(base+'/account/'+route,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json',Origin:base}:{}),...(cookie?{Cookie:cookie}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,cookie:r.headers.get('set-cookie')?.split(';')[0],body:await r.json()};}
 try{
  const a=await request('register',{nickname:'owner_settings',password:'old-password'}),otherSession=await request('login',{nickname:'owner_settings',password:'old-password'});await request('register',{nickname:'occupied_name',password:'another-password'});
  const avatar='data:image/jpeg;base64,YQ==';assert.equal((await request('sync',{revision:0,collection:{profile:{avatar,theme:'amoled',setupComplete:true},likes:[{id:'t',title:'Keep me'}]}},a.cookie)).status,200);
  assert.equal((await request('settings',{nickname:'new_name',currentPassword:'wrong-password'},a.cookie)).status,401);
  assert.equal((await request('settings',{nickname:'occupied_name',currentPassword:'old-password'},a.cookie)).status,409);
  assert.ok((await request('me',null,a.cookie)).body.user);
  const changed=await request('settings',{nickname:'renamed_owner',currentPassword:'old-password',newPassword:'new-password'},a.cookie);assert.equal(changed.status,200);assert.notEqual(changed.cookie,a.cookie);
  assert.equal(changed.body.user.collection.profile.avatar,avatar);assert.equal(changed.body.user.collection.profile.theme,'amoled');assert.equal(changed.body.user.collection.likes[0].title,'Keep me');
  assert.equal((await request('me',null,a.cookie)).body.user,null);assert.equal((await request('me',null,otherSession.cookie)).body.user,null);
  assert.equal((await request('login',{nickname:'owner_settings',password:'old-password'})).status,401);assert.equal((await request('login',{nickname:'renamed_owner',password:'old-password'})).status,401);assert.equal((await request('login',{nickname:'renamed_owner',password:'new-password'})).status,200);
  const before=changed.body.user;const oldClient=await request('sync',{revision:before.revision,collection:{likes:[]}},changed.cookie);assert.equal(oldClient.body.user.collection.profile.avatar,avatar);assert.equal(oldClient.body.user.collection.profile.theme,'amoled');
 }finally{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
});
