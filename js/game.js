(function(){
'use strict';
window.LI=window.LI||{};
const $=id=>document.getElementById(id);
if(!window.THREE){$('loadmsg').textContent='The 3D engine could not load. Check your connection and reload.';return;}

/* ================= setup ================= */
const canvas=$('gl');
const TOUCH=!!(window.matchMedia&&matchMedia('(pointer:coarse)').matches);
const DPR=window.devicePixelRatio||1;
const Q=TOUCH?{grass:3800,pr:Math.min(DPR,1.5),seg:110,motes:120,snow:900,portalNear:26}:{grass:9000,pr:Math.min(DPR,1.75),seg:150,motes:220,snow:1500,portalNear:40};

const V3=(x,y,z)=>new THREE.Vector3(x,y,z);
const sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
const lerp=(a,b,t)=>a+(b-a)*t;
const damp=(k,dt)=>1-Math.exp(-k*dt);
const angLerp=(a,b,t)=>{const d=((b-a+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;return a+d*t;};
const easeIO=k=>k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;
const easeIn=k=>k*k*k;
const easeOut=k=>1-Math.pow(1-k,3);
function rng(seed){let s=seed%2147483647;if(s<=0)s+=2147483646;return()=>(s=s*16807%2147483647,(s-1)/2147483646);}

const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Q.pr);
const camera=new THREE.PerspectiveCamera(50,1,.1,700);
const innerCam=new THREE.PerspectiveCamera(50,1,.1,700);
const uTime={value:0};
const uPush={value:V3(999,0,999)};

/* shared look: 3-step toon ramp, ink outlines, soft blob shadows */
const GRAD=new THREE.DataTexture(new Uint8Array([72,152,255]),3,1,THREE.LuminanceFormat);
GRAD.minFilter=GRAD.magFilter=THREE.NearestFilter;GRAD.generateMipmaps=false;GRAD.needsUpdate=true;
function glowTex(){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.3,'rgba(255,255,255,.55)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);}
const GLOW=glowTex();
const G={
  sph:new THREE.SphereGeometry(1,20,16), sphLo:new THREE.SphereGeometry(1,10,8),
  half:new THREE.SphereGeometry(1,20,10,0,Math.PI*2,0,Math.PI/2),
  cyl:new THREE.CylinderGeometry(1,1,1,16), box:new THREE.BoxGeometry(1,1,1),
  cone:new THREE.ConeGeometry(1,1,16), pyr:new THREE.ConeGeometry(1,1,4).rotateY(Math.PI/4),
  circle:new THREE.CircleGeometry(1,24), ico:new THREE.IcosahedronGeometry(1,2), dode:new THREE.DodecahedronGeometry(1,0),
  smile:new THREE.TorusGeometry(1,.22,6,14,Math.PI)
};
const MC={};
const toon=c=>MC['t'+c]||(MC['t'+c]=new THREE.MeshToonMaterial({color:c,gradientMap:GRAD}));
const basic=c=>MC['b'+c]||(MC['b'+c]=new THREE.MeshBasicMaterial({color:c}));
const OUTM=new THREE.MeshBasicMaterial({color:'#2a1f3d',side:THREE.BackSide});
const SHADOWM=new THREE.MeshBasicMaterial({color:'#2a1f3d',map:GLOW,transparent:true,opacity:.34,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
const BLUSH=new THREE.MeshBasicMaterial({color:'#ff8a8a',transparent:true,opacity:.5,depthWrite:false});
function M(geo,mat,x,y,z,parent){const m=new THREE.Mesh(geo,mat);m.position.set(x||0,y||0,z||0);if(parent)parent.add(m);return m;}
function ol(m,s){const o=new THREE.Mesh(m.geometry,OUTM);o.scale.setScalar(s||1.06);m.add(o);return m;}
function blob(parent,size){const s=M(G.circle,SHADOWM,0,.04,0,parent);s.rotation.x=-Math.PI/2;s.scale.setScalar(size);return s;}
function glowSprite(color,size,op){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color,transparent:true,opacity:op==null?.85:op,blending:THREE.AdditiveBlending,depthWrite:false}));s.scale.setScalar(size);return s;}

function makeSky(top,mid,bot,sunDir,sunCol,sunSize){
  const m=new THREE.ShaderMaterial({uniforms:{top:{value:new THREE.Color(top)},mid:{value:new THREE.Color(mid)},bot:{value:new THREE.Color(bot)},sunDir:{value:sunDir.clone().normalize()},sunCol:{value:new THREE.Color(sunCol)},sunSize:{value:sunSize}},
    vertexShader:'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform vec3 top,mid,bot,sunDir,sunCol;uniform float sunSize;varying vec3 vD;void main(){vec3 d=normalize(vD);float y=d.y;vec3 c=y>0.?mix(mid,top,pow(clamp(y,0.,1.),.55)):mix(mid,bot,pow(clamp(-y,0.,1.),.6));float s=max(dot(d,sunDir),0.);c+=sunCol*(smoothstep(1.-sunSize,1.-sunSize*.5,s)+pow(s,24.)*.12+pow(s,3.)*.035);gl_FragColor=vec4(c,1.);}',
    side:THREE.BackSide,depthWrite:false});
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(320,32,16),m);mesh.renderOrder=-10;mesh.frustumCulled=false;return mesh;
}
function makeTerrain(size,seg,hFn,colFn){
  const g=new THREE.PlaneGeometry(size,size,seg,seg);g.rotateX(-Math.PI/2);
  const p=g.attributes.position,cols=new Float32Array(p.count*3),c=new THREE.Color();
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),y=hFn(x,z);p.setY(i,y);colFn(x,z,y,c);cols[i*3]=c.r;cols[i*3+1]=c.g;cols[i*3+2]=c.b;}
  g.setAttribute('color',new THREE.BufferAttribute(cols,3));g.computeVertexNormals();
  return new THREE.Mesh(g,new THREE.MeshToonMaterial({vertexColors:true,gradientMap:GRAD}));
}
function particles(n,box,color,size,op,vy,add){
  const p=new Float32Array(n*3),seeds=new Float32Array(n);
  for(let i=0;i<n;i++){p[i*3]=(Math.random()-.5)*box[0];p[i*3+1]=Math.random()*box[1];p[i*3+2]=(Math.random()-.5)*box[2];seeds[i]=Math.random()*6.28;}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(p,3));
  const pts=new THREE.Points(geo,new THREE.PointsMaterial({color,size,map:GLOW,transparent:true,opacity:op,depthWrite:false,blending:add?THREE.AdditiveBlending:THREE.NormalBlending}));
  pts.frustumCulled=false;
  const wrap=(v,c,s)=>{let d=v-(c-s/2);d=((d%s)+s)%s;return c-s/2+d;};
  return {pts,update(dt,t,c){for(let i=0;i<n;i++){const k=i*3;p[k]+=Math.sin(t*.7+seeds[i])*dt*.35;p[k+1]+=vy*dt;p[k+2]+=Math.cos(t*.6+seeds[i])*dt*.25;
    p[k]=wrap(p[k],c.x,box[0]);p[k+1]=wrap(p[k+1],c.y,box[1]);p[k+2]=wrap(p[k+2],c.z,box[2]);}geo.attributes.position.needsUpdate=true;}};
}
function grassField(parent,count,accept,hFn,seed,base,tip){
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array([-.055,0,0, .055,0,0, -.035,.32,0, .035,.32,0, 0,.66,0]),3));
  const b=new THREE.Color(base),t=new THREE.Color(tip),m=b.clone().lerp(t,.5);
  geo.setAttribute('color',new THREE.BufferAttribute(new Float32Array([b.r,b.g,b.b,b.r,b.g,b.b,m.r,m.g,m.b,m.r,m.g,m.b,t.r,t.g,t.b]),3));
  geo.setIndex([0,1,2,1,3,2,2,3,4]);
  const mat=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide});
  mat.onBeforeCompile=sh=>{sh.uniforms.uTime=uTime;sh.uniforms.uPush=uPush;
    sh.vertexShader='uniform float uTime;\nuniform vec3 uPush;\n'+sh.vertexShader.replace('#include <project_vertex>',[
      'vec4 mvPosition=vec4(transformed,1.);',
      '#ifdef USE_INSTANCING','mvPosition=instanceMatrix*mvPosition;','#endif',
      'vec4 wpos=modelMatrix*mvPosition;float hh=position.y;',
      'float sw=sin(uTime*1.8+wpos.x*.35+wpos.z*.27)*.16+sin(uTime*3.1+wpos.x*.9)*.04;',
      'wpos.x+=sw*hh;wpos.z+=sw*.4*hh;',
      'vec2 aw=wpos.xz-uPush.xz;float dd=length(aw);float pf=1.-smoothstep(.3,1.5,dd);',
      'wpos.xz+=(dd>.001?aw/dd:vec2(0.))*pf*.55*hh;wpos.y-=pf*.25*hh;',
      'mvPosition=viewMatrix*wpos;gl_Position=projectionMatrix*mvPosition;'].join('\n'));};
  const im=new THREE.InstancedMesh(geo,mat,count);
  const r=rng(seed),m4=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),p=new THREE.Vector3(),s=new THREE.Vector3(),col=new THREE.Color();
  let n=0,tries=0;
  while(n<count&&tries<count*8){tries++;const x=(r()-.5)*70,z=(r()-.5)*70;if(!accept(x,z))continue;
    const sc=.75+r()*.7;e.set(0,r()*6.28,0);q.setFromEuler(e);m4.compose(p.set(x,hFn(x,z)-.02,z),q,s.set(sc,sc*(.8+r()*.5),sc));im.setMatrixAt(n,m4);
    col.setHSL(0,0,.88+r()*.18);im.setColorAt(n,col);n++;}
  im.count=n;im.frustumCulled=false;parent.add(im);return im;
}
function forest(parent,spots,hFn,o){
  const n=spots.length;if(!n)return;
  const trunk=new THREE.InstancedMesh(o.trunkGeo||new THREE.CylinderGeometry(.18,.28,1.6,7),toon(o.trunk),n);
  const blobsDef=o.blobs,per=blobsDef.length;
  const fol=new THREE.InstancedMesh(o.folGeo||G.ico,new THREE.MeshToonMaterial({color:'#ffffff',gradientMap:GRAD}),n*per);
  const folO=new THREE.InstancedMesh(o.folGeo||G.ico,OUTM,n*per);
  const sh=new THREE.InstancedMesh(G.circle,SHADOWM,n);
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),p=new THREE.Vector3(),sc=new THREE.Vector3(),col=new THREE.Color(),e=new THREE.Euler();
  const flat=new THREE.Quaternion().setFromAxisAngle(V3(1,0,0),-Math.PI/2);
  spots.forEach((t,i)=>{const y=hFn(t.x,t.z);
    m4.compose(p.set(t.x,y+.8*t.s,t.z),q.identity(),sc.set(t.s,t.s,t.s));trunk.setMatrixAt(i,m4);
    blobsDef.forEach((b,k)=>{const r=b[3]*t.s;p.set(t.x+b[0]*t.s,y+b[1]*t.s,t.z+b[2]*t.s);e.set(0,t.rot+k,0);q.setFromEuler(e);
      m4.compose(p,q,sc.set(r*(b[4]||1),r*(b[5]||.92),r*(b[4]||1)));fol.setMatrixAt(i*per+k,m4);
      m4.compose(p,q,sc.set(r*(b[4]||1)*1.06+.04,r*(b[5]||.92)*1.06+.04,r*(b[4]||1)*1.06+.04));folO.setMatrixAt(i*per+k,m4);
      col.set(o.colors[(i+k)%o.colors.length]);if(b[6])col.set(b[6]);fol.setColorAt(i*per+k,col);});
    m4.compose(p.set(t.x,y+.05,t.z),flat,sc.set(1.7*t.s,1.7*t.s,1));sh.setMatrixAt(i,m4);});
  parent.add(trunk,fol,folO,sh);
}

