{
const cv=document.getElementById('c'),ctx=cv.getContext('2d'),$=id=>document.getElementById(id);
const H=540;let W=960,S=1,dpr=1;
const G=2300,JV=780,JV2=690,RUN=420,ACC=2600,AIR=1600,FR=2600,NLV=6;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
function rng(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
let save={best:{},open:1};
try{const s=JSON.parse(localStorage.getItem('pk2d')||'null');if(s&&s.best)save=s}catch(e){}
function store(){try{localStorage.setItem('pk2d',JSON.stringify(save))}catch(e){}}
const fmt=t=>t==null?'—':t.toFixed(2);

function gen(n){
  const r=rng(n*977+13),R=(a,b)=>a+r()*(b-a),sol=[],roofs=[],cps=[],deco=[];
  let x=-300,y=400;
  const add=(x,w,y)=>{roofs.push({x,y,w,k:roofs.length});sol.push({x,y,w,h:1800,roof:1})};
  add(x,900,y);x+=900;
  const N=6+n*2;
  for(let i=0;i<N;i++){
    const g=R(90,Math.min(150+n*24,265));
    let dy=R(-70,70);if(g>215)dy=Math.abs(dy)+10;
    else if(r()<.12+n*.03)dy=-R(80,115);
    y=clamp(y+dy,230,450);x+=g;
    const w=R(420,780);add(x,w,y);
    if(r()<.35)deco.push({x:x+R(60,w-120),y,t:r()<.5?0:1});
    let ox=x+170;
    while(ox<x+w-160){
      const t=r();
      if(t<.33){sol.push({x:ox,y:y-34,w:46,h:34,box:1});ox+=R(190,270)}
      else if(t<.33+Math.min(.12+n*.06,.38)){const bw=R(80,150);sol.push({x:ox,y:y-430,w:bw,h:400,bill:1});ox+=bw+R(200,280)}
      else ox+=R(120,200);
    }
    if(i%3===2)cps.push({x:x+50,y});
    x+=w;
  }
  x+=R(100,160);add(x,700,y);
  return{sol,roofs,cps,deco,fin:x+420,finY:y};
}

// skyline
const sky=[{p:.1,c:'#7a3d78',a:[]},{p:.28,c:'#4a2760',a:[]}];
{const r=rng(7);for(const L of sky){let x=0;while(x<3000){const w=60+r()*140;L.a.push({x,w,h:(L.p<.2?120:180)+r()*(L.p<.2?160:220),ant:r()<.2});x+=w+r()*30}}}

let lv=null,lvn=1,state='menu',P,cam={x:0,y:0},time=0,started=false,deaths=0,cp=null,parts=[],tPhase=0;
const keys={l:0,r:0,j:0,d:0};
function newP(x,y){return{gy:y,x,y:y-48,vx:0,vy:0,w:22,h:48,g:0,face:1,slide:0,flip:0,aj:1,coy:0,buf:0,vault:0}}
function load(n){lvn=n;lv=gen(n);P=newP(0,400);cp=null;time=0;started=false;deaths=0;parts=[];cam.x=P.x-W*.35;cam.y=P.y-330;updHud(true)}
function respawn(){const s=cp||{x:0,y:400};P=newP(s.x,s.y);deaths++;updHud(true)}

const hit=(a,s)=>a.x<s.x+s.w&&a.x+a.w>s.x&&a.y<s.y+s.h&&a.y+a.h>s.y;
function ceil(){const t={x:P.x,y:P.y-24,w:P.w,h:24};return lv.sol.some(s=>hit(t,s))}
function dust(x,y,n,v){for(let i=0;i<n;i++)parts.push({x,y,vx:(Math.random()-.5)*v,vy:-Math.random()*v*.5,l:.4+Math.random()*.3})}

function step(dt){
  if(state!=='play')return;
  const dir=(keys.r?1:0)-(keys.l?1:0);
  if(dir&&!started)started=true;
  if(started)time+=dt;
  if(P.slide<=0&&dir){P.vx+=dir*(P.g?ACC:AIR)*dt;P.face=dir}
  else if(P.g&&P.slide<=0){const f=FR*dt;P.vx=Math.abs(P.vx)<=f?0:P.vx-Math.sign(P.vx)*f}
  if(P.slide>0){
    P.vx*=1-.7*dt;P.slide-=dt;
    if(P.g&&Math.random()<.5)dust(P.x+P.w/2,P.y+P.h,1,120);
    if(P.slide<=0){if(ceil()){P.slide=.05;if(Math.abs(P.vx)<170)P.vx=P.face*170}else{P.y-=24;P.h=48}}
  }
  P.vx=clamp(P.vx,-RUN*1.2,RUN*1.2);if(P.slide<=0)P.vx=clamp(P.vx,-RUN,RUN);
  // jump
  if(P.buf>0){
    if((P.g||P.coy>0)&&!(P.slide>0&&ceil())){
      if(P.slide>0){P.slide=0;P.y-=24;P.h=48}
      P.vy=-JV;P.g=0;P.coy=0;P.buf=0;started=true;dust(P.x+P.w/2,P.y+P.h,6,160);
    }else if(!P.g&&P.aj>0&&P.slide<=0){P.vy=-JV2;P.aj=0;P.flip=.001;P.buf=0}
  }
  P.buf-=dt;
  if(keys.d&&P.g&&P.slide<=0&&Math.abs(P.vx)>120){P.slide=.55;P.y+=24;P.h=24;P.vx=P.face*Math.max(Math.abs(P.vx),RUN)*1.12;keys.d=0;started=true}
  P.vy=Math.min(P.vy+G*dt,1500);
  // x
  P.x+=P.vx*dt;
  for(const s of lv.sol){if(!hit(P,s))continue;
    if((P.g||P.coy>0)&&P.slide<=0&&s.y>=P.y+P.h-46&&Math.abs(P.vx)>180){P.y=s.y-P.h;P.vy=-300;P.g=0;P.vault=.32;continue}
    if(P.vx>0)P.x=s.x-P.w;else P.x=s.x+s.w;P.vx=0}
  // y
  const wasG=P.g,fall=P.vy;P.y+=P.vy*dt;P.g=0;
  for(const s of lv.sol){if(!hit(P,s))continue;
    if(P.vy>0){P.y=s.y-P.h;P.vy=0;P.g=1}else{P.y=s.y+s.h;P.vy=0}}
  if(P.g)P.gy=P.y+P.h;
  if(P.g){if(!wasG&&fall>500)dust(P.x+P.w/2,P.y+P.h,8,200);P.aj=1;P.coy=.1;P.flip=0}else P.coy-=dt;
  if(P.flip>0){P.flip+=dt/.45;if(P.flip>=1)P.flip=0}
  if(P.vault>0)P.vault-=dt;
  tPhase+=Math.abs(P.vx)*dt*.028;
  for(const c of lv.cps)if(P.g&&P.x>c.x&&(!cp||c.x>cp.x))cp=c;
  if(P.y>lv.finY+700||P.y>1300)respawn();
  if(P.x>lv.fin)finish();
}
function finish(){
  state='done';const b=save.best[lvn],rec=b==null||time<b;
  if(rec)save.best[lvn]=time;if(lvn<NLV)save.open=Math.max(save.open,lvn+1);store();
  $('dTitle').textContent=lvn===NLV?'Ты Мастер паркура!':'Финиш!';
  $('dTime').textContent=fmt(time);
  $('dInfo').innerHTML=(rec?'<span class="rec">Новый рекорд!</span> ':'Рекорд: '+fmt(b)+' с. ')+'Падений: '+deaths;
  $('next').disabled=lvn>=NLV;show('done');
}
let lastHud='';
function updHud(force){const s=lvn+'|'+time.toFixed(2)+'|'+deaths;if(!force&&s===lastHud)return;lastHud=s;
  $('lv').textContent='Трасса '+lvn;$('tm').textContent=fmt(time);$('dt').textContent='Падений: '+deaths;$('bs').textContent='Рекорд: '+fmt(save.best[lvn])}

// drawing
function resize(){const r=cv.parentElement.getBoundingClientRect();dpr=Math.min(window.devicePixelRatio||1,2);cv.width=Math.round(r.width*dpr);cv.height=Math.round(r.height*dpr);S=r.height/H;W=r.width/S}
const ro=new ResizeObserver(resize);ro.observe(cv.parentElement);
function hash(a,b,c){return((a*73856093^b*19349663^c*83492791)>>>0)}
function drawBg(){
  const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#2b1a4a');g.addColorStop(.55,'#b5487a');g.addColorStop(1,'#ffb86b');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  const sx=W*.72,sy=H*.5-cam.y*.04,sg=ctx.createRadialGradient(sx,sy,10,sx,sy,170);
  sg.addColorStop(0,'rgba(255,233,170,1)');sg.addColorStop(.35,'rgba(255,214,140,.9)');sg.addColorStop(.36,'rgba(255,200,130,.25)');sg.addColorStop(1,'rgba(255,180,120,0)');
  ctx.fillStyle=sg;ctx.fillRect(sx-170,sy-170,340,340);
  for(const L of sky){
    ctx.fillStyle=L.c;const off=((cam.x*L.p)%3000+3000)%3000,dy=-(cam.y+30)*L.p*.5;
    for(let rep=-1;rep*3000<W+3000;rep++)for(const b of L.a){const bx=b.x+rep*3000-off;if(bx>W||bx+b.w<0)continue;
      const top=H-b.h+dy+60;ctx.fillRect(bx,top,b.w,H-top+5);if(b.ant)ctx.fillRect(bx+b.w/2-2,top-30,4,30)}
  }
}
function drawWorld(){
  const x0=cam.x-50,x1=cam.x+W+50,yB=cam.y+H;
  for(const d of lv.deco){if(d.x<x0-80||d.x>x1)continue;ctx.fillStyle='#22153a';
    if(d.t===0){ctx.fillRect(d.x,d.y-60,6,60);ctx.fillRect(d.x+44,d.y-60,6,60);ctx.beginPath();ctx.ellipse(d.x+25,d.y-62,32,8,0,0,7);ctx.fill();ctx.fillRect(d.x-7,d.y-110,64,48);ctx.beginPath();ctx.moveTo(d.x-10,d.y-110);ctx.lineTo(d.x+25,d.y-135);ctx.lineTo(d.x+60,d.y-110);ctx.fill()}
    else{ctx.fillRect(d.x,d.y-120,4,120);ctx.fillRect(d.x-14,d.y-100,32,3);ctx.fillRect(d.x-8,d.y-80,20,3);ctx.fillStyle='#ff5d73';ctx.fillRect(d.x-1,d.y-126,6,6)}}
  for(const r of lv.roofs){if(r.x>x1||r.x+r.w<x0)continue;
    ctx.fillStyle='#24163a';ctx.fillRect(r.x,r.y,r.w,yB-r.y+10);
    ctx.fillStyle='#4a3468';ctx.fillRect(r.x-4,r.y,r.w+8,7);ctx.fillStyle='#160d26';ctx.fillRect(r.x-4,r.y+7,r.w+8,4);
    const j0=Math.max(0,Math.floor((cam.y-r.y-40)/46));
    for(let j=j0;r.y+40+j*46<yB;j++)for(let i=0,wx=r.x+20;wx<r.x+r.w-30;i++,wx+=38){
      const lit=hash(i,j,r.k+lvn*31)%6===0;ctx.fillStyle=lit?'#ffcf6b':'#2f1f4a';ctx.fillRect(wx,r.y+40+j*46,20,26)}}
  for(const s of lv.sol){if(s.roof||s.x>x1||s.x+s.w<x0)continue;
    if(s.box){ctx.fillStyle='#6a5f80';ctx.fillRect(s.x,s.y,s.w,s.h);ctx.fillStyle='#8f84a6';ctx.fillRect(s.x,s.y,s.w,4);ctx.fillStyle='#463d5a';
      for(let k=8;k<s.h-4;k+=6)ctx.fillRect(s.x+6,s.y+k,s.w-12,2)}
    else if(s.bill){ctx.fillStyle='#160c24';ctx.fillRect(s.x+8,s.y,8,s.h);ctx.fillRect(s.x+s.w-16,s.y,8,s.h);
      const py=s.y+s.h-120;ctx.fillStyle='#1b1029';ctx.fillRect(s.x-6,py-6,s.w+12,126);ctx.fillStyle='#ff5d73';ctx.fillRect(s.x,py,s.w,114);
      ctx.fillStyle='#ffd6dc';ctx.fillRect(s.x,py+s.h*0+108,s.w,6);
      ctx.fillStyle='#2a0f1c';ctx.font='26px "Russo One",sans-serif';ctx.textAlign='center';ctx.fillText('▼',s.x+s.w/2,py+52);ctx.font='14px Rubik,sans-serif';ctx.fillText('ПОДКАТ',s.x+s.w/2,py+80)}}
  for(const c of lv.cps){if(c.x<x0||c.x>x1)continue;const on=cp&&cp.x>=c.x;ctx.fillStyle='#d8c8ee';ctx.fillRect(c.x,c.y-56,3,56);
    ctx.fillStyle=on?'#ffd23f':'#8a7aa6';ctx.beginPath();ctx.moveTo(c.x+3,c.y-56);ctx.lineTo(c.x+28,c.y-47);ctx.lineTo(c.x+3,c.y-38);ctx.fill()}
  const f=lv.fin,fy=lv.finY;ctx.fillStyle='#e8dcf7';ctx.fillRect(f,fy-150,5,150);
  for(let i=0;i<4;i++)for(let j=0;j<3;j++){ctx.fillStyle=(i+j)%2?'#170e26':'#fff';ctx.fillRect(f+5+i*16,fy-150+j*14,16,14)}
  ctx.fillStyle='#ffd23f';ctx.font='22px "Russo One",sans-serif';ctx.textAlign='left';ctx.fillText('ФИНИШ',f+12,fy-160);
}
function seg(x,y,a,l){const ex=x+Math.sin(a)*l,ey=y+Math.cos(a)*l;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(ex,ey);ctx.stroke();return[ex,ey]}
function limb(x,y,a1,a2,l,col,w){ctx.strokeStyle=col;ctx.lineWidth=w;const[k1,k2]=seg(x,y,a1,l);seg(k1,k2,a2,l)}
function drawP(){
  const cx=P.x+P.w/2,fy=P.y+P.h;ctx.save();ctx.translate(cx,fy);ctx.scale(P.face,1);ctx.lineCap='round';
  let rot=0,piv=-24;
  if(P.slide>0){ctx.translate(-6,0);rot=-1.15;piv=0}
  if(P.flip>0){ctx.translate(0,-24);ctx.rotate(P.flip*Math.PI*2);ctx.translate(0,24)}
  if(P.vault>0)rot=.35;
  ctx.translate(0,piv);ctx.rotate(rot);ctx.translate(0,-piv);
  const t=tPhase,air=!P.g,run=P.g&&Math.abs(P.vx)>20&&P.slide<=0;
  let l1=0,l1b=0,l2=0,l2b=0,a1=.2,a1b=1,a2=-.2,a2b=.6;
  if(run){l1=Math.sin(t)*.85;l2=-l1;l1b=l1-1*Math.max(0,Math.sin(t+1.3));l2b=l2-1*Math.max(0,Math.sin(t+1.3+Math.PI));a1=-l1*.9;a2=-l2*.9;a1b=a1+1.3;a2b=a2+1.3}
  else if(air||P.flip>0){l1=1;l1b=-.2;l2=-.25;l2b=-1.1;a1=2.4;a1b=2.6;a2=-2;a2b=-2.4;if(P.flip>0){l1=1.6;l1b=0;l2=1.3;l2b=-.3;a1=1.2;a1b=.2;a2=1;a2b=0}}
  else if(P.slide>0){l1=1.1;l1b=1.4;l2=.6;l2b=1.3;a1=-.9;a1b=-.5;a2=1.2;a2b=1.8}
  const hy=-24;
  limb(0,hy,l2,l2b,13,'#120a1e',7);limb(0,-41,a2,a2b,10,'#c45a14',6);
  ctx.strokeStyle='#ff7a1a';ctx.lineWidth=11;ctx.beginPath();ctx.moveTo(0,hy);ctx.lineTo(1.5,-41);ctx.stroke();
  limb(0,hy,l1,l1b,13,'#2a1b3d',7);
  ctx.fillStyle='#f2c29b';ctx.beginPath();ctx.arc(3,-50,7.5,0,7);ctx.fill();ctx.fillStyle='#22122e';ctx.beginPath();ctx.arc(1,-52,7.5,Math.PI*.9,Math.PI*1.95);ctx.fill();
  limb(1,-41,a1,a1b,10,'#ff9a3c',6);
  ctx.restore();
}
function drawParts(dt){ctx.fillStyle='rgba(230,210,255,.6)';for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.l-=dt;if(p.l<=0){parts.splice(i,1);continue}p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=400*dt;ctx.globalAlpha=Math.min(1,p.l*2);ctx.fillRect(p.x-2,p.y-2,4,4)}ctx.globalAlpha=1}

let last=performance.now(),demo=0;
function frame(now){
  let dt=Math.min((now-last)/1000,1/30);last=now;
  if(state==='play'){let n=Math.ceil(dt/(1/120)),h=dt/n;while(n--)step(h);updHud()}
  if(state==='menu'||!lv){demo+=dt*90;if(!lv)load(1);cam.x=demo%(lv.fin-600)-200;const rr=lv.roofs.find(r=>cam.x+W*.4<r.x+r.w)||lv.roofs[0];cam.y+=(rr.y-330-cam.y)*Math.min(1,dt*2)}
  else{const ft=P.y+P.h,base=P.g||ft>P.gy+40?ft:P.gy,tx=P.x-W*.33+P.vx*.25,ty=base-H*.66;cam.x+=(tx-cam.x)*Math.min(1,dt*6);cam.y+=(ty-cam.y)*Math.min(1,dt*4)}
  ctx.setTransform(S*dpr,0,0,S*dpr,0,0);drawBg();ctx.save();ctx.translate(-Math.round(cam.x),-Math.round(cam.y));drawWorld();
  if(state!=='menu')drawP();drawParts(state==='pause'?0:dt);ctx.restore();
  requestAnimationFrame(frame);
}

// UI
const ovs=['menu','pause','done'];
function show(id){for(const o of ovs)$(o).hidden=o!==id;$('hud').hidden=id==='menu';if(id&&$(id).querySelector('button.main:not(:disabled)'))setTimeout(()=>{const b=$(id).querySelector('button.main:not(:disabled)');b&&b.focus()},30)}
function menu(){state='menu';demo=0;load(1);buildMenu();show('menu')}
function buildMenu(){$('lvls').innerHTML=Array.from({length:NLV},(_,i)=>{const n=i+1,lock=n>save.open;return`<button ${lock?'disabled':''} data-n="${n}" class="${n===save.open?'main':''}">Трасса ${n}<small>${lock?'закрыта':'рекорд '+fmt(save.best[n])}</small></button>`}).join('');
  setTimeout(()=>{const b=$('lvls').querySelector('.main');b&&b.focus()},30)}
function play(n){for(const k in keys)keys[k]=0;load(n);state='play';show(null);cv.focus&&cv.focus()}
$('lvls').addEventListener('click',e=>{const b=e.target.closest('button');if(b&&!b.disabled)play(+b.dataset.n)});
$('resume').onclick=()=>{state='play';show(null)};
$('restart').onclick=()=>play(lvn);$('again').onclick=()=>play(lvn);
$('tomenu').onclick=menu;$('menu2').onclick=menu;$('next').onclick=()=>{if(lvn<NLV)play(lvn+1)};
const km={ArrowLeft:'l',KeyA:'l',ArrowRight:'r',KeyD:'r',ArrowUp:'j',KeyW:'j',Space:'j',ArrowDown:'d',KeyS:'d',KeyC:'d'};
function press(k,on){
  if(k==='j'){if(on&&!keys.j)P&&(P.buf=.12);if(!on&&P&&P.vy<-350)P.vy=-350}
  if(k==='d'&&!on){keys.d=0;return}
  keys[k]=on?1:0;
}
addEventListener('keydown',e=>{
  if(state==='play'){const k=km[e.code];if(k){e.preventDefault();if(!e.repeat||k!=='j')press(k,1)}
    if(e.code==='KeyR')play(lvn);if(e.code==='KeyP'||e.code==='Escape'){state='pause';show('pause')}}
  else if(state==='pause'&&(e.code==='KeyP'||e.code==='Escape')){state='play';show(null)}
  else if(state==='done'&&e.code==='KeyR')play(lvn);
});
addEventListener('keyup',e=>{const k=km[e.code];if(k&&state==='play')press(k,0)});
addEventListener('blur',()=>{for(const k in keys)keys[k]=0});
for(const b of document.querySelectorAll('.touch button')){const k=b.dataset.k;
  b.addEventListener('pointerdown',e=>{e.preventDefault();if(state==='play')press(k,1)});
  for(const ev of['pointerup','pointercancel','pointerleave'])b.addEventListener(ev,()=>press(k,0))}
resize();menu();requestAnimationFrame(frame);
}
