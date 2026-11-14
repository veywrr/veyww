import test from 'node:test';
import assert from 'node:assert/strict';
import {swipeDirection,setupTrackSwipe} from '../web/track-swipe.mjs';
test('track swipe requires horizontal intent and ignores taps, scrolling and held gestures',()=>{
 assert.equal(swipeDirection(-90,10,250),'next');
 assert.equal(swipeDirection(90,-10,250),'previous');
 for(const args of [[10,0,100],[80,70,300],[0,120,300],[90,0,1500]])assert.equal(swipeDirection(...args),null);
});
test('touch handlers switch once, protect controls, cancel multitouch and preserve taps',()=>{
 const handlers={},surface={style:{},addEventListener:(name,fn)=>handlers[name]=fn};
 let next=0,previous=0;
 setupTrackSwipe(surface,{next:()=>next++,previous:()=>previous++,allow:t=>t!=='control'});
 const touch=x=>({identifier:1,clientX:x,clientY:100});
 const start=(target='art')=>handlers.touchstart({target,touches:[touch(150)]});
 const end=x=>handlers.touchend({changedTouches:[touch(x)],cancelable:true,preventDefault(){}});
 start();end(50);assert.equal(next,1);
 start();end(250);assert.equal(previous,1);
 start('control');end(50);assert.equal(next,1);
 start();handlers.touchmove({touches:[touch(140),{...touch(130),identifier:2}]});end(50);assert.equal(next,1);
 start();handlers.touchcancel();end(50);assert.equal(next,1);
 start();end(145);assert.equal(next,1);
 let prevented=false;handlers.click({isTrusted:true,preventDefault(){prevented=true;},stopImmediatePropagation(){}});assert.equal(prevented,true);
});
