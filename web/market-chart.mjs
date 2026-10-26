import {chartSamples,hourlyPoints} from './price-history.mjs';
const palette=['#58d69b','#edc54a','#79baff','#e89bd7','#ffad78','#b6a0ff'];
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
const time=m=>(Math.floor(m/60)%12||12)+':'+String(m%60).padStart(2,'0')+' '+(m>=720?'PM':'AM');

// Keep separate batch identities and only plot confirmed prices within their valid history.
export function marketSeries(state,mode='price'){
 return state.offers.map((offer,index)=>{
  const end=Math.min(state.minute,offer.terminalAt??Infinity,offer.cutoff-offer.fulfillment_buffer_minutes,offer.observedAt+state.policy.max_count_age_minutes);
  const points=offer.priceEvents.filter(p=>p.price>0&&p.at<=end).map(p=>({...p,value:mode==='change'?100*(p.price/offer.original_cents-1):p.price}));
  return {offer,points,end,color:palette[index%palette.length],dash:['','8 4','2 4','10 3 2 3'][index%4]};
 });
}
export function marketChart(state,mode='price',selected=null){
 const series=marketSeries(state,mode).filter(s=>s.offer.available>0),points=series.flatMap(s=>s.points);
 if(!points.length)return '<section class="panel"><h2>Market-Wide Price History</h2><p class="muted">No available items with confirmed price history.</p></section>';
 const start=Math.min(...points.map(p=>p.at)),end=Math.max(start+1,...state.offers.map(o=>o.cutoff));
 const low=mode==='change'?Math.min(-5,...points.map(p=>p.value))*1.1:0;
 const high=mode==='change'?0:Math.ceil(Math.max(...points.map(p=>p.value))*1.12/100)*100;
 const x=t=>64+(t-start)/(end-start)*872,y=v=>30+(high-v)/(high-low)*248;
 const format=v=>mode==='change'?(Math.abs(v)<.01?'0':v.toFixed(0))+'%':money(v);
 let svg='<svg class="market-chart" viewBox="0 0 980 330" role="img" aria-labelledby="market-chart-title market-chart-description"><title id="market-chart-title">Market-wide confirmed price history</title><desc id="market-chart-description">'+(mode==='change'?'Percentage change from each batch’s regular price.':'All batch prices on one dollar scale.')+' Lines connect confirmed price samples. Lines end at withdrawal or stale counts. Exact changes are listed below.</desc>';
 for(let i=0;i<=4;i++){const v=low+(high-low)*i/4;svg+='<line x1="64" x2="936" y1="'+y(v)+'" y2="'+y(v)+'" class="market-grid"/><text x="52" y="'+(y(v)+4)+'" text-anchor="end">'+format(v)+'</text>';}
 for(let i=0;i<=4;i++){const at=start+(end-start)*i/4;svg+='<text x="'+x(at)+'" y="310" text-anchor="'+(i===0?'start':i===4?'end':'middle')+'">'+time(Math.round(at))+'</text>';}
 for(const s of series){if(!s.points.length)continue;const samples=chartSamples(s.points);let path='';for(let i=0;i<samples.length;i++){
  const p=samples[i],next=samples[i+1];path+=(i?' L':'M')+x(p.at)+' '+y(p.value)+(next?'':' H'+x(s.end));
 }
 const last=s.points.at(-1),muted=selected&&s.offer.offerId!==selected;
 svg+='<g opacity="'+(muted?'.45':'1')+'"><path d="'+path+'" fill="none" stroke="'+s.color+'" stroke-width="'+(s.offer.offerId===selected?3.5:2.5)+'" stroke-dasharray="'+s.dash+'"/>'+hourlyPoints(s.points,s.end).map(p=>'<circle cx="'+x(p.at)+'" cy="'+y(p.value)+'" r="4" fill="#101711" stroke="'+s.color+'" stroke-width="2"><title>'+escape(s.offer.name)+' · '+time(p.at)+' · '+format(p.value)+'</title></circle>').join('')+'</g>';
 }
 svg+='</svg>';
 return '<section class="panel market-overview"><div class="panel-title"><div><h2>Market-Wide Price History</h2><p class="muted small">Confirmed prices · daily timeline · evaluated every 30 minutes</p></div><div class="chart-modes" role="group" aria-label="Graph scale">'+['price','change'].map(m=>'<button data-action="chartMode" data-mode="'+m+'" aria-pressed="'+(mode===m)+'">'+(m==='price'?'Price ($)':'Change (%)')+'</button>').join('')+'</div></div><div class="market-plot">'+svg+'</div><div class="market-legend">'+series.map(s=>{
 const o=s.offer,last=s.points.at(-1),change=last?100*(last.price/o.original_cents-1):0;
 return '<a href="/market?offer='+encodeURIComponent(o.offerId)+'" class="legend-offer '+(selected===o.offerId?'selected':'')+'" '+(selected===o.offerId?'aria-current="true"':'')+'><svg width="28" height="12" aria-hidden="true"><path d="M0 6 H28" stroke="'+s.color+'" stroke-width="3" stroke-dasharray="'+s.dash+'"/></svg><span><b>'+escape(o.symbol)+' · '+escape(o.label)+'</b><small>'+escape(o.name)+'</small></span><span class="legend-price">'+(last?money(last.price):'—')+'<small>'+(change<0?'↓ '+Math.abs(change).toFixed(1)+'%':'Unchanged')+'</small></span></a>';
 }).join('')+'</div><p class="small muted">Select a batch to highlight its line and inspect its offer below. Dots show the confirmed price at each hour; hover for the time and value. Simplified lines connect 30-minute samples; lines stop at withdrawal or stale counts. Fresh deliveries start separate lines.</p><details class="price-history-table"><summary>View Exact Price Changes</summary><div class="table-scroll"><table><caption>Confirmed price events by batch</caption><thead><tr><th scope="col">BATCH</th><th scope="col">TIME</th><th scope="col">PRICE</th><th scope="col">CHANGE FROM REGULAR</th></tr></thead><tbody>'+series.flatMap(s=>s.points.map(p=>'<tr><td>'+escape(s.offer.name+' · '+s.offer.label)+'</td><td>'+time(p.at)+'</td><td>'+money(p.price)+'</td><td>'+((p.price/s.offer.original_cents-1)*100).toFixed(1)+'%</td></tr>')).join('')+'</tbody></table></div></details></section>';
}