/* ================= characters ================= */
function makeChar(o){
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const s=o.scale||1;body.scale.setScalar(s);
  const legs=[-1,1].map(side=>{const p=new THREE.Group();p.position.set(side*.13,.42,0);body.add(p);
    const l=M(G.cyl,toon(o.pants),0,-.18,0,p);l.scale.set(.085,.36,.085);
    const f=M(G.sph,toon(o.shoes||'#5a4038'),0,-.37,.05,p);f.scale.set(.11,.08,.15);return p;});
  const torso=M(G.sph,toon(o.shirt),0,.76,0,body);torso.scale.set(.34,.4,.3);ol(torso,1.09);
  const arms=[-1,1].map(side=>{const p=new THREE.Group();p.position.set(side*.31,.98,0);body.add(p);
    const a=M(G.cyl,toon(o.sleeve||o.shirt),0,-.17,0,p);a.scale.set(.075,.32,.075);
    M(G.sph,toon(o.skin),0,-.36,0,p).scale.setScalar(.088);p.rotation.z=side*.14;return p;});
  const head=new THREE.Group();head.position.set(0,1.36,0);body.add(head);
  const skull=M(G.sph,toon(o.skin),0,0,0,head);skull.scale.set(.37,.35,.35);ol(skull,1.07);
  const eM=basic('#221a2c');
  [-1,1].forEach(side=>{const e=M(G.sph,eM,side*.13,.02,.31,head);e.scale.set(.046,.066,.03);
    M(G.sphLo,basic('#ffffff'),side*.13+.015,.045,.335,head).scale.setScalar(.014);
    const ch=M(G.circle,BLUSH,side*.205,-.075,.295,head);ch.scale.setScalar(.055);ch.rotation.y=side*.5;});
  const mouth=M(G.smile,eM,0,-.1,.33,head);mouth.scale.setScalar(.045);mouth.rotation.z=Math.PI;
  const H=o.hair,st=o.style;
  if(st==='player'){const h=M(G.sph,toon(H),0,.11,-.04,head);h.scale.set(.385,.29,.37);ol(h,1.06);
    const t=M(G.cone,toon(H),.08,.36,.06,head);t.scale.set(.09,.16,.09);t.rotation.z=-.5;
    const sc=M(new THREE.TorusGeometry(.26,.075,8,18),toon(o.scarf),0,1.14,0,body);sc.rotation.x=Math.PI/2;ol(sc,1.08);
    const tail=M(G.box,toon(o.scarf),.12,1.0,-.22,body);tail.scale.set(.1,.26,.05);tail.rotation.z=.25;}
  if(st==='player'&&o.gender==='f'){const bk=M(G.sph,toon(H),0,-.1,-.15,head);bk.scale.set(.36,.42,.24);ol(bk,1.05);
    const pt=M(G.cone,toon(H),0,-.14,-.36,head);pt.scale.set(.1,.34,.1);pt.rotation.x=-2.7;ol(pt,1.06);}
  if(st==='mira'){const h=M(G.sph,toon(H),0,-.04,-.07,head);h.scale.set(.4,.43,.36);ol(h,1.05);
    const br=M(G.cyl,toon(o.hat),0,.26,0,head);br.scale.set(.64,.035,.64);br.rotation.x=-.12;ol(br,1.05);
    const cr=M(G.cyl,toon(o.hat),0,.37,-.03,head);cr.scale.set(.31,.22,.31);ol(cr,1.06);
    M(G.cyl,toon('#e86a6a'),0,.31,-.03,head).scale.set(.322,.06,.322);
    const skirt=M(G.cone,toon(o.shirt),0,.5,0,body);skirt.scale.set(.36,.42,.33);ol(skirt,1.07);}
  if(st==='tobi'){const bn=M(G.half,toon(o.hat),0,.06,0,head);bn.scale.set(.39,.36,.38);ol(bn,1.05);
    M(G.cyl,toon(o.hat),0,.07,0,head).scale.set(.395,.08,.385);
    M(G.sph,toon('#f1e9df'),0,.45,0,head).scale.setScalar(.09);
    const bd=M(G.sph,toon(o.beard),0,-.2,.16,head);bd.scale.set(.3,.25,.22);ol(bd,1.06);
    M(G.sph,toon(o.beard),0,-.085,.31,head).scale.set(.17,.055,.07);
    [-1,1].forEach(side=>{const b=M(G.box,toon(o.beard),side*.13,.12,.32,head);b.scale.set(.12,.035,.03);b.rotation.z=-side*.15;});
    head.position.z=.05;}
  if(st==='pip'){const h=M(G.sph,toon(H),0,.08,-.05,head);h.scale.set(.38,.27,.36);
    const cap=M(G.half,toon(o.hat),0,.1,0,head);cap.scale.set(.385,.3,.375);ol(cap,1.05);
    const vis=M(G.cyl,toon(o.hat),0,.11,.3,head);vis.scale.set(.22,.02,.17);
    const prop=new THREE.Group();prop.position.y=.42;head.add(prop);M(G.cyl,toon('#6b5a7a'),0,-.03,0,prop).scale.set(.02,.1,.02);
    [0,Math.PI/2].forEach(a=>{const b=M(G.box,toon('#5bb6ff'),0,.03,0,prop);b.scale.set(.5,.02,.08);b.rotation.y=a;});
    root.userData.prop=prop;}
  const shadow=blob(root,.55*s);
  return {root,body,legs,arms,head,phase:0,seed:Math.random()*6,s,shadow,moving:0};
}
function makeFox(){
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const O='#f0893f',W='#e9e0d8',D='#4a2c2a';
  const torso=M(G.sph,toon(O),0,.6,0,body);torso.scale.set(.36,.33,.55);ol(torso,1.07);
  M(G.sph,toon(W),0,.56,.3,body).scale.set(.25,.26,.22);
  [[-.18,.3],[.18,.3],[-.18,-.3],[.18,-.3]].forEach(([x,z])=>{M(G.cyl,toon(D),x,.22,z,body).scale.set(.07,.42,.07);});
  const head=new THREE.Group();head.position.set(0,1.0,.42);body.add(head);
  const sk=M(G.sph,toon(O),0,0,0,head);sk.scale.set(.3,.27,.27);ol(sk,1.07);
  M(G.sph,toon(W),0,-.07,.2,head).scale.set(.15,.11,.18);
  M(G.sph,basic('#2a1f2a'),0,-.03,.38,head).scale.setScalar(.045);
  [-1,1].forEach(side=>{const e=M(G.cone,toon(O),side*.15,.28,-.02,head);e.scale.set(.12,.28,.08);e.rotation.z=-side*.28;ol(e,1.1);
    M(G.cone,toon(W),side*.15,.26,.03,head).scale.set(.06,.18,.03);
    const ey=M(G.smile,basic('#221a2c'),side*.11,.05,.24,head);ey.scale.setScalar(.04);});
  const tail=new THREE.Group();tail.position.set(0,.68,-.48);body.add(tail);
  [[0,.08,-.14,.15,O],[0,.2,-.34,.2,O],[0,.33,-.55,.22,O]].forEach(b=>{const m=M(G.sph,toon(b[4]),b[0],b[1],b[2],tail);m.scale.setScalar(b[3]);ol(m,1.07);});
  M(G.sph,basic('#c8fbff'),0,.43,-.76,tail).scale.setScalar(.19);
  const tg=glowSprite('#8ff3ff',1.6,.9);tg.position.set(0,.43,-.76);tail.add(tg);
  const sparks=[];for(let i=0;i<5;i++){const sp=glowSprite('#bff8ff',.35,.9);root.add(sp);sparks.push(sp);}
  blob(root,.7);
  return {root,body,head,tail,sparks};
}
function marker(){const g=new THREE.Group();const m=basic('#ffd34d');
  const bar=M(G.cyl,m,0,.2,0,g);bar.scale.set(.075,.3,.075);ol(bar,1.35);
  const dot=M(G.sph,m,0,-.06,0,g);dot.scale.setScalar(.08);ol(dot,1.35);g.scale.setScalar(1.15);return g;}

/* ================= HUB: Lumen Isle ================= */
const R=34, HILL={x:13,z:-13};
const PATHS=[[[0,0],[5,-6],[9.5,-9.6],[11.6,-11.4]],[[0,0],[-8,7],[-14,11],[-18.2,13.6]],[[0,0],[-4.5,-2.8],[-6.6,-4.2]],[[0,0],[5,3],[6.2,3.6]],[[0,0],[-2,6],[-2.8,7.6]],[[0,0],[9,6],[13.8,8.1]]];
function segDist(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1];let t=((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz);t=Math.max(0,Math.min(1,t));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);}
function pathDist(x,z){let d=Math.max(0,Math.hypot(x,z)-4.2);for(const P of PATHS)for(let i=0;i<P.length-1;i++)d=Math.min(d,segDist(x,z,P[i],P[i+1]));return d;}
function hubH(x,z){const r=Math.hypot(x,z);const land=1-sm(R-9,R,r);const flat=sm(6,13,r),inner=1-sm(17,25,r);
  let hills=(Math.sin(x*.13)*Math.cos(z*.11)*1.1+Math.sin(x*.31+z*.2)*.35)*flat*inner;
  hills+=4.4*Math.exp(-((x-HILL.x)*(x-HILL.x)+(z-HILL.z)*(z-HILL.z))/75);
  return lerp(-2.6,1.2+hills,land);}
const TMPC=new THREE.Color();
function hubCol(x,z,y,c){const n=Math.sin(x*.5)*Math.cos(z*.43)+Math.sin(x*.17+z*.29);
  if(y<.5){c.set(y<.05?'#cfae7c':'#e3c792');return;}
  c.set('#77c46a').lerp(TMPC.set('#a3d673'),(n+2)/4);
  if(y<.85)c.lerp(TMPC.set('#e3c792'),.55);
  const pd=pathDist(x,z);if(pd<1.3)c.lerp(TMPC.set('#e2c592'),pd<.95?1:.45);}
let shoreR=28;{let lo=20,hi=34;for(let i=0;i<30;i++){const mid=(lo+hi)/2;if(hubH(mid,0)>0)lo=mid;else hi=mid;}shoreR=lo;}

const S={mira:'new',fire:0,tobi:'new',lens:false,pip:'new',globe:false,fox:'new',stars:0,inside:false};

