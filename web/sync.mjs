import {readState,writeState,removeState} from './state-store.mjs';
import {snapshot,mergeCollection,sameCollection} from './sync-model.mjs';
export function setupSync({state,persist,apply,storageKey,onSwitch,onBeforeLogout=()=>{}}){const $=id=>document.getElementById(id);let user=null,available=false,baseline=null,timer,busy=false,again=false,epoch=0,syncJob=null,syncAbort=null,loggingOut=false;
 const baseKey=nick=>'music-sync-base:'+nick,pendingKey=nick=>'music-sync-pending:'+nick,logoutKey='music-logout-pending';
 const label=text=>{$('accountStatus').textContent=text;$('accountButton').textContent=user?'@'+user.nickname:'Войти';};
 async function api(route,data,signal){const r=await fetch('/account/'+route,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},credentials:'same-origin',body:data?JSON.stringify(data):undefined,signal:signal||AbortSignal.timeout(15000)});let j;try{j=await r.json();}catch{throw Error('Сервер синхронизации пока недоступен');}if(!r.ok)throw Object.assign(Error(j.error||'Ошибка синхронизации'),{status:r.status});return j;}
 function storeBase(){writeState(baseKey(user.nickname),baseline).catch(()=>{});}
 function setUser(next,initial){epoch++;user=next;if(next?.createdAt)state.registrationDate=next.createdAt;$('accountSignedIn').hidden=!next;$('accountForm').hidden=Boolean(next);$('accountNick').textContent=next?'@'+next.nickname:'';if(!next)return;baseline=snapshot(next.collection);storageKey('music-account:'+next.nickname,next.nickname);apply(initial||next.collection);persist();storeBase();label('Синхронизировано');document.dispatchEvent(new Event('veyww:account-changed'));}
 function changed(){if(!user||loggingOut)return;label(navigator.onLine?'Сохраняем…':'Нет сети · изменения сохранены на устройстве');clearTimeout(timer);timer=setTimeout(()=>sync(),650);}
 function sync({budget=15000,logout=false}={}){
  if(!user||loggingOut&&!logout)return Promise.resolve(false);if(syncJob)return syncJob;
  busy=true;const generation=epoch,draft=snapshot(state),base=baseline,controller=new AbortController();syncAbort=controller;const deadline=setTimeout(()=>controller.abort(),budget);
  const job=(async()=>{let succeeded=false;try{for(let retry=0;retry<4;retry++){
   const r=await api('me',undefined,controller.signal);if(generation!==epoch)return false;
   if(r.user?.nickname!==user?.nickname)throw Object.assign(Error('Вход истёк. Изменения сохранены на устройстве.'),{status:401});
   const merged=mergeCollection(base,draft,r.user.collection);let next=r.user;
   try{if(!sameCollection(merged,r.user.collection))next=(await api('sync',{revision:r.user.revision,collection:merged},controller.signal)).user;}catch(e){if(e.status===409)continue;throw e;}
   if(generation!==epoch)return false;const current=snapshot(state),combined=mergeCollection(draft,current,next.collection);baseline=snapshot(next.collection);
   if(!sameCollection(combined,current)){apply(combined);persist();}storeBase();label('Синхронизировано');succeeded=true;
   if(!sameCollection(snapshot(state),baseline))again=true;else removeState(pendingKey(user.nickname)).catch(()=>{});break;
  }if(!succeeded)throw Error('Коллекция меняется на другом устройстве. Повторяем позже.');return succeeded;
  }catch(e){if(generation!==epoch)return false;label(e.status===401?e.message:'Нет синхронизации · изменения сохранены на устройстве');return false;
  }finally{clearTimeout(deadline);if(syncJob===job){syncJob=null;syncAbort=null;busy=false;}if(generation===epoch&&again&&!loggingOut){again=false;changed();}}})();syncJob=job;return job;
 }
 async function restorePending(next,initial){const pending=await readState(pendingKey(next.nickname));if(!pending?.collection)return initial;const recovered=mergeCollection(pending.base||{},pending.collection,next.collection);return initial?mergeCollection(next.collection,initial,recovered):recovered;}
 async function loginCollection(next,local,register=false){const active=localStorage.getItem('music-active-account'),base=active===next.nickname?await readState(baseKey(next.nickname)):null;const initial=base?mergeCollection(base,local,next.collection):((register&&!active)||$('accountImport').checked)?mergeCollection({},local,next.collection):next.collection;return restorePending(next,initial);}

 async function openAccount(){$('accountDialog').showModal();try{const r=await api('me');available=r.available!==false;$('accountForm').hidden=!available||Boolean(user);if(!available)label(r.reason);else if(!user)label('Войди или создай аккаунт по никнейму.');}catch(e){label(e.message);}};
 $('accountButton').onclick=()=>{if(user)document.dispatchEvent(new Event('veyww:profile'));else openAccount();};
 $('closeAccount').onclick=()=>$('accountDialog').close();
 $('accountForm').onsubmit=async event=>{event.preventDefault();if(!available){label('Для аккаунта нужна HTTPS-версия или локальный тест на компьютере.');return;}const register=event.submitter?.id==='registerAccount';$('accountSubmit').disabled=$('registerAccount').disabled=true;try{epoch++;await finishPendingLogout();const local=snapshot(state),r=await api(register?'register':'login',{nickname:$('accountNickname').value,password:$('accountPassword').value});const initial=await loginCollection(r.user,local,register);localStorage.removeItem(logoutKey);onSwitch();setUser(r.user,initial);$('accountPassword').value='';label('Вход выполнен · сохраняем коллекцию…');await sync();}catch(e){label(e.message);}finally{$('accountSubmit').disabled=$('registerAccount').disabled=false;}};
 $('accountSync').onclick=()=>sync();
 $('accountLogout').onclick=async()=>{
  if(loggingOut||!user)return;loggingOut=true;onBeforeLogout();$('accountLogout').disabled=true;clearTimeout(timer);again=false;label('Выходим · сохраняем на устройстве…');
  const nick=user.nickname;syncAbort?.abort();epoch++;syncJob=null;syncAbort=null;busy=false;
  try{
   await sync({budget:2500,logout:true});
   // Keep the account's draft and its merge base before clearing the visible session.
   const draft=snapshot(state);await Promise.all([writeState('music-account:'+nick,state),writeState(pendingKey(nick),{base:baseline||{},collection:draft})]);
   localStorage.setItem(logoutKey,nick);let remoteEnded=false;
   try{await api('logout',{},AbortSignal.timeout(3000));remoteEnded=true;localStorage.removeItem(logoutKey);}catch{}
   epoch++;user=null;baseline=null;clearTimeout(timer);again=false;onSwitch();storageKey('music-v2',null);
   const guest=await readState('music-v2')||{};apply(snapshot(guest));persist();$('accountSignedIn').hidden=true;$('accountForm').hidden=false;
   document.dispatchEvent(new Event('veyww:account-changed'));label(remoteEnded?'Ты вышел. Изменения аккаунта сохранены на этом устройстве.':'Ты вышел на этом устройстве. Серверный выход завершится при восстановлении связи.');
  }catch(e){label('Не удалось сохранить локальную копию: '+e.message+'. Сохрани резервную копию коллекции.');}
  finally{loggingOut=false;$('accountLogout').disabled=false;}
 };

 let pendingLogoutJob=null;function finishPendingLogout(){const nick=localStorage.getItem(logoutKey);if(!nick)return Promise.resolve(true);if(pendingLogoutJob)return pendingLogoutJob;pendingLogoutJob=api('logout',{},AbortSignal.timeout(3000)).then(()=>{if(localStorage.getItem(logoutKey)===nick)localStorage.removeItem(logoutKey);return true;}).catch(()=>false).finally(()=>{pendingLogoutJob=null;});return pendingLogoutJob;}
 const poll=setInterval(()=>{if(user&&!loggingOut&&!document.hidden)sync();},15000);window.addEventListener('online',()=>{if(localStorage.getItem(logoutKey)&&!user)finishPendingLogout();else sync();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
 async function init(){if(localStorage.getItem(logoutKey)){onSwitch();storageKey('music-v2',null);apply(snapshot(await readState('music-v2')||{}));persist();await finishPendingLogout();label('Ты вышел · локальная коллекция');return;}if(window.Android&&location.hostname!=='veyww.space'){$('accountButton').hidden=true;return;}try{const r=await api('me');available=r.available!==false;if(!available){$('accountForm').hidden=true;label(r.reason);return;}if(r.user){const nick=r.user.nickname,active=localStorage.getItem('music-active-account');let old;try{old=await readState(baseKey(nick));}catch{}const initial=active===nick&&old?mergeCollection(old,snapshot(state),r.user.collection):r.user.collection;setUser(r.user,await restorePending(r.user,initial));await sync();}else label(localStorage.getItem('music-active-account')?'Войди снова для синхронизации':'Локальная коллекция · войди для синхронизации');}catch{label('Нет связи с сервером · коллекция сохранена на устройстве');}}
 async function updateAccount(data){
  if(!user)throw Error('Сначала войди в аккаунт');
  await sync();if(!user||!sameCollection(snapshot(state),baseline))throw Error('Сначала нужно сохранить коллекцию на сервере');
  const previous=user.nickname,next=(await api('settings',data)).user;setUser(next,snapshot(state));
  if(previous!==next.nickname){localStorage.removeItem('music-account:'+previous);localStorage.removeItem(baseKey(previous));}
 }
 async function acceptUser(next){epoch++;await finishPendingLogout();const local=snapshot(state),initial=await loginCollection(next,local);localStorage.removeItem(logoutKey);onSwitch();setUser(next,initial);await sync();}
 async function startGuest(){if(user)return;const nick=localStorage.getItem('music-active-account');if(nick){const base=baseline||await readState(baseKey(nick))||{};await Promise.all([writeState('music-account:'+nick,state),writeState(pendingKey(nick),{base,collection:snapshot(state)})]);onSwitch();storageKey('music-v2',null);apply(snapshot(await readState('music-v2')||{}));persist();}label('Пробное прослушивание · коллекция на этом устройстве');document.dispatchEvent(new Event('veyww:account-changed'));}
 init();return {signedIn:()=>Boolean(user),acceptUser,startGuest,changed,sync,updateAccount,openAccount,registeredAt:()=>user?.createdAt||state.registrationDate||null};
}
