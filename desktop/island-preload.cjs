const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('island',{
 command:command=>ipcRenderer.send('island:command',command),
 ready:()=>ipcRenderer.send('island:ready'),
 onState:callback=>ipcRenderer.on('island:state',(_event,state)=>callback(state))
});
