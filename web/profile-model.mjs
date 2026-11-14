const count=n=>Math.max(0,Math.min(10000000,Math.floor(Number(n)||0)));
const text=(s,n=300)=>String(s||'').slice(0,n);
export function dateKey(date=new Date()){return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');}
export function sanitizeStats(value={},now=Date.now()){
 const cutoff=new Date(now-400*86400000).toISOString().slice(0,10),today=new Date(now+86400000).toISOString().slice(0,10),devices={};
 for(const [id,raw] of Object.entries(value?.devices||{}).slice(0,12)){
  if(!/^[a-f0-9-]{16,64}$/.test(id)||!raw||typeof raw!=='object')continue;
  const days=Object.fromEntries(Object.entries(raw.days||{}).filter(([day])=>/^\d{4}-\d{2}-\d{2}$/.test(day)&&day>=cutoff&&day<=today).slice(-401).map(([day,n])=>[day,count(n)]));
  const tracks=Object.fromEntries(Object.entries(raw.tracks||{}).slice(0,500).filter(([id,t])=>id.length<=300&&t&&typeof t==='object').map(([id,t])=>[id,{id,title:text(t.title),artist:text(t.artist),count:count(t.count),at:Math.min(now,Math.max(0,Number(t.at)||0))}]));
  devices[id]={days,tracks};
 }
 return {devices};
}
export function mergeStats(left={},right={}){
 const a=sanitizeStats(left),b=sanitizeStats(right),devices={};
 for(const id of new Set([...Object.keys(a.devices),...Object.keys(b.devices)])){
  const x=a.devices[id]||{days:{},tracks:{}},y=b.devices[id]||{days:{},tracks:{}};
  const days=Object.fromEntries([...new Set([...Object.keys(x.days),...Object.keys(y.days)])].map(day=>[day,Math.max(x.days[day]||0,y.days[day]||0)]));
  const tracks={};for(const key of new Set([...Object.keys(x.tracks),...Object.keys(y.tracks)])){const p=x.tracks[key],q=y.tracks[key];tracks[key]={...(p?.at>q?.at?p:q||p),count:Math.max(p?.count||0,q?.count||0)};}
  devices[id]={days,tracks:Object.fromEntries(Object.entries(tracks).sort(([,a],[,b])=>b.count-a.count||b.at-a.at).slice(0,500))};
 }
 return sanitizeStats({devices});
}
export function addListen(stats,device,track,now=new Date()){
 const next=sanitizeStats(stats,now.getTime());if(!next.devices[device]&&Object.keys(next.devices).length>=12)throw Error('Достигнут лимит устройств статистики');
 const data=next.devices[device]||{days:{},tracks:{}},day=dateKey(now);data.days[day]=(data.days[day]||0)+1;
 const old=data.tracks[track.id];data.tracks[track.id]={id:track.id,title:track.title,artist:track.artist,count:(old?.count||0)+1,at:now.getTime()};
 data.tracks=Object.fromEntries(Object.entries(data.tracks).sort(([,a],[,b])=>b.count-a.count||b.at-a.at).slice(0,500));next.devices[device]=data;return next;
}
export function profileSummary(stats,now=new Date()){
 const day=dateKey(now),month=day.slice(0,7),year=day.slice(0,4),totals={day:0,month:0,year:0},tracks=new Map();
 for(const data of Object.values(sanitizeStats(stats).devices)){
  for(const [key,n] of Object.entries(data.days)){if(key===day)totals.day+=n;if(key.startsWith(month))totals.month+=n;if(key.startsWith(year))totals.year+=n;}
  for(const track of Object.values(data.tracks)){const old=tracks.get(track.id);tracks.set(track.id,{...track,count:(old?.count||0)+track.count});}
 }
 return {...totals,top:[...tracks.values()].sort((a,b)=>b.count-a.count).slice(0,20)};
}
export class ListeningCounter{
 constructor(record){this.record=record;this.reset();}
 reset(){this.id=null;this.last=null;this.seconds=0;this.counted=false;}
 update(track,state,now=Date.now()){
  if(!track?.id)return this.reset();const position=Number(state.position)||0;
  if(this.id!==track.id||this.last&&position<this.last.position-3){this.reset();this.id=track.id;}
  const previous=this.last;this.last={at:now,position,playing:state.playing};
  if(!previous||this.counted||!state.playing||!previous.playing)return;
  const elapsed=(now-previous.at)/1000,advance=position-previous.position;
  if(elapsed>0&&elapsed<=5&&advance>0&&advance<=elapsed*2.2+1)this.seconds+=elapsed;
  const duration=Number(state.duration)||Number(track.duration)||0,threshold=duration?Math.max(5,Math.min(30,duration/2)):30;
  if(this.seconds>=threshold){this.counted=true;this.record(track);}
 }
}
