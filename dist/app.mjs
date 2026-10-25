import {CATALOG,CATEGORIES,FEATURED,OPEN,CLOSE,money,simTime,initialState,validState,productView,offerAvailable,rawAvailable,sell,restock,evaluateBatch,executeDemoDecision,observeStock,setAllocations,demoScenarios,triggerEvent,comboView,buyCombo,basketQuote,applyTicker,stepSimulation,snapshotAt,demand} from './model.mjs';
import {createCase} from './case.mjs';
const $=id=>document.getElementById(id),KEY='marketbite-connections-v3',escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search),displayOnly=params.get('display')==='1';
let view=displayOnly?'tv':params.get('view')||'tv',state,playing=false,timer=null,storageAvailable=true,page=0,tvCategory='featured',selectedBatch='batch-5',decision=null,basket={},dealsOnly=false,caseScene=null,rushTimers=[];
function read(){try{const s=JSON.parse(localStorage.getItem(KEY));if(validState(s))return s;}catch{storageAvailable=false;}return null;}
state=read()||initialState();
const timeFormat=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit',second:'2-digit'});
const pct=n=>n.toFixed(1).replace(/\.0$/,'');
let toastTimer;
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4000);}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{storageAvailable=false;}}
function commit(next){if(!validState(next))throw new Error('The update did not pass validation.');const prior=state;state=next;save();render(prior);}
async function change(fn,{stop=true}={}){
 if(stop)pause();
 const run=()=>{const latest=read();if(latest)state=latest;try{const next=fn(state);if(next)commit(next);}catch(e){toast(e.message);}};
 // Browser-local locking serializes demo publications and stock changes across tabs.
 if(navigator.locks)await navigator.locks.request(KEY,run);else run();
}
function showView(next,push=true){
 view=['tv','simulation','mobile'].includes(next)?next:'tv';
 for(const id of ['tv','simulation','mobile'])$('view-'+id).hidden=id!==view;
 document.querySelectorAll('.workspace-bar [data-view]').forEach(a=>{if(a.dataset.view===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 if(push&&!displayOnly)history.pushState({},'', '?view='+view);
 if(view==='simulation'){if(!caseScene)caseScene=createCase($('case-stage'));caseScene?.setState(state);caseScene?.resize();}
 if(view==='tv')resize();render();
}
document.querySelectorAll('[data-view]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();showView(a.dataset.view);}));
window.addEventListener('popstate',()=>showView(new URLSearchParams(location.search).get('view')||'tv',false));
if(displayOnly){document.body.classList.add('tv-only');$('tv-tools').hidden=false;}
function resize(){const r=$('tv-stage').getBoundingClientRect();if(!r.width)return;const scale=Math.min(r.width/1920,r.height/1080);$('tv').style.transform=document.fullscreenElement===$('tv-stage')?'translate(-50%,-50%) scale('+scale+')':'scale('+scale+')';}
new ResizeObserver(resize).observe($('tv-stage'));window.addEventListener('resize',resize);document.addEventListener('fullscreenchange',resize);
$('tv-fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('tv-stage').requestFullscreen();}catch{toast('Use your browser full-screen command.');}};
for(const id of ['tv-category','inventory-category'])for(const c of CATEGORIES){const o=document.createElement('option');o.value=c;o.textContent=c;$(id).append(o);}
function tvProducts(){return tvCategory==='featured'?FEATURED.map(id=>CATALOG.find(p=>p.id===id)):tvCategory==='all'?CATALOG:CATALOG.filter(p=>p.category===tvCategory);}
function renderTV(previous){
 const products=tvProducts(),pages=Math.ceil(products.length/6);page=Math.min(page,pages-1);
 $('page-number').textContent=(page+1)+' / '+pages;$('prev-page').disabled=pages<2;$('next-page').disabled=pages<2;
 $('product-grid').innerHTML=products.slice(page*6,page*6+6).map(product=>{
  const p=productView(state,product.id),was=previous?productView(previous,p.id):null;
  return '<article class="food-card '+(p.saving?'discounted ':'')+(!p.quantity?'sold-out ':'')+(was&&p.price<was.price?'updated':'')+'" aria-label="'+escape(p.name)+' '+(p.quantity?money(p.price):'unavailable')+'"><div class="food-photo"><img src="'+p.image+'" alt="'+escape(p.name)+'"><span class="food-badge '+(p.quantity&&!p.saving?'regular':'')+'">'+(!p.quantity?'UNAVAILABLE':p.saving?'↓ '+pct(p.discount)+'% OFF':p.category.toUpperCase())+'</span>'+(p.quantity?'<span class="stock-badge '+(p.offerQuantity<=3?'low':'')+'">'+p.offerQuantity+' AT THIS PRICE</span>':'')+'</div><div class="food-info"><div><span class="food-symbol">'+p.symbol+'</span><h2 class="food-name">'+escape(p.name)+'</h2></div><div class="food-price"><strong>'+(p.quantity?money(p.price):'Unavailable')+'</strong><span class="old-price">'+(p.quantity?(p.saving?'was <s>'+money(p.base)+'</s>':'Regular price'):'')+'</span><span class="saving">'+(p.quantity&&p.saving?'Save '+money(p.saving):'')+'</span></div></div></article>';
 }).join('');
 const offers=CATALOG.map(p=>productView(state,p.id)).filter(p=>p.quantity&&p.saving);
 const promotion=state.promotion;
 $('menu-status').textContent=state.minute>=CLOSE-5?'OFFERS ENDED':promotion?({crash:'STOCK CRASH',combo:'STUDY BUDDY',rush:'LUNCH RUSH',rescue:'LAST-CALL OFFERS'}[promotion.kind]):offers.length?'PRICE DROPS NOW':'FRESH IN THE CASE';
 const combo=comboView(state);
 $('menu-message').textContent=state.minute>=CLOSE-5?'Thanks for making every bite count.':promotion?.kind==='combo'&&combo.available?'BUFF + BLUE · '+money(combo.total)+' together':promotion?.kind==='rush'?'The lunch rush is on. Your confirmed prices hold.':offers.length?'Good food. A little less. A lot less waste.':'Sandwiches, bagels, pastries & something sweet.';
 $('day-clock').textContent=simTime(state.minute);$('updated').textContent='Synced '+timeFormat.format(new Date(state.updatedAt));
 $('sync-status').textContent=storageAvailable?'Connected across tabs in this browser':'Session only · browser storage unavailable';
 renderTicker();
}
$('tv-category').onchange=e=>{tvCategory=e.target.value;page=0;renderTV();};
$('prev-page').onclick=()=>{page=(page-1+Math.ceil(tvProducts().length/6))%Math.ceil(tvProducts().length/6);renderTV();};
$('next-page').onclick=()=>{page=(page+1)%Math.ceil(tvProducts().length/6);renderTV();};
let tickerSignature='';
function renderTicker(){
 const signature=JSON.stringify([CATALOG.map(p=>{const v=productView(state,p.id);return [v.price,v.quantity];}),state.promotion?.kind,state.events[0]?.text]);
 if(signature!==tickerSignature){
  tickerSignature=signature;
  const content=CATALOG.map(product=>{const p=productView(state,product.id);return '<div class="ticker-item"><span class="ticker-symbol">'+p.symbol+'</span><span class="ticker-price">'+(p.quantity?money(p.price):'UNAVAILABLE')+'</span>'+(p.quantity&&p.saving?'<span class="ticker-drop">SAVE '+money(p.saving)+' · '+pct(p.discount)+'%</span>':'')+'<span class="ticker-quantity">'+p.quantity+' AVAILABLE</span></div>';}).join('')+'<span class="ticker-item ticker-news">'+escape(state.events[0]?.text||'Taste more. Waste less.')+'</span>';
  $('ticker-track').innerHTML='<div class="ticker-group">'+content+'</div><div class="ticker-group" aria-hidden="true">'+content+'</div>';
 }
 $('ticker-track').classList.toggle('paused',!state.preferences.ticker);
 for(const id of ['ticker-toggle','tv-ticker']){$(id).textContent=state.preferences.ticker?'Pause ticker':'Resume ticker';$(id).setAttribute('aria-pressed',String(!state.preferences.ticker));}
}
for(const id of ['ticker-toggle','tv-ticker'])$(id).onclick=()=>change(s=>applyTicker(s,!s.preferences.ticker),{stop:false});
function renderInventory(){
 const cat=$('inventory-category').value;
 $('inventory-list').innerHTML=CATALOG.filter(p=>cat==='all'||p.category===cat).map(product=>{
 const p=productView(state,product.id);return '<div class="inventory-row"><div class="inventory-product"><img src="'+p.image+'" alt=""><div><strong>'+escape(p.name)+'</strong><span>'+p.symbol+' · '+p.quantity+' available</span></div></div><div class="inventory-values"><b>'+(p.quantity?money(p.price):'—')+'</b><span>Regular '+money(p.base)+'</span></div><div class="inventory-actions"><button data-sell="'+p.id+'" '+(!p.quantity?'disabled':'')+'>Sell 1</button><button data-restock="'+p.id+'" '+(state.minute>=CLOSE-5?'disabled':'')+'>+4 fresh</button><button data-review="'+p.id+'">Review</button></div></div>';
 }).join('');
}
$('inventory-category').onchange=renderInventory;
$('inventory-list').onclick=e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.sell)change(s=>sell(s,b.dataset.sell));
 if(b.dataset.restock)change(s=>restock(s,b.dataset.restock));
 if(b.dataset.review){pause();selectedBatch=productView(state,b.dataset.review).batchId||state.batches.find(bat=>bat.productId===b.dataset.review).id;$('decision-batch').value=selectedBatch;$('chart-batch').value=selectedBatch;evaluate();$('decision-result').scrollIntoView({behavior:'smooth',block:'center'});}
};
function renderActivity(){
 $('activity-list').replaceChildren(...state.events.slice(0,15).map(e=>{const li=document.createElement('li'),t=document.createElement('time'),span=document.createElement('span');t.textContent=simTime(e.at);span.textContent=e.text;if(e.kind==='drop')span.className='event-drop';li.append(t,span);return li;}));
 $('activity-count').textContent='Latest updates';
 $('impact-stats').textContent=state.surplusSold+' discounted sales · '+state.transferred+' transferred · '+state.retained+' retained · '+state.discarded+' discarded (demo).';
}
function batchOptions(){
 for(const id of ['chart-batch','decision-batch']){
 const prior=$(id).value||selectedBatch,signature=state.batches.map(b=>b.id+':'+b.window_committed).join(',');
 if($(id).dataset.signature!==signature){$(id).dataset.signature=signature;$(id).innerHTML=state.batches.map(b=>'<option value="'+b.id+'">'+b.label+(b.window_committed?' · committed':'')+'</option>').join('');}
 $(id).value=state.batches.some(b=>b.id===prior)?prior:state.batches[0].id;
 }
}
function chart(id,points,max,format,step=false,end=state.minute,color='#006838'){
 const x=t=>45+(t-OPEN)/(CLOSE-OPEN)*330,y=v=>77-v/max*55;
 let d='';
 for(const [i,p] of points.entries()){d+=(i?'L':'M')+x(p.at)+' '+y(p.value)+' ';if(step&&i<points.length-1)d+='L'+x(points[i+1].at)+' '+y(p.value)+' ';}
 const latest=points.at(-1);if(step&&latest&&end>latest.at)d+='L'+x(end)+' '+y(latest.value);
 $(id).setAttribute('viewBox','0 0 400 113');
 $(id).innerHTML=[0,max/2,max].map(v=>'<line x1="45" y1="'+y(v)+'" x2="375" y2="'+y(v)+'" stroke="#e4ebee"/><text x="37" y="'+(y(v)+3)+'" text-anchor="end">'+format(v)+'</text>').join('')+'<text x="45" y="102">8 AM</text><text x="177" y="102">Noon</text><text x="375" y="102" text-anchor="end">6 PM</text>'+(latest?'<circle cx="'+x(Math.min(latest.at,end))+'" cy="'+y(latest.value)+'" r="3" fill="'+color+'"/>':'')+(d?'<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="2.5"/>':'')+'<line x1="'+x(state.minute)+'" x2="'+x(state.minute)+'" y1="15" y2="80" stroke="#bdc9d0" stroke-dasharray="3 4"/>';
}
function renderCharts(){
 const b=state.batches.find(b=>b.id===$('chart-batch').value)||state.batches[0],available=offerAvailable(state,b)>0;
 $('chart-price').textContent=available?money(b.current_cents):'Offer unavailable';
 const terminal=b.terminalAt??(available?state.minute:Math.min(state.minute,b.observedAt+state.policy.max_count_age_minutes));
 chart('price-chart',b.priceEvents.map(e=>({at:e.at,value:e.price})),b.original_cents,v=>'$'+(v/100).toFixed(2),true,terminal);
 $('chart-stock').textContent=state.history.at(-1).stock+' units';
 chart('stock-chart',state.history.map(e=>({at:e.at,value:e.stock})),Math.max(10,...state.history.map(e=>e.stock)),v=>Math.round(v),true);
 $('chart-demand').textContent=demand(state)+' / 100';
 chart('demand-chart',state.history.map(e=>({at:e.at,value:e.demand})),100,v=>Math.round(v),false,state.minute,'#d2a329');
}
$('chart-batch').onchange=renderCharts;
$('decision-batch').onchange=()=>{selectedBatch=$('decision-batch').value;decision=null;renderDecision();};
function evaluate(){pause();decision=evaluateBatch(state,$('decision-batch').value,$('scenario-profile').value);renderDecision();}
$('evaluate').onclick=()=>{try{evaluate();}catch(e){toast(e.message);}};
$('observe').onclick=()=>change(s=>observeStock(s));
function renderDecision(){
 const b=state.batches.find(b=>b.id===$('decision-batch').value);if(!b)return;
 for(const [input,k] of [['reserved','reserved_units'],['protected','protected_units'],['buffer','buffer_units']])if(document.activeElement!==$(input))$(input).value=b[k];
 const scenarios=demoScenarios(b,state.policy,$('scenario-profile').value);
 const prices=Object.keys(scenarios[0]?.demand||{});
 $('scenario-table').innerHTML='<table><thead><tr><th>Assumed demand</th>'+prices.map(p=>'<th>'+money(Number(p))+'</th>').join('')+'</tr></thead><tbody>'+scenarios.map(s=>'<tr><td>'+s.label+' ('+Number(s.weight)*100+'%)</td>'+prices.map(p=>'<td>'+s.demand[p]+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
 $('publish-price').hidden=true;$('fail-price').hidden=true;
 if(!decision){$('decision-result').innerHTML='<p>Physical '+b.physical_units+' − reserved '+b.reserved_units+' − protected '+b.protected_units+' − buffer '+b.buffer_units+' = '+rawAvailable(b)+' offer units. '+(b.window_committed?'This window is committed.':'Evaluate to compare the permitted prices.')+'</p>';return;}
 const d=decision;
 $('decision-result').innerHTML='<span class="result-status '+d.status.toLowerCase()+'">'+d.status+'</span><p>'+escape(d.reason)+'</p>'+(d.floor_cents!==null?'<p>Floor '+money(d.floor_cents)+' · '+d.available+' offer units'+(d.evaluation_completed?' · baseline leftovers '+d.expected_baseline_leftovers.toFixed(2):'')+'</p>':'')+(d.rows.length?'<table><thead><tr><th>Candidate</th><th>Expected sales</th><th>Expected gain</th><th>Worst listed gain</th><th>Passes gates</th></tr></thead><tbody>'+d.rows.map(r=>'<tr class="'+(r.admissible?'accepted':'')+'"><td>'+money(r.price_cents)+(r.price_cents===d.price_cents?' · selected':'')+'</td><td>'+r.expected_sales.toFixed(2)+'</td><td>'+money(r.expected_gain_cents)+'</td><td>'+money(r.worst_gain_cents)+'</td><td>'+(r.admissible?'Yes':r.price_cents===b.current_cents?'Baseline':'No')+'</td></tr>').join('')+'</tbody></table>':'');
 if(d.evaluation_completed&&!b.window_committed){$('publish-price').hidden=false;$('publish-price').textContent=d.status==='MARKDOWN'?'Authorize + acknowledge '+money(d.price_cents)+' in demo':'Commit evaluated hold';$('fail-price').hidden=d.status!=='MARKDOWN';}
}
$('publish-price').onclick=()=>{const d=decision;if(!d)return;change(s=>executeDemoDecision(s,d.batchId,d,true,true,'manual-'+d.windowId+'-'+d.checkoutVersion)).then(()=>{decision=null;renderDecision();});};
$('fail-price').onclick=()=>{const d=decision;if(d)change(s=>executeDemoDecision(s,d.batchId,d,true,false,'failed-'+d.windowId));};
$('save-allocations').onclick=()=>change(s=>setAllocations(s,$('decision-batch').value,Number($('reserved').value),Number($('protected').value),Number($('buffer').value))).then(()=>{decision=null;renderDecision();});
$('scenario-profile').onchange=()=>{decision=null;renderDecision();};
function updatePlayback(){$('pause-day').textContent=playing?'Pause':'Resume';$('pause-day').disabled=!playing&&state.minute>=CLOSE;$('run-day').textContent=playing?'↻ Restart day':'▶ Replay day';}
function pause(){clearInterval(timer);timer=null;playing=false;rushTimers.forEach(clearTimeout);rushTimers=[];updatePlayback();}
function start(){if(state.minute>=CLOSE)return;clearInterval(timer);playing=true;updatePlayback();timer=setInterval(async()=>{await change(s=>stepSimulation(s,5),{stop:false});if(state.minute>=CLOSE)pause();},500/Number($('speed').value));}
$('run-day').onclick=()=>change(()=>initialState('opening')).then(()=>{decision=null;start();});
$('pause-day').onclick=()=>playing?pause():start();
$('speed').onchange=()=>{if(playing)start();};
$('reset').onclick=()=>{basket={};decision=null;change(()=>initialState());};
$('day-slider').oninput=e=>{$('simulation-time').textContent=simTime(Number(e.target.value));};
$('day-slider').onchange=e=>{basket={};decision=null;change(()=>snapshotAt(Number(e.target.value)));};
document.querySelectorAll('[data-event]').forEach(button=>button.onclick=async()=>{
 const kind=button.dataset.event;await change(s=>triggerEvent(s,kind));toast(kind==='crash'||kind==='rescue'?'Eligible batches reviewed. Committed prices hold.':kind==='combo'?'Study Buddy pairing is on the mobile menu.':'Lunch rush started.');
 if(kind==='rush')for(let i=0;i<6;i++)rushTimers.push(setTimeout(()=>change(s=>{const id=FEATURED[i%6];return productView(s,id).quantity?sell(s,id):s;},{stop:false}),800*(i+1)));
});
function renderMobile(){
 const search=$('menu-search').value.trim().toLowerCase();
 $('mobile-open').textContent=state.minute<CLOSE-5?'Offers available · demo '+simTime(state.minute):'Offers ended for today';
 $('mobile-updated').textContent='Updated '+simTime(state.minute);
 const promo=state.promotion,c=comboView(state);
 $('mobile-promotion').innerHTML=promo?'<div class="mobile-deal"><strong>'+({crash:'The bakery stock crash',combo:'Study Buddy pairing',rush:'Lunch rush is on',rescue:'Last-call offers'}[promo.kind])+'</strong><p>'+({crash:'Freshly confirmed savings on eligible bakery batches. Catch your favorite while it lasts.',combo:'Buffalo Chicken + Blueberry Muffin · '+money(c.total)+' together. Each item keeps its confirmed price.',rush:'Busy lunch, steady prices. See available food below.',rescue:'Find eligible surplus offers before the selling window closes.'}[promo.kind])+'</p><p>Event ends at '+simTime(promo.until)+'</p>'+(promo.kind==='combo'?'<button id="add-combo" '+(!c.available?'disabled':'')+'>'+(c.available?'Add both to basket':'Pairing unavailable')+'</button>':'')+'</div>':'';
 const matches=CATALOG.filter(p=>(!search||(p.name+' '+p.symbol+' '+p.category).toLowerCase().includes(search))&&(!dealsOnly||(productView(state,p.id).saving>0&&productView(state,p.id).quantity>0)));
 $('mobile-menu').innerHTML=matches.length?CATEGORIES.map((category,i)=>{
 const products=matches.filter(p=>p.category===category);if(!products.length)return '';
 return '<section class="mobile-menu-section" id="mobile-category-'+i+'"><h3>'+category+'</h3>'+products.map(product=>{
 const p=productView(state,product.id);return '<article class="mobile-card '+(!p.quantity?'unavailable':'')+'"><div class="mobile-card-info"><span class="mobile-symbol">'+p.symbol+'</span><h4>'+escape(p.name)+'</h4><div class="mobile-price">'+(p.quantity?money(p.price):'Unavailable')+(p.quantity&&p.saving?'<s>'+money(p.base)+'</s>':'')+'</div>'+(p.quantity&&p.saving?'<div class="mobile-drop">↓ '+pct(p.discount)+'% · Save '+money(p.saving)+'</div>':'')+'<div class="mobile-quantity">'+(p.quantity?p.offerQuantity+' at this price · '+simTime(p.priceAt):'Check back for fresh stock')+'</div></div><div class="mobile-thumb"><img src="'+p.image+'" alt="'+escape(p.name)+'" loading="lazy"><button class="mobile-add" data-add="'+p.id+'" aria-label="Add '+escape(p.name)+'" '+(!p.quantity?'disabled':'')+'>+</button></div></article>';
 }).join('')+'</section>';
 }).join(''):'<p class="empty-menu">No matching foods. Try another search or clear the price-drop filter.</p>';
 $('deals-only').setAttribute('aria-pressed',String(dealsOnly));renderBasket();
}
$('menu-search').oninput=renderMobile;
$('deals-only').onclick=()=>{dealsOnly=!dealsOnly;renderMobile();};
function add(id){const p=productView(state,id);if((basket[id]||0)>=p.quantity){toast('All available '+p.symbol+' units are already in your basket.');return;}basket[id]=(basket[id]||0)+1;renderBasket();toast(p.name+' added.');}
$('mobile-menu').onclick=e=>{const b=e.target.closest('[data-add]');if(b)add(b.dataset.add);};
$('mobile-promotion').onclick=e=>{if(e.target.id==='add-combo'){const c=comboView(state);if(c.available){for(const p of c.products)add(p.id);}}};
$('categories').onclick=()=>$('category-dialog').showModal();
$('category-links').innerHTML=CATEGORIES.map((c,i)=>'<button data-category="'+i+'">'+c+'</button>').join('');
$('category-links').onclick=e=>{const b=e.target.closest('[data-category]');if(!b)return;$('menu-search').value='';dealsOnly=false;renderMobile();$('category-dialog').close();$('mobile-category-'+b.dataset.category)?.scrollIntoView({behavior:'smooth',block:'start'});};
$('mobile-info').onclick=()=>$('info-dialog').showModal();
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
function renderBasket(){
 const count=Object.values(basket).reduce((a,b)=>a+b,0);let total=null;try{total=basketQuote(state,basket).total;}catch{}
 $('basket-open').hidden=!count;$('basket-label').textContent=count+' item'+(count===1?'':'s')+' · View basket';$('basket-total').textContent=total===null?'Review stock':money(total);
 $('basket-items').innerHTML=Object.entries(basket).map(([id,n])=>{const p=productView(state,id);return '<div><div><strong>'+escape(p.name)+'</strong><small>'+n+' × current offer '+money(p.price)+(n>p.quantity?' · exceeds stock':'')+'</small></div><button data-remove="'+id+'" aria-label="Remove one '+escape(p.name)+'">−</button></div>';}).join('')+(count?'<div><strong>Current total</strong><strong>'+(total===null?'Review stock':money(total))+'</strong></div>':'<p>Your basket is empty.</p>');
 $('checkout').disabled=!count||total===null;
}
$('basket-open').onclick=()=>{renderBasket();$('basket-dialog').showModal();};
$('basket-items').onclick=e=>{const id=e.target.closest('[data-remove]')?.dataset.remove;if(!id)return;if(--basket[id]===0)delete basket[id];renderBasket();};
$('checkout').onclick=async()=>{let success=false;await change(s=>{const result=basketQuote(s,basket);success=true;return result.state;});if(success){basket={};renderBasket();$('basket-dialog').close();toast('Demo purchase complete. Case inventory updated.');}};
function render(previous){
 renderTV(previous);batchOptions();renderInventory();renderActivity();renderCharts();renderDecision();renderMobile();
 $('simulation-time').textContent=simTime(state.minute);$('day-slider').value=state.minute;
 $('total-stock').textContent=state.batches.reduce((n,b)=>n+offerAvailable(state,b),0);$('total-sold').textContent=state.sold;updatePlayback();caseScene?.setState(state);
}
window.addEventListener('storage',e=>{if(e.key!==KEY||!e.newValue)return;try{const next=JSON.parse(e.newValue);if(!validState(next))return;pause();const old=state;state=next;decision=null;render(old);}catch{}});
let toolsTimer;if(displayOnly)window.addEventListener('pointermove',()=>{document.body.classList.add('show-tools');clearTimeout(toolsTimer);toolsTimer=setTimeout(()=>document.body.classList.remove('show-tools'),2500);});
function clock(){const now=new Date();$('clock').textContent=timeFormat.format(now);$('clock').dateTime=now.toISOString();}
clock();setInterval(clock,1000);save();showView(view,false);
