import {identity,fold} from './mix.mjs';
export function recording(t){const item=identity(t),title=item.key.slice(item.key.indexOf('|')+1).replace(/\b(?:official audio|official video|music video|lyrics|lyric video|audio|visualizer)\b/g,'').replace(/\s+/g,' ').trim();return {artist:item.artist,title,key:item.artist+'|'+title,duration:Number(t.duration)||0,id:t.id,page:String(t.page||'').replace(/\?.*$/,'')};}
export function sameRecording(a,b){if(a.id&&a.id===b.id||a.page&&a.page===b.page||a.key===b.key)return true;return a.title.length>=8&&a.title===b.title&&a.duration>0&&b.duration>0&&Math.abs(a.duration-b.duration)<=3;}
export function uniqueRecordings(tracks,exclude=[]){const seen=exclude.map(recording),out=[];for(const t of tracks){if(!t?.id)continue;const item=recording(t);if(seen.some(old=>sameRecording(item,old)))continue;seen.push(item);out.push(t);}return out;}
export function downloadTitle(track){return recording(track).title||fold(track.title);}
