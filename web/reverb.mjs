// A diffuse stereo tail, without isolated high-amplitude early echoes.
export function roomImpulse(context,random=Math.random){
 const rate=context.sampleRate,buffer=context.createBuffer(2,Math.ceil(rate*4.2),rate),pre=Math.floor(rate*.024),damping=Math.exp(-2*Math.PI*2400/rate);
 for(let channel=0;channel<2;channel++){
  const data=buffer.getChannelData(channel);let low=0,energy=0;
  for(let i=pre;i<data.length;i++){const t=(i-pre)/rate;low=damping*low+(1-damping)*(random()*2-1);const attack=1-Math.exp(-t/.065),decay=Math.exp(-t*1.6);data[i]=low*attack*decay;energy+=data[i]*data[i];}
  // Keep wet gain consistent between devices and sample rates.
  const gain=Math.sqrt(.55/Math.max(energy,.000001));for(let i=pre;i<data.length;i++)data[i]*=gain;
 }
 return buffer;
}
export function reverbLevels(amount,mobile=false){const mix=Math.max(0,Math.min(1,Number(amount)||0));return mobile?{wet:Math.sin(Math.pow(mix,.75)*Math.PI/2)*1.12,dry:1-mix*.28}:{wet:Math.sin(mix*Math.PI/2)*.78,dry:1-mix*.18};}
