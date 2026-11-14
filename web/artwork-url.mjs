const preferred=new Map();
export function artworkURL(track,origin=location.origin){
 const value=String(track?.art||'');if(!value)return '';
 try{const u=new URL(value,origin);if(u.username||u.password)return '';if(u.protocol==='https:'&&/^i[1-4]\.sndcdn\.com$/.test(u.hostname)&&(!u.port||u.port==='443'))return preferred.get(value)||u.href;if(u.origin===origin&&/^\/(?:artwork|offline\/audio\/|assets\/)/.test(u.pathname))return u.href;if(u.protocol==='https:'||u.protocol==='blob:'||/^data:image\/(?:png|jpeg|webp);base64,/.test(value))return value;}catch{}return '';
}
export function loadArtwork(image,track,origin=globalThis.location?.origin||'https://veyww.space'){
 const original=String(track?.art||''),url=artworkURL(track,origin);image.alt='';image.decoding='async';image.referrerPolicy='no-referrer';let attempts=0;
 const proxy=/^https:\/\/i[1-4]\.sndcdn\.com\//.test(original)?'/artwork?url='+encodeURIComponent(original):'';
 image.onerror=()=>{if(attempts++<1&&proxy){image.hidden=false;image.src=url.startsWith('/artwork?')?original:proxy;}else image.hidden=true;};
 image.onload=()=>{if(proxy&&preferred.get(original)!==image.getAttribute('src')){preferred.set(original,image.getAttribute('src'));while(preferred.size>150)preferred.delete(preferred.keys().next().value);globalThis.document?.dispatchEvent(new CustomEvent('veyww:artwork',{detail:{art:original}}));}};
 image.src=url;return image;
}