function buildHub(){
  const W={key:'hub',scene:new THREE.Scene(),npcs:[],colliders:[],inter:[],h:hubH,exposure:1.13,sat:1.1,anim:[]};
  const sc=W.scene;sc.fog=new THREE.Fog('#efcab3',40,160);
  const sunDir=V3(.55,.3,-.78).normalize();
  W.sky=makeSky('#5c97df','#f3cbae','#8fb7da',sunDir,'#fff0cc',.0024);sc.add(W.sky);
  sc.add(new THREE.HemisphereLight('#c3cdff','#8a6f7a',.4));
  const dl=new THREE.DirectionalLight('#ffd9ad',.62);dl.position.copy(sunDir).multiplyScalar(60);sc.add(dl);
  W.walk=(x,z)=>hubH(x,z)>.32&&Math.hypot(x,z)<R-4;

  sc.add(makeTerrain(2*R+20,Q.seg,hubH,hubCol));
  // stylised sea with foam bands
  const water=new THREE.Mesh(new THREE.PlaneGeometry(700,700,1,1),new THREE.ShaderMaterial({
    uniforms:{uTime,uR:{value:shoreR},uDeep:{value:new THREE.Color('#3a86b4')},uShallow:{value:new THREE.Color('#5fcfca')},uFoam:{value:new THREE.Color('#e9e6db')},fogC:{value:sc.fog.color},fogN:{value:40},fogF:{value:220}},
    vertexShader:'varying vec3 vW;varying float vDepth;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vec4 mv=viewMatrix*w;vDepth=-mv.z;gl_Position=projectionMatrix*mv;}',
    fragmentShader:'uniform float uTime,uR,fogN,fogF;uniform vec3 uDeep,uShallow,uFoam,fogC;varying vec3 vW;varying float vDepth;'+
      'float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}'+
      'void main(){float r=length(vW.xz);float d=clamp((r-uR)/26.,0.,1.);vec3 col=mix(uShallow,uDeep,smoothstep(0.,1.,d));'+
      'float w=sin(vW.x*.35+uTime*.8)*.5+sin(vW.z*.29-uTime*.6)*.5;col+=w*.025;'+
      'float band=fract((r-uR)*.42-uTime*.32);float foam=(smoothstep(0.,.05,band)-smoothstep(.07,.15,band))*(1.-smoothstep(0.,.32,d));'+
      'foam+=1.-smoothstep(.0,.035,d+sin(atan(vW.z,vW.x)*9.+uTime*1.3)*.01);'+
      'vec2 cell=floor(vW.xz*1.3);float sp=step(.986,hash(cell))*step(.6,fract(uTime*.4+hash(cell+3.1)));'+
      'col=mix(col,uFoam,clamp(foam,0.,1.)*.9);col+=sp*.3*(1.-d*.6);'+
      'col=mix(col,fogC,smoothstep(fogN,fogF,vDepth));gl_FragColor=vec4(col,1.);}'}));
  water.rotation.x=-Math.PI/2;water.position.y=-.02;sc.add(water);

  const col=W.colliders;
  // fountain plaza
  {const g=new THREE.Group();g.position.y=hubH(0,0);sc.add(g);
    ol(M(G.cyl,toon('#cdbfd9'),0,.3,0,g),1.04).scale.set(1.7,.6,1.7);
    M(G.cyl,basic('#8fd8ea'),0,.58,0,g).scale.set(1.5,.06,1.5);
    ol(M(G.cyl,toon('#cdbfd9'),0,1.1,0,g),1.1).scale.set(.22,1.2,.22);
    ol(M(G.cyl,toon('#cdbfd9'),0,1.7,0,g),1.06).scale.set(.7,.2,.7);
    const jet=M(G.cone,new THREE.MeshBasicMaterial({color:'#bff0fa',transparent:true,opacity:.75}),0,2.1,0,g);jet.scale.set(.15,.6,.15);
    W.anim.push((dt,t)=>{jet.scale.y=.55+Math.sin(t*6)*.08;});
    col.push({x:0,z:0,r:1.9});}
  // houses
  const smoke=[];
  function house(x,z,rot,wall,roof){const y=hubH(x,z)-.1;const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rot;sc.add(g);
    ol(M(G.box,toon(wall),0,1.2,0,g),1.03).scale.set(3,2.4,2.8);
    ol(M(G.pyr,toon(roof),0,3.2,0,g),1.04).scale.set(2.6,1.6,2.45);
    ol(M(G.box,toon('#9a6b5a'),.8,3.5,-.5,g),1.08).scale.set(.4,1.1,.4);
    M(G.box,toon('#7a4f3a'),0,.72,1.42,g).scale.set(.72,1.34,.08);
    M(G.sph,basic('#f2c14e'),.22,.72,1.48,g).scale.setScalar(.05);
    [-.95,.95].forEach(wx=>{M(G.box,toon('#f1e4cf'),wx,1.5,1.41,g).scale.set(.66,.66,.05);M(G.box,basic('#ffe39b'),wx,1.5,1.44,g).scale.set(.5,.5,.04);});
    M(G.box,basic('#ffe39b'),1.51,1.5,0,g).scale.set(.05,.5,.5);
    M(G.box,toon('#c7b6a6'),0,.08,1.78,g).scale.set(1.1,.16,.6);
    const cw=g.localToWorld(V3(.8,4.1,-.5));for(let i=0;i<4;i++){const p=M(G.sphLo,new THREE.MeshBasicMaterial({color:'#e2d8e2',transparent:true,opacity:.7,depthWrite:false}),cw.x,cw.y,cw.z,sc);p.userData={o:cw.clone(),k:i/4};smoke.push(p);}
    col.push({x,z,r:2.25});return g;}
  const miraHouse=house(-9,-6.2,.6,'#e8d3b6','#d9775a');
  house(8.4,5,-2.2,'#d6dff0','#5f86c9');
  house(-4.2,10.4,2.9,'#f0d9c9','#8a6bbf');
  W.anim.push((dt,t)=>{smoke.forEach(p=>{const k=(t*.18+p.userData.k)%1;p.position.set(p.userData.o.x+Math.sin(k*6)*.2,p.userData.o.y+k*2.6,p.userData.o.z);p.scale.setScalar(.18+k*.45);p.material.opacity=.7*(1-k);});});
  // windmill
  {const x=16.5,z=9.5,y=hubH(x,z)-.2;const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=-2.2;sc.add(g);
    ol(M(new THREE.CylinderGeometry(.85,1.35,5,12),toon('#eadcc6'),0,2.5,0,g),1.04);
    ol(M(new THREE.ConeGeometry(1.15,1.4,12),toon('#c96a5a'),0,5.7,0,g),1.05);
    M(G.box,toon('#7a4f3a'),0,.6,1.2,g).scale.set(.6,1.1,.2);
    const hub=new THREE.Group();hub.position.set(0,4.9,1.05);g.add(hub);ol(M(G.sph,toon('#7a4f3a'),0,0,0,hub),1.1).scale.setScalar(.22);
    for(let i=0;i<4;i++){const arm=new THREE.Group();arm.rotation.z=i*Math.PI/2;hub.add(arm);ol(M(G.box,toon('#e1d3be'),.0,1.6,.05,arm),1.05).scale.set(.55,2.8,.06);M(G.box,toon('#8a6050'),0,.9,0,arm).scale.set(.08,1.8,.08);}
    W.anim.push((dt)=>{hub.rotation.z-=dt*.6;});col.push({x,z,r:1.6});}
  // dock + boat
  {const dir=V3(-.78,0,.62).normalize(),start=V3(-20.2,0,15.4);
    for(let i=0;i<9;i++){const p=start.clone().addScaledVector(dir,i*.62);const pl=M(G.box,toon(i%2?'#a37b5a':'#b08866'),p.x,.42,p.z,sc);pl.scale.set(1.5,.12,.56);pl.rotation.y=Math.atan2(dir.x,dir.z)+Math.PI/2;
      if(i%3===0)[-1,1].forEach(sd=>{const q=p.clone().add(V3(-dir.z,0,dir.x).multiplyScalar(sd*.7));M(G.cyl,toon('#7a5640'),q.x,0,q.z,sc).scale.set(.1,1.4,.1);});}
    const boat=new THREE.Group();boat.position.set(-23.5,0,22.4);boat.rotation.y=.8;sc.add(boat);
    ol(M(G.sph,toon('#e07a5f'),0,.1,0,boat),1.05).scale.set(.75,.35,1.5);M(G.box,toon('#f1e4cf'),0,.3,0,boat).scale.set(1.1,.08,1.8);
    W.anim.push((dt,t)=>{boat.position.y=Math.sin(t*1.4)*.08;boat.rotation.z=Math.sin(t*1.1)*.05;});}
  // lantern posts (instanced)
  {const spots=[];PATHS.forEach((P,pi)=>{for(let i=0;i<P.length-1;i++){const a=P[i],b=P[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let d=3;d<len;d+=6){const t=d/len,x=lerp(a[0],b[0],t),z=lerp(a[1],b[1],t);const nx=-(b[1]-a[1])/len,nz=(b[0]-a[0])/len;spots.push([x+nx*1.5,z+nz*1.5]);}}});
    const n=spots.length,posts=new THREE.InstancedMesh(G.cyl,toon('#4a3b52'),n),lamps=new THREE.InstancedMesh(G.box,basic('#fff0b5'),n),caps=new THREE.InstancedMesh(G.pyr,toon('#4a3b52'),n);
    const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),p=new THREE.Vector3(),s=new THREE.Vector3();
    spots.forEach(([x,z],i)=>{const y=hubH(x,z);m4.compose(p.set(x,y+.85,z),q,s.set(.07,1.7,.07));posts.setMatrixAt(i,m4);m4.compose(p.set(x,y+1.85,z),q,s.set(.3,.36,.3));lamps.setMatrixAt(i,m4);m4.compose(p.set(x,y+2.15,z),q,s.set(.3,.22,.3));caps.setMatrixAt(i,m4);col.push({x,z,r:.25});});
    sc.add(posts,lamps,caps);}
  // trees
  const r=rng(42),spots=[];let tries=0;
  while(spots.length<(TOUCH?32:44)&&tries<4000){tries++;const a=r()*6.28,d=9+r()*16.5,x=Math.cos(a)*d,z=Math.sin(a)*d;
    if(hubH(x,z)<1||pathDist(x,z)<2.4||Math.hypot(x-HILL.x,z-HILL.z)<4.5)continue;
    if(col.some(c=>Math.hypot(x-c.x,z-c.z)<c.r+2.2))continue;if(spots.some(s=>Math.hypot(x-s.x,z-s.z)<2.6))continue;
    if(Math.hypot(x+5.5,z+3.4)<3.5)continue;
    const s=.85+r()*.5;spots.push({x,z,s,rot:r()*6});col.push({x,z,r:.45*s});}
  forest(sc,spots,hubH,{trunk:'#8a5d44',colors:['#5fae6b','#74c274','#4f9e66','#88c96e'],blobs:[[0,2.4,0,1.3],[.75,1.85,.3,.9],[-.65,1.95,-.35,.92],[.1,3.2,-.1,.75]]});
  // rocks + flowers
  {const rr=rng(7),n=16,rocks=new THREE.InstancedMesh(G.dode,toon('#b3a6c3'),n),ro=new THREE.InstancedMesh(G.dode,OUTM,n);const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),p=new THREE.Vector3(),s=new THREE.Vector3();let k=0;
    while(k<n){const a=rr()*6.28,d=8+rr()*19,x=Math.cos(a)*d,z=Math.sin(a)*d;if(pathDist(x,z)<2||col.some(c=>Math.hypot(x-c.x,z-c.z)<c.r+1))continue;const sz=.35+rr()*.55;e.set(rr()*3,rr()*3,0);q.setFromEuler(e);
      m4.compose(p.set(x,hubH(x,z)+sz*.3,z),q,s.set(sz,sz*.75,sz));rocks.setMatrixAt(k,m4);m4.compose(p,q,s.set(sz*1.08,sz*.75*1.08,sz*1.08));ro.setMatrixAt(k,m4);k++;}
    sc.add(rocks,ro);
    const fl=new THREE.InstancedMesh(G.ico,new THREE.MeshToonMaterial({color:'#ffffff',gradientMap:GRAD}),TOUCH?220:420),fc=['#ff9fb5','#ffd166','#ffffff','#c9a7ff','#ff8a6b'],c=new THREE.Color();k=0;
    while(k<fl.count){const x=(rr()-.5)*52,z=(rr()-.5)*52,y=hubH(x,z);if(y<1||pathDist(x,z)<1.6||col.some(cc=>Math.hypot(x-cc.x,z-cc.z)<cc.r+.3))continue;m4.compose(p.set(x,y+.32,z),q.identity(),s.setScalar(.085));fl.setMatrixAt(k,m4);c.set(fc[k%fc.length]);if(k%fc.length===2)c.set('#f4eee6');fl.setColorAt(k,c);k++;}
    sc.add(fl);}
  // grass
  grassField(sc,Q.grass,(x,z)=>{const y=hubH(x,z);return y>.95&&Math.hypot(x,z)<26&&pathDist(x,z)>1.5&&!col.some(c=>Math.hypot(x-c.x,z-c.z)<c.r+.15)&&Math.hypot(x-HILL.x-.5,z-HILL.z+1.5)>2.2;},hubH,99,'#3f8a52','#b5dd78');
  // sky clouds
  {const cr=rng(3);for(let i=0;i<11;i++){const g=new THREE.Group();const a=i/11*6.28+cr(),d=110+cr()*60;g.position.set(Math.cos(a)*d,32+cr()*22,Math.sin(a)*d);g.lookAt(0,g.position.y,0);
    for(let j=0;j<5;j++){M(G.sph,toon('#dccbdb'),(j-2)*4.2+cr()*2,cr()*2.5-(Math.abs(j-2)*1.2),cr()*2,g).scale.set(4.5+cr()*2.5,3.4+cr()*2,3.6);}sc.add(g);g.userData.a=a;g.userData.d=d;W.anim.push((dt,t)=>{g.userData.a+=dt*.004;g.position.x=Math.cos(g.userData.a)*g.userData.d;g.position.z=Math.sin(g.userData.a)*g.userData.d;g.lookAt(0,g.position.y,0);});}}
  // butterflies
  {const cols=['#ff9fb5','#ffd166','#9fd3ff','#c9a7ff'];for(let i=0;i<6;i++){const b=new THREE.Group();const wings=[-1,1].map(sd=>{const w=new THREE.Group();b.add(w);const m=M(G.circle,new THREE.MeshToonMaterial({color:cols[i%4],gradientMap:GRAD,side:THREE.DoubleSide}),sd*.13,0,0,w);m.scale.set(.15,.11,1);m.rotation.x=-Math.PI/2;return w;});sc.add(b);
    const cx=(i%3-1)*12+3,cz=(i<3?-6:8),ph=i*1.7;W.anim.push((dt,t)=>{const tt=t*.5+ph;const x=cx+Math.sin(tt)*3.2,z=cz+Math.sin(tt*1.7)*2.2;b.position.set(x,hubH(x,z)+1+Math.sin(t*3+ph)*.25,z);b.rotation.y=Math.atan2(Math.cos(tt)*3.2,Math.cos(tt*1.7)*3.7);const f=Math.sin(t*22+ph)*1.1;wings[0].rotation.z=f;wings[1].rotation.z=-f;});}}
  // motes of light
  W.motes=particles(Q.motes,[30,10,30],'#fff2c2',.13,.75,.16,true);sc.add(W.motes.pts);

  /* --- the snow globe on the hill --- */
  const gx=HILL.x+.6,gz=HILL.z-1.4,gy=hubH(gx,gz);
  const ped=new THREE.Group();ped.position.set(gx,gy,gz);sc.add(ped);
  ol(M(G.cyl,toon('#cbb8e0'),0,.2,0,ped),1.05).scale.set(1.3,.4,1.3);
  ol(M(new THREE.CylinderGeometry(.75,1,.9,20),toon('#b9a4d6'),0,.85,0,ped),1.05);
  ol(M(G.cyl,toon('#e0b45a'),0,1.36,0,ped),1.04).scale.set(1.08,.16,1.08);
  W.GR=1.36;W.Gc=V3(gx,gy+1.36+W.GR*.92,gz);
  W.portalMat=new THREE.ShaderMaterial({uniforms:{tPortal:{value:null},uRes:{value:new THREE.Vector2(1,1)},uCloud:{value:1},uTime},
    vertexShader:'varying vec3 vN;varying vec3 vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vV=-mv.xyz;vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*mv;}',
    fragmentShader:'uniform sampler2D tPortal;uniform vec2 uRes;uniform float uCloud,uTime;varying vec3 vN;varying vec3 vV;void main(){vec2 uv=gl_FragCoord.xy/uRes;vec3 col=texture2D(tPortal,uv).rgb;'+
      'vec3 n=normalize(vN),v=normalize(vV);float f=pow(1.-abs(dot(n,v)),2.6);'+
      'float haze=uCloud*(.55+.12*sin(uv.x*14.+uTime*.8)*sin(uv.y*11.-uTime*.6));col=mix(col,vec3(.86,.89,.96),clamp(haze,0.,1.));'+
      'float hl=smoothstep(.9,.97,dot(n,normalize(vec3(-.45,.62,.64))));col+=hl*.42;col=mix(col,vec3(.9,.96,1.),f*.8);gl_FragColor=vec4(col,1.);}'});
  const globe=M(new THREE.SphereGeometry(W.GR,48,32),W.portalMat,W.Gc.x,W.Gc.y,W.Gc.z,sc);
  const gglow=glowSprite('#bfe9ff',5,.35);gglow.position.copy(W.Gc);sc.add(gglow);
  col.push({x:gx,z:gz,r:1.55});W.globe=globe;
  W.anim.push((dt,t)=>{gglow.material.opacity=.25+Math.sin(t*1.5)*.08;});

  /* --- Mira's moonflower garden --- */
  W.moonflowers=[];{const cx=-5.6,cz=-3.4;for(let i=0;i<9;i++){const a=i/9*6.28,d=1.1+(i%2)*.6,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d,y=hubH(x,z);
    const g=new THREE.Group();g.position.set(x,y,z);sc.add(g);M(G.cyl,toon('#4f8f55'),0,.35,0,g).scale.set(.03,.7,.03);
    const head=new THREE.Group();head.position.y=.72;g.add(head);for(let k=0;k<5;k++){const pa=k/5*6.28;const p=M(G.sph,toon('#d9cfff'),Math.cos(pa)*.13,0,Math.sin(pa)*.13,head);p.scale.set(.13,.04,.08);p.rotation.y=-pa;}
    M(G.sph,basic('#fff3b0'),0,.02,0,head).scale.setScalar(.06);const gl=glowSprite('#d9c8ff',1.3,0);gl.position.y=.75;g.add(gl);head.scale.setScalar(.35);W.moonflowers.push({head,gl});}}

  /* --- fireflies for Mira's quest --- */
  W.fireflies=[[-15,-12],[3,-19],[19,1],[-22,1],[-7,20]].map(([x,z],i)=>{const g=new THREE.Group();g.position.set(x,hubH(x,z)+1.3,z);g.visible=false;sc.add(g);
    M(G.sph,basic('#fffbe0'),0,0,0,g).scale.setScalar(.13);g.add(glowSprite('#ffe680',2.2,.9));const halo=glowSprite('#fff3a0',5,.18);g.add(halo);
    return {g,x,z,base:g.position.y,got:false,ph:i*1.3,fly:0};});

  /* --- villagers --- */
  addNPC(W,'mira',{name:'Mira',tag:'#6fae6e',voice:520,skin:'#e8b48f',shirt:'#86bd7f',pants:'#e8b48f',hair:'#c0643c',hat:'#e8c77a',style:'mira',shoes:'#7a4f3a'},-6.4,-1.4,2.6);
  addNPC(W,'tobi',{name:'Old Tobi',tag:'#3f6fa8',voice:220,skin:'#e0a988',shirt:'#3f6fa8',pants:'#4b3f3a',beard:'#e6dfd6',hat:'#d0554a',style:'tobi'},-18.6,13.2,2.2);
  addNPC(W,'pip',{name:'Pip',tag:'#ff9a3c',voice:700,skin:'#f2c29c',shirt:'#ffcf4d',pants:'#5b7fd1',hair:'#2f2420',hat:'#ff7a59',style:'pip',scale:.78},HILL.x-2,HILL.z+.6,.6);
  W.inter.push({name:'globe',r:3.4,pos:()=>W.Gc,label:()=>S.lens?'Look into the globe':'Inspect the globe',act:()=>runScript(globeScript)});
  W.spawn={x:2,z:8,rot:Math.PI};
  W.update=(dt,t)=>{
    W.anim.forEach(f=>f(dt,t));
    W.fireflies.forEach(f=>{if(!f.g.visible)return;if(f.fly>0){f.fly+=dt;f.g.position.y+=dt*4;f.g.scale.setScalar(Math.max(.01,1-f.fly));if(f.fly>1)f.g.visible=false;return;}
      f.g.position.x=f.x+Math.sin(t*1.3+f.ph)*.8;f.g.position.z=f.z+Math.cos(t*1.1+f.ph)*.8;f.g.position.y=f.base+Math.sin(t*2.2+f.ph)*.3;
      if(S.mira==='active'&&!f.got&&Math.hypot(P.pos.x-f.g.position.x,P.pos.z-f.g.position.z)<1.5){f.got=true;f.fly=.001;S.fire++;chime(S.fire);
        note(S.fire<5?'Firefly caught · '+S.fire+' of 5':'All five caught! Take them back to Mira');refreshQuest();}});
    W.moonflowers.forEach((m,i)=>{const tgt=S.mira==='done'?1:.35;const k=lerp(m.head.scale.x,tgt,damp(2,dt));m.head.scale.setScalar(k);m.gl.material.opacity=S.mira==='done'?.5+Math.sin(t*2+i)*.15:0;m.head.rotation.y+=dt*.2;});
    W.portalMat.uniforms.uCloud.value=lerp(W.portalMat.uniforms.uCloud.value,S.lens?0:1,damp(1.5,dt));
  };
  return W;
}

