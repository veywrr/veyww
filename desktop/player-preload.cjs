const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('veywDesktop',{
 downloadPreferences:(owner,patch)=>ipcRenderer.invoke('player:download-preferences',owner,patch),
 downloadRecord:(track,owner,session,wave)=>ipcRenderer.invoke('player:download-record',track,owner,session,wave),
 offlineList:owner=>ipcRenderer.invoke('player:offline-list',owner),
 offlineSave:(track,owner)=>ipcRenderer.invoke('player:offline-save',track,owner),
 offlineRemove:(key,owner)=>ipcRenderer.invoke('player:offline-remove',key,owner),
 overlayPreferences:patch=>ipcRenderer.invoke('player:overlay-preferences',patch),
 appearanceVersion:process.platform==='win32'?1:0,
 appearance:data=>ipcRenderer.send('player:appearance',data),
 windowCommand:command=>ipcRenderer.send('player:window-command',command),
 onWindowMotion:callback=>{if(typeof callback==='function')ipcRenderer.on('player:window-motion',(_event,motion)=>callback(motion));},
 onAppearance:callback=>{if(typeof callback==='function')ipcRenderer.on('player:appearance-status',(_event,status)=>callback(status));},
 update:state=>ipcRenderer.send('player:state',state),
 showOverlay:()=>ipcRenderer.send('player:show'),
 onCommand:callback=>{if(typeof callback==='function')ipcRenderer.on('player:command',(_event,command)=>callback(command));}
});
