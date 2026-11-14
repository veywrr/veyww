import {identity,fold,repeatDelay} from './mix.mjs';
export function discoveryBalance(value=.5){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):.5;}
export function discoverySlot(index,balance=.5){
 const b=discoveryBalance(balance),phase=index%20;
 // Space discovery tracks throughout the queue, starting with the first track.
 const fresh=Math.round(b<=.5?2+4*b:4+24*(b-.5)),familiar=Math.round(9*(1-b));
 if([0,3,7,11,15,18,1,5,9,13,17,4,8,12,16,19].slice(0,fresh).includes(phase))return 'discovery';
 const known=[2,6,10,14,19,1,17].slice(0,familiar);return known.includes(phase)?'familiar':'similar';
}
export function recommendationReason(track,likes=[]){const key=identity(track).key;if(likes.some(t=>identity(t).key===key))return 'Из твоей музыки';if(track.relatedTaste)return 'Похожие на понравившиеся';return 'Новое в твоём вкусе';}
export function artistBlocked(track,blocked=[]){return blocked.map(fold).includes(identity(track).artist);}
export function positiveSeeds(likes=[],events=[],now=Date.now()){
 const rejected=new Set(events.filter(e=>['dislike','skipEarly'].includes(e.action)&&now-e.at<86400000).map(e=>identity(e.track||{}).key));
 const learned=events.filter(e=>['complete','playlist','replay'].includes(e.action)&&e.track?.page&&now-e.at<21*86400000&&!rejected.has(identity(e.track).key)).sort((a,b)=>b.at-a.at).map(e=>e.track);
 return [...new Map([...learned.slice(0,24),...likes.slice(-48)].filter(t=>t?.page&&!rejected.has(identity(t).key)).map(t=>[identity(t).key,t])).values()].slice(-60);
}
export function familiarCandidates(likes=[],history={},exposure={},round=0,now=Date.now()){
 const pool=likes.filter(t=>{if(t.source!=='SoundCloud'||!t.page)return false;const k=identity(t).key,last=Math.max(history[t.id]||0,exposure[k]||0);return !last||now-last>=repeatDelay(k,last);}).sort((a,b)=>(history[a.id]||0)-(history[b.id]||0));
 if(!pool.length)return [];const start=(round*15)%pool.length;return [...pool.slice(start),...pool.slice(0,start)].slice(0,60);
}
