(()=>{
const C=SPC, q=id=>document.getElementById(id);
if(!q("spc"))return;
const S=window._spcS={on:new Set(),figPart:-1,target:null,figure:null,images:[],colored:null, parts:[],project:null, offs:[],nFaces:0,
  raw:null,label:null,regions:[],area:null,nb:[],selected:-1,undo:[],showRaw:false,mode:"sel",viewer:null,targetName:""};
const tick=()=>new Promise(r=>setTimeout(r,0));
const log=(m,err)=>{const el=q("spcLog");el.innerHTML=err?`<span class="err">${esc(m)}</span>`:esc(m);};
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;");
C.loadPalette();

/* ---------- settings ---------- */
try{localStorage.removeItem("spcMeshyKey");q("spcKey").value="";const st=JSON.parse(localStorage.getItem("spcSettings")||"{}");
  if(st.slots)q("spcSlots").value=st.slots;if(st.detail)q("spcDetail").value=st.detail;}catch(e){}
const saveSet=()=>{try{
  localStorage.setItem("spcSettings",JSON.stringify({slots:+q("spcSlots").value,detail:+q("spcDetail").value}));}catch(e){}};
["spcKey","spcSlots","spcDetail"].forEach(id=>q(id).addEventListener("change",()=>{saveSet();ready();}));

/* ---------- palette panel ---------- */
const palLab=()=>C.PAL.map(f=>C.labHex(f.hex));
window._spcRenderPal=()=>renderPal();
function renderPal(){
  q("spcPalN").textContent=`(${C.PAL.length})`;
  q("spcPal").innerHTML=C.PAL.map((f,i)=>`<div class="spc-pf"><i style="background:${f.hex}"></i><span>${esc(C.fname(f))}${f.owned===false?" <em>not owned</em>":f.order?" <em>on order</em>":""}</span><button data-i="${i}" title="Remove">×</button></div>`).join("");
  q("spcPal").querySelectorAll("button").forEach(b=>b.onclick=()=>{
    const i=+b.dataset.i; if(S.regions.some(r=>r.fil===i)){log("That filament is in use by a region. Change the region first.",true);return;}
    C.PAL.splice(i,1); S.regions.forEach(r=>{if(r.fil>i)r.fil--;}); C.savePalette(); renderPal(); renderRegions();});
  q("spcBrush").innerHTML=C.PAL.map((f,i)=>`<option value="${i}">${esc(C.fname(f))}</option>`).join("");
}
function addPal(f){const i=C.PAL.findIndex(p=>p.hex===f.hex&&C.fname(p)===C.fname(f));if(i>=0)return i;C.PAL.push(f);C.savePalette();renderPal();return C.PAL.length-1;}
q("spcPal").parentElement.addEventListener("toggle",async e=>{if(!e.target.open||q("spcCatL").children.length)return;
  try{const cat=await C.catalog();q("spcCatL").innerHTML=cat.map(c=>`<option value="${esc(c.type+" "+c.color+" ("+c.code+")")}">`).join("");}catch(err){}});
q("spcCatAdd").onclick=async()=>{const v=q("spcCatQ").value.trim();if(!v)return;
  try{const cat=await C.catalog();const m=/\((\w+)\)\s*$/.exec(v);
    const hit=cat.find(c=>m&&c.code===m[1])||cat.find(c=>(c.type+" "+c.color).toLowerCase()===v.toLowerCase());
    if(!hit){log("No Bambu color by that name.",true);return;} addPal({...hit,owned:true});q("spcCatQ").value="";renderRegions();}
  catch(e){log("Could not load Bambu's color list: "+e.message,true);}};
q("spcOwnAdd").onclick=()=>{const n=q("spcOwnName").value.trim();if(!n)return;
  const parts=n.split(/\s+/), type=/PETG/i.test(n)?"PETG":/TPU/i.test(n)?"TPU":"PLA";
  addPal({vendor:parts[0],type:"",color:parts.slice(1).join(" ")||n,hex:q("spcOwnHex").value.toUpperCase(),fid:"",owned:true,ptype:type});
  q("spcOwnName").value="";renderRegions();};
q("spcPalReset").onclick=()=>{if(S.regions.length){log("Clear the current model first.",true);return;}
  C.PAL=C.OWNED.map(f=>({...f}));C.savePalette();renderPal();};
renderPal();

/* ---------- inputs ---------- */
function hookDrop(dropId,fileId,fn){const d=q(dropId),f=q(fileId);
  d.addEventListener("click",()=>f.click());
  d.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();f.click();}});
  f.addEventListener("change",e=>{fn([...e.target.files]);f.value="";});
  ["dragenter","dragover"].forEach(t=>d.addEventListener(t,e=>{e.preventDefault();d.classList.add("over");}));
  ["dragleave","drop"].forEach(t=>d.addEventListener(t,e=>{e.preventDefault();d.classList.remove("over");}));
  d.addEventListener("drop",e=>fn([...e.dataTransfer.files]));}
async function loadModel(file){
  const buf=await file.arrayBuffer();
  if(/\.3mf$/i.test(file.name)){const pr=await C.read3MF(buf,file.name.replace(/\.3mf$/i,""));
    if(!pr.parts.length)throw new Error("no meshes in "+file.name); return {name:file.name,pr,parts:pr.parts};}
  const m=C.stlOf(buf); if(!m)throw new Error("could not read "+file.name);
  return {name:file.name,pr:null,parts:[{name:file.name.replace(/\.stl$/i,""),m,M:C.I4(),paint:null}]};
}
hookDrop("spcDropT","spcFileT",async fs=>{fs=fs.filter(f=>/\.(3mf|stl)$/i.test(f.name));if(!fs.length)return;
  try{
    if(fs.length===1){log("Reading "+fs[0].name+"…");S.target=await loadModel(fs[0]);S.targetName=fs[0].name;}
    else{ /* several files: each piece kept as it is, laid out side by side in a new project */
      const parts=[];
      for(const [i,f] of fs.entries()){log(`Reading ${i+1} of ${fs.length}: ${f.name}…`);await tick();
        const t=await loadModel(f);t.parts.forEach(p=>{p.paint=null;if(t.parts.length===1)p.name=f.name.replace(/\.\w+$/,"");parts.push(p);});}
      layout(parts);
      const stems=fs.map(f=>f.name.replace(/\.\w+$/,""));let pre=stems[0];stems.forEach(s=>{while(!s.startsWith(pre))pre=pre.slice(0,-1);});
      pre=pre.replace(/[\s_\-]+$/,"")||"Pieces";
      S.target={name:`${fs.length} files`,pr:null,parts};S.targetName=pre+".3mf";}
    setupTarget();}catch(e){log(e.message,true);}});
function layout(parts){ /* sit each piece on the bed, in rows across a 256 mm plate */
  const gap=6,W=256;let x=gap,y=gap,row=0;
  for(const p of parts){const b=C.bboxOf(C.xf(p.M,p.m.v)),w=b.hi[0]-b.lo[0],d=b.hi[1]-b.lo[1];
    if(x+w>W-gap&&x>gap){x=gap;y+=row+gap;row=0;}
    const T=[1,0,0,0,0,1,0,0,0,0,1,0,x-b.lo[0],y-b.lo[1],-b.lo[2],1];p.M=C.mul4(T,p.M);
    x+=w+gap;row=Math.max(row,d);}
}
hookDrop("spcDropF","spcFileF",async fs=>{if(!fs[0])return;log("Reading "+fs[0].name+"…");
  try{S.figure=await loadModel(fs[0]);log("");chips();ready();}catch(e){log(e.message,true);}});
hookDrop("spcDropI","spcFileI",async fs=>{
  const imgs=fs.filter(f=>/^image\//.test(f.type)), mod=fs.find(f=>/\.(glb|3mf)$/i.test(f.name));
  if(imgs.length)S.images=imgs.slice(0,4);
  if(mod){log("Reading "+mod.name+"…");try{
    if(/\.glb$/i.test(mod.name))S.colored={name:mod.name,sources:await C.readGLB(await mod.arrayBuffer())};
    else{const t=await loadModel(mod);S.colored={name:mod.name,sources:paintedSources(t)};}
    log("");}catch(e){log(e.message,true);}}
  chips();ready();});
function paintedSources(t){ /* a painted 3MF as a colored source */
  const fc=(t.pr&&t.pr.ps&&t.pr.ps.filament_colour)||["#808080"];
  return t.parts.map(p=>{const n=p.m.f.length/3,rgb=new Float32Array(n*3);
    for(let i=0;i<n;i++){const s=p.paint?C.unpaint(p.paint[i]):1,c=C.hex2rgb(fc[Math.max(0,Math.min(fc.length-1,(s||1)-1))]);rgb.set(c,i*3);}
    return {m:{v:C.xf(p.M,p.m.v),f:p.m.f},faceRGB:rgb,factor:[1,1,1,1]};});
}
function chips(){
  const c=[];
  if(S.target)c.push(`<span class="spc-chip">model <b>${esc(S.target.name)}</b> · ${S.target.parts.length} piece${S.target.parts.length>1?"s":""}</span>`);
  if(S.figure)c.push(`<span class="spc-chip">figure <b>${esc(S.figure.name)}</b></span>`);
  if(S.images.length)c.push(`<span class="spc-chip">art <b>${S.images.length} image${S.images.length>1?"s":""}</b></span>`);
  if(S.colored)c.push(`<span class="spc-chip">colored <b>${esc(S.colored.name)}</b></span>`);
  q("spcFiles").innerHTML=c.join("");
}
function ready(){
  const haveColor=S.colored||S.images.length; /* reference photos alone are enough */
  q("spcGo").disabled=!(S.target&&haveColor);
  q("spcGo").title=!S.target?"Add the model to color":!haveColor?"Add reference photos or a colored model":"";
}

/* ---------- set up target: geometry, viewer, existing paint ---------- */
function setupTarget(){
  const t=S.target; S.parts=t.parts; S.project=t.pr&&t.pr.bambu?t.pr:(t.pr||null);
  S.raw=null;S.undo=[];S.selected=-1;q("spcUndo").disabled=true;
  const nPl=new Set(t.parts.map(p=>p.plate||0)).size;
  S.on=nPl>1?new Set():new Set(t.parts.map((_,i)=>i));S.figPart=-1;S.isolate=-1;
  /* a piece named like the project is the whole figure, already in the file */
  const stem=t.name.replace(/\.\w+$/,"").toLowerCase();
  if(t.parts.length>1){const fi=t.parts.findIndex(p=>p.name.replace(/\.\w+$/,"").toLowerCase()===stem);if(fi>=0&&!S.figure){S.figPart=fi;S.on.delete(fi);}}
  rebuildIndex();
  const painted=t.parts.some(p=>p.paint);
  if(painted){ /* reopen: one region per filament already used */
    const fc=(t.pr.ps&&t.pr.ps.filament_colour)||[];
    const state=new Int32Array(S.nFaces);
    t.parts.forEach((p,pi)=>{for(let i=0;i<p.m.f.length/3;i++)state[S.offs[pi]+i]=p.paint?C.unpaint(p.paint[i])||1:0;});
    const used=[...new Set(state)].filter(s=>s>0).sort((a,b)=>a-b), map=new Map([[0,-1]]);
    S.regions=used.map((s,ri)=>{map.set(s,ri);const hex=(fc[s-1]||"#808080").slice(0,7).toUpperCase();
      const i=C.PAL.findIndex(f=>f.hex===hex);const fil=i>=0?i:addPal({vendor:"",type:"",color:"Filament "+s+" "+hex,hex,fid:"",owned:false});
      return {id:ri,rgb:C.hex2rgb(hex),fil,area:0,dE:0,patch:false};});
    S.label=Int32Array.from(state,s=>map.get(s));
    sumAreas(); log(`Reopened ${t.name} — ${S.regions.length} filaments already painted. Edit below, or add art and Color it to start over.`);
    q("spcSave").disabled=false;
  } else {S.regions=[];S.label=null;q("spcSave").disabled=true;log(t.parts.length>1?`${t.parts.length} pieces loaded. If these are parted out, add the whole figure in box 2.`:"");}
  showViewer(); chips(); renderPieces(); renderRegions(); ready();
  q("spcState").textContent=`${S.nFaces.toLocaleString()} triangles`;
}
function rebuildIndex(){S.offs=[];let o=0;S.parts.forEach(p=>{S.offs.push(o);o+=p.m.f.length/3;});S.nFaces=o;
  S.area=new Float32Array(o);S.parts.forEach((p,pi)=>S.area.set(C.areas(p.m,p.M),S.offs[pi]));S.nb=S.parts.map(p=>C.adjacency(p.m));}
function sumAreas(){S.regions.forEach(r=>r.area=0);for(let i=0;i<S.nFaces;i++)if(S.label[i]>=0)S.regions[S.label[i]].area+=S.area[i];}
function shownParts(){const on=[...S.on].filter(i=>i!==S.figPart);return on.length?on.sort((a,b)=>a-b):S.parts.map((_,i)=>i);}
function visibleParts(){const all=shownParts();return S.isolate!=null&&S.isolate>=0&&all.includes(S.isolate)?[S.isolate]:all;}
function showViewer(keepView){
  q("spcViewWrap").hidden=false;
  if(!S.viewer){S.viewer=C.Viewer(q("spcCv"),onPick);if(!S.viewer){log("This browser has no WebGL2 — the 3D view is off, but coloring and saving still work.",true);return;}}
  const vis=visibleParts();let n=0;vis.forEach(pi=>n+=S.parts[pi].m.f.length/3);
  const pos=new Float32Array(n*9);S.vmap=new Int32Array(n);S.vrange=new Map();let o=0;
  vis.forEach(pi=>{const p=S.parts[pi],v=C.xf(p.M,p.m.v),f=p.m.f,nf=f.length/3,g=S.offs[pi];
    for(let i=0;i<f.length;i++){const k=f[i]*3;pos[o*9+i*3]=v[k];pos[o*9+i*3+1]=v[k+1];pos[o*9+i*3+2]=v[k+2];}
    for(let t=0;t<nf;t++)S.vmap[o+t]=g+t; S.vrange.set(pi,[o,o+nf]); o+=nf;});
  S.vpos=pos; S.viewer.setGeometry(pos,keepView); paint();
  const iso=S.isolate!=null&&S.isolate>=0&&vis.length===1?S.isolate:-1;
  q("spcFocus").innerHTML=`<option value="">${iso>=0?"Show all pieces":"Zoom to piece…"}</option>`+shownParts().map(pi=>`<option value="${pi}"${pi===iso?" selected":""}>${esc(S.parts[pi].name)}</option>`).join("");
}
function paint(){ if(!S.viewer||!S.vmap)return;
  const n=S.vmap.length,col=new Uint8Array(n*9);
  const fade=x=>x*0.25+235*0.75;
  const fc=S.regions.map((r,ri)=>{const c=(S.showRaw||r.fil<0?r.rgb:C.hex2rgb(C.PAL[r.fil].hex)).map(x=>x*255);
    return S.selected>=0&&ri!==S.selected?c.map(fade):c;});
  for(let d=0;d<n;d++){const i=S.vmap[d];let c;const L=S.label?S.label[i]:-1;
    if(S.showRaw&&S.raw&&L>=0){c=[S.raw[i*3]*255,S.raw[i*3+1]*255,S.raw[i*3+2]*255];if(S.selected>=0&&L!==S.selected)c=c.map(fade);}
    else if(L>=0)c=fc[L];else c=[205,205,212];
    if(S.selSet&&!S.selSet[i])c=c.map(fade);
    for(let k=0;k<3;k++){col[d*9+k*3]=c[0];col[d*9+k*3+1]=c[1];col[d*9+k*3+2]=c[2];}}
  S.viewer.setColors(col);
}
/* ---------- pieces ---------- */
function renderPieces(){
  const box=q("spcPieces");
  if(!S.parts.length||S.parts.length<2&&S.figPart<0){box.innerHTML="";return;}
  const groups=new Map();S.parts.forEach((p,i)=>{const k=p.plate||0;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);});
  const keys=[...groups.keys()].sort((a,b)=>(a||99)-(b||99));
  box.innerHTML=`<div class="note">Tick the pieces to color — anything unticked is left exactly as it is. Mark the one-piece figure with <b>figure</b> if it is in this file — then box 2 isn't needed.</div>`+
    keys.map(k=>{const ids=groups.get(k),rest=ids.filter(i=>i!==S.figPart),all=rest.length>0&&rest.every(i=>S.on.has(i));
      /* a plate holding only the whole figure has nothing to color: its box is off and can't be ticked */
      return `<h4><input type="checkbox" data-plate="${k}" ${all?"checked":""} ${rest.length?"":"disabled title=\"Only the whole figure is on this plate — it guides the colors and is never painted\""}>${k?`Plate ${k}`:(keys.length>1?"Off the plates":"Pieces")}</h4>`+
        ids.map(i=>`<label class="spc-pc${S.on.has(i)?"":" off"}"><input type="checkbox" data-i="${i}" ${S.on.has(i)?"checked":""} ${i===S.figPart?"disabled":""}><span>${esc(S.parts[i].name)}</span><button data-fig="${i}" class="${i===S.figPart?"on":""}" title="This is the one-piece figure the others were cut from">figure</button></label>`).join("");}).join("");
  box.querySelectorAll("input[data-i]").forEach(c=>c.onchange=()=>{const i=+c.dataset.i;c.checked?S.on.add(i):S.on.delete(i);renderPieces();showViewer();});
  box.querySelectorAll("input[data-plate]").forEach(c=>c.onchange=()=>{groups.get(+c.dataset.plate).forEach(i=>{if(i===S.figPart)return;c.checked?S.on.add(i):S.on.delete(i);});renderPieces();showViewer();});
  box.querySelectorAll("button[data-fig]").forEach(b=>b.onclick=e=>{e.preventDefault();const i=+b.dataset.fig;
    if(S.figPart===i){S.figPart=-1;S.on.add(i);}else{if(S.figPart>=0)S.on.add(S.figPart);S.figPart=i;S.on.delete(i);}
    renderPieces();showViewer();ready();});
}

/* ---------- color it ---------- */
q("spcGo").onclick=()=>run().catch(e=>{q("spcGo").disabled=false;console.error(e);
  if(e.url){q("spcLog").innerHTML=`<span class="err">${esc(e.message)}</span>\n1. <a href="${esc(e.url)}" target="_blank" rel="noopener">Download the painted figure</a> (a .glb file — no extra Meshy credits)\n2. Drop it into box 3\n3. Click Color it again`;return;}
  log(e.message||String(e),true);});
async function run(){
  q("spcGo").disabled=true;q("spcSave").disabled=true;saveSet();S.keep=null;S.keepHard=null;S.skinReg=-1;S.pipeRegs=null;S.stripes=null;S.below=null;S.belowP=null;S.lineF=null;S.shoulderF=null;S.strokes=null;
  const detail=Math.max(0.1,+q("spcDetail").value||0.5), slots=Math.max(1,Math.min(16,+q("spcSlots").value||8));
  /* figure: box 2, or the model itself */
  const active=[...S.on].filter(i=>i!==S.figPart).sort((a,b)=>a-b);
  if(!active.length)throw new Error("No pieces are ticked to color.");
  let fig=S.figure?S.figure.parts:S.figPart>=0?[S.parts[S.figPart]]:active.map(i=>S.parts[i]);const parted=!!S.figure||S.figPart>=0;
  /* a whole figure exported at another size than its parts (a 50 mm figure for 116 mm parts) is brought to the
     parts' size: their surface area, less the cut faces, matches the figure's */
  if(parted){const sumA=(ps)=>ps.reduce((s,p)=>s+C.areas(p.m,p.M).reduce((a,b)=>a+b,0),0);
    const ap=sumA(S.parts.filter((p,i)=>i!==S.figPart&&!/rigid|pin|peg|coupon|wing|mace|cape|weapon|shield|staff|sword|gun|base|stand/i.test(p.name)&&/head|torso|chest|body|arm|thigh|calf|leg|shin|foot|boot|hand/i.test(p.name))), /* body parts only: accessories don't count */af=sumA(fig),k=Math.sqrt(ap/af/1.06); /* all the parts in the file, ticked or not */
    if(isFinite(k)&&(k>1.25||k<0.8)){let cx0=0,cy0=0,z00=Infinity,nn=0;fig.forEach(p=>{const v=C.xf(p.M,p.m.v);for(let i=0;i<v.length;i+=3){cx0+=v[i];cy0+=v[i+1];z00=Math.min(z00,v[i+2]);nn++;}});cx0/=nn;cy0/=nn;
      const Sm=[k,0,0,0,0,k,0,0,0,0,k,0,cx0*(1-k),cy0*(1-k),z00*(1-k),1]; /* about the figure's own feet */fig=fig.map(p=>({...p,M:C.mul4(Sm,p.M)}));log(`The whole figure is ${k>1?"smaller":"larger"} than the parts: scaled ×${k.toFixed(2)} to match.`);
      (window._spcDbg=window._spcDbg||{}).figScale=+k.toFixed(3);}}
  const figPts=(()=>{const tot=fig.reduce((s,p)=>s+p.m.f.length/3,0);const rng=C.RNG(11);const all=[];
    fig.forEach(p=>{const n=Math.max(500,Math.round(60000*(p.m.f.length/3)/tot));all.push(C.samplePts(p.m,p.M,n,rng).p);});
    const P=new Float32Array(all.reduce((s,a)=>s+a.length,0));let o=0;all.forEach(a=>{P.set(a,o);o+=a.length;});return {p:P};})();
  /* 1. colored source: a colored model if one was given; otherwise the reference photos are painted straight
     onto the figure (Meshy only when asked for) */
  const photoOnly=!S.colored&&S.images.length>0&&!window._spcUseMeshy;
  if(photoOnly&&!parted&&active.length>1)throw new Error("To color from photos, add the whole figure too (box 2), or mark the one-piece figure in the list with figure.");
  let sources,al,cloud;
  if(S.colored)sources=S.colored.sources;
  else if(photoOnly){let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity,z0=Infinity,z1=-Infinity;const P=figPts.p;
    for(let i=0;i<P.length;i+=3){x0=Math.min(x0,P[i]);x1=Math.max(x1,P[i]);y0=Math.min(y0,P[i+1]);y1=Math.max(y1,P[i+1]);z0=Math.min(z0,P[i+2]);z1=Math.max(z1,P[i+2]);}
    al={M:null,err:0,diag:Math.hypot(x1-x0,y1-y0,z1-z0)};}
  else{const key=q("spcKey").value.trim();
    const stl=C.stlBytes(fig.map(p=>({m:p.m,M:p.M})));
    const glb=await C.meshyTexture(key,stl,S.images,log);
    sources=await C.readGLB(glb); S.colored={name:"Meshy result",sources}; chips();
    try{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([glb],{type:"model/gltf-binary"}));
      a.download=(S.figure||S.target).name.replace(/\.\w+$/,"")+"_meshy.glb";a.click();}catch(e){}}
  /* 2. lay it over the figure */
  if(!photoOnly){log("Lining the colors up with your figure…");await tick();
  const allV=new Float32Array(sources.reduce((s,x)=>s+x.m.v.length,0));{let o=0;sources.forEach(x=>{allV.set(x.m.v,o);o+=x.m.v.length;});}
  al=await C.alignSource(allV,figPts,tick);
  if(al.err>0.03*al.diag)log(`Lined up, but the fit is loose (${al.err.toFixed(2)} mm average). Check the result.`);
  log("Sampling colors…");await tick();
  cloud=C.colorCloud(sources,al.M,Math.max(0.12,detail/2));}
  /* 3. pieces */
  let G=null;
  if(parted){G=C.grid(figPts.p,al.diag/80);}
  const raws=[],tol=[],regM=[];let flags=[],lastErr=0;
  const errs=[];
  for(let pi=0;pi<S.parts.length;pi++){const p=S.parts[pi];
    if(!active.includes(pi))continue;
    if(C.meanEdge(p.m,p.M)>detail){let guard=0;while(C.meanEdge(p.m,p.M)>detail&&p.m.f.length/3<2e6&&guard++<4){if(!p.m0){p.m0=p.m;p.lv=0;}p.m=C.subdivide(p.m);p.lv++;p.subdivided=true;p.paint=null;}}
    if(!window._spcNoSplit){const n0=p.m.f.length/3,m2=C.splitLong(p.m,p.M,Math.min(1.0,2*detail),2e6); /* long sliver triangles split, so a color line can't zigzag along them */if(m2.f.length/3>n0){p.m=m2;p.subdivided=true;p.paint=null;((window._spcDbg=window._spcDbg||{}).split=window._spcDbg.split||[]).push(p.name+':'+n0+'>'+m2.f.length/3);}}
    if(parted){log(`Finding piece ${active.indexOf(pi)+1} of ${active.length} on the figure: ${p.name}…`);await tick();
      const r=await C.registerPart(p,figPts,G,tick,al.diag/80);regM[pi]=r.M;errs[pi]=r.err;}}
  /* a piece named left or right belongs on that side of the figure: the side the other left pieces landed on.
     A mirror-image limb (a rigid leg) can fit the wrong leg almost as well, so it is placed again on its own side */
  let soleOk=()=>true;
  if(parted){let fx=0;for(let i=0;i<figPts.p.length;i+=3)fx+=figPts.p[i];fx/=figPts.p.length/3;
    const side=pi=>{const nm=S.parts[pi].name.toLowerCase();return /left/.test(nm)?1:/right/.test(nm)?-1:0;};
    const cx=(pi,M)=>{const v=C.xf(C.mul4(M,S.parts[pi].M),S.parts[pi].m.v);let x=0;for(let i=0;i<v.length;i+=3)x+=v[i];return x/(v.length/3)-fx;};
    let vote=0;for(const pi of active){const sd=side(pi);if(sd&&regM[pi]&&errs[pi]<0.8)vote+=sd*Math.sign(cx(pi,regM[pi]));}
    const leftSign=vote>=0?1:-1;
    for(const pi of active){const sd=side(pi);if(!sd||!regM[pi])continue;const want=sd*leftSign;
      if(Math.sign(cx(pi,regM[pi]))===want)continue;
      log(`Placing ${S.parts[pi].name} on its own side…`);await tick();
      const r=await C.registerPart(S.parts[pi],figPts,G,tick,al.diag/80,M=>Math.sign(cx(pi,M))===want);
      if(isFinite(r.err)&&Math.sign(cx(pi,r.M))===want){regM[pi]=r.M;errs[pi]=r.err;}}
    /* a piece sits where its name says on the figure: the head at the top, calves low. One that landed out of
       its band of height is placed again inside it */
    {let fz0=Infinity,fz1=-Infinity;for(let i=2;i<figPts.p.length;i+=3){fz0=Math.min(fz0,figPts.p[i]);fz1=Math.max(fz1,figPts.p[i]);}const Hh=fz1-fz0;(window._spcDbg=window._spcDbg||{}).figZ=[+fz0.toFixed(1),+fz1.toFixed(1)];
     const czz=(pi,M)=>{const v=C.xf(C.mul4(M,S.parts[pi].M),S.parts[pi].m.v);let z=0;for(let i=2;i<v.length;i+=3)z+=v[i];return (z/(v.length/3)-fz0)/Hh;};
     const band=nm=>/head/.test(nm)?[0.78,1]:/torso|chest|body/.test(nm)?[0.45,0.92]:/(^|[^a-z])arm([^a-z]|$)/.test(nm)?[0.4,0.92]:/thigh/.test(nm)?[0.3,0.68]:/calf|shin/.test(nm)?[0.03,0.45]:/rigid|leg/.test(nm)?[0.08,0.6]:/boot|foot/.test(nm)?[0,0.3]:null;
     /* a lower leg printed standing on its sole has that sole facing down on the figure: an upside-down fit
        (boot at the knee) fits the shape almost as well and paints the leg inside out */
     soleOk=(pi,M)=>{const nm=S.parts[pi].name.toLowerCase();if(!/calf|shin|boot|foot|rigid/.test(nm))return true;const p=S.parts[pi],v=C.xf(p.M,p.m.v),f=p.m.f,fn=C.faceNormals(p.m,p.M),n=f.length/3;
       let z0=Infinity;for(let i=2;i<v.length;i+=3)z0=Math.min(z0,v[i]);let ar=0,nz=0;
       for(let t=0;t<n;t++){const cz=(v[f[t*3]*3+2]+v[f[t*3+1]*3+2]+v[f[t*3+2]*3+2])/3;if(cz>z0+0.3||fn[t*3+2]>-0.9)continue;ar++;nz+=M[2]*fn[t*3]+M[6]*fn[t*3+1]+M[10]*fn[t*3+2];}
       return ar<20||nz/ar<-0.5;};
     for(const pi of active){const nm=S.parts[pi].name.toLowerCase();if(/pin|peg/.test(nm)||!regM[pi])continue;const bd=band(nm);if(!bd)continue;const h=czz(pi,regM[pi]);if(h>=bd[0]&&h<=bd[1]&&soleOk(pi,regM[pi]))continue;
       const sd=side(pi),want=sd*leftSign;log(`Placing ${S.parts[pi].name} at its height on the figure…`);await tick();
       const ok=M=>{const h2=czz(pi,M);return h2>=bd[0]&&h2<=bd[1]&&(!sd||Math.sign(cx(pi,M))===want)&&soleOk(pi,M);};
       const r=await C.registerPart(S.parts[pi],figPts,G,tick,al.diag/80,ok);if(isFinite(r.err)&&ok(r.M)){regM[pi]=r.M;errs[pi]=r.err;((window._spcDbg=window._spcDbg||{}).reband=window._spcDbg.reband||[]).push(S.parts[pi].name);}}}
    /* left and right twins sit at the same height: one that landed higher or lower than its twin is placed again,
       held to its twin's height (and its own side) */
    const cz=(pi,M)=>{const v=C.xf(C.mul4(M,S.parts[pi].M),S.parts[pi].m.v);let z=0;for(let i=2;i<v.length;i+=3)z+=v[i];return z/(v.length/3);};
    const base=pi=>S.parts[pi].name.toLowerCase().replace(/\.stl$/,"").replace(/^.*?_\d+_/,"").replace(/left|right/g,"#");
    for(const a of active){if(side(a)!==1||!regM[a])continue;const b=active.find(q=>side(q)===-1&&regM[q]&&base(q)===base(a));if(b==null)continue;
      const za=cz(a,regM[a]),zb=cz(b,regM[b]),xa=cx(a,regM[a]),xb=cx(b,regM[b]);if(Math.abs(za-zb)<=3&&Math.abs(xa+xb)<=3)continue;
      const [bad,good]=errs[a]>errs[b]?[a,b]:[b,a],zg=cz(good,regM[good]),xg=cx(good,regM[good]),want=side(bad)*leftSign;
      log(`Placing ${S.parts[bad].name} level with its twin…`);await tick();
      const okM=M=>Math.abs(cz(bad,M)-zg)<2.5&&Math.abs(cx(bad,M)+xg)<3&&Math.sign(cx(bad,M))===want&&soleOk(bad,M); /* level with its twin, and mirrored across the figure */
      const r=await C.registerPart(S.parts[bad],figPts,G,tick,al.diag/80,okM);
      if(isFinite(r.err)&&okM(r.M)){regM[bad]=r.M;errs[bad]=r.err;((window._spcDbg=window._spcDbg||{}).relevel=window._spcDbg.relevel||[]).push(S.parts[bad].name);continue;}
      /* not found that way: a mirrored part is its twin's pose mirrored across the figure, then fitted */
      {const pc=pi=>{const v=C.xf(S.parts[pi].M,S.parts[pi].m.v);let c=[0,0,0];for(let i=0;i<v.length;i+=3){c[0]+=v[i];c[1]+=v[i+1];c[2]+=v[i+2];}return c.map(x=>x/(v.length/3));};
       const T=(x,y,z)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1],cb=pc(bad),cg=pc(good),Fm=C.mul4(T(2*fx,0,0),[-1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
       const smp=C.samplePts(S.parts[bad].m,S.parts[bad].M,400,C.RNG(3)).p,P=[];for(let i=0;i<smp.length;i+=3)P.push([smp[i],smp[i+1],smp[i+2]]);
       let best=null;for(const ax of [0,1]){const Mi=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];Mi[ax*5]=-1;
         const Pm=C.mul4(T(...cg),C.mul4(Mi,T(-cb[0],-cb[1],-cb[2]))),M0=C.mul4(Fm,C.mul4(regM[good],Pm));
         const r2=C.icp(P,G,figPts.p,M0,30,false,4,al.diag/10);if(isFinite(r2.err)&&(!best||r2.err<best.err))best=r2;}
       if(best&&okM(best.M)&&best.err<errs[bad]*1.5){regM[bad]=best.M;errs[bad]=best.err;((window._spcDbg=window._spcDbg||{}).relevel=window._spcDbg.relevel||[]).push(S.parts[bad].name+" (mirror)");}}}}
  for(let pi=0;pi<S.parts.length;pi++){const p=S.parts[pi];
    if(!active.includes(pi)){raws.push(null);continue;}
    let Mx=null;
    if(parted){Mx=regM[pi];lastErr=errs[pi];(window._spcReg=window._spcReg||{})[p.name]={M:Mx,err:lastErr};if(lastErr>0.6)flags.push(`${p.name} (${lastErr.toFixed(2)} mm)`);}
    log(`Coloring ${p.name}…`);await tick();
    let tr;if(photoOnly){/* how far each face sits from the figure's surface: far means hidden (joints, sockets) */
      const g=pieceGeo(pi,parted?regM:null),dist=new Float32Array(g.n);
      if(parted)for(let t=0;t<g.n;t++)dist[t]=G.near(g.c[t*3],g.c[t*3+1],g.c[t*3+2],8)[1];
      tr={rgb:new Float32Array(g.n*3).fill(0.5),dist};}
    else tr=await C.transferColors(p,cloud,Mx,tick);raws.push(tr);tol[pi]=photoOnly?Math.max(3,4*(Mx?lastErr:0)):Math.max(0.5,3*(Mx?lastErr:0)+2*al.err);} /* from photos, a part may differ from the whole figure by a few mm and still be on show; contacts are found apart */
  rebuildIndex();S.areaC={};
  S.raw=new Float32Array(S.nFaces*3).fill(0.8);raws.forEach((r,pi)=>{if(r)S.raw.set(r.rgb,S.offs[pi]*3);});
  if(photoOnly){log("Painting your photos onto the figure…");await tick();const pr=await photoProject(S.images,fig,active,parted?regM:null);
    for(const pi of active){const o=S.offs[pi],n=S.parts[pi].m.f.length/3;for(let t=0;t<n;t++)if(pr[(o+t)*3]>=0)for(let k=0;k<3;k++)S.raw[(o+t)*3+k]=pr[(o+t)*3+k];}}
  const act=new Uint8Array(S.nFaces);active.forEach(pi=>act.fill(1,S.offs[pi],S.offs[pi]+S.parts[pi].m.f.length/3));
  /* faces with no matching surface on the figure (cut faces, joints, hip tops, sockets) are hidden:
     they don't vote for colors and later take the color next to them */
  const hid=new Uint8Array(S.nFaces);
  raws.forEach((r,pi)=>{if(!r)return;const o=S.offs[pi];for(let i=0;i<r.dist.length;i++)if(r.dist[i]>tol[pi])hid[o+i]=1;});
  const W=Float32Array.from(S.area,(a,i)=>a*act[i]*(hid[i]?0:1));
  /* 4. regions */
  log("Finding color regions…");await tick();
  const L=new Float32Array(S.nFaces*3);for(let i=0;i<S.nFaces;i++){const l=C.lab(S.raw[i*3],S.raw[i*3+1],S.raw[i*3+2]);L[i*3]=l[0];L[i*3+1]=l[1];L[i*3+2]=l[2];}
  const cents=C.kmeans(L,W,16,C.RNG(5));
  const lab=new Int32Array(S.nFaces);
  for(let i=0;i<S.nFaces;i++){if(!act[i]){lab[i]=-1;continue;}let b=0,bd=Infinity;for(let c=0;c<cents.length;c++){const d=(L[i*3]-cents[c][0])**2+(L[i*3+1]-cents[c][1])**2+(L[i*3+2]-cents[c][2])**2;if(d<bd){bd=d;b=c;}}lab[i]=b;}
  if(window._spcSnap)window._spcSnap('kmeans',lab,x=>C.lab2rgb?null:null,hid,cents);
  /* merge regions that are the same color in practice */
  const k=cents.length, rgbSum=cents.map(()=>[0,0,0,0]);
  for(let i=0;i<S.nFaces;i++){if(lab[i]<0)continue;const s=rgbSum[lab[i]],a=S.area[i];s[0]+=S.raw[i*3]*a;s[1]+=S.raw[i*3+1]*a;s[2]+=S.raw[i*3+2]*a;s[3]+=a;}
  let regs=rgbSum.map((s,i)=>({rgb:s[3]?[s[0]/s[3],s[1]/s[3],s[2]/s[3]]:[0,0,0],area:s[3],alias:i}));
  for(;;){let best=null;const live=regs.filter(r=>r.area>0&&r.alias===regs.indexOf(r));
    for(let a=0;a<live.length;a++)for(let b=a+1;b<live.length;b++){const d=C.dE(C.lab(...live[a].rgb),C.lab(...live[b].rgb)),sh=shadeOf(live[a],live[b]);if((d<7||sh)&&(!best||d<best[0]))best=[d,live[a],live[b]];}
    if(!best)break;const [,A,B]=best,ia=regs.indexOf(A),ib=regs.indexOf(B),t=A.area+B.area;
    A.rgb=A.rgb.map((x,j)=>(x*A.area+B.rgb[j]*B.area)/t);A.area=t;B.area=0;regs.forEach(r=>{if(r.alias===ib)r.alias=ia;});}
  for(let i=0;i<S.nFaces;i++)if(lab[i]>=0)lab[i]=regs[lab[i]].alias;
  /* a color that sits between two others and covers less than either is where they blur together at an
     edge (orange between red and skin): its faces go to whichever side they are nearer */
  {const live=regs.map((r,i)=>i).filter(i=>regs[i].alias===i&&regs[i].area>0),lb=i=>C.lab(...regs[i].rgb),drop=new Map();
    for(const x of live){const X=lb(x);let hit=null;
      for(const a of live)for(const b of live){if(a>=b||a===x||b===x||regs[x].area>=Math.min(regs[a].area,regs[b].area))continue;
        const A=lb(a),B=lb(b),AB=[B[0]-A[0],B[1]-A[1],B[2]-A[2]],n2=AB[0]**2+AB[1]**2+AB[2]**2;if(n2<1)continue;
        const t=((X[0]-A[0])*AB[0]+(X[1]-A[1])*AB[1]+(X[2]-A[2])*AB[2])/n2;if(t<0.15||t>0.85)continue;
        const d=Math.hypot(A[0]+t*AB[0]-X[0],A[1]+t*AB[1]-X[1],A[2]+t*AB[2]-X[2]);if(d<10&&(!hit||d<hit[0]))hit=[d,a,b];}
      if(hit)drop.set(x,[hit[1],hit[2]]);}
    if(drop.size){for(let i=0;i<S.nFaces;i++){const p=drop.get(lab[i]);if(!p)continue;const [a,b]=p,A=lb(a),B=lb(b);
        lab[i]=Math.hypot(L[i*3]-A[0],L[i*3+1]-A[1],L[i*3+2]-A[2])<=Math.hypot(L[i*3]-B[0],L[i*3+1]-B[1],L[i*3+2]-B[2])?a:b;}
      (window._spcDbg=window._spcDbg||{}).blends=[...drop.keys()].map(x=>C.rgb2hex(regs[x].rgb));}}
  if(window._spcSnap)window._spcSnap('merged',lab,x=>regs[x].rgb,hid);
  /* specks of color under 0.1% of the model go to the nearest-colored region */
  {const tot=W.reduce((a,b)=>a+b,0),ar=new Map();for(let i=0;i<S.nFaces;i++)if(lab[i]>=0)ar.set(lab[i],(ar.get(lab[i])||0)+S.area[i]);
    const big=[...ar.keys()].filter(x=>ar.get(x)>=tot*0.001),to=new Map();
    for(const [x,a] of ar)if(a<tot*0.001&&big.length){const l=C.lab(...regs[x].rgb);let b=big[0],bd=Infinity;
      for(const y of big){const d=C.dE(l,C.lab(...regs[y].rgb));if(d<bd){bd=d;b=y;}}to.set(x,b);}
    if(to.size)for(let i=0;i<S.nFaces;i++)if(to.has(lab[i]))lab[i]=to.get(lab[i]);}
  const ids=[...new Set(lab)].filter(x=>x>=0);const remap=new Map(ids.map((x,i)=>[x,i]));remap.set(-1,-1);
  S.label=Int32Array.from(lab,x=>remap.get(x));
  S.regions=ids.map((x,i)=>({id:i,rgb:regs[x].rgb,fil:-1,area:0,dE:0,patch:false}));
  /* with photos, the paints come from the photos, not from Meshy's colors (which carry its shadows and
     guesses); each face starts on the photo paint nearest its Meshy color */
  if(S.images.length&&(window._spcPhotoPalette||photoOnly)){try{const pal=await photoPalette(S.images);
    if(pal.length>=2){S.regions=pal.map((rgb,i)=>({id:i,rgb,fil:-1,area:0,dE:0,patch:false}));const pl=pal.map(c=>C.lab(...c));
      for(let i=0;i<S.nFaces;i++){if(S.label[i]<0)continue;let b=0,bd=Infinity;for(let c=0;c<pl.length;c++){const d=(L[i*3]-pl[c][0])**2+(L[i*3+1]-pl[c][1])**2+(L[i*3+2]-pl[c][2])**2;if(d<bd){bd=d;b=c;}}S.label[i]=b;}}
    (window._spcDbg=window._spcDbg||{}).palette=pal.map(c=>C.rgb2hex(c));}catch(e){console.warn(e);window._spcDbgErr=String(e&&e.stack||e);}}
  /* where two pieces touch, nobody sees it; soles stand on the ground: both count as hidden */
  let fz0=Infinity,fz1=-Infinity;for(let i=2;i<figPts.p.length;i+=3){fz0=Math.min(fz0,figPts.p[i]);fz1=Math.max(fz1,figPts.p[i]);}
  const gnd=markContacts(active,regM,hid,fz0,fz1);
  if(!window._spcNoTuck){log("Finding spots no one will see…");await tick();try{tuckedAreas(active,regM,hid);}catch(e){console.warn(e);}}
  /* the photos say what each visible face really looks like */
  let photo=null;
  if(S.images.length&&!window._spcNoGuide){log("Reading your photos…");await tick();
    try{photo=await photoGuide(S.images,fig,active,regM,hid,L);}catch(e){console.warn(e);window._spcDbgErr=String(e&&e.stack||e);}}
  /* final colors: follow the photos (Meshy where no photo can see), with color edges on the sculpt's ridges and creases */
  log("Putting color edges on the sculpted ridges…");await tick();
  await solveLabels(active,hid,photo,L);
  if(!window._spcNoSmooth){log("Cleaning up the edges…");await tick();smoothEdges(active,hid);}
  if(!window._spcNoCrease){log("Setting edges onto the sculpt…");await tick();snapToCreases(active,hid,photo);}
  if(!window._spcNoStrips){log("Fitting paint to raised strips…");await tick();fitStrips(active,hid);}
  if(window._spcSnap)window._spcSnap('solved',S.label,x=>S.regions[x].rgb,hid);
  S.parts.forEach((p,pi)=>{if(!active.includes(pi))return;const n=p.m.f.length/3,sub=S.label.subarray(S.offs[pi],S.offs[pi]+n);
    C.cleanIslands(S.nb[pi],S.area.subarray(S.offs[pi],S.offs[pi]+n),sub,0.3);});
  window._spcHid=hid;
  fillHidden(hid);
  groundFill(active,gnd);
  if(!window._spcNoHidAreas)hiddenToAreas(active,hid);
  if(!window._spcNoHidUni)hiddenUniform(active,hid);
  {const before=S.label.slice();
  if(!window._spcNoTwin)twinCopy(active,regM,hid);
  if(!window._spcNoMirror)mirrorAreas(active,regM,hid);
   /* pieces repainted from a twin get their new edges set onto the sculpt too */
   const ch=active.filter(pi=>{const o=S.offs[pi],n=S.parts[pi].m.f.length/3;for(let t=0;t<n;t++)if(S.label[o+t]!==before[o+t])return true;return false;});
   if(ch.length&&!window._spcNoCrease)try{snapToCreases(ch,hid,photo);}catch(e){console.warn(e);}
   (window._spcDbg=window._spcDbg||{}).resnap=ch.map(pi=>S.parts[pi].name);}
  if(!window._spcNoHidUni)hiddenUniform(active,hid); /* again: a twin copy can leave a hidden patch in two paints */
  (window._spcDbg=window._spcDbg||{}).unl=fillUnlabeled(active);
  if(!window._spcNoRound)roundEdges(active,hid,+(window._spcRoundR||1.5));
  if(!window._spcNoRidge)snapMainToRidges(active,+(window._spcRidgeD||8));
  if(window._spcInner)levelInner(active,regM);
  if(!window._spcNoHipInner)hipCapInner(active,regM);
  if(!window._spcNoRigSnap){const rig=active.filter(pi=>/leg/i.test(S.parts[pi].name)&&!/(thigh|calf)/i.test(S.parts[pi].name));if(rig.length)snapMainToRidges(rig,+(window._spcRigD||3));}
  if(window._spcRidgeCap)ridgeCap(active,regM);
  if(window._spcCapThigh)capToThighs(active,regM);
  if(window._spcThighCut)thighCap(active,regM);
  if(!window._spcNoThighPlane)thighPlanes(active,regM);
  if(!window._spcNoTrim){const t0=Date.now();trimStrips(active,regM);(window._spcDbg=window._spcDbg||{}).trimMs=Date.now()-t0;}
  if(!window._spcNoMirrorTrim)mirrorTrim(active,regM);
  if(!window._spcNoBootRigid)bootFromRigid(active,regM);
  if(!window._spcNoMirrorCap)mirrorCap(active,regM);
  if(!window._spcNoTorsoEdges)torsoEdges(active,regM);
  if(!window._spcNoTorso)torsoTrim(active,regM);
  if(!window._spcNoSpecks)legSpecks(active,hid);
  if(!window._spcNoIslands)dropIslands(active,2);
  if(!window._spcNoGrayShine)grayShine(active);
  if(!window._spcNoGlove)gloveTrim(active,regM);
  if(!window._spcNoTwinMatch)twinMatch(active,regM);
  pinColors(active,hid,regM);
  if(!window._spcNoHead)try{headFix(active,regM,hid,L);}catch(e){console.warn(e);window._spcDbgErr=String(e&&e.stack||e);}
  const _tr=(tag)=>{const ti=active.find(pi=>/torso/i.test(S.parts[pi].name));if(ti==null)return;const o=S.offs[ti],n=S.parts[ti].m.f.length/3,c=new Map();for(let t=0;t<n;t++)c.set(S.label[o+t],(c.get(S.label[o+t])||0)+1);(window._spcTrace=window._spcTrace||[]).push(tag+":"+JSON.stringify([...c]));};
  _tr('pre');if(!window._spcNoShine)shineToBlack(active);
  if(!window._spcNoCords)try{cordPiping(active,regM,hid,L);}catch(e){console.warn(e);window._spcDbgErr=String(e&&e.stack||e);}
  if(!window._spcNoPiping)try{limbPiping(active,regM,hid,L);}catch(e){console.warn(e);window._spcDbgErr=String(e&&e.stack||e);}
  if(!window._spcNoCuff)try{cuffLine(active,regM,hid);}catch(e){console.warn(e);window._spcDbgErr=String(e&&e.stack||e);}
  if(!window._spcNoEdgeSnap)try{log("Setting color edges onto the sculpt…");edgeSnap(active,hid,L);}catch(e){console.warn(e);window._spcDbgErr=String(e&&e.stack||e);}
  _tr('edge');
  if(!window._spcNoBridge)try{bridgeStripes(active,hid);}catch(e){console.warn(e);window._spcDbgErr=String(e&&e.stack||e);}
  _tr('bridge');
  if(!window._spcNoRedraw)try{redrawStripes(active,hid);}catch(e){console.warn(e);window._spcDbgErr=String(e&&e.stack||e);}
  try{mirrorArms(active,hid);}catch(e){(window._spcDbg=window._spcDbg||{}).mirrorArmsErr=String(e);}try{mirrorLegs(active,hid);}catch(e){console.warn(e);window._spcDbgErr=String(e&&e.stack||e);}
  if(!window._spcNoShoulder)try{shoulderPiping(active,regM,hid);}catch(e){console.warn(e);window._spcDbgErr=String(e&&e.stack||e);}
  _tr('shoulder');
  if(!window._spcNoBlotch)try{limbBlotches(active,hid);}catch(e){console.warn(e);}
  if(window._spcOldLines)try{log("Drawing the color lines clean…");smoothLines(active,hid);}catch(e){console.warn(e);window._spcDbgErr=String(e&&e.stack||e);}
  /* and a fine pass that also evens out the edges of the piping (eyes and brows stay as drawn) */
  if(window._spcOldLines)try{smoothLines(active,hid,{band:0.3,it:25,soft:true});}catch(e){console.warn(e);}
  _tr('blotch');
  /* last sweep: lone faces of another paint (a speck the size of a triangle or two) take the paint round them */
  {let sw=0;for(let pass=0;pass<3;pass++)for(const pi of active){const o=S.offs[pi],n=S.parts[pi].m.f.length/3,nb=S.nb[pi];
     for(let t=0;t<n;t++){if(S.keepHard&&S.keepHard[o+t])continue;const L=S.label[o+t];const m=new Map();let same=0;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;const M=S.label[o+u];if(M===L)same++;else m.set(M,(m.get(M)||0)+1);}
       if(same===0){let b=-1,bv=0;for(const [k,v] of m)if(v>bv){bv=v;b=k;}if(b>=0&&bv>=2){S.label[o+t]=b;sw++;}}}}
   try{limbBlotches(active,hid);}catch(e){}(window._spcDbg=window._spcDbg||{}).specks2=sw;}
  /* legs are clothed on a figure with a painted suit: skin-tone patches on a thigh, calf or boot are smears off a
     photo (light on a red boot) and take the paint round them */
  if(S.skinReg>=0){let ns=0;for(const pi of active){if(!/(thigh|calf|shin|leg|boot)/i.test(S.parts[pi].name)||/pin|peg/i.test(S.parts[pi].name))continue;const o=S.offs[pi],n=S.parts[pi].m.f.length/3,nb=S.nb[pi];
     /* each skin patch as a whole takes the paint along most of its border */
     const seen=new Uint8Array(n);for(let s0=0;s0<n;s0++){if(seen[s0]||S.label[o+s0]!==S.skinReg)continue;const c=[s0];seen[s0]=1;const bd=new Map();
       for(let h=0;h<c.length;h++){const t=c[h];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;const l=S.label[o+u];if(l===S.skinReg){if(!seen[u]){seen[u]=1;c.push(u);}}else if(l>=0)bd.set(l,(bd.get(l)||0)+1);}}
       let b=-1,bv=0;for(const [k,v] of bd)if(v>bv){bv=v;b=k;}if(b<0)continue;for(const t of c)S.label[o+t]=b;ns+=c.length;}}
   (window._spcDbg=window._spcDbg||{}).legSkin=ns;}
  /* below a glove or boot rim it is all glove or boot, whatever later passes did */
  if(S.below)for(const pi of active){const bl=S.below[pi];if(!bl)continue;const o=S.offs[pi],P=S.belowP[pi];for(let t=0;t<bl.length;t++)if(bl[t]&&S.label[o+t]!==P&&!(S.keep&&S.keep[o+t]&&S.label[o+t]===P))S.label[o+t]=P;}
  /* and any island smaller than 0.6 mm square (a fleck), on any piece, takes the paint round it */
  {let nfk=0;for(const pi of active){const o=S.offs[pi],n=S.parts[pi].m.f.length/3,nb=S.nb[pi],A=S.area,seen=new Uint8Array(n);
     for(let s0=0;s0<n;s0++){if(seen[s0])continue;const L0=S.label[o+s0];const c=[s0];seen[s0]=1;let ar=0;const bd=new Map();
       for(let h=0;h<c.length;h++){const t=c[h];ar+=A[o+t];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;const M=S.label[o+u];if(M===L0){if(!seen[u]){seen[u]=1;c.push(u);}}else bd.set(M,(bd.get(M)||0)+1);}}
       if(ar>=1.2||!bd.size||c.some(t=>S.keepHard&&S.keepHard[o+t]))continue;let b=-1,bv=0;for(const [k,v] of bd)if(v>bv&&k>=0){bv=v;b=k;}if(b<0)continue;for(const t of c)S.label[o+t]=b;nfk+=c.length;}}
   (window._spcDbg=window._spcDbg||{}).flecks=nfk;}
  _tr('specks');(window._spcTrace=window._spcTrace||[]).push('regs:'+JSON.stringify(S.regions.map((r,i)=>[i,C.rgb2hex(r.rgb),r.fil,!!r.hair])));
  if(S.lineF){const rr=[];for(const pi in S.lineF){const F=S.lineF[pi],o=S.offs[pi],n=F.ok.length,pl0=C.lab(...S.regions[F.P].rgb);let bad=0;for(let t=0;t<n;t++){const l=S.label[o+t];if(l<0||F.ok[t]||(F.bl&&F.bl[t]))continue;if(C.dE(C.lab(...S.regions[l].rgb),pl0)<18)bad++;}rr.push(S.parts[pi].name.slice(-12)+":"+bad);}(window._spcDbg=window._spcDbg||{}).lineBad=rr;
    /* those go back to the paint round them */
    for(const pi in S.lineF){const F=S.lineF[pi],o=S.offs[pi],n=F.ok.length,nb=S.nb[pi],pl0=C.lab(...S.regions[F.P].rgb);const bad=new Uint8Array(n);for(let t=0;t<n;t++){const l=S.label[o+t];if(l<0||F.ok[t]||(F.bl&&F.bl[t]))continue;if(C.dE(C.lab(...S.regions[l].rgb),pl0)<18)bad[t]=1;}
      for(let pass=0;pass<40;pass++){let ch=0;for(let t=0;t<n;t++){if(!bad[t])continue;const m=new Map();for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||bad[u])continue;const l=S.label[o+u];if(l>=0&&C.dE(C.lab(...S.regions[l].rgb),pl0)>=18)m.set(l,(m.get(l)||0)+1);}let b=-1,bv=0;for(const [k,v] of m)if(v>bv){bv=v;b=k;}if(b>=0){S.label[o+t]=b;bad[t]=0;ch++;}}if(!ch)break;}}}
  /* straight lines in the view too: each face takes the side of the smoothed border its middle lies on (the
     saved file cuts the same borders exactly, through the triangles) */
  if(!window._spcNoStraight)try{const rep=[];for(const pi of active){const p=S.parts[pi],o=S.offs[pi],n=p.m.f.length/3,v=C.xf(p.M,p.m.v),f=p.m.f;
      const lab=Int32Array.from(S.label.subarray(o,o+n)),SL=C.straightLines(v,f,lab,{sigma:+(window._spcLineSigma||1.0),snap:/(torso|chest|body)/i.test(p.name),snapR:0.7,snapW:0.7});let ch=0;
      for(let t=0;t<n;t++){if(!SL.inBand[t])continue;const a=f[t*3]*3,b=f[t*3+1]*3,c=f[t*3+2]*3,q=[(v[a]+v[b]+v[c])/3,(v[a+1]+v[b+1]+v[c+1])/3,(v[a+2]+v[b+2]+v[c+2])/3];const L2=SL.at(q,t);if(L2!==S.label[o+t]){S.label[o+t]=L2;ch++;}}
      rep.push(p.name.replace(/^.*?_\d+_/,"")+" "+SL.chains+"/"+ch+" s"+SL.snapped);}(window._spcDbg=window._spcDbg||{}).straight=rep;}catch(e){console.warn(e);window._spcDbgErr=String(e&&e.stack||e);}
  /* the face is one piece of skin: any other bit of skin paint on the head (a fleck at the temple, in the hair)
     takes the paint round it */
  {let hk=0;for(const pi of active){if(!/head/i.test(S.parts[pi].name))continue;const o=S.offs[pi],n=S.parts[pi].m.f.length/3,nb=S.nb[pi],A=S.area;
    const skin=new Set();if(S.skinReg>=0){const sl=C.lab(...S.regions[S.skinReg].rgb);S.regions.forEach((r,i)=>{if(!r.hair&&C.dE(C.lab(...r.rgb),sl)<12)skin.add(i);});}if(!skin.size)continue;
    const cp=new Int32Array(n).fill(-1),comps=[];for(let a=0;a<n;a++){if(cp[a]>=0||!skin.has(S.label[o+a]))continue;const c=[a];cp[a]=comps.length;let ar=0;for(let h=0;h<c.length;h++){const t=c[h];ar+=A[o+t];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&cp[u]<0&&skin.has(S.label[o+u])){cp[u]=comps.length;c.push(u);}}}comps.push({c,ar});}
    let big=-1,ba=0;comps.forEach((x,i)=>{if(x.ar>ba){ba=x.ar;big=i;}});
    comps.forEach((x,i)=>{if(i===big||x.c.some(t=>S.keepHard&&S.keepHard[o+t]))return;const m=new Map();for(const t of x.c)for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;const l=S.label[o+u];if(l>=0&&!skin.has(l))m.set(l,(m.get(l)||0)+1);}let b=-1,bv=0;for(const [k,v] of m)if(v>bv){bv=v;b=k;}if(b<0)return;for(const t of x.c){S.label[o+t]=b;hk++;}});}
   /* and skin seen through gaps between locks of hair (the head's surface under the hair): a skin face with hair
      just over it, along its normal, is hair */
   for(const pi of active){if(!/head/i.test(S.parts[pi].name)||S.skinReg<0)continue;const g=pieceGeo(pi,null),o=S.offs[pi],n=g.n,hairR=S.regions.map(r=>!!r.hair);
     const G=0.4,K=(x,y,z)=>((Math.floor(x/G)+8192)*16384+(Math.floor(y/G)+8192))*16384+(Math.floor(z/G)+8192),occ=new Set();
     for(let t=0;t<n;t++){const l=S.label[o+t];if(l>=0&&hairR[l]&&!(S.keepHard&&S.keepHard[o+t]))occ.add(K(g.c[t*3],g.c[t*3+1],g.c[t*3+2]));} /* (not the brows) */
     /* how much of the 1.5 mm round a face is hair */
     const G2=1.5,K2=(x,y,z)=>((Math.floor(x/G2)+8192)*16384+(Math.floor(y/G2)+8192))*16384+(Math.floor(z/G2)+8192),gr=new Map();for(let t=0;t<n;t++){const k=K2(g.c[t*3],g.c[t*3+1],g.c[t*3+2]);let a=gr.get(k);if(!a){a=[];gr.set(k,a);}a.push(t);}
     const hf=t=>{const x=g.c[t*3],y=g.c[t*3+1],z=g.c[t*3+2],cx=Math.floor(x/G2),cy=Math.floor(y/G2),cz=Math.floor(z/G2);let all=0,h=0;for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){const a=gr.get(((cx+i+8192)*16384+(cy+j+8192))*16384+(cz+k+8192));if(!a)continue;for(const u of a){const d2=(g.c[u*3]-x)**2+(g.c[u*3+1]-y)**2+(g.c[u*3+2]-z)**2;if(d2>2.25)continue;const w=S.area[o+u];all+=w;const l=S.label[o+u];if(l>=0&&hairR[l]&&!(S.keepHard&&S.keepHard[o+u]))h+=w;}}return all?h/all:0;};
     /* the outward side: away from the head's middle */let mx=0,my=0,mz=0;for(let t=0;t<n;t++){mx+=g.c[t*3];my+=g.c[t*3+1];mz+=g.c[t*3+2];}mx/=n;my/=n;mz/=n;
     const ch=[];for(let t=0;t<n;t++){const l=S.label[o+t];if(l!==S.skinReg||(S.keepHard&&S.keepHard[o+t]))continue;let nx=g.fn[t*3],ny=g.fn[t*3+1],nz=g.fn[t*3+2];if(nx*(g.c[t*3]-mx)+ny*(g.c[t*3+1]-my)+nz*(g.c[t*3+2]-mz)<0){nx=-nx;ny=-ny;nz=-nz;}
       let hit=false;for(let d=0.6;d<=2.5&&!hit;d+=0.2){if(occ.has(K(g.c[t*3]+nx*d,g.c[t*3+1]+ny*d,g.c[t*3+2]+nz*d)))hit=true;}const f=hf(t);if((hit&&f>=0.45)||f>=0.75)ch.push(t);}
     const hairL=(()=>{const m=new Map();for(let t=0;t<n;t++){const l=S.label[o+t];if(l>=0&&hairR[l])m.set(l,(m.get(l)||0)+1);}let b=-1,bv=0;for(const [k,v] of m)if(v>bv){bv=v;b=k;}return b;})();
     if(hairL>=0)for(const t of ch){S.label[o+t]=hairL;hk++;}}
   /* white on the head is the eyes alone: white anywhere else (flecks off the photo) is skin */
   for(const pi of active){if(!/head/i.test(S.parts[pi].name)||S.skinReg<0)continue;const o=S.offs[pi],n=S.parts[pi].m.f.length/3;
     for(let t=0;t<n;t++){const l=S.label[o+t];if(l<0||l===S.skinReg||S.regions[l].hair)continue;const c=C.lab(...S.regions[l].rgb);if(c[0]>75&&Math.hypot(c[1],c[2])<12&&!(S.keepHard&&S.keepHard[o+t])){S.label[o+t]=S.skinReg;hk++;}}}
   (window._spcDbg=window._spcDbg||{}).headSkin=hk;}
  /* close up the star's outline: a gap of black narrower than 1.6 mm pinched between outline paint (inside a star
     tip) is outline paint (a closing: grow the red 0.8 mm, then shrink it back 0.8 mm) */
  if(S.shoulderF){const F=S.shoulderF,o=S.offs[F.tor],n=F.ok.length,g=pieceGeo(F.tor,null),R=0.8;
    const G=0.8,K=(x,y,z)=>((Math.floor(x/G)+8192)*16384+(Math.floor(y/G)+8192))*16384+(Math.floor(z/G)+8192),gr=new Map();for(let t=0;t<n;t++){const k=K(g.c[t*3],g.c[t*3+1],g.c[t*3+2]);let a=gr.get(k);if(!a){a=[];gr.set(k,a);}a.push(t);}
    const near=(t,pred)=>{const x=g.c[t*3],y=g.c[t*3+1],z=g.c[t*3+2],cx=Math.floor(x/G),cy=Math.floor(y/G),cz=Math.floor(z/G);for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){const a=gr.get(((cx+i+8192)*16384+(cy+j+8192))*16384+(cz+k+8192));if(!a)continue;for(const u of a){if(!pred(u))continue;if((g.c[u*3]-x)**2+(g.c[u*3+1]-y)**2+(g.c[u*3+2]-z)**2<=R*R)return true;}}return false;};
    const red=t=>S.label[o+t]===F.RED;const dil=new Uint8Array(n);for(let t=0;t<n;t++)if(F.outl[t]&&(red(t)||near(t,red)))dil[t]=1;
    let cf=0;for(let t=0;t<n;t++){if(!dil[t]||red(t)||S.label[o+t]!==F.BASE||!F.outl[t])continue;if(!near(t,u=>!dil[u])){S.label[o+t]=F.RED;cf++;}}/* the emblem is the fitted star: emblem paint outside it (out past the outline) is suit, and suit or outline paint
       well inside it is emblem (front faces near it only) */
    if(F.starFit){const V=F.starFit.VO,inP=(x,z)=>{let c=false;for(let i=0,j=V.length-1;i<V.length;j=i++){const a=V[i],b=V[j];if(((a[1]>z)!==(b[1]>z))&&(x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]))c=!c;}return c;};
      const V2=F.starFit.V,inI=(x,z)=>{let c=false;for(let i=0,j=V2.length-1;i<V2.length;j=i++){const a=V2[i],b=V2[j];if(((a[1]>z)!==(b[1]>z))&&(x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]))c=!c;}return c;};
      const gR=pieceGeo(F.tor,null);/* (the fit was made in the registered frame: test in that frame) */const gF=S.shoulderF._g||null;
      const GG=F.gReg||gR;for(let t=0;t<n;t++){const l=S.label[o+t];if(l<0)continue;const x=GG.c[t*3],z=GG.c[t*3+2];
        if(F.isEmb(l)&&(!inP(x,z)||GG.fn[t*3+1]>0.2)){S.label[o+t]=F.BASE;cf++;}else if(!F.isEmb(l)&&!(F.BO&&F.BO[t])&&GG.fn[t*3+1]<0.3&&GG.c[t*3+1]<F.yMid&&inI(x,z)){S.label[o+t]=F.EMB;cf++;}}}
    /* and no skin paint on the suit (flecks off the photo) */if(S.skinReg>=0){const sl=C.lab(...S.regions[S.skinReg].rgb);for(let t=0;t<n;t++){const l=S.label[o+t];if(l>=0&&!F.isEmb(l)&&C.dE(C.lab(...S.regions[l].rgb),sl)<12){S.label[o+t]=F.BASE;cf++;}}}
    (window._spcDbg=window._spcDbg||{}).closeStar=cf;}
  /* last word on the shoulder lines: each is its one even line, and stripe paint off it (and off the emblem's
     outline) is the suit's paint */
  if(S.shoulderF){const F=S.shoulderF,o=S.offs[F.tor],n=F.ok.length;let a1=0,a2=0;for(let t=0;t<n;t++){const l=S.label[o+t];if(l<0||F.isEmb(l))continue;const okT=F.BS?F.BS[t]:F.ok[t],ringT=F.BO?F.BO[t]:F.ring[t];if(okT||ringT&&F.BO||(F.rim[t]&&!F.starFit)){if(l!==F.RED){S.label[o+t]=F.RED;a1++;}}else if((F.starFit?!ringT:!F.outl[t])&&C.dE(C.lab(...S.regions[l].rgb),C.lab(...S.regions[F.RED].rgb))<18){S.label[o+t]=F.BASE;a2++;}}
    /* then the shoulder ridges' ragged ends: near the shoulder ridges, red that is gone after shrinking the red two faces in from its edge and does
       not grow back within three faces is a fleck or a patch on a thin neck */
    if(F.BS){const nb=S.nb[F.tor],isR=t=>S.label[o+t]===F.RED;const near=new Uint8Array(n);{let fr=[];for(let t=0;t<n;t++)if(F.BS[t]){near[t]=1;fr.push(t);}for(let r=0;r<20&&fr.length;r++){const nf=[];for(const t of fr)for(let e=0;e<3;e++){const w=nb[t*3+e];if(w>=0&&!near[w]){near[w]=1;nf.push(w);}}fr=nf;}}
     let core=new Uint8Array(n);for(let t=0;t<n;t++)core[t]=isR(t)?1:0;for(let r=0;r<2;r++){const nx=core.slice();for(let t=0;t<n;t++){if(!core[t])continue;for(let e=0;e<3;e++){const w=nb[t*3+e];if(w<0||!core[w]){nx[t]=0;break;}}}core=nx;}
     const keep=core.slice();let fr=[];for(let t=0;t<n;t++)if(keep[t])fr.push(t);for(let r=0;r<3&&fr.length;r++){const nf=[];for(const t of fr)for(let e=0;e<3;e++){const w=nb[t*3+e];if(w>=0&&!keep[w]&&isR(w)){keep[w]=1;nf.push(w);}}fr=nf;}
     let a3=0;for(let t=0;t<n;t++)if(near[t]&&isR(t)&&!keep[t]){S.label[o+t]=F.BASE;a3++;}a2+=a3;
     /* and the fringe where a ridge ends on a coarse surface: long thin triangles fanned out from the ridge's end, which can only be painted whole
        and read as red spikes. Slivers much longer than the ridge's own triangles go to the suit's paint */
     {const m=S.parts[F.tor].m,V=m.v,Fc=m.f;const geo=t=>{const a=Fc[t*3]*3,b=Fc[t*3+1]*3,c=Fc[t*3+2]*3;const e=[[V[b]-V[a],V[b+1]-V[a+1],V[b+2]-V[a+2]],[V[c]-V[b],V[c+1]-V[b+1],V[c+2]-V[b+2]],[V[a]-V[c],V[a+1]-V[c+1],V[a+2]-V[c+2]]];
        const L=Math.max(...e.map(x=>Math.hypot(...x)));const cr=[e[0][1]*e[2][2]-e[0][2]*e[2][1],e[0][2]*e[2][0]-e[0][0]*e[2][2],e[0][0]*e[2][1]-e[0][1]*e[2][0]];const A=Math.hypot(...cr)/2;return [L,A];};
      const Ls=[];for(let t=0;t<n;t++)if(F.BS[t]&&isR(t))Ls.push(geo(t)[0]);Ls.sort((x,y)=>x-y);const med=Ls.length?Ls[Ls.length>>1]:0;let a4=0;
      /* (a sliver takes the paint of most of the faces along its edges: black at a fringe, red inside the ridge) */
      if(med>0){const sl=[];for(let t=0;t<n;t++){if(!near[t])continue;const [L,A]=geo(t);if(L>2.5*med&&L*L/(2*Math.max(A,1e-9))>4)sl.push(t);}
       for(let it=0;it<3;it++)for(const t of sl){let r=0,k=0;for(let e=0;e<3;e++){const w=nb[t*3+e];if(w<0)continue;k++;if(isR(w))r++;}if(!k)continue;const want=r*2>k;if(want&&!isR(t)){S.label[o+t]=F.RED;a4++;}else if(!want&&isR(t)){S.label[o+t]=F.BASE;a4++;}}}a2+=a4;}}
    /* nothing red on the torso above the star's upper tips but the star's own outline */
    if(F.starFit&&F.starFit.tips&&F.starFit.tips.length){const gq=F.gReg||F._g||pieceGeo(F.tor,null);const tz=Math.max(...F.starFit.tips.slice().sort((a,b)=>b[2]-a[2]).slice(0,2).map(q=>q[2]));let a5=0;
     for(let t=0;t<n;t++){if(S.label[o+t]!==F.RED)continue;if(F.BO&&F.BO[t])continue;if(gq.c[t*3+2]>tz+0.2){S.label[o+t]=F.BASE;a5++;}}a2+=a5;(window._spcDbg=window._spcDbg||{}).above=tz.toFixed(2)+':'+a5;}
    (window._spcDbg=window._spcDbg||{}).shFix=a1+"/"+a2;}
  /* last word on limb piping: stripe paint off the line (and off the glove or boot) is the suit's paint */
  if(S.lineF){let nr=0;for(const pi in S.lineF){const F=S.lineF[pi],o=S.offs[pi],n=F.ok.length,pl0=C.lab(...S.regions[F.P].rgb);for(let t=0;t<n;t++){const l=S.label[o+t];if(l<0||F.ok[t]||(F.bl&&F.bl[t]))continue;if(C.dE(C.lab(...S.regions[l].rgb),pl0)<18){S.label[o+t]=F.B;nr++;}}}
    /* and bits of the stripe paint cut off from the stripe (a scrap at a knee crease) */
    for(const pi in S.lineF){const F=S.lineF[pi],o=S.offs[pi],n=F.ok.length,nb=S.nb[pi],A=S.area,pl0=C.lab(...S.regions[F.P].rgb),isR=l=>l>=0&&C.dE(C.lab(...S.regions[l].rgb),pl0)<18,seen=new Uint8Array(n);
      for(let s0=0;s0<n;s0++){if(seen[s0]||!isR(S.label[o+s0]))continue;const c=[s0];seen[s0]=1;let ar=0,glove=false;for(let h=0;h<c.length;h++){const t=c[h];ar+=A[o+t];if(F.bl&&F.bl[t])glove=true;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&!seen[u]&&isR(S.label[o+u])){seen[u]=1;c.push(u);}}}
        if(!glove&&ar<3){for(const t of c)S.label[o+t]=F.B;nr+=c.length;}}}
    /* and below the glove or boot rim it is all glove or boot (a hole of suit paint there is a blemish) */
    if(S.below)for(const pi in S.below){const bl=S.below[pi],bp=S.belowP&&S.belowP[pi],o=S.offs[pi];if(!bl||bp==null)continue;for(let t=0;t<bl.length;t++)if(bl[t]&&S.label[o+t]>=0&&S.label[o+t]!==bp&&!(S.keepHard&&S.keepHard[o+t])){S.label[o+t]=bp;nr++;}}
    (window._spcDbg=window._spcDbg||{}).lineFix=nr;}
  if(window._spcSnap)window._spcSnap('final',S.label,x=>S.regions[x].rgb,hid);
  sumAreas();
  const R0n=S.regions.length;{const keep=S.regions.map((r,i)=>r.area>0?i:-1).filter(i=>i>=0),mp=new Map(keep.map((x,i)=>[x,i]));S._mp1=mp;
    S.regions=keep.map((x,i)=>({...S.regions[x],id:i}));S.label=S.label.map(x=>x<0?-1:mp.get(x));sumAreas();}
  S.regions.sort((a,b)=>b.area-a.area);{const ord=new Map(S.regions.map((r,i)=>[r.id,i]));S._remap=Array.from({length:R0n},(_,x)=>S._mp1.has(x)?ord.get(S._mp1.get(x)):-1);S.regions.forEach((r,i)=>r.id=i);S.label=S.label.map(x=>x<0?-1:ord.get(x));}
  /* region colors: average of the faces that really are that color */
  {const acc=S.regions.map(()=>[0,0,0,0]),rl=S.regions.map(r=>C.lab(...r.rgb));
    for(let i=0;i<S.nFaces;i++){const Lb=S.label[i];if(Lb<0||hid[i])continue;
      if(Math.hypot(L[i*3]-rl[Lb][0],L[i*3+1]-rl[Lb][1],L[i*3+2]-rl[Lb][2])>20)continue;const s=acc[Lb],a=S.area[i];s[0]+=S.raw[i*3]*a;s[1]+=S.raw[i*3+1]*a;s[2]+=S.raw[i*3+2]*a;s[3]+=a;}
    S.regions.forEach((r,i)=>{if(acc[i][3])r.rgb=[acc[i][0]/acc[i][3],acc[i][1]/acc[i][3],acc[i][2]/acc[i][3]];});}
  /* leftovers go after the paint colors are measured, so the flesh tone is read from the face, not the shadowed neck */
  if(!window._spcNoStrays){dropStrays(active,hid,photo);sumAreas();}
  /* last of all: on a piped limb the stripe paint is the traced stripe and the glove or boot, nothing else */
  if(S.lineF){const rm=S._remap||null;let nz=0;for(const pi in S.lineF){const F=S.lineF[pi],o=S.offs[pi],n=F.ok.length;const P=rm?rm[F.P]:F.P,B=rm?rm[F.B]:F.B;if(P==null||P<0||B==null||B<0)continue;
    /* the glove or boot is one piece: glove paint marked away from it (a patch near the cap) is not glove */
    if(F.bl){const nb=S.nb[pi],comp=new Int32Array(n).fill(-1),ca=[];let nc=0;for(let t=0;t<n;t++){if(!F.bl[t]||comp[t]>=0)continue;let ar=0;const st=[t];comp[t]=nc;while(st.length){const u=st.pop();ar+=S.area[o+u];for(let e=0;e<3;e++){const w=nb[u*3+e];if(w>=0&&F.bl[w]&&comp[w]<0){comp[w]=nc;st.push(w);}}}ca.push(ar);nc++;}
     let bi=-1,ba=0;for(let c=0;c<nc;c++)if(ca[c]>ba){ba=ca[c];bi=c;}const bl=new Uint8Array(n);for(let t=0;t<n;t++)if(F.bl[t]&&(comp[t]===bi||ca[comp[t]]>=0.3*ba))bl[t]=1;F.bl=bl;}
    /* and it ends at its cuff: along the limb, glove paint is the glove only up to where the glove stops covering the limb all round */
    if(F.bl){const gq=pieceGeo(pi,null),c=gq.c;let m0=[0,0,0],aw=0;for(let t=0;t<n;t++){const w=S.area[o+t];aw+=w;m0[0]+=c[t*3]*w;m0[1]+=c[t*3+1]*w;m0[2]+=c[t*3+2]*w;}m0=m0.map(x=>x/aw);
     const cv=[0,0,0,0,0,0];for(let t=0;t<n;t++){const w=S.area[o+t],d=[c[t*3]-m0[0],c[t*3+1]-m0[1],c[t*3+2]-m0[2]];cv[0]+=w*d[0]*d[0];cv[1]+=w*d[0]*d[1];cv[2]+=w*d[0]*d[2];cv[3]+=w*d[1]*d[1];cv[4]+=w*d[1]*d[2];cv[5]+=w*d[2]*d[2];}
     let ax=[0.3,0.4,0.85];for(let it=0;it<50;it++){const w=[cv[0]*ax[0]+cv[1]*ax[1]+cv[2]*ax[2],cv[1]*ax[0]+cv[3]*ax[1]+cv[4]*ax[2],cv[2]*ax[0]+cv[4]*ax[1]+cv[5]*ax[2]];const l=Math.hypot(...w)||1;ax=w.map(x=>x/l);}
     const pr=new Float32Array(n);let lo=Infinity,hi=-Infinity;for(let t=0;t<n;t++){pr[t]=(c[t*3]-m0[0])*ax[0]+(c[t*3+1]-m0[1])*ax[1]+(c[t*3+2]-m0[2])*ax[2];lo=Math.min(lo,pr[t]);hi=Math.max(hi,pr[t]);}
     const BW=0.5,nbin=Math.ceil((hi-lo)/BW)+1,ta=new Float64Array(nbin),ba2=new Float64Array(nbin);for(let t=0;t<n;t++){const k=Math.floor((pr[t]-lo)/BW);ta[k]+=S.area[o+t];if(F.bl[t])ba2[k]+=S.area[o+t];}
     const fr=k=>ta[k]>0?ba2[k]/ta[k]:0;let sLo=0,sHi=0;for(let k=0;k<Math.min(10,nbin);k++){sLo+=fr(k);sHi+=fr(nbin-1-k);}const fromLo=sLo>=sHi;
     let cuff=null;for(let i=0;i<nbin-1;i++){const k=fromLo?i:nbin-1-i,k2=fromLo?i+1:nbin-2-i;if(fr(k)<0.5&&fr(k2)<0.5){cuff=fromLo?lo+i*BW:lo+(nbin-i)*BW;break;}}
     if(cuff!=null){let cut=0;for(let t=0;t<n;t++){if(!F.bl[t])continue;if(fromLo?pr[t]>cuff+0.3:pr[t]<cuff-0.3){F.bl[t]=0;cut++;}}(window._spcDbg=window._spcDbg||{}).cuffCut=((window._spcDbg||{}).cuffCut||'')+' '+S.parts[pi].name.slice(-10)+':'+cut;}}
    for(let t=0;t<n;t++){if(S.label[o+t]!==P||F.ok[t]||(F.bl&&F.bl[t]))continue;S.label[o+t]=B;nz++;}
    /* and islands: stripe paint not joined to the glove or boot and much smaller than the stripe itself is a stray patch */
    {const nb=S.nb[pi],comp=new Int32Array(n).fill(-1),ca=[],cb=[];let nc=0;for(let t=0;t<n;t++){if(S.label[o+t]!==P||comp[t]>=0)continue;let ar=0,hasB=false;const st=[t];comp[t]=nc;while(st.length){const u=st.pop();ar+=S.area[o+u];if(F.bl&&F.bl[u])hasB=true;for(let e=0;e<3;e++){const w=nb[u*3+e];if(w>=0&&comp[w]<0&&S.label[o+w]===P){comp[w]=nc;st.push(w);}}}ca.push(ar);cb.push(hasB);nc++;}
     let mx=0;for(let c=0;c<nc;c++)if(!cb[c])mx=Math.max(mx,ca[c]);for(let t=0;t<n;t++){const c=comp[t];if(c>=0&&!cb[c]&&ca[c]<0.3*mx){S.label[o+t]=B;nz++;}}}
    /* patches hung on the stripe by a thin neck: shrink the stripe paint three faces in from its edge, keep what is still big or joined to
       the glove or boot, and grow it back the same three faces inside its old outline. A patch on a thin neck is cut off and does not come back */
    {const nb=S.nb[pi],isP=t=>S.label[o+t]===P;let core=new Uint8Array(n);for(let t=0;t<n;t++)core[t]=isP(t)?1:0;
     for(let r=0;r<3;r++){const nx=core.slice();for(let t=0;t<n;t++){if(!core[t]||(F.bl&&F.bl[t]))continue;for(let e=0;e<3;e++){const w=nb[t*3+e];if(w<0||!core[w]){nx[t]=0;break;}}}core=nx;}
     const comp=new Int32Array(n).fill(-1),ca=[],cb=[];let nc=0;for(let t=0;t<n;t++){if(!core[t]||comp[t]>=0)continue;let ar=0,hasB=false;const st=[t];comp[t]=nc;while(st.length){const u=st.pop();ar+=S.area[o+u];if(F.bl&&F.bl[u])hasB=true;for(let e=0;e<3;e++){const w=nb[u*3+e];if(w>=0&&core[w]&&comp[w]<0){comp[w]=nc;st.push(w);}}}ca.push(ar);cb.push(hasB);nc++;}
     let mx=0;for(let c=0;c<nc;c++)if(!cb[c])mx=Math.max(mx,ca[c]);const keep=new Uint8Array(n);let fr=[];for(let t=0;t<n;t++){const c=comp[t];if(c>=0&&(cb[c]||ca[c]>=0.3*mx)){keep[t]=1;fr.push(t);}}
     for(let r=0;r<4&&fr.length;r++){const nf=[];for(const t of fr)for(let e=0;e<3;e++){const w=nb[t*3+e];if(w>=0&&!keep[w]&&isP(w)){keep[w]=1;nf.push(w);}}fr=nf;}
     if(mx>0)for(let t=0;t<n;t++)if(isP(t)&&!keep[t]&&!(F.bl&&F.bl[t])){S.label[o+t]=B;nz++;}}}(window._spcDbg=window._spcDbg||{}).lastStripe=nz+' '+Object.keys(S.lineF).map(pi=>{const F=S.lineF[pi],o=S.offs[pi],n=F.ok.length;const P=rm?rm[F.P]:F.P;let r=0,ok=0,bl=0;for(let t=0;t<n;t++){if(S.label[o+t]!==P)continue;r++;if(F.ok[t])ok++;else if(F.bl&&F.bl[t])bl++;}return S.parts[pi].name.slice(-12)+':P'+P+'r'+r+'ok'+ok+'bl'+bl;}).join(' ');sumAreas();}
  /* the sculpted areas, ready for clicking */
  for(const pi of active){log(`Finding the sculpted areas on ${S.parts[pi].name}…`);await tick();try{sculptAreaAt(S.offs[pi]);}catch(e){console.warn(e);}}
  matchFilaments(slots);
  S.undo=[];q("spcUndo").disabled=true;S.selected=-1;
  showViewer(true);renderRegions();q("spcSave").disabled=false;q("spcGo").disabled=false;
  const bad=S.regions.filter(r=>r.dE>10).length;
  log(`Done — ${S.regions.length} regions on ${new Set(S.regions.map(r=>r.fil)).size} filaments.`+
    (bad?` ${bad} flagged: no close match on your shelf.`:"")+(flags.length?`\nCheck these pieces, they did not fit the figure cleanly: ${flags.join(", ")}`:""));
}
/* hidden surfaces (sockets, cavities, cut faces, joints) take the color of the visible surface they
   meet: each hidden face takes the nearest bordering color across the mesh, so a wing socket goes red
   below and gold where it reaches the feathers, and a shoulder socket ringed by red is all red.
   Thin trim (a belt) is skipped when a main body color also borders the patch. */
function fillHidden(hid){
  S.parts.forEach((p,pi)=>{const o=S.offs[pi],n=p.m.f.length/3,nb=S.nb[pi];
    const share=new Map();let tot=0;
    for(let i=0;i<n;i++){const L=S.label[o+i];if(L<0||hid[o+i])continue;share.set(L,(share.get(L)||0)+S.area[o+i]);tot+=S.area[o+i];}
    if(!tot)return;
    const seen=new Uint8Array(n);
    for(let s=0;s<n;s++){if(seen[s]||!hid[o+s]||S.label[o+s]<0)continue;
      const patch=[s],border=new Map();seen[s]=1;
      for(let q2=0;q2<patch.length;q2++){const t=patch[q2];
        for(let e=0;e<3;e++){const u2=nb[t*3+e];if(u2<0)continue;
          if(hid[o+u2]){if(!seen[u2]&&S.label[o+u2]>=0){seen[u2]=1;patch.push(u2);}}
          else{const L=S.label[o+u2];if(L>=0){if(!border.has(L))border.set(L,[]);border.get(L).push(t);}}}}
      if(!border.size)continue; /* a whole piece hidden inside (knee pins): keep its nearest color */
      let labs=[...border.keys()];const main=labs.filter(L=>(share.get(L)||0)/tot>=0.08);if(main.length)labs=main;
      /* grow every allowed border color inward at once; each hidden face keeps the first to reach it */
      const inPatch=new Set(patch),got=new Map(),queue=[];
      labs.forEach(L=>border.get(L).forEach(t=>{if(!got.has(t)){got.set(t,L);queue.push(t);}}));
      for(let q2=0;q2<queue.length;q2++){const t=queue[q2],L=got.get(t);
        for(let e=0;e<3;e++){const u2=nb[t*3+e];if(u2>=0&&inPatch.has(u2)&&!got.has(u2)){got.set(u2,L);queue.push(u2);}}}
      patch.forEach(t=>{if(got.has(t))S.label[o+t]=got.get(t);});}
  });
}
/* binary min-heap on [cost, item] pairs, for the shortest-path searches */
function hpush(h,x){h.push(x);let i=h.length-1;while(i>0){const p=(i-1)>>1;if(h[p][0]<=h[i][0])break;[h[p],h[i]]=[h[i],h[p]];i=p;}}
function hpop(h){const top=h[0],last=h.pop();if(h.length){h[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<h.length&&h[l][0]<h[m][0])m=l;if(r<h.length&&h[r][0]<h[m][0])m=r;if(m===i)break;[h[m],h[i]]=[h[i],h[m]];i=m;}}return top;}
/* stripes are whole: a stripe (piping) that the photos left in pieces is joined up. On any piece, thin runs of
   a colored paint (at least 2 mm long, under 1.6 mm wide on average) whose ends point at each other across a gap
   of up to 6 mm are joined by the shortest path over the surface, painted as wide as the stripe. */
function bridgeStripes(active,hid){const rep=[];const pl=S.regions.map(r=>C.lab(...r.rgb));
  for(const pi of active){const p=S.parts[pi],o=S.offs[pi],n=p.m.f.length/3,nb=S.nb[pi],A=S.area,g=pieceGeo(pi,null);
    let tot=0;for(let t=0;t<n;t++)tot+=A[o+t];
    const seen=new Uint8Array(n),runs=[];
    for(let s0=0;s0<n;s0++){if(seen[s0]||hid[o+s0])continue;const L=S.label[o+s0];if(L<0||Math.hypot(pl[L][1],pl[L][2])<15||L===S.skinReg)continue;
      const c=[s0];seen[s0]=1;let ar=0;for(let h=0;h<c.length;h++){const t=c[h];ar+=A[o+t];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&!seen[u]&&S.label[o+u]===L&&!hid[o+u]){seen[u]=1;c.push(u);}}}
      if(ar>0.05*tot||ar<0.15)continue;
      let mx=0,my=0,mz=0;for(const t of c){mx+=g.c[t*3];my+=g.c[t*3+1];mz+=g.c[t*3+2];}mx/=c.length;my/=c.length;mz/=c.length;
      const cv=[0,0,0,0,0,0];for(const t of c){const dx=g.c[t*3]-mx,dy=g.c[t*3+1]-my,dz=g.c[t*3+2]-mz;cv[0]+=dx*dx;cv[1]+=dx*dy;cv[2]+=dx*dz;cv[3]+=dy*dy;cv[4]+=dy*dz;cv[5]+=dz*dz;}
      let d=[1,0.7,0.4];for(let it=0;it<40;it++){const e=[cv[0]*d[0]+cv[1]*d[1]+cv[2]*d[2],cv[1]*d[0]+cv[3]*d[1]+cv[4]*d[2],cv[2]*d[0]+cv[4]*d[1]+cv[5]*d[2]],m=Math.hypot(...e)||1;d=e.map(x=>x/m);}
      let lo=Infinity,hi=-Infinity,tlo=-1,thi=-1;for(const t of c){const q=(g.c[t*3]-mx)*d[0]+(g.c[t*3+1]-my)*d[1]+(g.c[t*3+2]-mz)*d[2];if(q<lo){lo=q;tlo=t;}if(q>hi){hi=q;thi=t;}}
      const len=hi-lo;if(len<2||ar/len>2.2)continue;
      runs.push({L,c,d,ends:[[tlo,-1],[thi,1]],w:Math.max(0.5,Math.min(1.4,ar/len))});}
    let joins=0;const P3=t=>[g.c[t*3],g.c[t*3+1],g.c[t*3+2]];
    for(let i=0;i<runs.length;i++)for(let j=i+1;j<runs.length;j++){const a=runs[i],b=runs[j];if(a.L!==b.L)continue;
      let best=null;for(const [ta,sa] of a.ends)for(const [tb,sb] of b.ends){const pa=P3(ta),pb=P3(tb),v=[pb[0]-pa[0],pb[1]-pa[1],pb[2]-pa[2]],dist=Math.hypot(...v);if(dist>6||dist<0.05)continue;
        const u=v.map(x=>x/dist),ca=sa*(u[0]*a.d[0]+u[1]*a.d[1]+u[2]*a.d[2]),cb=-sb*(u[0]*b.d[0]+u[1]*b.d[1]+u[2]*b.d[2]);
        if(ca<0.7||cb<0.7)continue; /* each end points at the other */
        if(!best||dist<best.dist)best={ta,tb,dist};}
      if(!best)continue;
      /* shortest path over the surface between the two ends */
      const dd=new Map([[best.ta,0]]),prev=new Map(),heap=[[0,best.ta]],done=new Set();let found=false;
      while(heap.length){const [dc,t]=hpop(heap);if(done.has(t))continue;done.add(t);if(t===best.tb){found=true;break;}if(dc>best.dist*1.8)break;
        for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||done.has(u)||hid[o+u])continue;const nd=dc+Math.hypot(g.c[t*3]-g.c[u*3],g.c[t*3+1]-g.c[u*3+1],g.c[t*3+2]-g.c[u*3+2]);if(nd<(dd.has(u)?dd.get(u):Infinity)){dd.set(u,nd);prev.set(u,t);hpush(heap,[nd,u]);}}}
      if(!found)continue;
      const path=[];for(let t=best.tb;t!==undefined;t=prev.get(t))path.push(t);
      /* paint it as wide as the stripe */
      const half=(a.w+b.w)/4,set=new Set(path);let fr=path.slice();
      for(let r=0;r<8&&fr.length;r++){const nx=[];for(const t of fr)for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||set.has(u)||hid[o+u])continue;let near=false;for(const q of path){if(Math.hypot(g.c[u*3]-g.c[q*3],g.c[u*3+1]-g.c[q*3+1],g.c[u*3+2]-g.c[q*3+2])<half){near=true;break;}}if(near){set.add(u);nx.push(u);}}fr=nx;}
      S.keep=S.keep||new Uint8Array(S.nFaces);for(const t of set){S.label[o+t]=a.L;S.keep[o+t]=1;}joins++;}
    /* and each loose end runs on to what it points at: the same paint (the star a piping comes off) within 8 mm,
       or the cut edge of the piece (where it carries on onto the arm) within 3 mm */
    let ext=0;
    for(const a of runs)for(const [te,se] of a.ends){const pe=P3(te),dirE=a.d.map(x=>x*se);const inRun=new Set(a.c);
      const dd=new Map([[te,0]]),prev=new Map(),heap=[[0,te]],done=new Set();let goal=-1;
      while(heap.length){const [dc,t]=hpop(heap);if(done.has(t))continue;done.add(t);if(dc>8)break;
        if(t!==te){const q=P3(t),v=[q[0]-pe[0],q[1]-pe[1],q[2]-pe[2]],l=Math.hypot(...v)||1,cs=(v[0]*dirE[0]+v[1]*dirE[1]+v[2]*dirE[2])/l;
          if(l>0.4&&cs>0.7){if(S.label[o+t]===a.L&&!inRun.has(t)){goal=t;break;}if(dc<=3){let edge=false;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&hid[o+u])edge=true;}if(edge){goal=t;break;}}}}
        for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||done.has(u)||hid[o+u]||inRun.has(u))continue;const nd=dc+Math.hypot(g.c[t*3]-g.c[u*3],g.c[t*3+1]-g.c[u*3+1],g.c[t*3+2]-g.c[u*3+2]);if(nd<(dd.has(u)?dd.get(u):Infinity)){dd.set(u,nd);prev.set(u,t);hpush(heap,[nd,u]);}}}
      if(goal<0)continue;const path=[];for(let t=goal;t!==undefined;t=prev.get(t))path.push(t);
      const half=a.w/2,set=new Set(path);let fr=path.slice();
      for(let r=0;r<8&&fr.length;r++){const nx=[];for(const t of fr)for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||set.has(u)||hid[o+u])continue;let near=false;for(const q of path){if(Math.hypot(g.c[u*3]-g.c[q*3],g.c[u*3+1]-g.c[q*3+1],g.c[u*3+2]-g.c[q*3+2])<half){near=true;break;}}if(near){set.add(u);nx.push(u);}}fr=nx;}
      S.keep=S.keep||new Uint8Array(S.nFaces);for(const t of set){S.label[o+t]=a.L;S.keep[o+t]=1;}ext++;}
    rep.push(p.name.replace(/^.*?_\d+_/,"")+" runs"+runs.length+" joins"+joins+" ext"+ext);}
  (window._spcDbg=window._spcDbg||{}).bridge=rep;}
/* piping over the shoulders: a straight stripe from the tip of the chest emblem's outline to where the arm's own
   piping starts, along the shortest way over the surface. On the torso the stripe paint is otherwise only allowed
   along the emblem (within 2 mm of the paint it outlines); everything else of it there (smears, broken bits) goes
   to the paint round it, then the shoulder stripes are drawn clean, 1.4 mm wide. */
/* the closest point on a triangle (Ericson) */
function closestOnTri(p,a,b,c){const sub=(u,v)=>[u[0]-v[0],u[1]-v[1],u[2]-v[2]],dot=(u,v)=>u[0]*v[0]+u[1]*v[1]+u[2]*v[2],add=(u,v,s)=>[u[0]+v[0]*s,u[1]+v[1]*s,u[2]+v[2]*s];
  const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);if(d1<=0&&d2<=0)return a;
  const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return b;const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0)return add(a,ab,d1/(d1-d3));
  const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return c;const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0)return add(a,ac,d2/(d2-d6));
  const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0)return add(b,sub(c,b),(d4-d3)/((d4-d3)+(d5-d6)));const dn=1/(va+vb+vc);return add(add(a,ab,vb*dn),ac,vc*dn);}
/* each point onto the surface itself (not a face middle), from the faces whose middles are near it */
function onSurface(g,pts,hidF){const G=1.0,K=(x,y,z)=>((Math.floor(x/G)+4096)*8192+(Math.floor(y/G)+4096))*8192+(Math.floor(z/G)+4096),grid=new Map();
  for(let t=0;t<g.n;t++){if(hidF&&hidF(t))continue;const k=K(g.c[t*3],g.c[t*3+1],g.c[t*3+2]);let a=grid.get(k);if(!a){a=[];grid.set(k,a);}a.push(t);}
  const V=i=>[g.v[i*3],g.v[i*3+1],g.v[i*3+2]];
  return pts.map(q=>{let best=q,bd=Infinity;const cx=Math.floor(q[0]/G),cy=Math.floor(q[1]/G),cz=Math.floor(q[2]/G);for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++)for(let k=-2;k<=2;k++){const a=grid.get(((cx+i+4096)*8192+(cy+j+4096))*8192+(cz+k+4096));if(!a)continue;
    for(const t of a){const c=closestOnTri(q,V(g.f[t*3]),V(g.f[t*3+1]),V(g.f[t*3+2]));const d=(c[0]-q[0])**2+(c[1]-q[1])**2+(c[2]-q[2])**2;if(d<bd){bd=d;best=c;}}}return bd<0.16?best:q;});} /* (a point more than 0.4 mm off is left as it is: it would jump to a ledge or a socket wall) */
/* the raised cord the sculptor made for piping: faces standing up off the surface (RID over 0.03 mm), widened by
   half a millimetre so a flat-topped cord (which shows as two edge lines) is one band */
function cordBand(g,RID,hidF,rad){const RR=(rad??0.5)**2;const n=g.n,band=new Uint8Array(n);if(!RID)return band;const G=1.0,K=(x,y,z)=>((Math.floor(x/G)+4096)*8192+(Math.floor(y/G)+4096))*8192+(Math.floor(z/G)+4096),gr=new Map();
  for(let t=0;t<n;t++){if(RID[t]<=0.03||(hidF&&hidF(t)))continue;const k=K(g.c[t*3],g.c[t*3+1],g.c[t*3+2]);let a=gr.get(k);if(!a){a=[];gr.set(k,a);}a.push(t);}
  for(let t=0;t<n;t++){if(hidF&&hidF(t))continue;if(RID[t]>0.03){band[t]=1;continue;}const x=g.c[t*3],y=g.c[t*3+1],z=g.c[t*3+2],cx=Math.floor(x/G),cy=Math.floor(y/G),cz=Math.floor(z/G);
    out:for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){const a=gr.get(((cx+i+4096)*8192+(cy+j+4096))*8192+(cz+k+4096));if(!a)continue;for(const u of a){if((g.c[u*3]-x)**2+(g.c[u*3+1]-y)**2+(g.c[u*3+2]-z)**2<=RR){band[t]=1;break out;}}}}
  return band;}
/* a line along a cord: each point moved (across the line only) to the middle of the raised faces within 0.9 mm,
   then smoothed a little at a time and put back on the surface, so it stays on the cord's crest the whole way */
function cordSmooth(g,X,RID,A,o,hidF,WIN=0.9){const G=1.0,gr=new Map(),K=(x,y,z)=>((Math.floor(x/G)+4096)*8192+(Math.floor(y/G)+4096))*8192+(Math.floor(z/G)+4096);
  for(let t=0;t<g.n;t++){if(RID[t]<=0.03||(hidF&&hidF(t)))continue;const k=K(g.c[t*3],g.c[t*3+1],g.c[t*3+2]);let a=gr.get(k);if(!a){a=[];gr.set(k,a);}a.push(t);}
  const centre=()=>{const Y=X.map(q=>q.slice());for(let i=0;i<X.length;i++){const q=X[i],a=X[Math.max(0,i-3)],b=X[Math.min(X.length-1,i+3)];let d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]];const l=Math.hypot(...d)||1;d=d.map(v=>v/l);
      const cx=Math.floor(q[0]/G),cy=Math.floor(q[1]/G),cz=Math.floor(q[2]/G);let sw=0,m=[0,0,0];for(let ii=-1;ii<=1;ii++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){const aa=gr.get(((cx+ii+4096)*8192+(cy+j+4096))*8192+(cz+k+4096));if(!aa)continue;
        for(const t of aa){const v=[g.c[t*3]-q[0],g.c[t*3+1]-q[1],g.c[t*3+2]-q[2]];const al=v[0]*d[0]+v[1]*d[1]+v[2]*d[2];const pr=[v[0]-al*d[0],v[1]-al*d[1],v[2]-al*d[2]];if(Math.abs(al)>0.4||Math.hypot(...pr)>WIN)continue;const w=A[o+t]; /* (the middle of the raised band: a flat cord shows as two edge lines, and the line goes between them) */sw+=w;m[0]+=pr[0]*w;m[1]+=pr[1]*w;m[2]+=pr[2]*w;}}
      if(sw)Y[i]=[q[0]+m[0]/sw,q[1]+m[1]/sw,q[2]+m[2]/sw];}X=Y;};
  const smooth=it=>{for(let r=0;r<it;r++)for(const lam of [0.5,-0.53]){const Y=X.map(x=>x.slice());for(let i=1;i<X.length-1;i++)for(let c=0;c<3;c++)Y[i][c]=X[i][c]+lam*((X[i-1][c]+X[i+1][c])/2-X[i][c]);X=Y;}};
  /* even spacing first (0.25 mm), so the smoothing acts the same all along */
  const resample=()=>{const R=[X[0]];let acc=0;for(let i=1;i<X.length;i++){let a=X[i-1];const b=X[i];let l=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);while(acc+l>=0.25){const f=(0.25-acc)/l;a=[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f];R.push(a);l=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);acc=0;}acc+=l;}R.push(X[X.length-1]);X=R;};
  resample();for(let r=0;r<4;r++){centre();smooth(6);X=onSurface(g,X,hidF);}smooth(10);X=onSurface(g,X,hidF);return X;}
/* a line laid in one plane: the plane through the points that fits them best (its normal is their direction of
   least spread), and each point taken into that plane and back onto the surface, a few times over. On the side of a
   limb this is the line a painter's straight edge makes: from the side it reads dead straight over every muscle. */
function planarLine(g,X,hidF){const n=X.length;if(n<4)return X;let m=[0,0,0];for(const q of X)for(let c=0;c<3;c++)m[c]+=q[c]/n;const cv=[0,0,0,0,0,0];for(const q of X){const x=q[0]-m[0],y=q[1]-m[1],z=q[2]-m[2];cv[0]+=x*x;cv[1]+=x*y;cv[2]+=x*z;cv[3]+=y*y;cv[4]+=y*z;cv[5]+=z*z;}
  const M=[[cv[0],cv[1],cv[2]],[cv[1],cv[3],cv[4]],[cv[2],cv[4],cv[5]]];const mul=v=>M.map(r=>r[0]*v[0]+r[1]*v[1]+r[2]*v[2]),nrm=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l);};
  let a=nrm([1,0.3,0.2]);for(let i=0;i<60;i++)a=nrm(mul(a));let b=[0.2,1,0.3];{const d=b[0]*a[0]+b[1]*a[1]+b[2]*a[2];b=nrm(b.map((x,i)=>x-d*a[i]));}for(let i=0;i<60;i++){let v=mul(b);const d=v[0]*a[0]+v[1]*a[1]+v[2]*a[2];b=nrm(v.map((x,i)=>x-d*a[i]));}
  const N=nrm([a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]);const toP=q=>{const d=(q[0]-m[0])*N[0]+(q[1]-m[1])*N[1]+(q[2]-m[2])*N[2];return [q[0]-d*N[0],q[1]-d*N[1],q[2]-d*N[2]];};
  let Y=X;for(let r=0;r<4;r++){Y=onSurface(g,Y.map(toP),hidF);}return Y;}
/* the cord faces that run along a direction: a run of cord going across it (a knee seam, a cap rim) is dropped */
function alongBand(g,BAND,dir,A,o){const n=g.n,G=1.0,gr=new Map(),K=(x,y,z)=>((Math.floor(x/G)+4096)*8192+(Math.floor(y/G)+4096))*8192+(Math.floor(z/G)+4096);
  for(let t=0;t<n;t++){if(!BAND[t])continue;const k=K(g.c[t*3],g.c[t*3+1],g.c[t*3+2]);let a=gr.get(k);if(!a){a=[];gr.set(k,a);}a.push(t);}
  const out=new Uint8Array(n);for(let t=0;t<n;t++){if(!BAND[t])continue;const x=g.c[t*3],y=g.c[t*3+1],z=g.c[t*3+2],cx=Math.floor(x/G),cy=Math.floor(y/G),cz=Math.floor(z/G);const nn=[];
    for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++)for(let k=-2;k<=2;k++){const a=gr.get(((cx+i+4096)*8192+(cy+j+4096))*8192+(cz+k+4096));if(!a)continue;for(const u of a){const dx=g.c[u*3]-x,dy=g.c[u*3+1]-y,dz=g.c[u*3+2]-z;if(dx*dx+dy*dy+dz*dz<=4)nn.push(u);}}
    if(nn.length<6){continue;}let mx=0,my=0,mz=0;for(const u of nn){mx+=g.c[u*3];my+=g.c[u*3+1];mz+=g.c[u*3+2];}mx/=nn.length;my/=nn.length;mz/=nn.length;const cv=[0,0,0,0,0,0];for(const u of nn){const a=g.c[u*3]-mx,b=g.c[u*3+1]-my,c=g.c[u*3+2]-mz;cv[0]+=a*a;cv[1]+=a*b;cv[2]+=a*c;cv[3]+=b*b;cv[4]+=b*c;cv[5]+=c*c;}
    let v=dir.slice();for(let it=0;it<25;it++){const w=[cv[0]*v[0]+cv[1]*v[1]+cv[2]*v[2],cv[1]*v[0]+cv[3]*v[1]+cv[4]*v[2],cv[2]*v[0]+cv[4]*v[1]+cv[5]*v[2]],m=Math.hypot(...w)||1;v=w.map(q=>q/m);}
    if(Math.abs(v[0]*dir[0]+v[1]*dir[1]+v[2]*dir[2])>=0.6)out[t]=1;}
  return out;}
/* the raised band a ridge line runs along: everything joined to the line, out to the grooves on either side (a groove
   is where the surface dips: RID under the groove level), and never more than maxHalf from the line. The paint
   then covers the sculpted band exactly and stops in its grooves. */
function ridgeBand(g,RID,curves,hidF,nb,maxHalf,grooveT){const n=g.n,G=1.0,gr=new Map(),SEG=[];
  for(const X of curves)for(let i=1;i<X.length;i++){const a=X[i-1],b=X[i];const id=SEG.length;SEG.push([a,b]);const R=maxHalf+0.2;
    for(let x=Math.floor((Math.min(a[0],b[0])-R)/G);x<=Math.floor((Math.max(a[0],b[0])+R)/G);x++)for(let y=Math.floor((Math.min(a[1],b[1])-R)/G);y<=Math.floor((Math.max(a[1],b[1])+R)/G);y++)for(let z=Math.floor((Math.min(a[2],b[2])-R)/G);z<=Math.floor((Math.max(a[2],b[2])+R)/G);z++){const k=((x+4096)*8192+(y+4096))*8192+(z+4096);let L=gr.get(k);if(!L){L=[];gr.set(k,L);}L.push(id);}}
  const dist=t=>{const q=[g.c[t*3],g.c[t*3+1],g.c[t*3+2]];const L=gr.get(((Math.floor(q[0])+4096)*8192+(Math.floor(q[1])+4096))*8192+(Math.floor(q[2])+4096));if(!L)return Infinity;let bd=Infinity;for(const id of L){const [a,b]=SEG[id];const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],l2=dx*dx+dy*dy+dz*dz||1e-12;let u=((q[0]-a[0])*dx+(q[1]-a[1])*dy+(q[2]-a[2])*dz)/l2;u=u<0?0:u>1?1:u;const d=Math.hypot(q[0]-a[0]-u*dx,q[1]-a[1]-u*dy,q[2]-a[2]-u*dz);if(d<bd)bd=d;}return bd;};
  const D=new Float32Array(n).fill(-1),dd=t=>D[t]>=0?D[t]:(D[t]=Math.min(dist(t),1e6));const band=new Uint8Array(n),q=[];
  for(const [k,L] of gr){}/* (seeds: faces on the line) */
  const cand=new Set();for(const L of gr.values())for(const id of L)cand.add(id);
  for(let t=0;t<n;t++){if(hidF(t))continue;const c=gr.get(((Math.floor(g.c[t*3])+4096)*8192+(Math.floor(g.c[t*3+1])+4096))*8192+(Math.floor(g.c[t*3+2])+4096));if(!c)continue;if(dd(t)<=0.3){band[t]=1;q.push(t);}}
  for(let h=0;h<q.length;h++){const t=q[h];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||band[u]||hidF(u))continue;if(RID[u]<=grooveT)continue;if(dd(u)>maxHalf)continue;band[u]=1;q.push(u);}}
  /* close pinholes: a face whose neighbours are all band is band */
  for(let t=0;t<n;t++){if(band[t]||hidF(t))continue;let k=0;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&band[u])k++;}if(k>=2&&dd(t)<=maxHalf)band[t]=2;}
  for(let t=0;t<n;t++)if(band[t]===2)band[t]=1;
  return band;}
/* piping found from the sculpt itself: a piping cord is a raised band with a fine groove cut along each side.
   The grooves are traced as long runs of hollow faces (dipping 5 microns below the surface 0.2 mm round them),
   the two long runs that lie closest to the painted stripe and 0.7 to 2 mm apart are taken, and every face lying
   between them (and on the band) is the piping. Returns the band, or null when no such pair is found. */
function grooveBand(g,o,hidF,guide,A){const n=g.n;if(guide.length<20)return null;
  const G1=1.0,K=(x,y,z)=>((Math.floor(x/G1)+4096)*8192+(Math.floor(y/G1)+4096))*8192+(Math.floor(z/G1)+4096),gr=new Map();
  for(let t=0;t<n;t++){if(hidF(t))continue;const k=K(g.c[t*3],g.c[t*3+1],g.c[t*3+2]);let a=gr.get(k);if(!a){a=[];gr.set(k,a);}a.push(t);}
  const around=(q,R,f)=>{const cx=Math.floor(q[0]/G1),cy=Math.floor(q[1]/G1),cz=Math.floor(q[2]/G1),r=Math.ceil(R/G1);for(let i=-r;i<=r;i++)for(let j=-r;j<=r;j++)for(let k=-r;k<=r;k++){const a=gr.get(((cx+i+4096)*8192+(cy+j+4096))*8192+(cz+k+4096));if(!a)continue;for(const u of a){const d2=(g.c[u*3]-q[0])**2+(g.c[u*3+1]-q[1])**2+(g.c[u*3+2]-q[2])**2;if(d2<=R*R)f(u,d2);}}};
  const C3=t=>[g.c[t*3],g.c[t*3+1],g.c[t*3+2]];
  /* the stripe's direction */
  let m=[0,0,0];for(const t of guide)for(let k=0;k<3;k++)m[k]+=g.c[t*3+k]/guide.length;const cv=[0,0,0,0,0,0];for(const t of guide){const a=g.c[t*3]-m[0],b=g.c[t*3+1]-m[1],c=g.c[t*3+2]-m[2];cv[0]+=a*a;cv[1]+=a*b;cv[2]+=a*c;cv[3]+=b*b;cv[4]+=b*c;cv[5]+=c*c;}
  let ax=[0.3,0.4,0.85];for(let it=0;it<50;it++){const w=[cv[0]*ax[0]+cv[1]*ax[1]+cv[2]*ax[2],cv[1]*ax[0]+cv[3]*ax[1]+cv[4]*ax[2],cv[2]*ax[0]+cv[4]*ax[1]+cv[5]*ax[2]],l=Math.hypot(...w)||1;ax=w.map(x=>x/l);}
  const H=t=>g.c[t*3]*ax[0]+g.c[t*3+1]*ax[1]+g.c[t*3+2]*ax[2];
  /* faces near the stripe, and how hollow each is */
  const near=new Uint8Array(n);for(let i=0;i<guide.length;i+=3)around(C3(guide[i]),3.0,u=>{near[u]=1;});
  const ras=new Float32Array(n);for(let t=0;t<n;t++){if(!near[t])continue;let sw=0,mx=0,my=0,mz=0;const nt=[g.fn[t*3],g.fn[t*3+1],g.fn[t*3+2]];around(C3(t),0.2,u=>{if(g.fn[u*3]*nt[0]+g.fn[u*3+1]*nt[1]+g.fn[u*3+2]*nt[2]<0.3)return;const w=A[o+u];sw+=w;mx+=g.c[u*3]*w;my+=g.c[u*3+1]*w;mz+=g.c[u*3+2]*w;});if(sw)ras[t]=(g.c[t*3]-mx/sw)*nt[0]+(g.c[t*3+1]-my/sw)*nt[1]+(g.c[t*3+2]-mz/sw)*nt[2];}
  /* runs of hollow faces (joined across gaps up to 0.35 mm) */
  const gro=[];for(let t=0;t<n;t++)if(near[t]&&ras[t]<-0.005)gro.push(t);if(gro.length<60)return null;
  const isG=new Int32Array(n).fill(-1);gro.forEach((t,i)=>isG[t]=i);const par=gro.map((_,i)=>i),fd=i=>{while(par[i]!==i){par[i]=par[par[i]];i=par[i];}return i;};
  for(const t of gro)around(C3(t),0.35,u=>{if(isG[u]>=0){const a=fd(isG[t]),b=fd(isG[u]);if(a!==b)par[a]=b;}});
  const comps=new Map();gro.forEach((t,i)=>{const r=fd(i);let c=comps.get(r);if(!c){c=[];comps.set(r,c);}c.push(t);});
  const poly=fs=>{let lo=Infinity,hi=-Infinity;for(const t of fs){const h=H(t);lo=Math.min(lo,h);hi=Math.max(hi,h);}const nb=Math.max(1,Math.ceil((hi-lo)/0.3)),acc=Array.from({length:nb},()=>[0,0,0,0]);
    for(const t of fs){const b=Math.min(nb-1,Math.floor((H(t)-lo)/0.3));acc[b][0]+=g.c[t*3];acc[b][1]+=g.c[t*3+1];acc[b][2]+=g.c[t*3+2];acc[b][3]++;}
    const hs=[],ps=[];acc.forEach((a,i)=>{if(a[3]){hs.push(lo+(i+0.5)*0.3);ps.push([a[0]/a[3],a[1]/a[3],a[2]/a[3]]);}});
    for(let r=0;r<2;r++){const Y=ps.map(p=>p.slice());for(let i=1;i<ps.length-1;i++)for(let k=0;k<3;k++)Y[i][k]=(ps[i-1][k]+2*ps[i][k]+ps[i+1][k])/4;ps.splice(0,ps.length,...Y);}
    return {hs,ps,lo:hs[0],hi:hs[hs.length-1]};};
  const at=(P,h)=>{const hs=P.hs;if(h<=hs[0])return P.ps[0];if(h>=hs[hs.length-1])return P.ps[hs.length-1];let i=0;while(hs[i+1]<h)i++;const f=(h-hs[i])/(hs[i+1]-hs[i]);return [0,1,2].map(k=>P.ps[i][k]+(P.ps[i+1][k]-P.ps[i][k])*f);};
  const cs=[...comps.values()].filter(c=>c.length>=30).map(c=>poly(c)).filter(P=>P.hi-P.lo>4).sort((a,b)=>(b.hi-b.lo)-(a.hi-a.lo)).slice(0,8);
  const gset=guide.map(C3),gd=q=>{let b=Infinity;for(let i=0;i<gset.length;i+=2){const p=gset[i],d=(p[0]-q[0])**2+(p[1]-q[1])**2+(p[2]-q[2])**2;if(d<b)b=d;}return Math.sqrt(b);};
  let best=null;for(let a=0;a<cs.length;a++)for(let b=a+1;b<cs.length;b++){const lo=Math.max(cs[a].lo,cs[b].lo),hi=Math.min(cs[a].hi,cs[b].hi);if(hi-lo<4)continue;
    const ws=[],ds=[];for(let h=lo;h<=hi;h+=0.6){const pa=at(cs[a],h),pb=at(cs[b],h);ws.push(Math.hypot(pa[0]-pb[0],pa[1]-pb[1],pa[2]-pb[2]));ds.push(gd([(pa[0]+pb[0])/2,(pa[1]+pb[1])/2,(pa[2]+pb[2])/2]));}
    ws.sort((x,y)=>x-y);ds.sort((x,y)=>x-y);const w=ws[ws.length>>1],d=ds[ds.length>>1];if(w<0.7||w>2.0)continue;const sc=(hi-lo)-3*d;if(!best||sc>best.sc)best={sc,a:cs[a],b:cs[b],lo,hi,w,d};}
  if(!best||best.d>1.5)return null;
  const band=new Uint8Array(n);for(let t=0;t<n;t++){if(!near[t])continue;const h=H(t);if(h<best.lo||h>best.hi)continue;const L=at(best.a,h),R=at(best.b,h),v=[R[0]-L[0],R[1]-L[1],R[2]-L[2]],l2=v[0]*v[0]+v[1]*v[1]+v[2]*v[2]||1e-9;
    const u=((g.c[t*3]-L[0])*v[0]+(g.c[t*3+1]-L[1])*v[1]+(g.c[t*3+2]-L[2])*v[2])/l2;if(u<0||u>1)continue;const f=[L[0]+v[0]*u,L[1]+v[1]*u,L[2]+v[2]*u];if(Math.hypot(g.c[t*3]-f[0],g.c[t*3+1]-f[1],g.c[t*3+2]-f[2])<0.6)band[t]=1;}
  band.info="w"+best.w.toFixed(2)+" d"+best.d.toFixed(2)+" L"+(best.hi-best.lo).toFixed(1);return band;}
/* piping traced from the sculpt (second form): the limb is cut into sections 0.3 mm apart along the stripe; in each,
   the fine grooves either side of the cord show as two peaks of hollow faces across the stripe; the pair 0.7 to 2 mm
   apart is followed from the clearest section outward, and on past the painted stripe's ends while the grooves go on,
   stopping at the glove or boot. Every face between the two grooves is the piping. */
function grooveBand2(g,o,hidF,guide,A,stopF,capFlood,stayNearGuide){const n=g.n;if(guide.length<20)return null;
  const G1=1.0,gr=new Map();for(let t=0;t<n;t++){if(hidF(t))continue;const k=((Math.floor(g.c[t*3]/G1)+4096)*8192+(Math.floor(g.c[t*3+1]/G1)+4096))*8192+(Math.floor(g.c[t*3+2]/G1)+4096);let a=gr.get(k);if(!a){a=[];gr.set(k,a);}a.push(t);}
  const around=(q,R,f)=>{const cx=Math.floor(q[0]/G1),cy=Math.floor(q[1]/G1),cz=Math.floor(q[2]/G1),r=Math.ceil(R/G1);for(let i=-r;i<=r;i++)for(let j=-r;j<=r;j++)for(let k=-r;k<=r;k++){const a=gr.get(((cx+i+4096)*8192+(cy+j+4096))*8192+(cz+k+4096));if(!a)continue;for(const u of a){const d2=(g.c[u*3]-q[0])**2+(g.c[u*3+1]-q[1])**2+(g.c[u*3+2]-q[2])**2;if(d2<=R*R)f(u,d2);}}};
  const C3=t=>[g.c[t*3],g.c[t*3+1],g.c[t*3+2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],add=(a,b,k=1)=>[a[0]+b[0]*k,a[1]+b[1]*k,a[2]+b[2]*k],nrm=a=>{const l=Math.hypot(...a)||1;return a.map(x=>x/l);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  let m=[0,0,0];for(const t of guide)for(let k=0;k<3;k++)m[k]+=g.c[t*3+k]/guide.length;const cv=[0,0,0,0,0,0];for(const t of guide){const a=g.c[t*3]-m[0],b=g.c[t*3+1]-m[1],c=g.c[t*3+2]-m[2];cv[0]+=a*a;cv[1]+=a*b;cv[2]+=a*c;cv[3]+=b*b;cv[4]+=b*c;cv[5]+=c*c;}
  let ax=[0.3,0.4,0.85];for(let it=0;it<50;it++){const w=[cv[0]*ax[0]+cv[1]*ax[1]+cv[2]*ax[2],cv[1]*ax[0]+cv[3]*ax[1]+cv[4]*ax[2],cv[2]*ax[0]+cv[4]*ax[1]+cv[5]*ax[2]];ax=nrm(w);}
  const lat=v=>add(v,ax,-dot(v,ax));
  const rasC=new Float32Array(n).fill(NaN),ras=t=>{if(!isNaN(rasC[t]))return rasC[t];let sw=0,mm=[0,0,0];const nt=[g.fn[t*3],g.fn[t*3+1],g.fn[t*3+2]];around(C3(t),0.2,u=>{if(g.fn[u*3]*nt[0]+g.fn[u*3+1]*nt[1]+g.fn[u*3+2]*nt[2]<0.3)return;const w=A[o+u];sw+=w;mm[0]+=g.c[u*3]*w;mm[1]+=g.c[u*3+1]*w;mm[2]+=g.c[u*3+2]*w;});return rasC[t]=sw?(g.c[t*3]-mm[0]/sw)*nt[0]+(g.c[t*3+1]-mm[1]/sw)*nt[1]+(g.c[t*3+2]-mm[2]/sw)*nt[2]:0;};
  /* THE RIDGE, FOUND DIRECTLY: a face is on a piped cord when a groove lies on each side of it across the surface, the two grooves
     opposite one another and together no farther apart than a cord is wide. Every such face is marked, the marked faces are gathered
     into connected runs, and the runs under the photo's stripe are the band. No tracking, no extrapolation: a gap where one groove is
     shallow only breaks the run, and the runs on either side are both kept. */
  if(false){const HW=1.3,THR=-0.005;const region=new Uint8Array(n);for(let t=0;t<n;t++)if(!hidF(t))region[t]=1; /* (the whole piece: the photo's stripe covers only patches of the cord, the cord runs end to end) */
   /* the hollow measure is speckled face by face; smoothed over 0.3 mm the grooves are clean lines and the cord top is whole */
   const rasS=new Float32Array(n).fill(NaN);const rs=t=>{if(!isNaN(rasS[t]))return rasS[t];let sw=0,sv=0;around(C3(t),0.3,u=>{const w=A[o+u];sw+=w;sv+=ras(u)*w;});return rasS[t]=sw?sv/sw:0;};
   const isG=new Int8Array(n);for(let t=0;t<n;t++)if(region[t])isG[t]=rs(t)<THR*0.8?1:0;
   const mark=new Uint8Array(n);let nm=0;
   for(let t=0;t<n;t++){if(!region[t]||isG[t]||(stopF&&stopF(t)))continue;const c0=C3(t),nt=[g.fn[t*3],g.fn[t*3+1],g.fn[t*3+2]];const us=[],ds=[];
     around(c0,HW+0.2,(u,d2)=>{if(!isG[u])return;let d=sub(C3(u),c0);d=add(d,nt,-dot(d,nt));const L=Math.hypot(...d);if(L<0.15)return;us.push(d.map(x=>x/L));ds.push(L);});
     if(us.length<2)continue;let hit=false;for(let i=0;i<us.length&&!hit;i++){let bm=Infinity;for(let j=0;j<us.length;j++){if(dot(us[i],us[j])<-0.5&&ds[j]<bm)bm=ds[j];}if(ds[i]+bm<2*HW)hit=true;}
     if(hit){mark[t]=1;nm++;}}
   /* runs */
   const comp=new Int32Array(n).fill(-1),ca=[],cg=[];let nc=0;const inGuide=new Uint8Array(n);for(const t of guide)inGuide[t]=1;
   for(let t=0;t<n;t++){if(!mark[t]||comp[t]>=0)continue;let ar=0,ag=0;const st=[t];comp[t]=nc;while(st.length){const u=st.pop();ar+=A[o+u];if(inGuide[u])ag+=A[o+u];around(C3(u),0.22,w=>{if(mark[w]&&comp[w]<0){comp[w]=nc;st.push(w);}});}ca.push(ar);cg.push(ag);nc++;}
   let gbest=0;for(let c=0;c<nc;c++)gbest=Math.max(gbest,cg[c]);const keep=new Uint8Array(nc);let kept=0,kf=0;for(let c=0;c<nc;c++)if(cg[c]>=0.5&&cg[c]>=0.3*gbest&&cg[c]>=0.05*ca[c]){keep[c]=1;kept++;} /* (the runs the photo's stripe lies on, and those alone) */
   const bw=new Uint8Array(n);for(let t=0;t<n;t++)if(mark[t]&&keep[comp[t]]){bw[t]=1;kf++;}
   /* the run's edges follow single triangles along the groove: a majority vote over 0.3 mm smooths them, never into a groove or the glove */
   for(let pass=0;pass<2;pass++){const ed=[];for(let t=0;t<n;t++){if(!region[t]||hidF(t))continue;let nB=0,nAll=0,touch=false;const was=bw[t];around(C3(t),0.3,u=>{nAll++;if(bw[u]){nB++;if(!was)touch=true;}else if(was)touch=true;});if(!touch)continue;const f=nB/Math.max(1,nAll);if(was&&f<0.4)ed.push([t,0]);else if(!was&&f>0.6&&!isG[t]&&!(stopF&&stopF(t)))ed.push([t,1]);}for(const [t,v] of ed)bw[t]=v;}
   {const dg=new Uint8Array(n);for(let t=0;t<n;t++)dg[t]=bw[t]?2:mark[t]?1:isG[t]?3:0;(window._spcStage=window._spcStage||{})[S.parts[g.pi].name]=dg;}
   if(kf>50){bw.info="BETWEEN mark"+nm+" runs"+nc+" kept"+kept+" f"+kf;bw.mids=[];bw.Ls=[];bw.Rs=[];bw.stage=null;return bw;}
   (window._spcDbg=window._spcDbg||{}).betweenMiss=((window._spcDbg||{}).betweenMiss||'')+' mark'+nm+' runs'+nc+' kept'+kept+' f'+kf;}
  /* one section: candidate groove pairs [score,L,R] */
  const NB=150,ST=0.04;const section=(c0,t)=>{let nn=[0,0,0],k0=0;around(c0,0.8,u=>{nn=add(nn,[g.fn[u*3],g.fn[u*3+1],g.fn[u*3+2]]);k0++;});if(k0<3)return null;nn=nrm(add(nn,t,-dot(nn,t)));const b=cross(nn,t);
    const hs=new Float64Array(NB);let stop=false;around(c0,3.2,(u)=>{const d=sub(C3(u),c0);if(Math.abs(dot(d,t))>0.2)return;if(stopF&&stopF(u)&&Math.hypot(...d)<1.0)stop=true;const r=ras(u);if(r>=-0.004)return;const sv=dot(d,b);const i=Math.floor((sv+3)/ST);if(i>=0&&i<NB)hs[i]+=-r*A[o+u];});
    const sm=new Float64Array(NB);for(let i=0;i<NB;i++){let a=0,w=0;for(let j=-5;j<=5;j++){const k=i+j;if(k<0||k>=NB)continue;const ww=Math.exp(-j*j/8);a+=hs[k]*ww;w+=ww;}sm[i]=a/w;}
    let mx=0;for(const v of sm)mx=Math.max(mx,v);if(mx<=0)return {cs:[],stop};const pk=[];for(let i=0;i<NB;i++){if(sm[i]<0.15*mx)continue;let ok=true;for(let j=-6;j<=6&&ok;j++){const k=i+j;if(j&&k>=0&&k<NB&&sm[k]>sm[i])ok=false;}if(ok)pk.push(i);}
    const cs=[];for(const a of pk)for(const bb of pk){const w=(bb-a)*ST;if(w>=0.7&&w<=2.0)cs.push([Math.min(sm[a],sm[bb])/mx,add(c0,b,-3+(a+0.5)*ST),add(c0,b,-3+(bb+0.5)*ST)]);}
    cs.sort((x,y)=>y[0]-x[0]);return {cs:cs.slice(0,6),stop};};
  /* sections along the painted stripe */
  const hG=guide.map(t=>dot(C3(t),ax));let h0=Infinity,h1=-Infinity;for(const h of hG){h0=Math.min(h0,h);h1=Math.max(h1,h);}
  const cen=[];for(let h=h0;h<=h1;h+=0.3){let s3=[0,0,0],k=0;guide.forEach((t,i)=>{if(Math.abs(hG[i]-h)<0.6){s3=add(s3,C3(t));k++;}});cen.push(k>2?s3.map(x=>x/k):null);}
  for(let i=0;i<cen.length;i++)if(!cen[i]){let j=i;while(j<cen.length&&!cen[j])j++;const a=cen[i-1]||cen[j],b=cen[j]||cen[i-1];for(let k=i;k<j;k++)cen[k]=a&&b?a.map((x,c)=>x+(b[c]-x)*(k-i+1)/(j-i+1)):null;i=j;}
  if(cen.some(x=>!x))return null;
  for(let r=0;r<3;r++){const Y=cen.map(x=>x.slice());for(let i=1;i<cen.length-1;i++)for(let c=0;c<3;c++)Y[i][c]=(cen[i-1][c]+2*cen[i][c]+cen[i+1][c])/4;cen.splice(0,cen.length,...Y);}
  /* sections carried on past the painted stripe's ends, straight on along the limb over the surface, up to 25 mm
     or the glove or boot (the grooves may run on where the paint gave out) */
  for(const end of [1,-1]){const L0=cen.length;const a=end>0?cen[L0-1]:cen[0],b=end>0?cen[Math.max(0,L0-11)]:cen[Math.min(L0-1,10)];let td=nrm(sub(a,b)),p=a.slice();const add2=[];
    const td0=td.slice();for(let k=0;k<85;k++){const q0=add(p,td,0.3);let q=null,bd=Infinity,stp=false;around(q0,1.5,(u,d2)=>{if(d2<bd){bd=d2;q=C3(u);stp=!!(stopF&&stopF(u));}});if(!q||stp)break;add2.push(q);td=nrm(add(td,nrm(sub(q,p)),0.3));if(dot(td,td0)<0.8)break;p=q;}
    if(end>0)cen.push(...add2);else cen.unshift(...add2.reverse());}
  const tan=i=>nrm(sub(cen[Math.min(i+2,cen.length-1)],cen[Math.max(i-2,0)]));
  const SEC=cen.map((c0,i)=>section(c0,tan(i)));
  let st=-1,bs=-1;SEC.forEach((S2,i)=>{if(S2&&S2.cs.length&&S2.cs[0][0]>bs){bs=S2.cs[0][0];st=i;}});if(st<0)return null;
  const match=(cs,last,miss)=>{let best=null;for(const x of cs){const j1=Math.hypot(...lat(sub(x[1],last[1])))+Math.hypot(...lat(sub(x[2],last[2]))),j2=Math.hypot(...lat(sub(x[1],last[2])))+Math.hypot(...lat(sub(x[2],last[1])));const jm=Math.min(j1,j2);if(jm<0.5+0.3*miss&&(!best||jm<best[0]))best=[jm,j1<=j2?x:[x[0],x[2],x[1]]];}return best&&best[1];};
  const path=new Array(cen.length).fill(null);path[st]=SEC[st].cs[0];
  const ext={a:[],b:[]};
  for(const dir of [1,-1]){let last=path[st],miss=0,i=st+dir;for(;i>=0&&i<cen.length;i+=dir){const x=SEC[i]?match(SEC[i].cs,last,miss):null;if(x){path[i]=x;last=x;miss=0;}else miss++;}
    /* and on past the stripe's end while the grooves go on */
    let lm=(last[1].map((v,c)=>(v+last[2][c])/2));let prevMid=null;{const k=path.map((p,j)=>p?j:-1).filter(j=>j>=0);const j0=dir>0?k[k.length-1]:k[0],j1=dir>0?k[Math.max(0,k.length-6)]:k[Math.min(k.length-1,5)];const p0=path[j0],p1=path[j1];prevMid=[(p1[1][0]+p1[2][0])/2,(p1[1][1]+p1[2][1])/2,(p1[1][2]+p1[2][2])/2];lm=[(p0[1][0]+p0[2][0])/2,(p0[1][1]+p0[2][1])/2,(p0[1][2]+p0[2][2])/2];last=p0;}
    let td=nrm(sub(lm,prevMid));const td0=td.slice();miss=0;for(let s2=0;s2<160&&miss<14;s2++){const c1=add(lm,td,0.3);let q=c1,bd=Infinity;around(c1,1.5,(u,d2)=>{if(d2<bd){bd=d2;q=C3(u);}});if(bd===Infinity){lm=c1;miss++;continue;}const S2=section(q,td);if(!S2||S2.stop)break;const x=match(S2.cs,last,miss);if(x){const nm=[(x[1][0]+x[2][0])/2,(x[1][1]+x[2][1])/2,(x[1][2]+x[2][2])/2];td=nrm(add(td,nrm(sub(nm,lm)),0.5));if(dot(td,td0)<0.8)break; /* (it keeps the way it was going: grooves turning off across the limb are something else) */lm=nm;last=x;miss=0;(dir>0?ext.b:ext.a).push(x);}else{lm=q;miss++;}}}
  /* stretches the tracking lost (a knee seam breaks the grooves): tracked again from their own clearest section */
  for(let pass=0;pass<4;pass++){let bi=-1,bv=-1;for(let i=0;i<cen.length;i++){if(path[i]||!SEC[i]||!SEC[i].cs.length)continue;let near2=false;for(let j=Math.max(0,i-4);j<=Math.min(cen.length-1,i+4);j++)if(path[j])near2=true;if(near2)continue;if(SEC[i].cs[0][0]>bv){bv=SEC[i].cs[0][0];bi=i;}}
    if(bi<0)break;path[bi]=SEC[bi].cs[0];for(const dir of [1,-1]){let last=path[bi],miss=0;for(let i=bi+dir;i>=0&&i<cen.length&&!path[i];i+=dir){const x=SEC[i]?match(SEC[i].cs,last,miss):null;if(x){path[i]=x;last=x;miss=0;}else miss++;}}}
  /* gaps up to 5 mm between tracked stretches are bridged straight (the cord runs on across them) */
  {let lastI=-1;for(let i=0;i<cen.length;i++){if(!path[i])continue;if(lastI>=0&&i-lastI>1&&i-lastI<=17){const a=path[lastI],b0=path[i];let b=b0;if(Math.hypot(...lat(sub(a[1],b0[1])))>Math.hypot(...lat(sub(a[1],b0[2]))))b=[b0[0],b0[2],b0[1]];
      for(let k=lastI+1;k<i;k++){const f=(k-lastI)/(i-lastI);path[k]=[0,a[1].map((v,c)=>v+(b[1][c]-v)*f),a[2].map((v,c)=>v+(b[2][c]-v)*f)];}}lastI=i;}}
  /* keep left and right consistent along the length */
  {let prev=null;for(let i=0;i<path.length;i++){if(!path[i])continue;if(prev&&Math.hypot(...lat(sub(path[i][1],prev[1])))>Math.hypot(...lat(sub(path[i][1],prev[2]))))path[i]=[path[i][0],path[i][2],path[i][1]];prev=path[i];}}
  const seq=[...ext.a.reverse(),...path.filter(Boolean),...ext.b];if(seq.length<15)return null;
  /* smoothed */
  const Ls=seq.map(x=>x[1]),Rs=seq.map(x=>x[2]);for(const Z of [Ls,Rs])for(let r=0;r<4;r++){const Y=Z.map(x=>x.slice());for(let i=1;i<Z.length-1;i++)for(let c=0;c<3;c++)Y[i][c]=(Z[i-1][c]+2*Z[i][c]+Z[i+1][c])/4;Z.splice(0,Z.length,...Y);}
  const mids=Ls.map((l,i)=>l.map((v,c)=>(v+Rs[i][c])/2));
  const band=new Uint8Array(n);const seen=new Uint8Array(n);
  for(let i=0;i<mids.length;i++)around(mids[i],1.6,u=>{if(seen[u])return;seen[u]=1;let bi=-1,bd=Infinity;for(let j=Math.max(0,i-12);j<Math.min(mids.length,i+13);j++){const d=(mids[j][0]-g.c[u*3])**2+(mids[j][1]-g.c[u*3+1])**2+(mids[j][2]-g.c[u*3+2])**2;if(d<bd){bd=d;bi=j;}}
    const L=Ls[bi],R=Rs[bi],v=sub(R,L),l2=dot(v,v)||1e-9,uu=dot(sub(C3(u),L),v)/l2;if(uu<0||uu>1)return;const f=add(L,v,uu);if(Math.hypot(...sub(C3(u),f))<0.6)band[u]=1;});
  /* then out to the grooves: grown a little at a time over the band's own surface, stopping at the hollow of a groove,
     so a band traced a little narrow still fills its cord edge to edge */
  /* how far a face stands above its surroundings, at a scale wider than the cord: the cord's top stands up, the hollow inside a curled cord end and the flat of a muscle do not */
  const hgtC=new Float32Array(n).fill(NaN),hgt=t=>{if(!isNaN(hgtC[t]))return hgtC[t];let sw=0,mm=[0,0,0];const nt=[g.fn[t*3],g.fn[t*3+1],g.fn[t*3+2]];around(C3(t),1.0,u=>{if(g.fn[u*3]*nt[0]+g.fn[u*3+1]*nt[1]+g.fn[u*3+2]*nt[2]<0.5)return;const w=A[o+u];sw+=w;mm[0]+=g.c[u*3]*w;mm[1]+=g.c[u*3+1]*w;mm[2]+=g.c[u*3+2]*w;});return hgtC[t]=sw?(g.c[t*3]-mm[0]/sw)*nt[0]+(g.c[t*3+1]-mm[1]/sw)*nt[1]+(g.c[t*3+2]-mm[2]/sw)*nt[2]:0;};
  let hCore=0;{const hs=[];let c=0;for(let t=0;t<n;t++)if(band[t]&&((c++)%7===0))hs.push(hgt(t));hs.sort((x,y)=>x-y);hCore=hs.length?hs[hs.length>>1]:0;}
  /* distance to the traced centre line, against the band's own half width there */
  const offLine=q=>{let best=Infinity,hw=1;for(let i=0;i+1<mids.length;i++){const a=mids[i],b=mids[i+1],ab=sub(b,a),L2=dot(ab,ab)||1e-9;let tt=dot(sub(q,a),ab)/L2;tt=Math.max(0,Math.min(1,tt));const d=Math.hypot(...sub(q,add(a,ab,tt)));if(d<best){best=d;hw=(Math.hypot(...sub(Ls[i],Rs[i]))+Math.hypot(...sub(Ls[i+1],Rs[i+1])))/4;}}return best-hw;};
  /* on an arm, the band's last 3 mm at each end keeps to the cord's width: no wedge where the tracking runs out at the cap */
  if(stayNearGuide){const cum=[0];for(let k=1;k<mids.length;k++)cum.push(cum[k-1]+Math.hypot(...sub(mids[k],mids[k-1])));const Lt=cum[cum.length-1];
   const nearEnd=q=>{let bi=0,bd=Infinity;for(let k=0;k<mids.length;k++){const d=Math.hypot(...sub(q,mids[k]));if(d<bd){bd=d;bi=k;}}return cum[bi]<3||Lt-cum[bi]<3;};
   for(let t=0;t<n;t++)if(band[t]){const q=C3(t);if(nearEnd(q)&&offLine(q)>0.3)band[t]=0;}}
  {const mids2=mids;let front=[];for(let t=0;t<n;t++)if(band[t])front.push(t);for(let step=0;step<5&&front.length;step++){const nf=[];for(const t of front)around(C3(t),0.16,u=>{if(band[u]||hidF(u))return;if(stopF&&stopF(u))return;if(ras(u)<-0.004)return;if(offLine(C3(u))>0.25)return; /* (never wider than the cord: no bulge onto the muscle beside it) */band[u]=2;nf.push(u);});front=nf;}
   for(let t=0;t<n;t++)if(band[t])band[t]=1;}
  /* to the very end of the cord, round its curves: from each end of the traced band the cord's inside is flooded,
     never crossing a groove and never more than the band's half width (plus a little) from the nearest groove face,
     for up to 15 mm. Off the cord the nearest groove is soon farther than that, so the flood stays on the cord. */
  if(capFlood)for(const end of [0,1]){const M=mids,k=end?M.length-1:0;const e=M[k];const hwE=Math.hypot(...sub(Ls[k],Rs[k]))/2;
    const gro=[];around(e,16,u=>{if(ras(u)<-0.004)gro.push(u);});if(gro.length<20)continue;
    const GG=0.5,gg=new Map();for(const u of gro){const kk=((Math.floor(g.c[u*3]/GG)+8192)*16384+(Math.floor(g.c[u*3+1]/GG)+8192))*16384+(Math.floor(g.c[u*3+2]/GG)+8192);let L=gg.get(kk);if(!L){L=[];gg.set(kk,L);}L.push(u);}
    const dG=q=>{const cx=Math.floor(q[0]/GG),cy=Math.floor(q[1]/GG),cz=Math.floor(q[2]/GG);let bd=Infinity;for(let i=-3;i<=3;i++)for(let j=-3;j<=3;j++)for(let kk=-3;kk<=3;kk++){const L=gg.get(((cx+i+8192)*16384+(cy+j+8192))*16384+(cz+kk+8192));if(!L)continue;for(const u of L){const d=(g.c[u*3]-q[0])**2+(g.c[u*3+1]-q[1])**2+(g.c[u*3+2]-q[2])**2;if(d<bd)bd=d;}}return Math.sqrt(bd);};
    /* the flood may only carry the cord on the way it is curving: a corridor along a quadratic fitted to the band's last 8 mm */
    const tailM=[];{let acc=0;for(let i=k;i>=0&&i<M.length;i+=end?-1:1){if(tailM.length)acc+=Math.hypot(...sub(M[i],tailM[tailM.length-1][1]));tailM.push([acc,M[i]]);if(acc>8)break;}}
    let corPts=null;if(tailM.length>=5){const fit=dim=>{let S0=0,S1=0,S2=0,S3=0,S4=0,T0=0,T1=0,T2=0;for(const [u,q] of tailM){const x=-u,y=q[dim];S0++;S1+=x;S2+=x*x;S3+=x*x*x;S4+=x*x*x*x;T0+=y;T1+=x*y;T2+=x*x*y;}
      const Mx=[[S4,S3,S2],[S3,S2,S1],[S2,S1,S0]],R=[T2,T1,T0];const det=m=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);const D=det(Mx)||1e-9;
      const col=(c)=>Mx.map((r,i)=>r.map((v,j)=>j===c?R[i]:v));return [det(col(0))/D,det(col(1))/D,det(col(2))/D];};const cf=[fit(0),fit(1),fit(2)];
      corPts=[];for(let x=-1;x<=15;x+=0.25){const xx=Math.min(x,6);corPts.push(cf.map(c=>c[0]*xx*xx+c[1]*xx+c[2]).map((v,d)=>x>6?v+(x-6)*(2*cf[d][0]*6+cf[d][1]):v));}}
    const offCor=q=>{if(!corPts)return 0;let b=Infinity;for(let i=0;i+1<corPts.length;i++){const a=corPts[i],ab=sub(corPts[i+1],a),L2=dot(ab,ab)||1e-9;let tt=Math.max(0,Math.min(1,dot(sub(q,a),ab)/L2));b=Math.min(b,Math.hypot(...sub(q,add(a,ab,tt))));}return b;};
    const dist=new Map(),hq=[];for(let t=0;t<n;t++)if(band[t]&&Math.hypot(...sub(C3(t),e))<1.2){dist.set(t,0);hq.push([0,t]);}
    let added=0;while(hq.length){hq.sort((x,y)=>y[0]-x[0]);const [dc,t]=hq.pop();if(dc>(dist.get(t)??Infinity))continue;
      around(C3(t),0.2,(u,d2)=>{if(hidF(u)||(stopF&&stopF(u)))return;const nd=dc+Math.sqrt(d2);if(nd>15||nd>=(dist.get(u)??Infinity))return;if(ras(u)<-0.004)return;if(dG(C3(u))>hwE+0.2)return;if(hCore>0.05&&hgt(u)<0.35*hCore)return;if(offCor(C3(u))>hwE+0.5)return; /* (on the cord's own course, not off into the hollow beside it) */if(offCor(C3(u))>hwE+0.5)return; /* (on the cord's own course, not off into the hollow beside it) */ /* (only the cord's raised top: not the hollow its curl encloses) */dist.set(u,nd);if(!band[u]){band[u]=1;added++;}hq.push([nd,u]);});
      if(added>3000)break;}}
  /* a clean edge: two passes of a majority vote over each edge face's 0.3 mm neighbourhood, so the band's border runs smooth along the groove
     instead of in a sawtooth of single triangles (never adding a face in the groove's hollow) */
  for(let pass=0;pass<2;pass++){const edge=[];for(let t=0;t<n;t++){if(hidF(t))continue;let nB=0,nAll=0,touch=false;const was=band[t];
      around(C3(t),0.3,u=>{nAll++;if(band[u]){nB++;if(!was)touch=true;}else if(was)touch=true;});if(!touch)continue;const f=nB/Math.max(1,nAll);
      if(was&&f<0.4)edge.push([t,0]);else if(!was&&f>0.6&&ras(t)>=-0.004&&!(stopF&&stopF(t)))edge.push([t,1]);}
    for(const [t,v] of edge)band[t]=v;}
  /* on every piped limb the stripe is one even band: the faces within the cord's median half width of the traced centre line, smoothed over 2 mm,
     carried on down to the glove. No pinch, no flare at the cap */
  if(mids.length>4){const hws=Ls.map((l,i)=>Math.hypot(...sub(l,Rs[i]))/2).sort((x,y)=>x-y);const hwM=hws[hws.length>>1];
    const cum=[0];for(let i=1;i<mids.length;i++)cum.push(cum[i-1]+Math.hypot(...sub(mids[i],mids[i-1])));
    let sm=mids.map((q,i)=>{let acc=[0,0,0],w=0;for(let j=0;j<mids.length;j++){if(Math.abs(cum[j]-cum[i])>1.0)continue;acc=add(acc,mids[j]);w++;}return acc.map(x=>x/w);});
    /* from each end the line is carried on along the top of the cord: each step moves 0.3 mm ahead and settles on the highest face
       within 0.45 mm of that point (the cord top stands above everything beside it), until it meets the glove or boot, runs into a
       hidden face (the cap), or the ridge has gone for 2 mm */
    const follow=(e,d0)=>{const out=[];let p=e,d=d0,miss=0;for(let k=0;k<200;k++){const q=add(p,d,0.3);let bu=-1,bh=-Infinity,hitStop=false;around(q,0.45,u=>{if(hidF(u))return;if(stopF&&stopF(u)){hitStop=true;return;}const h=hgt(u);if(h>bh){bh=h;bu=u;}});
        if(hitStop){out.push(q);break;}if(bu<0)break;if(bh<0.25*hCore){miss++;if(miss>6)break;}else miss=0;const np_=C3(bu);d=nrm(add(d,nrm(sub(np_,p)),0.6));p=np_;out.push(p);}
      return miss>6?out.slice(0,Math.max(0,out.length-miss)):out;};
    {const k0=Math.min(4,sm.length-1),k1=Math.max(0,sm.length-5);const extA=follow(sm[0],nrm(sub(sm[0],sm[k0]))),extB=follow(sm[sm.length-1],nrm(sub(sm[sm.length-1],sm[k1])));sm=extA.reverse().concat(sm,extB);band.ext="+"+extA.length+"/"+extB.length;}
    const off=q=>{let bd=Infinity;for(let i=0;i+1<sm.length;i++){const a=sm[i],ab=sub(sm[i+1],a),L2=dot(ab,ab)||1e-9;let tt=Math.max(0,Math.min(1,dot(sub(q,a),ab)/L2));bd=Math.min(bd,Math.hypot(...sub(q,add(a,ab,tt))));}return bd;};
    /* the line itself is projected onto the surface each time: the band is the faces near it, measured across the surface's front */
    const nb2=new Uint8Array(n);for(let t=0;t<n;t++){if(hidF(t)||(stopF&&stopF(t)))continue;const q=C3(t);if(off(q)<=hwM)nb2[t]=1;}
    let cnt=0;for(let t=0;t<n;t++){band[t]=nb2[t];cnt+=nb2[t];}band.even="hw"+hwM.toFixed(2)+" f"+cnt;}
  let ws=Ls.map((l,i)=>Math.hypot(...sub(l,Rs[i]))).sort((a,b)=>a-b);band.info=(band.even?"EVEN "+band.even+(band.ext||"")+" ":"")+"w"+ws[ws.length>>1].toFixed(2)+" secs"+seq.length+" ext"+ext.a.length+"/"+ext.b.length;
  band.mids=mids;band.Ls=Ls;band.Rs=Rs;return band;}
function shoulderPiping(active,regM,hid){const rep=[];let W_=1.4;
  const tor=active.find(pi=>/(torso|chest|body)/i.test(S.parts[pi].name));if(tor==null||!regM[tor])return;
  const arms=active.filter(pi=>/(^|[^a-z])arm([^a-z]|$)/i.test(S.parts[pi].name)&&regM[pi]);if(!arms.length)return;
  const g=pieceGeo(tor,regM),o=S.offs[tor],n=g.n,nb=S.nb[tor],A=S.area;
  /* the stripe paint: the paint of the arm cords */
  let RED=-1;{const cnt=new Map();for(const pi of arms){const oa=S.offs[pi],na=S.parts[pi].m.f.length/3;for(let t=0;t<na;t++)if(S.keep&&S.keep[oa+t]){const l=S.label[oa+t];if(l>=0&&Math.hypot(...C.lab(...S.regions[l].rgb).slice(1))>15)cnt.set(l,(cnt.get(l)||0)+1);}}let bv=0;for(const [k,v] of cnt)if(v>bv){bv=v;RED=k;}}
  if(RED<0){rep.push("no arm cord");(window._spcDbg=window._spcDbg||{}).shoulder=rep;return;}
  /* the paint it outlines on the torso: the commonest other paint touching it */
  const tm=new Map();for(let t=0;t<n;t++){if(S.label[o+t]!==RED)continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;const l=S.label[o+u];if(l!==RED)tm.set(l,(tm.get(l)||0)+1);}}
  /* black borders it too; the emblem is the lighter of the two commonest */
  const cand=[...tm].sort((a,b)=>b[1]-a[1]).slice(0,2).map(x=>x[0]);if(!cand.length)return;
  const EMB=cand.reduce((a,b)=>C.lab(...S.regions[a].rgb)[0]>C.lab(...S.regions[b].rgb)[0]?a:b);
  const BASE=cand.find(x=>x!==EMB)??-1;
  /* distance from the emblem over the surface */
  const isEmb=l=>{if(l===RED||l===BASE||l<0)return false;const c=C.lab(...S.regions[l].rgb);return c[0]>60&&Math.hypot(c[1],c[2])<12;}; /* (an emblem may be two regions of one filament) */const dE=new Float64Array(n).fill(Infinity),q=[];{/* from the emblem itself (its biggest piece), not white specks */const cp=new Int32Array(n).fill(-1),bigE=new Map();let best=-1,bs=0;for(let a=0;a<n;a++){if(cp[a]>=0||hid[o+a]||!isEmb(S.label[o+a]))continue;const c=[a];cp[a]=a;for(let h=0;h<c.length;h++){const t=c[h];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&cp[u]<0&&!hid[o+u]&&isEmb(S.label[o+u])){cp[u]=a;c.push(u);}}}let ar=0;for(const t of c)ar+=A[o+t];bigE.set(a,ar);if(c.length>bs){bs=c.length;best=a;}}
    /* (every real piece of it, not specks: a part of the star cut off by a sliver of black still counts) */for(let t=0;t<n;t++)if(cp[t]>=0&&(cp[t]===best||(bigE.get(cp[t])||0)>=2.0)){dE[t]=0;q.push([0,t]);}}
  const dist=(t,u)=>Math.hypot(g.c[t*3]-g.c[u*3],g.c[t*3+1]-g.c[u*3+1],g.c[t*3+2]-g.c[u*3+2]);
  {const h=[];for(const x of q)hpush(h,x);while(h.length){const [d,t]=hpop(h);if(d>dE[t])continue;if(d>4)break;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;const nd=d+dist(t,u);if(nd<dE[u]){dE[u]=nd;hpush(h,[nd,u]);}}}}
  /* stray bits of the stripe paint (not the emblem's outline, the largest piece of it) go to the base paint */
  let cleared=0;{const comp=new Int32Array(n).fill(-1),sizes=[];for(let s0=0;s0<n;s0++){if(comp[s0]>=0||S.label[o+s0]!==RED)continue;const id=sizes.length,c=[s0];comp[s0]=id;
      for(let h2=0;h2<c.length;h2++){const t=c[h2];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&comp[u]<0&&S.label[o+u]===RED){comp[u]=id;c.push(u);}}}sizes.push(c.length);}
    let big=-1,bs=0;sizes.forEach((z,i)=>{if(z>bs){bs=z;big=i;}});
    for(let t=0;t<n;t++)if(comp[t]>=0&&comp[t]!==big&&BASE>=0&&!(S.keep&&S.keep[o+t]&&dE[t]<=2)){S.label[o+t]=BASE;if(S.keep)S.keep[o+t]=0;cleared++;}}
  /* the outline faces (stripe paint next to the emblem) */
  const outline=[];for(let t=0;t<n;t++)if(S.label[o+t]===RED&&dE[t]<=2.0)outline.push(t);
  S.keep=S.keep||new Uint8Array(S.nFaces);const paths=[],shX=[];const RID=S.rid&&S.rid[tor];const BAND=cordBand(g,RID,t=>hid[o+t],0.3);
  const cg=new Map();for(let t=0;t<n;t++){if(hid[o+t])continue;const k=((Math.floor(g.c[t*3])+4096)*8192+(Math.floor(g.c[t*3+1])+4096))*8192+(Math.floor(g.c[t*3+2])+4096);let a=cg.get(k);if(!a){a=[];cg.set(k,a);}a.push(t);}
  for(const pi of arms){const ga=pieceGeo(pi,regM),oa=S.offs[pi];
    /* the top of the arm's piping, on the figure */
    let top=-1,tz=-Infinity;for(let t=0;t<ga.n;t++)if(S.label[oa+t]===RED&&S.keep[oa+t]&&!hid[oa+t]&&ga.c[t*3+2]>tz){tz=ga.c[t*3+2];top=t;}
    if(top<0){rep.push(S.parts[pi].name+" no top");continue;}
    const tp=[ga.c[top*3],ga.c[top*3+1],ga.c[top*3+2]];
    /* end: the nearest visible torso face to it; start: the nearest outline face to that */
    /* end on the torso's cut edge for the arm (a visible face beside a hidden one), nearest the arm's piping top */
    let tcx=0;for(let t=0;t<n;t++)tcx+=g.c[t*3];tcx/=n;const sideA=Math.sign(tp[0]-tcx);
    let hw=0;for(let t=0;t<n;t++)if(!hid[o+t])hw=Math.max(hw,Math.abs(g.c[t*3]-tcx));
    let end=-1,bd=Infinity;for(let t=0;t<n;t++){if(hid[o+t]||Math.sign(g.c[t*3]-tcx)!==sideA||Math.abs(g.c[t*3]-tcx)<0.6*hw)continue;let cut=false; /* (out at the shoulder, not the neck) */for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&hid[o+u])cut=true;}if(!cut)continue;
      const d=-g.c[t*3+2];if(d<bd){bd=d;end=t;}} /* the top of the arm opening */
    bd=(g.c[end*3]-tp[0])**2+(g.c[end*3+1]-tp[1])**2+(g.c[end*3+2]-tp[2])**2;
    if(end<0){rep.push(S.parts[pi].name+" no end");continue;}
    /* from the star's outline (wherever on this side the sculpted cord leaves it) along the cord to the top of the
       arm opening: the way costs a twelfth as much on the cord as off it, and running along the outline itself
       costs a great deal, so the line leaves the outline where the cord does */
    /* it may meet the arm opening anywhere round its upper part: the cord decides where */
    /* (the line runs out along the shoulder to its outer edge, where the arm's stripe carries on: the targets are the
       visible faces at the very side of the torso, on the top of the shoulder) */
    const tgt=new Set();{let zt=-Infinity;for(let t=0;t<n;t++)if(!hid[o+t]&&Math.sign(g.c[t*3]-tcx)===sideA&&Math.abs(g.c[t*3]-tcx)>0.85*hw)zt=Math.max(zt,g.c[t*3+2]);
      for(let t=0;t<n;t++)if(!hid[o+t]&&Math.sign(g.c[t*3]-tcx)===sideA&&Math.abs(g.c[t*3]-tcx)>0.85*hw&&g.c[t*3+2]>=zt-0.8)tgt.add(t);
      /* (better: where the shoulder's own cord reaches the outer edge, so the line stays on the cord and does not drop down the side) */
      const tc=[...tgt].filter(t=>BAND[t]&&Math.abs(g.c[t*3]-tcx)>=0.93*hw);if(tc.length>3){tgt.clear();for(const t of tc)tgt.add(t);}} /* (on top, not down the side of the socket) */
    bd=0;const dd=new Map(),prev=new Map(),h=[];for(const t of outline){if(Math.sign(g.c[t*3]-tcx)!==sideA)continue;dd.set(t,0);hpush(h,[0,t]);}
    if(!h.length)continue;let found=false;
    while(h.length){const [d,t]=hpop(h);if(d>(dd.get(t)??Infinity))continue;if(tgt.has(t)){end=t;found=true;break;}if(d>400)break;
      for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||hid[o+u])continue;const nd=d+dist(t,u)*(BAND[u]?1:20)*(dE[u]<=1.8?25:1)*(Math.abs(g.c[u*3]-tcx)<Math.abs(g.c[t*3]-tcx)-0.02?8:1); /* (the shoulder ridge runs outward from the tip; the head-cut lines run in toward the neck) */if(nd<(dd.get(u)??Infinity)){dd.set(u,nd);prev.set(u,t);hpush(h,[nd,u]);}}}
    if(!found){rep.push(S.parts[pi].name+" no path");continue;}
    const path=[];for(let t=end;t!==undefined;t=prev.get(t))path.push(t);
    /* straighten the path (it hugs triangle centres), then paint everything within 0.7 mm of it */
    /* straighten it, keeping it on the surface (each round: smooth, then back onto the nearest face) */
    /* the line runs out along the top of the shoulder; where its end turns down the side (along the edge of the
       shoulder's flat), that end is cut off */
    {let zm=-Infinity;for(const t of path)zm=Math.max(zm,g.c[t*3+2]);let k=0;while(k<path.length-8&&g.c[path[k]*3+2]<zm-0.4)k++;if(k>0)path.splice(0,k);}
    let X=path.map(t=>[g.c[t*3],g.c[t*3+1],g.c[t*3+2]]).reverse();
    X=RID?cordSmooth(g,X,RID,A,o,t=>hid[o+t]):onSurface(g,X,t=>hid[o+t]);
    /* it starts at the star's tip itself (the highest point of the outline on this side), so the tip comes to a point
       and the line runs on out of it; and it is laid in one plane, so it has no wobble or hook */
    {let ap=-1,bz=-Infinity;for(const t of outline){if(Math.sign(g.c[t*3]-tcx)!==sideA)continue;if(g.c[t*3+2]>bz){bz=g.c[t*3+2];ap=t;}}
     if(ap>=0){const P0=[g.c[ap*3],g.c[ap*3+1],g.c[ap*3+2]];let k=0,bd2=Infinity;for(let i=0;i<X.length;i++){const d=Math.hypot(X[i][0]-P0[0],X[i][1]-P0[1],X[i][2]-P0[2]);if(d<bd2){bd2=d;k=i;}}
       X=X.slice(k);const a=X[0],seg=[];const L0=Math.hypot(a[0]-P0[0],a[1]-P0[1],a[2]-P0[2]);const ns=Math.max(1,Math.ceil(L0/0.25));for(let i=0;i<ns;i++){const f=i/ns;seg.push([P0[0]+(a[0]-P0[0])*f,P0[1]+(a[1]-P0[1])*f,P0[2]+(a[2]-P0[2])*f]);}X=onSurface(g,seg.concat(X),t=>hid[o+t]);}
     X=RID?cordSmooth(g,X,RID,A,o,t=>hid[o+t],1.0):X;} /* (back onto the cord's crest after the start was moved) */
    /* (it stops 0.8 mm short of the shoulder's edge: a round end on the corner would spill over both faces) */
    {let L2=0,k=X.length-1;while(k>1&&L2<1.5){L2+=Math.hypot(X[k][0]-X[k-1][0],X[k][1]-X[k-1][1],X[k][2]-X[k-1][2]);k--;}X=X.slice(0,k+1);}
    const near=(t)=>{let b=Infinity;for(let i=1;i<X.length;i++){const a=X[i-1],c=X[i],dx=c[0]-a[0],dy=c[1]-a[1],dz=c[2]-a[2],l2=dx*dx+dy*dy+dz*dz||1e-12;let s2=((g.c[t*3]-a[0])*dx+(g.c[t*3+1]-a[1])*dy+(g.c[t*3+2]-a[2])*dz)/l2;s2=Math.max(0,Math.min(1,s2));const d=Math.hypot(g.c[t*3]-a[0]-s2*dx,g.c[t*3+1]-a[1]-s2*dy,g.c[t*3+2]-a[2]-s2*dz);if(d<b)b=d;}return b;};
    const seen=new Set(path),fr=path.slice();let painted=0;
    for(let h2=0;h2<fr.length;h2++){const t=fr[h2];if(near(t)<=W_/2&&!hid[o+t]){if(!isEmb(S.label[o+t])){S.label[o+t]=RED;S.keep[o+t]=1;painted++;}
        for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&!seen.has(u)){seen.add(u);fr.push(u);}}}}
    paths.push(near);shX.push(X);
    rep.push(S.parts[pi].name.replace(/^.*?_\d+_/,"")+" gap"+Math.sqrt(bd).toFixed(1)+" len"+(dd.get(end)).toFixed(1)+" f"+painted+" top"+tp.map(x=>x.toFixed(1)).join("/"));}
  /* then everything of the stripe paint that is neither the emblem's outline nor a shoulder stripe goes */
  let cl2=0;if(paths.length&&BASE>=0)for(let t=0;t<n;t++){if(S.label[o+t]!==RED||dE[t]<=2.0)continue;let ok=false;for(const f2 of paths)if(f2(t)<=W_/2+0.1){ok=true;break;}if(!ok){S.label[o+t]=BASE;S.keep[o+t]=0;cl2++;}}
  rep.push("cl2:"+cl2);
  /* the star's outline as one even band: the emblem's edge (the longest loop of it), smoothed, and the band laid
     along it from that edge outward. Its outer edge is a true parallel curve and its inner edge is the smoothed
     emblem edge, so both are clean. */
  let OUT=null,starFit=null;if(BASE>=0){const key=i=>Math.round(g.v[i*3]*1e4)+","+Math.round(g.v[i*3+1]*1e4)+","+Math.round(g.v[i*3+2]*1e4);const vid=new Map(),VI=i=>{const k=key(i);let x=vid.get(k);if(x===undefined){x=i;vid.set(k,i);}return x;};
    const ec=new Map();for(let t=0;t<n;t++){if(dE[t]!==0)continue;for(let e=0;e<3;e++){const a=VI(g.f[t*3+e]),b=VI(g.f[t*3+(e+1)%3]);const k=a<b?a+"_"+b:b+"_"+a;ec.set(k,(ec.get(k)||0)+1);}}
    const adj=new Map();for(const [k,c] of ec){if(c!==1)continue;const [a,b]=k.split("_").map(Number);if(!adj.has(a))adj.set(a,[]);if(!adj.has(b))adj.set(b,[]);adj.get(a).push(b);adj.get(b).push(a);}
    /* every run of the emblem's edge (walked from its ends first, so a branch point does not cut a loop short) */
    const used=new Set(),chains=[];const deg=v=>(adj.get(v)||[]).length;
    const walk=s0=>{const L=[s0];used.add(s0);let cur=s0,prev=-1;for(;;){const nx=(adj.get(cur)||[]).find(v=>v!==prev&&!used.has(v));if(nx===undefined)break;L.push(nx);used.add(nx);prev=cur;cur=nx;}return L;};
    for(const v of adj.keys())if(!used.has(v)&&deg(v)!==2)chains.push(walk(v));for(const v of adj.keys())if(!used.has(v))chains.push(walk(v));
    /* runs of the edge broken apart (a branch point, a gap of a face or two) are joined end to end when their ends
       lie within 1.5 mm */
    {const V3=i=>[g.v[i*3],g.v[i*3+1],g.v[i*3+2]],dd=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);let ch=chains.filter(c=>c.length>=5);let merged=true;
      while(merged){merged=false;ch.sort((a,b)=>b.length-a.length);outer:for(let i=0;i<ch.length;i++)for(let j=0;j<ch.length;j++){if(i===j)continue;const A=ch[i],B=ch[j];
        const opts=[[dd(V3(A[A.length-1]),V3(B[0])),()=>A.concat(B)],[dd(V3(A[A.length-1]),V3(B[B.length-1])),()=>A.concat(B.slice().reverse())],[dd(V3(A[0]),V3(B[B.length-1])),()=>B.concat(A)],[dd(V3(A[0]),V3(B[0])),()=>B.slice().reverse().concat(A)]];
        opts.sort((x,y)=>x[0]-y[0]);if(opts[0][0]<1.5){const N=opts[0][1]();ch=ch.filter((_,k)=>k!==i&&k!==j);ch.push(N);merged=true;break outer;}}}
      chains.length=0;chains.push(...ch);}
    OUT=[];let WO=1.2;{let Lt=0;for(const L of chains)Lt+=L.length;}
    for(const best of chains){if(best.length<30)continue;let P=best.map(i=>[g.v[i*3],g.v[i*3+1],g.v[i*3+2]]);const closed=Math.hypot(P[0][0]-P[P.length-1][0],P[0][1]-P[P.length-1][1],P[0][2]-P[P.length-1][2])<1.5;
      {      /* even spacing, closed */const rs=(Q,st)=>{const R=[Q[0]];let acc=0;for(let i=1;i<(closed?Q.length+1:Q.length);i++){let a=Q[i-1];const b=Q[i%Q.length];let l=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);while(acc+l>=st){const f=(st-acc)/l;a=[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f];R.push(a);l=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);acc=0;}acc+=l;}return R;};
      P=rs(P,0.2);const m=P.length;const nbI=(i,d)=>closed?(i+d+m)%m:Math.max(0,Math.min(m-1,i+d));/* the star's points stay sharp: corners (where the edge turns more than 40 degrees within a millimetre) are held,
         and each side between them is smoothed hard into a clean line */
      for(let it=0;it<10;it++)for(const lam of [0.5,-0.53]){const Y=P.map(x=>x.slice());for(let i=(closed?0:1);i<(closed?m:m-1);i++)for(let c=0;c<3;c++)Y[i][c]=P[i][c]+lam*((P[nbI(i,-1)][c]+P[nbI(i,1)][c])/2-P[i][c]);P=Y;}
      const fix=new Uint8Array(m);if(!closed){fix[0]=1;fix[m-1]=1;}{const ang=new Float64Array(m);for(let i=0;i<m;i++){const a=P[nbI(i,-8)],b=P[nbI(i,8)],q=P[i];const u=[q[0]-a[0],q[1]-a[1],q[2]-a[2]],v=[b[0]-q[0],b[1]-q[1],b[2]-q[2]];const cu=(u[0]*v[0]+u[1]*v[1]+u[2]*v[2])/((Math.hypot(...u)*Math.hypot(...v))||1);ang[i]=Math.acos(Math.max(-1,Math.min(1,cu)));}
        for(let i=0;i<m;i++){if(ang[i]<1.0)continue;let mx=true;for(let d=-10;d<=10;d++){const j=nbI(i,d);if(j!==i&&ang[j]>ang[i])mx=false;}if(mx)fix[i]=1;}}
      rep.push('corners'+fix.reduce((a,b)=>a+b,0));for(let it=0;it<150;it++)for(const lam of [0.5,-0.53]){const Y=P.map(x=>x.slice());for(let i=(closed?0:1);i<(closed?m:m-1);i++){if(fix[i])continue;for(let c=0;c<3;c++)Y[i][c]=P[i][c]+lam*((P[nbI(i,-1)][c]+P[nbI(i,1)][c])/2-P[i][c]);}P=Y;}
      P=onSurface(g,P,t=>hid[o+t]);
      /* the band's width: the outline's own typical width (its paint's area over the edge's length), 1.0 to 1.6 mm */
      let Lp=0;for(let i=0;i<m-1;i++){const a=P[i],b=P[i+1];Lp+=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);}let ar=0;for(let t=0;t<n;t++)if(S.label[o+t]===RED&&dE[t]>0&&dE[t]<=2.0)ar+=A[o+t];if(OUT.length===0){/* the outline's width in the photos: about 3.4% of the star's width */let x0=Infinity,x1=-Infinity;for(let t=0;t<n;t++)if(dE[t]===0){x0=Math.min(x0,g.c[t*3]);x1=Math.max(x1,g.c[t*3]);}WO=Math.max(0.9,Math.min(1.4,0.034*(x1-x0)));}
      /* outward: across the edge on the surface, toward the side away from the emblem */
      const cg2=new Map(),G2=1.0;for(let t=0;t<n;t++){if(hid[o+t])continue;const k=((Math.floor(g.c[t*3]/G2)+4096)*8192+(Math.floor(g.c[t*3+1]/G2)+4096))*8192+(Math.floor(g.c[t*3+2]/G2)+4096);let a=cg2.get(k);if(!a){a=[];cg2.set(k,a);}a.push(t);}
      const nearF=q=>{const cx=Math.floor(q[0]/G2),cy=Math.floor(q[1]/G2),cz=Math.floor(q[2]/G2);let b=-1,bd=Infinity;for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){const a=cg2.get(((cx+i+4096)*8192+(cy+j+4096))*8192+(cz+k+4096));if(!a)continue;for(const t of a){const d=(g.c[t*3]-q[0])**2+(g.c[t*3+1]-q[1])**2+(g.c[t*3+2]-q[2])**2;if(d<bd){bd=d;b=t;}}}return b;};
      let C2=[];for(let i=0;i<m;i++){const a=P[nbI(i,-1)],b=P[nbI(i,1)],q=P[i];const tg=[b[0]-a[0],b[1]-a[1],b[2]-a[2]];const f=nearF(q);if(f<0){C2.push(q);continue;}const N=[g.fn[f*3],g.fn[f*3+1],g.fn[f*3+2]];let d=[N[1]*tg[2]-N[2]*tg[1],N[2]*tg[0]-N[0]*tg[2],N[0]*tg[1]-N[1]*tg[0]];const l=Math.hypot(...d)||1;d=d.map(x=>x/l);
        const tp=nearF([q[0]+d[0]*0.6,q[1]+d[1]*0.6,q[2]+d[2]*0.6]);if(tp>=0&&dE[tp]===0)d=d.map(x=>-x);C2.push([q[0]+d[0]*WO/2,q[1]+d[1]*WO/2,q[2]+d[2]*WO/2]);}
      C2=onSurface(g,C2,t=>hid[o+t]);for(let it=0;it<3;it++)for(const lam of [0.5,-0.53]){const Y=C2.map(x=>x.slice());for(let i=(closed?0:1);i<(closed?m:m-1);i++)for(let c=0;c<3;c++)Y[i][c]=C2[i][c]+lam*((C2[nbI(i,-1)][c]+C2[nbI(i,1)][c])/2-C2[i][c]);C2=Y;}C2=onSurface(g,C2,t=>hid[o+t]);
      /* a star: seen from the front it is ten straight edges. Its tips and inner corners are found on the edge
         (the farthest and nearest points from its middle, five of each), a straight line is fitted to the edge
         between each pair, and the star is redrawn from those lines, with its outline as the same star grown by
         the outline's width; both are laid back onto the surface. */
      if(closed){const cx=P.reduce((a,q)=>a+q[0],0)/m,cz=P.reduce((a,q)=>a+q[2],0)/m;const th=P.map(q=>Math.atan2(q[2]-cz,q[0]-cx)),rr=P.map(q=>Math.hypot(q[0]-cx,q[2]-cz));
        const ext=(sgn)=>{const idx=[];for(let i=0;i<m;i++){let ok=true;for(let d=-25;d<=25&&ok;d++){if(d&&sgn*rr[nbI(i,d)]>sgn*rr[i])ok=false;}if(ok)idx.push(i);}return idx;};
        const tips=ext(1),inns=ext(-1);
        if(tips.length===5&&inns.length===5){const cor=[...tips.map(i=>[i,1]),...inns.map(i=>[i,0])].sort((a,b)=>a[0]-b[0]);let alt=true;for(let k=0;k<10;k++)if(cor[k][1]===cor[(k+1)%10][1])alt=false;
          if(alt){/* a line per edge, fitted to its middle 70% (x,z) */const lines=[];for(let k=0;k<10;k++){const i0=cor[k][0],i1=cor[(k+1)%10][0];const L=(i1-i0+m)%m;const pts=[];for(let j=Math.floor(L*0.15);j<=Math.ceil(L*0.85);j++){const q=P[(i0+j)%m];pts.push([q[0],q[2]]);}
              const mx=pts.reduce((a,q)=>a+q[0],0)/pts.length,mz=pts.reduce((a,q)=>a+q[1],0)/pts.length;let sxx=0,sxz=0,szz=0;for(const q of pts){const a=q[0]-mx,b=q[1]-mz;sxx+=a*a;sxz+=a*b;szz+=b*b;}const an=0.5*Math.atan2(2*sxz,sxx-szz);lines.push({p:[mx,mz],d:[Math.cos(an),Math.sin(an)]});}
            const isect=(A,B)=>{const det=A.d[0]*(-B.d[1])-A.d[1]*(-B.d[0]);if(Math.abs(det)<1e-6)return null;const rx=B.p[0]-A.p[0],rz=B.p[1]-A.p[1];const t=(rx*(-B.d[1])-rz*(-B.d[0]))/det;return [A.p[0]+A.d[0]*t,A.p[1]+A.d[1]*t];};
            const V=[];let bad=false;for(let k=0;k<10;k++){const v=isect(lines[(k+9)%10],lines[k]);if(!v){bad=true;break;}const q=P[cor[k][0]];if(Math.hypot(v[0]-q[0],v[1]-q[2])>3)bad=true;V.push(v);}
            if(!bad){/* grown by the outline's width (each edge moved out, corners re-met) */const off=(dd)=>{const Ls=lines.map(l=>{let nx=-l.d[1],nz=l.d[0];const mxp=l.p[0]+nx*0.5,mzp=l.p[1]+nz*0.5;if(Math.hypot(mxp-cx,mzp-cz)<Math.hypot(l.p[0]-cx,l.p[1]-cz)){nx=-nx;nz=-nz;}return {p:[l.p[0]+nx*dd,l.p[1]+nz*dd],d:l.d};});const W=[];for(let k=0;k<10;k++)W.push(isect(Ls[(k+9)%10],Ls[k]));return W;};
              const samp=(VV)=>{const R=[];for(let k=0;k<10;k++){const a=VV[k],b=VV[(k+1)%10];const l=Math.hypot(b[0]-a[0],b[1]-a[1]);const ns=Math.max(2,Math.ceil(l/0.2));for(let j=0;j<ns;j++){const f=j/ns;R.push([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]);}}return R;};
              /* back onto the front of the surface: the nearest point of the old edge gives the depth */const P0=P;const lift=(R2)=>{const R3=R2.map(q=>{let b=0,bd=Infinity;for(let i=0;i<m;i++){const d=(P0[i][0]-q[0])**2+(P0[i][2]-q[1])**2;if(d<bd){bd=d;b=i;}}return [q[0],P0[b][1],q[1]];});
                let Y=R3;for(let r2=0;r2<3;r2++){Y=onSurface(g,Y,t=>hid[o+t]).map((q,i)=>[R3[i][0],q[1],R3[i][2]]);}return onSurface(g,Y,t=>hid[o+t]);};
              const VO=off(WO/2);const Pn=lift(samp(V)),Cn=lift(samp(VO));P=Pn;C2=Cn;rep.push("star fitted");
              /* the star (the fitted one, grown to the outline's outer edge) for the paint itself, and its outer tips for the
                 shoulder lines to leave from */
              starFit={V,VO:off(WO),tips:lift(cor.map((c,k)=>c[1]?VO[k]:null).filter(Boolean))};}}}}
      if(!closed&&m>4){const ex=(A,i0,i1)=>{const a=A[i0],b=A[i1],d=[a[0]-b[0],a[1]-b[1],a[2]-b[2]],l=Math.hypot(...d)||1;return [a[0]+d[0]/l*0.5,a[1]+d[1]/l*0.5,a[2]+d[2]/l*0.5];};C2=[ex(C2,0,2)].concat(C2,[ex(C2,m-1,m-3)]);P=[ex(P,0,2)].concat(P,[ex(P,m-1,m-3)]);}
      (window._spcDbg=window._spcDbg||{}).shX=[{X:C2,P,fix:[...fix.keys()].filter(i=>fix[i])}];
      OUT.push({X:closed?C2.concat([C2[0]]):C2,inner:closed?P.concat([P[0]]):P,r:WO/2});rep.push("outline W"+WO.toFixed(2)+" n"+m+(closed?" closed":" open"));}}
    if(!OUT.length)OUT=null;}
  if(paths.length&&BASE>=0){/* the strokes for the saved file, in the piece's own frame */const Mi=C.inv4(regM[tor]);const own=new Uint8Array(n),oS=new Int16Array(n).fill(-1),oB=new Int16Array(n).fill(-1);
    /* each shoulder line leaves from the star's outer tip on its side: the line runs from the tip to the first point of
       its own course more than 2 mm off it */
    if(starFit&&starFit.tips.length)for(let k=0;k<shX.length;k++){const X=shX[k];let tp=null,bd=Infinity;for(const q of starFit.tips){const d=Math.hypot(q[0]-X[0][0],q[1]-X[0][1],q[2]-X[0][2]);if(d<bd){bd=d;tp=q;}}
      if(tp&&bd<4){let j=0;while(j<X.length-2&&Math.hypot(X[j][0]-tp[0],X[j][1]-tp[1],X[j][2]-tp[2])<2)j++;const a=tp,b=X[j],seg=[];const l=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]),ns=Math.max(2,Math.ceil(l/0.25));for(let i=0;i<ns;i++){const f=i/ns;seg.push([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f]);}
        let Y=onSurface(g,seg.concat(X.slice(j)),t=>hid[o+t]);
        /* (it starts 1 mm out from the tip: the outline's own pointed tip covers the join, and a round end on the tip
           would spill over the step there) */
        {let i=0;while(i<Y.length-3&&Math.hypot(Y[i][0]-tp[0],Y[i][1]-tp[1],Y[i][2]-tp[2])<1.0)i++;Y=Y.slice(i);}shX[k]=Y;}}
    if(!starFit){    /* each shoulder line starts 1 mm back inside the outline band, so the two meet with no gap */
    for(let k=0;k<shX.length;k++){const X=shX[k];if(X.length<3)continue;let j=1;while(j<X.length-1&&Math.hypot(X[j][0]-X[0][0],X[j][1]-X[0][1],X[j][2]-X[0][2])<1)j++;const a=X[0],b=X[j],d=[a[0]-b[0],a[1]-b[1],a[2]-b[2]],l=Math.hypot(...d)||1;shX[k]=[[a[0]+d[0]/l,a[1]+d[1]/l,a[2]+d[2]/l]].concat(X);}}
    /* the lines' paint follows the lines as finally drawn */
    {const mk=X=>t=>{let b=Infinity;for(let i=1;i<X.length;i++){const a=X[i-1],c=X[i],dx=c[0]-a[0],dy=c[1]-a[1],dz=c[2]-a[2],l2=dx*dx+dy*dy+dz*dz||1e-12;let s2=((g.c[t*3]-a[0])*dx+(g.c[t*3+1]-a[1])*dy+(g.c[t*3+2]-a[2])*dz)/l2;s2=Math.max(0,Math.min(1,s2));const d=Math.hypot(g.c[t*3]-a[0]-s2*dx,g.c[t*3+1]-a[1]-s2*dy,g.c[t*3+2]-a[2]-s2*dz);if(d<b)b=d;}return b;};
     paths.length=0;for(const X of shX)paths.push(mk(X));if(OUT)W_=2*OUT[0].r;}
    for(let t=0;t<n;t++){if(hid[o+t]||dE[t]<=2.0||isEmb(S.label[o+t]))continue;for(const f2 of paths)if(f2(t)<=W_/2+1.8){own[t]=1;oS[t]=RED;oB[t]=BASE;break;}}
    const toL=X=>{const fl=C.xf(Mi,X.flat());const R=[];for(let i=0;i<fl.length;i+=3)R.push([fl[i],fl[i+1],fl[i+2]]);return R;};const list=shX.map(X=>({X:toL(X),r:OUT?OUT[0].r:W_/2,s:RED,base:BASE})); /* (the shoulder lines are as wide as the star's outline, as on the figure) */
    if(OUT)for(const OU of OUT){list.push({X:toL(OU.X),r:OU.r,s:RED,base:BASE,ax:(()=>{const a=C.xf(Mi,[0,0,0,0,-1,0]);const v=[a[3]-a[0],a[4]-a[1],a[5]-a[2]],l=Math.hypot(...v);return v.map(x=>x/l);})(),inner:toL(OU.inner),innerFace:(()=>{for(let t=0;t<n;t++)if(dE[t]===0&&!hid[o+t])return t;return -1;})()});
      /* the band owns the faces within 1.6 mm of it on either side */
      const segD=(X,t)=>{let b=Infinity;for(let i=1;i<X.length;i++){const a=X[i-1],c=X[i],dx=c[0]-a[0],dy=c[1]-a[1],dz=c[2]-a[2],l2=dx*dx+dy*dy+dz*dz||1e-12;let u=((g.c[t*3]-a[0])*dx+(g.c[t*3+1]-a[1])*dy+(g.c[t*3+2]-a[2])*dz)/l2;u=u<0?0:u>1?1:u;const d=Math.hypot(g.c[t*3]-a[0]-u*dx,g.c[t*3+1]-a[1]-u*dy,g.c[t*3+2]-a[2]-u*dz);if(d<b)b=d;}return b;};
      for(let t=0;t<n;t++){if(hid[o+t]||dE[t]>4.5)continue;if(own[t])continue;if(segD(OU.X,t)<=OU.r+3.0){own[t]=1;oS[t]=RED;oB[t]=BASE;}}}
    (S.strokes=S.strokes||{})[tor]={list,own,oS,oB};}
  /* the paint is the sculpted ridges: the star's raised outline and the shoulder ridges, groove to groove */
  let BO=null,BS=null;if(RID&&BASE>=0){if(OUT){BO=ridgeBand(g,RID,OUT.map(x=>x.X),t=>!!hid[o+t],nb,1.3,-0.02);}if(shX.length)BS=ridgeBand(g,RID,shX,t=>!!hid[o+t],nb,1.0,-0.02);
    /* the shoulder ridges traced between their grooves: from each upper star tip straight out across the top of the
       shoulder to its edge */
    if(starFit&&starFit.tips.length){let tcx2=0;for(let t=0;t<n;t++)tcx2+=g.c[t*3];tcx2/=n;let hw2=0;for(let t=0;t<n;t++)if(!hid[o+t])hw2=Math.max(hw2,Math.abs(g.c[t*3]-tcx2));
      const tips=starFit.tips.slice().sort((a,b)=>b[2]-a[2]).slice(0,2);const SB=new Uint8Array(n);let any=false;
      for(const tp of tips){const sd=Math.sign(tp[0]-tcx2);const guide=[];for(let t=0;t<n;t++){if(hid[o+t]||g.fn[t*3+2]<0.3)continue;const dx=(g.c[t*3]-tp[0])*sd;if(dx<2.5||dx>14)continue;if(Math.hypot(g.c[t*3+1]-tp[1],(g.c[t*3+2]-tp[2])*0.3)<4.0&&g.c[t*3+2]>tp[2]-1.0)guide.push(t);}
        const GB=grooveBand2(g,o,t=>!!hid[o+t],guide,A,null);rep.push("shoulderGB "+(GB?GB.info:"none")+" g"+guide.length+" tip"+tp.map(v=>v.toFixed(1)).join("/")+" c"+tcx2.toFixed(1)+" hw"+hw2.toFixed(1));if(GB&&GB.mids&&GB.mids.length){for(let t=0;t<n;t++)if(GB[t]&&(g.c[t*3]-tp[0])*sd>0.3)SB[t]=1;any=true;
          /* and the short ridge joining it to the star tip */
          let im=GB.mids[0],bd=Infinity;for(const q of GB.mids){const d=Math.hypot(q[0]-tp[0],q[1]-tp[1],q[2]-tp[2]);if(d<bd){bd=d;im=q;}}
          /* (the sculpt between them is broken by the head cut: the join is a straight strip of the band's width) */
          {const hwB=Math.hypot(GB.Ls[0][0]-GB.Rs[0][0],GB.Ls[0][1]-GB.Rs[0][1],GB.Ls[0][2]-GB.Rs[0][2])/2;const v=[im[0]-tp[0],im[1]-tp[1],im[2]-tp[2]],l2=v[0]**2+v[1]**2+v[2]**2||1e-9;let k3=0;
           for(let t=0;t<n;t++){if(hid[o+t])continue;const u=((g.c[t*3]-tp[0])*v[0]+(g.c[t*3+1]-tp[1])*v[1]+(g.c[t*3+2]-tp[2])*v[2])/l2;if(u<0||u>1)continue;const f=[tp[0]+v[0]*u,tp[1]+v[1]*u,tp[2]+v[2]*u];if(Math.hypot(g.c[t*3]-f[0],g.c[t*3+1]-f[1],g.c[t*3+2]-f[2])<Math.min(hwB,0.8)){SB[t]=1;k3++;}}rep.push("join d"+bd.toFixed(1)+" f"+k3);}}}
      if(any)BS=null; /* (no paint above the upper star tips: the lines up from them are the head cut, not ridges) */}
    if(S.strokes)delete S.strokes[tor];rep.push("bands "+(BO?BO.reduce((a,b)=>a+b,0):0)+"/"+(BS?BS.reduce((a,b)=>a+b,0):0));}
  if(paths.length&&BASE>=0)S.shoulderF={tor,RED,BASE,EMB,starFit,gReg:g,BO,BS,yMid:(()=>{let a=0;for(let t=0;t<n;t++)a+=g.c[t*3+1];return a/n;})(),ring:(()=>{const a=new Uint8Array(n);if(!starFit)return a;const pin=(V,x,z)=>{let c=false;for(let i=0,j=V.length-1;i<V.length;j=i++){const p=V[i],q=V[j];if(((p[1]>z)!==(q[1]>z))&&(x<(q[0]-p[0])*(z-p[1])/(q[1]-p[1])+p[0]))c=!c;}return c;};const VO=starFit.VO2||starFit.VO;for(let t=0;t<n;t++){if(g.fn[t*3+1]>-0.05)continue;if(pin(VO,g.c[t*3],g.c[t*3+2])&&!pin(starFit.V,g.c[t*3],g.c[t*3+2]))a[t]=1;}return a;})(),W:W_,ok:(()=>{const a=new Uint8Array(n);for(let t=0;t<n;t++){for(const f2 of paths)if(f2(t)<=W_/2){a[t]=1;break;}}return a;})(),outl:(()=>{const a=new Uint8Array(n);for(let t=0;t<n;t++)if(dE[t]<=3.0)a[t]=1;return a;})(),rim:(()=>{/* the outline's own ring: everything within 0.9 mm of the emblem (that isn't the emblem) is outline paint, so no black gets in between */const a=new Uint8Array(n);for(let t=0;t<n;t++)if(dE[t]>0&&dE[t]<=0.9&&!hid[o+t])a[t]=1;return a;})(),isEmb};
  rep.push("cleared"+cleared+" outline"+outline.length+" RED"+RED+" EMB"+EMB+" BASE"+BASE+" cand"+JSON.stringify([...tm]));(window._spcDbg=window._spcDbg||{}).shoulder=rep;}
/* piping drawn as one even stripe: each limb stripe found on the sculpt is replaced by a stripe of one width
   along its own centre line. The centre line runs end to end over the stripe (by distance over the surface from
   its far end, each half millimetre averaged, then smoothed), so prongs, notches and blobs along it go. Its
   width is the stripe's typical width, 1.1 to 1.6 mm. Only the plain paint round the stripe is painted over. */
/* the legs are mirror twins: where one leg's piping was traced and its twin's was not (a stretch the grooves could not
   be followed on), the twin takes the mirror of it. Only when the two pieces match as mirror images to 0.1 mm. */
function mirrorLegs(active,hid){const rep=[];if(!S.lineF)return;
  for(const a of active){const na=S.parts[a].name;if(!/left/i.test(na)||!/(leg|thigh|calf)/i.test(na))continue;const key=x=>x.toLowerCase().replace(/\.stl$/,'').replace(/_\d+_/,'_');const want=key(na).replace('left','right');const b=active.find(x=>key(S.parts[x].name)===want);
    if(b==null||!S.lineF[a]||!S.lineF[b])continue;const gA=pieceGeo(a,null),gB=pieceGeo(b,null),oA=S.offs[a],oB=S.offs[b];
    const cen=g=>{let m=[0,0,0];for(let t=0;t<g.n;t++)for(let k=0;k<3;k++)m[k]+=g.c[t*3+k]/g.n;return m;};const cA=cen(gA),cB=cen(gB);
    const G=0.5,gr=new Map();for(let t=0;t<gA.n;t++){const k=((Math.floor(gA.c[t*3]/G)+8192)*16384+(Math.floor(gA.c[t*3+1]/G)+8192))*16384+(Math.floor(gA.c[t*3+2]/G)+8192);let L=gr.get(k);if(!L){L=[];gr.set(k,L);}L.push(t);}
    const nearA=q=>{const cx=Math.floor(q[0]/G),cy=Math.floor(q[1]/G),cz=Math.floor(q[2]/G);let b0=-1,bd=Infinity;for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){const L=gr.get(((cx+i+8192)*16384+(cy+j+8192))*16384+(cz+k+8192));if(!L)continue;for(const u of L){const d=(gA.c[u*3]-q[0])**2+(gA.c[u*3+1]-q[1])**2+(gA.c[u*3+2]-q[2])**2;if(d<bd){bd=d;b0=u;}}}return [b0,Math.sqrt(bd)];};
    const Ms=[[-1,1,1],[1,-1,1]];let best=null;for(const M of Ms){const ds=[];for(let t=0;t<gB.n;t+=97){const q=[0,1,2].map(k=>M[k]*(gB.c[t*3+k]-cB[k])+cA[k]);ds.push(nearA(q)[1]);}ds.sort((x,y)=>x-y);const md=ds[ds.length>>1];if(!best||md<best.md)best={M,md};}
    rep.push(na.slice(-14)+" md"+best.md.toFixed(3));if(best.md>0.1)continue;
    const fA=S.lineF[a],fB=S.lineF[b];let addB=0,addA=0;
    const pass=(gX,oX,fX,gY,oY,fY,M,cX,cY,near)=>{let k2=0;for(let t=0;t<gY.n;t++){if(fY.ok[t]||hid[oY+t]||(fY.bl&&fY.bl[t]))continue;const q=[0,1,2].map(k=>M[k]*(gY.c[t*3+k]-cY[k])+cX[k]);const [u,d]=near(q);if(u<0||d>0.2||!fX.ok[u])continue;if(S.label[oY+t]===fY.B){S.label[oY+t]=fY.P;S.keep[oY+t]=1;fY.ok[t]=1;k2++;}}return k2;};
    addB=pass(gA,oA,fA,gB,oB,fB,best.M,cA,cB,nearA);
    rep.push("addB"+addB);}
  (window._spcDbg=window._spcDbg||{}).mirror=rep;}
/* the two arms of a figure are mirror twins: the cleaner traced stripe (the thinner one, with no patches) is copied onto the other, which
   is redrawn to match it exactly */
function mirrorArms(active,hid){const rep=[];if(!S.lineF)return;
  const key=x=>x.toLowerCase().replace(/\.stl$/,'').replace(/_\d+_/,'_');
  for(const a0 of active){const na=S.parts[a0].name;if(!/left/i.test(na)||!/(^|[^a-z])arm/i.test(na))continue;const want=key(na).replace('left','right');const b0=active.find(x=>key(S.parts[x].name)===want);
    if(b0==null||!S.lineF[a0]||!S.lineF[b0])continue;
    const okArea=pi=>{const F=S.lineF[pi],o=S.offs[pi];let s=0;for(let t=0;t<F.ok.length;t++)if(F.ok[t])s+=S.area[o+t];return s;};
    const [a,b]=okArea(a0)<=okArea(b0)?[a0,b0]:[b0,a0];
    const gA=pieceGeo(a,null),gB=pieceGeo(b,null),oA=S.offs[a],oB=S.offs[b];
    const cen=g=>{let m=[0,0,0];for(let t=0;t<g.n;t++)for(let k=0;k<3;k++)m[k]+=g.c[t*3+k]/g.n;return m;};const cA=cen(gA),cB=cen(gB);
    const G=0.5,gr=new Map();for(let t=0;t<gA.n;t++){const k=((Math.floor(gA.c[t*3]/G)+8192)*16384+(Math.floor(gA.c[t*3+1]/G)+8192))*16384+(Math.floor(gA.c[t*3+2]/G)+8192);let L=gr.get(k);if(!L){L=[];gr.set(k,L);}L.push(t);}
    const nearA=q=>{const cx=Math.floor(q[0]/G),cy=Math.floor(q[1]/G),cz=Math.floor(q[2]/G);let b1=-1,bd=Infinity;for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++)for(let k=-2;k<=2;k++){const L=gr.get(((cx+i+8192)*16384+(cy+j+8192))*16384+(cz+k+8192));if(!L)continue;for(const u of L){const d=(gA.c[u*3]-q[0])**2+(gA.c[u*3+1]-q[1])**2+(gA.c[u*3+2]-q[2])**2;if(d<bd){bd=d;b1=u;}}}return [b1,Math.sqrt(bd)];};
    let best=null;for(const M of [[-1,1,1],[1,-1,1]]){let sh=[0,0,0];for(let it=0;it<8;it++){const off=[0,0,0];let k2=0;const ds=[];for(let t=0;t<gB.n;t+=53){const q=[0,1,2].map(k=>M[k]*(gB.c[t*3+k]-cB[k])+cA[k]+sh[k]);const [u,d]=nearA(q);if(u<0)continue;ds.push(d);if(d<1.0){for(let k=0;k<3;k++)off[k]+=gA.c[u*3+k]-q[k];k2++;}}
        if(k2)for(let k=0;k<3;k++)sh[k]+=off[k]/k2;ds.sort((x,y)=>x-y);const md=ds[ds.length>>1];if(it===7&&(!best||md<best.md))best={M,sh,md};}}
    rep.push(S.parts[a].name.slice(-10)+"->"+S.parts[b].name.slice(-10)+" md"+best.md.toFixed(3));if(best.md>0.2)continue;
    /* each arm keeps only stripe that the other arm also has at the mirrored spot, unless the other arm has no stripe near there at all:
       a patch on one arm next to the stripe is cut, a stretch where the other arm's tracing gave out is kept */
    const fA=S.lineF[a],fB=S.lineF[b];
    const mapAB=t=>[0,1,2].map(k=>best.M[k]*(gB.c[t*3+k]-cB[k])+cA[k]+best.sh[k]);
    const okGrid=(g,F)=>{const m=new Map();for(let t=0;t<g.n;t++){if(!F.ok[t])continue;const k=((Math.floor(g.c[t*3]/G)+8192)*16384+(Math.floor(g.c[t*3+1]/G)+8192))*16384+(Math.floor(g.c[t*3+2]/G)+8192);let L=m.get(k);if(!L){L=[];m.set(k,L);}L.push(t);}return m;};
    const near=(g,m,q,R)=>{const cx=Math.floor(q[0]/G),cy=Math.floor(q[1]/G),cz=Math.floor(q[2]/G),r=Math.ceil(R/G);let bd=Infinity;for(let i=-r;i<=r;i++)for(let j=-r;j<=r;j++)for(let k=-r;k<=r;k++){const L=m.get(((cx+i+8192)*16384+(cy+j+8192))*16384+(cz+k+8192));if(!L)continue;for(const u of L){const d=(g.c[u*3]-q[0])**2+(g.c[u*3+1]-q[1])**2+(g.c[u*3+2]-q[2])**2;if(d<bd)bd=d;}}return Math.sqrt(bd);};
    const okGA=okGrid(gA,fA),okGB=okGrid(gB,fB);
    /* B's faces mapped into A's frame; for A's faces, map back by the inverse (B = M*(A - cA - sh) + cB) */
    const mapBA=t=>[0,1,2].map(k=>best.M[k]*(gA.c[t*3+k]-cA[k]-best.sh[k])+cB[k]);
    const cutA=[],cutB=[];
    for(let t=0;t<gB.n;t++){if(!fB.ok[t])continue;const q=mapAB(t);const dOk=near(gA,okGA,q,1.6);if(dOk>0.45&&dOk<=1.5)cutB.push(t);}
    for(let t=0;t<gA.n;t++){if(!fA.ok[t])continue;const q=mapBA(t);const dOk=near(gB,okGB,q,1.6);if(dOk>0.45&&dOk<=1.5)cutA.push(t);}
    for(const t of cutB){fB.ok[t]=0;if(S.label[oB+t]===fB.P&&!(fB.bl&&fB.bl[t])){S.label[oB+t]=fB.B;S.keep[oB+t]=0;}}
    for(const t of cutA){fA.ok[t]=0;if(S.label[oA+t]===fA.P&&!(fA.bl&&fA.bl[t])){S.label[oA+t]=fA.B;S.keep[oA+t]=0;}}
    /* and both stripes run the same length: along the arm, neither goes past where the other ends (a blob at one stripe's end where the
       tracking wandered onto the cap is past the other's clean end) */
    {let m0=[0,0,0];for(let t=0;t<gA.n;t++)for(let k=0;k<3;k++)m0[k]+=gA.c[t*3+k]/gA.n;const cv=[0,0,0,0,0,0];for(let t=0;t<gA.n;t++){const d=[gA.c[t*3]-m0[0],gA.c[t*3+1]-m0[1],gA.c[t*3+2]-m0[2]];cv[0]+=d[0]*d[0];cv[1]+=d[0]*d[1];cv[2]+=d[0]*d[2];cv[3]+=d[1]*d[1];cv[4]+=d[1]*d[2];cv[5]+=d[2]*d[2];}
     let ax=[0.3,0.4,0.85];for(let it=0;it<50;it++){const w=[cv[0]*ax[0]+cv[1]*ax[1]+cv[2]*ax[2],cv[1]*ax[0]+cv[3]*ax[1]+cv[4]*ax[2],cv[2]*ax[0]+cv[4]*ax[1]+cv[5]*ax[2]];const l=Math.hypot(...w)||1;ax=w.map(x=>x/l);}
     const prA=q=>(q[0]-m0[0])*ax[0]+(q[1]-m0[1])*ax[1]+(q[2]-m0[2])*ax[2];
     let a0=Infinity,a1=-Infinity,b0=Infinity,b1=-Infinity;for(let t=0;t<gA.n;t++)if(fA.ok[t]){const x=prA([gA.c[t*3],gA.c[t*3+1],gA.c[t*3+2]]);a0=Math.min(a0,x);a1=Math.max(a1,x);}
     const xB=new Float32Array(gB.n);for(let t=0;t<gB.n;t++){xB[t]=prA(mapAB(t));if(fB.ok[t]){b0=Math.min(b0,xB[t]);b1=Math.max(b1,xB[t]);}}
     const lo=Math.max(a0,b0)-0.3,hi=Math.min(a1,b1)+0.3;let cA2=0,cB2=0;
     for(let t=0;t<gA.n;t++){if(!fA.ok[t])continue;const x=prA([gA.c[t*3],gA.c[t*3+1],gA.c[t*3+2]]);if(x<lo||x>hi){fA.ok[t]=0;if(S.label[oA+t]===fA.P&&!(fA.bl&&fA.bl[t])){S.label[oA+t]=fA.B;S.keep[oA+t]=0;cA2++;}}}
     for(let t=0;t<gB.n;t++){if(!fB.ok[t])continue;const x=xB[t];if(x<lo||x>hi){fB.ok[t]=0;if(S.label[oB+t]===fB.P&&!(fB.bl&&fB.bl[t])){S.label[oB+t]=fB.B;S.keep[oB+t]=0;cB2++;}}}
     rep.push("len A"+a0.toFixed(1)+".."+a1.toFixed(1)+" B"+b0.toFixed(1)+".."+b1.toFixed(1)+" clip"+cA2+"/"+cB2);}
    rep.push("cutA"+cutA.length+" cutB"+cutB.length);}
  (window._spcDbg=window._spcDbg||{}).mirrorArms=rep;}
function redrawStripes(active,hid){const rep=[];if(!S.stripes){(window._spcDbg=window._spcDbg||{}).redraw=['none'];return;}
  const done=new Set();
  for(const st of S.stripes){const pi=st.pi;if(!active.includes(pi)||done.has(pi+":"+st.P))continue;done.add(pi+":"+st.P);
    if(/(torso|chest|body)/i.test(S.parts[pi].name))continue;
    const P=st.P,o=S.offs[pi],nb=S.nb[pi],A=S.area,g=pieceGeo(pi,null),n=g.n;
    /* the stripe is every thin run of the stripe paint on the piece (where it covers well under three quarters of the
       1.5 mm round it), so a glove or boot of the same paint is left out, and the part of the stripe that crosses
       the top of a shoulder or hip counts too */
    const cell=1.5,grid=new Map(),K=(x,y,z)=>((x+512)*1024+(y+512))*1024+(z+512);
    for(let t=0;t<n;t++){if(hid[o+t])continue;const k=K(Math.floor(g.c[t*3]/cell),Math.floor(g.c[t*3+1]/cell),Math.floor(g.c[t*3+2]/cell));let b=grid.get(k);if(!b){b=[];grid.set(k,b);}b.push(t);}
    const inS=new Uint8Array(n);let nS=0;
    for(let t=0;t<n;t++){if(hid[o+t]||S.label[o+t]!==P)continue;const x=g.c[t*3],y=g.c[t*3+1],z=g.c[t*3+2],cx=Math.floor(x/cell),cy=Math.floor(y/cell),cz=Math.floor(z/cell);let all=0,pp=0;
      for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){const bb=grid.get(K(cx+i,cy+j,cz+k));if(!bb)continue;for(const u of bb){const dx=g.c[u*3]-x,dy=g.c[u*3+1]-y,dz=g.c[u*3+2]-z;if(dx*dx+dy*dy+dz*dz>2.25)continue;const w=A[o+u];all+=w;if(S.label[o+u]===P)pp+=w;}}
      if(all&&pp/all<0.72){inS[t]=1;nS++;}}
    /* where the thin-run test finds too little (a stripe that runs into a boot of its own paint), the stripe found
       on the sculpt stands in */
    if(nS<300){for(const t of st.faces)if(!hid[o+t]&&S.label[o+t]===P&&!inS[t]){inS[t]=1;nS++;}}
    /* the stripe stops at the glove or boot rim: nothing below it counts as stripe */
    /* and the rim band of the glove or boot (its paint reaching up to 2.5 mm over the rim line) is the glove or boot,
       not stripe: it is left as it is, and the stripe is drawn to meet it */
    const blw=S.below&&S.below[pi];const bl2=blw?new Uint8Array(n):null;
    if(blw){const dd=new Float64Array(n).fill(Infinity),h=[];for(let t=0;t<n;t++)if(blw[t]){bl2[t]=1;dd[t]=0;hpush(h,[0,t]);}
      while(h.length){const [dc,t]=hpop(h);if(dc>dd[t])continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||hid[o+u]||S.label[o+u]!==P)continue;const nd=dc+Math.hypot(g.c[t*3]-g.c[u*3],g.c[t*3+1]-g.c[u*3+1],g.c[t*3+2]-g.c[u*3+2]);if(nd<dd[u]&&nd<=0.3){dd[u]=nd;hpush(h,[nd,u]);}}}
      for(let t=0;t<n;t++){if(dd[t]<=0.3)bl2[t]=1;if(inS[t]&&bl2[t]){inS[t]=0;nS--;}}}
    let LA=[0,0,1];
    /* piping runs along the limb: a run of the stripe paint going round it (a rim band, a cuff) is not stripe */
    {const pca=(idx)=>{let mx=0,my=0,mz=0,sw=0;for(const t of idx){const w=A[o+t];mx+=g.c[t*3]*w;my+=g.c[t*3+1]*w;mz+=g.c[t*3+2]*w;sw+=w;}mx/=sw;my/=sw;mz/=sw;const cv=[0,0,0,0,0,0];for(const t of idx){const w=A[o+t],x=g.c[t*3]-mx,y=g.c[t*3+1]-my,z=g.c[t*3+2]-mz;cv[0]+=w*x*x;cv[1]+=w*x*y;cv[2]+=w*x*z;cv[3]+=w*y*y;cv[4]+=w*y*z;cv[5]+=w*z*z;}
       let ax=[0.31,0.47,0.83];for(let it=0;it<40;it++){const w=[cv[0]*ax[0]+cv[1]*ax[1]+cv[2]*ax[2],cv[1]*ax[0]+cv[3]*ax[1]+cv[4]*ax[2],cv[2]*ax[0]+cv[4]*ax[1]+cv[5]*ax[2]],m=Math.hypot(...w)||1;ax=w.map(x=>x/m);}return ax;};
     const all=[];for(let t=0;t<n;t++)if(!hid[o+t])all.push(t);LA=pca(all);const drop=[];
     for(let t=0;t<n;t++){if(!inS[t])continue;const x=g.c[t*3],y=g.c[t*3+1],z=g.c[t*3+2],cx=Math.floor(x/cell),cy=Math.floor(y/cell),cz=Math.floor(z/cell),nn=[];
       for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++)for(let k=-2;k<=2;k++){const bb=grid.get(K(cx+i,cy+j,cz+k));if(!bb)continue;for(const u of bb){if(!inS[u])continue;const dx=g.c[u*3]-x,dy=g.c[u*3+1]-y,dz=g.c[u*3+2]-z;if(dx*dx+dy*dy+dz*dz<=6.25)nn.push(u);}}
       if(nn.length<8)continue;const v=pca(nn);if(Math.abs(v[0]*LA[0]+v[1]*LA[1]+v[2]*LA[2])<0.5)drop.push(t);}
     for(const t of drop){inS[t]=0;nS--;}}
    if(nS<30){rep.push(S.parts[pi].name+" few");continue;}
    const RID=S.rid&&S.rid[pi];const D=(t,u)=>Math.hypot(g.c[t*3]-g.c[u*3],g.c[t*3+1]-g.c[u*3+1],g.c[t*3+2]-g.c[u*3+2]);
    const geo=(src,useR)=>{const d=new Float64Array(n).fill(Infinity),pv=new Int32Array(n).fill(-1),h=[];d[src]=0;hpush(h,[0,src]);
      while(h.length){const [dc,t]=hpop(h);if(dc>d[t])continue;if(dc>600)break;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||hid[o+u]||(blw&&blw[u]))continue;const nd=dc+D(t,u)*(inS[u]?1:3)*(useR&&RID&&RID[u]<=0.03?2.5:1);if(nd<d[u]){d[u]=nd;pv[u]=t;hpush(h,[nd,u]);}}}return {d,pv};}; /* (the sculpted cord is the cheapest way)*/
    /* its two far ends, and the way between them (side bits off it are left out) */
    /* seed in the biggest connected piece of it (a stray face alone would find no way anywhere) */
    let s0=-1;const cp=new Int32Array(n).fill(-1);{let best=0;for(let a0=0;a0<n;a0++){if(!inS[a0]||cp[a0]>=0)continue;const c=[a0];cp[a0]=a0;for(let h=0;h<c.length;h++){const t=c[h];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&inS[u]&&cp[u]<0){cp[u]=a0;c.push(u);}}}if(c.length>best){best=c.length;s0=a0;}}}
    const inSall=inS.slice();/* the stripe is the biggest connected run; stray bits elsewhere go */for(let t=0;t<n;t++)if(inS[t]&&cp[t]!==s0&&!st.keepAll){inS[t]=0;}
    let r=geo(s0),Aend=s0;for(let t=0;t<n;t++)if(inS[t]&&isFinite(r.d[t])&&r.d[t]>r.d[Aend])Aend=t;
    r=geo(Aend);let Bend=Aend;for(let t=0;t<n;t++)if(inS[t]&&isFinite(r.d[t])&&r.d[t]>r.d[Bend])Bend=t;
    const L=r.d[Bend];r=geo(Aend,true);
    let path=[],cut=null;for(let t=Bend;t>=0;t=r.pv[t])path.push(t);
    /* piping runs along the limb: trim off each end of the line where it turns across the limb (round the top of a
       shoulder cap, round a knee) */
    {/* the stripe's own main direction (a joint flange or a hand would skew the piece's) */let mx=0,my=0,mz=0;const PP=path;for(const t of PP){mx+=g.c[t*3];my+=g.c[t*3+1];mz+=g.c[t*3+2];}mx/=PP.length;my/=PP.length;mz/=PP.length;const cv=[0,0,0,0,0,0];for(const t of PP){const x=g.c[t*3]-mx,y=g.c[t*3+1]-my,z=g.c[t*3+2]-mz;cv[0]+=x*x;cv[1]+=x*y;cv[2]+=x*z;cv[3]+=y*y;cv[4]+=y*z;cv[5]+=z*z;}
     let ax=[0.2,0.3,1];for(let it=0;it<50;it++){const w=[cv[0]*ax[0]+cv[1]*ax[1]+cv[2]*ax[2],cv[1]*ax[0]+cv[3]*ax[1]+cv[4]*ax[2],cv[2]*ax[0]+cv[4]*ax[1]+cv[5]*ax[2]],m=Math.hypot(...w)||1;ax=w.map(x=>x/m);}
     const P3=t=>[g.c[t*3],g.c[t*3+1],g.c[t*3+2]];const along=(i,j)=>{const a=P3(path[i]),b=P3(path[j]),d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],l=Math.hypot(...d);return l<0.5?1:Math.abs(d[0]*ax[0]+d[1]*ax[1]+d[2]*ax[2])/l;};
     const win=i=>{let j=i;while(j<path.length-1&&D(path[i],path[j])<2.5)j++;return j;},winB=i=>{let j=i;while(j>0&&D(path[i],path[j])<2.5)j--;return j;};
     let a0=0;while(a0<path.length-6&&along(a0,win(a0))<0.7)a0++;let b0=path.length-1;while(b0>a0+6&&along(winB(b0),b0)<0.7)b0--;
     path=path.slice(a0,b0+1);
     /* and anywhere along it where it runs across the limb (round a knee crease mid-way down a one-piece leg) */
     const keepP=path.map((_,i)=>{let j0=i,j1=i;while(j0>0&&D(path[i],path[j0])<1.0)j0--;while(j1<path.length-1&&D(path[i],path[j1])<1.0)j1++;return along(j0,j1)>=0.75;});
     cut=keepP.map(k=>!k);
     /* and it only ever runs one way along the limb: where it turns back (looping round the top of a shoulder cap)
        the rest is cut */
     {const sp=path.map(t=>g.c[t*3]*ax[0]+g.c[t*3+1]*ax[1]+g.c[t*3+2]*ax[2]),sg=Math.sign(sp[sp.length-1]-sp[0])||1;
      /* the longest stretch that never backs up more than 1.5 mm */
      let bi=0,bj=path.length-1,bl=-1;for(let i=0;i<path.length;i++){let mx=-Infinity,j=i;for(;j<path.length;j++){const v=sg*sp[j];if(v>mx)mx=v;if(v<mx-1.5)break;}const len=sg*(sp[j-1]-sp[i]);if(len>bl){bl=len;bi=i;bj=j-1;}}
      if(window._spcMono)for(let i=0;i<path.length;i++)if(i<bi||i>bj)cut[i]=true;
      }}
    /* on an arm the piping is the sculpted cord, top to glove: the cord the line found is followed up to where the
       sculptor ended it (the top of the shoulder cap) and down to the glove, keeping to the cord the whole way */
    let onCord=false;const isArm=/(^|[^a-z])arm([^a-z]|$)/i.test(S.parts[pi].name);
    if(isArm&&RID&&blw){const BAND=alongBand(g,cordBand(g,RID,t=>hid[o+t]),LA,A,o);
      const cp2=new Int32Array(n).fill(-1);let best=-1,bs=0;const inP=new Uint8Array(n);for(const t of path)inP[t]=1;
      for(let a0=0;a0<n;a0++){if(!BAND[a0]||cp2[a0]>=0||blw[a0])continue;const c=[a0];cp2[a0]=a0;let ov=0;for(let h=0;h<c.length;h++){const t=c[h];if(inP[t])ov++;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&BAND[u]&&cp2[u]<0&&!blw[u]&&!hid[o+u]){cp2[u]=a0;c.push(u);}}}if(ov>bs){bs=ov;best=a0;}}
      if(best>=0){/* away from the glove along the arm */let gx=0,gy=0,gz=0,gn=0,ax=0,ay=0,az=0,an=0;for(let t=0;t<n;t++){if(hid[o+t])continue;if(blw[t]){gx+=g.c[t*3];gy+=g.c[t*3+1];gz+=g.c[t*3+2];gn++;}else{ax+=g.c[t*3];ay+=g.c[t*3+1];az+=g.c[t*3+2];an++;}}
        const up=[ax/an-gx/gn,ay/an-gy/gn,az/an-gz/gn];let top=-1,tv=-Infinity;for(let t=0;t<n;t++)if(cp2[t]===best){const v=g.c[t*3]*up[0]+g.c[t*3+1]*up[1]+g.c[t*3+2]*up[2];if(v>tv){tv=v;top=t;}}
        const d=new Float64Array(n).fill(Infinity),pv=new Int32Array(n).fill(-1),h=[];d[top]=0;hpush(h,[0,top]);let hit=-1;
        while(h.length){const [dc,t]=hpop(h);if(dc>d[t])continue;if(blw[t]){hit=t;break;}for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||hid[o+u])continue;const nd=dc+D(t,u)*(BAND[u]?1:12);if(nd<d[u]){d[u]=nd;pv[u]=t;hpush(h,[nd,u]);}}}
        if(hit>=0){let pp=[];for(let t=pv[hit];t>=0;t=pv[t])pp.push(t); /* (glove end first) */
          /* pp runs glove to top: from the top end, cut back to where it runs along the arm (a cord round the top of
             the cap, or the cap's cut seam, is not the stripe) */
          {const im=Math.floor(pp.length*0.6),up=[g.c[pp[im]*3]-g.c[pp[0]*3],g.c[pp[im]*3+1]-g.c[pp[0]*3+1],g.c[pp[im]*3+2]-g.c[pp[0]*3+2]]; /* (the arm's own heading: glove end to six tenths up the line) */
           const al=(i,j)=>{const dx=g.c[pp[j]*3]-g.c[pp[i]*3],dy=g.c[pp[j]*3+1]-g.c[pp[i]*3+1],dz=g.c[pp[j]*3+2]-g.c[pp[i]*3+2],l=Math.hypot(dx,dy,dz)||1;return Math.abs(dx*up[0]+dy*up[1]+dz*up[2])/(l*Math.hypot(...up));};
           let e=pp.length-1;while(e>10){let j=e;while(j>0&&D(pp[e],pp[j])<1.5)j--;if(al(j,e)>=0.6)break;e=j;}pp=pp.slice(0,e+1);
           /* and where the surface under it turns to face up the arm (the top of the cap, where the cut seam runs) */
           const un=Math.hypot(...up)||1;while(pp.length>10){const t=pp[pp.length-1];if(Math.abs(g.fn[t*3]*up[0]+g.fn[t*3+1]*up[1]+g.fn[t*3+2]*up[2])/un<0.75)break;pp.pop();}}
          if(pp.length>10){path=pp;cut=new Array(pp.length).fill(false);onCord=true;}}}}
    /* on a leg likewise: the sculpted cord the line found is followed end to end, keeping to it */
    if(!onCord&&!isArm&&RID){const BAND=alongBand(g,cordBand(g,RID,t=>hid[o+t]),LA,A,o);const inP=new Uint8Array(n);for(const t of path)inP[t]=1;
      const cp2=new Int32Array(n).fill(-1);let best=-1,bs=0;for(let a0=0;a0<n;a0++){if(!BAND[a0]||cp2[a0]>=0||(blw&&blw[a0]))continue;const c=[a0];cp2[a0]=a0;let ov=0;for(let h=0;h<c.length;h++){const t=c[h];if(inP[t])ov++;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&BAND[u]&&cp2[u]<0&&!(blw&&blw[u])&&!hid[o+u]){cp2[u]=a0;c.push(u);}}}if(ov>bs){bs=ov;best=a0;}}
      if(best>=0&&bs>path.length*0.4){const gd=src=>{const d=new Float64Array(n).fill(Infinity),pv=new Int32Array(n).fill(-1),h=[];d[src]=0;hpush(h,[0,src]);while(h.length){const [dc,t]=hpop(h);if(dc>d[t])continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||cp2[u]!==best)continue;const nd=dc+D(t,u);if(nd<d[u]){d[u]=nd;pv[u]=t;hpush(h,[nd,u]);}}}return {d,pv};};
        let r1=gd(best),a1=best;for(let t=0;t<n;t++)if(cp2[t]===best&&r1.d[t]>r1.d[a1])a1=t;const r2=gd(a1);let b1=a1;for(let t=0;t<n;t++)if(cp2[t]===best&&r2.d[t]>r2.d[b1])b1=t;
        const pp=[];for(let t=b1;t>=0;t=r2.pv[t])pp.push(t);
        /* it runs along the leg: ends where it turns across (round a hip top or a knee) are cut */
        const al=(i,j)=>{const dx=g.c[pp[j]*3]-g.c[pp[i]*3],dy=g.c[pp[j]*3+1]-g.c[pp[i]*3+1],dz=g.c[pp[j]*3+2]-g.c[pp[i]*3+2],l=Math.hypot(dx,dy,dz)||1;return Math.abs(dx*LA[0]+dy*LA[1]+dz*LA[2])/l;};
        let a0=0;while(a0<pp.length-10){let j=a0;while(j<pp.length-1&&D(pp[a0],pp[j])<1.5)j++;if(al(a0,j)>=0.6)break;a0=j;}let e0=pp.length-1;while(e0>a0+10){let j=e0;while(j>0&&D(pp[e0],pp[j])<1.5)j--;if(al(j,e0)>=0.6)break;e0=j;}
        const q=pp.slice(a0,e0+1);if(q.length>10){path=q;cut=new Array(q.length).fill(false);onCord=true;}}}
    /* the stripe runs all the way to the glove or boot: where the paint gave out before the rim (a seam or a
       crease broke it), the line goes on along the sculpted cord down to the rim */
    /* nothing crosses the top of a shoulder cap or a hip: the line ends where the surface under it turns to face
       along the limb */
    if(!onCord){const fa=t=>Math.abs(g.fn[t*3]*LA[0]+g.fn[t*3+1]*LA[1]+g.fn[t*3+2]*LA[2]);let a0=0,b0=path.length-1;while(a0<b0-6&&fa(path[a0])>0.6)a0++;while(b0>a0+6&&fa(path[b0])>0.6)b0--;
     if(a0>0||b0<path.length-1){path=path.slice(a0,b0+1);if(cut)cut=cut.slice(a0,b0+1);}}
    let ext=0;if(blw&&path.length>=6&&(!onCord||!isArm)){
      /* march straight on from the end, along the line's own heading, staying on the surface, until the rim */
      const projI=q=>{const cx=Math.floor(q[0]/cell),cy=Math.floor(q[1]/cell),cz=Math.floor(q[2]/cell);let b=-1,bd2=Infinity;for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){const bb=grid.get(K(cx+i,cy+j,cz+k));if(!bb)continue;for(const t of bb){const d=(g.c[t*3]-q[0])**2+(g.c[t*3+1]-q[1])**2+(g.c[t*3+2]-q[2])**2;if(d<bd2){bd2=d;b=t;}}}return b;};
      const C3=t=>[g.c[t*3],g.c[t*3+1],g.c[t*3+2]];
      const tryEnd=(idx)=>{/* idx: indices from the end inward, skipping a cut hook */let k=0;while(k<idx.length-6&&cut&&cut[idx[k]])k++;const e0=path[idx[k]];let k2=k;while(k2<idx.length-1&&D(e0,path[idx[k2]])<4)k2++;
        const a=C3(path[idx[k2]]),e=C3(e0);let d=[e[0]-a[0],e[1]-a[1],e[2]-a[2]];let l=Math.hypot(...d)||1;d=d.map(x=>x/l);
        const sg=Math.sign(d[0]*LA[0]+d[1]*LA[1]+d[2]*LA[2])||1;d=d.map((x,i)=>0.4*x+0.6*sg*LA[i]);l=Math.hypot(...d);d=d.map(x=>x/l);
        let q=e.slice();const seg=[];let hit=false;for(let s2=0;s2<100;s2++){q=[q[0]+d[0]*0.3,q[1]+d[1]*0.3,q[2]+d[2]*0.3];const t=projI(q);if(t<0)break;q=C3(t);if(blw[t]){hit=true;break;}if(!seg.length||seg[seg.length-1]!==t)seg.push(t);}
        return hit?{k,seg}:null;};
      const iB=[...path.keys()].reverse(),iA=[...path.keys()];
      const eB=tryEnd(iB),eA=tryEnd(iA);const pick=(eA&&eB)?(eA.seg.length<=eB.seg.length?['A',eA]:['B',eB]):eA?['A',eA]:eB?['B',eB]:null;
      if(pick&&pick[1].seg.length>1){const {k,seg}=pick[1];ext=seg.length;
        if(pick[0]==='B'){path=path.slice(0,path.length-k).concat(seg);if(cut)cut=cut.slice(0,cut.length-k).concat(new Array(seg.length).fill(false));}
        else{path=seg.slice().reverse().concat(path.slice(k));if(cut)cut=new Array(seg.length).fill(false).concat(cut.slice(k));}}}
    if(path.length<6){rep.push(S.parts[pi].name.replace(/^.*?_\d+_/,'')+' nopath n'+nS+' s0'+s0+' A'+Aend+' B'+Bend+' fin'+[...r.d].filter(isFinite).length+' hid'+hid[o+s0]);continue;}
    let ar=0;for(let t=0;t<n;t++)if(inS[t])ar+=A[o+t];const W=Math.max(1.1,Math.min(1.6,ar/Math.max(L,1)));
    /* straighten, staying on the surface */
    let X=path.map(t=>[g.c[t*3],g.c[t*3+1],g.c[t*3+2]]);
    if(onCord){/* the paint follows the sculpted cord's crest, wherever it goes (no straightening) */X=cordSmooth(g,X,RID,A,o,t=>hid[o+t],1.0);}else{
    const proj=q=>{const cx=Math.floor(q[0]/cell),cy=Math.floor(q[1]/cell),cz=Math.floor(q[2]/cell);let b=null,bd2=Infinity;for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){const bb=grid.get(K(cx+i,cy+j,cz+k));if(!bb)continue;for(const t of bb){const d=(g.c[t*3]-q[0])**2+(g.c[t*3+1]-q[1])**2+(g.c[t*3+2]-q[2])**2;if(d<bd2){bd2=d;b=t;}}}return b==null?q:[g.c[b*3],g.c[b*3+1],g.c[b*3+2]];};
    /* onto the middle of the cord (a flat cord shows as two edge lines): each point to the middle of the raised
       faces within 0.9 mm */
    if(RID){const ctr=q=>{const cx=Math.floor(q[0]/cell),cy=Math.floor(q[1]/cell),cz=Math.floor(q[2]/cell);let sw=0,x=0,y=0,z=0;for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){const bb=grid.get(K(cx+i,cy+j,cz+k));if(!bb)continue;for(const t of bb){if(RID[t]<=0.03)continue;const d=Math.hypot(g.c[t*3]-q[0],g.c[t*3+1]-q[1],g.c[t*3+2]-q[2]);if(d>0.9)continue;const w=A[o+t];sw+=w;x+=g.c[t*3]*w;y+=g.c[t*3+1]*w;z+=g.c[t*3+2]*w;}}return sw?[x/sw,y/sw,z/sw]:q;};
      X=X.map(q=>ctr(q));}
    for(let it=0;it<12;it++){for(const lam of [0.5,-0.53]){const Y=X.map(x=>x.slice());for(let i=1;i<X.length-1;i++)for(let c=0;c<3;c++)Y[i][c]=X[i][c]+lam*((X[i-1][c]+X[i+1][c])/2-X[i][c]);X=Y;}for(let i=1;i<X.length-1;i++)X[i]=proj(X[i]);}
    /* then one smooth curve through it all (a low-order polynomial along its length), so the line has no wobble */
    {const fitP=()=>{const sl=[0];for(let i=1;i<X.length;i++)sl.push(sl[i-1]+Math.hypot(X[i][0]-X[i-1][0],X[i][1]-X[i-1][1],X[i][2]-X[i-1][2]));const Lt=sl[sl.length-1]||1;
       const dg=Lt<15?2:Lt<40?3:5,m=dg+1,u=sl.map(v=>2*v/Lt-1);const M=[];for(let a=0;a<m;a++){M.push(new Array(m).fill(0));}const R=[[],[],[]].map(()=>new Array(m).fill(0));
       for(let i=0;i<X.length;i++){const pw=[1];for(let a=1;a<m;a++)pw.push(pw[a-1]*u[i]);for(let a=0;a<m;a++){for(let b=0;b<m;b++)M[a][b]+=pw[a]*pw[b];for(let c=0;c<3;c++)R[c][a]+=pw[a]*X[i][c];}}
       const solve=(Mm,r)=>{const n2=r.length,A2=Mm.map((row,i)=>row.concat([r[i]]));for(let i=0;i<n2;i++){let pv=i;for(let j=i+1;j<n2;j++)if(Math.abs(A2[j][i])>Math.abs(A2[pv][i]))pv=j;[A2[i],A2[pv]]=[A2[pv],A2[i]];for(let j=i+1;j<n2;j++){const f=A2[j][i]/(A2[i][i]||1e-12);for(let k=i;k<=n2;k++)A2[j][k]-=f*A2[i][k];}}const x=new Array(n2).fill(0);for(let i=n2-1;i>=0;i--){let sm=A2[i][n2];for(let k=i+1;k<n2;k++)sm-=A2[i][k]*x[k];x[i]=sm/(A2[i][i]||1e-12);}return x;};
       const co=R.map(r=>solve(M,r));X=X.map((_,i)=>{const pw=[1];for(let a=1;a<m;a++)pw.push(pw[a-1]*u[i]);return [0,1,2].map(c=>co[c].reduce((s2,v,a)=>s2+v*pw[a],0));});};
     if(X.length>8){fitP();X=X.map(q=>proj(q));fitP();X=onSurface(g,X,t=>hid[o+t]);}} /* (the last fit is left as it is: snapping it to face middles would put the zigzag back) */}
    const dl=t=>{let b=Infinity;for(let i=1;i<X.length;i++){if(cut&&(cut[i]||cut[i-1]))continue;const a=X[i-1],c=X[i],dx=c[0]-a[0],dy=c[1]-a[1],dz=c[2]-a[2],l2=dx*dx+dy*dy+dz*dz||1e-12;let s2=((g.c[t*3]-a[0])*dx+(g.c[t*3+1]-a[1])*dy+(g.c[t*3+2]-a[2])*dz)/l2;s2=Math.max(0,Math.min(1,s2));const d=Math.hypot(g.c[t*3]-a[0]-s2*dx,g.c[t*3+1]-a[1]-s2*dy,g.c[t*3+2]-a[2]-s2*dz);if(d<b)b=d;}return b;};
    /* the paint round the stripe */
    const bm=new Map();for(let t=0;t<n;t++){if(!inS[t])continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||S.label[o+u]===P)continue;const l=S.label[o+u];if(l>=0)bm.set(l,(bm.get(l)||0)+1);}}
    let B=-1,bv=0;for(const [k,v] of bm)if(v>bv){bv=v;B=k;}if(B<0){rep.push('noB');continue;}
    /* clear the old stripe (and any bits of it within 4 mm of the line), then paint the even stripe */
    let cl=0,pa=0;const dCache=new Float32Array(n).fill(-1);const DL=t=>dCache[t]>=0?dCache[t]:(dCache[t]=dl(t));
    const inS0=inS.slice();
    for(let t=0;t<n;t++)if(inS[t]){ /* every thin run of the stripe paint goes; only the one even line comes back */S.label[o+t]=B;S.keep[o+t]=0;cl++;}
    const seen=new Uint8Array(n),fr=[...path];for(const t of fr)seen[t]=1;
    for(let h=0;h<fr.length;h++){const t=fr[h];const d=DL(t);if(d>W/2+0.8)continue;
      if(d<=W/2&&!hid[o+t]&&(S.label[o+t]===B||S.label[o+t]===P)){S.label[o+t]=P;S.keep[o+t]=1;pa++;}
      for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&!seen[u]){seen[u]=1;fr.push(u);}}}
    /* and above the rim, the stripe paint is only the line: anything else of it goes back to the paint round it */
    {const bl=bl2,pl0=C.lab(...S.regions[P].rgb),same=S.regions.map((r,i)=>i===P||C.dE(C.lab(...r.rgb),pl0)<18);let rv=0;for(let t=0;t<n;t++){const l=S.label[o+t];if(l<0||!same[l]||(bl&&bl[t])||S.keepHard&&S.keepHard[o+t])continue;if(DL(t)>W/2+0.1){S.label[o+t]=B;S.keep[o+t]=0;rv++;}}cl+=rv;}
    {/* the stroke for the saved file: the line's uncut runs, half its width, and the faces it owns */
     const runs=[];let cur=[X[0]];for(let i=1;i<X.length;i++){if(cut&&(cut[i]||cut[i-1])){if(cur.length>1)runs.push(cur);cur=[X[i]];}else cur.push(X[i]);}if(cur.length>1)runs.push(cur);
     const own=new Uint8Array(n),oS=new Int16Array(n).fill(-1),oB=new Int16Array(n).fill(-1);for(let t=0;t<n;t++){if(hid[o+t]||(bl2&&bl2[t]))continue;if(DL(t)<=W/2+1.8){own[t]=1;oS[t]=P;oB[t]=B;}}
     /* each run carried on 0.8 mm past its ends along its own heading, so it meets the glove or boot with no gap */
     const extE=R=>{const k=R.length;if(k<3)return R;const ext=(a,b)=>{const d=[a[0]-b[0],a[1]-b[1],a[2]-b[2]],l=Math.hypot(...d)||1;return [a[0]+d[0]/l*0.8,a[1]+d[1]/l*0.8,a[2]+d[2]/l*0.8];};
       let i0=1;while(i0<k-1&&Math.hypot(R[i0][0]-R[0][0],R[i0][1]-R[0][1],R[i0][2]-R[0][2])<1)i0++;let i1=k-2;while(i1>0&&Math.hypot(R[i1][0]-R[k-1][0],R[i1][1]-R[k-1][1],R[i1][2]-R[k-1][2])<1)i1--;
       return [ext(R[0],R[i0])].concat(R,[ext(R[k-1],R[i1])]);};
     (S.strokes=S.strokes||{})[pi]={list:runs.map(R=>({X:extE(R),r:W/2,s:P,base:B})),own,oS,oB};}
    /* the paint is the sculpted band between the cord's two grooves, when the sculpt has them */
    let BANDF=null;{const guide=[];for(let t=0;t<n;t++)if((inS0[t]||inSall[t])&&!hid[o+t])guide.push(t);const GB=grooveBand2(g,o,t=>!!hid[o+t],guide,A,t=>!!(bl2&&bl2[t]),false,/(^|[^a-z])arm[_ ]?(left|right)?/i.test(S.parts[pi].name.replace(/starman/i,""))); /* (no flood past the band's end: it wrapped red over the joint end) */ /* (only a leg's cord curls round at its end, over the hip; on an arm the flood ran out over the deltoid's own creases) */
      if(GB){let nb2=0;for(let t=0;t<n;t++){if(bl2&&bl2[t])GB[t]=0;if(GB[t])nb2++;}
        if(nb2>50){BANDF=GB;rep.push(S.parts[pi].name.replace(/^.*?_\d+_/,"")+" GROOVES "+GB.info+" n"+nb2);
          /* near the traced band the band rules; away from it (where the grooves gave out) the drawn line stays */
          const MG=1.0,mg=new Map();for(const q of GB.mids){const k=((Math.floor(q[0]/MG)+4096)*8192+(Math.floor(q[1]/MG)+4096))*8192+(Math.floor(q[2]/MG)+4096);let a=mg.get(k);if(!a){a=[];mg.set(k,a);}a.push(q);}
          const nearB=(x,y,z,R)=>{const cx=Math.floor(x/MG),cy=Math.floor(y/MG),cz=Math.floor(z/MG),r=Math.ceil(R/MG);for(let i=-r;i<=r;i++)for(let j=-r;j<=r;j++)for(let k=-r;k<=r;k++){const a=mg.get(((cx+i+4096)*8192+(cy+j+4096))*8192+(cz+k+4096));if(!a)continue;for(const q of a)if((q[0]-x)**2+(q[1]-y)**2+(q[2]-z)**2<=R*R)return true;}return false;};
          /* does the traced band run the stripe's whole length? measured along the guide's own long axis */let full=false;{const gc=[0,0,0];for(const t of guide){gc[0]+=g.c[t*3];gc[1]+=g.c[t*3+1];gc[2]+=g.c[t*3+2];}gc[0]/=guide.length;gc[1]/=guide.length;gc[2]/=guide.length;let C=[[0,0,0],[0,0,0],[0,0,0]];for(const t of guide){const d=[g.c[t*3]-gc[0],g.c[t*3+1]-gc[1],g.c[t*3+2]-gc[2]];for(let i=0;i<3;i++)for(let j=0;j<3;j++)C[i][j]+=d[i]*d[j];}let v=[1,1,1];for(let k=0;k<30;k++){const w=[0,1,2].map(i=>C[i][0]*v[0]+C[i][1]*v[1]+C[i][2]*v[2]);const l=Math.hypot(...w)||1;v=w.map(x=>x/l);}const pr=q=>(q[0]-gc[0])*v[0]+(q[1]-gc[1])*v[1]+(q[2]-gc[2])*v[2];let a0=Infinity,a1=-Infinity,b0=Infinity,b1=-Infinity;for(const t of guide){const x=pr([g.c[t*3],g.c[t*3+1],g.c[t*3+2]]);a0=Math.min(a0,x);a1=Math.max(a1,x);}for(const q of GB.mids){const x=pr(q);b0=Math.min(b0,x);b1=Math.max(b1,x);}if(!GB.mids.length){for(let t=0;t<n;t++)if(GB[t]){const x=pr([g.c[t*3],g.c[t*3+1],g.c[t*3+2]]);b0=Math.min(b0,x);b1=Math.max(b1,x);}}const cov=(Math.min(a1,b1)-Math.max(a0,b0))/Math.max(1e-6,a1-a0);full=cov>0.8||!!GB.even;rep.push("  cover "+cov.toFixed(2));}for(let t=0;t<n;t++){if(BANDF[t]){if(!(S.keepHard&&S.keepHard[o+t])){S.label[o+t]=P;S.keep[o+t]=1;}}else if(S.label[o+t]===P&&!(bl2&&bl2[t])&&(full||nearB(g.c[t*3],g.c[t*3+1],g.c[t*3+2],2.5))){S.label[o+t]=B;S.keep[o+t]=0;}} /* (a band traced end to end is the whole stripe: red anywhere else on the piece is a blotch; a band the grooves gave out on rules only near itself) */
          if(S.strokes&&S.strokes[pi]){const sk=S.strokes[pi];const nl=[];for(const st2 of sk.list){let cur=[];for(const q of st2.X){if(nearB(q[0],q[1],q[2],2.5)){if(cur.length>2)nl.push({...st2,X:cur});cur=[];}else cur.push(q);}if(cur.length>2)nl.push({...st2,X:cur});}
            sk.list=nl;for(let t=0;t<n;t++)if(sk.own[t]&&nearB(g.c[t*3],g.c[t*3+1],g.c[t*3+2],2.0))sk.own[t]=0;if(!nl.length)delete S.strokes[pi];}
          if(full){if(S.strokes)delete S.strokes[pi];}else{const okA=new Uint8Array(n);for(let t=0;t<n;t++)okA[t]=BANDF[t]||(S.label[o+t]===P&&!nearB(g.c[t*3],g.c[t*3+1],g.c[t*3+2],2.5)&&DL(t)<=W/2+0.1)?1:0;BANDF=okA;}}}}
    if(!BANDF&&RID&&onCord){BANDF=ridgeBand(g,RID,[X],t=>!!hid[o+t],nb,0.75,-0.02);let nb2=0;for(let t=0;t<n;t++){if(bl2&&bl2[t])BANDF[t]=0;if(BANDF[t])nb2++;}
      if(nb2>50){for(let t=0;t<n;t++){if(BANDF[t]){if(!(S.keepHard&&S.keepHard[o+t])){S.label[o+t]=P;S.keep[o+t]=1;}}else if(S.label[o+t]===P&&!(bl2&&bl2[t])){S.label[o+t]=B;S.keep[o+t]=0;}}
        if(S.strokes)delete S.strokes[pi];}else BANDF=null;}
    (S.lineF=S.lineF||{})[pi]={P,B,ok:BANDF||(()=>{const a=new Uint8Array(n);for(let t=0;t<n;t++)if(DL(t)<=W/2+0.1)a[t]=1;return a;})(),bl:bl2};
    rep.push(S.parts[pi].name.replace(/^.*?_\d+_/,"")+" pth"+path.length+(onCord?" CORD":"")+" ext"+ext+" cut"+(cut?cut.filter(x=>x).length:0)+" L"+L.toFixed(1)+" W"+W.toFixed(2)+" "+cl+"->"+pa);}
  (window._spcDbg=window._spcDbg||{}).redraw=rep;}
/* blotches: on an arm or a leg, a small patch (under 2% of the piece) that lies wholly inside one other paint
   is a smear off the photo (skin on a boot, a dark spot on a glove): it takes the paint round it. Eyes and
   piping placed on purpose stay. */
function limbBlotches(active,hid){const rep=[];
  for(const pi of active){const nm=S.parts[pi].name;if(!/(^|[^a-z])(arm|thigh|calf|shin|leg|boot|glove|hand)([^a-z]|$)/i.test(nm)||/pin|peg/i.test(nm))continue;
    const o=S.offs[pi],n=S.parts[pi].m.f.length/3,nb=S.nb[pi],A=S.area;let tot=0;for(let t=0;t<n;t++)tot+=A[o+t];
    const seen=new Uint8Array(n);let nf=0;
    for(let s0=0;s0<n;s0++){if(seen[s0])continue;const L=S.label[o+s0];if(L<0)continue;const c=[s0];seen[s0]=1;let ar=0;const bd=new Map();
      for(let h=0;h<c.length;h++){const t=c[h];ar+=A[o+t];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;const M=S.label[o+u];if(M===L){if(!seen[u]){seen[u]=1;c.push(u);}}else bd.set(M,(bd.get(M)||0)+1);}}
      let M=-1,mv=0,bt=0;for(const [k,v] of bd){bt+=v;if(v>mv){mv=v;M=k;}}if(ar>0.12*tot||mv<0.85*bt||M<0)continue; /* (up to 12% of the piece, nearly all inside one paint) */if(c.some(t=>S.keep&&S.keep[o+t]))continue;
      for(const t of c)S.label[o+t]=M;nf+=c.length;}
    rep.push(nm.replace(/^.*?_\d+_/,"")+" "+nf);}
  (window._spcDbg=window._spcDbg||{}).blotch=rep;}
/* color lines drawn clean: each edge between two paints is smoothed as a curve. Every face near the edge gets
   its signed distance from it (+ on one paint, - on the other); that field is relaxed (each face moves toward
   the average of its neighbours) and the edge redrawn where it crosses zero, moving no face more than 0.8 mm.
   Zigzags, notches and nicks along a line go; the line's course, set by the sculpt, stays. Eyes and piping
   placed on purpose don't move. */
function smoothLines(active,hid,opt){opt=opt||{};const rep=[];const BAND=opt.band||+(window._spcLineBand||0.8),IT=opt.it||+(window._spcLineIt||40);const KEEP=opt.soft?S.keepHard:S.keep;
  for(const pi of active){const p=S.parts[pi],o=S.offs[pi],n=p.m.f.length/3,nb=S.nb[pi],g=pieceGeo(pi,null);
    const pairs=new Map();for(let t=0;t<n;t++){const a=S.label[o+t];if(a<0)continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<=t)continue;const b=S.label[o+u];if(b<0||b===a)continue;const k=Math.min(a,b)*4096+Math.max(a,b);pairs.set(k,(pairs.get(k)||0)+1);}}
    let mv=0;const dist=new Float32Array(n),phi=new Float32Array(n),phi0=new Float32Array(n),tmp=new Float32Array(n),inb=new Uint8Array(n);
    const dc=(t,u)=>Math.hypot(g.c[t*3]-g.c[u*3],g.c[t*3+1]-g.c[u*3+1],g.c[t*3+2]-g.c[u*3+2]);
    for(const [k,cnt] of pairs){if(cnt<20)continue;const a=Math.floor(k/4096),b=k%4096,isAB=t=>{const l=S.label[o+t];return l===a||l===b;};
      const R3=BAND*3;dist.fill(Infinity);inb.fill(0);let q=[];
      for(let t=0;t<n;t++){if(!isAB(t))continue;const l=S.label[o+t];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&isAB(u)&&S.label[o+u]!==l){dist[t]=0;q.push(t);break;}}}
      /* distances out to 3x the band (a few relaxation sweeps) */
      for(let sweep=0;sweep<200&&q.length;sweep++){const nx=[];for(const t of q){for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||!isAB(u))continue;const d=dist[t]+dc(t,u);if(d<dist[u]&&d<R3){dist[u]=d;nx.push(u);}}}q=nx;}
      const band=[];for(let t=0;t<n;t++)if(isAB(t)&&dist[t]<R3){inb[t]=1;band.push(t);}
      if(!band.length)continue;
      for(const t of band){phi0[t]=phi[t]=(S.label[o+t]===a?1:-1)*dist[t];}
      const fixedF=t=>!inb[t]||(KEEP&&KEEP[o+t]);
      const val=u=>inb[u]?phi[u]:(S.label[o+u]===a?R3:S.label[o+u]===b?-R3:null);
      for(let it=0;it<IT;it++){for(const t of band){if(fixedF(t)){tmp[t]=phi[t];continue;}let s2=0,k2=0;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;const v=val(u);if(v===null)continue;s2+=v;k2++;}tmp[t]=k2?0.5*phi[t]+0.5*s2/k2:phi[t];}
        for(const t of band)phi[t]=tmp[t];}
      for(const t of band){if(fixedF(t)||Math.abs(phi0[t])>=BAND)continue;const want=phi[t]>0?a:b;if(S.label[o+t]!==want){S.label[o+t]=want;mv++;}}}
    rep.push(p.name.replace(/^.*?_\d+_/,"")+" "+mv);}
  (window._spcDbg=window._spcDbg||{})[opt.soft?'lines2':'lines']=rep;}
/* glove and boot tops sit on the sculpted cuff: on an arm or a leg whose lowest part (hand, foot) wears a second
   paint, the edge of that paint is set on one plane fitted through the edge itself (its average line), and the
   edge snap after it settles that line onto the sculpted rim. Below the plane is the glove or boot, above it the sleeve; ragged
   flames either way go. Piping placed on purpose stays. */
function cuffLine(active,regM,hid){const rep=[];
  for(const pi of active){const nm=S.parts[pi].name;if(!/(^|[^a-z])(arm|calf|shin|leg|boot)([^a-z]|$)/i.test(nm)||/pin|peg|thigh/i.test(nm))continue;
    const p=S.parts[pi],g=pieceGeo(pi,regM),o=S.offs[pi],n=g.n,nb=S.nb[pi],A=S.area;
    let zmin=Infinity,tmin=-1;for(let t=0;t<n;t++)if(!hid[o+t]&&g.c[t*3+2]<zmin){zmin=g.c[t*3+2];tmin=t;}if(tmin<0)continue;
    const P=S.label[o+tmin];if(P<0)continue;
    /* the paint above it: the most common other paint touching P */
    const bm=new Map();for(let t=0;t<n;t++){if(S.label[o+t]!==P)continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;const l=S.label[o+u];if(l>=0&&l!==P)bm.set(l,(bm.get(l)||0)+1);}}
    let M=-1,mv=0;for(const [k,v] of bm)if(v>mv){mv=v;M=k;}if(M<0)continue;
    /* edge height: median z of the P|M edge */
    const ez=[];for(let t=0;t<n;t++){if(S.label[o+t]!==P||(S.keep&&S.keep[o+t]))continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&S.label[o+u]===M&&!(S.keep&&S.keep[o+u])){ez.push(g.c[t*3+2]);break;}}} /* (not the piping's edges)*/
    if(ez.length<20)continue;ez.sort((a,b)=>a-b);const zm=ez[ez.length>>1];
    /* the edge faces themselves; a plane through them (refit on the closest part) is the average edge line */
    let pts=[];for(let t=0;t<n;t++){if(S.label[o+t]!==P&&S.label[o+t]!==M)continue;if(S.keep&&S.keep[o+t])continue;let on=false;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&!(S.keep&&S.keep[o+u])&&S.label[o+u]!==S.label[o+t]&&(S.label[o+u]===P||S.label[o+u]===M)){on=true;break;}}if(on&&Math.abs(g.c[t*3+2]-zm)<5)pts.push(t);}
    if(pts.length<30){let kp=0,tp=0,on1=0,on2=0;for(let t=0;t<n;t++){if(S.label[o+t]===P)tp++;if(S.keep&&S.keep[o+t])kp++;if(S.label[o+t]!==P&&S.label[o+t]!==M)continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&S.label[o+u]!==S.label[o+t]&&(S.label[o+u]===P||S.label[o+u]===M)){on1++;if(S.keep[o+t]||S.keep[o+u])on2++;break;}}}tp+=" on"+on1+" kon"+on2;rep.push(nm.replace(/^.*?_\d+_/,"")+" no edge "+pts.length+" ez"+ez.length+" zm"+zm.toFixed(1)+" P"+P+" M"+M+" tp"+tp+" kp"+kp);continue;}
    /* a plane through them by total least squares (any tilt: a forearm's glove top leans with the arm), refit on
       the closest 60%, faced so the hand or foot is below it */
    const fit=ts=>{const m3=[0,0,0];for(const t of ts)for(let i=0;i<3;i++)m3[i]+=g.c[t*3+i]/ts.length;const cv=[0,0,0,0,0,0];
      for(const t of ts){const x=g.c[t*3]-m3[0],y=g.c[t*3+1]-m3[1],z=g.c[t*3+2]-m3[2];cv[0]+=x*x;cv[1]+=x*y;cv[2]+=x*z;cv[3]+=y*y;cv[4]+=y*z;cv[5]+=z*z;}
      const tr=cv[0]+cv[3]+cv[5];/* smallest eigenvector = largest of (tr*I - cov) */let e=[0.1,0.2,1];
      for(let it=0;it<60;it++){const w=[(tr-cv[0])*e[0]-cv[1]*e[1]-cv[2]*e[2],-cv[1]*e[0]+(tr-cv[3])*e[1]-cv[4]*e[2],-cv[2]*e[0]-cv[4]*e[1]+(tr-cv[5])*e[2]],mm=Math.hypot(...w)||1;e=w.map(x=>x/mm);}
      let d=e[0]*m3[0]+e[1]*m3[1]+e[2]*m3[2];const hm=e[0]*g.c[tmin*3]+e[1]*g.c[tmin*3+1]+e[2]*g.c[tmin*3+2]-d;if(hm>0){e=e.map(x=>-x);d=-d;}return {e,d};};
    const H=(pl,t)=>pl.e[0]*g.c[t*3]+pl.e[1]*g.c[t*3+1]+pl.e[2]*g.c[t*3+2]-pl.d;
    let pl=fit(pts);for(let it=0;it<3;it++){const r=pts.map(t=>[Math.abs(H(pl,t)),t]).sort((a,b)=>a[0]-b[0]);pts=r.slice(0,Math.max(30,Math.floor(r.length*0.6))).map(x=>x[1]);pl=fit(pts);}
    /* then onto the sculpted rim itself: slide the plane (2 mm at most) to where the most crease faces lie on it */
    {const bend=surfaceShape(p,nb,C.faceNormals(p.m,p.M),C.xf(p.M,p.m.v)).bend;let best=0,bv=-1;
     for(let dlt=-2;dlt<=2.001;dlt+=0.05){let sc=0;for(let t=0;t<n;t++){if(hid[o+t]||bend[t]<0.08)continue;if(Math.abs(H(pl,t)-dlt)<0.12)sc+=A[o+t];}if(sc>bv){bv=sc;best=dlt;}}
     pl.d+=best;rep.push(nm.replace(/^.*?_\d+_/,"")+" rim shift "+best.toFixed(2));}
    /* below the rim is all glove or boot (a shadow on the back of a boot is no patch); remember which faces those are */
    {const bl=new Uint8Array(n);/* only the glove or boot itself: below the plane AND joined to the hand or foot (a tilted plane runs on through the shoulder cap) */let zmx=-Infinity;for(let t=0;t<n;t++)zmx=Math.max(zmx,g.c[t*3+2]);const zcap=zmin+(/(calf|shin)/i.test(nm)?0.72:/arm/i.test(nm)?0.5:0.45)*(zmx-zmin);/* (a calf piece is mostly boot: its top sits about two thirds up, under the knee)*//* (and in the lower part of the limb: a glove or boot is at its end) */bl[tmin]=1;const q5=[tmin];for(let h5=0;h5<q5.length;h5++){const t=q5[h5];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&!bl[u]&&H(pl,u)<0.4&&g.c[u*3+2]<zcap){bl[u]=1;q5.push(u);}}}
     for(let t=0;t<n;t++){if(!bl[t])continue;const h=H(pl,t);if(h<-3&&!(S.keep&&S.keep[o+t])&&S.label[o+t]>=0)S.label[o+t]=P;}(S.below=S.below||{})[pi]=bl;(S.belowP=S.belowP||{})[pi]=P;}
    let ch=0;for(let t=0;t<n;t++){const l=S.label[o+t];if(l!==P&&l!==M)continue;if(S.keep&&S.keep[o+t])continue;const h=H(pl,t);if(Math.abs(h)>3)continue;if(h<0.4&&!S.below[pi][t])continue;
      const want=h<0?P:M;if(l!==want){S.label[o+t]=want;ch++;}if(Math.abs(h)>0.5){S.keep=S.keep||new Uint8Array(S.nFaces);S.keep[o+t]=1;}} /* settled: only the edge's own 0.5 mm is left to the snap */
    rep.push(nm.replace(/^.*?_\d+_/,"")+" rim ch"+ch);}
  (window._spcDbg=window._spcDbg||{}).cuff=rep;}
/* every color edge onto the sculpt, last: for each pair of paints that meet on a piece, the faces within a few
   rings of their edge are re-decided by a minimum cut in which cutting across a sculpted crease (the flank of
   a raised cord, the step of a panel) is cheap and cutting across smooth surface is dear. Each face is pulled a
   little toward its paint now and toward what the photo shows. That puts ragged edges onto the sculpt's own
   lines: the inside and outside of piping, a hairline, a cuff. Eyes and piping placed on purpose stay. */
function edgeSnap(active,hid,L){const rep=[];const pl=S.regions.map(r=>C.lab(...r.rgb)),RK=+(window._spcSnapRings||8);
  for(const pi of active){const p=S.parts[pi],o=S.offs[pi],n=p.m.f.length/3,nb=S.nb[pi],A=S.area;
    const bend=surfaceShape(p,nb,C.faceNormals(p.m,p.M),C.xf(p.M,p.m.v)).bend;
    const pairs=new Map();for(let t=0;t<n;t++){const a=S.label[o+t];if(a<0)continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<=t)continue;const b=S.label[o+u];if(b<0||b===a)continue;const k=Math.min(a,b)*4096+Math.max(a,b);pairs.set(k,(pairs.get(k)||0)+1);}}
    let mvT=0;
    for(const [k,cnt] of pairs){if(cnt<20)continue;const a=Math.floor(k/4096),b=k%4096,isAB=t=>{const l=S.label[o+t];return l===a||l===b;};
      const ring=new Int16Array(n).fill(-1),q=[];
      for(let t=0;t<n;t++){if(!isAB(t))continue;const l=S.label[o+t];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&isAB(u)&&S.label[o+u]!==l){ring[t]=0;q.push(t);break;}}}
      for(let h=0;h<q.length;h++){const t=q[h];if(ring[t]>=RK)continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&ring[u]<0&&isAB(u)){ring[u]=ring[t]+1;q.push(u);}}}
      const idx=new Int32Array(n).fill(-1);q.forEach((t,i)=>idx[t]=i);const N=q.length;if(!N)continue;
      const sc=new Float64Array(N),tc=new Float64Array(N),eu=[],ev=[],ew=[];
      for(let i=0;i<N;i++){const t=q[i],f=o+t,isA=S.label[f]===a;
        if(ring[t]>=RK||(S.keep&&S.keep[f])){if(isA)sc[i]=1e9;else tc[i]=1e9;continue;}
        let pull=isA?0.1:-0.1;if(!hid[f]){const da=Math.hypot(L[f*3]-pl[a][0],L[f*3+1]-pl[a][1],L[f*3+2]-pl[a][2]),db=Math.hypot(L[f*3]-pl[b][0],L[f*3+1]-pl[b][1],L[f*3+2]-pl[b][2]);pull+=0.2*Math.max(-1,Math.min(1,(db-da)/30));}
        if(pull>0)sc[i]=pull*A[f];else tc[i]=-pull*A[f];}
      for(let i=0;i<N;i++){const t=q[i];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<=t||idx[u]<0)continue;const bb=Math.max(bend[t],bend[u]);eu.push(i);ev.push(idx[u]);ew.push(Math.sqrt((A[o+t]+A[o+u])/2)*0.08/(1+(bb/0.03)**2));}}
      const side=minCut(N,sc,tc,eu,ev,ew);
      for(let i=0;i<N;i++){const t=q[i],want=side[i]?a:b;if(S.label[o+t]!==want){S.label[o+t]=want;mvT++;}}}
    rep.push(p.name.replace(/^.*?_\d+_/,"")+" "+mvT);}
  (window._spcDbg=window._spcDbg||{}).edgeSnap=rep;}
/* piping that is sculpted: a raised cord. Where the sculpt has one, the cord itself is the stripe, so the paint
   lands exactly on it, as wide as it is and as far as it runs (to the top of the arm, over the shoulder),
   whatever the photo smeared around it. A cord is a long, thin run of faces standing proud of the surface
   0.5 mm round them, measured against the surface 2 mm round them (so the limb's own curve doesn't count). Its
   paint is the colored paint the photo shows on or beside it. Other small patches of that paint on a limb
   with a cord (smears off the photo) go back to the limb's paint. Pieces with no sculpted cord fall back to the photo stripes (limbPiping). */
function cordPiping(active,regM,hid,L){const rep=[];const pl=S.regions.map(r=>C.lab(...r.rgb)),R=pl.length;S._cordDone=new Set();const cand=new Map(),info=new Map();
  for(const pi of active){const nm=S.parts[pi].name;if(!/(^|[^a-z])(arm|thigh|calf|shin|leg|torso|chest|body)([^a-z]|$)/i.test(nm)||/pin|peg/i.test(nm))continue;
    const limb=!/(torso|chest|body)/i.test(nm);
    const g=pieceGeo(pi,null),o=S.offs[pi],n=g.n,nb=S.nb[pi],A=S.area;
    /* the limb's long axis */
    const ax=(()=>{let mx=0,my=0,mz=0;for(let t=0;t<n;t++){mx+=g.c[t*3];my+=g.c[t*3+1];mz+=g.c[t*3+2];}mx/=n;my/=n;mz/=n;const cv=[0,0,0,0,0,0];
      for(let t=0;t<n;t+=7){const x=g.c[t*3]-mx,y=g.c[t*3+1]-my,z=g.c[t*3+2]-mz;cv[0]+=x*x;cv[1]+=x*y;cv[2]+=x*z;cv[3]+=y*y;cv[4]+=y*z;cv[5]+=z*z;}
      let e=[0.3,0.5,1];for(let it=0;it<50;it++){const w=[cv[0]*e[0]+cv[1]*e[1]+cv[2]*e[2],cv[1]*e[0]+cv[3]*e[1]+cv[4]*e[2],cv[2]*e[0]+cv[4]*e[1]+cv[5]*e[2]],m=Math.hypot(...w)||1;e=w.map(x=>x/m);}return e;})();
    const gridOf=cell=>{const m=new Map(),K=(x,y,z)=>((x+512)*1024+(y+512))*1024+(z+512);for(let t=0;t<n;t++){const k=K(Math.floor(g.c[t*3]/cell),Math.floor(g.c[t*3+1]/cell),Math.floor(g.c[t*3+2]/cell));let b=m.get(k);if(!b){b=[];m.set(k,b);}b.push(t);}
      return (t,r,fn)=>{const x=g.c[t*3],y=g.c[t*3+1],z=g.c[t*3+2],cx=Math.floor(x/cell),cy=Math.floor(y/cell),cz=Math.floor(z/cell),r2=r*r;
        for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){const b=m.get(K(cx+i,cy+j,cz+k));if(!b)continue;for(const u of b){const dx=g.c[u*3]-x,dy=g.c[u*3+1]-y,dz=g.c[u*3+2]-z;if(dx*dx+dy*dy+dz*dz<=r2)fn(u);}}};};
    const nearA=gridOf(0.5),ras=new Float32Array(n);
    for(let t=0;t<n;t++){let sw=0,mx=0,my=0,mz=0;nearA(t,0.5,u=>{if(g.fn[u*3]*g.fn[t*3]+g.fn[u*3+1]*g.fn[t*3+1]+g.fn[u*3+2]*g.fn[t*3+2]<0.3)return;const w=A[o+u];sw+=w;mx+=g.c[u*3]*w;my+=g.c[u*3+1]*w;mz+=g.c[u*3+2]*w;});
      if(sw>0)ras[t]=(g.c[t*3]-mx/sw)*g.fn[t*3]+(g.c[t*3+1]-my/sw)*g.fn[t*3+1]+(g.c[t*3+2]-mz/sw)*g.fn[t*3+2];}
    const nearB=gridOf(2),rid=new Float32Array(n);
    for(let t=0;t<n;t++){let sw=0,sv=0;nearB(t,2,u=>{if(ras[u]>0.05)return;sw+=A[o+u];sv+=ras[u]*A[o+u];});rid[t]=ras[t]-(sw?sv/sw:0);}
    (S.rid=S.rid||{})[pi]=rid;
    const T=+(window._spcCordT||0.03),up=new Uint8Array(n);for(let t=0;t<n;t++)up[t]=!hid[o+t]&&rid[t]>T?1:0;
    /* what the photo shows on each face */
    const near=new Int32Array(n).fill(-1);
    for(let t=0;t<n;t++){const i=o+t;if(hid[i])continue;let b=-1,bd=Infinity;for(let r=0;r<R;r++){if(S.regions[r].hair)continue;const d=(L[i*3]-pl[r][0])**2+(L[i*3+1]-pl[r][1])**2+(L[i*3+2]-pl[r][2])**2;if(d<bd){bd=d;b=r;}}near[t]=b;}
    const seen=new Uint8Array(n),cords=[];
    for(let s0=0;s0<n;s0++){if(!up[s0]||seen[s0])continue;const c=[s0];seen[s0]=1;let ar=0;
      for(let h=0;h<c.length;h++){const t=c[h];ar+=A[o+t];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&up[u]&&!seen[u]){seen[u]=1;c.push(u);}}}
      if(ar<0.3)continue;
      let mx=0,my=0,mz=0;for(const t of c){mx+=g.c[t*3];my+=g.c[t*3+1];mz+=g.c[t*3+2];}mx/=c.length;my/=c.length;mz/=c.length;
      const cv=[0,0,0,0,0,0];for(const t of c){const dx=g.c[t*3]-mx,dy=g.c[t*3+1]-my,dz=g.c[t*3+2]-mz;cv[0]+=dx*dx;cv[1]+=dx*dy;cv[2]+=dx*dz;cv[3]+=dy*dy;cv[4]+=dy*dz;cv[5]+=dz*dz;}
      let d=[1,0.7,0.4];for(let it=0;it<40;it++){const e=[cv[0]*d[0]+cv[1]*d[1]+cv[2]*d[2],cv[1]*d[0]+cv[3]*d[1]+cv[4]*d[2],cv[2]*d[0]+cv[4]*d[1]+cv[5]*d[2]],m=Math.hypot(...e)||1;d=e.map(x=>x/m);}
      let lo=Infinity,hi=-Infinity;for(const t of c){const p=(g.c[t*3]-mx)*d[0]+(g.c[t*3+1]-my)*d[1]+(g.c[t*3+2]-mz)*d[2];lo=Math.min(lo,p);hi=Math.max(hi,p);}
      const len=hi-lo;if(len<4||ar/len>1.2)continue;
      /* the paint the photo shows within 2 mm of it (the photo may sit a millimetre off the cord), on faces still on
         the paint round it; and how much of that 2 mm is already another paint (a cord along a glove or boot rim) */
      const hood=new Set();for(const t of c)nearB(t,2,u=>{if(!hid[o+u])hood.add(u);});
      const cur=new Map();for(const t of hood){const l=S.label[o+t];cur.set(l,(cur.get(l)||0)+1);}
      let M=-1,mv=0;for(const [k,v] of cur)if(v>mv){mv=v;M=k;}
      const rim=1-mv/Math.max(1,hood.size);
      const votes=new Map();let nv=0;for(const t of hood){if(S.label[o+t]!==M)continue;nv++;const k=near[t];if(k>=0)votes.set(k,(votes.get(k)||0)+1);}
      let P=-1,pv=0;for(const [k,v] of votes){if(k===M||Math.hypot(pl[k][1],pl[k][2])<15||k===S.skinReg)continue;if(v>pv){pv=v;P=k;}}
      /* (and over the whole 2 mm, counting faces already on that paint: piping that is partly painted already) */
      let vAll=0;{const va=new Map();for(const t of hood){const k=S.label[o+t]!==M?S.label[o+t]:near[t];if(k>=0&&k!==M)va.set(k,(va.get(k)||0)+1);}
        let bk=-1,bv=0;for(const [k,v] of va){if(Math.hypot(pl[k][1],pl[k][2])<15||k===S.skinReg)continue;if(v>bv){bv=v;bk=k;}}vAll=bv/Math.max(1,hood.size);if(P<0||(bk!==P&&vAll>(nv?pv/nv:0)))P=bk;else if(bk!==P)vAll=0;}
      const gf=pieceGeo(pi,regM),pts=[];const st=Math.max(1,Math.floor(c.length/40));for(let i=0;i<c.length;i+=st){const t=c[i];pts.push([gf.c[t*3],gf.c[t*3+1],gf.c[t*3+2]]);}
      /* its direction: piping on a limb runs along the limb, not round it (a knee fold, a cuff) */
      const dz=Math.abs(d[0]*ax[0]+d[1]*ax[1]+d[2]*ax[2]);
      if(limb&&dz<0.6)continue;
      cords.push({c,P,M,v:nv?pv/nv:0,vAll,rim,len,pts,dir:(()=>{const q=pts,m3=[0,0,0];for(const a of q)for(let i=0;i<3;i++)m3[i]+=a[i]/q.length;const cv=[0,0,0,0,0,0];for(const a of q){const x=a[0]-m3[0],y=a[1]-m3[1],z=a[2]-m3[2];cv[0]+=x*x;cv[1]+=x*y;cv[2]+=x*z;cv[3]+=y*y;cv[4]+=y*z;cv[5]+=z*z;}let e=[0.3,0.4,1];for(let it=0;it<40;it++){const w=[cv[0]*e[0]+cv[1]*e[1]+cv[2]*e[2],cv[1]*e[0]+cv[3]*e[1]+cv[4]*e[2],cv[2]*e[0]+cv[4]*e[1]+cv[5]*e[2]],mm=Math.hypot(...w)||1;e=w.map(x=>x/mm);}return e;})(),ok:false,sc:0});}
    cand.set(pi,cords);info.set(pi,{nm,limb,n,o,nb,A,near});}
  /* left and right twins wear the same piping: a cord whose mirror image on the twin is also a cord adds the
     twin's photo evidence to its own (one side's photo often misses the stripe) */
  const side=pi=>/left/i.test(S.parts[pi].name)?"L":/right/i.test(S.parts[pi].name)?"R":"";
  const base=pi=>S.parts[pi].name.toLowerCase().replace(/^.*?_\d+_/,"").replace(/left|right/g,"#");
  const md=(P1,P2,fx)=>{let s=0;for(const p of P1){let b=Infinity;for(const q of P2){const d=(2*fx-p[0]-q[0])**2+(p[1]-q[1])**2+(p[2]-q[2])**2;if(d<b)b=d;}s+=Math.sqrt(b);}return s/P1.length;};
  const done=new Set();
  for(const [a,ca] of cand){if(done.has(a))continue;done.add(a);
    const b=[...cand.keys()].find(q=>q!==a&&!done.has(q)&&side(q)&&side(a)&&side(q)!==side(a)&&base(q)===base(a));
    if(b==null){for(const k of ca){k.ok=k.P>=0&&(k.v>=0.25||k.vAll>=0.2);k.sc=Math.max(k.v,k.vAll);}continue;} /* (no twin: the torso, where piping runs beside the star's own red) */done.add(b);const cb=cand.get(b);
    /* mirror plane: halfway between the two pieces on the figure */
    const cxOf=pi=>{const gq=pieceGeo(pi,regM);let x=0;for(let t=0;t<gq.n;t++)x+=gq.c[t*3];return x/gq.n;};const fx=(cxOf(a)+cxOf(b))/2;
    for(const k of ca){let best=null,bd=3;for(const q of cb){const d=md(k.pts,q.pts,fx);if(d<bd){bd=d;best=q;}}
      if(best){const P=k.v>=best.v?k.P:best.P,sc=k.v+best.v;if(P>=0&&k.rim<0.4&&best.rim<0.4&&sc>=0.2){k.ok=best.ok=true;k.P=best.P=P;k.sc=Math.max(k.sc,sc);best.sc=Math.max(best.sc,sc);}}
      else if(k.P>=0&&k.rim<0.4&&k.v>=0.25){k.ok=true;k.sc=k.v;}}
    for(const q of cb)if(!q.ok&&q.P>=0&&q.rim<0.4&&q.v>=0.25){q.ok=true;q.sc=q.v;}}
  /* on one piece, a seam the photos back much less than the best cord there (a back seam beside the side piping)
     is not piping (weighed by length, so a short scrap doesn't outvote the long cord) */
  for(const [pi,all] of cand){const okc=all.filter(k=>k.ok);if(!okc.length){(window._spcDbg=window._spcDbg||{}).cordCand=((window._spcDbg||{}).cordCand||[]).concat([S.parts[pi].name.replace(/^.*?_\d+_/,'')+'(none):'+all.map(k=>[k.len.toFixed(0),k.v.toFixed(2),k.rim.toFixed(2)].join('/')).join(' ')]);continue;}const w=k=>k.sc*Math.min(k.len,20),top=Math.max(...okc.map(w));for(const k of okc)if(w(k)<0.4*top)k.ok=false;
    /* piping on a limb is one line: keep the best cord and the cords that continue it (same direction, ends
       within 3 mm), not fold lines beside it at the elbow or knee */
    if(info.get(pi).limb){const live=okc.filter(k=>k.ok).sort((a,b)=>w(b)-w(a));if(live.length>1){const best=live[0],chain=[best];
      const near3=(a,b)=>{for(const p of a.pts)for(const q of b.pts)if((p[0]-q[0])**2+(p[1]-q[1])**2+(p[2]-q[2])**2<9)return true;return false;};
      let grew=true;while(grew){grew=false;for(const k of live){if(chain.includes(k))continue;const cs=Math.abs(k.dir[0]*best.dir[0]+k.dir[1]*best.dir[1]+k.dir[2]*best.dir[2]);if(cs<0.85)continue;if(chain.some(q=>near3(q,k))){chain.push(k);grew=true;}}}
      for(const k of live)if(!chain.includes(k))k.ok=false;}}
    (window._spcDbg=window._spcDbg||{}).cordCand=((window._spcDbg||{}).cordCand||[]).concat([S.parts[pi].name.replace(/^.*?_\d+_/,'')+':'+all.map(k=>[k.len.toFixed(0),k.v.toFixed(2),k.rim.toFixed(2),k.sc.toFixed(2),k.ok?1:0].join('/')).join(' ')]);}
  for(const [pi,all] of cand){const {nm,limb,n,o,nb,A}=info.get(pi);const cords=all.filter(k=>k.ok);
    if(!cords.length){rep.push(nm.replace(/^.*?_\d+_/,"")+" no cord");continue;}
    if(limb)S._cordDone.add(pi);S.keep=S.keep||new Uint8Array(S.nFaces); /* (the torso also gets the photo stripes: its shoulder piping is not always a cord) */
    const cordSet=new Uint8Array(n);for(const k of cords)for(const t of k.c)cordSet[t]=1;
    /* smears of the cord's paint near a cord on a limb (small patches, not a glove or a boot) go back */
    let cleared=0;if(limb){let tot=0;for(let t=0;t<n;t++)tot+=A[o+t];const Ps=new Set(cords.map(k=>k.P)),sn=new Uint8Array(n);
      for(let s0=0;s0<n;s0++){const P=S.label[o+s0];if(sn[s0]||!Ps.has(P)||cordSet[s0])continue;const c=[s0];sn[s0]=1;let ar=0;
        for(let h=0;h<c.length;h++){const t=c[h];ar+=A[o+t];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&!sn[u]&&S.label[o+u]===P){sn[u]=1;c.push(u);}}}
        if(ar>0.06*tot)continue;
        /* (any small patch of it on a limb that has a cord: the cord is where that paint goes) */
        /* back to the paint round it */
        const v=new Map();for(const t of c)for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;const l=S.label[o+u];if(l!==P&&l>=0)v.set(l,(v.get(l)||0)+1);}
        let b=-1,bv=0;for(const [k,x] of v)if(x>bv){bv=x;b=k;}if(b<0)continue;for(const t of c)if(!S.keep[o+t]){S.label[o+t]=b;cleared++;}}}
    /* paint the cords, and close them (a flat cord shows as two edge lines with its top between) */
    /* cords of one paint are closed together: the two edge lines of one flat cord fill in between */
    let painted=0;const byP=new Map();for(const k of cords){if(!byP.has(k.P))byP.set(k.P,{P:k.P,c:[]});byP.get(k.P).c.push(...k.c);}
    for(const k of byP.values()){const set=new Uint8Array(n);for(const t of k.c)set[t]=1;
      let fr=k.c.slice();for(let r=0;r<6;r++){const nx=[];for(const t of fr)for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&!set[u]&&!hid[o+u]){set[u]=2;nx.push(u);}}fr=nx;}
      /* erode the grown rim back one ring: keep grown faces held on 2+ sides */
      for(let it=0;it<6;it++){const drop=[];for(let t=0;t<n;t++){if(set[t]!==2)continue;let c2=0;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&set[u])c2++;}if(c2<3)drop.push(t);}for(const t of drop)set[t]=0;}
      /* never wider than the cord: closed-in faces more than 0.6 mm from a cord face drop out (where two cords part
         at an elbow, the gap between them is not piping) */
      {const gq=pieceGeo(pi,null),dd=new Float32Array(n).fill(Infinity);let fr2=k.c.slice();for(const t of fr2)dd[t]=0;
       for(let r=0;r<12&&fr2.length;r++){const nx=[];for(const t of fr2)for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||!set[u])continue;const d=dd[t]+Math.hypot(gq.c[t*3]-gq.c[u*3],gq.c[t*3+1]-gq.c[u*3+1],gq.c[t*3+2]-gq.c[u*3+2]);if(d<dd[u]){dd[u]=d;nx.push(u);}}fr2=nx;}
       for(let t=0;t<n;t++)if(set[t]&&dd[t]>0.6)set[t]=0;}
      S.pipeRegs=S.pipeRegs||new Set();S.pipeRegs.add(k.P);
      {const fs=[];for(let t=0;t<n;t++)if(set[t])fs.push(t);(S.stripes=S.stripes||[]).push({pi,P:k.P,faces:fs});}
      for(let t=0;t<n;t++)if(set[t]){S.label[o+t]=k.P;S.keep[o+t]=1;painted++;}}
    rep.push(nm.replace(/^.*?_\d+_/,"")+" cords"+cords.length+" f"+painted+" cleared"+cleared);}
  (window._spcDbg=window._spcDbg||{}).cords=rep;}
/* piping on the limbs: a thin stripe of a second paint running along an arm or leg (red piping on a black
   sleeve). Cleanup passes that tidy edges wear a stripe one or two faces wide away, so it is put back last,
   from the photos: faces now on the limb's main paint whose photo color is nearest another paint, in runs at
   least 6 mm long, trimmed to a 1.4 mm stripe down the run's middle. Specks, blotches and shine don't make long thin runs. */
function limbPiping(active,regM,hid,L){const rep=[];const pl=S.regions.map(r=>C.lab(...r.rgb)),R=pl.length;
  for(const pi of active){const nm=S.parts[pi].name;if(S._cordDone&&S._cordDone.has(pi))continue;if(!/(^|[^a-z])(arm|thigh|calf|shin|leg|torso|chest|body)([^a-z]|$)/i.test(nm)||/pin|peg/i.test(nm))continue; /* the torso too: piping over the shoulders */
    const g=pieceGeo(pi,null),o=S.offs[pi],n=g.n,nb=S.nb[pi],A=S.area;
    const near=new Int32Array(n).fill(-1);
    for(let t=0;t<n;t++){const i=o+t;if(hid[i])continue;let b=-1,bd=Infinity;for(let r=0;r<R;r++){if(S.regions[r].hair)continue;const d=(L[i*3]-pl[r][0])**2+(L[i*3+1]-pl[r][1])**2+(L[i*3+2]-pl[r][2])**2;if(d<bd){bd=d;b=r;}}near[t]=b;}
    const seen=new Uint8Array(n);let runs=0,painted=0;
    for(let s0=0;s0<n;s0++){const P=near[s0];if(seen[s0]||P<0||S.label[o+s0]===P)continue;const c=[s0];seen[s0]=1;let ar=0;
      for(let h=0;h<c.length;h++){const t=c[h];ar+=A[o+t];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&!seen[u]&&near[u]===P&&S.label[o+u]!==P){seen[u]=1;c.push(u);}}}
      if(ar<0.6||Math.hypot(pl[P][1],pl[P][2])<15||P===S.skinReg)continue; /* skin is never piping */ /* a stripe is a colored paint, not a gray or a shine */
      let mx=0,my=0,mz=0;for(const t of c){mx+=g.c[t*3];my+=g.c[t*3+1];mz+=g.c[t*3+2];}mx/=c.length;my/=c.length;mz/=c.length;
      const cv=[0,0,0,0,0,0];for(const t of c){const dx=g.c[t*3]-mx,dy=g.c[t*3+1]-my,dz=g.c[t*3+2]-mz;cv[0]+=dx*dx;cv[1]+=dx*dy;cv[2]+=dx*dz;cv[3]+=dy*dy;cv[4]+=dy*dz;cv[5]+=dz*dz;}
      let d=[1,0.7,0.4];for(let it=0;it<40;it++){const e=[cv[0]*d[0]+cv[1]*d[1]+cv[2]*d[2],cv[1]*d[0]+cv[3]*d[1]+cv[4]*d[2],cv[2]*d[0]+cv[4]*d[1]+cv[5]*d[2]],m=Math.hypot(...e)||1;d=e.map(x=>x/m);}
      let lo=Infinity,hi=-Infinity;for(const t of c){const p=(g.c[t*3]-mx)*d[0]+(g.c[t*3+1]-my)*d[1]+(g.c[t*3+2]-mz)*d[2];lo=Math.min(lo,p);hi=Math.max(hi,p);}
      const len=hi-lo;if(len<6||ar/len>3)continue;
      /* a stripe is about 1.4 mm wide: follow it millimetre by millimetre from its narrowest point, and keep
         the faces within 0.7 mm of its line (the photo may paint it wider, or smear a blob beside it) */
      {const nbin=Math.ceil(len)+1,bins=Array.from({length:nbin},()=>[]);const pos=t=>(g.c[t*3]-mx)*d[0]+(g.c[t*3+1]-my)*d[1]+(g.c[t*3+2]-mz)*d[2]-lo;
       for(const t of c)bins[Math.min(nbin-1,Math.floor(pos(t)))].push(t);
       const lat=(t,q)=>{const dx=g.c[t*3]-q[0],dy=g.c[t*3+1]-q[1],dz=g.c[t*3+2]-q[2],al=dx*d[0]+dy*d[1]+dz*d[2];return dx*dx+dy*dy+dz*dz-al*al;};
       const cen=ts=>{let x=0,y=0,z=0,w=0;for(const t of ts){const a=A[o+t];x+=g.c[t*3]*a;y+=g.c[t*3+1]*a;z+=g.c[t*3+2]*a;w+=a;}return w?[x/w,y/w,z/w]:null;};
       let k0=-1,sp0=Infinity;for(let k=0;k<nbin;k++){if(bins[k].length<3)continue;const q=cen(bins[k]);let sp=0;for(const t of bins[k])sp=Math.max(sp,lat(t,q));if(sp<sp0){sp0=sp;k0=k;}}
       const line=new Array(nbin).fill(null);if(k0>=0){line[k0]=cen(bins[k0]);
         for(const dir of [1,-1]){let prev=line[k0];for(let k=k0+dir;k>=0&&k<nbin;k+=dir){const near_=bins[k].filter(t=>lat(t,prev)<1.44);const q=near_.length?cen(near_):null;if(q){line[k]=q;prev=q;}}}}
       const kept=c.filter(t=>{const k=Math.min(nbin-1,Math.floor(pos(t)));return line[k]&&lat(t,line[k])<0.49;});
       c.length=0;for(const t of kept)c.push(t);}
      if(!c.length)continue;
      S.keep=S.keep||new Uint8Array(S.nFaces);for(const t of c)S.label[o+t]=P;painted+=c.length;runs++;
      for(let it=0;it<2;it++){const add=[];for(const t of c)for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||S.label[o+u]===P||hid[o+u])continue;let c2=0;for(let k=0;k<3;k++){const v=nb[u*3+k];if(v>=0&&S.label[o+v]===P)c2++;}if(c2>=2)add.push(u);}for(const u of add){S.label[o+u]=P;c.push(u);}}for(const t of c)S.keep[o+t]=1;}
    rep.push(nm.replace(/^.*?_\d+_/,"")+" runs"+runs+" f"+painted);}
  (window._spcDbg=window._spcDbg||{}).piping=rep;}
/* the head: hair is one paint and the eyes are white.
   Hair is the paint on the crown. Everything joined to the crown that isn't the face's skin is hair (shine on
   dark hair reads gray or black in photos), and small specks of skin lying in the hair are hair too. The hair
   gets its own paint, measured from the photos over the whole hair, so it never shares a paint with a black suit.
   Eyes: light, low-color spots on the face (the eye whites) are white; dark spots inside them (pupils, on
   figures that have them) stay dark. */
function headFix(active,regM,hid,L){const rep=[];
  const chroma=i=>Math.hypot(L[i*3+1],L[i*3+2]);
  for(const pi of active){if(!/(^|[^a-z])head([^a-z]|$)/i.test(S.parts[pi].name))continue;
    const g=pieceGeo(pi,regM),o=S.offs[pi],n=g.n,nb=S.nb[pi],A=S.area;
    let z0=Infinity,z1=-Infinity,vis=0;for(let t=0;t<n;t++){if(hid[o+t])continue;const z=g.c[t*3+2];z0=Math.min(z0,z);z1=Math.max(z1,z);vis+=A[o+t];}
    if(!isFinite(z0))continue;const H_=z1-z0;
    const most=(pred)=>{const m=new Map();for(let t=0;t<n;t++)if(!hid[o+t]&&pred(t))m.set(S.label[o+t],(m.get(S.label[o+t])||0)+A[o+t]);let b=-1,bv=0;for(const [k,v] of m)if(v>bv){bv=v;b=k;}return b;};
    const H=most(t=>g.c[t*3+2]>z1-0.08*H_);
    /* skin: the warm, light paint with most area in the lower half of the head */
    const F=most(t=>g.c[t*3+2]<z0+0.5*H_&&S.label[o+t]!==H&&L[(o+t)*3]>45&&chroma(o+t)>8);
    if(H<0||F<0||H===F){rep.push(S.parts[pi].name+" no hair/skin");continue;}
    S.skinReg=F;
    /* the face takes the face filament when one is on the shelf */
    {const j=C.PAL.findIndex(f=>f.skin&&f.owned!==false);if(j>=0&&S.regions[F]){S.regions[F].fil=j;S.regions[F].skin=true;rep.push('skin -> '+C.fname(C.PAL[j]));}}
    /* hair: joined to the crown, not skin */
    const hair=new Uint8Array(n),q=[];for(let t=0;t<n;t++)if(!hid[o+t]&&g.c[t*3+2]>z1-0.08*H_&&S.label[o+t]===H){hair[t]=1;q.push(t);}
    for(let h=0;h<q.length;h++){const t=q[h];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||hair[u]||S.label[o+u]===F)continue;hair[u]=1;q.push(u);}}
    /* skin specks in the hair: every skin patch but the face itself that lies mostly against hair */
    {const seen=new Uint8Array(n),comps=[];
     for(let s0=0;s0<n;s0++){if(seen[s0]||S.label[o+s0]!==F)continue;const c=[s0];seen[s0]=1;let ar=0,bh=0,bt=0;
       for(let h=0;h<c.length;h++){const t=c[h];ar+=A[o+t];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;if(S.label[o+u]===F){if(!seen[u]){seen[u]=1;c.push(u);}}else{bt++;if(hair[u])bh++;}}}
       comps.push({c,ar,bh,bt});}
     comps.sort((a,b)=>b.ar-a.ar);let sk=0;
     for(const cp of comps.slice(1))if(cp.ar<0.04*vis&&cp.bh>=0.6*cp.bt){for(const t of cp.c)hair[t]=1;sk++;}
     rep.push("skinSpecks"+sk);}
    /* skin round the edge of the face that is really hair: from the hair, take in skin faces that the photo
       shows nearer the hair's color than the skin's, or that no photo sees (the inside of the hair) */
    {let hl=[0,0,0],hw=0;for(let t=0;t<n;t++){const i=o+t;if(!hair[t]||hid[i])continue;const a=A[i];hl[0]+=L[i*3]*a;hl[1]+=L[i*3+1]*a;hl[2]+=L[i*3+2]*a;hw+=a;}
     if(hw>0){hl=hl.map(x=>x/hw);const sl=C.lab(...S.regions[F].rgb),q2=[];for(let t=0;t<n;t++)if(hair[t])q2.push(t);let ne=0;
       const d2=(i,c)=>(L[i*3]-c[0])**2+(L[i*3+1]-c[1])**2+(L[i*3+2]-c[2])**2;
       for(let h=0;h<q2.length;h++){const t=q2[h];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||hair[u]||S.label[o+u]!==F)continue;const i=o+u;
         if(hid[i]||d2(i,hl)<d2(i,sl)){hair[u]=1;q2.push(u);ne++;}}}
       rep.push("edge"+ne);}}
    /* under the jaw is skin: nothing below the chin and inside the neck's reach is hair (the hair hangs
       further out). Hidden faces there were only reached through the inside of the hair */
    {const fz=[];let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
     for(let t=0;t<n;t++){if(hid[o+t])continue;x0=Math.min(x0,g.c[t*3]);x1=Math.max(x1,g.c[t*3]);y0=Math.min(y0,g.c[t*3+1]);y1=Math.max(y1,g.c[t*3+1]);if(S.label[o+t]===F&&!hair[t])fz.push(g.c[t*3+2]);}
     const gfn=g.fn;if(fz.length>50){fz.sort((a,b)=>a-b);const chin=fz[Math.floor(fz.length*0.01)]+0.3,cx=(x0+x1)/2,cy=(y0+y1)/2,rN=0.3*Math.max(x1-x0,y1-y0);let nj=0;
       for(let t=0;t<n;t++){if(!hair[t]||g.c[t*3+2]>chin)continue;if(!hid[o+t]&&gfn[t*3+2]>-0.35)continue; /* the jaw's underside faces down; the inside of the hanging hair faces sideways and stays hair */if(Math.hypot(g.c[t*3]-cx,g.c[t*3+1]-cy)<rN){hair[t]=0;if(S.label[o+t]!==F&&(hid[o+t]||S.label[o+t]===H))S.label[o+t]=F;nj++;}}
       /* and the jaw's underside joined to the face: from the face skin, take in downward faces below the chin */
       {const q4=[];for(let t=0;t<n;t++)if(!hair[t]&&S.label[o+t]===F)q4.push(t);let nj2=0;
        for(let h=0;h<q4.length;h++){const t=q4[h];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||!hair[u])continue;if(g.c[u*3+2]>chin+0.5||gfn[u*3+2]>-0.35||Math.hypot(g.c[u*3]-cx,g.c[u*3+1]-cy)>rN*1.3)continue;hair[u]=0;S.label[o+u]=F;q4.push(u);nj2++;}}
        nj+=nj2;}
       rep.push("jaw"+nj);}}
    /* the hairline sits on the sculpt: near the hair/skin edge, the edge is moved onto the sculpted step (a
       minimum cut where cutting across a crease is cheap), so it doesn't zigzag across the face */
    {const sh=surfaceShape(S.parts[pi],nb,C.faceNormals(S.parts[pi].m,S.parts[pi].M),C.xf(S.parts[pi].M,S.parts[pi].m.v)).bend;
     const isHS=t=>hair[t]||S.label[o+t]===F;const ring=new Int16Array(n).fill(-1),q3=[];
     for(let t=0;t<n;t++){if(!isHS(t))continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&isHS(u)&&hair[u]!==hair[t]){ring[t]=0;q3.push(t);break;}}}
     const RK=+(window._spcHairRings||10);
     for(let h=0;h<q3.length;h++){const t=q3[h];if(ring[t]>=RK)continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&ring[u]<0&&isHS(u)){ring[u]=ring[t]+1;q3.push(u);}}}
     const idx=new Int32Array(n).fill(-1),nodes=[];for(const t of q3){idx[t]=nodes.length;nodes.push(t);}
     if(nodes.length){const N=nodes.length,sc=new Float64Array(N),tc=new Float64Array(N),eu=[],ev=[],ew=[];
       const hl0=C.lab(...S.regions[H].rgb),sl0=C.lab(...S.regions[F].rgb),dd=(i,c)=>Math.hypot(L[i*3]-c[0],L[i*3+1]-c[1],L[i*3+2]-c[2]);
       for(let k=0;k<N;k++){const t=nodes[k],i=o+t;
         if(ring[t]>=RK){if(hair[t])sc[k]=1e9;else tc[k]=1e9;continue;}
         /* source = hair. A light pull toward where it is now, and toward what the photo shows */
         let pull=hair[t]?0.15:-0.15;if(!hid[i]){const x=Math.max(-1,Math.min(1,(dd(i,sl0)-dd(i,hl0))/30));pull+=0.35*x;}
         if(pull>0)sc[k]=pull*A[i];else tc[k]=-pull*A[i];}
       for(let k=0;k<N;k++){const t=nodes[k];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<=t||idx[u]<0)continue;
         const b=Math.max(sh[t],sh[u]);eu.push(k);ev.push(idx[u]);ew.push(Math.sqrt((A[o+t]+A[o+u])/2)*0.08/(1+(b/0.03)**2));}}
       const side=minCut(N,sc,tc,eu,ev,ew);let mv=0;
       for(let k=0;k<N;k++){const t=nodes[k],hnew=side[k]?1:0;if(hnew!==hair[t]){hair[t]=hnew;if(!hnew)S.label[o+t]=F;mv++;}}
       rep.push("hairline"+mv+"/"+N);}}
    /* the face is one piece of skin: every other skin patch on the head (a fleck at the hairline, the inside of
       the hair) is hair, and any third paint left on the head (black specks from the suit) goes to the paint
       round it */
    {const seen=new Uint8Array(n),comps=[];
     for(let s0=0;s0<n;s0++){if(seen[s0]||hair[s0]||S.label[o+s0]!==F)continue;const c=[s0];seen[s0]=1;let ar=0;
       for(let h=0;h<c.length;h++){const t=c[h];ar+=A[o+t];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&!seen[u]&&!hair[u]&&S.label[o+u]===F){seen[u]=1;c.push(u);}}}comps.push({c,ar});}
     comps.sort((a,b)=>b.ar-a.ar);let nf=0;for(const cp of comps.slice(1)){let vis2=0;for(const t of cp.c)if(!hid[o+t])vis2+=A[o+t];if(vis2<0.03*vis||cp.ar<0.25*comps[0].ar){for(const t of cp.c)hair[t]=1;nf+=cp.c.length;}}
     let ns=0;for(let pass=0;pass<20;pass++){let ch=0;for(let t=0;t<n;t++){if(hair[t]||S.label[o+t]===F)continue;let vh=0,vf=0;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;if(hair[u])vh++;else if(S.label[o+u]===F)vf++;}
       if(vh>vf&&vh>0){hair[t]=1;ch++;}else if(vf>0){S.label[o+t]=F;ch++;}}ns+=ch;if(!ch)break;}
     /* and hair islands lying mostly in the skin (a patch under the jaw) are skin */
     {const sn=new Uint8Array(n);let ni=0;for(let s0=0;s0<n;s0++){if(!hair[s0]||sn[s0])continue;const c=[s0];sn[s0]=1;let ar=0,bs=0,bt=0;
        for(let h=0;h<c.length;h++){const t=c[h];ar+=A[o+t];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;if(hair[u]){if(!sn[u]){sn[u]=1;c.push(u);}}else{bt++;if(S.label[o+u]===F)bs++;}}}
        if(ar<0.03*vis&&bt&&bs>=0.6*bt){for(const t of c){hair[t]=0;S.label[o+t]=F;}ni+=c.length;}}
      rep.push("hairIslands"+ni);}
     rep.push("faceOnly"+nf+" specks"+ns);}
    /* the hair's own paint, from the photos */
    let r=0,gg=0,b=0,w=0,nh=0;for(let t=0;t<n;t++){if(!hair[t])continue;nh++;if(hid[o+t])continue;const a=A[o+t];r+=S.raw[(o+t)*3]*a;gg+=S.raw[(o+t)*3+1]*a;b+=S.raw[(o+t)*3+2]*a;w+=a;}
    if(w>0){const HR=S.regions.length;S.regions.push({id:HR,rgb:[r/w,gg/w,b/w],fil:-1,area:0,dE:0,patch:false,hair:true});
      for(let t=0;t<n;t++)if(hair[t])S.label[o+t]=HR;rep.push("hair "+C.rgb2hex([r/w,gg/w,b/w])+" "+(100*w/vis).toFixed(0)+"%");}
    /* eyes */
    let sL=0,sw=0;for(let t=0;t<n;t++)if(!hid[o+t]&&S.label[o+t]===F){sL+=L[(o+t)*3]*A[o+t];sw+=A[o+t];}const skinL=sw?sL/sw:70;
    const lite=new Uint8Array(n);for(let t=0;t<n;t++){const i=o+t;if(hid[i]||hair[t])continue;if(L[i*3]>Math.min(skinL-20,60)&&chroma(i)<10)lite[t]=1;} /* eye whites read gray in photos: colorless, not dark */
    const seen=new Uint8Array(n),eyes=[];
    for(let s0=0;s0<n;s0++){if(!lite[s0]||seen[s0])continue;const c=[s0];seen[s0]=1;let ar=0;
      for(let h=0;h<c.length;h++){const t=c[h];ar+=A[o+t];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&lite[u]&&!seen[u]){seen[u]=1;c.push(u);}}}
      if(ar>0.00012*vis&&ar<0.02*vis){let cx=0,cy=0,cz=0;for(const t of c){cx+=g.c[t*3];cy+=g.c[t*3+1];cz+=g.c[t*3+2];}eyes.push({c,ar,x:cx/c.length,y:cy/c.length,z:cz/c.length});}}
    /* eyes come in a pair at one height, in the face's upper half */
    const band=eyes.filter(e=>e.z>z0+0.3*H_&&e.z<z0+0.8*H_).sort((a,b)=>b.ar-a.ar);let pair=[];
    for(let i=0;i<band.length&&!pair.length;i++)for(let j=i+1;j<band.length;j++){const a=band[i],b=band[j],sep=Math.hypot(a.x-b.x,a.y-b.y);if(Math.abs(a.z-b.z)<0.08*H_&&sep>0.1*H_&&sep<0.45*H_){pair=[a,b];break;}}
    if(pair.length){let W=S.regions.findIndex(r=>{const l=C.lab(...r.rgb);return l[0]>85&&Math.hypot(l[1],l[2])<10&&!r.hair;});
      if(W<0){W=S.regions.length;S.regions.push({id:W,rgb:[0.96,0.96,0.96],fil:-1,area:0,dE:0,patch:false});}
      /* the sculpt's own detail round the eyes, at 0.5 mm: the eyeball bulges, the lid crease round it sinks, the
         brow ridge stands up. Each eye white is the eyeball out to its crease; each brow is the ridge above it */
      const sepE=Math.hypot(pair[0].x-pair[1].x,pair[0].y-pair[1].y),b05=new Float32Array(n).fill(NaN),near05=[];
      {const cell=0.5,grid=new Map(),K=(x,y,z)=>((x+2048)*4096+(y+2048))*4096+(z+2048);
       for(let t=0;t<n;t++){const k=K(Math.floor(g.c[t*3]/cell),Math.floor(g.c[t*3+1]/cell),Math.floor(g.c[t*3+2]/cell));let b=grid.get(k);if(!b){b=[];grid.set(k,b);}b.push(t);}
       for(let t=0;t<n;t++){if(hid[o+t]||hair[t])continue;let ok=false;for(const e of pair)if(Math.hypot(g.c[t*3]-e.x,g.c[t*3+1]-e.y,g.c[t*3+2]-e.z)<0.9*sepE)ok=true;if(!ok)continue;
         const x=g.c[t*3],y=g.c[t*3+1],z=g.c[t*3+2],cx=Math.floor(x/cell),cy=Math.floor(y/cell),cz=Math.floor(z/cell);let sw=0,mx=0,my=0,mz=0;
         for(let i2=-1;i2<=1;i2++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){const b=grid.get(K(cx+i2,cy+j,cz+k));if(!b)continue;for(const u of b){const dx=g.c[u*3]-x,dy=g.c[u*3+1]-y,dz=g.c[u*3+2]-z;if(dx*dx+dy*dy+dz*dz>0.25)continue;if(g.fn[u*3]*g.fn[t*3]+g.fn[u*3+1]*g.fn[t*3+1]+g.fn[u*3+2]*g.fn[t*3+2]<0.3)continue;const w=A[o+u];sw+=w;mx+=g.c[u*3]*w;my+=g.c[u*3+1]*w;mz+=g.c[u*3+2]*w;}}
         if(sw>0){b05[t]=(x-mx/sw)*g.fn[t*3]+(y-my/sw)*g.fn[t*3+1]+(z-mz/sw)*g.fn[t*3+2];near05.push(t);}}}
      let sd=0;for(const t of near05)sd+=b05[t]*b05[t];sd=Math.sqrt(sd/Math.max(1,near05.length))||0.01;
      for(const e of pair){let t0=-1,bd=-Infinity;for(const t of near05){const d=Math.hypot(g.c[t*3]-e.x,g.c[t*3+1]-e.y,g.c[t*3+2]-e.z);if(d<0.6&&g.c[t*3+2]<=e.z+0.1&&b05[t]>bd){bd=b05[t];t0=t;}}if(t0<0)continue; /* seed: the eyeball's crown near the photo's eye, never the brow above it */
        const seen=new Uint8Array(n),c=[t0];seen[t0]=1;let ar=0;
        for(let h=0;h<c.length;h++){const t=c[h];ar+=A[o+t];for(let k=0;k<3;k++){const u=nb[t*3+k];if(u<0||seen[u]||isNaN(b05[u])||b05[u]<-0.3*sd)continue;if(Math.hypot(g.c[u*3]-g.c[t0*3],g.c[u*3+1]-g.c[t0*3+1],g.c[u*3+2]-g.c[t0*3+2])>0.35*sepE)continue;seen[u]=1;c.push(u);}}
        let ea=0;for(const t of e.c)ea+=A[o+t];
        let cz2=0;for(const t of c)cz2+=g.c[t*3+2];cz2/=c.length;
        if(ar>0.4*ea&&ar<6*ea&&cz2<e.z+0.35){e.c=c;e.geo=true;}}
      let ne=0;S.keep=S.keep||new Uint8Array(S.nFaces);for(const e of pair){for(const t of e.c)S.label[o+t]=W;ne+=e.c.length;
        /* close the eye: skin faces held between eye faces join it */
        if(!e.geo)for(let it=0;it<2;it++){const add=[];for(const t of e.c)for(let k=0;k<3;k++){const u=nb[t*3+k];if(u<0||S.label[o+u]===W||hid[o+u]||hair[u])continue;const i=o+u;if(L[i*3]>skinL-35&&chroma(i)<16)add.push(u);}for(const u of add){S.label[o+u]=W;e.c.push(u);}}
        for(let it=0;it<2;it++){const add=[];for(const t of e.c)for(let k=0;k<3;k++){const u=nb[t*3+k];if(u<0||S.label[o+u]!==F)continue;let c2=0;for(let k2=0;k2<3;k2++){const v=nb[u*3+k2];if(v>=0&&S.label[o+v]===W)c2++;}if(c2>=2)add.push(u);}for(const u of add){S.label[o+u]=W;e.c.push(u);}}}
      /* pupils (figures that have them): dark spots lying mostly inside an eye white */
      {const blk=S.regions.findIndex(r=>{const l=C.lab(...r.rgb);return l[0]<25&&Math.hypot(l[1],l[2])<10;});let np_=0;
       if(blk>=0){const sn=new Uint8Array(n);for(let s0=0;s0<n;s0++){if(sn[s0]||hid[o+s0]||hair[s0]||S.label[o+s0]===W||L[(o+s0)*3]>35)continue;const c=[s0];sn[s0]=1;let bw=0,bt=0,ar=0;
         for(let h=0;h<c.length;h++){const t=c[h];ar+=A[o+t];for(let k=0;k<3;k++){const u=nb[t*3+k];if(u<0)continue;if(!sn[u]&&!hid[o+u]&&!hair[u]&&S.label[o+u]!==W&&L[(o+u)*3]<=35){sn[u]=1;c.push(u);}else if(!c.includes(u)){bt++;if(S.label[o+u]===W)bw++;}}}
         if(bt&&bw>=0.6*bt&&ar<0.01*vis){for(const t of c)S.label[o+t]=blk;np_++;}}}
       rep.push("pupils"+np_);}
      S.keepHard=S.keepHard||new Uint8Array(S.nFaces);for(const e of pair)for(const t of e.c){S.keep[o+t]=1;S.keepHard[o+t]=1;}
      rep.push("eyes"+pair.length+" faces"+ne);
      /* eyebrows: brown, the hair's paint */
      {const HRi=S.regions.findIndex(r=>r.hair);let nbw=0;
       if(HRi>=0){const brow=new Uint8Array(n);
         /* the brows sit on the sculpted brow ridge: above each eye, from just inside it to past its outer corner,
            on surface that stands well proud of the 0.5 mm round it (photos are too soft to show a brow) */
         const sep=Math.hypot(pair[0].x-pair[1].x,pair[0].y-pair[1].y),cand=[];
         for(let t=0;t<n;t++){const i=o+t;if(hid[i]||S.label[i]!==F)continue;const z=g.c[t*3+2];
           for(let ei=0;ei<2;ei++){const e=pair[ei],e2=pair[1-ei];let wx=e.x-e2.x,wy=e.y-e2.y;const wl=Math.hypot(wx,wy)||1;wx/=wl;wy/=wl;
             const rx=g.c[t*3]-e.x,ry=g.c[t*3+1]-e.y,al=rx*wx+ry*wy,dz=z-e.z,off=Math.abs(-rx*wy+ry*wx);
             if(dz>0.07*sep&&dz<0.7*sep&&al>-0.4*sep&&al<0.6*sep&&off<0.6*sep){cand.push(t);break;}}}
         {const cell=1.5,grid=new Map(),K=(x,y,z)=>((x+512)*1024+(y+512))*1024+(z+512);
          for(let t=0;t<n;t++){const k=K(Math.floor(g.c[t*3]/cell),Math.floor(g.c[t*3+1]/cell),Math.floor(g.c[t*3+2]/cell));let b=grid.get(k);if(!b){b=[];grid.set(k,b);}b.push(t);}
          for(const t of cand){const x=g.c[t*3],y=g.c[t*3+1],z=g.c[t*3+2],cx=Math.floor(x/cell),cy=Math.floor(y/cell),cz=Math.floor(z/cell);let sw=0,mx=0,my=0,mz=0;
            for(let i2=-1;i2<=1;i2++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){const b=grid.get(K(cx+i2,cy+j,cz+k));if(!b)continue;for(const u of b){const dx=g.c[u*3]-x,dy=g.c[u*3+1]-y,dz=g.c[u*3+2]-z;if(dx*dx+dy*dy+dz*dz>2.25)continue;if(g.fn[u*3]*g.fn[t*3]+g.fn[u*3+1]*g.fn[t*3+1]+g.fn[u*3+2]*g.fn[t*3+2]<0.3)continue;const w=A[o+u];sw+=w;mx+=g.c[u*3]*w;my+=g.c[u*3+1]*w;mz+=g.c[u*3+2]*w;}}
            if(!isNaN(b05[t])&&b05[t]>+(window._spcBrowS||1.2)*sd)brow[t]=1;}}
         const sb=new Uint8Array(n);
         for(let s0=0;s0<n;s0++){if(!brow[s0]||sb[s0])continue;const c=[s0];sb[s0]=1;let ar=0;
           for(let h=0;h<c.length;h++){const t=c[h];ar+=A[o+t];for(let k=0;k<3;k++){const u=nb[t*3+k];if(u>=0&&brow[u]&&!sb[u]){sb[u]=1;c.push(u);}}}
           if(ar<0.4)continue;S.keepHard=S.keepHard||new Uint8Array(S.nFaces);for(const t of c){S.label[o+t]=HRi;S.keep[o+t]=1;S.keepHard[o+t]=1;}nbw+=c.length;
           for(let it=0;it<2;it++){const add=[];for(const t of c)for(let k=0;k<3;k++){const u=nb[t*3+k];if(u<0||S.label[o+u]!==F)continue;let c2=0;for(let k2=0;k2<3;k2++){const v=nb[u*3+k2];if(v>=0&&S.label[o+v]===HRi)c2++;}if(c2>=2)add.push(u);}for(const u of add){S.label[o+u]=HRi;S.keep[o+u]=1;c.push(u);}}}}
       rep.push("brows"+nbw);}}else rep.push("eyes0 (cand "+eyes.length+")");}
  (window._spcDbg=window._spcDbg||{}).head=rep;}
/* shine on a black suit reads as a dark gray in photos. A dark, colorless paint that lies mostly against black
   and covers much less than the black is that shine: it goes black. A real gray (a gray suit) covers too much
   to be taken for shine. */
function shineToBlack(active){const rep=[];const pl=S.regions.map(r=>C.lab(...r.rgb)),R=S.regions.length;
  const ar=new Float64Array(R),bord=Array.from({length:R},()=>new Map());
  for(const pi of active){const o=S.offs[pi],n=S.parts[pi].m.f.length/3,nb=S.nb[pi];
    for(let t=0;t<n;t++){const a=S.label[o+t];if(a<0)continue;ar[a]+=S.area[o+t];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;const b=S.label[o+u];if(b>=0&&b!==a)bord[a].set(b,(bord[a].get(b)||0)+1);}}}
  const blk=pl.map((l,i)=>l[0]<22&&Math.hypot(l[1],l[2])<8&&ar[i]>0?i:-1).filter(i=>i>=0);if(!blk.length)return;
  const B=blk.sort((a,b)=>ar[b]-ar[a])[0];
  for(let x=0;x<R;x++){if(x===B||!ar[x]||S.regions[x].hair)continue;const l=pl[x];if(Math.hypot(l[1],l[2])>8||l[0]>62)continue;
    let top=-1,tv=0,tot=0;for(const [k,v] of bord[x]){tot+=v;if(v>tv){tv=v;top=k;}}
    if(ar[x]>0.4*ar[B])continue; /* (a dark gray anywhere on the figure, not just against the black) */
    for(const pi of active){const o=S.offs[pi],n=S.parts[pi].m.f.length/3;for(let t=0;t<n;t++)if(S.label[o+t]===x)S.label[o+t]=B;}
    rep.push(C.rgb2hex(S.regions[x].rgb)+"→black");}
  (window._spcDbg=window._spcDbg||{}).shine=rep;}
/* a gray patch that is only light on a darker paint (shine on gloss black, highlights in brown hair): most of its
   border is that one darker paint, so it takes it. A silver belt between red and black keeps its gray */
function grayShine(active){let n1=0;const pl=S.regions.map(r=>C.lab(...r.rgb)),gray=pl.map(l=>Math.hypot(l[1],l[2])<10&&l[0]>35&&l[0]<80);
  for(const pi of active){const o=S.offs[pi],n=S.parts[pi].m.f.length/3,nb=S.nb[pi],seen=new Uint8Array(n);
    for(let s0=0;s0<n;s0++){const L=S.label[o+s0];if(seen[s0]||L<0||!gray[L])continue;const q=[s0];seen[s0]=1;const bord=new Map();let nbd=0;
      for(let h=0;h<q.length;h++){const t=q[h];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;const M=S.label[o+u];if(M===L){if(!seen[u]){seen[u]=1;q.push(u);}}else{bord.set(M,(bord.get(M)||0)+1);nbd++;}}}
      let b=-1,bv=0;for(const [M,x] of bord)if(x>bv){bv=x;b=M;}
      if(b>=0&&bv>=0.6*nbd&&pl[b][0]<pl[L][0]){for(const t of q)S.label[o+t]=b;n1+=q.length;}}}
  (window._spcDbg=window._spcDbg||{}).grayShine=n1;}
/* gloves: piping (raised strips) running from the cuff band down the glove onto the back of the hand is the
   band's paint. Raised thin strips inside the glove paint that touch the band paint take it; fingers and knuckles,
   which never touch the band, stay glove. */
function gloveTrim(active,regM){const rep=[];
  for(const pi of active){if(!/(^|[^a-z])(arm|glove)([^a-z]|$)/i.test(S.parts[pi].name))continue; /* whole word: "Starman" holds "arm" */
    const g=pieceGeo(pi,null),gf=pieceGeo(pi,regM),o=S.offs[pi],n=g.n,nb=S.nb[pi],A=S.area;
    let z0=Infinity,z1=-Infinity;for(let t=0;t<n;t++){z0=Math.min(z0,gf.c[t*3+2]);z1=Math.max(z1,gf.c[t*3+2]);}
    const lo=new Map();for(let t=0;t<n;t++)if(gf.c[t*3+2]<z0+0.1*(z1-z0))lo.set(S.label[o+t],(lo.get(S.label[o+t])||0)+A[o+t]);
    let B=-1,bv=0;for(const [L,x] of lo)if(x>bv){bv=x;B=L;}if(B<0)continue;
    const ed=new Map();for(let t=0;t<n;t++){if(S.label[o+t]!==B)continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;const L=S.label[o+u];if(L!==B)ed.set(L,(ed.get(L)||0)+1);}}
    let G=-1,gv=0;for(const [L,x] of ed)if(x>gv){gv=x;G=L;}if(G<0)continue;
    /* only a narrow band (a cuff) between glove and sleeve carries piping; a sleeve straight onto the glove has none */
    {let ag=0,at=0;for(let t=0;t<n;t++){at+=A[o+t];if(S.label[o+t]===G)ag+=A[o+t];}if(ag>0.2*at)continue;}
    /* raise over 1.2 mm, on the glove only */
    const cell=1.2,grid=new Map(),K=(x,y,z)=>((x+512)*1024+(y+512))*1024+(z+512);
    for(let t=0;t<n;t++){if(S.label[o+t]!==B&&S.label[o+t]!==G)continue;const k=K(Math.floor(g.c[t*3]/cell),Math.floor(g.c[t*3+1]/cell),Math.floor(g.c[t*3+2]/cell));let b=grid.get(k);if(!b){b=[];grid.set(k,b);}b.push(t);}
    const ras=new Float32Array(n);
    for(let t=0;t<n;t++){if(S.label[o+t]!==B)continue;const x=g.c[t*3],y=g.c[t*3+1],z=g.c[t*3+2],cx=Math.floor(x/cell),cy=Math.floor(y/cell),cz=Math.floor(z/cell);let sw=0,mx=0,my=0,mz=0;
      for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){const b=grid.get(K(cx+i,cy+j,cz+k));if(!b)continue;
        for(const u of b){const dx=g.c[u*3]-x,dy=g.c[u*3+1]-y,dz=g.c[u*3+2]-z;if(dx*dx+dy*dy+dz*dz>1.44)continue;if(g.fn[u*3]*g.fn[t*3]+g.fn[u*3+1]*g.fn[t*3+1]+g.fn[u*3+2]*g.fn[t*3+2]<0.3)continue;
          const w=A[o+u];sw+=w;mx+=g.c[u*3]*w;my+=g.c[u*3+1]*w;mz+=g.c[u*3+2]*w;}}
      if(sw>0)ras[t]=(x-mx/sw)*g.fn[t*3]+(y-my/sw)*g.fn[t*3+1]+(z-mz/sw)*g.fn[t*3+2];}
    const raw=new Uint8Array(n);for(let t=0;t<n;t++)raw[t]=S.label[o+t]===B&&ras[t]>0.06?1:0;
    /* raised strips that touch the band (directly or through 0.6 mm of glove) */
    let ch=0,kept=0;
    /* passes: a prong that touches the piping's end joins once the piping is in */
    for(let pass=0;pass<4;pass++){const k0=kept;const seen=new Int32Array(n).fill(-1);
    for(let s0=0;s0<n;s0++){if(!raw[s0]||seen[s0]>=0||S.label[o+s0]!==B)continue;const q=[s0];seen[s0]=s0;let touch=false,ar=0;
      for(let h=0;h<q.length;h++){const t=q[h];ar+=A[o+t];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;if(S.label[o+u]===G)touch=true;
          if(raw[u]&&seen[u]<0&&S.label[o+u]===B){seen[u]=s0;q.push(u);}}}
      if(!touch||ar<0.3)continue;kept++;for(const t of q){S.label[o+t]=G;ch++;}}
    if(kept===k0)break;
    /* a glove face between the strip and more raised strip bridges the gap */
    {const add=[];for(let t=0;t<n;t++){if(S.label[o+t]!==B)continue;let gN=0,rN=0;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;if(S.label[o+u]===G)gN++;else if(raw[u])rN++;}if(gN&&rN)add.push(t);}
     for(const t of add){S.label[o+t]=G;ch++;}}}
    /* close the strip: glove faces held between strip faces join it; lone strip faces go back */
    for(let it=0;it<3;it++){const add=[];for(let t=0;t<n;t++){if(S.label[o+t]!==B)continue;let c2=0;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&S.label[o+u]===G)c2++;}if(c2>=2)add.push(t);}
      for(const t of add)S.label[o+t]=G;ch+=add.length;}
    rep.push(S.parts[pi].name.replace(/^.*?_\d+_/,"")+" strips"+kept+" ch"+ch);}
  (window._spcDbg=window._spcDbg||{}).glove=rep;}
/* left/right twins (arms, wings, gloves...) are mirror images: they must wear the same colors in the same
   places. The pair is lined up as a mirror (on the figure, or piece to piece about each centre); if most of
   the surface lines up, the cleaner one (fewer color-edge faces) is copied onto the other. Legs and pins have
   their own rules and are left out. Pieces posed differently don't line up and are left alone. */
function twinMatch(active,regM){const rep=[];
  const base=pi=>S.parts[pi].name.toLowerCase().replace(/\.stl$/,"").replace(/^.*?_\d+_/,"").replace(/left|right|\bl\b|\br\b/g,"#");
  const side=pi=>/left/i.test(S.parts[pi].name)?"L":/right/i.test(S.parts[pi].name)?"R":"";
  const skip=/thigh|calf|shin|leg|boot|foot|pin|peg/i;
  const done=new Set();
  for(const a of active){if(done.has(a)||!side(a)||skip.test(S.parts[a].name))continue;
    const b=active.find(q=>q!==a&&!done.has(q)&&side(q)&&side(q)!==side(a)&&base(q)===base(a));if(b==null)continue;done.add(a);done.add(b);
    const ga=pieceGeo(a,regM),gb=pieceGeo(b,regM),la=pieceGeo(a,null),lb=pieceGeo(b,null);
    const cen=g=>{let x=0,y=0,z=0;for(let i=0;i<g.n;i++){x+=g.c[i*3];y+=g.c[i*3+1];z+=g.c[i*3+2];}return [x/g.n,y/g.n,z/g.n];};
    /* candidate mirrors: on the figure across the pair's middle in x; piece to piece about each centre in x, y or z */
    const tries=[];{const ca=cen(ga),cb=cen(gb),xm=(ca[0]+cb[0])/2;tries.push({A:ga,B:gb,ax:0,ca:[xm,0,0],cb:[xm,0,0],fig:1});}
    {const ca=cen(la),cb=cen(lb);for(let ax=0;ax<3;ax++)tries.push({A:la,B:lb,ax,ca,cb});}
    let best=null;
    for(const t of tries){const G=C.grid(t.A.c,0.5),map=new Int32Array(t.B.n).fill(-1);let hit=0,tot=0;
      for(let i=0;i<t.B.n;i++){const p=[0,1,2].map(k=>t.B.c[i*3+k]-t.cb[k]);p[t.ax]=-p[t.ax];const q=[0,1,2].map(k=>p[k]+t.ca[k]);
        const nrm=[t.B.fn[i*3],t.B.fn[i*3+1],t.B.fn[i*3+2]];nrm[t.ax]=-nrm[t.ax];
        const [j,d]=G.near(q[0],q[1],q[2],3);const w=S.area[S.offs[b]+i];tot+=w;
        if(j>=0&&d<0.8&&nrm[0]*t.A.fn[j*3]+nrm[1]*t.A.fn[j*3+1]+nrm[2]*t.A.fn[j*3+2]>0.6){map[i]=j;hit+=w;}}
      const cov=hit/(tot||1);if(!best||cov>best.cov)best={cov,map,t};}
    const tag=S.parts[a].name.replace(/^.*?_\d+_/,"")+"/"+S.parts[b].name.replace(/^.*?_\d+_/,"");
    if(!best||best.cov<0.85){rep.push(tag+" skip "+(best?best.cov.toFixed(2):"-"));continue;}
    const edges=pi=>{const o=S.offs[pi],n=S.parts[pi].m.f.length/3,nb=S.nb[pi];let e=0;for(let t=0;t<n;t++)for(let k=0;k<3;k++){const u=nb[t*3+k];if(u>=0&&S.label[o+u]!==S.label[o+t]){e++;break;}}return e/n;};
    const oa=S.offs[a],ob=S.offs[b];let ch=0;
    if(edges(a)<=edges(b)){for(let i=0;i<best.map.length;i++){const j=best.map[i];if(j<0)continue;if(S.label[ob+i]!==S.label[oa+j]){S.label[ob+i]=S.label[oa+j];ch++;}}}
    else{/* b is cleaner: copy b onto a through the same pairs (each a face takes the b face that maps to it) */
      const back=new Int32Array(S.parts[a].m.f.length/3).fill(-1);for(let i=0;i<best.map.length;i++)if(best.map[i]>=0)back[best.map[i]]=i;
      for(let j=0;j<back.length;j++){const i=back[j];if(i<0)continue;if(S.label[oa+j]!==S.label[ob+i]){S.label[oa+j]=S.label[ob+i];ch++;}}}
    rep.push(tag+" cov"+best.cov.toFixed(2)+(best.t.fig?" fig":" ax"+best.t.ax)+" ch"+ch);}
  (window._spcDbg=window._spcDbg||{}).twinMatch=rep;}
/* pins sit inside a joint where nothing can see them, and a plain cylinder can't be placed on the
   figure. A pin (or any piece that is entirely hidden) takes the main color of the hidden joint faces
   of the pieces it joins: a left knee pin follows the left thigh and calf, an elbow pin the arm. */
function pinColors(active,hid,regM){
  const nameOf=pi=>S.parts[pi].name.toLowerCase();
  const isPin=pi=>{if(/pin|peg/.test(nameOf(pi)))return true;const o=S.offs[pi],n=S.parts[pi].m.f.length/3;
    for(let i=0;i<n;i++)if(!hid[o+i])return false;return true;};
  const pins=active.filter(isPin),others=active.filter(pi=>!pins.includes(pi)),tal=new Map();
  for(const pi of pins){const nm=nameOf(pi),side=/left/.test(nm)?"left":/right/.test(nm)?"right":"";
    const joint=/knee/.test(nm)?/calf|thigh|shin|knee/:/elbow/.test(nm)?/(^|[^a-z])arm([^a-z]|$)|elbow|bicep|hand/:/hip/.test(nm)?/thigh|leg|torso|hip/:null;
    let cand=others.filter(q=>(!joint||joint.test(nameOf(q)))&&(!side||nameOf(q).includes(side)));
    if(!cand.length)cand=others.filter(q=>!joint||joint.test(nameOf(q)));
    if(!cand.length)cand=others;
    const tally=new Map();
    for(const q of cand){const o=S.offs[q],n=S.parts[q].m.f.length/3;
      /* a knee pin only sees the joint: the lowest 30% of a thigh, the highest 30% of a calf */
      let zw=null;if(/knee/.test(nm)&&regM){const g=pieceGeo(q,regM);let z0=Infinity,z1=-Infinity;for(let i=0;i<n;i++){z0=Math.min(z0,g.c[i*3+2]);z1=Math.max(z1,g.c[i*3+2]);}
        const up=/thigh/.test(nameOf(q)),cut=up?z0+0.3*(z1-z0):z1-0.3*(z1-z0);zw=i=>up?g.c[i*3+2]<=cut:g.c[i*3+2]>=cut;}
      for(let i=0;i<n;i++){const L=S.label[o+i];if(L<0||!hid[o+i]||(zw&&!zw(i)))continue;tally.set(L,(tally.get(L)||0)+S.area[o+i]);}}
    if(!tally.size)for(const q of cand){const o=S.offs[q],n=S.parts[q].m.f.length/3;
      for(let i=0;i<n;i++){const L=S.label[o+i];if(L>=0)tally.set(L,(tally.get(L)||0)+S.area[o+i]);}}
    tal.set(pi,tally);}
  /* left and right twins take one paint: their tallies are pooled */
  const key=pi=>nameOf(pi).replace(/^.*?_\d+_/,"").replace(/left|right/,"");
  for(const pi of pins){const pool=new Map();for(const q of pins)if(key(q)===key(pi))for(const [L,a] of tal.get(q))pool.set(L,(pool.get(L)||0)+a);
    let best=-1,ba=-1;for(const [L,a] of pool)if(a>ba){ba=a;best=L;}
    if(best<0)continue;const o=S.offs[pi],n=S.parts[pi].m.f.length/3;for(let i=0;i<n;i++)S.label[o+i]=best;}
  (window._spcDbg=window._spcDbg||{}).pins=pins.map(pi=>nameOf(pi)+":"+S.regions[S.label[S.offs[pi]]].rgb);
}
/* two colors that are the same paint in light and shadow (a red and its darker red): same hue, both
   clearly colored, the darker one much smaller */
function shadeOf(A,B){const a=C.lab(...A.rgb),b=C.lab(...B.rgb),ca=Math.hypot(a[1],a[2]),cb=Math.hypot(b[1],b[2]);
  if(Math.min(ca,cb)<15||Math.max(ca,cb)<25)return false;let dh=Math.abs(Math.atan2(a[2],a[1])-Math.atan2(b[2],b[1]))*180/Math.PI;if(dh>180)dh=360-dh;
  const [big,small,lb,ls]=A.area>=B.area?[A,B,a[0],b[0]]:[B,A,b[0],a[0]];
  return dh<14&&small.area<0.35*big.area&&ls<lb-10; /* only a darker, smaller twin: a shadow */}
/* a jointed piece and the rigid piece it stands in for are the same sculpt: the jointed one takes the rigid
   one's paint wherever their surfaces coincide, so a hip cap or a stripe lands the same on both */
function twinCopy(active,regM,hid){const geo=active.map(pi=>pieceGeo(pi,regM)),dup=samePlace(geo);let nc=0;const pairs=[];
  const area=g=>{let a=0;const o=S.offs[g.pi];for(let t=0;t<g.n;t++)a+=S.area[o+t];return a;};
  for(const A of geo)for(const B of geo){if(A===B||!dup.has(A.pi+"|"+B.pi))continue;if(area(A)>=area(B))continue; /* A small (jointed), B big (rigid) */
    if(!B.Gc)B.Gc=C.grid(B.c,0.5);const oA=S.offs[A.pi],oB=S.offs[B.pi],got=new Int32Array(A.n).fill(-1);
    for(let t=0;t<A.n;t++){const [j,d]=B.Gc.near(A.c[t*3],A.c[t*3+1],A.c[t*3+2],3);if(j<0||d>0.6)continue;
      const dot=A.fn[t*3]*B.fn[j*3]+A.fn[t*3+1]*B.fn[j*3+1]+A.fn[t*3+2]*B.fn[j*3+2];if(dot<0.7)continue;got[t]=S.label[oB+j];}
    /* settle the copied border on this piece's own mesh: three passes of a one-ring majority */
    const nb=S.nb[A.pi];for(let it=0;it<3;it++){const nx=got.slice();
      for(let t=0;t<A.n;t++){if(got[t]<0)continue;const m=new Map();m.set(got[t],S.area[oA+t]);
        for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&got[u]>=0)m.set(got[u],(m.get(got[u])||0)+S.area[oA+u]);}
        let b=got[t],bv=0;for(const [L,v] of m)if(v>bv){bv=v;b=L;}nx[t]=b;}got.set(nx);}
    let k=0;for(let t=0;t<A.n;t++)if(got[t]>=0&&S.label[oA+t]!==got[t]){S.label[oA+t]=got[t];k++;}nc+=k;
    /* whole sculpted areas: where the two sculpts differ a little (a hip dome against a hip ball) the face
       match misses, so a small sculpted area takes the paint its twin shows across most of it */
    {const p=S.parts[A.pi],fn0=C.faceNormals(p.m,p.M),v0=C.xf(p.M,p.m.v),ar=sculptAreas(A.pi,surfaceShape(p,S.nb[A.pi],fn0,v0));
     let tot=0;for(let t=0;t<A.n;t++)tot+=S.area[oA+t];const per=new Map();
     for(let t=0;t<A.n;t++){const id=ar[t];if(!per.has(id))per.set(id,{a:0,cov:0,v:new Map(),f:[]});const P=per.get(id);P.a+=S.area[oA+t];P.f.push(t);
       const [j,d]=B.Gc.near(A.c[t*3],A.c[t*3+1],A.c[t*3+2],6);if(j<0||d>2.5)continue;
       const dot=A.fn[t*3]*B.fn[j*3]+A.fn[t*3+1]*B.fn[j*3+1]+A.fn[t*3+2]*B.fn[j*3+2];if(dot<0.3)continue;
       const L=S.label[oB+j];P.cov+=S.area[oA+t];P.v.set(L,(P.v.get(L)||0)+S.area[oA+t]);}
     const rep=[];for(const [id,P] of per){if(P.a<0.02*tot)continue;let b=-1,bv=0;for(const [L,v] of P.v)if(v>bv){bv=v;b=L;}
       rep.push([+(P.a/tot).toFixed(2),+(P.cov/P.a).toFixed(2),b,+(bv/Math.max(P.cov,1e-9)).toFixed(2)]);
       if(P.a<0.3*tot&&P.cov>0.6*P.a&&bv>0.7*P.cov)for(const t of P.f)if(!hid[oA+t]||true){if(S.label[oA+t]!==b){S.label[oA+t]=b;k++;}}}
     (window._spcDbg.twinAreas=window._spcDbg.twinAreas||{})[p.name]=rep;}pairs.push(S.parts[A.pi].name+"<"+S.parts[B.pi].name+":"+k);}
  (window._spcDbg=window._spcDbg||{}).twins2=pairs;}
/* left and right pieces are mirror images. Over each sculpted area the two should carry the same paint; when
   one side shows a feature paint (a hip cap, a cuff) across most of an area and the other side missed it, the
   missed side takes it, and each area is made one clean paint up to its sculpted edge */
function mirrorAreas(active,regM,hid){const rep=[];
  const nm=pi=>S.parts[pi].name.toLowerCase().replace(/\d+/g,"#");
  const geo=new Map(active.map(pi=>[pi,pieceGeo(pi,regM)]));
  const areasOf=pi=>{const p=S.parts[pi],fn0=C.faceNormals(p.m,p.M),v0=C.xf(p.M,p.m.v);return sculptAreas(pi,surfaceShape(p,S.nb[pi],fn0,v0));};
  const dom=pi=>{const o=S.offs[pi],n=S.parts[pi].m.f.length/3,m=new Map();for(let t=0;t<n;t++){const L=S.label[o+t];m.set(L,(m.get(L)||0)+S.area[o+t]);}let b=-1,bv=0;for(const [L,v] of m)if(v>bv){bv=v;b=L;}return b;};
  for(const L of active){if(!/left/.test(nm(L)))continue;const R=active.find(q=>q!==L&&nm(q)===nm(L).replace(/left/g,"right"));if(R==null)continue;
    const gL=geo.get(L),gR=geo.get(R);let xl=0,xr=0;for(let t=0;t<gL.n;t++)xl+=gL.c[t*3];for(let t=0;t<gR.n;t++)xr+=gR.c[t*3];const mid=(xl/gL.n+xr/gR.n)/2;
    const pass=(A,B)=>{const oA=S.offs[A.pi],oB=S.offs[B.pi],ar=areasOf(A.pi),dA=dom(A.pi);if(!B.Gm){const mc=new Float32Array(B.c.length);for(let i=0;i<B.n;i++){mc[i*3]=2*mid-B.c[i*3];mc[i*3+1]=B.c[i*3+1];mc[i*3+2]=B.c[i*3+2];}B.Gm=C.grid(mc,0.5);}
      let tot=0;for(let t=0;t<A.n;t++)tot+=S.area[oA+t];const per=new Map();
      for(let t=0;t<A.n;t++){const id=ar[t];if(!per.has(id))per.set(id,{a:0,cov:0,own:new Map(),v:new Map(),f:[]});const P=per.get(id);const a=S.area[oA+t];P.a+=a;P.f.push(t);
        P.own.set(S.label[oA+t],(P.own.get(S.label[oA+t])||0)+a);
        const [j,d]=B.Gm.near(A.c[t*3],A.c[t*3+1],A.c[t*3+2],6);if(j<0||d>2)continue;
        const dot=-A.fn[t*3]*B.fn[j*3]+A.fn[t*3+1]*B.fn[j*3+1]+A.fn[t*3+2]*B.fn[j*3+2];if(dot<0.3)continue;
        const Lb=S.label[oB+j];P.cov+=a;P.v.set(Lb,(P.v.get(Lb)||0)+a);}
      const top=m=>{let b=-1,bv=0,s=0;for(const [k,v] of m){s+=v;if(v>bv){bv=v;b=k;}}return [b,bv/Math.max(s,1e-9)];};
      const out=[];
      for(const [,P] of per){if(P.a<0.03*tot||P.a>0.35*tot)continue;const [own,ownF]=top(P.own),[mir,mirF]=top(P.v);
        let want=-1;let fm=-1,fv=0,vs=0;for(const [k,v] of P.v){vs+=v;if(k!==dA&&v>fv){fv=v;fm=k;}}
        if(P.cov>0.3*P.a&&fm>=0&&fv>0.4*vs&&own===dA)want=fm;              /* the other side has a feature here */
        else if(own!==dA&&ownF>0.55)want=own;                              /* this side has it: make it clean */
        out.push([+(P.a/tot).toFixed(2),own,+ownF.toFixed(2),mir,+mirF.toFixed(2),fm,+(fv/Math.max(vs,1e-9)).toFixed(2),+(P.cov/P.a).toFixed(2),want]);
        if(want>=0)for(const t of P.f)if(S.label[oA+t]===dA)S.label[oA+t]=want;} /* only base paint gives way: trim inside stays */
      rep.push(S.parts[A.pi].name+" "+JSON.stringify(out));};
    pass(gL,gR);pass(gR,gL);}
  (window._spcDbg=window._spcDbg||{}).mirror=rep;}
/* no face is left without paint: one gap would keep the whole piece out of the saved file */
function fillUnlabeled(pis){let n2=0;
  for(const pi of pis){const o=S.offs[pi],n=S.parts[pi].m.f.length/3,nb=S.nb[pi];
    for(let pass=0;pass<50;pass++){let left=0;
      for(let t=0;t<n;t++){if(S.label[o+t]>=0)continue;const m=new Map();
        for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&S.label[o+u]>=0)m.set(S.label[o+u],(m.get(S.label[o+u])||0)+1);}
        let b=-1,bv=0;for(const [L,v] of m)if(v>bv){bv=v;b=L;}if(b>=0){S.label[o+t]=b;n2++;}else left++;}
      if(!left)break;}}
  return n2;}
/* where two main paints of a piece meet away from any sculpted edge, the border is rounded off: each face near
   it takes the paint that covers most of a small disc around it (not crossing a crease), so saw teeth and spikes
   narrower than the disc go. Only the piece's main paints trade faces: thin trim is never touched */
function roundEdges(active,hid,R){R=R||1.2;let ch=0;
  for(const pi of active){const g=pieceGeo(pi,null),o=S.offs[pi],n=g.n,nb=S.nb[pi],A=S.area;
    const tot=new Map();let all=0;for(let t=0;t<n;t++){const L=S.label[o+t];tot.set(L,(tot.get(L)||0)+A[o+t]);all+=A[o+t];}
    /* a paint counts as main when it is broad: twice its area over its border length (its typical width) is
       over 2.5 mm. A stripe or a piping is narrower, and keeps its shape */
    const per=new Map(),vv=g.v,F=g.f;
    for(let t=0;t<n;t++){const L=S.label[o+t];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&S.label[o+u]===L)continue;
      const a=F[t*3+e],b=F[t*3+(e+1)%3];per.set(L,(per.get(L)||0)+Math.hypot(vv[a*3]-vv[b*3],vv[a*3+1]-vv[b*3+1],vv[a*3+2]-vv[b*3+2]));}}
    const main=new Set([...tot].filter(([L,a])=>L>=0&&a>0.03*all&&2*a/Math.max(per.get(L)||0,1e-6)>2.5).map(([L])=>L));if(main.size<2)continue;
    const crease=(t,u)=>g.fn[t*3]*g.fn[u*3]+g.fn[t*3+1]*g.fn[u*3+1]+g.fn[t*3+2]*g.fn[u*3+2]<0.82;  /* ~35 degrees */
    const R2=R*R;
    for(let it=0;it<3;it++){const band=[];
      for(let t=0;t<n;t++){const L=S.label[o+t];if(!main.has(L))continue;
        for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&S.label[o+u]!==L&&main.has(S.label[o+u])){band.push(t);break;}}}
      const want=new Map(),mark=new Int32Array(n).fill(-1);
      for(const t0 of band){const q=[t0];mark[t0]=t0;const vote=new Map();const cx=g.c[t0*3],cy=g.c[t0*3+1],cz=g.c[t0*3+2];
        for(let h=0;h<q.length&&q.length<600;h++){const t=q[h],L=S.label[o+t];if(main.has(L))vote.set(L,(vote.get(L)||0)+A[o+t]);
          for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||mark[u]===t0||crease(t,u))continue;
            const dx=g.c[u*3]-cx,dy=g.c[u*3+1]-cy,dz=g.c[u*3+2]-cz;if(dx*dx+dy*dy+dz*dz>R2)continue;mark[u]=t0;q.push(u);}}
        let b=-1,bv=0,sv=0;for(const [L,v] of vote){sv+=v;if(v>bv){bv=v;b=L;}}
        if(b>=0&&b!==S.label[o+t0]&&bv>0.6*sv)want.set(t0,b);}
      for(const [t,b] of want){S.label[o+t]=b;ch++;}
      if(!want.size)break;}}
  (window._spcDbg=window._spcDbg||{}).round=ch;}
/* the hidden mask comes from ray tests and contact checks, so its edge is ragged. A sculpted area that is mostly
   hidden is hidden all the way to its sculpted edge, and one that is mostly visible is visible, so a hidden
   paint (a hip cap, a socket) stops at the ridge instead of in saw teeth */
function hiddenToAreas(active,hid){let on=0,off=0;
  for(const pi of active){const p=S.parts[pi],o=S.offs[pi],n=p.m.f.length/3,A=S.area;
    const fn0=C.faceNormals(p.m,p.M),v0=C.xf(p.M,p.m.v),ar=sculptAreas(pi,surfaceShape(p,S.nb[pi],fn0,v0));
    let tot=0;const per=new Map();for(let t=0;t<n;t++){tot+=A[o+t];let P=per.get(ar[t]);if(!P){P={a:0,h:0};per.set(ar[t],P);}P.a+=A[o+t];if(hid[o+t])P.h+=A[o+t];}
    for(let t=0;t<n;t++){const P=per.get(ar[t]);if(P.a>0.3*tot||P.h===0)continue;const f=P.h/P.a;
      if(f>0.6&&!hid[o+t]){hid[o+t]=1;on++;}else if(f<0.25&&hid[o+t]){hid[o+t]=0;off++;}}}
  (window._spcDbg=window._spcDbg||{}).hidAreas=[on,off];}
/* a border between two main paints moves onto the sculpted ridge near it. The ridge (the line between a hip and
   the leg, the top of a boot, a sleeve edge) is a ring of strongly bent faces; a minimum cut through a wide band
   around the current border, where cutting along bent faces is almost free and cutting smooth surface is dear,
   lands the border on that ring if there is one, or on the shortest smooth line if there isn't */
function snapMainToRidges(active,D,opt){D=D||8;opt=opt||{};let moved=0;const rep=[];
  for(const pi of active){const g=pieceGeo(pi,null),o=S.offs[pi],n=g.n,nb=S.nb[pi],A=S.area,v=g.v,F=g.f;
    /* bend: how far the normals turn within two rings of a face */
    const bend=new Float32Array(n);
    for(let t=0;t<n;t++){let mx=0;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;
        const d=1-(g.fn[t*3]*g.fn[u*3]+g.fn[t*3+1]*g.fn[u*3+1]+g.fn[t*3+2]*g.fn[u*3+2]);if(d>mx)mx=d;
        for(let e2=0;e2<3;e2++){const w=nb[u*3+e2];if(w<0||w===t)continue;const d2=1-(g.fn[t*3]*g.fn[w*3]+g.fn[t*3+1]*g.fn[w*3+1]+g.fn[t*3+2]*g.fn[w*3+2]);if(d2>mx)mx=d2;}}
      bend[t]=mx;}
    const tot=new Map(),per=new Map();let all=0;
    for(let t=0;t<n;t++){const L=S.label[o+t];tot.set(L,(tot.get(L)||0)+A[o+t]);all+=A[o+t];
      for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&S.label[o+u]===L)continue;const a=F[t*3+e],b=F[t*3+(e+1)%3];
        per.set(L,(per.get(L)||0)+Math.hypot(v[a*3]-v[b*3],v[a*3+1]-v[b*3+1],v[a*3+2]-v[b*3+2]));}}
    const main=[...tot].filter(([L,a])=>L>=0&&(a>0.15*all||2*a/Math.max(per.get(L)||0,1e-6)>2.5)).map(([L])=>L);
    for(let i=0;i<main.length;i++)for(let j=i+1;j<main.length;j++){const a=main[i],b=main[j];if(opt.pair&&!opt.pair(a,b))continue;
      /* the band: faces of a or b within D of their shared border */
      const dist=new Float32Array(n).fill(Infinity),q=[];
      for(let t=0;t<n;t++){const L=S.label[o+t];if(L!==a&&L!==b)continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0){const M=S.label[o+u];if(M!==L&&(M===a||M===b)){dist[t]=0;q.push(t);break;}}}}
      if(!q.length)continue;
      for(let h=0;h<q.length;h++){const t=q[h];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;const M=S.label[o+u];if(M!==a&&M!==b)continue;
          const dd=dist[t]+Math.hypot(g.c[u*3]-g.c[t*3],g.c[u*3+1]-g.c[t*3+1],g.c[u*3+2]-g.c[t*3+2]);if(dd<dist[u]&&dd<=D){dist[u]=dd;q.push(u);}}}
      const fr=[],idx=new Int32Array(n).fill(-1);for(let t=0;t<n;t++)if(dist[t]<=D){idx[t]=fr.length;fr.push(t);}
      const N=fr.length,sc=new Float64Array(N),tc=new Float64Array(N),eu=[],ev=[],ew=[];
      const cheap=t=>bend[t]>0.03;
      for(let k=0;k<N;k++){const t=fr[k],cur=S.label[o+t];let ca=cur===a?0:0.02*A[o+t],cb=cur===b?0:0.02*A[o+t];if(opt.lock&&opt.lock(pi,t)){if(cur===a)cb+=1e6;else ca+=1e6;}
        for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;const x=F[t*3+e],y=F[t*3+(e+1)%3],len=Math.hypot(v[x*3]-v[y*3],v[x*3+1]-v[y*3+1],v[x*3+2]-v[y*3+2]);
          const w=len*((cheap(t)&&cheap(u))?0.03:1);
          if(idx[u]<0){const M=S.label[o+u];if(M===a)cb+=1e6;else if(M===b)ca+=1e6;}   /* band edge: keeps the paint outside */
          else if(u>t){eu.push(k);ev.push(idx[u]);ew.push(w);}}
        const m=Math.min(ca,cb);sc[k]=cb-m;tc[k]=ca-m;}
      const side=minCut(N,sc,tc,eu,ev,ew);let mv=0;
      for(let k=0;k<N;k++){const L=side[k]?a:b,ii=o+fr[k];if(S.label[ii]!==L){S.label[ii]=L;mv+=A[ii];}}
      moved+=mv;rep.push(S.parts[pi].name.replace(/^.*?_\d+_/,"")+":"+mv.toFixed(0));}}
  (window._spcDbg=window._spcDbg||{}).ridges=rep;}
/* the inner side of a leg (facing the other leg) is barely seen and photographs dark. It takes the paint the
   leg shows at the same height on its front, back and outer side: a boot top or a hip cap starts on the inside
   where it starts on the outside, so the inside never spends filament changes on paint nobody sees */
function levelInner(active,regM){const rep=[];const geo=new Map(active.map(pi=>[pi,pieceGeo(pi,regM)]));
  let mx=0,mc=0;for(const g of geo.values())for(let t=0;t<g.n;t++){mx+=g.c[t*3];mc++;}const midX=mx/Math.max(mc,1);
  for(const pi of active){if(!/(leg|thigh|calf|shin|boot|foot)/i.test(S.parts[pi].name))continue;
    const g=geo.get(pi),o=S.offs[pi],n=g.n,A=S.area;
    /* the leg's long axis */
    let cx=0,cy=0,cz=0;for(let t=0;t<n;t++){cx+=g.c[t*3];cy+=g.c[t*3+1];cz+=g.c[t*3+2];}cx/=n;cy/=n;cz/=n;
    const Cv=[[0,0,0],[0,0,0],[0,0,0]];for(let t=0;t<n;t++){const d=[g.c[t*3]-cx,g.c[t*3+1]-cy,g.c[t*3+2]-cz];for(let i=0;i<3;i++)for(let j=0;j<3;j++)Cv[i][j]+=d[i]*d[j];}
    let ax=[0,1,0];for(let it=0;it<30;it++){const w=[0,1,2].map(i=>Cv[i][0]*ax[0]+Cv[i][1]*ax[1]+Cv[i][2]*ax[2]);const l=Math.hypot(...w)||1;ax=w.map(x=>x/l);}
    const inward=Math.sign(midX-cx)||1;
    /* main paints only: trim keeps its place */
    const tot=new Map();let all=0;for(let t=0;t<n;t++){const L=S.label[o+t];tot.set(L,(tot.get(L)||0)+A[o+t]);all+=A[o+t];}
    const main=new Set([...tot].filter(([L,a])=>L>=0&&a>0.1*all).map(([L])=>L));if(main.size<2)continue;
    const h=new Float32Array(n);let h0=Infinity,h1=-Infinity;for(let t=0;t<n;t++){h[t]=(g.c[t*3]-cx)*ax[0]+(g.c[t*3+1]-cy)*ax[1]+(g.c[t*3+2]-cz)*ax[2];h0=Math.min(h0,h[t]);h1=Math.max(h1,h[t]);}
    const SL=0.75,nb2=Math.ceil((h1-h0)/SL)+1,slab=[...Array(nb2)].map(()=>new Map());
    /* how much a face looks at the other leg: its normal, less its part along the axis, against the inward direction */
    const inner=new Float32Array(n);
    for(let t=0;t<n;t++){let nx=g.fn[t*3],ny=g.fn[t*3+1],nz=g.fn[t*3+2];const a=nx*ax[0]+ny*ax[1]+nz*ax[2];nx-=a*ax[0];ny-=a*ax[1];nz-=a*ax[2];
      const l=Math.hypot(nx,ny,nz);inner[t]=l>0.3?inward*nx/l:0;
      const L=S.label[o+t];if(inner[t]<0.2&&l>0.3&&main.has(L)){const m=slab[Math.floor((h[t]-h0)/SL)];m.set(L,(m.get(L)||0)+A[o+t]);}}
    let ch=0;
    for(let t=0;t<n;t++){if(inner[t]<0.6)continue;const L=S.label[o+t];if(!main.has(L))continue;
      const k=Math.floor((h[t]-h0)/SL),m=new Map();for(let d=-1;d<=1;d++){const s2=slab[k+d];if(s2)for(const [x,y] of s2)m.set(x,(m.get(x)||0)+y);}
      let b=-1,bv=0,sv=0;for(const [x,y] of m){sv+=y;if(y>bv){bv=y;b=x;}}
      if(b>=0&&b!==L&&bv>0.6*sv){S.label[o+t]=b;ch++;}}
    rep.push(S.parts[pi].name.replace(/^.*?_\d+_/,"")+":"+ch);}
  (window._spcDbg=window._spcDbg||{}).inner=rep;}
/* a hip cap on the inner side of a leg (the side facing the other leg) starts no lower than it does on the outer
   edges. Below that height the inside stays the leg's own paint: that part is barely seen, and black there
   would cost a filament change on every layer for nothing */
function hipCapInner(active,regM){const rep=[];const geo=new Map(active.map(pi=>[pi,pieceGeo(pi,regM)]));
  let mx=0,mc=0;for(const g of geo.values())for(let t=0;t<g.n;t++){mx+=g.c[t*3];mc++;}const midX=mx/Math.max(mc,1);
  const head=active.find(pi=>/head/i.test(S.parts[pi].name));let hc=null;
  if(head!=null){const g=geo.get(head);hc=[0,0,0];for(let t=0;t<g.n;t++)for(let k=0;k<3;k++)hc[k]+=g.c[t*3+k]/g.n;}
  for(const pi of active){if(!/leg/i.test(S.parts[pi].name)||/thigh|calf/i.test(S.parts[pi].name))continue;
    const g=geo.get(pi),o=S.offs[pi],n=g.n,A=S.area,nb=S.nb[pi];
    let cx=0,cy=0,cz=0;for(let t=0;t<n;t++){cx+=g.c[t*3];cy+=g.c[t*3+1];cz+=g.c[t*3+2];}cx/=n;cy/=n;cz/=n;
    const Cv=[[0,0,0],[0,0,0],[0,0,0]];for(let t=0;t<n;t++){const d=[g.c[t*3]-cx,g.c[t*3+1]-cy,g.c[t*3+2]-cz];for(let i=0;i<3;i++)for(let j=0;j<3;j++)Cv[i][j]+=d[i]*d[j];}
    let ax=[0,1,0];for(let it=0;it<30;it++){const w=[0,1,2].map(i=>Cv[i][0]*ax[0]+Cv[i][1]*ax[1]+Cv[i][2]*ax[2]);const l=Math.hypot(...w)||1;ax=w.map(x=>x/l);}
    /* the axis points up, toward the head */
    const up=hc?[hc[0]-cx,hc[1]-cy,hc[2]-cz]:[0,0,1];if(ax[0]*up[0]+ax[1]*up[1]+ax[2]*up[2]<0)ax=ax.map(x=>-x);
    const inward=Math.sign(midX-cx)||1,h=new Float32Array(n),inner=new Float32Array(n);let h1=-Infinity,h0=Infinity;
    for(let t=0;t<n;t++){h[t]=(g.c[t*3]-cx)*ax[0]+(g.c[t*3+1]-cy)*ax[1]+(g.c[t*3+2]-cz)*ax[2];h1=Math.max(h1,h[t]);h0=Math.min(h0,h[t]);
      let nx=g.fn[t*3],ny=g.fn[t*3+1],nz=g.fn[t*3+2];const a=nx*ax[0]+ny*ax[1]+nz*ax[2];nx-=a*ax[0];ny-=a*ax[1];nz-=a*ax[2];
      const l=Math.hypot(nx,ny,nz);inner[t]=l>0.25?inward*nx/l:0;}
    /* inner or outer half by position: across the leg at each height, which side of its middle a face is on */
    {const SL=1,nS=Math.ceil((h1-h0)/SL)+1,sx=new Float64Array(nS),sn=new Float64Array(nS),smin=new Float64Array(nS).fill(Infinity),smax=new Float64Array(nS).fill(-Infinity);
     for(let t=0;t<n;t++){const k=Math.floor((h[t]-h0)/SL),x=g.c[t*3];sx[k]+=x;sn[k]++;smin[k]=Math.min(smin[k],x);smax[k]=Math.max(smax[k],x);}
     for(let t=0;t<n;t++){const k=Math.floor((h[t]-h0)/SL),mid=sx[k]/sn[k],half=Math.max(0.5,(smax[k]-smin[k])/2);inner[t]=inward*(g.c[t*3]-mid)/half;}}
    /* the cap: the paint at the top end, and its patch joined to the top */
    const top=new Map();for(let t=0;t<n;t++)if(h[t]>h1-0.06*(h1-h0)){const L=S.label[o+t];top.set(L,(top.get(L)||0)+A[o+t]);}
    let cap=-1,cv=0;for(const [L,v] of top)if(v>cv){cv=v;cap=L;}if(cap<0)continue;
    const inCap=new Uint8Array(n),q=[];for(let t=0;t<n;t++)if(h[t]>h1-0.06*(h1-h0)&&S.label[o+t]===cap){inCap[t]=1;q.push(t);}
    for(let k=0;k<q.length;k++){const t=q[k];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&!inCap[u]&&S.label[o+u]===cap){inCap[u]=1;q.push(u);}}}
    /* the leg's own paint: what borders the cap most */
    const bord=new Map(),hs=[];
    for(let t=0;t<n;t++){if(!inCap[t])continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||inCap[u])continue;const M=S.label[o+u];bord.set(M,(bord.get(M)||0)+1);
      if(inner[t]<-0.75)hs.push(h[t]);}}
    let body=-1,bv=0;for(const [L,v] of bord)if(v>bv){bv=v;body=L;}if(body<0||hs.length<5)continue;
    hs.sort((a,b)=>a-b);const hOut=hs[Math.floor(hs.length*0.05)];
    /* only the side that faces the other leg: front and back keep their cap down to their own ridge */
    let ch=0;for(let t=0;t<n;t++){if(!(inCap[t]&&inner[t]>0&&h[t]<hOut&&h[t]>h1-16))continue;
      let nx=g.fn[t*3],ny=g.fn[t*3+1],nz=g.fn[t*3+2];const a=nx*ax[0]+ny*ax[1]+nz*ax[2];nx-=a*ax[0];ny-=a*ax[1];nz-=a*ax[2];const l=Math.hypot(nx,ny,nz);
      if(l>0.3&&(inward*nx/l>0.7||(inner[t]>0.3&&Math.abs(ny/l)<0.5))){S.label[o+t]=body;ch++;}}
    /* and above that height the inner side is all cap: red teeth reaching up into the cap go */
    for(let t=0;t<n;t++){if(S.label[o+t]!==body||!(inner[t]>0&&h[t]>=hOut))continue;
      let nx=g.fn[t*3],ny=g.fn[t*3+1],nz=g.fn[t*3+2];const a=nx*ax[0]+ny*ax[1]+nz*ax[2];nx-=a*ax[0];ny-=a*ax[1];nz-=a*ax[2];const l=Math.hypot(nx,ny,nz);
      if(l>0.3&&(inward*nx/l>0.7||(inner[t]>0.3&&Math.abs(ny/l)<0.5))){S.label[o+t]=cap;ch++;}}
    /* the cap is one piece: black in the upper leg that isn't joined to the cap at the top (a patch in the crotch
       notch under the peg, a blotch below the red band) is the leg's own paint */
    {const keep=new Uint8Array(n),q=[];for(let t=0;t<n;t++)if(h[t]>h1-0.03*(h1-h0)&&S.label[o+t]===cap){keep[t]=1;q.push(t);}
     for(let k2=0;k2<q.length;k2++){const t=q[k2];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&!keep[u]&&S.label[o+u]===cap){keep[u]=1;q.push(u);}}}
     for(let t=0;t<n;t++)if(S.label[o+t]===cap&&!keep[t]&&h[t]>h1-0.4*(h1-h0)){S.label[o+t]=body;ch++;}}
    rep.push(S.parts[pi].name.replace(/^.*?_\d+_/,"")+":"+ch+" cap"+cap+" body"+body+" hOut"+hOut.toFixed(1)+" h"+h0.toFixed(1)+".."+h1.toFixed(1)+" ax"+ax.map(x=>x.toFixed(2))+" hc"+(hc?hc.map(x=>x.toFixed(0)):"none")+" c"+[cx,cy,cz].map(x=>x.toFixed(0))+" in"+inward);}
  (window._spcDbg=window._spcDbg||{}).hipInner=rep;}
/* the hip cap of a leg is everything above the hip ridge, the sculpted line that runs right round the top of
   the leg (lower at the front and back, up over the hip). Found as the cheapest cut between the top of the leg
   and the leg below the hip, where cutting along sculpted ridge costs almost nothing: the cut follows the ridge
   all the way round, and where the ridge fades it crosses the gap in the shortest line */
function ridgeCap(active,regM){const rep=[];const geo=new Map(active.map(pi=>[pi,pieceGeo(pi,regM)]));
  const head=active.find(pi=>/head/i.test(S.parts[pi].name));let hc=null;
  if(head!=null){const g=geo.get(head);hc=[0,0,0];for(let t=0;t<g.n;t++)for(let k=0;k<3;k++)hc[k]+=g.c[t*3+k]/g.n;}
  const caps=new Map();
  for(const pi of active){const nm=S.parts[pi].name;if(!/(leg|thigh)/i.test(nm)||/calf|shin/i.test(nm))continue;
    const g=geo.get(pi),o=S.offs[pi],n=g.n,A=S.area,nb=S.nb[pi],v=g.v,F=g.f;
    let cx=0,cy=0,cz=0;for(let t=0;t<n;t++){cx+=g.c[t*3];cy+=g.c[t*3+1];cz+=g.c[t*3+2];}cx/=n;cy/=n;cz/=n;
    const Cv=[[0,0,0],[0,0,0],[0,0,0]];for(let t=0;t<n;t++){const d=[g.c[t*3]-cx,g.c[t*3+1]-cy,g.c[t*3+2]-cz];for(let i=0;i<3;i++)for(let j=0;j<3;j++)Cv[i][j]+=d[i]*d[j];}
    let ax=[0,1,0];for(let it=0;it<30;it++){const w=[0,1,2].map(i=>Cv[i][0]*ax[0]+Cv[i][1]*ax[1]+Cv[i][2]*ax[2]);const l=Math.hypot(...w)||1;ax=w.map(x=>x/l);}
    const up=hc?[hc[0]-cx,hc[1]-cy,hc[2]-cz]:[0,0,1];if(ax[0]*up[0]+ax[1]*up[1]+ax[2]*up[2]<0)ax=ax.map(x=>-x);
    const h=new Float32Array(n);let h1=-Infinity,h0=Infinity;for(let t=0;t<n;t++){h[t]=(g.c[t*3]-cx)*ax[0]+(g.c[t*3+1]-cy)*ax[1]+(g.c[t*3+2]-cz)*ax[2];if(h[t]>h1)h1=h[t];if(h[t]<h0)h0=h[t];}
    /* paints: the cap is what covers the very top; the leg is what covers the band below the hip */
    const vote=(lo,hi)=>{const m=new Map();for(let t=0;t<n;t++)if(h[t]>=lo&&h[t]<=hi){const L=S.label[o+t];m.set(L,(m.get(L)||0)+A[o+t]);}let b=-1,bv=0;for(const [L,x] of m)if(x>bv){bv=x;b=L;}return b;};
    const len=h1-h0,cap=vote(h1-0.04*len,h1),body=vote(h1-0.45*len,h1-0.3*len);if(cap<0||body<0||cap===body)continue;
    const bend=new Float32Array(n);
    for(let t=0;t<n;t++){let mx=0;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;
        const d=1-(g.fn[t*3]*g.fn[u*3]+g.fn[t*3+1]*g.fn[u*3+1]+g.fn[t*3+2]*g.fn[u*3+2]);if(d>mx)mx=d;
        for(let e2=0;e2<3;e2++){const w=nb[u*3+e2];if(w<0||w===t)continue;const d2=1-(g.fn[t*3]*g.fn[w*3]+g.fn[t*3+1]*g.fn[w*3+1]+g.fn[t*3+2]*g.fn[w*3+2]);if(d2>mx)mx=d2;}}
      bend[t]=mx;}
    /* the graph: the top 30% of the leg; the top end is cap, the bottom of the band is leg */
    const lo=h1-0.3*len,idx=new Int32Array(n).fill(-1),fr=[];for(let t=0;t<n;t++)if(h[t]>=lo){idx[t]=fr.length;fr.push(t);}
    const N=fr.length,sc=new Float64Array(N),tc=new Float64Array(N),eu=[],ev=[],ew=[];
    for(let k=0;k<N;k++){const t=fr[k];if(h[t]>h1-0.03*len)sc[k]=1e9;else if(h[t]<lo+0.03*len)tc[k]=1e9;
      for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<=t||idx[u]<0)continue;const x=F[t*3+e],y=F[t*3+(e+1)%3];
        const l=Math.hypot(v[x*3]-v[y*3],v[x*3+1]-v[y*3+1],v[x*3+2]-v[y*3+2]),bm=Math.min(bend[t],bend[u]);
        eu.push(k);ev.push(idx[u]);ew.push(l/(1+(bm/0.006)**2));}}
    const side=minCut(N,sc,tc,eu,ev,ew);let ch=0;const capSet=new Uint8Array(n);
    for(let k=0;k<N;k++){const t=fr[k],ii=o+t,L=S.label[ii];if(side[k])capSet[t]=1;if(L!==cap&&L!==body)continue;const want=side[k]?cap:body;if(L!==want){S.label[ii]=want;ch++;}}
    caps.set(pi,{capSet,cap,body,h,lo});
    rep.push(nm.replace(/^.*?_\d+_/,"")+":"+ch);}
  (window._spcDbg=window._spcDbg||{}).ridgeCap=rep;return caps;}
/* the upper leg of a jointed leg takes the hip cap exactly as the rigid leg has it, wherever the two surfaces meet */
function capToThighs(active,regM){const rep=[];const geo=new Map(active.map(pi=>[pi,pieceGeo(pi,regM)]));
  const nm=pi=>S.parts[pi].name.toLowerCase();
  for(const T of active){if(!/thigh/.test(nm(T)))continue;const side=/left/.test(nm(T))?"left":/right/.test(nm(T))?"right":"";
    const R=active.find(q=>/leg/.test(nm(q))&&!/thigh|calf/.test(nm(q))&&nm(q).includes(side));if(R==null)continue;
    const gT=geo.get(T),gR=geo.get(R),G=C.grid(gR.c,0.5),oT=S.offs[T],oR=S.offs[R];let ch=0;const got=new Uint8Array(gT.n);
    for(let t=0;t<gT.n;t++){const [j,d]=G.near(gT.c[t*3],gT.c[t*3+1],gT.c[t*3+2],4);if(j<0||d>1.0)continue;
      const dot=gT.fn[t*3]*gR.fn[j*3]+gT.fn[t*3+1]*gR.fn[j*3+1]+gT.fn[t*3+2]*gR.fn[j*3+2];if(dot<0.6)continue;
      const L=S.label[oR+j];got[t]=1;if(S.label[oT+t]!==L){S.label[oT+t]=L;ch++;}}
    /* faces with no rigid surface right on them take the paint of the nearest face that has one */
    {const nb=S.nb[T],q=[];for(let t=0;t<gT.n;t++)if(got[t])q.push(t);
     for(let k=0;k<q.length;k++){const t=q[k];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||got[u])continue;got[u]=1;if(S.label[oT+u]!==S.label[oT+t]){S.label[oT+u]=S.label[oT+t];ch++;}q.push(u);}}}
    rep.push(S.parts[T].name.replace(/^.*?_\d+_/,"")+"<"+S.parts[R].name.replace(/^.*?_\d+_/,"")+":"+ch);}
  (window._spcDbg=window._spcDbg||{}).capThigh=rep;}
/* the hip cap of a jointed upper leg: the cheapest cut between its hip end (the end face and the very tip) and the
   thigh below, where an edge costs its length divided by how sharply the surface bends across it (angle over
   distance, so long thin triangles don't fake a ridge). The cut runs along the hip crease */
function thighCap(active,regM){const rep=[];
  for(const pi of active){const nm=S.parts[pi].name;if(!/thigh/i.test(nm))continue;
    const g=pieceGeo(pi,null),o=S.offs[pi],n=g.n,A=S.area,nb=S.nb[pi],v=g.v,F=g.f;
    let cx=0,cy=0,cz=0;for(let t=0;t<n;t++){cx+=g.c[t*3];cy+=g.c[t*3+1];cz+=g.c[t*3+2];}cx/=n;cy/=n;cz/=n;
    const Cv=[[0,0,0],[0,0,0],[0,0,0]];for(let t=0;t<n;t++){const d=[g.c[t*3]-cx,g.c[t*3+1]-cy,g.c[t*3+2]-cz];for(let i=0;i<3;i++)for(let j=0;j<3;j++)Cv[i][j]+=d[i]*d[j];}
    let ax=[0,1,0];for(let it=0;it<40;it++){const w=[0,1,2].map(i=>Cv[i][0]*ax[0]+Cv[i][1]*ax[1]+Cv[i][2]*ax[2]);const l=Math.hypot(...w)||1;ax=w.map(x=>x/l);}
    const h=new Float32Array(n);let h1=-Infinity,h0=Infinity;for(let t=0;t<n;t++){h[t]=(g.c[t*3]-cx)*ax[0]+(g.c[t*3+1]-cy)*ax[1]+(g.c[t*3+2]-cz)*ax[2];if(h[t]>h1)h1=h[t];if(h[t]<h0)h0=h[t];}
    const L=h1-h0;
    const cnt=(lo,hi)=>{const m=new Map();for(let t=0;t<n;t++)if(h[t]>=lo&&h[t]<=hi){const x=S.label[o+t];m.set(x,(m.get(x)||0)+A[o+t]);}return m;};
    const top=(m)=>{let b=-1,bv=0;for(const [x,y] of m)if(y>bv){bv=y;b=x;}return b;};
    const body=top(cnt(h0+0.4*L,h1-0.4*L));
    /* the hip end is the end that is not the body paint */
    const offT=[...cnt(h1-0.03*L,h1)].reduce((s,[x,y])=>s+(x!==body?y:0),0),offB=[...cnt(h0,h0+0.03*L)].reduce((s,[x,y])=>s+(x!==body?y:0),0);
    if(offB>offT){for(let t=0;t<n;t++)h[t]=-h[t];const a=h1;h1=-h0;h0=-a;ax=ax.map(x=>-x);}
    const cap=top(cnt(h1-0.03*L,h1));if(cap<0||cap===body)continue;
    const lo=h1-0.3*L,idx=new Int32Array(n).fill(-1),fr=[];for(let t=0;t<n;t++)if(h[t]>=lo){idx[t]=fr.length;fr.push(t);}
    const N=fr.length,sc=new Float64Array(N),tc=new Float64Array(N),eu=[],ev=[],ew=[],K0=0.35;
    for(let k=0;k<N;k++){const t=fr[k];const na=Math.abs(g.fn[t*3]*ax[0]+g.fn[t*3+1]*ax[1]+g.fn[t*3+2]*ax[2]);
      if(h[t]>h1-0.03*L||(na>0.9&&h[t]>h1-0.15*L))sc[k]=1e9;else if(h[t]<lo+0.02*L)tc[k]=1e9;
      for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<=t||idx[u]<0)continue;const x=F[t*3+e],y=F[t*3+(e+1)%3];
        const l=Math.hypot(v[x*3]-v[y*3],v[x*3+1]-v[y*3+1],v[x*3+2]-v[y*3+2]);
        const dd=Math.hypot(g.c[t*3]-g.c[u*3],g.c[t*3+1]-g.c[u*3+1],g.c[t*3+2]-g.c[u*3+2])+1e-6;
        const dot=Math.max(-1,Math.min(1,g.fn[t*3]*g.fn[u*3]+g.fn[t*3+1]*g.fn[u*3+1]+g.fn[t*3+2]*g.fn[u*3+2])),kk=Math.acos(dot)/dd;
        eu.push(k);ev.push(idx[u]);ew.push(l/(1+(kk/K0)**2));}}
    const side=minCut(N,sc,tc,eu,ev,ew);let ch=0;
    for(let k=0;k<N;k++){const ii=o+fr[k],Lb=S.label[ii];if(Lb!==cap&&Lb!==body)continue;const want=side[k]?cap:body;if(Lb!==want){S.label[ii]=want;ch++;}}
    rep.push(nm.replace(/^.*?_\d+_/,"")+":"+ch);}
  (window._spcDbg=window._spcDbg||{}).thighCap=rep;}
/* small islands of one main paint inside another (a fleck of black in the red) go: each one a pointless change */
function dropIslands(active,maxA){maxA=maxA||2;let k=0;
  for(const pi of active){const o=S.offs[pi],n=S.parts[pi].m.f.length/3,nb=S.nb[pi],A=S.area,seen=new Uint8Array(n);
    let all=0;const tot=new Map();for(let t=0;t<n;t++){const L=S.label[o+t];tot.set(L,(tot.get(L)||0)+A[o+t]);all+=A[o+t];}
    const main=new Set([...tot].filter(([L,a])=>a>0.1*all).map(([L])=>L));
    for(let s0=0;s0<n;s0++){if(seen[s0])continue;const L=S.label[o+s0];const comp=[s0];seen[s0]=1;let a=0;const bord=new Map();
      for(let q=0;q<comp.length;q++){const t=comp[q];a+=A[o+t];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;const M=S.label[o+u];
        if(M===L){if(!seen[u]){seen[u]=1;comp.push(u);}}else bord.set(M,(bord.get(M)||0)+1);}}
      if(!main.has(L)||a>maxA||bord.size!==1)continue;const [M]=bord.keys();if(!main.has(M))continue;
      for(const t of comp)S.label[o+t]=M;k++;}}
  (window._spcDbg=window._spcDbg||{}).islands=k;}
/* the hip crease of a jointed upper leg is close to a flat slanted ring. It is fitted as a plane through the
   strongly bent faces of the hip band (angle over distance, fine triangles only, so a fan of long triangles
   can't fake it); the cap is everything on the hip side of that plane. Left and right upper legs are mirror
   images: the one with less black sets the plane for both. The plane is kept with the piece so the saved
   paint cuts exactly along it, straight through big triangles */
function thighPlanes(active,regM){const rep=[];const fits=[];
  let mx=0,mc=0;for(const pi of active){const g=pieceGeo(pi,regM);for(let t=0;t<g.n;t++){mx+=g.c[t*3];mc++;}}const midX=mx/Math.max(mc,1);
  for(const pi of active){const nm=S.parts[pi].name;if(!/thigh/i.test(nm))continue;
    const g=pieceGeo(pi,regM),o=S.offs[pi],n=g.n,A=S.area,nb=S.nb[pi],v=g.v,F=g.f;
    let cx=0,cy=0,cz=0;for(let t=0;t<n;t++){cx+=g.c[t*3];cy+=g.c[t*3+1];cz+=g.c[t*3+2];}cx/=n;cy/=n;cz/=n;
    const Cv=[[0,0,0],[0,0,0],[0,0,0]];for(let t=0;t<n;t++){const d=[g.c[t*3]-cx,g.c[t*3+1]-cy,g.c[t*3+2]-cz];for(let i=0;i<3;i++)for(let j=0;j<3;j++)Cv[i][j]+=d[i]*d[j];}
    let ax=[0,1,0];for(let it=0;it<40;it++){const w=[0,1,2].map(i=>Cv[i][0]*ax[0]+Cv[i][1]*ax[1]+Cv[i][2]*ax[2]);const l=Math.hypot(...w)||1;ax=w.map(x=>x/l);}
    const h=new Float32Array(n);let h1=-Infinity,h0=Infinity;for(let t=0;t<n;t++){h[t]=(g.c[t*3]-cx)*ax[0]+(g.c[t*3+1]-cy)*ax[1]+(g.c[t*3+2]-cz)*ax[2];if(h[t]>h1)h1=h[t];if(h[t]<h0)h0=h[t];}
    const L=h1-h0,cnt=(lo,hi)=>{const m=new Map();for(let t=0;t<n;t++)if(h[t]>=lo&&h[t]<=hi){const x=S.label[o+t];m.set(x,(m.get(x)||0)+A[o+t]);}return m;};
    const top=m=>{let b=-1,bv=0;for(const [x,y] of m)if(y>bv){bv=y;b=x;}return b;};
    const body=top(cnt(h0+0.4*L,h1-0.4*L));
    const off=(lo,hi)=>[...cnt(lo,hi)].reduce((s2,[x,y])=>s2+(x!==body?y:0),0);
    if(off(h0,h0+0.03*L)>off(h1-0.03*L,h1)){for(let t=0;t<n;t++)h[t]=-h[t];const a=h1;h1=-h0;h0=-a;ax=ax.map(x=>-x);}
    const cap=top(cnt(h1-0.03*L,h1));if(cap<0||cap===body)continue;
    /* crease candidates */
    const P=[];
    for(let t=0;t<n;t++){if(h[t]<h1-0.3*L||h[t]>h1-0.02*L)continue;const na=Math.abs(g.fn[t*3]*ax[0]+g.fn[t*3+1]*ax[1]+g.fn[t*3+2]*ax[2]);if(na>0.8)continue;
      let el=0;for(let e=0;e<3;e++){const a=F[t*3+e],b=F[t*3+(e+1)%3];el=Math.max(el,Math.hypot(v[a*3]-v[b*3],v[a*3+1]-v[b*3+1],v[a*3+2]-v[b*3+2]));}if(el>1.2)continue;
      let k=0;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;const dd=Math.hypot(g.c[t*3]-g.c[u*3],g.c[t*3+1]-g.c[u*3+1],g.c[t*3+2]-g.c[u*3+2])+1e-6;
        const dot=Math.max(-1,Math.min(1,g.fn[t*3]*g.fn[u*3]+g.fn[t*3+1]*g.fn[u*3+1]+g.fn[t*3+2]*g.fn[u*3+2]));k=Math.max(k,Math.acos(dot)/dd);}
      if(k>0.4)P.push([g.c[t*3],g.c[t*3+1],g.c[t*3+2]]);}
    if(P.length<30)continue;
    /* RANSAC, then least squares on the inliers */
    let seed=12345;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
    let best=0,bn=null,bp=null;
    for(let it=0;it<2500;it++){const a=P[Math.floor(rnd()*P.length)],b=P[Math.floor(rnd()*P.length)],c=P[Math.floor(rnd()*P.length)];
      const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],w=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];let nn=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];const l=Math.hypot(...nn);if(l<1e-9)continue;nn=nn.map(x=>x/l);
      if(Math.abs(nn[0]*ax[0]+nn[1]*ax[1]+nn[2]*ax[2])<0.6)continue;let inl=0;for(const p of P)if(Math.abs((p[0]-a[0])*nn[0]+(p[1]-a[1])*nn[1]+(p[2]-a[2])*nn[2])<0.35)inl++;
      if(inl>best){best=inl;bn=nn;bp=a;}}
    if(!bn)continue;
    const inl=P.filter(p=>Math.abs((p[0]-bp[0])*bn[0]+(p[1]-bp[1])*bn[1]+(p[2]-bp[2])*bn[2])<0.35);
    const m=[0,1,2].map(k=>inl.reduce((s2,p)=>s2+p[k],0)/inl.length);
    const Cq=[[0,0,0],[0,0,0],[0,0,0]];for(const p of inl){const d=[p[0]-m[0],p[1]-m[1],p[2]-m[2]];for(let i=0;i<3;i++)for(let j=0;j<3;j++)Cq[i][j]+=d[i]*d[j];}
    /* smallest eigenvector: power iteration on (tr*I - C) */
    const tr=Cq[0][0]+Cq[1][1]+Cq[2][2];let nn=bn.slice();for(let it=0;it<60;it++){const w=[0,1,2].map(i=>tr*nn[i]-(Cq[i][0]*nn[0]+Cq[i][1]*nn[1]+Cq[i][2]*nn[2]));const l=Math.hypot(...w)||1;nn=w.map(x=>x/l);}
    if(nn[0]*ax[0]+nn[1]*ax[1]+nn[2]*ax[2]<0)nn=nn.map(x=>-x);
    const sdOf=(p,n2,m2)=>(p[0]-m2[0])*n2[0]+(p[1]-m2[1])*n2[1]+(p[2]-m2[2])*n2[2];
    let capA=0;for(let t=0;t<n;t++)if(h[t]>h1-0.35*L&&sdOf([g.c[t*3],g.c[t*3+1],g.c[t*3+2]],nn,m)>0)capA+=A[o+t];
    fits.push({pi,g,h,h1,L,cap,body,n:nn,m,capA,inl:inl.length});}
  /* mirror the one with less black onto the other */
  if(fits.length===2){const [a,b]=fits[0].capA<=fits[1].capA?fits:[fits[1],fits[0]];
    b.n=[-a.n[0],a.n[1],a.n[2]];b.m=[2*midX-a.m[0],a.m[1],a.m[2]];b.mirrored=true;}
  for(const F2 of fits){const {pi,g,h,h1,L,cap,body}=F2,o=S.offs[pi];let ch=0;
    for(let t=0;t<g.n;t++){if(h[t]<h1-0.35*L)continue;const Lb=S.label[o+t];if(Lb!==cap&&Lb!==body)continue;
      const sd=(g.c[t*3]-F2.m[0])*F2.n[0]+(g.c[t*3+1]-F2.m[1])*F2.n[1]+(g.c[t*3+2]-F2.m[2])*F2.n[2],want=sd>0?cap:body;if(Lb!==want){S.label[o+t]=want;ch++;}}
    /* keep the plane in the piece's own frame for the saved paint */
    const p=S.parts[pi],R=regM&&regM[pi]?C.inv4(regM[pi]):null;
    const tp=x=>R?[R[0]*x[0]+R[4]*x[1]+R[8]*x[2]+R[12],R[1]*x[0]+R[5]*x[1]+R[9]*x[2]+R[13],R[2]*x[0]+R[6]*x[1]+R[10]*x[2]+R[14]]:x;
    const m2=tp(F2.m),q2=tp([F2.m[0]+F2.n[0],F2.m[1]+F2.n[1],F2.m[2]+F2.n[2]]);let n2=[q2[0]-m2[0],q2[1]-m2[1],q2[2]-m2[2]];const l2=Math.hypot(...n2);n2=n2.map(x=>x/l2);
    p.capPlane={n:n2,m:m2,band:3};
    rep.push(p.name.replace(/^.*?_\d+_/,"")+":"+ch+(F2.mirrored?" (mirrored)":"")+" inl"+F2.inl+" capA"+F2.capA.toFixed(0));}
  (window._spcDbg=window._spcDbg||{}).thighPlanes=rep;}
/* trim (gold piping, a boot stripe, a cuff) is sculpted as raised strips. Each face's height above its
   surroundings (1.2 mm around) finds them; a thin raised strip that the trim paint already touches is painted
   trim from edge to edge, the rest of a wide raised part joined to it within 1.5 mm too (a cuff band, a toe cap),
   and trim that spilled onto flat surface goes back to the paint around it. The sole edge is left alone */
function trimStrips(active,regM){const rep=[];
  const heap=()=>{const a=[];return {push(d,t){a.push([d,t]);let i=a.length-1;while(i>0){const p=(i-1)>>1;if(a[p][0]<=a[i][0])break;[a[p],a[i]]=[a[i],a[p]];i=p;}},
    pop(){const top=a[0],last=a.pop();if(a.length){a[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<a.length&&a[l][0]<a[m][0])m=l;if(r<a.length&&a[r][0]<a[m][0])m=r;if(m===i)break;[a[m],a[i]]=[a[i],a[m]];i=m;}}return top;},get size(){return a.length;}};};
  for(const pi of active){if(!/(leg|calf|shin|boot)/i.test(S.parts[pi].name)||/thigh/i.test(S.parts[pi].name))continue;
    const g=pieceGeo(pi,null),gf=pieceGeo(pi,regM),o=S.offs[pi],n=g.n,nb=S.nb[pi],A=S.area,v=g.v,F=g.f;
    /* trim paints on this piece: narrow ones */
    const tot=new Map(),per=new Map();let all=0;
    for(let t=0;t<n;t++){const L=S.label[o+t];tot.set(L,(tot.get(L)||0)+A[o+t]);all+=A[o+t];
      for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&S.label[o+u]===L)continue;const a=F[t*3+e],b=F[t*3+(e+1)%3];per.set(L,(per.get(L)||0)+Math.hypot(v[a*3]-v[b*3],v[a*3+1]-v[b*3+1],v[a*3+2]-v[b*3+2]));}}
    const trims=[...tot].filter(([L,a])=>L>=0&&a>0.01*all&&a<0.4*all&&2*a/Math.max(per.get(L)||0,1e-6)<2.5).map(([L])=>L);
    if(!trims.length)continue;
    /* only the surface within 3 mm of trim is looked at */
    const dc=(t,u)=>Math.hypot(g.c[t*3]-g.c[u*3],g.c[t*3+1]-g.c[u*3+1],g.c[t*3+2]-g.c[u*3+2]);
    const near=new Float32Array(n).fill(Infinity);{const H0=heap(),TS=new Set(trims);for(let t=0;t<n;t++)if(TS.has(S.label[o+t])){near[t]=0;H0.push(0,t);}
      while(H0.size){const [d0,t]=H0.pop();if(d0>near[t])continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;const nd=d0+dc(t,u);if(nd<near[u]&&nd<=3){near[u]=nd;H0.push(nd,u);}}}}
    /* raise */
    const cell=1.2,grid=new Map(),key=(x,y,z)=>((Math.floor(x/cell)+512)*1024+(Math.floor(y/cell)+512))*1024+(Math.floor(z/cell)+512);
    for(let t=0;t<n;t+=3){if(near[t]>4.5&&near[t]!==Infinity)continue;if(near[t]===Infinity)continue;const k=key(g.c[t*3],g.c[t*3+1],g.c[t*3+2]);let b=grid.get(k);if(!b){b=[];grid.set(k,b);}b.push(t);}
    const ras=new Float32Array(n),r2=1.44;
    for(let t=0;t<n;t++){if(near[t]===Infinity)continue;const x=g.c[t*3],y=g.c[t*3+1],z=g.c[t*3+2],cx=Math.floor(x/cell),cy=Math.floor(y/cell),cz=Math.floor(z/cell);let sw=0,mx=0,my=0,mz=0;
      for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){const b=grid.get(((cx+i+512)*1024+(cy+j+512))*1024+(cz+k+512));if(!b)continue;
        for(const u of b){const dx=g.c[u*3]-x,dy=g.c[u*3+1]-y,dz=g.c[u*3+2]-z;if(dx*dx+dy*dy+dz*dz>r2)continue;
          if(g.fn[u*3]*g.fn[t*3]+g.fn[u*3+1]*g.fn[t*3+1]+g.fn[u*3+2]*g.fn[t*3+2]<0.3)continue;const w=A[o+u];sw+=w;mx+=g.c[u*3]*w;my+=g.c[u*3+1]*w;mz+=g.c[u*3+2]*w;}}
      if(sw>0)ras[t]=(x-mx/sw)*g.fn[t*3]+(y-my/sw)*g.fn[t*3+1]+(z-mz/sw)*g.fn[t*3+2];}
    let rs=ras;for(let it=0;it<2;it++){const nx=new Float32Array(n);for(let t=0;t<n;t++){let s2=rs[t],c=1;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0){s2+=rs[u];c++;}}nx[t]=s2/c;}rs=nx;}
    let zmin=Infinity;for(let t=0;t<n;t++)zmin=Math.min(zmin,gf.c[t*3+2]);
    const raw=new Uint8Array(n),above=new Uint8Array(n);for(let t=0;t<n;t++){raw[t]=rs[t]>0.05?1:0;above[t]=gf.c[t*3+2]>zmin+2.5?1:0;}
    /* depth inside the raised area */
    const dist=new Float32Array(n).fill(Infinity),H=heap();
    for(let t=0;t<n;t++){if(!raw[t])continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&!raw[u]){dist[t]=0;H.push(0,t);break;}}}
    while(H.size){const [d0,t]=H.pop();if(d0>dist[t])continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||!raw[u])continue;const nd=d0+dc(t,u);if(nd<dist[u]&&nd<=1.6){dist[u]=nd;H.push(nd,u);}}}
    const thin=new Uint8Array(n);for(let t=0;t<n;t++)thin[t]=raw[t]&&above[t]&&dist[t]<=1.0?1:0;
    for(const T of trims){
      /* a trim paint sits mostly on raised surface; a paint that doesn't is no trim */
      let ta=0,tr=0;for(let t=0;t<n;t++)if(S.label[o+t]===T){ta+=A[o+t];if(raw[t])tr+=A[o+t];}if(tr<0.35*ta)continue;
      const comp=new Int32Array(n).fill(-1),pick=[];let k=0;
      for(let s0=0;s0<n;s0++){if(!thin[s0]||comp[s0]>=0)continue;const q=[s0];comp[s0]=k;let gc=0;
        for(let h=0;h<q.length;h++){const t=q[h];if(S.label[o+t]===T)gc++;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&thin[u]&&comp[u]<0){comp[u]=k;q.push(u);}}}
        if(q.length>200&&gc>0.15*q.length)pick.push(k);k++;}
      if(!pick.length)continue;const P=new Set(pick);
      /* the other edge of the same stripe: a raised line running alongside a picked strip, within 2.5 mm */
      {const dn=new Float32Array(n).fill(Infinity),H5=heap();for(let t=0;t<n;t++)if(comp[t]>=0&&P.has(comp[t])){dn[t]=0;H5.push(0,t);}
       while(H5.size){const [d0,t]=H5.pop();if(d0>dn[t])continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;const nd=d0+dc(t,u);if(nd<dn[u]&&nd<=2.5){dn[u]=nd;H5.push(nd,u);}}}
       const tot2=new Map(),cl=new Map();for(let t=0;t<n;t++){const c2=comp[t];if(c2<0||P.has(c2))continue;tot2.set(c2,(tot2.get(c2)||0)+1);if(dn[t]<Infinity)cl.set(c2,(cl.get(c2)||0)+1);}
       for(const [c2,x] of tot2)if(x>100&&(cl.get(c2)||0)>0.6*x)P.add(c2);}
      const dd=new Float32Array(n).fill(Infinity),H2=heap();for(let t=0;t<n;t++)if(comp[t]>=0&&P.has(comp[t])){dd[t]=0;H2.push(0,t);}
      while(H2.size){const [d0,t]=H2.pop();if(d0>dd[t])continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||!raw[u]||!above[u])continue;const nd=d0+dc(t,u);if(nd<dd[u]&&nd<=1.5){dd[u]=nd;H2.push(nd,u);}}}
      const inS=new Uint8Array(n);for(let t=0;t<n;t++)if(dd[t]<Infinity)inS[t]=1;
      /* close the strip: a groove down the middle of a stripe, or a gap between two edge ridges, is part of it */
      {const CR=1.6,dil=new Float32Array(n).fill(Infinity),H3=heap();for(let t=0;t<n;t++)if(inS[t]){dil[t]=0;H3.push(0,t);}
       while(H3.size){const [d0,t]=H3.pop();if(d0>dil[t])continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||!above[u])continue;const nd=d0+dc(t,u);if(nd<dil[u]&&nd<=CR){dil[u]=nd;H3.push(nd,u);}}}
       const ero=new Float32Array(n).fill(Infinity),H4=heap();for(let t=0;t<n;t++)if(dil[t]===Infinity){for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&dil[u]<Infinity&&ero[u]>0){ero[u]=0;H4.push(0,u);}}}
       while(H4.size){const [d0,t]=H4.pop();if(d0>ero[t])continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||dil[u]===Infinity)continue;const nd=d0+dc(t,u);if(nd<ero[u]&&nd<=CR){ero[u]=nd;H4.push(nd,u);}}}
       for(let t=0;t<n;t++)if(!inS[t]&&dil[t]<Infinity&&ero[t]===Infinity)inS[t]=1;}
      let ch=0;for(let t=0;t<n;t++)if(inS[t]&&S.label[o+t]!==T){S.label[o+t]=T;ch++;}
      /* spill: trim on flat surface (or on a speck of raised noise) next to a strip goes back */
      const bigRaw=new Uint8Array(n);{const seen=new Uint8Array(n);for(let s0=0;s0<n;s0++){if(!raw[s0]||seen[s0])continue;const q=[s0];seen[s0]=1;
        for(let h2=0;h2<q.length;h2++){const t=q[h2];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&raw[u]&&!seen[u]){seen[u]=1;q.push(u);}}}
        if(q.length>=300)for(const t of q)bigRaw[t]=1;}}
      let sp=0;for(let pass=0;pass<30;pass++){let any=false;
        for(let t=0;t<n;t++){if(S.label[o+t]!==T||inS[t]||bigRaw[t])continue;const m=new Map();for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&S.label[o+u]!==T)m.set(S.label[o+u],(m.get(S.label[o+u])||0)+1);}
          let b=-1,bv=0;for(const [L,x] of m)if(x>bv){bv=x;b=L;}if(b>=0){S.label[o+t]=b;sp++;any=true;}}
        if(!any)break;}
      /* a patch of other paint closed in by the trim on every side (the middle of a toe cap) is trim; a loose
         patch of trim not joined to any strip (a blotch on the side of the toe) is not */
      let holes=0,isl=0;{const seen=new Uint8Array(n);
        /* the sole rim counts as a closing edge too: a toe cap is closed by its trim and the sole */
        const sole=new Uint8Array(n);for(let t=0;t<n;t++)if(gf.c[t*3+2]<zmin+0.8)sole[t]=1;
        for(let s0=0;s0<n;s0++){if(seen[s0]||sole[s0])continue;const L0=S.label[o+s0];const q=[s0];seen[s0]=1;let a=0,onlyT=true,touchS=false;
          for(let h2=0;h2<q.length;h2++){const t=q[h2];a+=A[o+t];if(inS[t])touchS=true;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0){onlyT=false;continue;}
            if(sole[u]&&L0!==T)continue;const Lu=S.label[o+u];if(Lu===L0){if(!seen[u]){seen[u]=1;q.push(u);}}else if(Lu!==T)onlyT=false;}}
          if(L0!==T&&onlyT&&a<40&&!q.some(t=>gf.c[t*3+2]<zmin+6)){for(const t of q)S.label[o+t]=T;holes++;}
          else if(L0===T&&!touchS&&a<15){const m=new Map();for(const t of q)for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&S.label[o+u]!==T)m.set(S.label[o+u],(m.get(S.label[o+u])||0)+1);}
            let b=-1,bv=0;for(const [k3,x] of m)if(x>bv){bv=x;b=k3;}if(b>=0){for(const t of q)S.label[o+t]=b;isl++;}}}}
      rep.push(S.parts[pi].name.replace(/^.*?_\d+_/,"")+" T"+T+":+"+ch+" -"+sp+" holes"+holes+" isl"+isl);}}
  (window._spcDbg=window._spcDbg||{}).trim=rep;}
/* left and right boots are mirror images, and so is their trim. The cleaner side (the trim with the shortest
   border for its area) is copied across to the other, face by face, wherever the mirrored surfaces meet */
function mirrorTrim(active,regM){const rep=[];const nm=pi=>S.parts[pi].name.toLowerCase().replace(/\d+/g,"#");
  let mx=0,mc=0;const geo=new Map(active.map(pi=>[pi,pieceGeo(pi,regM)]));for(const g of geo.values())for(let t=0;t<g.n;t++){mx+=g.c[t*3];mc++;}const midX=mx/Math.max(mc,1);
  for(const L of active){if(!/left/.test(nm(L))||!/(leg|calf|shin|boot)/.test(nm(L))||/thigh/.test(nm(L)))continue;
    const R=active.find(q=>q!==L&&nm(q)===nm(L).replace(/left/g,"right"));if(R==null)continue;
    const info=pi=>{const g=geo.get(pi),o=S.offs[pi],n=g.n,nb=S.nb[pi],A=S.area,F=g.f,v=g.v;const tot=new Map(),per=new Map();let all=0;
      for(let t=0;t<n;t++){const Lb=S.label[o+t];tot.set(Lb,(tot.get(Lb)||0)+A[o+t]);all+=A[o+t];
        for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&S.label[o+u]===Lb)continue;const a=F[t*3+e],b=F[t*3+(e+1)%3];per.set(Lb,(per.get(Lb)||0)+Math.hypot(v[a*3]-v[b*3],v[a*3+1]-v[b*3+1],v[a*3+2]-v[b*3+2]));}}
      return {tot,per,all};};
    const iL=info(L),iR=info(R);
    /* trim: a narrow paint present on both */
    const trims=[...iL.tot].filter(([Lb,a])=>Lb>=0&&a>0.01*iL.all&&a<0.3*iL.all&&iR.tot.has(Lb)&&2*a/Math.max(iL.per.get(Lb)||0,1e-6)<2.5).map(([Lb])=>Lb);
    for(const T of trims){const rag=i=>(i.per.get(T)||0)**2/Math.max(i.tot.get(T)||0,1e-6);
      const [src,dst]=rag(iL)<=rag(iR)?[L,R]:[R,L];const gs=geo.get(src),gd=geo.get(dst),os=S.offs[src],od=S.offs[dst];
      let xs=0,xd=0;for(let t=0;t<gs.n;t++)xs+=gs.c[t*3];for(let t=0;t<gd.n;t++)xd+=gd.c[t*3];const pm=(xs/gs.n+xd/gd.n)/2;
      const mcoord=new Float32Array(gs.c.length);for(let t=0;t<gs.n;t++){mcoord[t*3]=2*pm-gs.c[t*3];mcoord[t*3+1]=gs.c[t*3+1];mcoord[t*3+2]=gs.c[t*3+2];}
      const G=C.grid(mcoord,0.5);let add=0,rem=0,hit=0;
      /* the paint the trim sits on (boot black): only those two trade faces */
      const host=new Map();for(let t=0;t<gd.n;t++){if(S.label[od+t]!==T)continue;for(let e=0;e<3;e++){const u=S.nb[dst][t*3+e];if(u>=0&&S.label[od+u]!==T)host.set(S.label[od+u],(host.get(S.label[od+u])||0)+1);}}
      let hb=-1,hv=0;for(const [k2,x] of host)if(x>hv){hv=x;hb=k2;}const hosts=new Set([hb]);
      /* the cuff edge is left as the strip rule made it: no copying within 3 mm of the paint above the boot */
      const nearTop=new Uint8Array(gd.n);{const q=[],dist=new Float32Array(gd.n).fill(Infinity),nbD=S.nb[dst];
        for(let t=0;t<gd.n;t++){const c2=S.label[od+t];if(c2!==T&&!hosts.has(c2)){dist[t]=0;q.push(t);}}
        for(let h2=0;h2<q.length;h2++){const t=q[h2];for(let e=0;e<3;e++){const u=nbD[t*3+e];if(u<0)continue;const nd=dist[t]+Math.hypot(gd.c[t*3]-gd.c[u*3],gd.c[t*3+1]-gd.c[u*3+1],gd.c[t*3+2]-gd.c[u*3+2]);if(nd<dist[u]&&nd<=3){dist[u]=nd;q.push(u);}}}
        for(let t=0;t<gd.n;t++)if(dist[t]<=3)nearTop[t]=1;}
      let zd=Infinity;for(let t=0;t<gd.n;t++)zd=Math.min(zd,gd.c[t*3+2]);
      for(let t=0;t<gd.n;t++){const cur=S.label[od+t];if(cur!==T&&!hosts.has(cur))continue;if(nearTop[t])continue;
        const [j,d]=G.near(gd.c[t*3],gd.c[t*3+1],gd.c[t*3+2],4);if(j<0||d>1.5)continue;
        const dot=-gd.fn[t*3]*gs.fn[j*3]+gd.fn[t*3+1]*gs.fn[j*3+1]+gd.fn[t*3+2]*gs.fn[j*3+2];if(dot<0.5)continue;hit++;
        const sl=S.label[os+j];
        if(sl===T&&cur!==T){S.label[od+t]=T;add++;}
        else if(sl!==T&&cur===T){S.label[od+t]=hosts.has(sl)?sl:[...hosts][0];rem++;}}
      rep.push(S.parts[dst].name.replace(/^.*?_\d+_/,"")+"<"+S.parts[src].name.replace(/^.*?_\d+_/,"")+" T"+T+" hit"+hit+" +"+add+" -"+rem);}}
  (window._spcDbg=window._spcDbg||{}).mirrorTrim=rep;}
/* a jointed lower leg and the rigid leg are the same sculpt below the knee: the lower leg takes the rigid leg's
   boot paint (black and its trim) wherever the two surfaces sit on each other */
function bootFromRigid(active,regM){const rep=[];const geo=new Map(active.map(pi=>[pi,pieceGeo(pi,regM)]));const nm=pi=>S.parts[pi].name.toLowerCase();
  for(const Cf of active){if(!/(calf|shin)/.test(nm(Cf)))continue;const side=/left/.test(nm(Cf))?"left":/right/.test(nm(Cf))?"right":"";
    const R=active.find(q=>/leg/.test(nm(q))&&!/thigh|calf/.test(nm(q))&&nm(q).includes(side));if(R==null)continue;
    const gC=geo.get(Cf),gR=geo.get(R),G=C.grid(gR.c,0.5),oC=S.offs[Cf],oR=S.offs[R];
    /* boot paints: what the calf's lower half is mostly painted, plus narrow paints there */
    let zmin=Infinity,zmax=-Infinity;for(let t=0;t<gC.n;t++){zmin=Math.min(zmin,gC.c[t*3+2]);zmax=Math.max(zmax,gC.c[t*3+2]);}
    const cnt=new Map();for(let t=0;t<gC.n;t++)if(gC.c[t*3+2]<(zmin+zmax)/2){const L=S.label[oC+t];cnt.set(L,(cnt.get(L)||0)+1);}
    const boot=new Set([...cnt].filter(([,x])=>x>0.02*gC.n).map(([L])=>L));let ch=0,hit=0;
    /* the cuff stays as the strip rule made it: no copying within 3 mm of the paint above the boot */
    const nearTop=new Uint8Array(gC.n);{const dist=new Float32Array(gC.n).fill(Infinity),q=[],nbC=S.nb[Cf];
      for(let t=0;t<gC.n;t++)if(!boot.has(S.label[oC+t])){dist[t]=0;q.push(t);}
      for(let h2=0;h2<q.length;h2++){const t=q[h2];for(let e=0;e<3;e++){const u=nbC[t*3+e];if(u<0)continue;const nd=dist[t]+Math.hypot(gC.c[t*3]-gC.c[u*3],gC.c[t*3+1]-gC.c[u*3+1],gC.c[t*3+2]-gC.c[u*3+2]);if(nd<dist[u]&&nd<=3){dist[u]=nd;q.push(u);}}}
      for(let t=0;t<gC.n;t++)if(dist[t]<=3)nearTop[t]=1;}
    for(let t=0;t<gC.n;t++){const cur=S.label[oC+t];if(!boot.has(cur)||nearTop[t])continue;const [j,d]=G.near(gC.c[t*3],gC.c[t*3+1],gC.c[t*3+2],3);if(j<0||d>0.6)continue;
      if(gC.fn[t*3]*gR.fn[j*3]+gC.fn[t*3+1]*gR.fn[j*3+1]+gC.fn[t*3+2]*gR.fn[j*3+2]<0.7)continue;hit++;
      const L=S.label[oR+j];if(boot.has(L)&&L!==cur){S.label[oC+t]=L;ch++;}}
    rep.push(S.parts[Cf].name.replace(/^.*?_\d+_/,"")+"<"+S.parts[R].name.replace(/^.*?_\d+_/,"")+" hit"+hit+" ch"+ch);}
  (window._spcDbg=window._spcDbg||{}).bootRigid=rep;}
/* last pass on the legs: specks go. A patch of any paint under 1.2 mm² with one paint round it takes that paint
   (gold flecks beside a stripe, black flecks in red); a black patch closed in by trim on a boot toe up to 8 mm²
   becomes trim. Then the hip-cap edge on the rigid legs is rounded off */
function legSpecks(active,hid){let n1=0;
  for(const pi of active){const nm=S.parts[pi].name;if(!/(leg|calf|shin|thigh|torso|chest)/i.test(nm))continue;
    const o=S.offs[pi],n=S.parts[pi].m.f.length/3,nb=S.nb[pi],A=S.area;
    for(let rnd=0;rnd<3;rnd++){const seen=new Uint8Array(n);let ch=0;
      for(let s0=0;s0<n;s0++){if(seen[s0])continue;const L=S.label[o+s0],q=[s0];seen[s0]=1;let a=0;const bord=new Map();
        for(let h=0;h<q.length;h++){const t=q[h];a+=A[o+t];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;const M=S.label[o+u];
          if(M===L){if(!seen[u]){seen[u]=1;q.push(u);}}else bord.set(M,(bord.get(M)||0)+1);}}
        if(a>8||bord.size!==1)continue;const [M]=bord.keys();
        if(a<1.2){if(false){/* bigger: only black inside trim on a boot */const tot=new Map();let all=0;for(let t=0;t<n;t++){const x=S.label[o+t];tot.set(x,(tot.get(x)||0)+A[o+t]);all+=A[o+t];}
            if(!((tot.get(M)||0)<0.3*all&&(tot.get(L)||0)>0.3*all))continue;}
          for(const t of q)S.label[o+t]=M;ch++;}}
      n1+=ch;if(!ch)break;}}
  const rig=active.filter(pi=>/leg/i.test(S.parts[pi].name)&&!/(thigh|calf)/i.test(S.parts[pi].name));
  if(rig.length)roundEdges(rig,hid,+(window._spcRigR||2.5));
  (window._spcDbg=window._spcDbg||{}).specks=n1;}
/* the two rigid legs are mirror twins: over the hip, the one whose cap edge is cleaner (shortest edge for its
   area) is copied onto the other wherever the mirrored surfaces meet */
function mirrorCap(active,regM){const rep=[];const nm=pi=>S.parts[pi].name.toLowerCase().replace(/\d+/g,"#");
  const geo=new Map(active.map(pi=>[pi,pieceGeo(pi,regM)]));
  for(const L of active){if(!/left/.test(nm(L))||!/leg/.test(nm(L))||/(thigh|calf)/.test(nm(L)))continue;
    const R=active.find(q=>q!==L&&nm(q)===nm(L).replace(/left/g,"right"));if(R==null)continue;
    const info=pi=>{const g=geo.get(pi),o=S.offs[pi],n=g.n,nb=S.nb[pi],A=S.area,F=g.f,v=g.v;let z1=-Infinity,z0=Infinity;for(let t=0;t<n;t++){z1=Math.max(z1,g.c[t*3+2]);z0=Math.min(z0,g.c[t*3+2]);}
      const top=z1-0.35*(z1-z0),cm=new Map();for(let t=0;t<n;t++)if(g.c[t*3+2]>z1-0.03*(z1-z0)){const x=S.label[o+t];cm.set(x,(cm.get(x)||0)+1);}
      let cap=-1,cv=0;for(const [x,y] of cm)if(y>cv){cv=y;cap=x;}let a=0,p=0;
      for(let t=0;t<n;t++){if(g.c[t*3+2]<top||S.label[o+t]!==cap)continue;a+=A[o+t];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&S.label[o+u]!==cap&&g.c[u*3+2]>top){const x=F[t*3+e],y=F[t*3+(e+1)%3];p+=Math.hypot(v[x*3]-v[y*3],v[x*3+1]-v[y*3+1],v[x*3+2]-v[y*3+2]);}}}
      return {g,o,top,cap,rag:p*p/Math.max(a,1e-6)};};
    const iL=info(L),iR=info(R);if(iL.cap!==iR.cap)continue;const [S2,D]=iL.rag<=iR.rag?[iL,iR]:[iR,iL];
    let xs=0,xd=0;for(let t=0;t<S2.g.n;t++)xs+=S2.g.c[t*3];for(let t=0;t<D.g.n;t++)xd+=D.g.c[t*3];const pm=(xs/S2.g.n+xd/D.g.n)/2;
    const mc=new Float32Array(S2.g.c.length);for(let t=0;t<S2.g.n;t++){mc[t*3]=2*pm-S2.g.c[t*3];mc[t*3+1]=S2.g.c[t*3+1];mc[t*3+2]=S2.g.c[t*3+2];}
    const G=C.grid(mc,0.5);
    /* the leg paint under the cap on the destination */
    const bm=new Map();for(let t=0;t<D.g.n;t++){const z=D.g.c[t*3+2];if(z<D.top&&z>D.top-5){const x=S.label[D.o+t];bm.set(x,(bm.get(x)||0)+1);}}let body=-1,bv=0;for(const [x,y] of bm)if(y>bv){bv=y;body=x;}
    let ch=0,hit=0;
    for(let t=0;t<D.g.n;t++){if(D.g.c[t*3+2]<D.top)continue;const cur=S.label[D.o+t];if(cur!==D.cap&&cur!==body)continue;
      const [j,d]=G.near(D.g.c[t*3],D.g.c[t*3+1],D.g.c[t*3+2],4);if(j<0||d>1.0)continue;
      if(-D.g.fn[t*3]*S2.g.fn[j*3]+D.g.fn[t*3+1]*S2.g.fn[j*3+1]+D.g.fn[t*3+2]*S2.g.fn[j*3+2]<0.5)continue;hit++;
      const sl=S.label[S2.o+j],want=sl===S2.cap?D.cap:body;if(want!==cur){S.label[D.o+t]=want;ch++;}}
    rep.push("hit"+hit+" ch"+ch+" rag"+iL.rag.toFixed(0)+"/"+iR.rag.toFixed(0));}
  (window._spcDbg=window._spcDbg||{}).mirrorCap=rep;}
/* a body piece is close to a mirror image across its own middle. Trim that runs symmetrically (a harness strap)
   is copied from the side that shows more of it to the side that shows less, only onto raised surface, so a
   strap the photo half-missed is painted to its sculpted edges. And a band round the piece that is nearly all
   one paint other than the main one (a belt) is all that paint: specks of what lies below it go */
function torsoTrim(active,regM){const rep=[];
  for(const pi of active){if(!/(torso|chest|body)/i.test(S.parts[pi].name))continue;
    const g=pieceGeo(pi,regM),o=S.offs[pi],n=g.n,nb=S.nb[pi],A=S.area;
    const tot=new Map();let all=0;for(let t=0;t<n;t++){const L=S.label[o+t];tot.set(L,(tot.get(L)||0)+A[o+t]);all+=A[o+t];}
    let main=-1,mv=0;for(const [L,a] of tot)if(a>mv){mv=a;main=L;}
    /* raised */
    const cell=1.2,grid=new Map(),key=(i,j,k)=>((i+512)*1024+(j+512))*1024+(k+512);
    for(let t=0;t<n;t+=3){const k=key(Math.floor(g.c[t*3]/cell),Math.floor(g.c[t*3+1]/cell),Math.floor(g.c[t*3+2]/cell));let b=grid.get(k);if(!b){b=[];grid.set(k,b);}b.push(t);}
    const ras=new Float32Array(n);
    for(let t=0;t<n;t++){const x=g.c[t*3],y=g.c[t*3+1],z=g.c[t*3+2],cx=Math.floor(x/cell),cy=Math.floor(y/cell),cz=Math.floor(z/cell);let sw=0,mx=0,my=0,mz=0;
      for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){const b=grid.get(key(cx+i,cy+j,cz+k));if(!b)continue;
        for(const u of b){const dx=g.c[u*3]-x,dy=g.c[u*3+1]-y,dz=g.c[u*3+2]-z;if(dx*dx+dy*dy+dz*dz>1.44)continue;if(g.fn[u*3]*g.fn[t*3]+g.fn[u*3+1]*g.fn[t*3+1]+g.fn[u*3+2]*g.fn[t*3+2]<0.3)continue;
          const w=A[o+u];sw+=w;mx+=g.c[u*3]*w;my+=g.c[u*3+1]*w;mz+=g.c[u*3+2]*w;}}
      if(sw>0)ras[t]=(x-mx/sw)*g.fn[t*3]+(y-my/sw)*g.fn[t*3+1]+(z-mz/sw)*g.fn[t*3+2];}
    let xm=0;for(let t=0;t<n;t++)xm+=g.c[t*3];xm/=n;
    /* trim paints: present on both sides, not the main paint */
    const side=new Map();for(let t=0;t<n;t++){const L=S.label[o+t];if(L===main)continue;const k=g.c[t*3]<xm?0:1;let e=side.get(L);if(!e){e=[0,0];side.set(L,e);}e[k]+=A[o+t];}
    const mc=new Float32Array(g.c.length);for(let t=0;t<n;t++){mc[t*3]=2*xm-g.c[t*3];mc[t*3+1]=g.c[t*3+1];mc[t*3+2]=g.c[t*3+2];}
    const G=C.grid(mc,0.5);let add=0;
    const addBy=new Map();for(const [T,[a0,a1]] of side){if(Math.min(a0,a1)<0.01*all)continue;const add0=add;
      for(let t=0;t<n;t++){if(S.label[o+t]!==main||ras[t]<-0.02)continue;const [j,d]=G.near(g.c[t*3],g.c[t*3+1],g.c[t*3+2],4);if(j<0||d>1.0)continue;
        if(-g.fn[t*3]*g.fn[j*3]+g.fn[t*3+1]*g.fn[j*3+1]+g.fn[t*3+2]*g.fn[j*3+2]<0.5)continue;if(S.label[o+j]!==T)continue;S.label[o+t]=T;add++;}addBy.set(T,add-add0);}
    let strapT=-1,sv=0;for(const [T,x] of addBy)if(x>sv){sv=x;strapT=T;}
    /* strap edges: main paint closed in by trim within 0.5 mm becomes trim */
    for(let it=0;it<3;it++){const ch=[];for(let t=0;t<n;t++){if(S.label[o+t]!==main||ras[t]<0.0)continue;const m=new Map();let k=0;
        for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;k++;const L=S.label[o+u];if(L!==main)m.set(L,(m.get(L)||0)+1);}
        for(const [L,x] of m)if(x>=2&&side.has(L)){ch.push([t,L]);break;}}for(const [t,L] of ch)S.label[o+t]=L;add+=ch.length;}
    /* a paint spilled off its own raised part onto the strap (the emblem ring's green below it) goes to the strap */
    if(strapT>=0)for(let it=0;it<6;it++){const ch=[];for(let t=0;t<n;t++){const L=S.label[o+t];if(L===main||L===strapT||ras[t]>0.02)continue;
        for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&S.label[o+u]===strapT){ch.push(t);break;}}}if(!ch.length)break;for(const t of ch)S.label[o+t]=strapT;add+=ch.length;}
    /* feather fringe: trim paint sunk below its surroundings right at the body paint (on the body between two
       feather tips) is body paint; only in the upper half, so straps are untouched */
    let fr=0;{let zm=0;for(let t=0;t<n;t++)zm+=g.c[t*3+2];zm/=n;
      for(let it=0;it<4;it++){const ch=[];for(let t=0;t<n;t++){const L=S.label[o+t];if(L===main||g.c[t*3+2]<zm||ras[t]>-0.01)continue;
          let k=0;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&S.label[o+u]===main)k++;}if(k>=1)ch.push(t);}
        if(!ch.length)break;for(const t of ch)S.label[o+t]=main;fr+=ch.length;}}
    /* the emblem is a round disc: the compact paint on the front (bounding box under 20 mm). Its outer edge is
       the radius that holds 96% of it; inside, every face but the emblem's own centre paint is emblem, outside
       the disc the emblem paint goes to what is around it */
    let embFix=0;{const bb=new Map();for(let t=0;t<n;t++){const L=S.label[o+t];if(L===main||L===strapT)continue;let b=bb.get(L);if(!b){b={a:0,lo:[1e9,1e9,1e9],hi:[-1e9,-1e9,-1e9]};bb.set(L,b);}
        b.a+=A[o+t];for(let k=0;k<3;k++){b.lo[k]=Math.min(b.lo[k],g.c[t*3+k]);b.hi[k]=Math.max(b.hi[k],g.c[t*3+k]);}}
      /* the ring holds its centre: of the compact paints, the one spanning widest */
      let E=-1,ea=0;for(const [L,b] of bb){const dg=Math.hypot(b.hi[0]-b.lo[0],b.hi[1]-b.lo[1],b.hi[2]-b.lo[2]);if(dg<20&&b.a>0.002*all&&dg>ea){ea=dg;E=L;}}
      if(E>=0){let cx2=0,cy2=0,cz2=0,nx=0,ny=0,nz=0,w=0;for(let t=0;t<n;t++)if(S.label[o+t]===E){const a=A[o+t];cx2+=g.c[t*3]*a;cy2+=g.c[t*3+1]*a;cz2+=g.c[t*3+2]*a;nx+=g.fn[t*3]*a;ny+=g.fn[t*3+1]*a;nz+=g.fn[t*3+2]*a;w+=a;}
        cx2/=w;cy2/=w;cz2/=w;const nl=Math.hypot(nx,ny,nz);nx/=nl;ny/=nl;nz/=nl;
        const rad=t=>{const dx=g.c[t*3]-cx2,dy=g.c[t*3+1]-cy2,dz=g.c[t*3+2]-cz2,d=dx*nx+dy*ny+dz*nz;return [Math.hypot(dx-d*nx,dy-d*ny,dz-d*nz),d];};
        const rs=[];for(let t=0;t<n;t++)if(S.label[o+t]===E)rs.push(rad(t)[0]);rs.sort((p,q)=>p-q);const R0=rs[Math.floor(rs.length*0.96)],R=R0*1.04+0.3;
        /* the disc's own centre paint (black hawk) stays */
        const inner=new Map();for(let t=0;t<n;t++){const [r,d]=rad(t);if(r<0.6*R&&Math.abs(d)<4){const L=S.label[o+t];if(L!==E)inner.set(L,(inner.get(L)||0)+A[o+t]);}}
        let IC=-1,iv=0;for(const [L,x] of inner)if(x>iv){iv=x;IC=L;}
        for(let t=0;t<n;t++){const [r,d]=rad(t);const L=S.label[o+t];const front=g.fn[t*3]*nx+g.fn[t*3+1]*ny+g.fn[t*3+2]*nz>-0.2;
          if(r<=R&&d>-0.8&&front&&L!==E&&L!==IC){S.label[o+t]=E;embFix++;}}
        for(let it=0;it<20;it++){const ch=[];for(let t=0;t<n;t++){if(S.label[o+t]!==E)continue;const [r,d]=rad(t);if(r<=R0+0.15||(r<=R+0.15&&d>-0.8))continue;const m=new Map();
            for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&S.label[o+u]!==E)m.set(S.label[o+u],(m.get(S.label[o+u])||0)+1);}let b=-1,bv=0;for(const [L,x] of m)if(x>bv){bv=x;b=L;}if(b>=0)ch.push([t,b]);}
          if(!ch.length)break;for(const [t,b] of ch)S.label[o+t]=b;embFix+=ch.length;}}}
    /* the strap again after the spill went: a notch the green left on one side is filled from the other */
    if(strapT>=0)for(let t=0;t<n;t++){if(S.label[o+t]!==main)continue;const [j,d]=G.near(g.c[t*3],g.c[t*3+1],g.c[t*3+2],4);if(j<0||d>1.0)continue;
      if(-g.fn[t*3]*g.fn[j*3]+g.fn[t*3+1]*g.fn[j*3+1]+g.fn[t*3+2]*g.fn[j*3+2]<0.5)continue;if(S.label[o+j]===strapT){S.label[o+t]=strapT;add++;}}
    /* bands */
    let z0=Infinity,z1=-Infinity;for(let t=0;t<n;t++){z0=Math.min(z0,g.c[t*3+2]);z1=Math.max(z1,g.c[t*3+2]);}
    const SL=0.5,nS=Math.ceil((z1-z0)/SL)+1,sl=[...Array(nS)].map(()=>new Map()),sa=new Float64Array(nS);
    for(let t=0;t<n;t++){const k=Math.floor((g.c[t*3+2]-z0)/SL),L=S.label[o+t];sl[k].set(L,(sl[k].get(L)||0)+A[o+t]);sa[k]+=A[o+t];}
    let band=0;for(let k=0;k<nS;k++){let b=-1,bv=0;for(const [L,x] of sl[k])if(x>bv){bv=x;b=L;}if(b===main||bv<0.5*sa[k])continue;
      for(let t=0;t<n;t++){if(Math.floor((g.c[t*3+2]-z0)/SL)!==k)continue;if(S.label[o+t]!==b&&S.label[o+t]!==main&&S.label[o+t]!==strapT){S.label[o+t]=b;band++;}}}
    /* a belt's top ledge (faces looking up, right next to the belt) is belt, up to the crease with the body */
    let ledge=0;{const B=new Set();for(let k=0;k<nS;k++){let b=-1,bv=0;for(const [L,x] of sl[k])if(x>bv){bv=x;b=L;}if(b!==main&&b!==strapT&&bv>=0.5*sa[k]&&k<nS/2)B.add(b);}
      for(const Bp of B)for(let it=0;it<6;it++){const ch=[];for(let t=0;t<n;t++){if(S.label[o+t]!==main||g.fn[t*3+2]<0.45)continue;
          for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&S.label[o+u]===Bp){ch.push(t);break;}}}if(!ch.length)break;for(const t of ch)S.label[o+t]=Bp;ledge+=ch.length;}}
    /* the belt's top edge, round the body: in each 3 degree column the belt reaches a height (the median of
       its highest faces, smoothed with the columns beside it); body paint below it is belt, belt above it is body */
    let edge=0;{let cx=0,cy=0;for(let t=0;t<n;t++){cx+=g.c[t*3];cy+=g.c[t*3+1];}cx/=n;cy/=n;
      const NB=120,ang=t=>Math.floor(((Math.atan2(g.c[t*3+1]-cy,g.c[t*3]-cx)+Math.PI)/(2*Math.PI))*NB)%NB;
      const B=new Set();for(let k=0;k<nS;k++){let b=-1,bv=0;for(const [L,x] of sl[k])if(x>bv){bv=x;b=L;}if(b!==main&&b!==strapT&&bv>=0.5*sa[k]&&k<nS/2)B.add(b);}
      for(const Bp of B){/* belt height range */let bz0=Infinity,bz1=-Infinity;for(let k=0;k<nS;k++){let b=-1,bv=0;for(const [L,x] of sl[k])if(x>bv){bv=x;b=L;}if(b===Bp&&bv>=0.5*sa[k]){bz0=Math.min(bz0,z0+k*SL);bz1=Math.max(bz1,z0+(k+1)*SL);}}
        const col=[...Array(NB)].map(()=>[]);for(let t=0;t<n;t++){if(S.label[o+t]!==Bp)continue;const z=g.c[t*3+2];if(z<bz0-1||z>bz1+3)continue;col[ang(t)].push(z);}
        const top=new Float32Array(NB).fill(NaN);for(let k=0;k<NB;k++){const a=col[k].sort((p,q)=>p-q);if(a.length<5)continue;top[k]=a[Math.floor(a.length*0.95)];}
        const sm=new Float32Array(NB);for(let k=0;k<NB;k++){const w=[];for(let d=-2;d<=2;d++){const x=top[(k+d+NB)%NB];if(!isNaN(x))w.push(x);}w.sort((p,q)=>p-q);sm[k]=w.length?w[w.length>>1]:NaN;}
        for(let t=0;t<n;t++){const z=g.c[t*3+2];if(z<bz0-1||z>bz1+3)continue;const tz=sm[ang(t)];if(isNaN(tz))continue;const L=S.label[o+t];
          if(L===main&&z<tz){S.label[o+t]=Bp;edge++;}else if(L===Bp&&z>tz+0.5){S.label[o+t]=main;edge++;}}}
      /* the bottom of the belt: below it the plug steps in. Belt paint grows down over faces that stand as far
         out as the belt does in their column (within 1.2 mm), so the lower rim of the belt and buckle is belt */
      const lowest=new Set();for(let t=0;t<n;t++)if(g.c[t*3+2]<z0+1.5)lowest.add(S.label[o+t]);
      for(const Bp of B){if(lowest.has(Bp))continue;const rr=t=>Math.hypot(g.c[t*3]-cx,g.c[t*3+1]-cy);const col=[...Array(NB)].map(()=>[]);
        const czs=[...Array(NB)].map(()=>[]);for(let t=0;t<n;t++)if(S.label[o+t]===Bp){col[ang(t)].push(rr(t));czs[ang(t)].push(g.c[t*3+2]);}const med=new Float32Array(NB).fill(NaN),zlo=new Float32Array(NB).fill(NaN);
        for(let k=0;k<NB;k++){const a=col[k].sort((p,q)=>p-q);if(a.length>=5)med[k]=a[a.length>>1];const zz=czs[k].sort((p,q)=>p-q);if(zz.length>=5)zlo[k]=zz[Math.floor(zz.length*0.05)];}
        for(let it=0;it<40;it++){const ch=[];for(let t=0;t<n;t++){const L=S.label[o+t];if(L===Bp||L===main||L===strapT)continue;const m=med[ang(t)],zl=zlo[ang(t)];if(isNaN(m)||g.c[t*3+2]<zl-2||(rr(t)<m-0.8&&g.fn[t*3+2]>-0.5))continue;
            for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&S.label[o+u]===Bp){ch.push(t);break;}}}if(!ch.length)break;for(const t of ch)S.label[o+t]=Bp;edge+=ch.length;}
        /* straighten the bottom: each column's lowest belt height, smoothed across 27 degrees so a notch takes its neighbours' line */
        const zb=[...Array(NB)].map(()=>[]);for(let t=0;t<n;t++)if(S.label[o+t]===Bp&&rr(t)>=med[ang(t)]-0.8)zb[ang(t)].push(g.c[t*3+2]);
        const bl=new Float32Array(NB).fill(NaN);for(let k=0;k<NB;k++){const a=zb[k].sort((p,q)=>p-q);if(a.length>=5)bl[k]=a[Math.floor(a.length*0.05)];}
        const bs=new Float32Array(NB);for(let k=0;k<NB;k++){const w=[];for(let d=-4;d<=4;d++){const x=bl[(k+d+NB)%NB];if(!isNaN(x))w.push(x);}w.sort((p,q)=>p-q);bs[k]=w.length?w[w.length>>1]:NaN;}
        for(let t=0;t<n;t++){const k=ang(t),z=g.c[t*3+2],L=S.label[o+t];if(isNaN(bs[k])||isNaN(med[k]))continue;
          if(L!==Bp&&L!==main&&L!==strapT&&z>=bs[k]-0.2&&z<=bs[k]+3&&rr(t)>=med[k]-0.8){S.label[o+t]=Bp;edge++;}}
        for(let it=0;it<10;it++){const ch=[];for(let t=0;t<n;t++){if(S.label[o+t]!==Bp)continue;const k=ang(t);if(isNaN(bs[k])||g.c[t*3+2]>=bs[k]-0.6)continue;
            const m=new Map();for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&S.label[o+u]!==Bp)m.set(S.label[o+u],(m.get(S.label[o+u])||0)+1);}let b=-1,bv=0;for(const [L,x] of m)if(x>bv){bv=x;b=L;}if(b>=0)ch.push([t,b]);}
          if(!ch.length)break;for(const [t,b] of ch)S.label[o+t]=b;edge+=ch.length;}}}
    rep.push(S.parts[pi].name.replace(/^.*?_\d+_/,"")+" strap+"+add+" band"+band+" ledge"+ledge+" edge"+edge+" fringe"+fr+" emb"+embFix);}
  (window._spcDbg=window._spcDbg||{}).torso=rep;}
/* torso borders onto the sculpt: the belt's top edge (belt paint against the body paint) and the feather fringe
   (above the emblem, so a harness strap below it is never cut away) */
function torsoEdges(active,regM){
  for(const pi of active){if(!/(torso|chest|body)/i.test(S.parts[pi].name))continue;
    const g=pieceGeo(pi,regM),o=S.offs[pi],n=g.n,A=S.area;const tot=new Map();for(let t=0;t<n;t++){const L=S.label[o+t];tot.set(L,(tot.get(L)||0)+A[o+t]);}
    const byA=[...tot].sort((x,y)=>y[1]-x[1]).map(([L])=>L);const main=byA[0];
    /* green: emblem; its lowest point bounds the feather zone */
    let zE=Infinity,z0=Infinity;const rgb=L=>{try{return C.PAL[S.regions[L].fil].hex;}catch(e){return "";}};
    for(let t=0;t<n;t++)z0=Math.min(z0,g.c[t*3+2]);
    /* emblem = the paint whose faces sit highest on the front outside the main two... use the smallest paint above mid height */
    let mid=0;for(let t=0;t<n;t++)mid+=g.c[t*3+2];mid/=n;
    const hi=new Map();for(let t=0;t<n;t++)if(g.c[t*3+2]>mid){const L=S.label[o+t];hi.set(L,(hi.get(L)||0)+A[o+t]);}
    let emb=-1,ev=Infinity;for(const [L,a] of hi)if(L!==main&&a>0.002*[...tot.values()].reduce((p,q)=>p+q,0)&&(tot.get(L)||0)<ev&&byA.indexOf(L)>1){ev=tot.get(L);emb=L;}
    if(emb>=0)for(let t=0;t<n;t++)if(S.label[o+t]===emb)zE=Math.min(zE,g.c[t*3+2]);
    snapMainToRidges([pi],3,{pair:(a,b)=>a===main||b===main});
    (window._spcDbg=window._spcDbg||{}).torsoEdges={emb,zE:+zE.toFixed(1),mid:+mid.toFixed(1)};}}
/* faces in figure space for each piece */
function pieceGeo(pi,regM){const p=S.parts[pi],M=regM&&regM[pi]?C.mul4(regM[pi],p.M):p.M,v=C.xf(M,p.m.v),f=p.m.f,n=f.length/3,fn=C.faceNormals(p.m,M),c=new Float32Array(n*3);
  for(let t=0;t<n;t++)for(let k=0;k<3;k++)c[t*3+k]=(v[f[t*3]*3+k]+v[f[t*3+1]*3+k]+v[f[t*3+2]*3+k])/3;return {pi,v,f,n,fn,c};}
/* hidden: faces pressed against another piece (joints, sockets, pin holes), and soles on the ground */
/* two versions of the same part in one place (a rigid leg and the jointed leg it replaces) never touch or
   hide each other: they are never assembled together */
function samePlace(geo){const dup=new Set();
  for(const A of geo)for(const B of geo){if(A===B)continue;if(!B.Gd)B.Gd=C.grid(B.c,0.8);let same=0,tried=0;
    for(let t=0;t<A.n;t+=Math.max(1,Math.floor(A.n/300))){tried++;const [j,d]=B.Gd.near(A.c[t*3],A.c[t*3+1],A.c[t*3+2],2);if(j>=0&&d<0.8)same++;}
    if(same>0.35*tried){dup.add(A.pi+"|"+B.pi);dup.add(B.pi+"|"+A.pi);}}
  (window._spcDbg=window._spcDbg||{}).samePlace=[...dup];return dup;}
function markContacts(active,regM,hid,fz0,fz1){
  const gnd=new Uint8Array(S.nFaces),geo=active.map(pi=>pieceGeo(pi,regM));
  const box=g=>{const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let i=0;i<g.c.length;i+=3)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],g.c[i+k]);hi[k]=Math.max(hi[k],g.c[i+k]);}return {lo,hi};};
  geo.forEach(g=>{g.b=box(g);g.G=null;});
  const near=1.2,dup=samePlace(geo);let nc=0,ng=0;
  for(const A of geo){const o=S.offs[A.pi];
    for(let t=0;t<A.n;t++)if(A.fn[t*3+2]<-0.8&&A.c[t*3+2]<fz0+0.025*(fz1-fz0)){hid[o+t]=1;gnd[o+t]=1;ng++;}
    /* touching, or covered: looking straight out from the face, another piece is right there facing back */
    const reach=3;
    for(const B of geo){const self=B===A;if(dup.has(A.pi+"|"+B.pi))continue;
      if(!self&&[0,1,2].some(k=>A.b.lo[k]>B.b.hi[k]+reach||A.b.hi[k]<B.b.lo[k]-reach))continue;
      if(!B.G)B.G=C.grid(B.c,0.6);
      for(let t=0;t<A.n;t++){if(hid[o+t])continue;const x=A.c[t*3],y=A.c[t*3+1],z=A.c[t*3+2],nx=A.fn[t*3],ny=A.fn[t*3+1],nz=A.fn[t*3+2];
        if([x,y,z].some((w,k)=>w<B.b.lo[k]-reach||w>B.b.hi[k]+reach))continue;
        for(let s2=self?1:0;s2<=(self?2:reach);s2+=1){const r=s2===0?near:0.8,[j,d]=B.G.near(x+nx*s2,y+ny*s2,z+nz*s2,2);if(j<0||d>r)continue;
          if(nx*B.fn[j*3]+ny*B.fn[j*3+1]+nz*B.fn[j*3+2]<-0.2){hid[o+t]=1;nc++;break;}}}}}
  (window._spcDbg=window._spcDbg||{}).contacts=[nc,ng];
  return gnd;
}
/* a sole takes the boot's own color: the paint covering most of the foot just above it (black on a black
   boot), not a trim strap that happens to run along its edge */
function groundFill(active,gnd){
  for(const pi of active){const o=S.offs[pi],n=S.parts[pi].m.f.length/3,p=S.parts[pi];let any=false;for(let t=0;t<n;t++)if(gnd[o+t]){any=true;break;}if(!any)continue;
    const v=C.xf(p.M,p.m.v),f=p.m.f;const cz=t=>(v[f[t*3]*3+2]+v[f[t*3+1]*3+2]+v[f[t*3+2]*3+2])/3;
    let z0=Infinity;for(let t=0;t<n;t++)if(gnd[o+t])z0=Math.min(z0,cz(t));
    const vote=new Map();for(let t=0;t<n;t++){if(gnd[o+t])continue;const z=cz(t);if(z<z0||z>z0+12)continue;const L=S.label[o+t];if(L>=0)vote.set(L,(vote.get(L)||0)+S.area[o+t]);}
    let b=-1,bv=0;for(const [L,x] of vote)if(x>bv){bv=x;b=L;}if(b<0)continue;
    for(let t=0;t<n;t++)if(gnd[o+t])S.label[o+t]=b;}
}
/* ---------- the photos ---------- */
async function readPhoto(file){
  S.photoC=S.photoC||new Map();if(S.photoC.has(file))return S.photoC.get(file);
  const bmp=await createImageBitmap(file),sc=Math.min(1,1100/bmp.height),W=Math.round(bmp.width*sc),H=Math.round(bmp.height*sc);
  const cv=new OffscreenCanvas(W,H),cx=cv.getContext("2d");cx.drawImage(bmp,0,0,W,H);const im=cx.getImageData(0,0,W,H).data;
  const L0=new Float32Array(W*H*3);for(let i=0;i<W*H;i++){const l=C.lab(im[i*4]/255,im[i*4+1]/255,im[i*4+2]/255);L0[i*3]=l[0];L0[i*3+1]=l[1];L0[i*3+2]=l[2];}
  const L=new Float32Array(W*H*3),edge=new Float32Array(W*H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){let a=0,b=0,c=0,m=0;
    for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const xx=Math.min(W-1,Math.max(0,x+i)),yy=Math.min(H-1,Math.max(0,y+j)),o=(yy*W+xx)*3;a+=L0[o];b+=L0[o+1];c+=L0[o+2];m++;}
    const o=(y*W+x)*3;L[o]=a/m;L[o+1]=b/m;L[o+2]=c/m;}
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const o=(y*W+x)*3;let e=0;
    for(const d of [3,-3,W*3,-W*3])e=Math.max(e,Math.hypot(L0[o]-L0[o+d],L0[o+1]-L0[o+d+1],L0[o+2]-L0[o+d+2]));edge[y*W+x]=e;}
  /* background: the color round the border */
  const bs=[[],[],[]];const push=(x,y)=>{const o=(y*W+x)*3;bs[0].push(L[o]);bs[1].push(L[o+1]);bs[2].push(L[o+2]);};
  for(let x=0;x<W;x+=3){push(x,2);push(x,H-3);}for(let y=0;y<H;y+=3){push(2,y);push(W-3,y);}
  const bg=bs.map(a=>a.sort((p,q)=>p-q)[a.length>>1]);
  const fg=new Uint8Array(W*H),rows=new Int32Array(H),cols=new Int32Array(W);
  /* background is backdrop-colored AND joined to the photo's border: white paint inside the figure is figure */
  {const near=j=>Math.hypot(L[j*3]-bg[0],L[j*3+1]-bg[1],L[j*3+2]-bg[2])<=14,bgm=new Uint8Array(W*H),st=[];
   const push2=j=>{if(!bgm[j]&&near(j)){bgm[j]=1;st.push(j);}};
   for(let x=0;x<W;x++){push2(x);push2((H-1)*W+x);}for(let y=0;y<H;y++){push2(y*W);push2(y*W+W-1);}
   while(st.length){const j=st.pop(),x=j%W,y=(j/W)|0;if(x>0)push2(j-1);if(x<W-1)push2(j+1);if(y>0)push2(j-W);if(y<H-1)push2(j+W);}
   for(let j=0;j<W*H;j++)if(!bgm[j]){fg[j]=1;rows[(j/W)|0]++;cols[j%W]++;}}
  let x0=0,x1=W-1,y0=0,y1=H-1;while(x0<W&&cols[x0]<3)x0++;while(x1>0&&cols[x1]<3)x1--;while(y0<H&&rows[y0]<3)y0++;while(y1>0&&rows[y1]<3)y1--;
  /* distance from every pixel to the figure's outline in the photo (chamfer 3-4) */
  const dt=new Float32Array(W*H).fill(1e9);
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const j=y*W+x;if(fg[j]&&(!fg[j-1]||!fg[j+1]||!fg[j-W]||!fg[j+W]))dt[j]=0;}
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const j=y*W+x;dt[j]=Math.min(dt[j],dt[j-1]+3,dt[j-W]+3,dt[j-W-1]+4,dt[j-W+1]+4);}
  for(let y=H-2;y>0;y--)for(let x=W-2;x>0;x--){const j=y*W+x;dt[j]=Math.min(dt[j],dt[j+1]+3,dt[j+W]+3,dt[j+W+1]+4,dt[j+W-1]+4);}
  for(let j=0;j<W*H;j++)dt[j]/=3;
  const ph={W,H,L,edge,fg,dt,box:[x0,y0,x1,y1],name:file.name,rgb:Uint8Array.from(im.filter((_,k)=>k%4!==3))};S.photoC.set(file,ph);return ph;
}
/* the paints, read off the photos: the figure's pixels (not edges, not the backdrop) grouped by color.
   A darker twin of a color is its shadow, a paler one its shine: both fold into it */
window._spcPhotoPal=f=>photoPalette(f);
async function photoPalette(files){
  const Ls=[],Rs=[],Pos=[],dims=[];for(const f of files.slice(0,6)){const ph=await readPhoto(f),pi2=dims.length;dims.push([Math.ceil(ph.W/2),Math.ceil(ph.H/2)]);
    for(let y=0;y<ph.H;y+=2)for(let x=0;x<ph.W;x+=2){const j=y*ph.W+x;if(!ph.fg[j]||ph.edge[j]>10)continue;Ls.push(ph.L[j*3],ph.L[j*3+1],ph.L[j*3+2]);Rs.push(ph.rgb[j*3],ph.rgb[j*3+1],ph.rgb[j*3+2]);Pos.push(pi2,x>>1,y>>1);}}
  const N=Ls.length/3;if(N<100)return [];const L=Float32Array.from(Ls);
  /* k-means seeded far apart, so a small but distinct paint (a face, an eye) gets its own center */
  const K=24,cents=[[L[0],L[1],L[2]]],dmin=new Float32Array(N).fill(Infinity),step0=Math.max(1,Math.floor(N/60000));
  while(cents.length<K){const c=cents[cents.length-1];let bi=0,bd=-1;for(let i=0;i<N;i+=step0){const d=(L[i*3]-c[0])**2+(L[i*3+1]-c[1])**2+(L[i*3+2]-c[2])**2;if(d<dmin[i])dmin[i]=d;if(dmin[i]>bd){bd=dmin[i];bi=i;}}cents.push([L[bi*3],L[bi*3+1],L[bi*3+2]]);}
  for(let it=0;it<12;it++){const acc=cents.map(()=>[0,0,0,0]);for(let i=0;i<N;i+=step0){let b=0,bd=Infinity;for(let c=0;c<K;c++){const d=(L[i*3]-cents[c][0])**2+(L[i*3+1]-cents[c][1])**2+(L[i*3+2]-cents[c][2])**2;if(d<bd){bd=d;b=c;}}const a=acc[b];a[0]+=L[i*3];a[1]+=L[i*3+1];a[2]+=L[i*3+2];a[3]++;}
    acc.forEach((a,c)=>{if(a[3])cents[c]=[a[0]/a[3],a[1]/a[3],a[2]/a[3]];});}
  const cl=cents.map(()=>({r:0,g:0,b:0,n:0}));
  const asg=new Int16Array(N);
  for(let i=0;i<N;i++){let b=0,bd=Infinity;for(let c=0;c<cents.length;c++){const d=(L[i*3]-cents[c][0])**2+(L[i*3+1]-cents[c][1])**2+(L[i*3+2]-cents[c][2])**2;if(d<bd){bd=d;b=c;}}asg[i]=b;const q=cl[b];q.r+=Rs[i*3];q.g+=Rs[i*3+1];q.b+=Rs[i*3+2];q.n++;}
  /* how solid each color is in the photos: a blur between two paints is a thin seam, a paint fills areas */
  const grids=dims.map(([w,h])=>new Int16Array(w*h).fill(-1));for(let i=0;i<N;i++){const [p,x,y]=[Pos[i*3],Pos[i*3+1],Pos[i*3+2]];grids[p][y*dims[p][0]+x]=asg[i];}
  const solidOf=ks=>{const K=new Set(ks);let tot=0,inn=0;grids.forEach((g,p)=>{const [w,h]=dims[p];for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){const c=g[y*w+x];if(c<0||!K.has(c))continue;tot++;
      let all=true;for(const [dx,dy] of [[2,0],[-2,0],[0,2],[0,-2]]){const c2=g[(y+dy)*w+x+dx];if(c2<0||!K.has(c2)){all=false;break;}}if(all)inn++;}});return tot?inn/tot:0;};
  let G=cl.map((q,k)=>({rgb:q.n?[q.r/q.n/255,q.g/q.n/255,q.b/q.n/255]:[0,0,0],area:q.n,ks:[k]})).filter(q=>q.area>0);
  const twin=(A,B)=>{const a=C.lab(...A.rgb),b=C.lab(...B.rgb);
    if(C.dE(a,b)<(a[0]<35&&b[0]<35?6:10))return true; /* among darks a small step (black to brown) is a different paint */
    const [big,small,lb,ls]=A.area>=B.area?[A,B,a,b]:[B,A,b,a],cB=Math.hypot(lb[1],lb[2]),cS=Math.hypot(ls[1],ls[2]);
    {let dh0=Math.abs(Math.atan2(lb[2],lb[1])-Math.atan2(ls[2],ls[1]))*180/Math.PI;if(dh0>180)dh0=360-dh0;if(dh0<12&&cS>25&&cB>25&&Math.min(cS,cB)>0.75*Math.max(cS,cB)&&Math.abs(ls[0]-lb[0])<30)return true;} /* the same paint lit and shaded */
    if(small.area>0.5*big.area||cB<20)return false;
    let dh=Math.abs(Math.atan2(lb[2],lb[1])-Math.atan2(ls[2],ls[1]))*180/Math.PI;if(dh>180)dh=360-dh;
    if(dh<14&&ls[0]<lb[0]-8&&cS>0.62*cB)return true;          /* shadow: darker, still as colored */
    if(dh<10&&ls[0]>lb[0]+8&&cS<cB&&cS>0.6*cB)return true;   /* shine: lighter, still as colored */
    return false;};
  /* a black and its sheen: both nearly gray, the darker one very dark */
  const sheen=(A,B)=>{const a=C.lab(...A.rgb),b=C.lab(...B.rgb),ca=Math.hypot(a[1],a[2]),cb=Math.hypot(b[1],b[2]);
    if(ca>6||cb>6||a[2]>1.5||b[2]>1.5)return false;const [dk,lt]=a[0]<=b[0]?[a,b]:[b,a],[DK,LT]=a[0]<=b[0]?[A,B]:[B,A];return dk[0]<25&&lt[0]<36&&LT.area<2*DK.area;}; /* only cool/neutral darks: a warm dark (brown hair) is its own paint; lighter grays are sorted out in the photo itself */ /* a silver (lighter than this) is its own paint */
  /* pale gray glare on a colored paint: lighter, much grayer, and smaller */
  const glare=(A,B)=>{const a=C.lab(...A.rgb),b=C.lab(...B.rgb);const [big,sm,lb,ls]=A.area>=B.area?[A,B,a,b]:[B,A,b,a];
    const cB=Math.hypot(lb[1],lb[2]),cS=Math.hypot(ls[1],ls[2]);if(cB<25||sm.area>0.35*big.area||ls[0]<lb[0]+10||ls[0]<75)return false; /* glare is near white; skin (darker) is a paint */
    let dh=Math.abs(Math.atan2(lb[2],lb[1])-Math.atan2(ls[2],ls[1]))*180/Math.PI;if(dh>180)dh=360-dh;if(!(dh<15&&cS>0.15*cB&&cS<0.45*cB))return false;if(sm.solid==null)sm.solid=solidOf(sm.ks);return sm.solid<0.45;}; /* glare is streaks and spots; a solid pale area (a face) is skin */ /* skin next to red is no glare: its hue is off */
  for(;;){let m=null;for(let i=0;i<G.length&&!m;i++)for(let j=i+1;j<G.length;j++)if(twin(G[i],G[j])||sheen(G[i],G[j])||glare(G[i],G[j])){m=[i,j];break;}
    if(!m)break;const A=G[m[0]],B=G[m[1]],[big,small]=A.area>=B.area?[A,B]:[B,A];
    /* a black is its darker tone: the lighter one is light on its gloss */
    {const lb=C.lab(...big.rgb),ls=C.lab(...small.rgb);if(Math.hypot(lb[1],lb[2])<8&&Math.hypot(ls[1],ls[2])<8&&lb[0]<40&&ls[0]<lb[0])big.rgb=small.rgb;}
    big.area+=small.area;big.ks.push(...small.ks);G=G.filter(x=>x!==small);}
  /* a color that lies between two others and covers less than either is where they blur together (orange
     between red and gold): its pixels go to the nearer of the two */
  for(let again=true;again;){again=false;const lb=G.map(g=>C.lab(...g.rgb));
    for(let x=0;x<G.length&&!again;x++)for(let a=0;a<G.length&&!again;a++)for(let b=a+1;b<G.length;b++){if(a===x||b===x||G[x].area>=Math.min(G[a].area,G[b].area))continue;if(Math.hypot(lb[x][1],lb[x][2])<12)continue;if(G[x].solid==null)G[x].solid=solidOf(G[x].ks);if(G[x].solid>0.3)continue; /* a solid area (skin) is a paint, not a seam */
      const A=lb[a],B=lb[b],X=lb[x],AB=[B[0]-A[0],B[1]-A[1],B[2]-A[2]],n2=AB[0]**2+AB[1]**2+AB[2]**2;if(n2<100)continue;
      const t=((X[0]-A[0])*AB[0]+(X[1]-A[1])*AB[1]+(X[2]-A[2])*AB[2])/n2;if(t<0.15||t>0.85)continue;
      if(Math.hypot(A[0]+t*AB[0]-X[0],A[1]+t*AB[1]-X[1],A[2]+t*AB[2]-X[2])>12)continue;
      const to=t<0.5?G[a]:G[b];to.area+=G[x].area;to.ks.push(...G[x].ks);G.splice(x,1);again=true;break;}}
  const tot=G.reduce((s,q)=>s+q.area,0);
  const big0=G.filter(q=>q.area>=0.004*tot),keep=G.filter(q=>q.area>=0.004*tot||(q.area>=0.0012*tot&&big0.every(b=>C.dE(C.lab(...b.rgb),C.lab(...q.rgb))>18))).sort((a,b)=>b.area-a.area) /* a small paint unlike every other (a face) stays */,out=keep.map(q=>q.rgb);
  /* every k-means color points at the paint it ended up in: a photo pixel reads as its paint, glare and sheen included */
  const parent=new Int32Array(cents.length).fill(-1);keep.forEach((q,i)=>q.ks.forEach(k=>parent[k]=i));
  const kl=keep.map(q=>C.lab(...q.rgb));for(let k=0;k<cents.length;k++)if(parent[k]<0){let b=0,bd=Infinity;kl.forEach((l,i)=>{const d=C.dE(l,cents[k]);if(d<bd){bd=d;b=i;}});parent[k]=b;}
  out.classify=(l0,l1,l2)=>{let b=0,bd=Infinity;for(let c=0;c<cents.length;c++){const d=(l0-cents[c][0])**2+(l1-cents[c][1])**2+(l2-cents[c][2])**2;if(d<bd){bd=d;b=c;}}return parent[b];};
  return out;
}
/* the figure seen from its side: camera on +x (d=1) or -x (d=-1). Same layout as figView, with y across */
function figViewSide(fv,d){const sw=fv.map(({v,f})=>{const w=new Float32Array(v.length);for(let i=0;i<v.length;i+=3){w[i]=d*v[i+1];w[i+1]=-d*v[i];w[i+2]=v[i+2];}return {v:w,f};});
  /* in the swapped frame x across is d*y and the camera sits on -y: figView(.., -1) */
  const V=figView(sw,-1);V.side=d;return V;}
/* the figure seen from the front (d=-1) or the back (d=+1): a depth map */
function figView(fv,d){
  let X0=Infinity,X1=-Infinity,Z0=Infinity,Z1=-Infinity;fv.forEach(({v})=>{for(let i=0;i<v.length;i+=3){X0=Math.min(X0,v[i]);X1=Math.max(X1,v[i]);Z0=Math.min(Z0,v[i+2]);Z1=Math.max(Z1,v[i+2]);}});
  const k=700/(Z1-Z0),RW=Math.ceil((X1-X0)*k)+2,RH=702,dep=new Float32Array(RW*RH).fill(Infinity);
  const sx=X=>(d<0?X-X0:X1-X)*k, sy=Z=>(Z1-Z)*k;
  fv.forEach(({v,f})=>{for(let t=0;t<f.length;t+=3){const a=f[t]*3,b=f[t+1]*3,c=f[t+2]*3;
    const ax=sx(v[a]),ay=sy(v[a+2]),bx=sx(v[b]),by=sy(v[b+2]),cxx=sx(v[c]),cy=sy(v[c+2]),az=-v[a+1]*d,bz=-v[b+1]*d,cz=-v[c+1]*d;
    const x0=Math.max(0,Math.floor(Math.min(ax,bx,cxx))),x1=Math.min(RW-1,Math.ceil(Math.max(ax,bx,cxx))),y0=Math.max(0,Math.floor(Math.min(ay,by,cy))),y1=Math.min(RH-1,Math.ceil(Math.max(ay,by,cy)));
    const den=(by-cy)*(ax-cxx)+(cxx-bx)*(ay-cy);if(Math.abs(den)<1e-9)continue;
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const w1=((by-cy)*(x-cxx)+(cxx-bx)*(y-cy))/den,w2=((cy-ay)*(x-cxx)+(ax-cxx)*(y-cy))/den,w3=1-w1-w2;
      if(w1<-0.01||w2<-0.01||w3<-0.01)continue;const z=w1*az+w2*bz+w3*cz,o=y*RW+x;if(z<dep[o])dep[o]=z;}}});
  let fx0=RW,fx1=0,fy0=RH,fy1=0;for(let y=0;y<RH;y++)for(let x=0;x<RW;x++)if(dep[y*RW+x]<Infinity){if(x<fx0)fx0=x;if(x>fx1)fx1=x;if(y<fy0)fy0=y;if(y>fy1)fy1=y;}
  return {d,dep,RW,RH,sx,sy,fx0,fx1,fy0,fy1};
}
/* photos only, no colored model: each face takes the color the front or back photo shows where it sits on the
   figure (the figure's outline fitted to the photo's), from whichever photo faces it more squarely. Faces no
   photo sees take the color of the nearest face that one does. photoGuide then fits each piece more closely. */
async function photoProject(files,fig,active,regM){
  const fv=fig.map(p=>({v:C.xf(p.M,p.m.v),f:p.m.f})),views={"-1":figView(fv,-1),"1":figView(fv,1)};
  const photos=[];for(const f of files.slice(0,6))photos.push(await readPhoto(f));
  const iF=photos.findIndex(ph=>/front/i.test(ph.name)),iB=photos.findIndex(ph=>/back|rear|behind/i.test(ph.name));
  const use=[[iF>=0?iF:0,-1]];if(iB>=0&&iB!==use[0][0])use.push([iB,1]);else if(iF<0&&photos.length===2)use.push([1,1]);
  /* side photos (left / right in the name) come after front and back, which tell which side each one shows */
  const sides=photos.map((ph,i)=>i).filter(i=>/left|right|side/i.test(photos[i].name)&&!use.some(u2=>u2[0]===i));
  const rgb=new Float32Array(S.nFaces*3).fill(-1),wt=new Float32Array(S.nFaces);let pal=null;try{pal=await photoPalette(files);}catch(e){}
  /* each photo pixel read as a paint. Glare on a gloss black reads as a gray paint (silver): a gray patch that is
     mostly ringed by black, within a few percent of the photo, is the black's glare. A silver belt is wide and stays */
  const cmaps=photos.map(()=>null);
  const classOf=(pIdx,j)=>{if(!cmaps[pIdx]){const ph=photos[pIdx],W=ph.W,H=ph.H,cm=new Int16Array(W*H).fill(-1);
      for(let i=0;i<W*H;i++)if(ph.fg[i])cm[i]=pal.classify(ph.L[i*3],ph.L[i*3+1],ph.L[i*3+2]);
      const pl=pal.map(c=>C.lab(...c)),gray=pl.map(l=>Math.hypot(l[1],l[2])<10&&l[0]>38),dark=pl.map((l,i)=>!gray[i]&&l[0]<40&&Math.hypot(l[1],l[2])<20);
      if(dark.some(x=>x)&&gray.some(x=>x)){const r=Math.max(4,Math.round(0.02*H)),I=(c)=>{const S2=new Int32Array((W+1)*(H+1));for(let y=0;y<H;y++){let run=0;for(let x=0;x<W;x++){run+=cm[y*W+x]===c?1:0;S2[(y+1)*(W+1)+x+1]=S2[y*(W+1)+x+1]+run;}}return S2;};
        const box=(S2,x,y)=>{const x0=Math.max(0,x-r),y0=Math.max(0,y-r),x1=Math.min(W,x+r+1),y1=Math.min(H,y+r+1);return S2[y1*(W+1)+x1]-S2[y0*(W+1)+x1]-S2[y1*(W+1)+x0]+S2[y0*(W+1)+x0];};
        const Sd=new Map(),Sg=new Map();pl.forEach((_,i)=>{if(dark[i])Sd.set(i,I(i));else if(gray[i])Sg.set(i,I(i));});const out=cm.slice();
        for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x,c=cm[i];if(c<0||!gray[c])continue;const ng=box(Sg.get(c),x,y);let bd=-1,bn=0;for(const [k,S2] of Sd){const nk=box(S2,x,y);if(nk>bn){bn=nk;bd=k;}}if(bd>=0&&bn>1.2*ng)out[i]=bd;}
        cmaps[pIdx]=out;}else cmaps[pIdx]=cm;}
    return cmaps[pIdx][j];};
  /* a view: front/back (axis y) or side (axis x). For a face: where it lands across, its depth, how squarely it faces the camera */
  const geos=active.map(pi=>pieceGeo(pi,regM));
  const viewOf=(axis,d)=>{if(axis==="y")return {V:views[d],h:(X,Y)=>X,dp:(X,Y)=>-Y*d,cs:(g,t)=>g.fn[t*3+1]*d};
    const V=figViewSide(fv,d);return {V,h:(X,Y)=>d*Y,dp:(X,Y)=>-d*X,cs:(g,t)=>g.fn[t*3]*d};};
  const paint=async(pIdx,vw,dry)=>{const ph=photos[pIdx],V=vw.V,[px0,py0,px1,py1]=ph.box,s=(py1-py0)/Math.max(1,V.fy1-V.fy0),pcx=(px0+px1)/2,fcx=(V.fx0+V.fx1)/2;let agree=0,n=0;
    for(const g of geos){const o=S.offs[g.pi];
      for(let t=0;t<g.n;t++){const cs=vw.cs(g,t);if(cs<0.15)continue;if(!dry&&cs<=wt[o+t])continue;const X=g.c[t*3],Y=g.c[t*3+1],Z=g.c[t*3+2],H=vw.h(X,Y),rx=Math.round(V.sx(H)),ry=Math.round(V.sy(Z));
        if(rx<0||ry<0||rx>=V.RW||ry>=V.RH||vw.dp(X,Y)>V.dep[ry*V.RW+rx]+4)continue; /* a part may sit a few mm inside the whole figure */
        const x=Math.round(pcx+(V.sx(H)-fcx)*s),y=Math.round(py0+(V.sy(Z)-V.fy0)*s);if(x<0||y<0||x>=ph.W||y>=ph.H)continue;const j=y*ph.W+x;if(!ph.fg[j])continue;
        const c=pal&&pal.classify?pal[classOf(pIdx,j)]:[ph.rgb[j*3]/255,ph.rgb[j*3+1]/255,ph.rgb[j*3+2]/255];
        if(dry){if(wt[o+t]>0.2){n++;if(Math.abs(c[0]-rgb[(o+t)*3])+Math.abs(c[1]-rgb[(o+t)*3+1])+Math.abs(c[2]-rgb[(o+t)*3+2])<0.15)agree++;}continue;}
        wt[o+t]=cs;for(let k=0;k<3;k++)rgb[(o+t)*3+k]=c[k];}}
    await tick();return n?agree/n:0;};
  if(pal&&pal.classify)for(let i=0;i<photos.length;i++){classOf(i,0);await tick();}
  for(const [pIdx,d] of use)await paint(pIdx,viewOf("y",d),false);
  /* each side photo: whichever side of the figure it agrees with where front/back already saw */
  const sideUse=[];for(const i of sides){const a=await paint(i,viewOf("x",1),true),b=await paint(i,viewOf("x",-1),true);sideUse.push([i,a>=b?1:-1,Math.max(a,b)]);}
  (window._spcDbg=window._spcDbg||{}).sides=sideUse.map(([i,d,a])=>photos[i].name+":"+d+":"+a.toFixed(2));
  if(!window._spcNoSides)for(const [i,d,a] of sideUse)if(a>0.3)await paint(i,viewOf("x",d),false);
  /* unseen faces: the nearest seen face's color */
  for(const pi of active){const o=S.offs[pi],n=S.parts[pi].m.f.length/3,nb=S.nb[pi],q=[];for(let t=0;t<n;t++)if(rgb[(o+t)*3]>=0)q.push(t);
    for(let h=0;h<q.length;h++){const t=q[h];for(let e=0;e<3;e++){const u2=nb[t*3+e];if(u2<0||rgb[(o+u2)*3]>=0)continue;for(let k=0;k<3;k++)rgb[(o+u2)*3+k]=rgb[(o+t)*3+k];q.push(u2);}}}
  return rgb;}
/* For every visible face: the photo's color there, and how much to trust it. Each piece is lined up on
   its own (shift, scale, a few degrees of turn), because a photo's pose is never exactly the model's. */
async function photoGuide(files,fig,active,regM,hid,Lraw){
  const dbg=(window._spcDbg=window._spcDbg||{});dbg.photos=[];
  const fv=fig.map(p=>({v:C.xf(p.M,p.m.v),f:p.m.f}));
  const views={"-1":figView(fv,-1),"1":figView(fv,1)};
  const photos=[];for(const f of files.slice(0,4))photos.push(await readPhoto(f));
  await tick();
  const geo=active.filter(pi=>!/pin|peg/.test(S.parts[pi].name.toLowerCase())).map(pi=>pieceGeo(pi,regM));
  const regLab=S.regions.map(r=>C.lab(...r.rgb));
  const mapper=(ph,V)=>{const [px0,py0,px1,py1]=ph.box,s=(py1-py0)/Math.max(1,V.fy1-V.fy0),pcx=(px0+px1)/2,fcx=(V.fx0+V.fx1)/2;
    return (X,Z)=>[pcx+(V.sx(X)-fcx)*s,py0+(V.sy(Z)-V.fy0)*s];};
  const look=(ph,x,y)=>{const xi=Math.round(x),yi=Math.round(y);if(xi<1||yi<1||xi>=ph.W-1||yi>=ph.H-1)return -1;return yi*ph.W+xi;};
  /* visible faces of a piece from a view */
  /* a piece's faces that sit on the figure's outline in this view: they must land on the photo's outline */
  const outlineOf=(g,V,toP)=>{const out=[],{dep,RW,RH}=V;
    for(let t=0;t<g.n;t++){const ny=g.fn[t*3+1];if(Math.abs(ny)>0.35)continue;const X=g.c[t*3],Y=g.c[t*3+1],Z=g.c[t*3+2],rx=Math.round(V.sx(X)),ry=Math.round(V.sy(Z));
      if(rx<2||ry<2||rx>=RW-2||ry>=RH-2)continue;if(-Y*V.d>dep[ry*RW+rx]+2)continue;
      let edge=false;for(let dy=-2;dy<=2&&!edge;dy++)for(let dx=-2;dx<=2;dx++)if(dep[(ry+dy)*RW+rx+dx]===Infinity){edge=true;break;}
      if(edge){const q=toP(X,Z);out.push([t,q[0],q[1]]);}}
    return out;};
  const seenBy=(g,V,toP)=>{const out=[],o=S.offs[g.pi];
    for(let t=0;t<g.n;t++){if(hid[o+t])continue;const cs=g.fn[t*3+1]*V.d;if(cs<0.35)continue;
      const X=g.c[t*3],Y=g.c[t*3+1],Z=g.c[t*3+2],rx=Math.round(V.sx(X)),ry=Math.round(V.sy(Z));
      if(rx<0||ry<0||rx>=V.RW||ry>=V.RH||-Y*V.d>V.dep[ry*V.RW+rx]+2)continue;const q=toP(X,Z);out.push([t,q[0],q[1],cs]);}
    return out;};
  /* which photo is the front and which the back: whichever way agrees with Meshy's colors */
  const score=photos.map(ph=>{const r={};for(const d of [-1,1]){const V=views[d],toP=mapper(ph,V),errs=[];
    for(const g of geo){const o=S.offs[g.pi];const sv=seenBy(g,V,toP);for(let k=0;k<sv.length;k+=7){const [t,x,y]=sv[k],j=look(ph,x,y);if(j<0)continue;
      const i=o+t,l=regLab[S.label[i]];errs.push(Math.min(60,Math.hypot(ph.L[j*3]-l[0],ph.L[j*3+1]-l[1],ph.L[j*3+2]-l[2])));}}
    errs.sort((a,b)=>a-b);r[d]=errs.length?errs[errs.length>>1]+errs[Math.floor(errs.length*0.75)]:Infinity;}return r;});
  const use=[];const isBack=ph=>/back|rear|behind/i.test(ph.name),isFront=ph=>/front/i.test(ph.name);
  const iF=photos.findIndex(isFront),iB=photos.findIndex(isBack);
  if(iF>=0&&iB>=0&&iF!==iB)use.push([iF,-1],[iB,1]);
  else if(photos.length>=2&&(isFront(photos[0])&&!isFront(photos[1])||isBack(photos[1])&&!isBack(photos[0]))){use.push([0,-1],[1,1]);}
  else if(photos.length>=2&&(isFront(photos[1])&&!isFront(photos[0])||isBack(photos[0])&&!isBack(photos[1]))){use.push([1,-1],[0,1]);}
  else if(photos.length===1)use.push([0,score[0][-1]<=score[0][1]*1.1?-1:1]);
  else{const a=score[0][-1]+score[1][1],b=score[0][1]+score[1][-1];if(a<=b)use.push([0,-1],[1,1]);else use.push([0,1],[1,-1]);}
  dbg.photos=photos.map((ph,i)=>({name:ph.name,size:[ph.W,ph.H],box:ph.box,score:[+score[i][-1].toFixed(1),+score[i][1].toFixed(1)]}));
  dbg.use=use;dbg.fits=[];
  /* per face and color: how far the photo is from that color, looking a few pixels round the spot, so a
     photo that is a hair off never wipes out a small detail like an eye. */
  const R0=S.regions.length,dist=new Float32Array(S.nFaces*R0).fill(40),w=new Float32Array(S.nFaces),sure=new Float32Array(S.nFaces*2).fill(-1);
  const offs=[[0,0]];for(const r of [2,4])for(let k=0;k<8;k++)offs.push([Math.round(r*Math.cos(k*Math.PI/4)),Math.round(r*Math.sin(k*Math.PI/4))]);
  const fitsOK=[],calS=photos.map(()=>({}));
  for(const [pIdx,d] of use){const ph=photos[pIdx],V=views[d],toP=mapper(ph,V),R=Math.round(0.035*ph.H);
    for(const g of geo){const o=S.offs[g.pi],svAll=seenBy(g,V,toP);
      /* a long piece (a whole leg, an arm) is lined up in sections: the boot can sit differently from the thigh */
      let z0=Infinity,z1=-Infinity;svAll.forEach(s=>{const z=g.c[s[0]*3+2];if(z<z0)z0=z;if(z>z1)z1=z;});
      const nch=Math.max(1,Math.min(3,Math.round((z1-z0)/35)));
      for(let ch=0;ch<nch;ch++){const lo=z0+(z1-z0)*ch/nch,hi=z0+(z1-z0)*(ch+1)/nch;
      const sv=svAll.filter(s=>{const z=g.c[s[0]*3+2];return z>=lo&&(ch===nch-1?z<=hi:z<hi);});if(sv.length<30)continue;
      let cx=0,cy=0;sv.forEach(s=>{cx+=s[1];cy+=s[2];});cx/=sv.length;cy/=sv.length;
      const sub=sv.filter((_,k)=>k%Math.max(1,Math.floor(sv.length/600))===0);
      const ol0=outlineOf(g,V,toP).filter(q=>{const z=g.c[q[0]*3+2];return z>=lo&&z<=hi;}),ol=ol0.filter((_,k)=>k%Math.max(1,Math.floor(ol0.length/300))===0),wo=nch>1?(window._spcOutlineW==null?1.2:window._spcOutlineW):0; /* long pieces, lined up in sections, also follow the outline */
      const err=(dx,dy,sc,rot)=>{const c=Math.cos(rot),s=Math.sin(rot);let e=0;
        for(const [t,x,y] of sub){const ux=x-cx,uy=y-cy,j=look(ph,cx+sc*(c*ux-s*uy)+dx,cy+sc*(s*ux+c*uy)+dy);
          if(j<0||!ph.fg[j]){e+=40;continue;}const l=regLab[S.label[o+t]];e+=Math.min(40,Math.hypot(ph.L[j*3]-l[0],ph.L[j*3+1]-l[1],ph.L[j*3+2]-l[2]));}
        e/=sub.length;
        if(ol.length>=15&&wo>0){let d=0;for(const [t,x,y] of ol){const ux=x-cx,uy=y-cy,j=look(ph,cx+sc*(c*ux-s*uy)+dx,cy+sc*(s*ux+c*uy)+dy);d+=j<0?15:Math.min(15,ph.dt[j]);}e+=wo*d/ol.length;}
        return e;};
      let best=[0,0,1,0],be=err(0,0,1,0);const e0=be;
      for(let dy=-R;dy<=R;dy+=3)for(let dx=-R;dx<=R;dx+=3){const e=err(dx,dy,1,0)+0.02*Math.hypot(dx,dy);if(e<be){be=e;best=[dx,dy,1,0];}}
      for(const sc of [0.94,0.97,1,1.03,1.06])for(const rd of [-6,-3,0,3,6]){const e=err(best[0],best[1],sc,rd*Math.PI/180);if(e<be){be=e;best=[best[0],best[1],sc,rd*Math.PI/180];}}
      {const [bx,by,bs,br]=best;for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const e=err(bx+dx,by+dy,bs,br);if(e<be){be=e;best=[bx+dx,by+dy,bs,br];}}}
      dbg.fits.push([S.parts[g.pi].name,d,+e0.toFixed(1),+be.toFixed(1),best.map(x=>+x.toFixed(2))]);
      if(window._spcOverlay){const [dx,dy,sc,rot]=best,c=Math.cos(rot),s=Math.sin(rot);window._spcOverlay(pIdx,S.parts[g.pi].name,sub.map(([t,x,y])=>{const ux=x-cx,uy=y-cy;return [cx+sc*(c*ux-s*uy)+dx,cy+sc*(s*ux+c*uy)+dy,S.regions[S.label[o+t]].rgb];}),[ph.W,ph.H]);}
      if(be>32+wo*4)continue; /* this photo doesn't line up with this piece */
      fitsOK.push({pIdx,d,g,best,cx,cy,sv,ol,wo});
      /* how each paint actually looks in this photo, under its lighting */
      const [dx,dy,sc,rot]=best,c=Math.cos(rot),s=Math.sin(rot);
      for(const [t,x,y,cs] of sv){if(cs<0.6)continue;const ux=x-cx,uy=y-cy,j=look(ph,cx+sc*(c*ux-s*uy)+dx,cy+sc*(s*ux+c*uy)+dy);if(j<0||!ph.fg[j]||ph.edge[j]>=8)continue;
        const L=S.label[o+t],i=o+t;if(L<0||!Lraw||Math.hypot(Lraw[i*3]-regLab[L][0],Lraw[i*3+1]-regLab[L][1],Lraw[i*3+2]-regLab[L][2])>10)continue;(calS[pIdx][L]=calS[pIdx][L]||[]).push(ph.L[j*3],ph.L[j*3+1],ph.L[j*3+2]);}
      await tick();}}}
  /* each paint's look per photo: the middle of what its faces show there (Meshy's color if too few) */
  const calib=photos.map((_,pIdx)=>regLab.map((rl,L)=>{const a=calS[pIdx][L];if(!a||a.length<90)return rl;
    const med=k=>{const v=[];for(let i=k;i<a.length;i+=3)v.push(a[i]);v.sort((x,y)=>x-y);return v[v.length>>1];};const m=[med(0),med(1),med(2)];
    /* lighting shifts a paint, it doesn't turn skin into shadow: a look far from the paint was measured in the wrong place */
    return Math.hypot(m[0]-rl[0],m[1]-rl[1],m[2]-rl[2])<=26?m:rl;}));
  dbg.calib=calib.map(cs=>cs.map(c=>c.map(x=>Math.round(x))));
  /* line each piece up again, now against how its paints really look in that photo */
  for(const F of fitsOK){const ph=photos[F.pIdx],o=S.offs[F.g.pi],cal=calib[F.pIdx],{cx,cy}=F;
    const sub=F.sv.filter((_,k)=>k%Math.max(1,Math.floor(F.sv.length/900))===0);
    const err=(dx,dy,sc,rot)=>{const c=Math.cos(rot),s=Math.sin(rot);let e=0;
      for(const [t,x,y] of sub){const ux=x-cx,uy=y-cy,j=look(ph,cx+sc*(c*ux-s*uy)+dx,cy+sc*(s*ux+c*uy)+dy);
        if(j<0||!ph.fg[j]){e+=40;continue;}const l=cal[S.label[o+t]];e+=Math.min(40,Math.hypot(ph.L[j*3]-l[0],ph.L[j*3+1]-l[1],ph.L[j*3+2]-l[2]));}
      e/=sub.length;if(F.ol.length>=15&&F.wo>0){let d2=0;for(const [t,x,y] of F.ol){const ux=x-cx,uy=y-cy,j=look(ph,cx+sc*(c*ux-s*uy)+dx,cy+sc*(s*ux+c*uy)+dy);d2+=j<0?15:Math.min(15,ph.dt[j]);}e+=F.wo*d2/F.ol.length;}
      return e;};
    let best=F.best.slice(),be=err(...best);
    for(let it=0;it<2;it++){const [bx,by,bs,br]=best;
      for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){const e=err(bx+dx,by+dy,bs,br);if(e<be){be=e;best=[bx+dx,by+dy,bs,br];}}
      for(const ds of [-0.02,0,0.02])for(const dr of [-0.035,0,0.035]){const e=err(best[0],best[1],best[2]+ds,best[3]+dr);if(e<be){be=e;best=[best[0],best[1],best[2]+ds,best[3]+dr];}}}
    F.best=best;dbg.fits.push(['refit',S.parts[F.g.pi].name,F.d,+be.toFixed(1),best.map(x=>+x.toFixed(3))]);await tick();}
  for(const {pIdx,g,best,cx,cy,sv} of fitsOK){const ph=photos[pIdx],o=S.offs[g.pi],cal=calib[pIdx];
      const [dx,dy,sc,rot]=best,c=Math.cos(rot),s=Math.sin(rot);
      const P0=sv.map(([t,x,y])=>{const ux=x-cx,uy=y-cy;return [cx+sc*(c*ux-s*uy)+dx,cy+sc*(s*ux+c*uy)+dy];});
      /* small details get lined up on their own: the photo is cut into small tiles, and where a tile holds a
         detail (two or more paints, like an eye, the emblem or the buckle) it may shift a few pixels to fit
         that detail best. Shifts blend smoothly from tile to tile, so nothing tears. */
      const TS=window._spcTile||22,LR=window._spcLocalR==null?5:window._spcLocalR;let tx0=Infinity,ty0=Infinity,tx1=-Infinity,ty1=-Infinity;
      P0.forEach(([x,y])=>{tx0=Math.min(tx0,x);ty0=Math.min(ty0,y);tx1=Math.max(tx1,x);ty1=Math.max(ty1,y);});
      const NX=Math.max(1,Math.ceil((tx1-tx0+1)/TS)),NY=Math.max(1,Math.ceil((ty1-ty0+1)/TS)),cells=Array.from({length:NX*NY},()=>[]);
      P0.forEach(([x,y],k)=>{cells[Math.min(NY-1,Math.floor((y-ty0)/TS))*NX+Math.min(NX-1,Math.floor((x-tx0)/TS))].push(k);});
      const shX=new Float32Array(NX*NY),shY=new Float32Array(NX*NY),shW=new Float32Array(NX*NY);
      if(LR>0)cells.forEach((ks,ci)=>{if(ks.length<40)return;const cnt=new Map();for(const k of ks){const L=S.label[o+sv[k][0]];cnt.set(L,(cnt.get(L)||0)+1);}
        if([...cnt.values()].filter(v=>v>=0.08*ks.length).length<2)return; /* plain area: nothing to line up */
        const sub=ks.filter((_,q)=>q%Math.max(1,Math.floor(ks.length/250))===0);
        const err=(ox,oy)=>{let e=0;for(const k of sub){const j=look(ph,P0[k][0]+ox,P0[k][1]+oy);if(j<0||!ph.fg[j]){e+=40;continue;}const l=cal[S.label[o+sv[k][0]]];e+=Math.min(40,Math.hypot(ph.L[j*3]-l[0],ph.L[j*3+1]-l[1],ph.L[j*3+2]-l[2]));}return e/sub.length+0.25*Math.hypot(ox,oy);};
        const e0=err(0,0);let bx=0,by=0,be=e0;for(let oy=-LR;oy<=LR;oy++)for(let ox=-LR;ox<=LR;ox++){const e=err(ox,oy);if(e<be){be=e;bx=ox;by=oy;}}
        if(be<e0-0.8){shX[ci]=bx;shY[ci]=by;shW[ci]=1;}});
      const shiftAt=(x,y)=>{const fx=(x-tx0)/TS-0.5,fy=(y-ty0)/TS-0.5;let sx=0,sy=0,sw=0;
        for(let cy2=Math.floor(fy)-1;cy2<=Math.floor(fy)+2;cy2++)for(let cx2=Math.floor(fx)-1;cx2<=Math.floor(fx)+2;cx2++){if(cx2<0||cy2<0||cx2>=NX||cy2>=NY)continue;const ci=cy2*NX+cx2,d2=(cx2-fx)**2+(cy2-fy)**2,wt=Math.exp(-d2/0.8);sw+=wt;if(shW[ci]){sx+=wt*shX[ci];sy+=wt*shY[ci];}}
        return sw?[sx/sw,sy/sw]:[0,0];};
      dbg.local=(dbg.local||0)+shW.reduce((a,b)=>a+b,0);
      for(let k=0;k<sv.length;k++){const [t,x0,y0,cs]=sv[k],[qx,qy]=LR>0?shiftAt(P0[k][0],P0[k][1]):[0,0],j=look(ph,P0[k][0]+qx,P0[k][1]+qy);if(j<0||!ph.fg[j])continue;
        const e=ph.edge[j],cj=Math.hypot(ph.L[j*3+1],ph.L[j*3+2]),shine=cj<12&&ph.L[j*3]>40?0.3:1,trust=cs*shine*(e<8?1:e<18?0.6:0.35),i=o+t; /* pale gray in a photo is usually shine */if(trust<=w[i])continue;w[i]=trust;
        const jx=j%ph.W,jy=(j/ph.W)|0;sure[i*2]=-1;sure[i*2+1]=99;
        for(let L=0;L<R0;L++){const c=cal[L];let m=40;const c0=Math.min(40,Math.hypot(ph.L[j*3]-c[0],ph.L[j*3+1]-c[1],ph.L[j*3+2]-c[2]));if(c0<sure[i*2+1]){sure[i*2+1]=c0;sure[i*2]=L;}
          for(const [ox,oy] of offs){const xx=jx+ox,yy=jy+oy;if(xx<0||yy<0||xx>=ph.W||yy>=ph.H)continue;const jj=yy*ph.W+xx;if(!ph.fg[jj])continue;
            const dd=Math.hypot(ph.L[jj*3]-c[0],ph.L[jj*3+1]-c[1],ph.L[jj*3+2]-c[2]);if(dd<m)m=dd;}
          dist[i*R0+L]=0.5*m+0.5*c0;}}
      await tick();}
  return {dist,w,R:R0,sure};
}
/* ---------- final colors ----------
   Each visible face picks a region. It pays for disagreeing with the photo (heavily) and with Meshy
   (lightly), and every color edge pays by its length: a lot across smooth surface, almost nothing along a
   ridge, crease or raised edge. So edges settle on the sculpt's own lines, wherever they are, and blotches
   and ragged edges go away. Solved exactly per pair of colors with a minimum cut (alpha-beta swap). */
async function solveLabels(active,hid,photo,Lraw){
  const R=S.regions.length,rl=S.regions.map(r=>C.lab(...r.rgb)),beta=window._spcBeta||0.6,wp=window._spcWp||2;
  const dbg=(window._spcDbg=window._spcDbg||{});dbg.solve=[];
  for(const pi of active){const p=S.parts[pi],o=S.offs[pi],n=p.m.f.length/3,nb=S.nb[pi],A=S.area,f=p.m.f,v=C.xf(p.M,p.m.v),fn=C.faceNormals(p.m,p.M);
    const vis=new Uint8Array(n);let nv=0;for(let t=0;t<n;t++)if(!hid[o+t]&&S.label[o+t]>=0){vis[t]=1;nv++;}
    if(!nv)continue;
    log(`Putting color edges on the sculpted ridges: ${p.name}…`);await tick();
    const U=new Float32Array(n*R),lab=new Int32Array(n).fill(-1);
    for(let t=0;t<n;t++){if(!vis[t])continue;const i=o+t,pw=photo?photo.w[i]:0;let b=0,bu=Infinity;
      for(let L=0;L<R;L++){const c=rl[L];let u=Math.min(40,Math.hypot(Lraw[i*3]-c[0],Lraw[i*3+1]-c[1],Lraw[i*3+2]-c[2]))/40*(pw>0?0.5:1);
        if(pw>0){u+=wp*pw*photo.dist[i*R+L]/40;if(photo.sure[i*2]===L&&photo.sure[i*2+1]<12)u-=1.5*pw;} /* the photo plainly shows this paint here */
        u*=A[i];U[t*R+L]=u;if(u<bu){bu=u;b=L;}}lab[t]=b;}
    /* colors this piece really uses */
    const ar=new Float64Array(R);let tot=0;for(let t=0;t<n;t++)if(vis[t]){ar[lab[t]]+=A[o+t];tot+=A[o+t];}
    const cand=[...Array(R).keys()].filter(L=>ar[L]>=0.0003*tot);
    for(let t=0;t<n;t++){if(!vis[t]||cand.includes(lab[t]))continue;let b=cand[0],bu=Infinity;for(const L of cand)if(U[t*R+L]<bu){bu=U[t*R+L];b=L;}lab[t]=b;}
    /* edge weights: shared edge length, nearly free along the sculpt's lines */
    const geo=surfaceShape(p,nb,fn,v);
    const mode=window._spcEdgeMode||"concave",kap=window._spcKappa||(mode==="concave"?0.5:0.05);
    const wE=new Float32Array(n*3);
    for(let t=0;t<n;t++){if(!vis[t])continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||!vis[u])continue;
      const a=f[t*3+e]*3,b=f[t*3+(e+1)%3]*3,len=Math.hypot(v[a]-v[b],v[a+1]-v[b+1],v[a+2]-v[b+2]);
      let k;if(mode==="concave")k=Math.max(0,Math.min(geo.H[t],geo.H[u]));else if(mode==="bend")k=Math.min(geo.bend[t],geo.bend[u]);
      else{const cs=fn[t*3]*fn[u*3]+fn[t*3+1]*fn[u*3+1]+fn[t*3+2]*fn[u*3+2];k=1-cs;}
      wE[t*3+e]=len*beta*(Math.exp(-k/kap)+0.03);}}
    const t0=Date.now();let flips=0;
    for(let cyc=0;cyc<2;cyc++){let changed=0;
      for(let ia=0;ia<cand.length;ia++)for(let ib=ia+1;ib<cand.length;ib++){const a=cand[ia],b=cand[ib];
        /* only faces near where a meets b can change: a band 8 rings wide round their shared edges */
        const ring=new Int32Array(n).fill(-1),fr=[];
        for(let t=0;t<n;t++){if(!vis[t]||(lab[t]!==a&&lab[t]!==b))continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&vis[u]&&lab[u]!==lab[t]&&(lab[u]===a||lab[u]===b)){ring[t]=0;fr.push(t);break;}}}
        for(let h=0;h<fr.length;h++){const t=fr[h];if(ring[t]>=8)continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&vis[u]&&ring[u]<0&&(lab[u]===a||lab[u]===b)){ring[u]=ring[t]+1;fr.push(u);}}}
        const idx=new Int32Array(n).fill(-1),nodes=[];for(const t of fr){idx[t]=nodes.length;nodes.push(t);}
        if(nodes.length<2)continue;
        const N=nodes.length,sc=new Float64Array(N),tc=new Float64Array(N),eu=[],ev=[],ew=[];
        for(let k=0;k<N;k++){const t=nodes[k];let ca=U[t*R+a],cb=U[t*R+b];
          for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||!vis[u])continue;const we=wE[t*3+e];
            if(idx[u]<0){if(lab[u]!==a)ca+=we;if(lab[u]!==b)cb+=we;}else if(u>t){eu.push(k);ev.push(idx[u]);ew.push(we);}}
          const m=Math.min(ca,cb);sc[k]=cb-m;tc[k]=ca-m;}
        const tc0=Date.now(),side=minCut(N,sc,tc,eu,ev,ew);if(window._spcTrace)window._spcTrace(p.name,a,b,N,eu.length,Date.now()-tc0);
        for(let k=0;k<N;k++){const t=nodes[k],L=side[k]?a:b;if(L!==lab[t]){lab[t]=L;changed++;}}
        await tick();}
      flips+=changed;if(!changed)break;}
    for(let t=0;t<n;t++)if(vis[t])S.label[o+t]=lab[t];
    const ar2=new Float64Array(R);for(let t=0;t<n;t++)if(vis[t])ar2[lab[t]]+=A[o+t];
    let pwN=0;for(let t=0;t<n;t++)if(vis[t]&&photo&&photo.w[o+t]>0)pwN++;
    dbg.solve.push([p.name,nv,cand.map(L=>[L,+(100*ar[L]/tot).toFixed(2),+(100*ar2[L]/tot).toFixed(2)]),flips,Date.now()-t0,'photo%',+(100*pwN/nv).toFixed(0)]);
  }
}
/* ---------- areas of the sculpt ----------
   Each piece is split into areas along its sculpted lines (ridges, valleys, seams, rims), the way a factory
   paint mask follows a figure's paint breaks. Watershed: every face runs downhill on "how sharply the
   surface turns" to a low spot; faces that reach the same low spot form a basin. Neighboring basins are
   joined when the line between them is weak on average, so a line with a small gap still holds. */
function sculptAreas(pi,geo){
  const p=S.parts[pi],nb=S.nb[pi],n=p.m.f.length/3,o=S.offs[pi],A=S.area,b=geo.bend;
  const T=window._spcAreaLine||0.05,minA=window._spcAreaMin||0.4;
  /* 1. downhill to a low spot */
  const down=new Int32Array(n);for(let t=0;t<n;t++){let m=t,mv=b[t];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&(b[u]<mv||b[u]===mv&&u<m)){mv=b[u];m=u;}}down[t]=m;}
  const bas=new Int32Array(n).fill(-1);
  for(let t=0;t<n;t++){if(bas[t]>=0)continue;const path=[];let x=t;while(bas[x]<0&&down[x]!==x&&path.length<100000){path.push(x);x=down[x];}const id=bas[x]>=0?bas[x]:x;bas[x]=id;for(const y of path)bas[y]=id;}
  /* 2. union-find over basins, joining across weak lines */
  const par=new Int32Array(n);for(let i=0;i<n;i++)par[i]=i;const find=x=>{while(par[x]!==x){par[x]=par[par[x]];x=par[x];}return x;};
  const area=new Float64Array(n);for(let t=0;t<n;t++)area[bas[t]]+=A[o+t];
  for(let pass=0;pass<6;pass++){
    const bd=new Map(); /* boundary between two current areas: [sum of line strength, count] */
    for(let t=0;t<n;t++){const ra=find(bas[t]);for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<=t)continue;const rb=find(bas[u]);if(ra===rb)continue;
      const k=ra<rb?ra+"_"+rb:rb+"_"+ra,w=Math.max(b[t],b[u]),q=bd.get(k);if(q){q[0]+=w;q[1]++;}else bd.set(k,[w,1]);}}
    const list=[...bd.entries()].map(([k,[sw,c]])=>{const [x,y]=k.split("_").map(Number);return [sw/c,x,y,c];}).sort((p2,q2)=>p2[0]-q2[0]);
    let merged=0;
    for(const [m,x,y] of list){const rx=find(x),ry=find(y);if(rx===ry)continue;
      const small=Math.min(area[rx],area[ry]);
      if(m<T||small<minA){par[ry]=rx;area[rx]+=area[ry];merged++;}}
    if(!merged)break;}
  const out=new Int32Array(n);for(let t=0;t<n;t++)out[t]=find(bas[t]);
  return out;
}
/* clean edges: each face's color is blended with its neighbours' a few times and then the strongest color
   wins. Teeth and fringes along an edge melt away and edges come out as smooth lines; colors don't blend across
   a sculpted line, so edges also settle onto the sculpt's own lines. A detail wider than about a millimetre
   keeps its shape. */
function smoothEdges(active,hid){const R=S.regions.length,it=window._spcSmoothIt||12;
  for(const pi of active){const o=S.offs[pi],n=S.parts[pi].m.f.length/3,nb=S.nb[pi],A=S.area;
    let ar=null;try{sculptAreaAt(o);ar=S.areaC[pi];}catch(e){}
    const ok=t=>!hid[o+t]&&S.label[o+t]>=0;
    /* only faces near an edge need it */
    const band=new Int32Array(n).fill(-1),q=[];
    for(let t=0;t<n;t++){if(!ok(t))continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&ok(u)&&S.label[o+u]!==S.label[o+t]){band[t]=0;q.push(t);break;}}}
    for(let h=0;h<q.length;h++){const t=q[h];if(band[t]>=it+2)continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&ok(u)&&band[u]<0){band[u]=band[t]+1;q.push(u);}}}
    if(!q.length)continue;
    const idx=new Int32Array(n).fill(-1);q.forEach((t,k)=>idx[t]=k);const N=q.length;
    let cur=new Float32Array(N*R),nxt=new Float32Array(N*R);
    q.forEach((t,k)=>{cur[k*R+S.label[o+t]]=1;});
    const val=(t,L,buf)=>{const k=idx[t];return k>=0?buf[k*R+L]:(S.label[o+t]===L?1:0);};
    for(let r=0;r<it;r++){
      for(let k=0;k<N;k++){const t=q[k];let wsum=A[o+t];for(let L=0;L<R;L++)nxt[k*R+L]=cur[k*R+L]*A[o+t];
        for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||!ok(u))continue;const w=A[o+u]*(ar&&ar[u]!==ar[t]?0.08:1);wsum+=w;
          const ku=idx[u];if(ku>=0)for(let L=0;L<R;L++)nxt[k*R+L]+=w*cur[ku*R+L];else nxt[k*R+S.label[o+u]]+=w;}
        for(let L=0;L<R;L++)nxt[k*R+L]/=wsum;}
      const tmp=cur;cur=nxt;nxt=tmp;}
    for(let k=0;k<N;k++){let b=-1,bv=-1;for(let L=0;L<R;L++)if(cur[k*R+L]>bv){bv=cur[k*R+L];b=L;}S.label[o+q[k]]=b;}
  }
}
/* tucked-away areas: from a few spots in each sculpted area, look out in several directions; if nearly every
   look hits a piece within a short distance (a neck post inside the head, the inside of a wing slot), no one
   will see that area, so it is hidden and takes the color around it */
function tuckedAreas(active,regM,hid){const geo=active.map(pi=>pieceGeo(pi,regM)),dup=samePlace(geo),gcache=new Map();
  const gridFor=g=>{const key=geo.filter(h=>!dup.has(g.pi+"|"+h.pi)).map(h=>h.pi).join(',');if(gcache.has(key))return gcache.get(key);const P=[];geo.forEach(h=>{if(dup.has(g.pi+"|"+h.pi))return;for(let t=0;t<h.n;t++)P.push(h.c[t*3],h.c[t*3+1],h.c[t*3+2]);});const G=C.grid(Float32Array.from(P),0.7);gcache.set(key,G);return G;};
  let tucked=0,inside=0;
  const hit=(Gr,x,y,z,dx,dy,dz,max,step)=>{const l=Math.hypot(dx,dy,dz);for(let d=1.2;d<=max;d+=step){const [j,dd]=Gr.near(x+dx/l*d,y+dy/l*d,z+dz/l*d,1);if(j>=0&&dd<0.7)return true;}return false;};
  for(const g of geo){const o=S.offs[g.pi],Gs=C.grid(g.c,0.8),G=gridFor(g);
    for(let t=0;t<g.n;t++){if(hid[o+t])continue;const x=g.c[t*3],y=g.c[t*3+1],z=g.c[t*3+2],nx=g.fn[t*3],ny=g.fn[t*3+1],nz=g.fn[t*3+2];
      let ax=Math.abs(nx)<0.9?1:0,ay=ax?0:1;let ux=-nz*ay,uy=nz*ax,uz=nx*ay-ny*ax;const ul=Math.hypot(ux,uy,uz)||1;ux/=ul;uy/=ul;uz/=ul;
      const vx=ny*uz-nz*uy,vy=nz*ux-nx*uz,vz=nx*uy-ny*ux;
      const tilt=a2=>{const c=Math.cos(a2*Math.PI/3),s2=Math.sin(a2*Math.PI/3);return [nx*0.6+(ux*c+vx*s2)*0.8,ny*0.6+(uy*c+vy*s2)*0.8,nz*0.6+(uz*c+vz*s2)*0.8];};
      /* close by: pressed into another piece or a narrow pocket */
      if(hit(G,x,y,z,nx,ny,nz,6,0.6)){let b=0;for(let a2=0;a2<6;a2++){const [dx,dy,dz]=tilt(a2);if(hit(G,x,y,z,dx,dy,dz,8,0.6))b++;}if(b>=6){hid[o+t]=1;tucked++;continue;}}
      /* the wall of a narrow slot or channel: straight out, the opposite wall faces back within a few mm */
      {const l=1;let wall=false;for(let d=1.2;d<=6&&!wall;d+=0.6){const [j,dd]=Gs.near(x+nx*d,y+ny*d,z+nz*d,1);if(j>=0&&dd<0.7&&nx*g.fn[j*3]+ny*g.fn[j*3+1]+nz*g.fn[j*3+2]<-0.5)wall=true;}
        if(wall){let b=0;for(let a2=0;a2<6;a2++){const [dx,dy,dz]=tilt(a2);if(hit(Gs,x,y,z,dx,dy,dz,10,0.6))b++;}if(b>=3){hid[o+t]=1;inside++;continue;}}}
      /* inside the piece: a socket or hollow that only opens through a slot (where the wings plug in) */
      if(hit(Gs,x,y,z,nx,ny,nz,25,0.8)){let b=0;for(let a2=0;a2<6;a2++){const [dx,dy,dz]=tilt(a2);if(hit(Gs,x,y,z,dx,dy,dz,25,0.8))b++;}if(b>=6){hid[o+t]=1;inside++;}}}}
  /* the floor of a slot: a small patch of visible surface whose whole border is hidden walls */
  let floors=0;for(const g of geo){const o=S.offs[g.pi],nb=S.nb[g.pi],seen=new Uint8Array(g.n);
    for(let s0=0;s0<g.n;s0++){if(seen[s0]||hid[o+s0])continue;const comp=[s0];seen[s0]=1;let a=0,open=false;
      for(let h=0;h<comp.length;h++){const t=comp[h];a+=S.area[o+t];if(a>80){open=true;}for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0){open=true;continue;}if(!seen[u]&&!hid[o+u]){seen[u]=1;comp.push(u);}}}
      if(open)continue;
      /* and it sits down in the slot: tilted looks from it run into the walls (a raised belt box doesn't) */
      const Gs=g.Gs||(g.Gs=C.grid(g.c,0.8));let looks=0,blk=0;
      for(let k=0;k<comp.length;k+=Math.max(1,Math.floor(comp.length/10))){const t=comp[k],x=g.c[t*3],y=g.c[t*3+1],z=g.c[t*3+2],nx=g.fn[t*3],ny=g.fn[t*3+1],nz=g.fn[t*3+2];
        let ax=Math.abs(nx)<0.9?1:0,ay=ax?0:1;let ux=-nz*ay,uy=nz*ax,uz=nx*ay-ny*ax;const ul=Math.hypot(ux,uy,uz)||1;ux/=ul;uy/=ul;uz/=ul;const vx=ny*uz-nz*uy,vy=nz*ux-nx*uz,vz=nx*uy-ny*ux;
        for(let a2=0;a2<6;a2++){const c=Math.cos(a2*Math.PI/3),s2=Math.sin(a2*Math.PI/3);looks++;if(hit(Gs,x,y,z,nx*0.5+(ux*c+vx*s2)*0.87,ny*0.5+(uy*c+vy*s2)*0.87,nz*0.5+(uz*c+vz*s2)*0.87,5,0.6))blk++;}}
      if(looks&&blk>=0.8*looks){for(const t of comp)hid[o+t]=1;floors+=comp.length;}}}
  (window._spcDbg=window._spcDbg||{}).tucked=[tucked,inside,floors];
}
/* bleed across a sculpted line: inside a sculpted area, a small patch of the paint that fills the area next
   door, touching the line between them, crossed over (red teeth on a gold cuff). It goes back to this area's
   own paint, so the color change sits on the line */
function unbleed(active,hid,photo){let moved=0;const plain=(i,L)=>photo&&photo.w[i]>0.5&&photo.sure[i*2]===L&&photo.sure[i*2+1]<12;
  for(const pi of active){const o=S.offs[pi],n=S.parts[pi].m.f.length/3,nb=S.nb[pi],A=S.area;let ar;try{sculptAreaAt(o);ar=S.areaC[pi];}catch(e){continue;}
    const tot=new Map(),tal=new Map();
    for(let t=0;t<n;t++){const i=o+t;if(hid[i]||S.label[i]<0)continue;const k=ar[t];tot.set(k,(tot.get(k)||0)+A[i]);let m=tal.get(k);if(!m)tal.set(k,m=new Map());m.set(S.label[i],(m.get(S.label[i])||0)+A[i]);}
    const dom=new Map(),share=new Map();for(const [k,m] of tal){let b=-1,bv=0;for(const [L,v] of m)if(v>bv){bv=v;b=L;}dom.set(k,b);share.set(k,bv/tot.get(k));}
    const seen=new Uint8Array(n);
    for(let s0=0;s0<n;s0++){const i0=o+s0;if(seen[s0]||hid[i0]||S.label[i0]<0)continue;const k=ar[s0],L=S.label[i0],D=dom.get(k);seen[s0]=1;if(L===D||share.get(k)<0.6)continue;
      const comp=[s0];let a=0,touch=0,edge=0;
      for(let h=0;h<comp.length;h++){const t=comp[h];a+=A[o+t];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;
        if(ar[u]===k){if(!seen[u]&&!hid[o+u]&&S.label[o+u]===L){seen[u]=1;comp.push(u);}}else{edge++;if(dom.get(ar[u])===L)touch++;}}}
      if(touch>0&&touch>=0.5*edge&&a<Math.min(window._spcBleedMax||4,0.2*tot.get(k))){let pl=0;for(const t of comp)if(plain(o+t,L))pl+=A[o+t];
        if(pl>0.25*a)continue; /* the photo plainly shows this paint here: it's a real detail */
        for(const t of comp)S.label[o+t]=D;moved+=a;}}}
  (window._spcDbg=window._spcDbg||{}).unbleed=+moved.toFixed(1);}
/* color edges onto the sculpt's creases: where a crease (the top or bottom corner of a cuff, the edge of a
   raised stripe) runs along a color edge within about a millimetre, the edge moves onto it. Each pair of paints
   is re-cut along its shared edge: moving a face costs a little, an edge costs its length, and an edge lying on
   a crease costs almost nothing. Teeth and fringes go; a real detail is too costly to erase. */
function snapToCreases(active,hid,photo){const lam=window._spcSnapLam||0.6,dbg=(window._spcDbg=window._spcDbg||{});let moved=0;
  for(const pi of active){const p=S.parts[pi],o=S.offs[pi],n=p.m.f.length/3,nb=S.nb[pi],A=S.area,f=p.m.f,v=C.xf(p.M,p.m.v),fn=C.faceNormals(p.m,p.M);
    const ok=t=>!hid[o+t]&&S.label[o+t]>=0;
    const pairs=new Set();for(let t=0;t<n;t++){if(!ok(t))continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>t&&ok(u)&&S.label[o+u]!==S.label[o+t]){const a=Math.min(S.label[o+u],S.label[o+t]),b=Math.max(S.label[o+u],S.label[o+t]);pairs.add(a*1000+b);}}}
    for(const key of pairs){const a=Math.floor(key/1000),b=key%1000;
      const ring=new Int32Array(n).fill(-1),fr=[];
      for(let t=0;t<n;t++){if(!ok(t))continue;const L=S.label[o+t];if(L!==a&&L!==b)continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&ok(u)){const M=S.label[o+u];if(M!==L&&(M===a||M===b)){ring[t]=0;fr.push(t);break;}}}}
      for(let h=0;h<fr.length;h++){const t=fr[h];if(ring[t]>=(window._spcSnapRings||9))continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&ok(u)&&ring[u]<0){const M=S.label[o+u];if(M===a||M===b){ring[u]=ring[t]+1;fr.push(u);}}}}
      if(fr.length<3)continue;
      const idx=new Int32Array(n).fill(-1);fr.forEach((t,k)=>idx[t]=k);const N=fr.length,sc=new Float64Array(N),tc=new Float64Array(N),eu=[],ev=[],ew=[];
      for(let k=0;k<N;k++){const t=fr[k],i=o+t,cur=S.label[i],keep=photo&&photo.w[i]>0.5&&photo.sure[i*2]===cur&&photo.sure[i*2+1]<10?3:1;
        let ca=cur===a?0:lam*keep*A[i],cb=cur===b?0:lam*keep*A[i];
        for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||!ok(u))continue;const ia=f[t*3+e]*3,ib=f[t*3+(e+1)%3]*3,len=Math.hypot(v[ia]-v[ib],v[ia+1]-v[ib+1],v[ia+2]-v[ib+2]);
          const k1=1-(fn[t*3]*fn[u*3]+fn[t*3+1]*fn[u*3+1]+fn[t*3+2]*fn[u*3+2]),w=len*(0.05+0.95*Math.exp(-k1/0.04));
          if(idx[u]<0){const M=S.label[o+u];if(M!==a)ca+=w;if(M!==b)cb+=w;}else if(u>t){eu.push(k);ev.push(idx[u]);ew.push(w);}}
        const m=Math.min(ca,cb);sc[k]=cb-m;tc[k]=ca-m;}
      const side=minCut(N,sc,tc,eu,ev,ew);
      for(let k=0;k<N;k++){const L=side[k]?a:b,i=o+fr[k];if(S.label[i]!==L){S.label[i]=L;moved+=A[i];}}}}
  dbg.creases=+moved.toFixed(1);}
/* stray paints: a paint that covers only a sliver of a piece and that the photos don't plainly show on it
   (flesh on the floor of a torso socket, a speck of silver on a heel) is a leftover. Each patch of it takes the
   paint around it, so no filament change is spent on it */
function dropStrays(active,hid,photo){let moved=0;const R=S.regions.length;
  for(const pi of active){const o=S.offs[pi],n=S.parts[pi].m.f.length/3,nb=S.nb[pi],A=S.area;
    const ar=new Float64Array(R),shown=new Float64Array(R);let tot=0;
    for(let t=0;t<n;t++){const i=o+t,L=S.label[i];if(L<0)continue;tot+=A[i];ar[L]+=A[i];if(photo&&!hid[i]&&photo.w[i]>0.5&&photo.sure[i*2]>=0&&photo.sure[i*2+1]<12){const P=S._remap?S._remap[photo.sure[i*2]]:photo.sure[i*2];if(P===L)shown[L]+=A[i];}}
    /* a paint placed on purpose somewhere on the piece (piping, an eye) is no stray there: its other faces stay too */
    const placed=new Uint8Array(R);if(S.pipeRegs)for(const L of S.pipeRegs)if(L<R)placed[L]=1;
    const stray=[...Array(R).keys()].filter(L=>ar[L]>0&&!placed[L]&&ar[L]<Math.max(2,0.03*tot)&&shown[L]<0.25*ar[L]);
    if(!stray.length)continue;const isS=new Uint8Array(R);stray.forEach(L=>isS[L]=1);
    for(let pass=0;pass<30;pass++){let ch=0;
      for(let t=0;t<n;t++){const i=o+t,L=S.label[i];if(L<0||!isS[L]||(S.keep&&S.keep[i]))continue;const v=new Map(); /* eyes and piping placed on purpose stay */
        for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;const M=S.label[o+u];if(M>=0&&!isS[M])v.set(M,(v.get(M)||0)+1);}
        let b=-1,bv=0;for(const [M,c] of v)if(c>bv){bv=c;b=M;}if(b>=0){S.label[i]=b;moved+=A[i];ch++;}}
      if(!ch)break;}}
  (window._spcDbg=window._spcDbg||{}).strays=+moved.toFixed(1);}
/* ---------- raised strips ----------
   How far each face stands out from the surface around it: its distance, along its own normal, from the
   average of the surface within a couple of millimetres. A raised stripe, strap, cuff or rim stands out; a
   plain curved surface barely does. */
function raisedHeight(pi){const p=S.parts[pi],f=p.m.f,n=f.length/3,v=C.xf(p.M,p.m.v),fn=C.faceNormals(p.m,p.M),R=window._spcRaiseR||2,c=new Float32Array(n*3);
  for(let t=0;t<n;t++)for(let k=0;k<3;k++)c[t*3+k]=(v[f[t*3]*3+k]+v[f[t*3+1]*3+k]+v[f[t*3+2]*3+k])/3;
  const step=Math.max(1,Math.floor(n/60000)),cell=R,key=(x,y,z)=>(Math.floor(x/cell)*73856093)^(Math.floor(y/cell)*19349663)^(Math.floor(z/cell)*83492791),H=new Map();
  for(let t=0;t<n;t+=step){const k=key(c[t*3],c[t*3+1],c[t*3+2]);let a=H.get(k);if(!a)H.set(k,a=[]);a.push(t);}
  const h=new Float32Array(n),R2=R*R;
  for(let t=0;t<n;t++){const x=c[t*3],y=c[t*3+1],z=c[t*3+2];let sx=0,sy=0,sz=0,m=0;
    for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k2=-1;k2<=1;k2++){const a=H.get(key(x+i*cell,y+j*cell,z+k2*cell));if(!a)continue;
      for(const u of a){const dx=c[u*3]-x,dy=c[u*3+1]-y,dz=c[u*3+2]-z;if(dx*dx+dy*dy+dz*dz>R2)continue;
        if(fn[t*3]*fn[u*3]+fn[t*3+1]*fn[u*3+1]+fn[t*3+2]*fn[u*3+2]<0.2)continue; /* the other side of a thin part */
        sx+=c[u*3];sy+=c[u*3+1];sz+=c[u*3+2];m++;}}
    if(m)h[t]=(x-sx/m)*fn[t*3]+(y-sy/m)*fn[t*3+1]+(z-sz/m)*fn[t*3+2];}
  return h;}
window._spcRaised=pi=>Array.from(raisedHeight(pi));
/* raised strips and trim: a patch of paint (the gold stripe down a boot, a harness strap, a cuff) is grown
   across smooth surface until it meets the sculpt's step edges on every side. If it closes off at about its
   own size, that closed shape IS the strip: the whole strip gets the paint, and any of the paint that spilled
   past the step goes back to the color next to it. If it leaks out across the piece, it isn't a sculpted
   strip and is left alone. */
function fitStrips(active,hid){const dbg=(window._spcDbg=window._spcDbg||{});dbg.strips=[];const T=window._spcStripT||0.12;
  for(const pi of active){const p=S.parts[pi],o=S.offs[pi],n=p.m.f.length/3,nb=S.nb[pi],A=S.area,fn=C.faceNormals(p.m,p.M),v=C.xf(p.M,p.m.v);
    const bend=surfaceShape(p,nb,fn,v).bend,ok=t=>!hid[o+t]&&S.label[o+t]>=0;let tot=0;for(let t=0;t<n;t++)if(ok(t))tot+=A[o+t];
    const seen=new Uint8Array(n);let fixed=0,tried=0;
    for(let s0=0;s0<n;s0++){if(seen[s0]||!ok(s0))continue;const L=S.label[o+s0],comp=[s0];seen[s0]=1;let a=0;
      for(let h=0;h<comp.length;h++){const t=comp[h];a+=A[o+t];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&!seen[u]&&ok(u)&&S.label[o+u]===L){seen[u]=1;comp.push(u);}}}
      if(a<0.8||a>0.35*tot)continue;tried++;
      /* grow across smooth surface from the patch's smooth faces */
      const inR=new Uint8Array(n),q=[],rg=new Int16Array(n).fill(-1);for(const t of comp)if(bend[t]<T){inR[t]=1;q.push(t);rg[t]=0;}const RK=window._spcStripRings||4;
      let ra=0,leak=false;const lim=2.2*a+2;
      for(let h=0;h<q.length;h++){const t=q[h];ra+=A[o+t];if(ra>lim){leak=true;break;}
        for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&!inR[u]&&ok(u)&&bend[u]<T){const r=S.label[o+u]===L?0:rg[t]+1;if(r>RK){leak=true;break;}inR[u]=1;rg[u]=r;q.push(u);}}if(leak)break;}
      if(leak||ra<0.5*a)continue;
      /* the step edge round it belongs to the strip too (up to the corner) */
      const edge=[];for(const t of q)for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&!inR[u]&&ok(u)){inR[u]=2;edge.push(u);}}
      let changed=0;for(const t of q)if(S.label[o+t]!==L){S.label[o+t]=L;changed++;}
      for(const t of edge)if(S.label[o+t]!==L&&bend[t]>=T){/* keep the corner with the strip only if most of the corner ring is the strip's paint */}
      /* paint that spilled past the step: faces of the patch outside the strip */
      for(const t of comp){if(inR[t])continue;const vote=new Map();
        for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&ok(u)&&!inR[u]&&S.label[o+u]!==L)vote.set(S.label[o+u],(vote.get(S.label[o+u])||0)+1);}
        let b=-1,bv=0;for(const [M,c] of vote)if(c>bv){bv=c;b=M;}if(b>=0){S.label[o+t]=b;changed++;}}
      if(changed)fixed++;}
    /* spilled faces cut off from their strip still carry it: settle them by their neighbours */
    for(let pass=0;pass<4;pass++)for(let t=0;t<n;t++){if(!ok(t))continue;const L=S.label[o+t],vote=new Map();let same=0;
      for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||!ok(u))continue;const M=S.label[o+u];if(M===L)same++;else vote.set(M,(vote.get(M)||0)+1);}
      if(same===0){let b=-1,bv=0;for(const [M,c] of vote)if(c>bv){bv=c;b=M;}if(b>=0)S.label[o+t]=b;}}
    dbg.strips.push([p.name,tried,fixed]);}
}
/* a hidden patch (the top of a hip, a cut face, a socket wall) takes ONE paint: the one already covering most
   of it. Filling it bit by bit left streaks of a second paint across it, each a pointless filament change */
function hiddenUniform(active,hid){let n2=0;
  for(const pi of active){const o=S.offs[pi],n=S.parts[pi].m.f.length/3,nb=S.nb[pi],A=S.area,seen=new Uint8Array(n);
    for(let s0=0;s0<n;s0++){if(seen[s0]||!hid[o+s0])continue;const comp=[s0];seen[s0]=1;const vote=new Map();
      for(let h=0;h<comp.length;h++){const t=comp[h],L=S.label[o+t];if(L>=0)vote.set(L,(vote.get(L)||0)+A[o+t]);
        for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&hid[o+u]&&!seen[u]){seen[u]=1;comp.push(u);}}}
      let b=-1,bv=0;for(const [L,v] of vote)if(v>bv){bv=v;b=L;}if(b<0)continue;
      for(const t of comp)if(S.label[o+t]!==b){S.label[o+t]=b;n2++;}}}
  (window._spcDbg=window._spcDbg||{}).hidUni=n2;}
/* the shape of the surface round each face, looked at about half a millimetre out whatever the mesh
   density: H is how much it curves inward (a valley, groove, the foot of a raised stripe or rim) and
   bend how sharply it turns at all. Paint lines on a sculpt sit in its valleys. */
function surfaceShape(p,nb,fn,v){const f=p.m.f,n=f.length/3,c=new Float32Array(n*3);
  for(let t=0;t<n;t++)for(let k=0;k<3;k++)c[t*3+k]=(v[f[t*3]*3+k]+v[f[t*3+1]*3+k]+v[f[t*3+2]*3+k])/3;
  const H=new Float32Array(n),bend=new Float32Array(n),mark=new Int32Array(n).fill(-1),ring=[],r=window._spcShapeR||0.5,R2=r*r;
  for(let t=0;t<n;t++){ring.length=0;ring.push(t);mark[t]=t;let mx=0,hs=0,hn=0;
    for(let h=0;h<ring.length&&ring.length<400;h++){const q2=ring[h];
      for(let e=0;e<3;e++){const u=nb[q2*3+e];if(u<0||mark[u]===t)continue;mark[u]=t;
        const dx=c[u*3]-c[t*3],dy=c[u*3+1]-c[t*3+1],dz=c[u*3+2]-c[t*3+2],d2=dx*dx+dy*dy+dz*dz;if(d2>R2)continue;ring.push(u);
        const dd=1-(fn[t*3]*fn[u*3]+fn[t*3+1]*fn[u*3+1]+fn[t*3+2]*fn[u*3+2]);if(dd>mx)mx=dd;
        if(d2>1e-6){hs+=2*(dx*fn[t*3]+dy*fn[t*3+1]+dz*fn[t*3+2])/d2;hn++;}}}
    bend[t]=mx;H[t]=hn?hs/hn:0;}
  return {H,bend};}
/* minimum s-t cut (Dinic). sc[k]: capacity source->k, tc[k]: k->sink, edges (eu,ev) with capacity ew both ways.
   Returns 1 for nodes left on the source side. */
function minCut(N,sc,tc,eu,ev,ew){
  const S0=N,T0=N+1,NN=N+2;let M=0;for(let k=0;k<N;k++){if(sc[k]>0)M++;if(tc[k]>0)M++;}M+=eu.length;
  const head=new Int32Array(NN).fill(-1),to=new Int32Array(M*2),nx=new Int32Array(M*2),cap=new Float64Array(M*2);let E=0;
  const add=(a,b,c1,c2)=>{to[E]=b;cap[E]=c1;nx[E]=head[a];head[a]=E++;to[E]=a;cap[E]=c2;nx[E]=head[b];head[b]=E++;};
  for(let k=0;k<N;k++){if(sc[k]>0)add(S0,k,sc[k],0);if(tc[k]>0)add(k,T0,tc[k],0);}
  for(let j=0;j<eu.length;j++)add(eu[j],ev[j],ew[j],ew[j]);
  const level=new Int32Array(NN),it=new Int32Array(NN),qu=new Int32Array(NN),eps=1e-12,path=[];
  const bfs=()=>{level.fill(-1);level[S0]=0;let h=0,tl=0;qu[tl++]=S0;while(h<tl){const u=qu[h++];for(let e=head[u];e>=0;e=nx[e])if(cap[e]>eps&&level[to[e]]<0){level[to[e]]=level[u]+1;qu[tl++]=to[e];}}return level[T0]>=0;};
  while(bfs()){it.set(head);let u=S0;path.length=0;
    for(;;){
      if(u===T0){let m=Infinity;for(const e of path)if(cap[e]<m)m=cap[e];for(const e of path){cap[e]-=m;cap[e^1]+=m;}
        let k=0;while(k<path.length&&cap[path[k]]>eps)k++;path.length=k;u=k?to[path[k-1]]:S0;continue;}
      let e=it[u];while(e>=0&&!(cap[e]>eps&&level[to[e]]===level[u]+1))e=nx[e];it[u]=e;
      if(e<0){level[u]=-1;if(!path.length)break;const pe=path.pop();u=to[pe^1];it[u]=nx[it[u]];continue;}
      path.push(e);u=to[e];}}
  /* source side: reachable from the source in what's left */
  const side=new Uint8Array(N),seen=new Uint8Array(NN);let h=0,tl=0;qu[tl++]=S0;seen[S0]=1;
  while(h<tl){const u=qu[h++];for(let e=head[u];e>=0;e=nx[e])if(cap[e]>eps&&!seen[to[e]]){seen[to[e]]=1;qu[tl++]=to[e];}}
  for(let k=0;k<N;k++)side[k]=seen[k];return side;
}
function matchFilaments(slots){
  const PL=palLab(), owned=C.PAL.map((f,i)=>f.owned!==false?i:-1).filter(i=>i>=0);
  let allowed=owned.length?owned:C.PAL.map((_,i)=>i);
  /* a plain (PLA Basic) filament wins over a Matte, Translucent or TPU one of the same color; hair is never put on a colorless filament */
  const pen=i=>/^PLA Basic$/i.test(C.PAL[i].type||"")?0:2;
  /* the face and the hair take Rob's chosen filaments when they are on the shelf */
  const pick=fl=>C.PAL.findIndex(f=>f[fl]&&f.owned!==false);
  const assign=()=>S.regions.forEach(r=>{if(r.skin&&pick('skin')>=0){r.fil=pick('skin');r.dE=C.dE(C.lab(...r.rgb),PL[r.fil]);return;}if(r.hair&&pick('hairFil')>=0){r.fil=pick('hairFil');r.dE=C.dE(C.lab(...r.rgb),PL[r.fil]);return;}const l=C.lab(...r.rgb);let b=-1,bd=Infinity,bs=Infinity;for(const i of allowed){if(r.hair&&Math.hypot(PL[i][1],PL[i][2])<6)continue;const d=C.dE(l,PL[i]),sc=d+pen(i);if(sc<bs){bs=sc;bd=d;b=i;}}
    if(b<0)for(const i of allowed){const d=C.dE(l,PL[i]);if(d<bd){bd=d;b=i;}}r.fil=b;r.dE=bd;});
  assign();
  for(;;){const used=new Map();S.regions.forEach(r=>used.set(r.fil,(used.get(r.fil)||0)+r.area));
    if(used.size<=slots)break;let drop=null,da=Infinity;for(const [f,a] of used)if(a<da){da=a;drop=f;}
    allowed=[...used.keys()].filter(f=>f!==drop);assign();}
}

/* ---------- regions panel ---------- */
function renderRegions(){
  const box=q("spcRegions");
  if(!S.regions.length||!S.label){box.innerHTML="";return;}
  const tot=S.regions.reduce((s,r)=>s+r.area,0)||1, PL=palLab();
  box.innerHTML=S.regions.map((r,i)=>{ if(r.area<=0)return "";
    const l=C.lab(...r.rgb), order=C.PAL.map((f,j)=>[j,C.dE(l,PL[j])]).sort((a,b)=>a[1]-b[1]);
    const opts=order.map(([j,d])=>`<option value="${j}"${j===r.fil?" selected":""}>${esc(C.fname(C.PAL[j]))}${C.PAL[j].owned===false?" (not owned)":C.PAL[j].order?" (on order)":""} · ΔE ${d.toFixed(0)}</option>`).join("");
    const cur=C.PAL[r.fil]||{hex:"#000"}, d=r.fil>=0?C.dE(l,PL[r.fil]):99;
    const warn=d>10&&!r.manual?`<span class="warn">No close match on your shelf<button data-sug="${i}">find a Bambu color</button></span>`:"";
    return `<div class="spc-reg${i===S.selected?" sel":""}" data-i="${i}"><i style="background:${C.rgb2hex(r.rgb)}" title="color found"></i><i style="background:${cur.hex}" title="filament"></i>`+
      `<select data-i="${i}">${opts}<option value="add">+ Add a filament…</option></select>`+
      `<small>${r.patch?"patch · ":""}${(100*r.area/tot).toFixed(1)}% · found ${C.rgb2hex(r.rgb)} ${warn}</small></div>`;}).join("");
  box.querySelectorAll(".spc-reg").forEach(el=>el.addEventListener("click",e=>{if(e.target.tagName==="SELECT"||e.target.tagName==="BUTTON"||e.target.tagName==="OPTION")return;select(+el.dataset.i);}));
  box.querySelectorAll("select").forEach(s=>s.addEventListener("change",()=>{const i=+s.dataset.i;
    if(s.value==="add"){q("spcPal").parentElement.open=true;q("spcPal").parentElement.scrollIntoView({block:"nearest"});renderRegions();return;}
    pushUndo({type:"fil",i,prev:S.regions[i].fil});S.regions[i].fil=+s.value;S.regions[i].manual=true;paint();renderRegions();}));
  box.querySelectorAll("button[data-sug]").forEach(b=>b.onclick=async()=>{const r=S.regions[+b.dataset.sug];
    try{const cat=await C.catalog(),l=C.lab(...r.rgb);const best=cat.filter(c=>/^PLA/.test(c.type)).map(c=>[c,C.dE(l,C.labHex(c.hex))]).sort((a,b)=>a[1]-b[1])[0];
      if(confirm(`Closest Bambu filament: ${best[0].type} ${best[0].color} (${best[0].code}), ΔE ${best[1].toFixed(0)}.\nAdd it as "not owned" and use it here?`)){
        const j=addPal({...best[0],owned:false});pushUndo({type:"fil",i:+b.dataset.sug,prev:r.fil});r.fil=j;paint();renderRegions();}}
    catch(e){log("Could not load Bambu's color list: "+e.message,true);}});
}
function select(i,ev){S.selected=(S.selected===i&&!ev)?-1:i;S.selArea=null;paint();renderRegions();showPop(ev);}
/* ---------- fixing one spot ----------
   A click picks the patch under the cursor: the connected run of that color on that one piece (a stray
   silver spot on a heel, a dark eye corner, the gold on one glove). It can be changed on its own, or the
   color can be changed everywhere. */
function pieceOf(face){let pi=0;while(pi+1<S.offs.length&&S.offs[pi+1]<=face)pi++;return pi;}
function patchAt(face){const pi=pieceOf(face),o=S.offs[pi],nb=S.nb[pi],L=S.label[face],start=face-o,seen=new Uint8Array(S.parts[pi].m.f.length/3),out=[start];seen[start]=1;
  for(let h=0;h<out.length;h++){const t=out[h];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0&&!seen[u]&&S.label[o+u]===L){seen[u]=1;out.push(u);}}}
  return {pi,faces:out.map(t=>t+o)};}
/* the sculpted area under a face: bounded by the sculpt's own lines (worked out once per piece) */
function sculptAreaAt(face){const pi=pieceOf(face),o=S.offs[pi],p=S.parts[pi];S.areaC=S.areaC||{};
  if(!S.areaC[pi]){const fn=C.faceNormals(p.m,p.M),v=C.xf(p.M,p.m.v);S.areaC[pi]=sculptAreas(pi,surfaceShape(p,S.nb[pi],fn,v));}
  const ar=S.areaC[pi],id=ar[face-o],out=[];for(let t=0;t<ar.length;t++)if(ar[t]===id)out.push(o+t);return {pi,faces:out};}
window._spcSculptAreas=pi=>{sculptAreaAt(S.offs[pi]);return S.areaC[pi];};
function selectAt(face){return (S.pickKind||"area")==="area"?sculptAreaAt(face):patchAt(face);}
function pickArea(face,ev){S.selected=-1;S.areaFace=face;S.selArea=selectAt(face);
  S.selSet=new Uint8Array(S.nFaces);S.selArea.faces.forEach(f=>S.selSet[f]=1);paint();showAreaPop(ev);}
function paintArea(fil){const A=S.selArea;if(!A)return;
  let ri=S.regions.findIndex(r=>r.fil===fil),newRegion=false;
  if(ri<0){ri=S.regions.length;S.regions.push({id:ri,rgb:C.hex2rgb(C.PAL[fil].hex),fil,area:0,dE:0,patch:true});newRegion=true;}
  const prev=A.faces.map(f=>S.label[f]);A.faces.forEach(f=>S.label[f]=ri);
  pushUndo({type:"patch",faces:A.faces,prev,newRegion});sumAreas();paint();renderRegions();}
function showAreaPop(ev){const pop=q("spcPop"),A=S.selArea;if(!A){pop.hidden=true;return;}
  let a=0;A.faces.forEach(f=>a+=S.area[f]);const cur=S.label[A.faces[0]],r=S.regions[cur],curFil=r?r.fil:-1;
  const ref=r?C.lab(...r.rgb):[50,0,0],PL=palLab();
  const opts=C.PAL.map((f,j)=>[j,C.dE(ref,PL[j])]).sort((x,y)=>(x[0]===curFil?-1:y[0]===curFil?1:x[1]-y[1])).map(([j])=>`<option value="${j}"${j===curFil?" selected":""}>${esc(C.fname(C.PAL[j]))}${C.PAL[j].owned===false?" (not owned)":C.PAL[j].order?" (on order)":""}</option>`).join("");
  pop.innerHTML=`<div class="hd"><i style="background:${(C.PAL[curFil]||{hex:"#ccc"}).hex}"></i>${esc(S.parts[A.pi].name)} · ${a.toFixed(1)} mm²<button title="Close">×</button></div>`+
    `<div class="act"><button data-a="k-area" aria-pressed="${(S.pickKind||"area")==="area"}" title="Bounded by the sculpt's ridges and seams">Sculpted area</button><button data-a="k-patch" aria-pressed="${S.pickKind==="patch"}" title="The connected run of this color">Color patch</button></div>`+
    `<label class="spc-poplab">Paint what's highlighted<select data-a="fil">${opts}</select></label>`+
    `<label class="spc-poplab">Change this color on every piece<select data-a="all">${opts}</select></label>`+
    `<div class="act"><button data-a="same">Match another region…</button></div>`;
  const wrap=q("spcViewWrap").getBoundingClientRect();
  if(ev){pop.style.left=Math.min(wrap.width-320,Math.max(6,ev.clientX-wrap.left+12))+"px";pop.style.top=Math.min(wrap.height-170,Math.max(6,ev.clientY-wrap.top+12))+"px";}
  pop.hidden=false;
  pop.querySelector(".hd button").onclick=()=>{S.selArea=null;S.selSet=null;pop.hidden=true;paint();};
  const reselect=()=>{S.selArea=selectAt(S.areaFace);S.selSet=new Uint8Array(S.nFaces);S.selArea.faces.forEach(f=>S.selSet[f]=1);paint();showAreaPop();};
  pop.querySelector('[data-a="k-area"]').onclick=()=>{S.pickKind="area";reselect();};
  pop.querySelector('[data-a="k-patch"]').onclick=()=>{S.pickKind="patch";reselect();};
  pop.querySelector('[data-a="fil"]').onchange=e=>{paintArea(+e.target.value);S.selArea=selectAt(S.areaFace);S.selSet=new Uint8Array(S.nFaces);S.selArea.faces.forEach(f=>S.selSet[f]=1);paint();showAreaPop();};
  pop.querySelector('[data-a="all"]').onchange=e=>{if(!r)return;pushUndo({type:"fil",i:cur,prev:r.fil});r.fil=+e.target.value;r.manual=true;paint();renderRegions();showAreaPop();};
  pop.querySelector('[data-a="same"]').onclick=()=>{S.matchFrom=cur;S.selArea=null;S.selSet=null;pop.hidden=true;paint();q("spcTip").textContent="Now click the region whose filament this one should use";};
}
function pushUndo(u){S.undo.push(u);if(S.undo.length>40)S.undo.shift();q("spcUndo").disabled=false;}
q("spcUndo").onclick=()=>{const u=S.undo.pop();if(!u)return;
  if(u.type==="fil")S.regions[u.i].fil=u.prev;
  if(u.type==="patch"){u.faces.forEach((f,k)=>{S.label[f]=u.prev[k];});if(u.newRegion)S.regions.pop();sumAreas();}
  q("spcUndo").disabled=!S.undo.length;paint();renderRegions();};

/* ---------- picking ---------- */
function onPick(dface,ev){
  const face=S.vmap?S.vmap[dface]:dface;
  if(!S.label||face<0||face>=S.nFaces||S.label[face]<0)return;
  if(S.mode==="sel"&&S.matchFrom!=null&&S.matchFrom>=0){const src=S.regions[S.label[face]],dst=S.regions[S.matchFrom];
    pushUndo({type:"fil",i:S.matchFrom,prev:dst.fil});dst.fil=src.fil;dst.manual=true;S.matchFrom=null;
    q("spcTip").textContent="Click the model to pick a sculpted area (or a color patch) and change its paint";S.selected=-1;q("spcPop").hidden=true;paint();renderRegions();return;}
  if(S.mode==="sel"){pickArea(face,ev);return;}
  /* paint the connected patch of this face */
  let pi=0;while(pi+1<S.offs.length&&S.offs[pi+1]<=face)pi++;
  const off=S.offs[pi],nb=S.nb[pi],start=face-off,lab0=S.label[face],brush=+q("spcBrush").value;
  const seen=new Set([start]),stack=[start];
  while(stack.length){const t=stack.pop();for(let e=0;e<3;e++){const o=nb[t*3+e];if(o>=0&&!seen.has(o)&&S.label[off+o]===lab0){seen.add(o);stack.push(o);}}}
  const faces=[...seen].map(t=>t+off), prev=faces.map(f=>S.label[f]);
  let ri=S.regions.findIndex(r=>r.patch&&r.fil===brush), newRegion=false;
  if(ri<0){ri=S.regions.length;S.regions.push({id:ri,rgb:C.hex2rgb(C.PAL[brush].hex),fil:brush,area:0,dE:0,patch:true});newRegion=true;}
  faces.forEach(f=>S.label[f]=ri);
  pushUndo({type:"patch",faces,prev,newRegion});sumAreas();paint();renderRegions();
}
q("spcFit").onclick=()=>S.viewer&&S.viewer.fit();
q("spcZoomIn").onclick=()=>S.viewer&&S.viewer.zoom(0.7);
q("spcZoomOut").onclick=()=>S.viewer&&S.viewer.zoom(1/0.7);
document.querySelectorAll("#spc [data-view]").forEach(b=>b.onclick=()=>{const v={front:[-Math.PI/2,0.1],back:[Math.PI/2,0.1],left:[Math.PI,0.1],right:[0,0.1],top:[-Math.PI/2,1.5]}[b.dataset.view];S.viewer&&S.viewer.view(...v);});
q("spcFocus").onchange=e=>{if(!S.viewer)return;S.isolate=e.target.value===""?-1:+e.target.value;S.selected=-1;S.selArea=null;S.selSet=null;q("spcPop").hidden=true;showViewer();};
const press=(on,off)=>{q(on).setAttribute("aria-pressed","true");q(off).setAttribute("aria-pressed","false");};
q("spcShowFil").onclick=()=>{S.showRaw=false;press("spcShowFil","spcShowRaw");paint();};
q("spcShowRaw").onclick=()=>{if(!S.raw)return;S.showRaw=true;press("spcShowRaw","spcShowFil");paint();};
q("spcModeSel").onclick=()=>{S.mode="sel";press("spcModeSel","spcModePaint");};
q("spcModePaint").onclick=()=>{S.mode="paint";press("spcModePaint","spcModeSel");S.selected=-1;S.selArea=null;S.selSet=null;q("spcPop").hidden=true;paint();
  q("spcTip").textContent="Pick a filament in the box beside Paint patch, then click a patch to repaint just that patch";};
q("spcModeSel").addEventListener("click",()=>{q("spcTip").textContent="Click the model to pick a sculpted area (or a color patch) and change its paint";});

/* ---------- save ---------- */
q("spcSave").onclick=async()=>{
  try{q("spcSave").disabled=true;log("Writing the 3MF…");await tick();
    /* filaments: the project's own slots stay exactly as they are (unpainted pieces print in their
       slot); colors already there are reused, new ones are added after them */
    sumAreas();const use=new Map();S.regions.forEach(r=>{if(r.area>0)use.set(r.fil,(use.get(r.fil)||0)+r.area);});
    const order=[...use.entries()].sort((a,b)=>b[1]-a[1]).map(e=>e[0]);
    const ps0=(S.project&&S.project.ps)||null, oldFc=(ps0&&ps0.filament_colour)||[];
    const fils=oldFc.map((h,i)=>({keep:true,hex:h.slice(0,7).toUpperCase(),fid:((ps0.filament_ids||[])[i])||""}));
    const slot=new Map();
    order.forEach(pf=>{const p=C.PAL[pf],hex=p.hex.toUpperCase();
      let k=fils.findIndex(f=>f.hex===hex&&(!f.keep||!p.fid||!f.fid||f.fid===p.fid));
      if(k<0){fils.push({...p,hex,type:p.type||p.ptype||"PLA"});k=fils.length-1;}
      slot.set(pf,k+1);});
    /* the strokes, in filament slots */
    try{const m=new Map();if(S.strokes)for(const pi in S.strokes){const sk=S.strokes[pi],p=S.parts[pi],sl=r=>r>=0?slot.get(S.regions[r].fil):0;if(!p)continue;const n=sk.own.length,ownS=new Int16Array(n),ownBase=new Int16Array(n);for(let t=0;t<n;t++)if(sk.own[t]){ownS[t]=sl(sk.oS[t]);ownBase[t]=sl(sk.oB[t]);}
      m.set(p,{list:sk.list.map(x=>({X:x.X,r:x.r,s:sl(x.s),base:sl(x.base),ax:x.ax,inner:x.inner,innerS:x.innerFace!=null&&x.innerFace>=0?slot.get(S.regions[S.label[S.offs[pi]+x.innerFace]].fil):undefined})),own:sk.own,ownS,ownBase});}globalThis._spcStrokes=m;(window._spcDbg=window._spcDbg||{}).stk=[...m].map(([p,v])=>p.name.slice(-10)+':'+v.list.map(x=>x.X.length+'/'+x.r.toFixed(2)+'/s'+x.s+'b'+x.base).join(',')+' own'+v.own.reduce((a,b)=>a+b,0));}catch(e){console.log('PS ERR '+e.message+' '+e.stack);throw e;}
    /* creases pull only the emblem's own edges (a thin line laid on its own path stays as drawn) */
    {const ws=new Set();for(const [pf,k] of slot){const c=C.labHex(C.PAL[pf].hex);if(c[0]>70&&Math.hypot(c[1],c[2])<15)ws.add(k);}globalThis._spcSnapStates=ws;}
    if(fils.length>16)throw new Error(`${fils.length} filaments — Bambu painting stops at 16. Merge some regions first.`);
    /* only pieces colored here are rewritten; everything else in the file is left as it was */
    const list=[],states=[];
    S.parts.forEach((p,pi)=>{const n=p.m.f.length/3,o=S.offs[pi];
      let any=false,miss=0;for(let i=0;i<n;i++){if(S.label[o+i]>=0)any=true;else miss++;}if(!any)return;
      if(miss){fillUnlabeled([pi]);const cnt=new Map();for(let i=0;i<n;i++){const L=S.label[o+i];if(L>=0)cnt.set(L,(cnt.get(L)||0)+1);}let top=0,tv=-1;for(const [L,v] of cnt)if(v>tv){tv=v;top=L;}for(let i=0;i<n;i++)if(S.label[o+i]<0)S.label[o+i]=top;}
      const st=new Uint8Array(n);for(let i=0;i<n;i++)st[i]=slot.get(S.regions[S.label[o+i]].fil);list.push(p);states.push(st);});
    if(!list.length)throw new Error("Nothing colored to save yet.");
    const blob=await C.save3MF({project:S.project,parts:list},fils,states);
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);
    a.download=S.targetName.replace(/\.\w+$/,"").replace(/_color$/,"")+"_color.3mf";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);
    log(`Saved ${a.download} — ${list.length} piece${list.length>1?"s":""} painted, everything else untouched.\n`+
      fils.map((f,i)=>`Filament ${i+1}: ${f.keep?"(already in project) "+f.hex:C.fname(f)+" "+f.hex}`).join("\n"));
    /* pieces that got no paint print whole in the filament the project gives them (often filament 1): say so */
    const bare=[...new Set(S.parts.filter((p,pi)=>pi!==S.figPart&&!list.includes(p)).map(p=>p.name.replace(/\.stl$/i,"")))];
    if(bare.length)q("spcLog").innerHTML+="\n"+`<span class="err">${esc(`Not painted — ${bare.length} piece${bare.length>1?"s":""} will print in one filament each, as set in the project (often filament 1):\n  `+[...new Set(bare)].join("\n  ")+`\nTick them and color again if they should be painted.`)}</span>`;
  }catch(e){log(e.message,true);}finally{q("spcSave").disabled=false;}
};
q("spcClear").onclick=()=>{Object.assign(S,{target:null,figure:null,images:[],colored:null,parts:[],project:null,raw:null,label:null,regions:[],undo:[],selected:-1});
  q("spcViewWrap").hidden=true;chips();renderPieces();renderRegions();log("");q("spcSave").disabled=true;q("spcState").textContent="no model";ready();};
})();
