import {setupSettings} from './settings.mjs';
import {setupGlassControls,applyGlass} from './glass.mjs';
import {themes,themeId,applyTheme} from './themes.mjs';
import {setupThemeStudio} from './theme-studio.mjs';
import {profileSummary} from './profile-model.mjs';
export function setupProfile({state,nickname,save,view,editTaste,sync,diagnostics}){
 const $=id=>document.getElementById(id),section=document.createElement('section');section.id='profile';section.hidden=true;
 section.innerHTML=`<div class="profile-hero"><button id="profilePhoto" class="profile-photo" aria-label="Изменить фото профиля"></button><div><span class="micro">ТВОЁ ПРОСТРАНСТВО</span><h1 id="profileName"></h1><button id="profileRegistered" type="button"></button><br><button id="profileSettingsButton" class="pill">Настройки</button></div></div><input id="profilePhotoInput" type="file" accept="image/png,image/jpeg,image/webp" hidden><p id="profileMessage" role="status" class="muted"></p><div class="profile-counts"><article><strong id="playsDay">0</strong><span>прослушиваний сегодня</span></article><article><strong id="playsMonth">0</strong><span>в этом месяце</span></article><article><strong id="playsYear">0</strong><span>в этом году</span></article></div><p class="muted">Засчитываем 30 секунд прослушивания или половину короткого трека. Статистика собирается с этого обновления.</p><div class="section-title"><h2>Чаще всего слушаешь</h2><span class="muted">За всё время сбора</span></div><div id="profileTop"></div><div id="profileSettings" class="info-card" hidden><div class="section-title"><h2>Настройки профиля</h2><button id="closeProfileSettings" aria-label="Закрыть настройки">×</button></div><div class="actions"><button id="profileAccount">Аккаунт и синхронизация</button><button id="profilePreferences">Музыкальные предпочтения</button><button id="removeProfilePhoto">Удалить фото</button></div><h3>Оформление</h3><div id="profileThemes" class="theme-grid"></div><div id="profileGlass" class="info-card"></div><form id="profileCredentials"><h3>Никнейм и пароль</h3><label for="profileNewNickname">Никнейм</label><input id="profileNewNickname" autocomplete="username" minlength="3" maxlength="24"><label for="profileCurrentPassword">Текущий пароль</label><input id="profileCurrentPassword" type="password" autocomplete="current-password" required maxlength="128"><label for="profileNewPassword">Новый пароль (если хочешь сменить)</label><input id="profileNewPassword" type="password" autocomplete="new-password" minlength="6" maxlength="128"><p class="muted">После изменения на других устройствах потребуется войти заново.</p><button id="saveProfileCredentials" type="submit" class="primary">Сохранить изменения</button><p id="profileCredentialsStatus" role="status"></p></form><p id="profileGuestHint" class="muted" hidden>Войди в аккаунт, чтобы менять никнейм и пароль и синхронизировать профиль.</p><details><summary>Помощь с воспроизведением</summary><p class="muted">Если музыка или системные кнопки работают неправильно, открой проверку плеера.</p><button id="profileDiagnostics">Проверить плеер</button></details></div>`;
 document.querySelector('main').insertBefore(section,document.querySelector('main > footer'));
 const glassControls=setupGlassControls({container:document.getElementById('profileGlass'),state,save,account:nickname});
 const studio=setupThemeStudio({account:nickname,onChange(message){renderThemes();if(message)$('themeStudioStatus').textContent=message;}});
 function render(){
  renderThemes();glassControls.render();const nick=nickname();$('profileName').textContent=nick?'@'+nick:state.profile?.name||'Твой профиль';$('profilePhoto').replaceChildren();
  if(state.profile?.avatar){const img=new Image();img.src=state.profile.avatar;img.alt='Фото профиля';$('profilePhoto').append(img);}else $('profilePhoto').textContent=(nick||state.profile?.name||'♪').slice(0,2).toUpperCase();
  const summary=profileSummary(state.stats);$('playsDay').textContent=summary.day;$('playsMonth').textContent=summary.month;$('playsYear').textContent=summary.year;
  $('profileTop').replaceChildren();if(!summary.top.length){const p=document.createElement('p');p.className='muted';p.textContent='Здесь появятся треки, которые ты действительно слушал.';$('profileTop').append(p);}
  for(const [index,t] of summary.top.entries()){const row=document.createElement('button');row.className='profile-top-track';const number=document.createElement('span');number.textContent=index+1;const title=document.createElement('span');title.textContent=[t.artist,t.title].filter(Boolean).join(' — ');const count=document.createElement('strong');count.textContent=t.count+' раз';row.append(number,title,count);row.onclick=()=>{view('search');$('query').value=[t.artist,t.title].filter(Boolean).join(' ');$('searchForm').requestSubmit();};$('profileTop').append(row);}
  $('profileCredentials').hidden=!nick;$('profileGuestHint').hidden=Boolean(nick);if(document.activeElement!==$('profileNewNickname'))$('profileNewNickname').value=nick||'';
 }
 function renderThemes(){
  const root=$('profileThemes'),custom=studio.read();
  root.replaceChildren();
  const status=document.createElement('p');status.id='themeStudioStatus';status.className='muted';status.setAttribute('role','status');
  const card=(label,colors,selected,action)=>{
   const button=document.createElement('button');
   button.className='theme-choice';
   button.setAttribute('aria-pressed',String(selected));
   const preview=document.createElement('span');preview.className='theme-colors';
   for(const color of colors){const swatch=document.createElement('span');swatch.style.background=color;preview.append(swatch);}
   const title=document.createElement('strong');title.textContent=label;
   button.append(preview,title);button.onclick=action;return button;
  };
  for(const theme of themes)root.append(card(theme.name,theme.colors.slice(0,6),!custom.active&&theme.id===themeId(state.profile?.theme),()=>{
   if(!studio.choose(null)){status.textContent='Не удалось сохранить выбор темы.';return;}
   state.profile={...state.profile,theme:theme.id};applyTheme(theme.id);applyGlass(state.profile);save();renderThemes();
  }));
  const add=document.createElement('button');add.className='theme-choice theme-create';
  add.innerHTML='<span aria-hidden="true">＋</span><strong>Создать свою тему</strong>';
  add.onclick=()=>studio.open();root.append(add);
  for(const theme of custom.themes){
   const holder=document.createElement('div');holder.className='custom-theme-card';
   holder.append(card(theme.name,Object.values(theme.panels).map(panel=>panel.color),theme.id===custom.active,()=>{
    if(studio.choose(theme.id))renderThemes();else status.textContent='Не удалось сохранить выбор темы.';
   }));
   const edit=document.createElement('button');edit.type='button';edit.className='custom-theme-edit';
   edit.textContent='Изменить';edit.setAttribute('aria-label','Изменить тему '+theme.name);edit.onclick=()=>studio.open(theme);holder.append(edit);root.append(holder);
  }
  root.append(status);
 }
 $('profileSettingsButton').onclick=()=>{$('profileSettings').hidden=!$('profileSettings').hidden;if(!$('profileSettings').hidden)$('profileSettings').scrollIntoView({behavior:'smooth',block:'start'});};
 $('closeProfileSettings').onclick=()=>{$('profileSettings').hidden=true;};$('profileAccount').onclick=()=>sync()?.openAccount();$('profilePreferences').onclick=()=>editTaste();$('profileDiagnostics').onclick=diagnostics;
 $('profilePhoto').onclick=()=>$('profilePhotoInput').click();$('removeProfilePhoto').onclick=()=>{state.profile={...state.profile,avatar:''};save();render();};
 $('profilePhotoInput').onchange=async event=>{const file=event.target.files?.[0];if(!file)return;let url;try{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8e6)throw Error('Выбери PNG, JPEG или WebP до 8 МБ');url=URL.createObjectURL(file);const image=new Image();image.src=url;await image.decode();if(image.width*image.height>40e6)throw Error('Фото слишком большое');const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle='#111';ctx.fillRect(0,0,256,256);const size=Math.min(image.width,image.height);ctx.drawImage(image,(image.width-size)/2,(image.height-size)/2,size,size,0,0,256,256);const avatar=canvas.toDataURL('image/jpeg',.78);if(avatar.length>100000)throw Error('Фото не удалось уменьшить');state.profile={...state.profile,avatar};save();render();$('profileMessage').textContent=nickname()?'Фото сохраняется в аккаунте.':'Фото сохранено на этом устройстве.';}catch(error){$('profileMessage').textContent=error.message;}finally{if(url)URL.revokeObjectURL(url);event.target.value='';}};
 $('profileCredentials').onsubmit=async event=>{event.preventDefault();const button=$('saveProfileCredentials');button.disabled=true;$('profileCredentialsStatus').textContent='Сохраняем…';try{await sync().updateAccount({nickname:$('profileNewNickname').value,currentPassword:$('profileCurrentPassword').value,newPassword:$('profileNewPassword').value});$('profileCurrentPassword').value=$('profileNewPassword').value='';$('profileCredentialsStatus').textContent='Изменения сохранены.';render();}catch(error){$('profileCredentialsStatus').textContent=error.message;}finally{button.disabled=false;}};
 const settings=setupSettings({state,save,view,sync,nickname,renderProfile:render});const renderAll=()=>{render();settings.render();};return {render:renderAll,settings,open(){renderAll();view('profile');}};
}