/* ================= INNER: Snowglobe Hollow ================= */
function innerH(x,z){const r=Math.hypot(x,z);let h=.35+Math.sin(x*.21)*Math.cos(z*.17)*.45*(1-sm(9,15,r))+sm(15,23,r)*7.5;
  const pd=Math.hypot(x-5.5,z-2.5);h=lerp(h,.28,1-sm(3.2,4,pd));return h;}
function innerCol(x,z,y,c){const n=Math.sin(x*.6)*Math.cos(z*.5);c.set('#b9c8ea').lerp(TMPC.set('#93a6d6'),(n+1)/2*.7);if(y>2.5)c.lerp(TMPC.set('#d3def5'),.5);}
function buildInner(){
  const W={key:'inner',scene:new THREE.Scene(),npcs:[],colliders:[],inter:[],h:innerH,exposure:1.04,sat:1.18,anim:[]};
  const sc=W.scene;sc.fog=new THREE.Fog('#1f2c66',16,70);
  W.sky=makeSky('#060a22','#2c3f8a','#141a3c',V3(-.35,.45,-.82),'#e2ecff',.0018);sc.add(W.sky);
  sc.add(new THREE.HemisphereLight('#7f9cff','#1a1f3a',.42));
  const dl=new THREE.DirectionalLight('#b9ccff',.5);dl.position.set(-14,30,-25);sc.add(dl);
  W.walk=(x,z)=>Math.hypot(x,z)<16.5;
  sc.add(makeTerrain(70,TOUCH?90:120,innerH,innerCol));
  // stars
  {const n=700,p=new Float32Array(n*3);for(let i=0;i<n;i++){const v=V3(Math.random()*2-1,Math.random()*.9+.05,Math.random()*2-1).normalize().multiplyScalar(260);p[i*3]=v.x;p[i*3+1]=v.y;p[i*3+2]=v.z;}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));const st=new THREE.Points(g,new THREE.PointsMaterial({color:'#ffffff',size:1.5,map:GLOW,transparent:true,depthWrite:false,fog:false}));st.frustumCulled=false;W.stars=st;sc.add(st);}
  // aurora ribbons
  const aur=[];[[-70,34,0],[-85,44,.5]].forEach(([z,y,ph])=>{const g=new THREE.PlaneGeometry(220,34,90,1);const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i);p.setZ(i,Math.sin(x*.03+ph*3)*16);}
    const m=new THREE.ShaderMaterial({uniforms:{uTime,ph:{value:ph}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'uniform float uTime,ph;varying vec2 vUv;void main(){float b=sin(vUv.x*38.+uTime*.9+ph*5.)*.5+.5;float w=sin(vUv.x*9.-uTime*.35+ph)*.5+.5;float a=smoothstep(0.,.45,vUv.y)*(1.-smoothstep(.6,1.,vUv.y))*(.25+.75*b*w)*smoothstep(0.,.15,vUv.x)*(1.-smoothstep(.85,1.,vUv.x));vec3 c=mix(vec3(.15,1.,.6),vec3(.65,.35,1.),smoothstep(.3,1.,vUv.y));gl_FragColor=vec4(c*a*.9,a);}'});
    const mesh=new THREE.Mesh(g,m);mesh.position.set(0,y,z);mesh.frustumCulled=false;sc.add(mesh);aur.push(mesh);});
  // glass dome seen from inside the globe
  {const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.BackSide,uniforms:{uTime},
    vertexShader:'varying vec3 vN;varying vec3 vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vV=-mv.xyz;vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*mv;}',
    fragmentShader:'uniform float uTime;varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),3.);float st=smoothstep(.97,1.,sin(vN.x*6.+vN.y*4.+uTime*.2));vec3 c=vec3(.7,.86,1.)*(f*.55+st*.08);gl_FragColor=vec4(c,1.);}'});
    const d=new THREE.Mesh(new THREE.SphereGeometry(30,48,24),m);d.position.y=-6;sc.add(d);}
  const col=W.colliders;
  // frozen pond
  {const ice=M(new THREE.CircleGeometry(3.6,40),new THREE.MeshToonMaterial({color:'#a9d3f2',gradientMap:GRAD}),5.5,.32,2.5,sc);ice.rotation.x=-Math.PI/2;
    const rim=M(new THREE.RingGeometry(3.5,3.75,40),basic('#eef4ff'),5.5,.34,2.5,sc);rim.rotation.x=-Math.PI/2;}
  // cottages with snowy roofs
  function cottage(x,z,rot,wall){const y=innerH(x,z)-.1,g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rot;sc.add(g);
    ol(M(G.box,toon(wall),0,1.05,0,g),1.03).scale.set(2.6,2.1,2.4);
    ol(M(G.pyr,toon('#e8eefa'),0,2.85,0,g),1.04).scale.set(2.35,1.5,2.2);
    M(G.box,toon('#7d5a8c'),0,2.12,0,g).scale.set(3.35,.12,3.12);
    M(G.box,toon('#5a3d4a'),0,.65,1.22,g).scale.set(.66,1.2,.08);
    [-.8,.8].forEach(wx=>{M(G.box,basic('#ffcf7a'),wx,1.3,1.23,g).scale.set(.46,.46,.04);});
    const wg=glowSprite('#ffb85c',4,.35);wg.position.set(0,1.3,1.8);g.add(wg);col.push({x,z,r:2});}
  cottage(-6.5,-6,.5,'#b98a7a');cottage(6.8,-7.2,-.6,'#8a9ac9');cottage(-.5,-12,0,'#c9a07a');
  // pines
  const r=rng(11),spots=[];let tries=0;while(spots.length<(TOUCH?26:36)&&tries<3000){tries++;const a=r()*6.28,d=6+r()*11.5,x=Math.cos(a)*d,z=Math.sin(a)*d;
    if(Math.hypot(x-5.5,z-2.5)<4.6||Math.hypot(x,z-9)<6.5||Math.hypot(x+9,z-7.5)<3.2||Math.abs(x)<2.6&&z>-4&&z<16)continue;if(col.some(c=>Math.hypot(x-c.x,z-c.z)<c.r+1.8))continue;if(spots.some(s=>Math.hypot(x-s.x,z-s.z)<2.2))continue;
    const s=.8+r()*.6;spots.push({x,z,s,rot:r()*6});col.push({x,z,r:.4*s});}
  const coneGeo=new THREE.ConeGeometry(1,1,9);
  forest(sc,spots,innerH,{trunk:'#5b4050',folGeo:coneGeo,colors:['#2f6f6a','#3a7d72','#2a5f63'],blobs:[[0,1.7,0,1.25,1,1.6],[0,2.7,0,.95,1,1.35],[0,3.55,0,.68,1,1.15],[0,4.05,0,.38,1,.8,'#eef3fc']]});
  // big lit tree
  {const x=1.5,z=-5.8,y=innerH(x,z),g=new THREE.Group();g.position.set(x,y,z);sc.add(g);
    M(G.cyl,toon('#5b4050'),0,.8,0,g).scale.set(.35,1.6,.35);
    [[1.6,2.4,2.9],[1.25,2.1,4.3],[.9,1.8,5.5],[.55,1.3,6.5]].forEach(([rr,hh,yy])=>{ol(M(coneGeo,toon('#2f6f6a'),0,yy,0,g),1.05).scale.set(rr*1.4,hh,rr*1.4);});
    const lc=['#ffcf7a','#ff8fb8','#8ff0ff','#c9ff8f'];for(let i=0;i<34;i++){const yy=1.9+i*.13,rad=(1-(yy-1.6)/5.6)*2.1+.1,a=i*1.9;M(G.sphLo,basic(lc[i%4]),Math.cos(a)*rad,yy,Math.sin(a)*rad,g).scale.setScalar(.09);}
    const star=M(new THREE.OctahedronGeometry(.35),basic('#fff2b0'),0,7.5,0,g);const sg=glowSprite('#ffe9a0',4,.8);sg.position.y=7.5;g.add(sg);
    W.anim.push((dt,t)=>{star.rotation.y+=dt;sg.material.opacity=.6+Math.sin(t*2)*.2;});col.push({x,z,r:1.5});}
  // lanterns
  [[-2.2,4],[2.2,4],[-2.2,-1],[2.6,-1.5],[3.5,8]].forEach(([x,z])=>{const y=innerH(x,z);M(G.cyl,toon('#3e3458'),x,y+.8,z,sc).scale.set(.07,1.6,.07);M(G.box,basic('#ffd98a'),x,y+1.75,z,sc).scale.set(.3,.34,.3);const s=glowSprite('#ffbf6b',2.4,.45);s.position.set(x,y+1.75,z);sc.add(s);col.push({x,z,r:.25});});
  // snow
  W.snow=particles(Q.snow,[44,24,44],'#ffffff',.16,.9,-1.3,false);sc.add(W.snow.pts);
  // exit ring
  {const x=-9,z=7.5,y=innerH(x,z),g=new THREE.Group();g.position.set(x,y+1.8,z);g.lookAt(0,y+1.8,0);sc.add(g);g.userData.base=g.rotation.y;
    M(new THREE.TorusGeometry(1.5,.1,12,48),basic('#c8f8ff'),0,0,0,g);
    const disc=M(new THREE.CircleGeometry(1.45,40),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,uniforms:{uTime},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'uniform float uTime;varying vec2 vUv;void main(){vec2 p=vUv-.5;float r=length(p)*2.;float a=atan(p.y,p.x);float s=sin(a*5.+r*9.-uTime*3.)*.5+.5;float al=(1.-r)*(.25+.45*s);gl_FragColor=vec4(vec3(.65,.95,1.)*al,al);}'}),0,0,0,g);
    const gs=glowSprite('#9ff3ff',6,.4);g.add(gs);W.ring=g;W.anim.push((dt,t)=>{g.rotation.y=g.userData.base+Math.sin(t*.5)*.25;gs.material.opacity=.3+Math.sin(t*2)*.1;});
    W.inter.push({name:'ring',r:2.8,pos:()=>g.position,label:()=>'Return to the island',act:()=>runScript(ringScript)});}
  // the fox spirit
  {const f=makeFox();const x=-.8,z=-3.2;f.root.position.set(x,innerH(x,z),z);f.root.rotation.y=.2;sc.add(f.root);
    const mk=marker();mk.position.y=1.9;f.root.add(mk);
    const npc={key:'fox',name:'Kit the snow fox',color:'#3fb7cc',voice:880,c:null,fox:f,root:f.root,world:W,marker:mk,headY:1.6,baseRot:.2,targetRot:.2};
    W.npcs.push(npc);NPC.fox=npc;col.push({x,z,r:.8});
    W.inter.push({name:'fox',r:2.8,pos:()=>f.root.position,label:()=>'Talk to Kit',act:()=>talk(npc)});
    makeLabel(npc);
    W.anim.push((dt,t)=>{f.body.position.y=Math.sin(t*2)*.04;f.tail.rotation.y=Math.sin(t*1.6)*.45;f.head.rotation.z=Math.sin(t*.8)*.08;
      f.sparks.forEach((s,i)=>{const a=t*.8+i*1.25;s.position.set(Math.cos(a)*1.1,.9+Math.sin(t*1.5+i)*.4,Math.sin(a)*1.1);s.material.opacity=.5+Math.sin(t*3+i)*.3;});});}
  W.anchor=V3(0,4.2,10);
  W.update=(dt,t)=>{W.anim.forEach(f=>f(dt,t));};
  return W;
}

