export class PlaybackOrder{
 constructor(random=Math.random){this.random=random;this.visited=new Set();this.history=[];this.preview=null;}
 reset(){this.visited.clear();this.history=[];this.preview=null;}
 key(tracks,current,modes,automatic){return JSON.stringify([tracks.map(t=>t.id),current,modes.shuffle||false,modes.repeat||'off',modes.repeat==='one'&&automatic,[...this.visited]]);}
 peekNext(tracks,current,modes={},automatic=false){const key=this.key(tracks,current,modes,automatic);if(this.preview?.key===key)return this.preview.target;const clone=new PlaybackOrder(this.random);clone.visited=new Set(this.visited);clone.history=[...this.history];const target=clone.next(tracks,current,modes,automatic);this.preview={key,target};return target;}
 next(tracks,current,{shuffle=false,repeat='off'}={},automatic=false){const cached=this.preview?.key===this.key(tracks,current,{shuffle,repeat},automatic)?this.preview.target:null;this.preview=null;
  if(!tracks.length)return -1;if(automatic&&repeat==='one')return current;
  let next=-1;
  if(shuffle){if(tracks[current])this.visited.add(tracks[current].id);let choices=tracks.map((t,i)=>({id:t.id,i})).filter(t=>t.i!==current&&!this.visited.has(t.id));
   if(!choices.length&&repeat==='all'){this.visited.clear();if(tracks[current])this.visited.add(tracks[current].id);choices=tracks.map((t,i)=>({id:t.id,i})).filter(t=>t.i!==current);}
   if(choices.length)next=cached!==null&&choices.some(x=>x.i===cached)?cached:choices[Math.min(choices.length-1,Math.floor(this.random()*choices.length))].i;else if(repeat==='all')next=current;
  }else next=current+1<tracks.length?current+1:repeat==='all'?0:-1;
  if(next>=0&&next!==current&&tracks[current])this.history.push(tracks[current].id);return next;
 }
 previous(tracks,current){while(this.history.length){const id=this.history.pop(),index=tracks.findIndex(t=>t.id===id);if(index>=0)return index;}return current>0?current-1:-1;}
}
