import {catalogFor,productView,hoursFor,pricingFor} from './model.mjs';

export function sustainabilityReport(s){
 const remaining=s.batches.reduce((total,b)=>total+b.physical_units,0);
 const outcomes=[
  {key:'discounted',label:'Sold at a Discount',count:s.surplusSold},
  {key:'regular',label:'Sold at Regular Price',count:s.sold-s.surplusSold},
  {key:'remaining',label:'Still in the Case',count:remaining},
  {key:'transferred',label:'Transferred',count:s.transferred},
  {key:'retained',label:'Retained at Close',count:s.retained},
  {key:'discarded',label:'Discarded',count:s.discarded}
 ];
 const accounted=outcomes.reduce((total,o)=>total+o.count,0);
 const offers=catalogFor(s).map(p=>productView(s,p.id)).filter(p=>p.quantity>0&&p.saving>0).sort((a,b)=>b.discount-a.discount||a.name.localeCompare(b.name));
 return {remaining,outcomes,accounted,sellThrough:accounted?100*s.sold/accounted:0,offers,
  savings:s.savings?.cents??0,savingsComplete:(s.savings?.units??0)===s.sold,
  closed:s.minute>=hoursFor(s).close,pricing:pricingFor(s.settings)};
}