/* ================= NPC plumbing ================= */
const NPC={};
const labelsEl=$('labels');
function makeLabel(npc){const d=document.createElement('div');d.className='label';d.textContent=npc.name;labelsEl.appendChild(d);npc.label=d;}
function addNPC(W,key,o,x,z,face){const c=makeChar(o);c.root.position.set(x,W.h(x,z),z);c.root.rotation.y=face;W.scene.add(c.root);
  const mk=marker();mk.position.y=2.25*(o.scale||1);c.root.add(mk);
  const npc={key,name:o.name,color:o.tag,voice:o.voice,c,root:c.root,world:W,marker:mk,headY:2.0*(o.scale||1),baseRot:face,targetRot:face};
  W.npcs.push(npc);W.colliders.push({x,z,r:.55});NPC[key]=npc;makeLabel(npc);
  W.inter.push({name:key,r:2.6,pos:()=>c.root.position,label:()=>'Talk to '+o.name,act:()=>talk(npc)});return npc;}
const hasNews={
  mira:()=>S.mira==='new'||(S.mira==='active'&&S.fire>=5),
  tobi:()=>S.pip==='met'&&!S.lens,
  pip:()=>S.pip==='new'||(S.lens&&!S.globe),
  fox:()=>S.fox==='new'};

/* ================= player ================= */
const P={c:null,pos:V3(2,0,8),rot:Math.PI,speed:0};
let HUB,INNER,world;

