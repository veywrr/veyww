let minimizing=false;
export function windowCommand(action){
 const bridge=window.veywDesktop;if(!bridge?.windowCommand)return;
 if(action!=='minimize'||matchMedia('(prefers-reduced-motion: reduce)').matches){bridge.windowCommand(action);return;}
 if(minimizing)return;minimizing=true;
 document.body.classList.remove('window-restoring');document.body.classList.add('window-minimizing');
 setTimeout(()=>{bridge.windowCommand(action);setTimeout(()=>{document.body.classList.remove('window-minimizing');minimizing=false;},100);},620);
}
export function restoreMotion(){minimizing=false;document.body.classList.remove('window-minimizing','window-restoring');void document.body.offsetWidth;document.body.classList.add('window-restoring');setTimeout(()=>document.body.classList.remove('window-restoring'),680);}
