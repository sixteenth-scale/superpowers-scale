/* ---------- color & filament section: filament library + filament finder ----------------
   The coloring tool, the filament library and the filament finder live on their own tab, apart from
   the per-figure scale cards. */
(()=>{const C=window.SPC;if(!C)return;
const q=id=>document.getElementById(id);
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");

/* ---- the library ---- */
const LIB=LIB_ROWS.map(([vendor,type,line,color,hex,code])=>{const [cc,fid]=(code||"").split(":");
  return {vendor,type,line,color,hex:hex?"#"+hex:"",code:cc||"",fid:fid||""};});
const libName=f=>{const tw=new Set(f.type.toLowerCase().split(/\s+/));const line=(f.line||"").split(/\s+/).filter(w=>w&&!tw.has(w.toLowerCase())).join(" ");
  return [f.vendor,f.type,line,f.color].filter(Boolean).join(" ").replace(/\s+/g," ");};
/* a spool in two or more colors (dual, rainbow, "gold red green") is no match for one paint */
const MULTI=/mystic|magic|dual|rainbow|gradient|tri-?colou?r|multi|marble|galaxy|celestial|starlight|sparkle/i;
const COLW=/\b(red|green|blue|gold|silver|purple|black|white|yellow|orange|pink|copper|bronze)\b/gi;
LIB.forEach(f=>{f.name=libName(f);f.multi=MULTI.test(f.type+" "+f.line+" "+f.color)||(String(f.color).match(COLW)||[]).length>=3;f.L=f.hex?C.labHex(f.hex):null;});
const same=(a,b)=>a.hex&&b.hex&&a.hex.toUpperCase()===b.hex.toUpperCase()&&(a.vendor||"Bambu Lab")===(b.vendor||"Bambu Lab")&&
  (a.code&&b.code?a.code===b.code:String(a.color).toLowerCase()===String(b.color).toLowerCase());
const owned=f=>C.PAL.some(p=>p.owned!==false&&same(p,f));
function addOwned(f){if(owned(f))return;const i=C.PAL.findIndex(p=>same(p,f));
  if(i>=0)C.PAL[i].owned=true;else C.PAL.push({code:f.code,type:f.type+(f.line&&f.vendor!=="Bambu Lab"?" "+f.line:""),color:f.color,hex:f.hex.toUpperCase(),fid:f.fid,vendor:f.vendor,owned:true});
  C.savePalette();if(window._spcRenderPal)window._spcRenderPal();}
const TYPES=[["plabm","PLA Basic or Matte",t=>/^PLA(\+| Basic)?( Matte)?$/.test(t)||/^PLA\+? ?Matte$/.test(t)],["pla","Any PLA",t=>/^PLA/.test(t)],["plab","PLA Basic / PLA / PLA+",t=>/^PLA(\+| Basic)?$/.test(t)],["plam","PLA Matte",t=>/^PLA\+? ?Matte/.test(t)],
  ["plas","PLA Silk",t=>/^PLA\+? ?Silk/.test(t)],["plat","PLA Translucent",t=>/^PLA.*Translucent/.test(t)],["petg","PETG (any)",t=>/^PETG/.test(t)],
  ["tpu","TPU (any)",t=>/^TPU/.test(t)],["all","Everything",()=>true]];
const VENDORS=["Bambu Lab","Sunlu","eSun","Polymaker","Amolen"];
const sw=h=>h?`<i class="spf-sw" style="background:${h}"></i>`:`<i class="spf-sw spf-none" title="The maker publishes no color code for this one"></i>`;
const badge=f=>owned(f)?`<em class="spf-own">in your library</em>`:`<em class="spf-not">not in your library</em>`;

function renderLib(){const box=q("spfLib");if(!box)return;const s=(q("spfQ").value||"").toLowerCase().split(/\s+/).filter(Boolean);
  const tf=(TYPES.find(t=>t[0]===q("spfType").value)||TYPES[8])[2],vd=q("spfVendor").value,mine=q("spfMine").value;
  let rows=LIB.filter(f=>tf(f.type)&&(!vd||f.vendor===vd)&&s.every(w=>f.name.toLowerCase().includes(w)));
  if(mine==="own")rows=rows.filter(owned);else if(mine==="not")rows=rows.filter(f=>!owned(f));
  const n=rows.length;rows=rows.slice(0,300);
  box.innerHTML=`<div class="spf-count">${n} filament${n===1?"":"s"}${n>300?" — showing 300, narrow the search":""}</div>`+
    rows.map(f=>`<div class="spf-row">${sw(f.hex)}<span>${esc(f.name)}</span>${badge(f)}${owned(f)?"":`<button class="catbtn" data-add="${LIB.indexOf(f)}">I own this</button>`}</div>`).join("");}

/* ---- finder: the paints in one or more photos ---- */
async function imgPixels(file){const url=URL.createObjectURL(file);try{const im=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url;});
  const s=Math.min(1,640/Math.max(im.width,im.height)),w=Math.max(1,Math.round(im.width*s)),h=Math.max(1,Math.round(im.height*s));
  const cv=document.createElement("canvas");cv.width=w;cv.height=h;const cx=cv.getContext("2d");cx.drawImage(im,0,0,w,h);return cx.getImageData(0,0,w,h).data;}
  finally{URL.revokeObjectURL(url);}}
