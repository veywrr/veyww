function createPool(run,{concurrency=4,maxQueue=80,maxPerClient=12}={}){
 let active=0;const waiting=[],clients=new Map();
 const busy=()=>Object.assign(Error('Источник занят. Повтори через несколько секунд.'),{status:429});
 function pump(){while(active<concurrency&&waiting.length){waiting.sort((a,b)=>a.priority-b.priority||a.at-b.at);const task=waiting.shift();active++;Promise.resolve().then(()=>run(...task.args)).then(task.resolve,task.reject).finally(()=>{active--;const left=clients.get(task.client)-1;if(left)clients.set(task.client,left);else clients.delete(task.client);pump();});}}
 return function schedule(mode,value,offset=0,client='local'){
 if(waiting.length>=maxQueue||(clients.get(client)||0)>=maxPerClient)return Promise.reject(busy());
 clients.set(client,(clients.get(client)||0)+1);return new Promise((resolve,reject)=>{waiting.push({args:[mode,value,offset],client,priority:mode.startsWith('resolve')?0:mode==='artists'||mode==='artist'?1:2,at:Date.now(),resolve,reject});pump();});
 };
}
function clientAddress(req,trustProxy=false){const peer=req.socket.remoteAddress||'';const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer);if(trustProxy&&local){const value=String(req.headers['x-forwarded-for']||'').split(',').map(x=>x.trim()).filter(Boolean).at(-1);if(value&&require('node:net').isIP(value))return value;}return peer;}
module.exports={createPool,clientAddress};
