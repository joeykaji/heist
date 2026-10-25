import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pageFile} from '../server.mjs';
test('original website remains the homepage; terminal is confined to Market',async()=>{
 assert.equal(pageFile('/'),'index.html');
 assert.equal(pageFile('/index.html'),'index.html');
 assert.equal(pageFile('/market'),'workspace.html');
 assert.equal(pageFile('/styles.css'),'styles.css');
 const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
 assert.ok(html.includes('src="app.mjs"'));assert.ok(html.includes('href="styles.css"'));
 assert.ok(html.includes('id="view-home"'));
 assert.ok(!html.includes('workspace.css'));
});

test('shared routes preserve exact offer identity through publication and purchase',async t=>{
 const {createApp}=await import('../server.mjs');
 const {mkdtemp,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const dir=await mkdtemp(join(tmpdir(),'marketbite-routes-'));
 const app=await createApp({file:join(dir,'session.json'),tick:false});
 t.after(async()=>{await app.close();await rm(dir,{recursive:true,force:true});});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;
 let state=await (await fetch(base+'/api/session')).json();
 const offer=state.offers[0].offerId;
 for(const path of ['/shop','/staff','/market','/offers/'+encodeURIComponent(offer)]){
  assert.equal(pageFile(path),'workspace.html');
  const response=await fetch(base+path,{redirect:'manual'});
  assert.equal(response.status,200);assert.match(await response.text(),/workspace.mjs/);
 }
 const source=await (await fetch(base+'/workspace.mjs')).text();
 assert.ok(source.includes('href="/offers/\'+encodeURIComponent(o.offerId)'));
 const send=async(type,payload)=>{
  const response=await fetch(base+'/api/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),generation:state.generation,revision:state.revision,type,payload})});
  const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));state=data.snapshot;return data.result;
 };
 const regular=state.offers[0].current_cents;
 await send('review',{offer,profile:'normal'});
 await send('authorize',{offer,review:state.offers[0].review.id});
 assert.equal(state.offers[0].current_cents,regular);
 await send('checkout',{offer,operation:state.offers[0].pending.id,action:'ack'});
 assert.ok(state.offers[0].current_cents<regular);
 const available=state.offers[0].available;
 const order=await send('purchase',{offer,quantity:1,checkoutVersion:state.offers[0].checkoutVersion});
 assert.equal(order.offerId,offer);assert.equal(state.offers[0].available,available-1);
 await send('fulfill',{order:order.id});
 assert.equal(state.orders[0].status,'fulfilled');
 const refreshed=await (await fetch(base+'/api/session')).json();
 assert.deepEqual(refreshed,state);
});