const chroma=l=>Math.hypot(l[1],l[2]),hue=l=>Math.atan2(l[2],l[1])*180/Math.PI;
function paletteOf(pixelSets){
  /* every photo counts the same however big it is; plain backdrop and glare are left out */
  const P=[],W=[];
  for(const d of pixelSets){const keep=[];for(let i=0;i<d.length;i+=4){if(d[i+3]<128)continue;const l=C.lab(d[i]/255,d[i+1]/255,d[i+2]/255);
      if(l[0]>90&&chroma(l)<8)continue;keep.push(l);}
    const w=1/Math.max(1,keep.length);for(const l of keep){P.push(l);W.push(w);}}
  if(!P.length)return [];
  /* k-means in Lab, seeded far apart */
  const K=Math.min(12,P.length),cen=[P[0].slice()];const dist=new Float64Array(P.length).fill(Infinity);
  while(cen.length<K){let bi=0,bd=-1;const c=cen[cen.length-1];for(let i=0;i<P.length;i+=3){const d=(P[i][0]-c[0])**2+(P[i][1]-c[1])**2+(P[i][2]-c[2])**2;if(d<dist[i])dist[i]=d;if(dist[i]*W[i]>bd){bd=dist[i]*W[i];bi=i;}}cen.push(P[bi].slice());}
  const asg=new Int32Array(P.length).fill(-1),step=Math.max(1,Math.floor(P.length/120000));
  for(let it=0;it<16;it++){const acc=cen.map(()=>[0,0,0,0]),last=it===15;
    for(let i=0;i<P.length;i+=last?1:step){let b=0,bd=Infinity;for(let k=0;k<K;k++){const c=cen[k],d=(P[i][0]-c[0])**2+(P[i][1]-c[1])**2+(P[i][2]-c[2])**2;if(d<bd){bd=d;b=k;}}asg[i]=b;const a=acc[b];a[0]+=P[i][0]*W[i];a[1]+=P[i][1]*W[i];a[2]+=P[i][2]*W[i];a[3]+=W[i];}
    acc.forEach((a,k)=>{if(a[3]>0)cen[k]=[a[0]/a[3],a[1]/a[3],a[2]/a[3]];});}
  let cl=cen.map((c,k)=>({ids:[],w:0,k}));for(let i=0;i<P.length;i++){cl[asg[i]].ids.push(i);cl[asg[i]].w+=W[i];}
  cl=cl.filter(c=>c.ids.length);
  /* one paint = one color: its shadows and highlights fold into it (same hue, same family of chroma) */
  const mean=c=>{let a=[0,0,0],w=0;for(const i of c.ids){a[0]+=P[i][0]*W[i];a[1]+=P[i][1]*W[i];a[2]+=P[i][2]*W[i];w+=W[i];}return a.map(x=>x/w);};
  cl.forEach(c=>c.m=mean(c));
  const samePaint=(a,b)=>{if(C.dE(a.m,b.m)<10)return true;const ca=chroma(a.m),cb=chroma(b.m);
    let dh=Math.abs(hue(a.m)-hue(b.m));if(dh>180)dh=360-dh;
    if(ca<15&&cb<15&&C.dE(a.m,b.m)<20)return true;                         /* a dark paint and its sheen */
    const [big,sm]=a.w>=b.w?[a,b]:[b,a],cB=chroma(big.m),cS=chroma(sm.m);   /* glare: lighter, paler, same hue */
    if(sm.w<0.5*big.w&&sm.m[0]>big.m[0]+12&&cS<cB&&cS>2&&dh<30)return true;
    if(ca<12||cb<12)return false;return dh<12&&Math.min(ca,cb)/Math.max(ca,cb)>0.5;};
  for(let changed=true;changed;){changed=false;
    outer:for(let i=0;i<cl.length;i++)for(let j=i+1;j<cl.length;j++)if(samePaint(cl[i],cl[j])){cl[i].ids.push(...cl[j].ids);cl[i].w+=cl[j].w;cl[i].m=mean(cl[i]);cl.splice(j,1);changed=true;break outer;}}
  {const acc=[];for(let i=0;i<P.length;i++){const l=P[i];if(chroma(l)<30)continue;let near=Infinity,glare=false;for(const c of cl){near=Math.min(near,C.dE(l,c.m));
       let dh=Math.abs(hue(l)-hue(c.m));if(dh>180)dh=360-dh;if(dh<30&&chroma(c.m)>20&&l[0]>c.m[0])glare=true;}
     if(near>25&&!glare)acc.push(i);}
   const aw=acc.reduce((s,i)=>s+W[i],0);
   if(aw>0.0008){const grp=[];for(const i of acc){let g=grp.find(g=>C.dE(P[i],g.m)<15);if(!g){g={ids:[],w:0,m:P[i]};grp.push(g);}g.ids.push(i);g.w+=W[i];}
     for(const g of grp)if(g.w>0.0005){const ids=new Set(g.ids);for(const c of cl)c.ids=c.ids.filter(i=>!ids.has(i));g.m=mean(g);g.acc=true;cl.push(g);}
     cl=cl.filter(c=>c.ids.length);cl.forEach(c=>{c.w=c.ids.reduce((s,i)=>s+W[i],0);});}}
  const tot=cl.reduce((s,c)=>s+c.w,0);
  /* the paint itself is its lit color: the upper middle of its lightness, not the shadow, not the glare */
  const out=cl.map(c=>{const Ls=c.ids.map(i=>P[i][0]).sort((x,y)=>x-y),small=c.w/tot<0.02,lo=Ls[Math.floor(Ls.length*(small?0.65:0.45))],hi=Ls[Math.min(Ls.length-1,Math.floor(Ls.length*(small?0.97:0.85)))]; /* a small detail is mostly edge and shade: take its brightest part */
      let a=[0,0,0],w=0;for(const i of c.ids){const l=P[i];if(l[0]<lo||l[0]>hi)continue;a[0]+=l[0]*W[i];a[1]+=l[1]*W[i];a[2]+=l[2]*W[i];w+=W[i];}
      const lab=w?a.map(x=>x/w):c.m;return {lab,share:c.w/tot,acc:c.acc};})
    .filter(c=>c.share>=0.02||c.acc||(c.share>=0.0008&&chroma(c.lab)>25))
    .sort((a,b)=>b.share-a.share);
  out.forEach(c=>c.hex=labToHex(c.lab));return out;}
