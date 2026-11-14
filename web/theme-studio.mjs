export const themePanels = {
  hero: {label:'Главная панель', color:'#202020'},
  sidebar: {label:'Боковая панель', color:'#0c0c0c'},
  player: {label:'Панель плеера', color:'#141414'},
};
export const themeFonts = {
  system: ['Системный', 'system-ui, sans-serif'],
  geometric: ['Геометрический', '"Century Gothic", "Trebuchet MS", sans-serif'],
  serif: ['С засечками', 'Georgia, serif'],
  mono: ['Моноширинный', 'Consolas, "Courier New", monospace'],
};
const color = (value, fallback) => typeof value==='string' && /^#[a-f0-9]{6}$/i.test(value) ? value : fallback;

export function normalizeCustomTheme(value) {
  if(!value || typeof value.id!=='string' || !/^[a-zA-Z0-9-]{1,64}$/.test(value.id))return null;
  const name=String(value.name||'').trim().slice(0,40);
  if(!name)return null;
  const panels={};
  for(const [key,defaults] of Object.entries(themePanels)){
    const panel=value.panels?.[key];
    const opacity=Number(panel?.opacity ?? 100);
    panels[key]={
      color:color(panel?.color,defaults.color),
      text:color(panel?.text,'#ededed'),
      opacity:Number.isFinite(opacity)?Math.round(Math.max(0,Math.min(100,opacity))):100,
      font:Object.hasOwn(themeFonts,panel?.font)?panel.font:'system',
    };
  }
  return {id:value.id,name,panels};
}

function paint(style,panel,prefix=''){
  style.setProperty('--'+prefix+'panel-background',panel.color);
  style.setProperty('--'+prefix+'panel-text',panel.text);
  style.setProperty('--'+prefix+'panel-opacity',panel.opacity+'%');
  style.setProperty('--'+prefix+'panel-font',themeFonts[panel.font][1]);
}
function apply(theme){
  const root=document.documentElement;
  root.dataset.customTheme=String(Boolean(theme));
  for(const key of Object.keys(themePanels)){
    if(theme)paint(root.style,theme.panels[key],key+'-');
    else for(const name of ['background','text','opacity','font'])root.style.removeProperty('--'+key+'-panel-'+name);
  }
}

