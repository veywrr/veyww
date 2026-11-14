// Electron must know the shape too: an external HWND region alone leaves its compositor rectangular.
function overlayShape(width=280,height=52,padding=4){
 const r=(height-padding*2)/2,rects=[];
 for(let y=padding;y<height-padding;y++){
  const dy=Math.abs(y+.5-height/2),inset=r-Math.sqrt(Math.max(0,r*r-dy*dy)),x=Math.ceil(padding+inset);
  rects.push({x,y,width:Math.max(1,width-x*2),height:1});
 }
 return rects;
}
module.exports={overlayShape};
