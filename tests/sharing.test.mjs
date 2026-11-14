import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
const {serve}=createRequire(import.meta.url)('../desktop/server.cjs');
test('six-character passwords work and five-character passwords are rejected',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'veyw-password-')),server=await serve(0,{dataDir:dir}),base='http://127.0.0.1:'+server.address().port;
 const post=(route,password)=>fetch(base+'/account/'+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({nickname:'six_char_user',password})});
 try{assert.equal((await post('register','12345')).status,400);assert.equal((await post('register','six123')).status,200);assert.equal((await post('login','six123')).status,200);}
 finally{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
});
test('playlist links require an owner, expose only a snapshot, survive restart and can be revoked only by the owner',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'veyw-sharing-'));let server=await serve(0,{dataDir:dir}),base='http://127.0.0.1:'+server.address().port;
 async function request(route,data,cookie='',origin=base){const r=await fetch(base+'/account/'+route,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json',Origin:origin}:{}),...(cookie?{Cookie:cookie}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,cookie:r.headers.get('set-cookie')?.split(';')[0],data:await r.json()};}
 try{
  const owner=await request('register',{nickname:'owner',password:'six123'}),other=await request('register',{nickname:'other',password:'six123'});
  const playlist={id:'p1',name:'Shared list',tracks:[{id:'remote',title:'Song',artist:'Artist',source:'SoundCloud',page:'https://soundcloud.com/a/song',url:'https://signed.example/private'},{id:'local',title:'Local',source:'Файл',url:'blob:private'}]};
  assert.equal((await request('share',{playlist})).status,401);
  assert.equal((await request('share',{playlist},owner.cookie,'https://foreign.example')).status,403);
  const shared=await request('share',{playlist},owner.cookie);assert.equal(shared.status,200);assert.match(shared.data.token,/^[a-f0-9]{48}$/);assert.equal(shared.data.count,1);assert.equal(shared.data.excluded,1);
  const token=shared.data.token,read=await request('shared/'+token);
  assert.equal(read.status,200);assert.equal(read.data.playlist.tracks[0].url,'');assert.equal(read.data.playlist.tracks[0].page,playlist.tracks[0].page);assert.equal(read.data.playlist.tracks.length,1);assert.equal('user' in read.data,false);
  playlist.name='Updated snapshot';const again=await request('share',{playlist},owner.cookie);assert.equal(again.data.token,token);assert.equal((await request('shared/'+token)).data.playlist.name,'Updated snapshot');
  await request('share/revoke',{playlistId:'p1'},other.cookie);assert.equal((await request('shared/'+token)).status,200);
  assert.equal((await request('me',null,other.cookie)).data.user.collection.playlists.length,0);
  await new Promise(r=>server.close(r));server=await serve(0,{dataDir:dir});base='http://127.0.0.1:'+server.address().port;
  assert.equal((await request('shared/'+token)).status,200);
  await request('share/revoke',{playlistId:'p1'},owner.cookie);assert.equal((await request('shared/'+token)).status,404);
  assert.equal((await request('shared/not-a-token')).status,404);
 }finally{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
});