/* ================= camera ================= */
let yaw=0,pitch=.36,dist=TOUCH?9.6:8.6,baseFov=50;
const camLook=V3(),tmpV=V3(),tmpV2=V3();
let cut=null,talkCam=null,mode='intro';
function headPos(out){return out.set(P.pos.x,P.pos.y+1.35,P.pos.z);}
function followPos(out){headPos(out);return out.add(tmpV2.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(dist));}
function startCut(o){cut=Object.assign({t:0,ease:easeIO},o);}
function updateCamera(dt){
  if(cut){cut.t+=dt;const k=Math.min(1,cut.t/cut.dur),e=cut.ease(k);camera.position.lerpVectors(cut.p0,cut.p1,e);camLook.lerpVectors(cut.l0,cut.l1,e);
    if(cut.f0!=null){camera.fov=lerp(cut.f0,cut.f1,e);camera.updateProjectionMatrix();}camera.lookAt(camLook);
    if(k>=1){const d=cut.done;cut=null;if(d)d();}return;}
  if(mode==='intro'){const a=performance.now()*.00004+.8;camera.position.set(Math.sin(a)*31,15,Math.cos(a)*31);camLook.set(0,2,-2);camera.lookAt(camLook);return;}
  const want=tmpV,look=V3();
  if(mode==='talk'&&talkCam){want.copy(talkCam.pos);look.copy(talkCam.look);}
  else{followPos(want);headPos(look);}
  const gy=world.h(want.x,want.z)+.7;if(want.y<gy)want.y=gy;
  camera.position.lerp(want,damp(mode==='talk'?3:5,dt));camLook.lerp(look,damp(mode==='talk'?3:8,dt));camera.lookAt(camLook);
  if(Math.abs(camera.fov-baseFov)>.01){camera.fov=lerp(camera.fov,baseFov,damp(3,dt));camera.updateProjectionMatrix();}
}
function frameTalk(npc){const a=P.pos,b=npc.root.position;const mid=V3((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);
  const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1;let sx=-dz/len,sz=dx/len;
  if((camera.position.x-mid.x)*sx+(camera.position.z-mid.z)*sz<0){sx=-sx;sz=-sz;}
  const back=V3(-dx/len,0,-dz/len);
  talkCam={pos:mid.clone().add(V3(sx*4.4+back.x*1.6,2.1,sz*4.4+back.z*1.6)),look:mid.clone().add(V3(0,1.25,0))};}

/* ================= world switching: the zoom-into-the-globe effect ================= */
const K=2.2;
function computeInnerCam(){innerCam.position.copy(INNER.anchor).addScaledVector(tmpV.copy(camera.position).sub(HUB.Gc),K);innerCam.quaternion.copy(camera.quaternion);
  if(innerCam.fov!==camera.fov||innerCam.aspect!==camera.aspect){innerCam.fov=camera.fov;innerCam.aspect=camera.aspect;innerCam.updateProjectionMatrix();}}
function enterGlobe(){
  if(world!==HUB)return;mode='cut';setUI(false);closeDlg();
  const Gc=HUB.Gc,dir=camera.position.clone().sub(Gc);dir.y=Math.max(dir.y,dir.length()*.28);dir.normalize();
  const far=Gc.clone().addScaledVector(dir,6.5);
  whoosh(2.4);
  startCut({dur:1.0,p0:camera.position.clone(),p1:far,l0:camLook.clone(),l1:Gc.clone(),done:()=>{
    startCut({dur:1.7,p0:far,p1:Gc.clone().addScaledVector(dir,HUB.GR*1.07),l0:Gc.clone(),l1:Gc.clone(),f0:camera.fov,f1:baseFov-7,ease:easeIn,done:()=>{
      computeInnerCam();setWorld(INNER);camera.position.copy(innerCam.position);camera.quaternion.copy(innerCam.quaternion);
      camLook.copy(camera.position).add(V3(0,0,-1).applyQuaternion(camera.quaternion).multiplyScalar(10));
      const dh=V3(dir.x,0,dir.z).normalize();P.pos.set(INNER.anchor.x-dh.x*3.2,0,INNER.anchor.z-dh.z*3.2);
      if(Math.hypot(P.pos.x,P.pos.z)>14){P.pos.set(0,0,9);}P.pos.y=innerH(P.pos.x,P.pos.z);
      yaw=Math.atan2(dh.x,dh.z);P.rot=Math.atan2(-dh.x,-dh.z);pitch=.2;
      pulse();S.inside=true;S.globe=true;mode='play';setUI(true);refreshQuest();
      setTimeout(()=>note('You are inside the snow globe'),500);}});}});
}
function exitGlobe(){
  mode='cut';setUI(false);closeDlg();whoosh(1.6);
  flashTo(true,()=>{
    setWorld(HUB);S.inside=false;const Gc=HUB.Gc;
    const front=V3(-2,0,2.2).normalize();const out=front.clone();out.y=.3;out.normalize();
    P.pos.set(Gc.x+front.x*3.3,0,Gc.z+front.z*3.3);P.pos.y=hubH(P.pos.x,P.pos.z);P.rot=Math.atan2(-front.x,-front.z);
    yaw=Math.atan2(front.x,front.z);pitch=.3;
    camera.position.copy(Gc).addScaledVector(out,HUB.GR*1.07);camLook.copy(Gc);camera.fov=baseFov-7;camera.updateProjectionMatrix();camera.lookAt(camLook);
    const pEnd=followPos(V3()),lEnd=headPos(V3());
    flashTo(false);
    startCut({dur:2.2,p0:camera.position.clone(),p1:pEnd,l0:Gc.clone(),l1:lEnd,f0:baseFov-7,f1:baseFov,ease:easeOut,done:()=>{mode='play';setUI(true);refreshQuest();note('Back on Auntor Island');}});
  });
}
function setWorld(W){
  if(world&&world!==W){world.scene.remove(P.c.root);world.npcs.forEach(n=>n.label.classList.remove('show'));}
  world=W;W.scene.add(P.c.root);
  if(grade){grade.uniforms.uExposure.value=W.exposure;grade.uniforms.uSat.value=W.sat;}
  ambienceMood(W===INNER);
}

/* ================= scripts: dialogue, quests, questions ================= */
async function talk(npc){
  if(mode!=='play')return;mode='talk';setAct(null);P.speed=0;
  npc.targetRot=Math.atan2(P.pos.x-npc.root.position.x,P.pos.z-npc.root.position.z);
  P.rot=Math.atan2(npc.root.position.x-P.pos.x,npc.root.position.z-P.pos.z);
  frameTalk(npc);
  try{await SCRIPTS[npc.key](npc);}catch(e){console.error(e);}
  closeDlg();talkCam=null;npc.targetRot=npc.baseRot;
  if(mode==='talk')mode='play';refreshQuest();
  if(S.pendingEnd){S.pendingEnd=false;setTimeout(showEnd,500);}
}
async function runScript(fn){if(mode!=='play')return;mode='talk';setAct(null);try{await fn();}catch(e){console.error(e);}closeDlg();talkCam=null;if(mode==='talk')mode='play';refreshQuest();}
const NARR={name:'',color:'#7b6a86',voice:440};
const SCRIPTS={
  async mira(n){
    if(S.mira==='new'){
      await say(n,"Oh! Hello there. Sorry, I'm a little flustered.");
      await say(n,"My fireflies slipped out of the garden lanterns this afternoon. Without them, my moonflowers won't open tonight.");
      const c=await say(n,"There are five of them out there somewhere. Would you help me catch them?",["Of course, I'll find them","Where did they go?"]);
      if(c===1)await say(n,"Out across the meadows, I think. Near the woods and the shore. Just look for little lights. You'll catch one by walking right into it.");
      else await say(n,"You're a gem. Just walk right into one and it will follow you home.");
      S.mira='active';HUB.fireflies.forEach(f=>{if(!f.got)f.g.visible=true;});note('New quest · Catch 5 fireflies');return;}
    if(S.mira==='active'&&S.fire<5){await say(n,S.fire?`${S.fire} caught already! The rest are hiding near the edges of the island.`:"They like the edges of the island. Look for little lights.");return;}
    if(S.mira==='active'){
      await say(n,"You found every one of them! Watch this...");
      S.mira='done';sfxBloom();
      await say(n,"Oh, look at them open. Thank you. Every helper on this island gets a star from me.");
      gainStar('Mira gave you a star');
      await say(n,"Have you met Pip? That kid has been staring at the snow globe on the hill all day.");return;}
    const lines=["My moonflowers have never looked so happy.","If you go into that snow globe, bring me back a snowflake. Kidding. Mostly."];
    await say(n,lines[(Math.random()*lines.length)|0]);
  },
  async tobi(n){
    if(S.lens){await say(n,"Careful with that lens. Things look bigger through it. Much, much bigger.");return;}
    if(S.tobi==='new'){
      const c=await say(n,"Ahoy. You have the look of someone hunting for something.",["I need a lens","Just looking around"]);
      if(c===1){await say(n,"Then look at the sea. Best view on the island. Come back if you ever need something looked at closer.");S.tobi='met';return;}
    }else{const c=await say(n,"Back again. Still after that lens?",["Yes, I am","Not right now"]);if(c===1)return;}
    S.tobi='met';
    await say(n,"I've a box full of old spyglass lenses. But I don't hand them out for free. I trade them for good answers.");
    const RIDDLES=[
      {q:"First riddle. What has keys, but can't open a single lock?",a:["A treasure map","A piano","A lighthouse"],ok:1,yes:"A piano! Ha. Too easy for you."},
      {q:"Second one. The more of these you take, the more you leave behind. What are they?",a:["Photographs","Breaths","Footsteps"],ok:2,yes:"Footsteps. Sharp as a hook, you are."}];
    for(const r of RIDDLES){
      for(;;){const c=await say(n,r.q,r.a);if(c===r.ok){sfxRight();await say(n,r.yes);break;}sfxWrong();await say(n,["Hah! Not even close. Have another go.","Nope. The sea is laughing at you. Try again."][(Math.random()*2)|0]);}
    }
    S.lens=true;S.tobi='done';note('You got the Old Lens');
    await say(n,"Here. The lens is yours. Hold it up to something small and see what happens.");
    gainStar('Tobi gave you a star');
  },
  async pip(n){
    if(S.globe){await say(n,"You went INSIDE?! Was it snowing? It was snowing, wasn't it. I knew it.");return;}
    if(!S.lens){
      await say(n,"Psst. Look at the snow globe. There's a whole tiny town in there. With SNOW.");
      await say(n,"The glass is all foggy though. If I had a lens I could see properly. Old Tobi at the dock has a whole box of them.");
      S.pip='met';return;}
    const c=await say(n,"Is that Tobi's lens?! Hold it up to the glass. Go on, go on!",["Look into the globe","Maybe in a minute"]);
    if(c===0){closeDlg();await wait(250);enterGlobe();}
  },
  async fox(n){
    if(S.fox==='done'){await say(n,"The ring of light will take you home whenever you're ready. Come back and visit. Winters are long in here.");return;}
    await say(n,"Oh! A visitor from outside the glass. It has been a long, long winter since anyone looked in.");
    await say(n,"I'm Kit. I keep the lights on in here. Every visitor tells me one thing before they go.");
    const c=await say(n,"So tell me. What do you think this little world is for?",["A place to rest","A secret hideout","A tiny museum of winters"]);
    await say(n,["Then rest a while. The snow is soft and nobody is in a hurry.","Then you are now one of the very few who know about it.","I like that. I'll put a little sign up."][c]);
    await say(n,"Here is the secret everyone who reaches me gets to keep. The word is LUMEN.");
    S.fox='done';gainStar('Kit gave you a star');
    await say(n,"Step through the ring of light when you're ready to go back.");
    S.pendingEnd=true;
  }};
async function globeScript(){
  if(!S.lens){await say({name:'Snow globe',color:'#8a7bd1',voice:600},"The glass is too foggy to see through. You can just make out tiny lights inside.");if(S.pip==='new')S.pip='met';return;}
  enterGlobe();
}
async function ringScript(){
  if(S.fox!=='done'){const c=await say({name:'Ring of light',color:'#3fb7cc',voice:700},"The ring hums softly. Go back to the island now?",["Not yet","Go back"]);if(c===0)return;}
  exitGlobe();
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));

/* ================= UI ================= */
const dlg=$('dlg'),dName=$('dName'),dText=$('dText'),dOpts=$('dOpts');
let dlgState=null;
function say(who,text,choices){return new Promise(res=>{
  text=text.replace(/\{name\}/g,()=>LI.profile.name);
  if(dlgState&&dlgState.tm)clearTimeout(dlgState.tm);
  dlg.hidden=false;requestAnimationFrame(()=>dlg.classList.add('on'));
  dName.textContent=who.name;dName.hidden=!who.name;dName.style.setProperty('--tag',who.color||'#ff7a59');
  dOpts.innerHTML='';dText.textContent='';
  const st={typing:true,res,choices,i:0};dlgState=st;
  const step=()=>{if(dlgState!==st)return;st.i+=2;dText.textContent=text.slice(0,st.i);if(st.i%6===0)blip(who.voice||440);if(st.i<text.length)st.tm=setTimeout(step,20);else st.finish();};
  st.finish=()=>{clearTimeout(st.tm);st.typing=false;dText.textContent=text;showOpts(st);};
  step();});}
