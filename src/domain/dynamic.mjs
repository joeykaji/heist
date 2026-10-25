import Decimal from './decimal.mjs';
import {candidatePrices, DEFAULT_POLICY} from './decide.mjs';
export {DEFAULT_POLICY};
/** Stock/time controller: no demand forecast or claim of optimized profit. */
export function dynamicPrice(batch, policy = {}) {
 const p={...DEFAULT_POLICY,...policy};
 // Reuse exact economic-floor and boundary validation from the scenario engine.
 const {floor}=candidatePrices(batch,p);
 const available=batch.physical_units-batch.reserved_units-batch.protected_units-batch.buffer_units;
 const result={label:batch.label,available,floor_cents:floor,missing_inputs:[],rows:[],evaluation_completed:false,expected_gain_cents:null,worst_gain_cents:null,price_cents:batch.current_cents};
 const stop=(status,reason)=>({...result,status,reason,price_cents:status==='PAUSE'||status==='REVIEW'?null:batch.current_cents});
 if(!batch.safe_and_approved||!batch.checkout_supported||batch.closed)return stop('PAUSE','Offer is not approved or checkout is unavailable.');
 if(batch.minutes_to_cutoff<=(batch.fulfillment_buffer_minutes??5))return stop('PAUSE','Fulfillment window has closed.');
 if(batch.count_age_minutes>Number(p.max_count_age_minutes))return stop('PAUSE','Inventory observation is too old.');
 if(!available)return stop('PAUSE','No unallocated offer stock.');
 if(floor===null||!batch.economics_reviewed)return {...stop('REVIEW','Reviewed fees and costs are required.'),missing_inputs:['reviewed economics']};
 if(floor>batch.original_cents)return stop('PAUSE','Economic floor exceeds regular price.');
 if(!batch.surplus_eligible)return stop('HOLD','Batch is not surplus eligible.');
 const reference=batch.reference_units??batch.physical_units;
 if(!Number.isSafeInteger(reference)||reference<1)throw new Error('Invalid reference stock.');
 const window=batch.sale_window_minutes??Number(p.window_minutes);
 if(!Number.isFinite(window)||window<=0)throw new Error('Invalid pricing window.');
 const progressExact=Decimal.max(0,Decimal.min(1,new Decimal(1).minus(new Decimal(batch.minutes_to_cutoff).div(window))));
 const progress=progressExact.toNumber();
 const pressure=Math.min(1,available/reference);
 const target=Math.max(floor,Math.min(batch.original_cents,new Decimal(batch.original_cents).times(new Decimal(1).minus(new Decimal(p.max_discount).times(progressExact).times(Decimal.min(1,new Decimal(available).div(reference))))).ceil().toNumber()));
 // Limit an individual adjustment to 5% of regular price, with at least a cent.
 const adjustment=Number(p.max_adjustment??.05);
 if(!Number.isFinite(adjustment)||adjustment<=0||adjustment>.05)throw new Error('Price adjustments must be greater than 0 and at most 5%.');
 const step=Math.max(1,Math.ceil(batch.original_cents*adjustment));
 const price=Math.max(floor,Math.min(batch.original_cents,Math.max(batch.current_cents-step,Math.min(batch.current_cents+step,target))));
 const status=price<batch.current_cents?'MARKDOWN':price>batch.current_cents?'INCREASE':'HOLD';
 return {...result,status,price_cents:price,evaluation_completed:true,target_cents:target,stock_pressure:pressure,window_progress:progress,reason:`${available} of ${reference} reference units available; ${Math.round(progress*100)}% through the pricing window. Target ${(target/100).toFixed(2)}; adjustments limited to ${Math.round(adjustment*100)}% of regular price.`,expected_baseline_leftovers:0};
}
