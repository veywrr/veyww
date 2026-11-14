import {test} from 'node:test';
import assert from 'node:assert/strict';
test('catalog authorization errors retain their status for the sign-in prompt',async()=>{
 const previous={window:globalThis.window,localStorage:globalThis.localStorage,fetch:globalThis.fetch};
 try{
  globalThis.window={};
  globalThis.localStorage={getItem:()=>null};
  globalThis.fetch=async()=>({ok:false,status:401,json:async()=>({error:'Войди в аккаунт, чтобы слушать музыку'})});
  const provider=await import('../web/provider.mjs');
  await assert.rejects(provider.search('artist'),e=>e.status===401&&e.message.includes('Войди'));
 }finally{
  for(const [key,value] of Object.entries(previous))if(value===undefined)delete globalThis[key];else globalThis[key]=value;
 }
});