function showOpts(st){dOpts.innerHTML='';
  if(st.choices){st.choices.forEach((c,k)=>{const b=document.createElement('button');b.className='opt';b.type='button';const s=document.createElement('span');s.className='k';s.textContent=k+1;b.appendChild(s);b.appendChild(document.createTextNode(c));b.addEventListener('click',e=>{e.stopPropagation();pick(k);});dOpts.appendChild(b);});}
  else{const b=document.createElement('button');b.className='next';b.type='button';b.textContent='Continue';b.addEventListener('click',e=>{e.stopPropagation();pick(0);});dOpts.appendChild(b);}}
function pick(k){const st=dlgState;if(!st||st.typing)return;if(st.choices&&(k<0||k>=st.choices.length))return;dlgState=null;blip(660,.05);st.res(k);}
function advance(){const st=dlgState;if(!st)return;if(st.typing){st.finish();return;}if(!st.choices)pick(0);}
dlg.addEventListener('click',advance);
function closeDlg(){if(dlgState)return;dlg.classList.remove('on');setTimeout(()=>{if(!dlgState&&!dlg.classList.contains('on'))dlg.hidden=true;},260);}

const noteEl=$('note');let noteT;
function note(t){noteEl.textContent=t;noteEl.classList.add('on');clearTimeout(noteT);noteT=setTimeout(()=>noteEl.classList.remove('on'),2600);}
function gainStar(msg){S.stars=Math.min(3,S.stars+1);$('starN').textContent=S.stars+' / 3';const p=$('stars');p.classList.remove('pop');void p.offsetWidth;p.classList.add('pop');fanfare();note('★ '+msg);}
let lastQ='';
function objectives(){const L=[];
  if(world===INNER){L.push(S.fox==='done'?'Walk through the ring of light to go home':'Find who lives inside the snow globe');return L;}
  if(S.mira==='new')L.push('Say hello to Mira by the garden');
  else if(S.mira==='active')L.push(S.fire>=5?'Bring the fireflies back to Mira':'Catch Mira’s fireflies ('+S.fire+'/5)');
  if(!S.lens){if(S.pip==='met')L.push('Ask Old Tobi at the dock for a lens');else L.push('See what Pip is staring at on the hill');}
  else if(!S.globe)L.push('Look into the snow globe on the hill');
  if(!L.length)L.push(S.stars>=3?'All stars found. Wander as long as you like':'Explore the island');
  return L.slice(0,2);}
function refreshQuest(){const L=objectives(),key=L.join('|');if(key===lastQ)return;lastQ=key;const ul=$('qlist');ul.innerHTML='';L.forEach(t=>{const li=document.createElement('li');li.textContent=t;li.className='new';ul.appendChild(li);});}
function setUI(on){$('hud').classList.toggle('off',!on);$('ctrl').classList.toggle('off',!on);if(!on){setAct(null);joyEnd();}}
const actEl=$('act'),actLabel=$('actLabel');let curInter=null;
function setAct(it){curInter=it;if(it){actLabel.textContent=it.label();actEl.classList.add('on');}else actEl.classList.remove('on');}
actEl.addEventListener('click',e=>{e.stopPropagation();if(curInter&&mode==='play')curInter.act();});
function showEnd(){if($('end').classList.contains('on'))return;
  const st=$('endStars');st.innerHTML='';for(let i=0;i<3;i++){const s=document.createElement('span');s.textContent='★';if(i>=S.stars)s.className='dim';st.appendChild(s);}
  $('endText').textContent=(S.stars<3?'You found '+S.stars+' of 3 stars. Someone on the island still needs your help. ':'')+'In the real version, DM this word to @101auntojje for a surprise.';
  $('end').classList.add('on');$('end').setAttribute('aria-hidden','false');}
$('endBtn').addEventListener('click',()=>{$('end').classList.remove('on');$('end').setAttribute('aria-hidden','true');});
const flashEl=$('flash');
function flashTo(on,cb){flashEl.classList.toggle('on',on);if(cb)setTimeout(cb,380);}
function pulse(){flashEl.style.transition='none';flashEl.style.opacity='.85';void flashEl.offsetWidth;flashEl.style.transition='opacity .7s';flashEl.style.opacity='';flashEl.classList.remove('on');}

/* ================= audio ================= */
const AU={ctx:null,master:null,on:true,lp:null,mood:0};
function audioInit(){if(AU.ctx)return;try{const C=window.AudioContext||window.webkitAudioContext;AU.ctx=new C();AU.master=AU.ctx.createGain();AU.master.gain.value=1;AU.master.connect(AU.ctx.destination);
  AU.lp=AU.ctx.createBiquadFilter();AU.lp.type='lowpass';AU.lp.frequency.value=1100;const g=AU.ctx.createGain();g.gain.value=.05;AU.lp.connect(g);g.connect(AU.master);padLoop();}catch(e){AU.ctx=null;}}
const CHORDS=[[[261.63,329.63,392,493.88],[220,261.63,329.63,392],[174.61,220,261.63,329.63],[196,246.94,293.66,392]],[[220,261.63,329.63,392],[174.61,220,261.63,329.63],[196,233.08,293.66,349.23],[164.81,207.65,246.94,329.63]]];
let chordI=0;
function padLoop(){const ctx=AU.ctx;if(!ctx)return;const now=ctx.currentTime,ch=CHORDS[AU.mood][chordI++%4];
  ch.forEach(f=>{[0,1].forEach(d=>{const o=ctx.createOscillator(),og=ctx.createGain();o.type=d?'triangle':'sine';o.frequency.value=f*(d?1.004:1)*(AU.mood?.5:1);
    og.gain.setValueAtTime(0,now);og.gain.linearRampToValueAtTime(d?.1:.22,now+2.4);og.gain.linearRampToValueAtTime(0,now+7.6);o.connect(og);og.connect(AU.lp);o.start(now);o.stop(now+7.8);});});
  for(let i=0;i<2;i++)if(Math.random()<.75)tone(ch[(Math.random()*4)|0]*2,'sine',.035,1.6,now+1+Math.random()*4);
  setTimeout(padLoop,6000);}
function ambienceMood(m){AU.mood=m?1:0;}
function tone(f,type,vol,dur,at){const ctx=AU.ctx;if(!ctx||!AU.on)return;const t=at||ctx.currentTime;const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(AU.master);o.start(t);o.stop(t+dur+.05);}
function blip(f,v){tone(f*(0.95+Math.random()*.1),'triangle',v||.025,.07);}
function chime(n){[0,4,7].forEach((s,i)=>tone(523.25*Math.pow(2,(s+n*2)/12),'sine',.06,.6,AU.ctx&&AU.ctx.currentTime+i*.07));}
function fanfare(){if(!AU.ctx)return;const t=AU.ctx.currentTime;[523.25,659.25,783.99,1046.5].forEach((f,i)=>tone(f,'triangle',.07,.7,t+i*.11));}
function sfxRight(){if(!AU.ctx)return;const t=AU.ctx.currentTime;tone(659.25,'sine',.07,.3,t);tone(987.77,'sine',.07,.5,t+.1);}
function sfxWrong(){tone(180,'sawtooth',.035,.3);}
function sfxBloom(){if(!AU.ctx)return;const t=AU.ctx.currentTime;[392,523.25,659.25,783.99,1046.5,1318.5].forEach((f,i)=>tone(f,'sine',.05,1.2,t+i*.09));}
function whoosh(dur){const ctx=AU.ctx;if(!ctx||!AU.on)return;const n=ctx.sampleRate*dur,b=ctx.createBuffer(1,n,ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
  const s=ctx.createBufferSource();s.buffer=b;const f=ctx.createBiquadFilter();f.type='bandpass';f.Q.value=1.4;const t=ctx.currentTime;f.frequency.setValueAtTime(300,t);f.frequency.exponentialRampToValueAtTime(2600,t+dur);
  const g=ctx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.12,t+dur*.8);g.gain.linearRampToValueAtTime(0,t+dur);s.connect(f);f.connect(g);g.connect(AU.master);s.start(t);s.stop(t+dur);}
$('snd').addEventListener('click',e=>{e.stopPropagation();AU.on=!AU.on;if(AU.master)AU.master.gain.value=AU.on?1:0;$('snd').style.opacity=AU.on?1:.45;$('snd').setAttribute('aria-label',AU.on?'Turn sound off':'Turn sound on');});

/* ================= input ================= */
const keys={};const joy={id:null,ox:0,oy:0,x:0,y:0};const drags=new Map();
const joyEl=$('joy'),knob=$('knob');
function joyEnd(){joy.id=null;joy.x=joy.y=0;joyEl.classList.remove('on');knob.style.transform='';}
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();keys[k]=true;
  if(dlgState){if(k==='e'||k===' '||k==='enter'){e.preventDefault();advance();}else if(/^[1-4]$/.test(k))pick(+k-1);return;}
  if((k==='e'||k===' '||k==='enter')&&mode==='play'&&curInter){e.preventDefault();curInter.act();}});
window.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
window.addEventListener('blur',()=>{for(const k in keys)keys[k]=false;joyEnd();});
canvas.addEventListener('pointerdown',e=>{
  if(dlgState){advance();return;}
  const rect=canvas.getBoundingClientRect();
  if(e.pointerType!=='mouse'&&e.clientX-rect.left<rect.width*.5&&joy.id===null&&mode==='play'){joy.id=e.pointerId;joy.ox=e.clientX;joy.oy=e.clientY;joyEl.style.left=(e.clientX-rect.left)+'px';joyEl.style.top=(e.clientY-rect.top)+'px';joyEl.classList.add('on');$('joyHint').style.opacity=0;}
  else drags.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,moved:false});
  try{canvas.setPointerCapture(e.pointerId);}catch(_){}});
canvas.addEventListener('pointermove',e=>{
  if(e.pointerId===joy.id){let dx=e.clientX-joy.ox,dy=e.clientY-joy.oy;const L=Math.hypot(dx,dy),mx=52;if(L>mx){dx*=mx/L;dy*=mx/L;}joy.x=dx/mx;joy.y=dy/mx;knob.style.transform='translate('+dx+'px,'+dy+'px)';return;}
  const d=drags.get(e.pointerId);if(!d)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;d.x=e.clientX;d.y=e.clientY;
  if(Math.hypot(e.clientX-d.sx,e.clientY-d.sy)>6)d.moved=true;
  if(d.moved&&(mode==='play'||mode==='talk')&&!cut){yaw-=dx*.0058;pitch=Math.max(.08,Math.min(1.05,pitch+dy*.004));}});
function endPtr(e){if(e.pointerId===joy.id){joyEnd();return;}const d=drags.get(e.pointerId);drags.delete(e.pointerId);if(d&&!d.moved&&e.type==='pointerup'&&mode==='play')tapPick(e);}
canvas.addEventListener('pointerup',endPtr);canvas.addEventListener('pointercancel',endPtr);
canvas.addEventListener('wheel',e=>{e.preventDefault();dist=Math.max(5,Math.min(15,dist+e.deltaY*.01));},{passive:false});
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
function tapPick(e){const r=canvas.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(ndc,camera);
  const targets=world.npcs.map(n=>n.root);if(world===HUB)targets.push(HUB.globe);const hits=ray.intersectObjects(targets,true);if(!hits.length)return;
  let o=hits[0].object;while(o&&!targets.includes(o))o=o.parent;if(!o)return;
  const it=world.inter.find(i=>(o===HUB.globe&&i.name==='globe')||(NPC[i.name]&&NPC[i.name].root===o));if(!it)return;
  const p=it.pos();if(Math.hypot(p.x-P.pos.x,p.z-P.pos.z)<it.r+3.5)it.act();else note('Walk a little closer');}

