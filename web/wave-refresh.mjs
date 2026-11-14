// Every explicit Play click owns a fresh request; stale batches cannot replace it.
export class WaveRefresh{
 constructor(){this.generation=0;this.pending=null;}
 begin(){return ++this.generation;}
 current(token){return token===this.generation;}
}
