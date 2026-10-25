import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Session} from './src/application/session.mjs';
const root=resolve(fileURLToPath(new URL('./dist/',import.meta.url)));
const types={'.svg':'image/svg+xml','.ttf':'font/ttf','.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.json':'application/json'};
export function pageFile(pathname){return (pathname==='/market'||pathname==='/shop'||pathname==='/staff'||pathname.startsWith('/offers/'))?'workspace.html':pathname==='/'||pathname==='/index.html'?'index.html':decodeURIComponent(pathname).slice(1);}
export async function createApp({file=resolve('.marketbite/session.json'),tick=true}={}){
 const session=await Session.open(file);const streams=new Set();
 const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/events'&&req.method==='GET'){
 res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});
 const push=s=>res.write('id: '+s.generation+':'+s.revision+'\nevent: snapshot\ndata: '+JSON.stringify(s)+'\n\n');const off=session.subscribe(push);streams.add(res);push(session.get());const heartbeat=setInterval(()=>res.write(': heartbeat\n\n'),10000);req.on('close',()=>{clearInterval(heartbeat);off();streams.delete(res);});return;
 }
 if(url.pathname==='/api/session'&&req.method==='GET'){send(res,200,session.get());return;}
 if(url.pathname==='/api/commands'&&req.method==='POST'){
 const origin=req.headers.origin;if(origin&&origin!==`http://${req.headers.host}`&&origin!==`https://${req.headers.host}`){send(res,403,{error:'Cross-origin commands are not allowed'});return;}
 if(!req.headers['content-type']?.startsWith('application/json')){send(res,415,{error:'JSON required'});return;}
 let body='';for await(const chunk of req){body+=chunk;if(body.length>65536){send(res,413,{error:'Command too large'});return;}}
 let command;try{command=JSON.parse(body);}catch{send(res,400,{error:'Invalid JSON'});return;}
 try{send(res,200,await session.command(command));}catch(e){send(res,e.status??400,{error:e.message,snapshot:session.get()});}return;
 }
 if(url.pathname.startsWith('/api/')){send(res,404,{error:'Unknown API route'});return;}
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 const name=pageFile(url.pathname);const path=resolve(root,name);
 if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 const body=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:body);
 }catch(e){res.writeHead(e.code==='ENOENT'?404:500);res.end(e.code==='ENOENT'?'Not found':'Server error');}});
 const timer=tick?setInterval(()=>session.tick(),1000):null;
 server.on('close',()=>{if(timer)clearInterval(timer);for(const res of streams)res.end();});
 return {server,session,close:()=>{for(const res of streams)res.end();return new Promise(resolve=>server.close(resolve));}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const {server}=await createApp();server.listen(Number(process.env.PORT??4173),'127.0.0.1',()=>console.log('MarketBite: http://127.0.0.1:'+server.address().port));}
