import {productView} from './model.mjs';
export function createCase(stage){
const status=document.getElementById('case-loading');
if(!window.THREE){status.textContent='The 3D renderer could not load.';return null;}
const T=window.THREE,reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
let renderer;
try{renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});}
catch(error){status.textContent='This preview needs a browser with 3D graphics enabled.';return;}
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
stage.appendChild(renderer.domElement);status.hidden=true;renderer.domElement.setAttribute('aria-hidden','true');
const scene=new T.Scene(),camera=new T.OrthographicCamera(-5,5,3.5,-3.5,.1,80),display=new T.Group();scene.add(display);
const mats={};
function mat(key,color,roughness=.65,metalness=0){return mats[key]||(mats[key]=new T.MeshStandardMaterial({color,roughness,metalness}));}
// Physical object colors preserve the requested black case and recognizable food colors.
const black=mat('black',0x111315,.4,.45),shelfMat=mat('shelf',0x141618,.58,.24),trayMat=mat('tray',0x303536,.76,.05);
const bread=mat('bread',0xf0ce91,.88),crust=mat('crust',0xb97231,.72),chicken=mat('chicken',0xe4c594,.91),meat=mat('turkey',0xe4b5a0,.85);
const cheese=mat('cheddar',0xf2b23d),mozzarella=mat('mozzarella',0xf5ead1,.9),tomato=mat('tomato',0xb93724,.42),lettuce=mat('lettuce',0x568430,.75),pesto=mat('pesto',0x52713b,.78);
const gold=mat('gold',0xca7a2e,.64),goldLight=mat('goldLight',0xe7a44e,.68),toasted=mat('toasted',0xa95724,.72),chocolate=mat('chocolate',0x4c291c,.62);
const muffinGold=mat('muffinGold',0xc99855,.86),blueberry=mat('blueberry',0x343148,.72),sugar=mat('sugar',0xffe9b7,.85),wrapper=mat('wrapper',0x9a7657,.95),chocolateWrapper=mat('chocolateWrapper',0x6a5142,.95);
const glass=new T.MeshPhysicalMaterial({color:0xcce3e4,transparent:true,opacity:.075,roughness:.12,metalness:.08,side:T.DoubleSide,depthWrite:false}),glow=new T.MeshBasicMaterial({color:0xffe1ad});
const unitBox=new T.BoxGeometry(1,1,1),sphereGeo=new T.SphereGeometry(1,16,10);
function mesh(parent,geo,material,x=0,y=0,z=0){const o=new T.Mesh(geo,material);o.position.set(x,y,z);o.castShadow=!material.transparent;o.receiveShadow=true;parent.add(o);return o;}
function box(parent,w,h,d,x,y,z,material){const o=mesh(parent,unitBox,material,x,y,z);o.scale.set(w,h,d);return o;}
function oval(parent,x,y,z,sx,sy,sz,material){const o=mesh(parent,sphereGeo,material,x,y,z);o.scale.set(sx,sy,sz);return o;}
function rounded(parent,w,h,d,x,y,z,material,r=.06){
 const s=new T.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);
 s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);
 s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
 const g=new T.ExtrudeGeometry(s,{depth:Math.max(.01,d-2*r),bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:r*.45,bevelThickness:r,curveSegments:4});g.translate(0,0,-(d-2*r)/2);
 return mesh(parent,g,material,x,y,z);
}
scene.add(new T.HemisphereLight(0xfff5e1,0x8b9ca5,2.5));
const key=new T.DirectionalLight(0xffe7c3,3.4);key.position.set(-4,9,6);key.castShadow=true;key.shadow.mapSize.set(1024,1024);
Object.assign(key.shadow.camera,{left:-6,right:6,top:7,bottom:-6,near:.5,far:25});key.shadow.normalBias=.035;key.shadow.bias=-.0002;scene.add(key);
const rim=new T.DirectionalLight(0xe0efff,2.1);rim.position.set(5,5,-4);scene.add(rim);
const front=new T.DirectionalLight(0xfff2d6,1.5);front.position.set(0,3,9);scene.add(front);
const floor=mesh(scene,new T.PlaneGeometry(22,16),new T.ShadowMaterial({opacity:.16}),0,-.17,0);floor.rotation.x=-Math.PI/2;floor.castShadow=false;
const W=7.2,D=2.35,H=4.35;
rounded(display,7.55,.22,2.66,0,-.03,0,mat('counter',0xb6afa3,.95),.05);
box(display,W+.1,.24,D+.07,0,.16,0,black);box(display,W-.1,.06,D-.12,0,.31,0,shelfMat);
for(const x of [-W/2,W/2])for(const z of [-D/2,D/2])box(display,.085,H,.085,x,H/2+.22,z,black);
for(const y of [.28,H+.2]){
 for(const z of [-D/2,D/2])box(display,W,.085,.085,0,y,z,black);
 for(const x of [-W/2,W/2])box(display,.085,.085,D,x,y,0,black);
}
// Two shelves plus the base create three usable display levels.
const levels=[.35,1.69,3.03];
for(const y of levels.slice(1)){
 box(display,W-.08,.075,D-.13,0,y-.045,0,shelfMat);
 box(display,W-.03,.115,.075,0,y-.04,D/2-.035,black);
 box(display,W-.20,.018,.025,0,y-.11,.73,glow);
}
box(display,.065,H-.07,D-.10,0,H/2+.24,0,shelfMat);
box(display,.105,H,.105,0,H/2+.22,D/2,black);
box(display,W-.22,.024,.03,0,H+.13,.76,glow);
box(display,W-.1,H-.1,.01,0,H/2+.24,-D/2,glass);
box(display,W-.1,H-.1,.01,0,H/2+.24,D/2,glass);
for(const x of [-W/2,W/2])box(display,.01,H-.1,D-.1,x,H/2+.24,0,glass);
box(display,W,.012,D,0,H+.2,0,glass);
const glintMat=new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.075,depthWrite:false,side:T.DoubleSide});
for(const x of [-2.8,1.8]){const glint=box(display,.13,3.9,.002,x,2.45,D/2+.012,glintMat);glint.rotation.z=-.22;glint.castShadow=false;}
function sign(text,w,h,x,y,z){
 const c=document.createElement('canvas');c.width=1024;c.height=128;const ctx=c.getContext('2d');
 ctx.fillStyle='#111315';ctx.fillRect(0,0,1024,128);ctx.fillStyle='#eee9dd';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='500 46px Arial, sans-serif';ctx.fillText(text,512,64);
 const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const o=mesh(display,new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:tex}),x,y,z);o.castShadow=false;
}
sign('M A R K E T B I T E',2.05,.16,0,.15,D/2+.047);
function layer(parent,y,thickness,material,scale=1){
 const s=new T.Shape();s.moveTo(-.43*scale,-.31*scale);s.lineTo(.43*scale,-.31*scale);s.lineTo(-.43*scale,.31*scale);s.closePath();
 const g=new T.ExtrudeGeometry(s,{depth:thickness,bevelEnabled:true,bevelSegments:1,bevelSize:.012,bevelThickness:.007,steps:1});g.rotateX(-Math.PI/2);
 return mesh(parent,g,material,0,y,0);
}
function sandwich(type){
 const g=new T.Group();layer(g,.04,.067,crust);layer(g,.057,.053,bread,.95);layer(g,.122,.025,type==='caprese'?pesto:lettuce,1.02);
 for(let i=0;i<5;i++)oval(g,-.34+i*.16,.142,.31,.11,.024,.065,lettuce);
 layer(g,.16,.038,type==='chicken'?chicken:type==='caprese'?mozzarella:meat,.98);
 layer(g,.207,.022,type==='caprese'?tomato:cheese,1.01);
 if(type==='chicken')for(let i=0;i<4;i++)oval(g,-.29+i*.17,.188,.319,.07,.025,.03,chicken);
 layer(g,.246,.065,crust);layer(g,.264,.042,bread,.94);
 for(let i=0;i<8;i++)oval(g,-.33+(i%4)*.12,.313,.22-Math.floor(i/4)*.15,.012,.006,.022,crust);
 g.rotation.y=-.1;return g;
}
function croissant(){
 const g=new T.Group();for(let i=0;i<9;i++){const t=(i-4)/4,size=1-Math.abs(t)*.64;const o=oval(g,t*.37,.15*size+.03,.18*t*t-.05,.115,.16*size,.23*size,i%2?gold:goldLight);o.rotation.y=t*.72;}return g;
}
function chocolatePastry(){
 const g=new T.Group();rounded(g,.67,.28,.49,0,.18,0,goldLight,.085);
 for(const x of [-.18,.18]){const roll=mesh(g,new T.CylinderGeometry(.09,.09,.50,12),gold,x,.24,0);roll.rotation.x=Math.PI/2;oval(g,x,.23,.252,.061,.046,.015,chocolate);}
 for(let i=0;i<5;i++)box(g,.49,.012,.013,0,.335,-.16+i*.075,toasted);return g;
}
function cinnamonSwirl(){
 const g=new T.Group();mesh(g,new T.CylinderGeometry(.29,.30,.12,24),gold,0,.09,0);const points=[];
 for(let i=0;i<=95;i++){const t=i/95,a=t*Math.PI*5.6,r=.028+t*.245;points.push(new T.Vector3(Math.cos(a)*r,.21-t*.025,Math.sin(a)*r));}
 mesh(g,new T.TubeGeometry(new T.CatmullRomCurve3(points),95,.044,6,false),goldLight);
 mesh(g,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(p.x,p.y+.037,p.z))),70,.012,4,false),toasted);
 for(let i=0;i<4;i++){const x=-.17+i*.10,curve=new T.CatmullRomCurve3([new T.Vector3(x,.255,-.14),new T.Vector3(x+.025,.28,0),new T.Vector3(x+.01,.255,.16)]);mesh(g,new T.TubeGeometry(curve,10,.01,4,false),sugar);}return g;
}
const muffinGeo=new T.SphereGeometry(1,20,12,0,Math.PI*2,0,Math.PI*.58);
function muffin(type){
 const g=new T.Group(),isChocolate=type==='chocolate-muffin',wrap=isChocolate?chocolateWrapper:wrapper,dough=isChocolate?chocolate:muffinGold;
 mesh(g,new T.CylinderGeometry(.235,.18,.27,24),wrap,0,.15,0);
 for(let i=0;i<18;i++){const a=i/18*Math.PI*2,p=box(g,.012,.25,.015,Math.sin(a)*.214,.15,Math.cos(a)*.214,wrap);p.rotation.y=a;p.rotation.x=Math.cos(a)*.17;p.rotation.z=-Math.sin(a)*.17;}
 const dome=mesh(g,muffinGeo,dough,0,.305,0);dome.scale.set(.288,.22,.288);
 for(let i=0;i<9;i++){
  const a=i*2.3999,r=.05+.17*Math.sqrt(i/9),x=Math.cos(a)*r,z=Math.sin(a)*r,y=.305+.22*Math.sqrt(Math.max(0,1-(r/.288)**2));
  if(type==='blueberry')oval(g,x,y,z,.031,.02,.029,blueberry);
  else if(isChocolate){const chip=box(g,.041,.029,.038,x,y,z,toasted);chip.rotation.y=a;}
  else oval(g,x,y+.006,z,.022,.01,.015,sugar);
 }return g;
}
const rows=[['turkey','caprese','chicken'],['veggie','turkey-roll','breakfast-bagel'],['chocolate-pastry','blueberry','chocolate-muffin']],foods=[],columns=[-2.89,-1.79,-.69,.69,1.79,2.89];
function breakfast(type){
 const g=new T.Group();
 if(type==='breakfast-bagel'){
  for(const y of [.08,.29]){const ring=mesh(g,new T.TorusGeometry(.25,.095,10,24),goldLight,0,y,0);ring.rotation.x=Math.PI/2;}
 }else{oval(g,0,.08,0,.33,.09,.28,bread);oval(g,0,.32,0,.34,.12,.29,goldLight);}
 oval(g,0,.18,0,.31,.035,.27,mozzarella);box(g,.53,.025,.43,0,.22,0,cheese);oval(g,0,.25,0,.27,.025,.23,type==='veggie'?lettuce:meat);return g;
}
rows.forEach((types,level)=>{
 for(const side of [-1,1])rounded(display,3.23,.035,1.98,side*1.82,levels[level]+.018,0,trayMat,.012);
 columns.forEach((x,col)=>{
  const type=types[col%3];
  for(const z of [-.75,-.25,.25,.75]){
   const item=level===0?sandwich(type):level===1?breakfast(type):type==='chocolate-pastry'?chocolatePastry():muffin(type);
   item.scale.setScalar(.78);item.position.set(x,levels[level]+.052,z);if(z<0)item.rotation.y+=.09;item.userData.food=type;
   display.add(item);foods.push(item);
  }
 });
});
const mapping={turkey:'buffalo',caprese:'roast',chicken:'southwest',veggie:'veggie','turkey-roll':'turkey','breakfast-bagel':'bacon','chocolate-pastry':'chocolate',blueberry:'blueberry','chocolate-muffin':'double'};
const ordinals={};foods.forEach(o=>{o.userData.productId=mapping[o.userData.food];o.userData.ordinal=ordinals[o.userData.productId]||0;ordinals[o.userData.productId]=(ordinals[o.userData.productId]||0)+1;o.userData.base=o.position.clone();o.userData.target=true;o.userData.progress=1;});
let yaw=.21,pitch=.16,visible=true,last=0,currentState=null,drag=null;
function setState(s){
 currentState=s;let shown=0,total=0;
 for(const id of Object.values(mapping))total+=productView(s,id).quantity;
 for(const o of foods){const target=o.userData.ordinal<Math.min(8,productView(s,o.userData.productId).quantity);if(target!==o.userData.target){o.userData.target=target;o.userData.progress=0;}if(target)shown++;}
 document.getElementById('case-caption').textContent=shown+' displayed units · '+total+' available across these 9 foods. Up to 8 per food are shown; additional units remain in back stock.';
 document.getElementById('case-legend').innerHTML=Object.values(mapping).map(id=>{const p=productView(s,id);return '<span>'+p.symbol+' '+p.quantity+'</span>';}).join('');
}
function resize(){const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);const a=w/h,halfWidth=Math.max(4.3,2.75*a);camera.left=-halfWidth;camera.right=halfWidth;camera.top=halfWidth/a;camera.bottom=-halfWidth/a;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(stage);new IntersectionObserver(e=>visible=e[0].isIntersecting).observe(stage);
renderer.domElement.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;yaw=T.MathUtils.clamp(yaw-(e.clientX-drag.x)*.005,-.78,.78);pitch=T.MathUtils.clamp(pitch+(e.clientY-drag.y)*.003,.04,.4);drag={x:e.clientX,y:e.clientY};document.getElementById('case-angle').value=yaw*180/Math.PI;});
renderer.domElement.addEventListener('pointerup',()=>drag=null);renderer.domElement.addEventListener('pointercancel',()=>drag=null);
document.getElementById('case-angle').addEventListener('input',e=>yaw=Number(e.target.value)*Math.PI/180);
document.getElementById('case-reset').addEventListener('click',()=>{yaw=.21;pitch=.16;document.getElementById('case-angle').value=12;});
function render(time){requestAnimationFrame(render);const dt=Math.min((time-last)/1000,.08);last=time;if(!visible||document.hidden)return;
 for(const o of foods){const u=o.userData;u.progress=reducedMotion.matches?1:Math.min(1,u.progress+dt*2.4);o.position.copy(u.base);o.scale.setScalar(.78);o.visible=u.target||u.progress<1;
 if(u.progress<1){const t=u.target?1-u.progress:u.progress;o.position.y+=t*.65;o.position.z+=t*.55;o.scale.setScalar(.78*(1-t*.6));}}
 camera.position.set(Math.sin(yaw)*13,2.13+Math.sin(pitch)*13,Math.cos(yaw)*13);camera.lookAt(0,2.13,0);renderer.render(scene,camera);
}
resize();requestAnimationFrame(render);return {setState,resize};
}
