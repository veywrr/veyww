import {suggestions,groupVersions,versionName} from './search-model.mjs';
export function setupSearchSuggestions({input,artists,onChoose,knownArtists=()=>[],account=()=>'guest'}){
 const root=document.createElement('div');root.id='searchSuggestions';root.className='search-suggestions';root.setAttribute('role','listbox');input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',root.id);root.hidden=true;root.setAttribute('aria-label','Подсказки поиска');input.closest('form').append(root);let timer,generation=0,history=[];
 let historyKey='';function loadHistory(){const next='veyww-search-history:'+account();if(next===historyKey)return;historyKey=next;history=[];try{history=JSON.parse(localStorage.getItem(next)||'[]').filter(x=>typeof x==='string').slice(0,20);}catch{}}loadHistory();
 const close=()=>{root.hidden=true;input.setAttribute('aria-expanded','false');};
 const render=names=>{root.replaceChildren();for(const name of names){const b=document.createElement('button');b.type='button';b.setAttribute('role','option');b.tabIndex=-1;b.textContent=name;b.onclick=()=>{input.value=name;close();input.focus();onChoose();};b.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();(b.nextElementSibling||root.firstElementChild)?.focus();}if(e.key==='ArrowUp'){e.preventDefault();(b.previousElementSibling||input).focus();}if(e.key==='Escape'){close();input.focus();}};root.append(b);}root.hidden=!names.length;input.setAttribute('aria-expanded',String(!root.hidden));};
 input.setAttribute('aria-expanded','false');input.addEventListener('input',()=>{clearTimeout(timer);loadHistory();const token=++generation,q=input.value.trim();render(suggestions(q,history,knownArtists()));if(q.length<2){close();return;}timer=setTimeout(async()=>{try{const found=await artists(q);if(token===generation&&document.activeElement===input)render(suggestions(q,history,[...found,...knownArtists()]));}catch{}},400);});
 input.addEventListener('keydown',e=>{if(e.key==='Escape')close();if(e.key==='ArrowDown'&&!root.hidden){e.preventDefault();root.querySelector('button')?.focus();}});
 document.addEventListener('click',e=>{if(!root.contains(e.target)&&e.target!==input)close();});
 return {remember(q){loadHistory();generation++;clearTimeout(timer);close();history=[q,...history.filter(x=>x!==q)].slice(0,20);try{localStorage.setItem(historyKey,JSON.stringify(history));}catch{}}};
}
export function renderVersionGroups(root,tracks,renderRows){
 renderRows(root.id,tracks);const rows=new Map(tracks.map((t,i)=>[t.id,root.children[i]]));root.replaceChildren();for(const g of groupVersions(tracks)){
  root.append(rows.get(g.tracks[0].id));
  if(g.tracks.length<2)continue;
  const details=document.createElement('details');details.className='track-versions';const summary=document.createElement('summary');summary.textContent='Другие версии · '+(g.tracks.length-1);details.append(summary);
  for(const t of g.tracks.slice(1)){const label=document.createElement('small');label.className='muted';label.textContent=versionName(t);details.append(label,rows.get(t.id));}root.append(details);
 }
}
