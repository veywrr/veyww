// Keep vertical scrolling and ordinary taps native; only claim deliberate horizontal gestures.
export function swipeDirection(dx,dy,elapsed){
 if(elapsed>1200||Math.abs(dx)<55||Math.abs(dx)<Math.abs(dy)*1.6)return null;
 return dx<0?'next':'previous';
}
export function setupTrackSwipe(surface,{next,previous,allow=()=>true}){
 let gesture=null,suppressUntil=0;
 surface.style.touchAction='pan-y pinch-zoom';
 surface.addEventListener('touchstart',e=>{
  gesture=null;
  if(e.touches.length!==1||!allow(e.target))return;
  const t=e.touches[0];gesture={id:t.identifier,x:t.clientX,y:t.clientY,time:performance.now()};
 },{passive:true});
 surface.addEventListener('touchmove',e=>{
  if(!gesture)return;
  if(e.touches.length!==1){gesture=null;return;}
  const t=e.touches[0];if(t.identifier!==gesture.id)return;
  const dx=t.clientX-gesture.x,dy=t.clientY-gesture.y;
  if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){gesture=null;return;}
  if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.6&&e.cancelable)e.preventDefault();
 },{passive:false});
 surface.addEventListener('touchend',e=>{
  const g=gesture;gesture=null;if(!g)return;
  const t=Array.from(e.changedTouches).find(t=>t.identifier===g.id);if(!t)return;
  const direction=swipeDirection(t.clientX-g.x,t.clientY-g.y,performance.now()-g.time);
  if(!direction)return;
  suppressUntil=performance.now()+500;
  if(e.cancelable)e.preventDefault();
  (direction==='next'?next:previous)();
 },{passive:false});
 surface.addEventListener('touchcancel',()=>{gesture=null;},{passive:true});
 surface.addEventListener('click',e=>{if(e.isTrusted&&performance.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
}