function labToHex([L,a,b]){const fy=(L+16)/116,fx=fy+a/500,fz=fy-b/200,f=t=>t**3>0.008856?t**3:(t-16/116)/7.787;
  const X=0.95047*f(fx),Y=f(fy),Z=1.08883*f(fz);
  const r=3.2406*X-1.5372*Y-0.4986*Z,g=-0.9689*X+1.8758*Y+0.0415*Z,bb=0.0557*X-0.2040*Y+1.0570*Z;
  const gm=v=>v<=0.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-0.055;return C.rgb2hex([r,g,bb].map(gm));}
const fit=d=>d<=5?"match":d<=10?"close":d<=20?"rough":"far";
function suggest(lab,tf,vendors){
  const mine=C.PAL.filter(p=>p.owned!==false&&p.hex).map(p=>({f:p,name:C.fname(p),d:C.dE(lab,C.labHex(p.hex))})).sort((a,b)=>a.d-b.d).slice(0,2);
  const best=mine.length?mine[0].d:Infinity;
  const buy=LIB.filter(f=>f.L&&!f.multi&&tf(f.type)&&vendors.includes(f.vendor)&&!owned(f)).map(f=>({f,name:f.name,d:C.dE(lab,f.L)})).filter(x=>x.d<best-1).sort((a,b)=>a.d-b.d);
  const seen=new Set(),pick=[];for(const x of buy){const k=x.f.vendor;if(pick.length<4&&(!seen.has(k)||pick.length>=2)){pick.push(x);seen.add(k);}}
  return {mine,buy:pick.sort((a,b)=>a.d-b.d)};}
let FOUND=[];
function renderFinder(){const box=q("spfOut");if(!box)return;if(!FOUND.length){box.innerHTML="";return;}
  const tf=(TYPES.find(t=>t[0]===q("spfFType").value)||TYPES[0])[2],vendors=VENDORS.filter(v=>{const c=q("spfV_"+v.replace(/\W/g,""));return !c||c.checked;});
  box.innerHTML=FOUND.map((c,ci)=>{const s=suggest(c.lab,tf,vendors);
    const line=(x,i)=>`<div class="spf-row">${sw(x.f.hex)}<span>${esc(x.name)}</span><em class="spf-fit spf-${fit(x.d)}">${fit(x.d)} · ΔE ${x.d.toFixed(0)}</em>${i!=null?`<button class="catbtn" data-addf="${i}">I own this</button>`:""}</div>`;
    return `<div class="spf-paint"><div class="spf-ph">${sw(c.hex)}<b>${c.hex}</b><span>${(c.share*100).toFixed(c.share<0.01?1:0)}% of the figure</span></div>
      <div class="spf-cols"><div><div class="lbl">Closest you own</div>${s.mine.map(x=>line(x)).join("")||"<div class='spf-none-t'>Nothing in your library yet</div>"}</div>
      <div><div class="lbl">Closer to the photo — not in your library</div>${s.buy.map(x=>line(x,LIB.indexOf(x.f))).join("")||"<div class='spf-none-t'>Nothing closer than what you own</div>"}</div></div></div>`;}).join("");}
