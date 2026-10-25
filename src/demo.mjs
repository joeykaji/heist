import {initialState,advance,sell} from '../dist/model.mjs';
let s=advance(initialState('opening'),240);
console.log('SIMULATION ONLY: stock/time pricing, every 30 simulated minutes.');
const show=()=>console.log({minute:s.minute,price:s.batches[0].current_cents,available:s.batches[0].physical_units-s.batches[0].reserved_units});
show();s=sell(s,'southwest');s=sell(s,'southwest');show();s=advance(s,30);show();
