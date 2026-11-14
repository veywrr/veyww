export function setupPlayerRefinements(){
 const full=document.getElementById('fullPlayer'),content=full.querySelector('.full-player-content'),carousel=content.querySelector('.cover-carousel');
 const more=document.createElement('button');more.id='trackMore';more.textContent='⋮';more.setAttribute('aria-label','Действия с треком');more.setAttribute('aria-expanded','false');
 const wrap=document.createElement('div');wrap.className='track-menu-wrap';const menu=document.createElement('div');menu.className='track-menu';menu.hidden=true;
 wrap.append(more,menu);content.querySelector('.full-feedback').append(wrap);
 menu.append(document.getElementById('fullPlaylist'),document.getElementById('saveOffline'));
 function close(){menu.hidden=true;more.setAttribute('aria-expanded','false');}
 more.onclick=()=>{menu.hidden=!menu.hidden;more.setAttribute('aria-expanded',String(!menu.hidden));};
 full.addEventListener('click',e=>{if(!wrap.contains(e.target))close();});
 menu.addEventListener('click',e=>{if(e.target.closest('button'))close();});
 full.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){e.preventDefault();e.stopPropagation();close();more.focus();}},true);
 function fit(){if(!full.open)return;const css=getComputedStyle(content),children=[...content.children].filter(e=>e!==carousel&&getComputedStyle(e).display!=='none'),gap=parseFloat(css.rowGap)||0;
  const available=content.clientHeight-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom)-children.reduce((sum,e)=>sum+e.getBoundingClientRect().height,0)-gap*children.length;
  content.style.setProperty('--full-cover-fit',Math.max(48,Math.floor(available)-8)+'px');
 }
 new ResizeObserver(fit).observe(content);new ResizeObserver(fit).observe(content.querySelector('.full-player-meta'));new MutationObserver(()=>{fit();if(!full.open)close();}).observe(full,{attributes:true,attributeFilter:['open']});
 window.addEventListener('resize',fit);return {fit};
}