async function runFinder(files){const imgs=[...files].filter(f=>/^image\//.test(f.type));if(!imgs.length)return;
  q("spfFiles").innerHTML=imgs.map(f=>`<span class="spc-chip">${esc(f.name)}</span>`).join("");q("spfOut").innerHTML="<div class='spf-count'>Reading the photos…</div>";
  await new Promise(r=>setTimeout(r,20));
  try{FOUND=paletteOf(await Promise.all(imgs.map(imgPixels)));}catch(e){q("spfOut").innerHTML="<div class='spf-count'>Couldn't read those images.</div>";return;}
  renderFinder();}
window._spfPalette=async files=>paletteOf(await Promise.all([...files].map(imgPixels)));
window._spfSuggest=(hex,type)=>suggest(C.labHex(hex),(TYPES.find(t=>t[0]===(type||"plabm"))||TYPES[0])[2],VENDORS);

/* ---- its own tab ---- */
function tabs(){const card=q("spc"),lib=q("spfCard"),fin=q("spfFinder");if(!card||q("spfSec"))return;
  const sec=document.createElement("section");sec.id="spfSec";sec.className="spf-sec";sec.hidden=true;
  [fin,card,lib].forEach(e=>e&&sec.appendChild(e));const main=document.querySelector("main");main.appendChild(sec);
  const nav=document.createElement("nav");nav.className="spf-tabs wrap";
  nav.innerHTML=`<button data-t="scale">Scale bench</button><button data-t="color">Color &amp; filament</button>`;
  document.querySelector("header").after(nav);
  const show=t=>{[...main.children].forEach(e=>{if(e!==sec)e.hidden=t==="color";});sec.hidden=t!=="color";
    nav.querySelectorAll("button").forEach(b=>b.classList.toggle("on",b.dataset.t===t));
    if(t==="color"){renderLib();}history.replaceState(null,"",t==="color"?"#color":location.pathname+location.search);};
  nav.addEventListener("click",e=>{const b=e.target.closest("button");if(b)show(b.dataset.t);});
  show(location.hash==="#color"?"color":"scale");}
function wire(){
  q("spfType").innerHTML=TYPES.map(t=>`<option value="${t[0]}">${t[1]}</option>`).join("");q("spfType").value="all";
  q("spfFType").innerHTML=TYPES.map(t=>`<option value="${t[0]}">${t[1]}</option>`).join("");q("spfFType").value="plabm";
  q("spfVendor").innerHTML=`<option value="">All makers</option>`+VENDORS.map(v=>`<option>${v}</option>`).join("");
  q("spfVend").innerHTML=VENDORS.map(v=>`<label><input type="checkbox" id="spfV_${v.replace(/\W/g,"")}" checked> ${v}</label>`).join("");
  ["spfQ","spfType","spfVendor","spfMine"].forEach(id=>q(id).addEventListener("input",renderLib));
  q("spfFType").addEventListener("input",renderFinder);q("spfVend").addEventListener("change",renderFinder);
  q("spfLib").addEventListener("click",e=>{const b=e.target.closest("[data-add]");if(b){addOwned(LIB[+b.dataset.add]);renderLib();renderFinder();}});
  q("spfOut").addEventListener("click",e=>{const b=e.target.closest("[data-addf]");if(b){addOwned(LIB[+b.dataset.addf]);renderFinder();renderLib();}});
  const drop=q("spfDrop"),inp=q("spfFile");drop.addEventListener("click",()=>inp.click());drop.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();inp.click();}});
  inp.addEventListener("change",()=>{runFinder(inp.files);inp.value="";});
  drop.addEventListener("dragover",e=>{e.preventDefault();drop.classList.add("over");});drop.addEventListener("dragleave",()=>drop.classList.remove("over"));
  drop.addEventListener("drop",e=>{e.preventDefault();drop.classList.remove("over");runFinder(e.dataTransfer.files);});
  tabs();}
window.SPF={LIB,paletteOf,suggest,owned};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",wire);else wire();
})();