/* ================= per-frame ================= */
const puffs=[];
function updatePlayer(dt,t){
  let mx=joy.x,my=-joy.y;
  if(keys.w||keys.arrowup)my+=1;if(keys.s||keys.arrowdown)my-=1;if(keys.a||keys.arrowleft)mx-=1;if(keys.d||keys.arrowright)mx+=1;
  let L=Math.hypot(mx,my);if(L>1){mx/=L;my/=L;L=1;}
  const canMove=mode==='play';
  if(canMove&&L>.08){const fx=-Math.sin(yaw),fz=-Math.cos(yaw),rx=Math.cos(yaw),rz=-Math.sin(yaw);
    const vx=fx*my+rx*mx,vz=fz*my+rz*mx;const sp=6*L;P.speed=lerp(P.speed,L,damp(10,dt));
    tryMove(P.pos.x+vx*sp*dt,P.pos.z+vz*sp*dt);P.rot=angLerp(P.rot,Math.atan2(vx,vz),damp(12,dt));
    P.puffT=(P.puffT||0)-dt;if(P.puffT<0&&L>.6){P.puffT=.22;spawnPuff();}}
  else P.speed=lerp(P.speed,0,damp(10,dt));
  P.pos.y=lerp(P.pos.y,world.h(P.pos.x,P.pos.z),damp(20,dt));
  P.c.root.position.copy(P.pos);P.c.root.rotation.y=angLerp(P.c.root.rotation.y,P.rot,damp(14,dt));
  animChar(P.c,dt,t,P.speed);
  uPush.value.copy(P.pos);
}
function tryMove(nx,nz){const W=world;
  if(!W.walk(nx,nz)){if(W.walk(nx,P.pos.z))nz=P.pos.z;else if(W.walk(P.pos.x,nz))nx=P.pos.x;else return;}
  for(const c of W.colliders){const dx=nx-c.x,dz=nz-c.z,d=Math.hypot(dx,dz),rr=c.r+.35;if(d<rr&&d>1e-4){nx=c.x+dx/d*rr;nz=c.z+dz/d*rr;}}
  if(W.walk(nx,nz)){P.pos.x=nx;P.pos.z=nz;}}
function animChar(c,dt,t,spd){
  if(spd>.05)c.phase+=dt*(6+spd*7);
  const sw=Math.sin(c.phase)*.75*Math.min(1,spd*1.4);
  c.legs[0].rotation.x=sw;c.legs[1].rotation.x=-sw;c.arms[0].rotation.x=-sw*.85;c.arms[1].rotation.x=sw*.85;
  c.body.position.y=Math.abs(Math.sin(c.phase))*.09*Math.min(1,spd*1.4)+Math.sin(t*2.1+c.seed)*.012*(1-Math.min(1,spd));
  c.body.rotation.x=spd*.12;
  c.head.rotation.z=Math.sin(t*.9+c.seed)*.05*(1-spd)+Math.sin(c.phase)*.04*spd;
  c.body.scale.y=c.s*(1+Math.sin(t*2.2+c.seed)*.012);
  if(c.root.userData.prop)c.root.userData.prop.rotation.y+=dt*9;
}
const puffMat=new THREE.MeshBasicMaterial({color:'#f3ead9',transparent:true,opacity:.7,depthWrite:false});
function spawnPuff(){let p=puffs.find(q=>!q.visible);if(!p){if(puffs.length>14)return;p=new THREE.Mesh(G.sphLo,puffMat.clone());puffs.push(p);}
  world.scene.add(p);p.visible=true;p.position.set(P.pos.x+(Math.random()-.5)*.3,P.pos.y+.1,P.pos.z+(Math.random()-.5)*.3);p.userData.t=0;}
function updatePuffs(dt){puffs.forEach(p=>{if(!p.visible)return;p.userData.t+=dt;const k=p.userData.t/.6;if(k>=1){p.visible=false;if(p.parent)p.parent.remove(p);return;}p.scale.setScalar(.12+k*.25);p.position.y+=dt*.4;p.material.opacity=.6*(1-k);});}
function updateNPCs(dt,t){
  world.npcs.forEach(n=>{
    const d=Math.hypot(P.pos.x-n.root.position.x,P.pos.z-n.root.position.z);
    if(mode!=='talk'||talkCam==null){n.targetRot=d<5.5?Math.atan2(P.pos.x-n.root.position.x,P.pos.z-n.root.position.z):n.baseRot;}
    n.root.rotation.y=angLerp(n.root.rotation.y,n.targetRot,damp(4,dt));
    if(n.c)animChar(n.c,dt,t,0);
    const news=hasNews[n.key]();n.marker.visible=news&&mode!=='talk';
    if(n.marker.visible){n.marker.position.y=n.headY+.35+Math.abs(Math.sin(t*3))*.15;n.marker.rotation.y+=dt*2;}
  });
}
const proj=V3();
function updateLabels(){const w=canvas.clientWidth,h=canvas.clientHeight;
  world.npcs.forEach(n=>{const d=camera.position.distanceTo(n.root.position);proj.copy(n.root.position);proj.y+=n.headY+(n.marker.visible?.85:.25);proj.project(camera);
    const vis=mode!=='cut'&&mode!=='intro'&&d<16&&proj.z<1&&Math.abs(proj.x)<1.1&&Math.abs(proj.y)<1.1;
    n.label.classList.toggle('show',vis);if(vis){n.label.style.transform='translate('+((proj.x*.5+.5)*w)+'px,'+((-proj.y*.5+.5)*h)+'px) translate(-50%,-100%)';}});}
function updateInteract(){if(mode!=='play'){if(curInter)setAct(null);return;}
  let best=null,bd=1e9;for(const it of world.inter){const p=it.pos();const d=Math.hypot(p.x-P.pos.x,p.z-P.pos.z);if(d<it.r&&d<bd){bd=d;best=it;}}
  if(best!==curInter)setAct(best);else if(best&&actLabel.textContent!==best.label())actLabel.textContent=best.label();}

/* ================= post-processing: bloom, colour grade, FXAA ================= */
let composer=null,renderPass=null,grade=null,fxaa=null,bloom=null;
const GradeShader={uniforms:{tDiffuse:{value:null},uExposure:{value:1.12},uSat:{value:1.1},uVig:{value:.85}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform sampler2D tDiffuse;uniform float uExposure,uSat,uVig;varying vec2 vUv;void main(){vec3 c=texture2D(tDiffuse,vUv).rgb*uExposure;float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,uSat);vec2 d=vUv-.5;c*=1.-dot(d,d)*uVig;gl_FragColor=vec4(c,1.);}'};
try{if(THREE.EffectComposer&&THREE.RenderPass&&THREE.UnrealBloomPass&&THREE.ShaderPass&&THREE.FXAAShader){
  composer=new THREE.EffectComposer(renderer);renderPass=new THREE.RenderPass(new THREE.Scene(),camera);composer.addPass(renderPass);
  bloom=new THREE.UnrealBloomPass(new THREE.Vector2(256,256),.55,.55,.9);composer.addPass(bloom);
  grade=new THREE.ShaderPass(GradeShader);composer.addPass(grade);
  fxaa=new THREE.ShaderPass(THREE.FXAAShader);composer.addPass(fxaa);}}catch(e){composer=null;grade=null;}
const portalRT=new THREE.WebGLRenderTarget(2,2,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
const dbSize=new THREE.Vector2();
function resize(){const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight;
  renderer.setSize(w,h,false);const a=w/h;baseFov=a<.8?64:a<1.1?56:50;camera.aspect=a;if(mode!=='cut')camera.fov=baseFov;camera.updateProjectionMatrix();
  if(composer){composer.setPixelRatio(Q.pr);composer.setSize(w,h);fxaa.uniforms.resolution.value.set(1/(w*Q.pr),1/(h*Q.pr));}
  renderer.getDrawingBufferSize(dbSize);portalRT.setSize(Math.max(2,dbSize.x*.5|0),Math.max(2,dbSize.y*.5|0));if(HUB)HUB.portalMat.uniforms.uRes.value.copy(dbSize);}
function render(){
  if(world===HUB&&camera.position.distanceTo(HUB.Gc)<Q.portalNear){computeInnerCam();INNER.sky.position.copy(innerCam.position);INNER.stars.position.copy(innerCam.position);
    renderer.setRenderTarget(portalRT);renderer.clear();renderer.render(INNER.scene,innerCam);renderer.setRenderTarget(null);}
  world.sky.position.copy(camera.position);if(world.stars)world.stars.position.copy(camera.position);
  if(composer){renderPass.scene=world.scene;renderPass.camera=camera;composer.render();}else renderer.render(world.scene,camera);}

let last=performance.now(),started=false;
function frame(now){requestAnimationFrame(frame);const dt=Math.min(window.__maxDt||.05,(now-last)/1000);last=now;const t=now/1000;uTime.value=t;
  if(mode!=='intro'){updatePlayer(dt,t);updateNPCs(dt,t);}else{P.c.root.position.copy(P.pos);animChar(P.c,dt,t,0);updateNPCs(dt,t);}
  HUB.update(dt,t);if(world===INNER||camera.position.distanceTo(HUB.Gc)<Q.portalNear)INNER.update(dt,t);
  HUB.motes.update(dt,t,camLook);INNER.snow.update(dt,t,world===INNER?camera.position:innerCam.position);
  updatePuffs(dt);updateCamera(dt);updateInteract();updateLabels();render();}

/* ================= boot ================= */
HUB=buildHub();INNER=buildInner();HUB.portalMat.uniforms.tPortal.value=portalRT.texture;
function store(){try{return window.localStorage;}catch(e){return null;}}
function applyProfile(p){
  LI.profile=LIProfile.normalize(p);
  const old=P.c,c=makeChar(LIProfile.playerOpts(LI.profile));
  c.root.position.copy(old?old.root.position:P.pos);c.root.rotation.y=P.rot;
  if(old&&old.root.parent){old.root.parent.add(c.root);old.root.parent.remove(old.root);}
  P.c=c;
}
LI.applyProfile=applyProfile;LI.store=store;
applyProfile(LIProfile.load(store()));
P.pos.set(HUB.spawn.x,hubH(HUB.spawn.x,HUB.spawn.z),HUB.spawn.z);P.rot=HUB.spawn.rot;P.c.root.rotation.y=P.rot;
setWorld(HUB);
if(window.ResizeObserver)new ResizeObserver(resize).observe(canvas);window.addEventListener('resize',resize);resize();
refreshQuest();
requestAnimationFrame(frame);
const go=$('go');go.disabled=false;$('loadmsg').textContent=TOUCH?'Best with sound on.':'Best with sound on · WASD or arrows to walk';
go.addEventListener('click',()=>{if(started)return;try{if(LI.beforeStart)LI.beforeStart();}catch(e){console.error(e);}started=true;audioInit();$('start').classList.add('gone');
  yaw=0;pitch=.36;const pEnd=followPos(V3()),lEnd=headPos(V3());mode='cut';
  startCut({dur:2.4,p0:camera.position.clone(),p1:pEnd,l0:camLook.clone(),l1:lEnd,done:()=>{mode='play';setUI(true);
    if(TOUCH){$('joyHint').hidden=false;setTimeout(()=>$('joyHint').style.opacity=0,7000);}else{$('keys').hidden=false;$('actKey').hidden=false;setTimeout(()=>$('keys').style.opacity=0,9000);}
    note('Welcome to Auntor Island, '+LI.profile.name);}});});
window.__lumen={S,P,NPC,talk,enterGlobe,exitGlobe,pick,advance,get dlg(){return dlgState;},get mode(){return mode;},get world(){return world===HUB?'hub':'inner';},LI,say,applyProfile,HUB,INNER,step:frame};
})();
