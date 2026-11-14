import {windowCommand} from './window-motion.mjs';
import {setupAudioWave} from './audio-wave.mjs';
import {artworkURL,loadArtwork} from './artwork-url.mjs';
import {activeLyric} from './lyrics-model.mjs';
import {setupTrackSwipe} from './track-swipe.mjs';
import {setupPlayerRefinements} from './player-refinements.mjs';
const $=id=>document.getElementById(id);
export function setupNowPlaying({state,current,view,engine,neighbors=()=>({})}){
 let generation=0,lastId='',lastArt='',lines=[],active=-2,manualUntil=0,closing=false;
 const full=$('fullPlayer'),body=document.createElement('div');body.className='full-layout';full.append(body);const content=full.querySelector('.full-player-content');body.append(content);
 const audioWave=setupAudioWave(engine,full,()=>state.profile?.audioWave!==false);
 const orb=document.querySelector('.orb'),ns='http://www.w3.org/2000/svg',engraving=document.createElementNS(ns,'svg');engraving.classList.add('record-engraving');engraving.setAttribute('viewBox','0 0 300 300');engraving.setAttribute('aria-hidden','true');const curve=document.createElementNS(ns,'path');curve.id='recordOriginCurve';curve.setAttribute('d','M 48 185 A 108 108 0 0 0 252 185');curve.setAttribute('fill','none');const lettering=document.createElementNS(ns,'text'),arc=document.createElementNS(ns,'textPath');arc.setAttribute('href','#recordOriginCurve');arc.setAttribute('startOffset','50%');lettering.setAttribute('text-anchor','middle');lettering.append(arc);engraving.append(curve,lettering);orb.append(engraving);new MutationObserver(()=>{const label=orb.dataset.origin||'';arc.textContent=label.length>46?label.slice(0,43)+'…':label;lettering.setAttribute('font-size',label.length>28?'10':'13');}).observe(orb,{attributes:true,attributeFilter:['data-origin']});
 // Clone the existing navigation, including its icons and spacing; keep utility links on the home screen.
 const art=$('fullArt'),carousel=document.createElement('div');carousel.className='cover-carousel';art.before(carousel);carousel.append(art);const previews={};for(const side of ['previous','next']){const card=document.createElement('div');card.className='cover-peek '+side;card.setAttribute('aria-hidden','true');card.hidden=true;carousel.append(card);previews[side]=card;}new ResizeObserver(()=>{carousel.style.setProperty('--neighbor-size',art.getBoundingClientRect().width+'px');}).observe(art);
 let gesture=null;full.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'||e.target.closest('button,input,a,.desktop-caption'))return;const box=art.getBoundingClientRect();if(e.clientY>=box.top)return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY};});full.addEventListener('pointerup',e=>{if(!gesture||e.pointerId!==gesture.id)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;gesture=null;if(dy>35&&dy>Math.abs(dx)*1.2)close();});full.addEventListener('pointercancel',()=>{gesture=null;});full.addEventListener('touchmove',e=>{if(!gesture||!e.touches[0])return;const touch=e.touches[0],dy=touch.clientY-gesture.y,dx=touch.clientX-gesture.x;if(dy>8&&dy>Math.abs(dx))e.preventDefault();},{passive:false});
 const refinements=setupPlayerRefinements();
 const original=document.querySelector('body>aside'),nav=original.cloneNode(true);nav.className='full-sidebar';nav.querySelector('.side-bottom')?.remove();for(const e of nav.querySelectorAll('[id]'))e.removeAttribute('id');for(const b of nav.querySelectorAll('[data-view]'))b.onclick=()=>{close();view(b.dataset.view);};body.prepend(nav);
 const swipeActions={next:()=>$('next').click(),previous:()=>$('prev').click()};
 setupTrackSwipe(carousel,swipeActions);
 setupTrackSwipe(document.querySelector('.player'),{...swipeActions,allow:target=>!target.closest('input,select,a,.transport,.volume-control,.player-tools,button:not(#nowArt):not(#nowTitle):not(#nowArtist)')});
 const lyrics=document.createElement('article');lyrics.id='lyricsPanel';lyrics.setAttribute('aria-label','Текст песни');body.append(lyrics);
 const background=document.createElement('div');background.className='full-cover-background';full.prepend(background);
 // Native window actions must live inside the modal top layer to remain interactive.
 const caption=$('desktopCaption');if(caption){const duplicate=caption.cloneNode(true);duplicate.id='fullDesktopCaption';for(const b of duplicate.querySelectorAll('[data-window-action]'))b.onclick=()=>windowCommand(b.dataset.windowAction);full.prepend(duplicate);}
 function alignSidebar(){const css=getComputedStyle(original),height=caption?.getBoundingClientRect().height||0;body.style.setProperty('--full-sidebar-width',original.getBoundingClientRect().width+'px');nav.style.width=original.getBoundingClientRect().width+'px';nav.style.paddingTop=Math.max(0,parseFloat(css.paddingTop)-height)+'px';nav.style.paddingLeft=css.paddingLeft;nav.style.paddingRight=css.paddingRight;const source=original.querySelector('nav'),target=nav.querySelector('nav'),ncss=getComputedStyle(source);target.style.margin=ncss.margin;target.style.gap=ncss.gap;for(const b of target.querySelectorAll('[data-view]')){const old=source.querySelector('[data-view="'+b.dataset.view+'"]'),c=getComputedStyle(old);b.style.padding=c.padding;b.style.font=c.font;b.style.lineHeight=c.lineHeight;b.style.gap=c.gap;b.style.borderRadius=c.borderRadius;}}
 function close(){if(!full.open||closing)return;closing=true;if(matchMedia('(prefers-reduced-motion: reduce)').matches){full.close();closing=false;return;}full.classList.add('closing');setTimeout(()=>{full.close();full.classList.remove('closing');closing=false;},150);}
 $('closeFullPlayer').onclick=close;
 full.addEventListener('cancel',e=>{e.preventDefault();close();});
 full.addEventListener('click',e=>{if(e.target.closest('button,input,a,select,textarea,.full-art,.full-sidebar,.desktop-caption,#lyricsPanel,.track-menu-wrap'))return;if(full.dataset.lyrics==='true'&&e.clientX>=lyrics.getBoundingClientRect().left)return;close();});
 function paint(){const t=current(),near=neighbors();for(const side of ['previous','next']){const neighbor=near[side],card=previews[side],key=neighbor?.id||'';card.hidden=!neighbor;if(card.dataset.track!==key){card.dataset.track=key;card.replaceChildren();if(neighbor&&artworkURL(neighbor))card.append(loadArtwork(new Image(),neighbor));}}if(carousel.dataset.track!==t?.id){const oldId=carousel.dataset.track,dir=near.next?.id===oldId?-1:1;carousel.dataset.track=t?.id||'';if(oldId&&full.open&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const ghost=art.cloneNode(true);ghost.removeAttribute('id');ghost.className='cover-transition';ghost.setAttribute('aria-hidden','true');ghost.style.width=art.getBoundingClientRect().width+'px';carousel.append(ghost);ghost.animate([{opacity:1,transform:'translateX(0)'},{opacity:0,transform:'translateX('+(-dir*75)+'px) scale(.94)'}],{duration:480,easing:'cubic-bezier(.2,.7,.2,1)'}).finished.finally(()=>ghost.remove());art.animate([{opacity:0,transform:'translateX('+(dir*75)+'px) scale(.96)'},{opacity:1,transform:'translateX(0) scale(1)'}],{duration:520,easing:'cubic-bezier(.2,.7,.2,1)'});}}const url=artworkURL(t),hero=document.querySelector('.hero');hero.classList.toggle('cover-style',Boolean(url&&state.profile?.coverStyle!==false));hero.style.setProperty('--cover-art',url?'url('+JSON.stringify(url)+')':'none');background.style.backgroundImage=url?'url('+JSON.stringify(url)+')':'none';const core=document.querySelector('.orb-core');if(url!==lastArt){core.replaceChildren();if(url)core.append(loadArtwork(new Image(),t));lastArt=url;}}
 let centeredLyric=-2;
 function playback(s){
  audioWave.update();
  if(!lines.length)return;
  const next=activeLyric(lines,Number(s.position)||0);
  const follow=full.open&&Date.now()>manualUntil&&centeredLyric!==next;
  if(next===active&&!follow)return;
  const rows=lyrics.querySelectorAll('.lyric-line');
  if(next!==active){
   active=next;
   for(const [i,row] of rows.entries()){
    const distance=Math.abs(i-Math.max(0,active));
    row.dataset.distance=String(Math.min(3,distance));
    row.classList.toggle('past',i<active);
    row.classList.toggle('current',i===active);
    row.setAttribute('aria-current',String(i===active));
   }
  }
  if(follow&&rows[Math.max(0,active)]&&lyrics.clientHeight>0){
   const bounds=lyrics.getBoundingClientRect(),line=rows[Math.max(0,active)].getBoundingClientRect();
   const top=lyrics.scrollTop+line.top+line.height/2-bounds.top-lyrics.clientHeight*.43;
   lyrics.scrollTo({top:Math.max(0,top),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
   centeredLyric=next;
  }
 }
 for(const event of ['wheel','touchstart'])lyrics.addEventListener(event,()=>{manualUntil=Date.now()+6000;centeredLyric=-2;},{passive:true});
 async function loadLyrics(){const t=current();if(!t||lastId===t.id)return;lastId=t.id;lines=[];active=-2;centeredLyric=-2;manualUntil=0;lyrics.scrollTop=0;const token=++generation;full.dataset.lyrics='false';lyrics.replaceChildren();paint();
 try{let title=t.title||'',artist=t.artist||'';const parts=title.split(/\s+[—–-]\s+/);if(parts.length>1&&parts[0].length<65){artist=parts.shift();title=parts.join(' ');}const q=new URLSearchParams({title,artist,duration:String(t.duration||0)});const r=await fetch('/lyrics?'+q,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();const data=await r.json();if(token!==generation)return;if(data.text||data.lines?.length){lines=Array.isArray(data.lines)?data.lines.filter(x=>Number.isFinite(x.time)&&typeof x.text==='string'):[];const paragraphs=lines.length?lines:String(data.text).split('\n').map(text=>({text}));for(const line of paragraphs){const row=document.createElement('p');row.className='lyric-line';row.textContent=line.text;lyrics.append(row);}full.dataset.lyrics='true';full.dataset.timedLyrics=String(Boolean(lines.length));const source=document.createElement('a');source.href='https://lrclib.net';source.textContent=lines.length?'Текст · LRCLIB':'Текст · LRCLIB · без таймингов';source.target='_blank';source.rel='noreferrer';lyrics.append(source);playback(engine.state());}else full.dataset.lyrics='false';}catch{if(token===generation)full.dataset.lyrics='false';}}
 document.addEventListener('veyww:appearance',paint);document.addEventListener('veyww:artwork',event=>{if(event.detail?.art===current()?.art)paint();});
 window.addEventListener('resize',()=>{if(full.open)alignSidebar();});
 return {playback,update(){paint();if(full.open)loadLyrics();},open(){closing=false;full.classList.remove('closing');paint();alignSidebar();for(const b of nav.querySelectorAll('[data-view]'))b.classList.toggle('active',Boolean(original.querySelector('[data-view="'+b.dataset.view+'"].active')));loadLyrics();requestAnimationFrame(()=>{refinements.fit();centeredLyric=-2;playback(engine.state());});},close};
}
