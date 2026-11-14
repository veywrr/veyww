export function waveEnergy(samples){if(!samples?.length)return 0;let sum=0;for(const x of samples)sum+=((x-128)/128)**2;return Math.min(1,Math.sqrt(sum/samples.length)*3);}
export function setupAudioWave(engine,dialog,enabled){
 const canvas=document.createElement('canvas');canvas.className='audio-wave';canvas.setAttribute('aria-hidden','true');dialog.prepend(canvas);
 const context=canvas.getContext('2d');let frame=0,last=0,smooth=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function visible(){return dialog.open&&dialog.dataset.lyrics!=='true'&&enabled()&&!document.hidden;}
 function draw(time=0){frame=0;if(!visible())return;if(time-last<32&&!reduced.matches){frame=requestAnimationFrame(draw);return;}last=time;
  const width=dialog.clientWidth,height=dialog.clientHeight,ratio=Math.min(1.5,devicePixelRatio||1);
  if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)){canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);}
  context.setTransform(ratio,0,0,ratio,0,0);context.clearRect(0,0,width,height);
  const samples=engine.waveSamples?.(),playing=engine.state().playing;canvas.dataset.mode=samples?'reactive':'ambient';
  const energy=playing?(samples?waveEnergy(samples):.12):0;smooth+=(energy-smooth)*.14;
  context.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--text').trim()||'#aaa';context.lineWidth=1.2;
  const phase=reduced.matches?0:(Number(engine.audio?.currentTime)||0)*1.4,amplitude=height*(.025+smooth*.13),middle=height*.49;
  for(let layer=0;layer<3;layer++){context.globalAlpha=.11-layer*.018;context.beginPath();for(let i=0;i<=100;i++){const x=width*i/100,envelope=Math.sin(Math.PI*i/100)**2,y=middle+Math.sin(i*.15+phase+layer*1.7)*amplitude*envelope*(1-layer*.18);i?context.lineTo(x,y):context.moveTo(x,y);}context.stroke();}
  if(samples){context.globalAlpha=.12;context.lineWidth=1;const step=Math.max(7,width/110);for(let x=0;x<width;x+=step){const at=Math.floor(x/width*samples.length),value=Math.abs((samples[at]-128)/128),bar=(4+value*height*.25)*Math.sin(Math.PI*x/width)**2;context.beginPath();context.moveTo(x,middle-bar);context.lineTo(x,middle+bar);context.stroke();}}
  if(!reduced.matches&&playing)frame=requestAnimationFrame(draw);
 }
 function refresh(){if(frame)cancelAnimationFrame(frame);frame=0;canvas.hidden=!visible();if(visible()){engine.enableWaveAnalysis?.();frame=requestAnimationFrame(draw);}}
 new MutationObserver(refresh).observe(dialog,{attributes:true,attributeFilter:['open','data-lyrics']});document.addEventListener('visibilitychange',refresh);document.addEventListener('veyww:appearance',refresh);window.addEventListener('resize',refresh);reduced.addEventListener('change',refresh);
 return {update(){if(visible()&&!frame)refresh();}};
}
