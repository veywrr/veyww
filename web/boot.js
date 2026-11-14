/* Runs independently from ES modules so a failed module cannot leave a blank page. */
(function(){
 var ready=false,timer,last='';
 function show(reason){if(ready)return;last=String(reason||'Интерфейс не загрузился вовремя').slice(0,240);var panel=document.getElementById('bootStatus');if(panel){panel.hidden=false;document.getElementById('bootReason').textContent=last;}}
 window.addEventListener('veyww:ready',function(){ready=true;clearTimeout(timer);var panel=document.getElementById('bootStatus');if(panel)panel.hidden=true;});
 window.addEventListener('error',function(event){if(event.message)show(event.message);},true);
 window.addEventListener('unhandledrejection',function(event){if(!ready&&event.reason)show(event.reason.message||'Не удалось загрузить интерфейс');});
 function init(){var retry=document.getElementById('bootRetry');if(retry)retry.onclick=function(){location.reload();};timer=setTimeout(function(){show();},15000);}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
