import Decimal from './vendor/decimal.mjs';
Decimal.set({precision:40});
const D=x=>new Decimal(x), n=x=>x.toNumber(), own=(o,k)=>o&&Object.hasOwn(o,k);
export const DEFAULT_POLICY={discounts:['0','.15','.30','.45'],max_discount:'.45',window_minutes:120,min_gain_cents:50,downside_budget_cents:0,min_incremental_sales:0,max_markdowns:1,max_count_age_minutes:30};
function count(x,name,optional=false){if(optional&&x==null)return;if(!Number.isSafeInteger(x)||x<0)throw new Error('Invalid '+name);}
function decimal(x,name,negative=false){try{const d=D(x);if(!d.isFinite()||!negative&&d.lt(0))throw 0;return d;}catch{throw new Error('Invalid '+name);}}
export function candidatePrices(b,p=DEFAULT_POLICY){
 const floorInputs=['fee_fraction','sale_cost_cents','order_fee_cents','min_unit_contribution_cents','merchant_floor_cents'];
 if(floorInputs.some(k=>b[k]==null))return {floor:null,prices:[]};
 const f=D(b.fee_fraction);
 const floor=n(Decimal.max(1,b.merchant_floor_cents,D(b.original_cents).times(D(1).minus(p.max_discount)),D(b.sale_cost_cents).plus(b.order_fee_cents).plus(b.min_unit_contribution_cents).div(D(1).minus(f))).ceil());
 const prices=[...new Set([b.current_cents,...p.discounts.map(d=>n(D(b.original_cents).times(D(1).minus(d)).ceil()))])].filter(x=>x>=floor&&x<=b.current_cents).sort((a,b)=>b-a);
 return {floor,prices};
}
export function decide(input,scenarios=[],policy={}){
 const p={...DEFAULT_POLICY,...policy},b={min_unit_contribution_cents:0,merchant_floor_cents:1,minutes_to_cutoff:0,fulfillment_buffer_minutes:5,count_age_minutes:0,markdowns_used:0,window_committed:false,...input};
 for(const key of ['original_cents','current_cents','physical_units','reserved_units','protected_units','buffer_units','min_unit_contribution_cents','merchant_floor_cents','count_age_minutes','markdowns_used'])count(b[key],key);
 if(!b.original_cents||!b.current_cents||b.current_cents>b.original_cents)throw new Error('Invalid regular/current price.');
 if(!Number.isFinite(b.minutes_to_cutoff))throw new Error('Invalid remaining time.');
 for(const key of ['sale_cost_cents','order_fee_cents','activation_cents','capacity_units'])count(b[key],key,true);
 for(const key of ['safe_and_approved','checkout_supported','surplus_eligible','demand_reviewed','economics_reviewed','window_committed'])if(b[key]!=null&&typeof b[key]!=='boolean')throw new Error('Invalid '+key);
 if(b.fee_fraction!=null&&(decimal(b.fee_fraction,'fee_fraction').gte(1)))throw new Error('Fee fraction must be below one.');
 for(const key of ['window_minutes','min_gain_cents','downside_budget_cents','max_count_age_minutes'])count(p[key],key);
 decimal(p.min_incremental_sales,'min_incremental_sales');decimal(b.fulfillment_buffer_minutes,'fulfillment_buffer_minutes');
 if(![0,1].includes(p.max_markdowns))throw new Error('Only 0 or 1 markdown is supported.');
 const max=decimal(p.max_discount,'max_discount');if(max.gte(1)||!Array.isArray(p.discounts))throw new Error('Invalid discount policy.');
 for(const d of p.discounts)if(decimal(d,'discount').gt(max))throw new Error('Discount exceeds policy.');
 const Q=b.physical_units-b.reserved_units-b.protected_units-b.buffer_units;if(Q<0)throw new Error('Allocations exceed physical stock.');
 const {floor,prices}=candidatePrices(b,p);
 const result={label:b.label,status:'HOLD',reason:'',price_cents:b.current_cents,available:Q,floor_cents:floor,evaluation_completed:false,missing_inputs:[],expected_gain_cents:null,worst_gain_cents:null,rows:[]};
 const early=(status,reason,missing=[])=>({...result,status,reason,missing_inputs:missing,price_cents:['PAUSE','REVIEW'].includes(status)?null:b.current_cents});
 if(!b.safe_and_approved)return early('PAUSE','Sale approval absent.');
 if(b.minutes_to_cutoff<=b.fulfillment_buffer_minutes)return early('PAUSE','Fulfillment window has closed.');
 if(b.count_age_minutes>p.max_count_age_minutes)return early('PAUSE','Inventory observation is too old.');
 if(!b.checkout_supported)return early('PAUSE','Checkout cannot execute this offer.');
 if(floor!==null&&b.current_cents<floor)return early('PAUSE','Confirmed price is below the floor.');
 if(Q===0)return early('PAUSE','No unallocated offer stock.');
 if(!b.surplus_eligible)return early('HOLD','Batch is not surplus eligible.');
 if(b.minutes_to_cutoff>p.window_minutes)return early('HOLD','Outside the 120-minute review window.');
 if(b.window_committed)return early('HOLD','This batch/window decision is already committed.');
 if(b.markdowns_used>=p.max_markdowns)return early('HOLD','Markdown limit reached.');
 const missing=['fee_fraction','sale_cost_cents','order_fee_cents','activation_cents'].filter(k=>b[k]==null);
 if(!b.demand_reviewed)missing.push('demand_reviewed');if(!b.economics_reviewed)missing.push('economics_reviewed');
 if(!Array.isArray(scenarios)||!scenarios.length)missing.push('scenarios');
 if(missing.length)return early('REVIEW','Reviewed evidence is incomplete.',missing);
 let sum=D(0);
 for(const [i,s] of scenarios.entries()){
  const w=decimal(s.weight,'scenario weight');if(w.lte(0))throw new Error('Weights must be positive.');sum=sum.plus(w);
  count(s.capacity_units,'scenario capacity',true);
  if(s.terminal_value_cents==null)missing.push(i+'.terminal_value_cents');else decimal(s.terminal_value_cents,'terminal value',true);
  for(const price of prices){
   if(!own(s.demand,price))missing.push(i+'.demand.'+price);else count(s.demand[price],'demand');
   if(!own(s.other_loss_cents,price))missing.push(i+'.other_loss.'+price);else{const loss=decimal(s.other_loss_cents[price],'outside loss');if(price===b.current_cents&&!loss.isZero())throw new Error('Baseline outside loss must equal zero.');}
   if(own(s.orders,price)){count(s.orders[price],'orders');if(own(s.demand,price)&&s.orders[price]>Math.min(Q,b.capacity_units??Q,s.capacity_units??Q,s.demand[price]))throw new Error('Orders exceed fulfilled units.');}
   else if(b.order_fee_cents>0)missing.push(i+'.orders.'+price);
  }
 }
 if(sum.minus(1).abs().gt('0.000000001'))throw new Error('Scenario weights must sum to one.');
 if(missing.length)return early('REVIEW','Complete scenario entries are required.',missing);
 const weights=scenarios.map(s=>D(s.weight).div(sum)),fee=D(1).minus(b.fee_fraction);
 function outcomes(price){return scenarios.map(s=>{
  const q=Math.min(Q,b.capacity_units??Q,s.capacity_units??Q,s.demand[price]),orders=s.orders?.[price]??0;
  const value=fee.times(price).minus(b.sale_cost_cents).times(q).minus(D(b.order_fee_cents).times(orders)).plus(D(s.terminal_value_cents).times(Q-q)).minus(price<b.current_cents?b.activation_cents:0).minus(s.other_loss_cents[price]);
  return {q,value};
 });}
 const baseline=outcomes(b.current_cents);
 const weighted=values=>values.reduce((v,x,i)=>v.plus(D(x).times(weights[i])),D(0));
 const baseSales=weighted(baseline.map(x=>x.q)),left=D(Q).minus(baseSales);
 let selected=null;
 const rows=prices.map(price=>{
  const values=outcomes(price),gains=values.map((v,i)=>v.value.minus(baseline[i].value)),gain=weighted(gains),worst=Decimal.min(...gains),sales=weighted(values.map(x=>x.q)),uplift=sales.minus(baseSales);
  const admissible=price<b.current_cents&&left.gt(0)&&uplift.gt(p.min_incremental_sales)&&gain.gt(0)&&gain.gte(p.min_gain_cents)&&worst.gte(D(p.downside_budget_cents).negated());
  if(admissible&&(!selected||gain.gt(selected.gain)||gain.eq(selected.gain)&&price>selected.price))selected={price,gain,worst,sales};
  return {price_cents:price,scenario_sales:values.map(x=>x.q),scenario_values_cents:values.map(x=>n(x.value)),scenario_gains_cents:gains.map(n),expected_sales:n(sales),expected_value_cents:n(weighted(values.map(x=>x.value))),expected_gain_cents:n(gain),worst_gain_cents:n(worst),sales_uplift:n(uplift),admissible};
 });
 return {...result,status:selected?'MARKDOWN':'HOLD',reason:selected?'All scenario gates passed. Await authorization and checkout acknowledgment.':'No lower candidate passed every gate.',price_cents:selected?.price??b.current_cents,evaluation_completed:true,normalized_weights:weights.map(n),baseline_sales:n(baseSales),baseline_value_cents:n(weighted(baseline.map(x=>x.value))),expected_baseline_leftovers:n(left),selected_sales:n(selected?.sales??baseSales),expected_gain_cents:n(selected?.gain??D(0)),worst_gain_cents:n(selected?.worst??D(0)),rows};
}
