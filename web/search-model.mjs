import {fold,identity} from './mix.mjs';
const ru='йцукенгшщзхъфывапролджэячсмитьбю',en="qwertyuiop[]asdfghjkl;'zxcvbnm,.";
const roman={а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
function distance(a,b){let previous=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const row=[i];for(let j=1;j<=b.length;j++)row[j]=Math.min(row[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]!==b[j-1]));previous=row;}return previous[b.length];}
export function correctArtistQuery(query,artists=[]){const words=fold(query).split(' ');let best=null;for(const artist of artists){const name=typeof artist==='string'?artist:artist.name;if(!name)continue;const parts=fold(name).split(' '),a=parts.join(''),b=words.slice(0,parts.length).join('');if(a===b)return '';if(a.length<4||Math.abs(a.length-b.length)>2)continue;const d=distance(a,b),max=a.length>=7?2:1;if(d>max)continue;const score=d/Math.max(a.length,b.length);if(!best||score<best.score)best={score,text:[name,...words.slice(parts.length)].join(' ')};}return best?.text||'';}
export function searchQueries(value,artists=[]){
 const original=String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').slice(0,200);
 if(!original)return [];
 const lower=original.toLowerCase(),cyr=/[а-яё]/i.test(lower),from=cyr?ru:en,to=cyr?en:ru;
 const layout=[...lower].map(c=>from.includes(c)?to[from.indexOf(c)]:c).join('');
 const translit=[...lower].map(c=>roman[c]??c).join('');
 return [...new Set([original,correctArtistQuery(original,artists),layout,...cyr?[translit]:[]])].filter(Boolean);
}
export function searchScore(track,query){
 const q=fold(query),title=fold(track.title),artist=fold(track.artist),both=artist+' '+title,tokens=q.split(' ').filter(Boolean);
 const matches=tokens.filter(t=>both.includes(t)).length;
 return (title===q?100:0)+(artist===q?65:0)+(tokens.length?matches/tokens.length*45:0)+(both.includes(q)?15:0)+Math.min(5,Math.log10(1+(Number(track.plays)||0)));
}
export function rankSearch(tracks,query,alternatives=[]){const score=t=>Math.max(...[query,...alternatives].map(q=>searchScore(t,q)));return [...new Map(tracks.filter(t=>t?.id).map(t=>[t.id,t])).values()].sort((a,b)=>score(b)-score(a));}
export function versionName(track){const s=fold(track.title);return /slowed|замедл/.test(s)?'Slowed'+(/reverb/.test(s)?' + reverb':''):/sped|speed up|ускор/.test(s)?'Sped up':/remix|ремикс|edit|bootleg/.test(s)?'Ремикс / edit':/live|концерт/.test(s)?'Концертная версия':'Без пометки версии';}
export function groupVersions(tracks){
 const groups=new Map();for(const t of tracks){const title=String(t.title||'').replace(/\([^)]*(?:remix|edit|bootleg|live)[^)]*\)|\[[^\]]*(?:remix|edit|bootleg|live)[^\]]*\]/gi,'');const key=identity({...t,title}).key;let group=groups.get(key);if(!group)groups.set(key,group={key,tracks:[]});group.tracks.push(t);}return [...groups.values()];
}
export function suggestions(query,history=[],artists=[]){const q=fold(query),corrected=correctArtistQuery(query,artists);return [...new Set([corrected,...artists.map(a=>typeof a==='string'?a:a.name),...history])].filter(s=>s&&(fold(s).includes(q)||s===corrected)&&fold(s)!==q).slice(0,6);}