export function setupThemeStudio({account,onChange}){
  const dialog=document.createElement('dialog');
  dialog.className='theme-studio';
  dialog.setAttribute('aria-labelledby','themeStudioTitle');
  dialog.innerHTML=`
    <form>
      <header class="studio-heading"><div><h2 id="themeStudioTitle">Своя тема</h2><p class="muted">Выбери панель в макете и настрой её оформление.</p></div><button type="button" data-close aria-label="Закрыть">×</button></header>
      <div class="studio-layout">
        <div class="studio-preview" aria-label="Макет приложения">
          <button type="button" data-panel="sidebar" class="studio-sidebar"><strong>veyww</strong><span>◉ Для тебя</span><span>⌕ Поиск</span><span>♡ Понравившиеся</span><span>▤ Плейлисты</span></button>
          <button type="button" data-panel="hero" class="studio-hero"><span><small>ТВОЯ МУЗЫКА</small><strong>На твоей<br>частоте</strong><span class="studio-listen">▶ Слушать подборку</span></span><i aria-hidden="true" class="studio-record"></i></button>
          <button type="button" data-panel="player" class="studio-player"><span><strong>one way ticket</strong><small>ONDA ANDAR</small></span><span class="studio-transport" aria-hidden="true">◀ <b>▶</b> ▶</span><span class="studio-progress" aria-hidden="true"></span></button>
        </div>
        <div class="studio-controls">
          <label>Название темы<input name="name" maxlength="40" required></label>
          <h3 data-panel-title></h3>
          <label>Цвет панели<input name="color" type="color"></label>
          <label>Цвет текста<input name="text" type="color"></label>
          <label>Шрифт<select name="font"></select></label>
          <label>Прозрачность <output></output><input name="transparency" type="range" min="0" max="100" value="0"></label>
          <button type="button" data-reset>Сбросить панель</button>
        </div>
      </div>
      <p data-status role="status" hidden></p>
      <footer class="studio-actions"><button type="button" data-cancel>Отмена</button><button class="primary" type="submit">Сохранить тему</button></footer>
    </form>`;
  document.body.append(dialog);
  const form=dialog.querySelector('form');
  const input=name=>form.elements.namedItem(name);
  const status=dialog.querySelector('[data-status]');
  for(const [key,[label]] of Object.entries(themeFonts))input('font').add(new Option(label,key));
  const key=()=> 'veyww-custom-themes-v1:'+(account()||'guest');
  function read(){
    try{
      const value=JSON.parse(localStorage.getItem(key())||'{}');
      const themes=Array.isArray(value.themes)?value.themes.map(normalizeCustomTheme).filter(Boolean).slice(0,12):[];
      return {themes,active:themes.some(theme=>theme.id===value.active)?value.active:null};
    }catch{return {themes:[],active:null};}
  }
  function write(value){
    try{localStorage.setItem(key(),JSON.stringify(value));return true;}
    catch{return false;}
  }
  function refresh(){
    const data=read(),active=data.themes.find(theme=>theme.id===data.active);
    apply(active);
    return data;
  }
  function choose(id){
    const data=read();
    if(id && !data.themes.some(theme=>theme.id===id))return false;
    if(!data.active && !id)return true;
    if(!write({...data,active:id}))return false;
    refresh();return true;
  }
  let draft,panelKey,editorAccount;
  const parts=[...dialog.querySelectorAll('[data-panel]')];
  function renderPanel(){
    for(const part of parts){
      paint(part.style,draft.panels[part.dataset.panel]);
      part.setAttribute('aria-pressed',String(part.dataset.panel===panelKey));
      part.setAttribute('aria-label','Настроить: '+themePanels[part.dataset.panel].label);
    }
    dialog.querySelector('[data-panel-title]').textContent=themePanels[panelKey].label;
    const panel=draft.panels[panelKey];
    for(const field of ['color','text','font'])input(field).value=panel[field];
    input('transparency').value=100-panel.opacity;
    dialog.querySelector('output').textContent=(100-panel.opacity)+'%';
  }
  function open(theme){
    const data=read();
    if(!theme&&data.themes.length>=12){onChange('Можно сохранить до 12 тем. Измени одну из сохранённых.');return;}
    editorAccount=key();
    draft=normalizeCustomTheme(theme||{id:crypto.randomUUID(),name:'Моя тема '+(data.themes.length+1)});
    panelKey='hero';
    input('name').value=draft.name;
    status.hidden=true;
    renderPanel();
    dialog.showModal();
  }
  for(const part of parts)part.onclick=()=>{panelKey=part.dataset.panel;renderPanel();};
  for(const name of ['color','text','font','transparency'])input(name).oninput=()=>{
    const panel=draft.panels[panelKey];
    if(name==='transparency')panel.opacity=100-Number(input(name).value);
    else panel[name]=input(name).value;
    renderPanel();
  };
  dialog.querySelector('[data-reset]').onclick=()=>{
    draft.panels[panelKey]=normalizeCustomTheme({id:'default',name:'Default'}).panels[panelKey];
    renderPanel();
  };
  for(const close of dialog.querySelectorAll('[data-close],[data-cancel]'))close.onclick=()=>dialog.close();
  form.onsubmit=event=>{
    event.preventDefault();
    if(editorAccount!==key()){dialog.close();return;}
    const next=normalizeCustomTheme({...draft,name:input('name').value});
    const data=read();
    if(!next){status.textContent='Введи название темы.';status.hidden=false;return;}
    const themes=data.themes.some(theme=>theme.id===next.id)?data.themes.map(theme=>theme.id===next.id?next:theme):[...data.themes,next];
    if(themes.length>12||!write({themes,active:next.id})){
      status.textContent='Не удалось сохранить тему в хранилище этого устройства.';status.hidden=false;return;
    }
    refresh();dialog.close();onChange('Тема сохранена на этом устройстве.');
  };
  document.addEventListener('veyww:account-changed',()=>{
    if(dialog.open&&editorAccount!==key())dialog.close();
    refresh();onChange();
  });
  refresh();
  return {read,refresh,choose,open};
}
