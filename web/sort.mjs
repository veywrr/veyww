export function sortTracks(tracks,mode='date-desc'){
 const collator=new Intl.Collator('ru',{sensitivity:'base',numeric:true});
 return tracks.map((track,index)=>({track,index})).sort((a,b)=>{
  if(mode==='title-asc'||mode==='title-desc')return (mode==='title-desc'?-1:1)*collator.compare(a.track.title||'',b.track.title||'')||a.index-b.index;
  const left=Number(a.track.addedAt)||0,right=Number(b.track.addedAt)||0,direction=mode==='date-asc'?1:-1;
  return direction*(left-right)||(left===0&&right===0?a.index-b.index:a.index-b.index);
 }).map(x=>x.track);
}
