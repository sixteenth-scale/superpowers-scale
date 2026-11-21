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
try{q("spcKey").value=localStorage.getItem("spcMeshyKey")||"";const st=JSON.parse(localStorage.getItem("spcSettings")||"{}");
  if(st.slots)q("spcSlots").value=st.slots;if(st.detail)q("spcDetail").value=st.detail;}catch(e){}
const saveSet=()=>{try{localStorage.setItem("spcMeshyKey",q("spcKey").value.trim());
  localStorage.setItem("spcSettings",JSON.stringify({slots:+q("spcSlots").value,detail:+q("spcDetail").value}));}catch(e){}};
["spcKey","spcSlots","spcDetail"].forEach(id=>q(id).addEventListener("change",()=>{saveSet();ready();}));

/* ---------- palette panel ---------- */
const palLab=()=>C.PAL.map(f=>C.labHex(f.hex));
window._spcRenderPal=()=>renderPal();
function renderPal(){
  q("spcPalN").textContent=`(${C.PAL.length})`;
  q("spcPal").innerHTML=C.PAL.map((f,i)=>`<div class="spc-pf"><i style="background:${f.hex}"></i><span>${esc(C.fname(f))}${f.owned===false?" <em>not owned</em>":""}</span><button data-i="${i}" title="Remove">×</button></div>`).join("");
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
  const haveColor=S.colored||(S.images.length&&q("spcKey").value.trim());
  q("spcGo").disabled=!(S.target&&haveColor);
  q("spcGo").title=!S.target?"Add the model to color":!haveColor?(S.images.length?"Add your Meshy API key":"Add reference art or a colored model"):"";
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
    keys.map(k=>{const ids=groups.get(k),all=ids.every(i=>S.on.has(i)||i===S.figPart);
      return `<h4><input type="checkbox" data-plate="${k}" ${all?"checked":""}>${k?`Plate ${k}`:(keys.length>1?"Off the plates":"Pieces")}</h4>`+
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
  q("spcGo").disabled=true;q("spcSave").disabled=true;saveSet();
  const detail=Math.max(0.1,+q("spcDetail").value||0.5), slots=Math.max(1,Math.min(16,+q("spcSlots").value||8));
  /* figure: box 2, or the model itself */
  const active=[...S.on].filter(i=>i!==S.figPart).sort((a,b)=>a-b);
  if(!active.length)throw new Error("No pieces are ticked to color.");
  const fig=S.figure?S.figure.parts:S.figPart>=0?[S.parts[S.figPart]]:active.map(i=>S.parts[i]), parted=!!S.figure||S.figPart>=0;
  const figPts=(()=>{const tot=fig.reduce((s,p)=>s+p.m.f.length/3,0);const rng=C.RNG(11);const all=[];
    fig.forEach(p=>{const n=Math.max(500,Math.round(60000*(p.m.f.length/3)/tot));all.push(C.samplePts(p.m,p.M,n,rng).p);});
    const P=new Float32Array(all.reduce((s,a)=>s+a.length,0));let o=0;all.forEach(a=>{P.set(a,o);o+=a.length;});return {p:P};})();
  /* 1. colored source */
  let sources;
  if(S.colored)sources=S.colored.sources;
  else{const key=q("spcKey").value.trim();
    const stl=C.stlBytes(fig.map(p=>({m:p.m,M:p.M})));
    const glb=await C.meshyTexture(key,stl,S.images,log);
    sources=await C.readGLB(glb); S.colored={name:"Meshy result",sources}; chips();
    try{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([glb],{type:"model/gltf-binary"}));
      a.download=(S.figure||S.target).name.replace(/\.\w+$/,"")+"_meshy.glb";a.click();}catch(e){}}
  /* 2. lay it over the figure */
  log("Lining the colors up with your figure…");await tick();
  const allV=new Float32Array(sources.reduce((s,x)=>s+x.m.v.length,0));{let o=0;sources.forEach(x=>{allV.set(x.m.v,o);o+=x.m.v.length;});}
  const al=await C.alignSource(allV,figPts,tick);
  if(al.err>0.03*al.diag)log(`Lined up, but the fit is loose (${al.err.toFixed(2)} mm average). Check the result.`);
  log("Sampling colors…");await tick();
  const cloud=C.colorCloud(sources,al.M,Math.max(0.12,detail/2));
  /* 3. pieces */
  let G=null;
  if(parted){G=C.grid(figPts.p,al.diag/80);}
  const raws=[],tol=[],regM=[];let flags=[],lastErr=0;
  const errs=[];
  for(let pi=0;pi<S.parts.length;pi++){const p=S.parts[pi];
    if(!active.includes(pi))continue;
    if(C.meanEdge(p.m,p.M)>detail){let guard=0;while(C.meanEdge(p.m,p.M)>detail&&p.m.f.length/3<2e6&&guard++<4){if(!p.m0){p.m0=p.m;p.lv=0;}p.m=C.subdivide(p.m);p.lv++;p.subdivided=true;p.paint=null;}}
    if(window._spcSplit){const n0=p.m.f.length/3,m2=C.splitLong(p.m,p.M,2*detail,2e6);if(m2.f.length/3>n0){p.m=m2;p.subdivided=true;p.paint=null;((window._spcDbg=window._spcDbg||{}).split=window._spcDbg.split||[]).push(p.name+':'+n0+'>'+m2.f.length/3);}}
    if(parted){log(`Finding piece ${active.indexOf(pi)+1} of ${active.length} on the figure: ${p.name}…`);await tick();
      const r=await C.registerPart(p,figPts,G,tick,al.diag/80);regM[pi]=r.M;errs[pi]=r.err;}}
  /* a piece named left or right belongs on that side of the figure: the side the other left pieces landed on.
     A mirror-image limb (a rigid leg) can fit the wrong leg almost as well, so it is placed again on its own side */
  if(parted){let fx=0;for(let i=0;i<figPts.p.length;i+=3)fx+=figPts.p[i];fx/=figPts.p.length/3;
    const side=pi=>{const nm=S.parts[pi].name.toLowerCase();return /left/.test(nm)?1:/right/.test(nm)?-1:0;};
    const cx=(pi,M)=>{const v=C.xf(C.mul4(M,S.parts[pi].M),S.parts[pi].m.v);let x=0;for(let i=0;i<v.length;i+=3)x+=v[i];return x/(v.length/3)-fx;};
    let vote=0;for(const pi of active){const sd=side(pi);if(sd&&regM[pi]&&errs[pi]<0.8)vote+=sd*Math.sign(cx(pi,regM[pi]));}
    const leftSign=vote>=0?1:-1;
    for(const pi of active){const sd=side(pi);if(!sd||!regM[pi])continue;const want=sd*leftSign;
      if(Math.sign(cx(pi,regM[pi]))===want)continue;
      log(`Placing ${S.parts[pi].name} on its own side…`);await tick();
      const r=await C.registerPart(S.parts[pi],figPts,G,tick,al.diag/80,M=>Math.sign(cx(pi,M))===want);
      if(isFinite(r.err)&&Math.sign(cx(pi,r.M))===want){regM[pi]=r.M;errs[pi]=r.err;}}}
  for(let pi=0;pi<S.parts.length;pi++){const p=S.parts[pi];
    if(!active.includes(pi)){raws.push(null);continue;}
    let Mx=null;
    if(parted){Mx=regM[pi];lastErr=errs[pi];(window._spcReg=window._spcReg||{})[p.name]={M:Mx,err:lastErr};if(lastErr>0.6)flags.push(`${p.name} (${lastErr.toFixed(2)} mm)`);}
    log(`Coloring ${p.name}…`);await tick();
    const tr=await C.transferColors(p,cloud,Mx,tick);raws.push(tr);tol[pi]=Math.max(0.5,3*(Mx?lastErr:0)+2*al.err);}
  rebuildIndex();S.areaC={};
  S.raw=new Float32Array(S.nFaces*3).fill(0.8);raws.forEach((r,pi)=>{if(r)S.raw.set(r.rgb,S.offs[pi]*3);});
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
  if(S.images.length&&window._spcPhotoPalette){try{const pal=await photoPalette(S.images);
    if(pal.length>=2){S.regions=pal.map((rgb,i)=>({id:i,rgb,fil:-1,area:0,dE:0,patch:false}));const pl=pal.map(c=>C.lab(...c));
      for(let i=0;i<S.nFaces;i++){if(S.label[i]<0)continue;let b=0,bd=Infinity;for(let c=0;c<pl.length;c++){const d=(L[i*3]-pl[c][0])**2+(L[i*3+1]-pl[c][1])**2+(L[i*3+2]-pl[c][2])**2;if(d<bd){bd=d;b=c;}}S.label[i]=b;}}
    (window._spcDbg=window._spcDbg||{}).palette=pal.map(c=>C.rgb2hex(c));}catch(e){console.warn(e);window._spcDbgErr=String(e&&e.stack||e);}}
  /* where two pieces touch, nobody sees it; soles stand on the ground: both count as hidden */
  let fz0=Infinity,fz1=-Infinity;for(let i=2;i<figPts.p.length;i+=3){fz0=Math.min(fz0,figPts.p[i]);fz1=Math.max(fz1,figPts.p[i]);}
  const gnd=markContacts(active,regM,hid,fz0,fz1);
  if(!window._spcNoTuck){log("Finding spots no one will see…");await tick();try{tuckedAreas(active,regM,hid);}catch(e){console.warn(e);}}
  /* the photos say what each visible face really looks like */
  let photo=null;
  if(S.images.length){log("Reading your photos…");await tick();
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
  if(window._spcRidgeCap)ridgeCap(active,regM);
  if(window._spcCapThigh)capToThighs(active,regM);
  if(!window._spcNoThighCap)thighCap(active,regM);
  if(!window._spcNoIslands)dropIslands(active,2);
  pinColors(active,hid);
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
/* pins sit inside a joint where nothing can see them, and a plain cylinder can't be placed on the
   figure. A pin (or any piece that is entirely hidden) takes the main color of the hidden joint faces
   of the pieces it joins: a left knee pin follows the left thigh and calf, an elbow pin the arm. */
function pinColors(active,hid){
  const nameOf=pi=>S.parts[pi].name.toLowerCase();
  const isPin=pi=>{if(/pin|peg/.test(nameOf(pi)))return true;const o=S.offs[pi],n=S.parts[pi].m.f.length/3;
    for(let i=0;i<n;i++)if(!hid[o+i])return false;return true;};
  const pins=active.filter(isPin),others=active.filter(pi=>!pins.includes(pi));
  for(const pi of pins){const nm=nameOf(pi),side=/left/.test(nm)?"left":/right/.test(nm)?"right":"";
    const joint=/knee/.test(nm)?/calf|thigh|leg|shin|knee/:/elbow/.test(nm)?/arm|elbow|bicep|hand/:/hip/.test(nm)?/thigh|leg|torso|hip/:null;
    let cand=others.filter(q=>(!joint||joint.test(nameOf(q)))&&(!side||nameOf(q).includes(side)));
    if(!cand.length)cand=others.filter(q=>!joint||joint.test(nameOf(q)));
    if(!cand.length)cand=others;
    const tally=new Map();
    for(const q of cand){const o=S.offs[q],n=S.parts[q].m.f.length/3;
      for(let i=0;i<n;i++){const L=S.label[o+i];if(L<0||!hid[o+i])continue;tally.set(L,(tally.get(L)||0)+S.area[o+i]);}}
    if(!tally.size)for(const q of cand){const o=S.offs[q],n=S.parts[q].m.f.length/3;
      for(let i=0;i<n;i++){const L=S.label[o+i];if(L>=0)tally.set(L,(tally.get(L)||0)+S.area[o+i]);}}
    let best=-1,ba=-1;for(const [L,a] of tally)if(a>ba){ba=a;best=L;}
    if(best<0)continue;const o=S.offs[pi],n=S.parts[pi].m.f.length/3;for(let i=0;i<n;i++)S.label[o+i]=best;}
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
function snapMainToRidges(active,D){D=D||8;let moved=0;const rep=[];
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
    for(let i=0;i<main.length;i++)for(let j=i+1;j<main.length;j++){const a=main[i],b=main[j];
      /* the band: faces of a or b within D of their shared border */
      const dist=new Float32Array(n).fill(Infinity),q=[];
      for(let t=0;t<n;t++){const L=S.label[o+t];if(L!==a&&L!==b)continue;for(let e=0;e<3;e++){const u=nb[t*3+e];if(u>=0){const M=S.label[o+u];if(M!==L&&(M===a||M===b)){dist[t]=0;q.push(t);break;}}}}
      if(!q.length)continue;
      for(let h=0;h<q.length;h++){const t=q[h];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0)continue;const M=S.label[o+u];if(M!==a&&M!==b)continue;
          const dd=dist[t]+Math.hypot(g.c[u*3]-g.c[t*3],g.c[u*3+1]-g.c[t*3+1],g.c[u*3+2]-g.c[t*3+2]);if(dd<dist[u]&&dd<=D){dist[u]=dd;q.push(u);}}}
      const fr=[],idx=new Int32Array(n).fill(-1);for(let t=0;t<n;t++)if(dist[t]<=D){idx[t]=fr.length;fr.push(t);}
      const N=fr.length,sc=new Float64Array(N),tc=new Float64Array(N),eu=[],ev=[],ew=[];
      const cheap=t=>bend[t]>0.03;
      for(let k=0;k<N;k++){const t=fr[k],cur=S.label[o+t];let ca=cur===a?0:0.02*A[o+t],cb=cur===b?0:0.02*A[o+t];
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
      if(l>0.3&&inward*nx/l>0.7){S.label[o+t]=body;ch++;}}
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
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const o=(y*W+x)*3;if(Math.hypot(L[o]-bg[0],L[o+1]-bg[1],L[o+2]-bg[2])>14){fg[y*W+x]=1;rows[y]++;cols[x]++;}}
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
async function photoPalette(files){
  const Ls=[],Rs=[];for(const f of files.slice(0,4)){const ph=await readPhoto(f);
    for(let y=0;y<ph.H;y+=2)for(let x=0;x<ph.W;x+=2){const j=y*ph.W+x;if(!ph.fg[j]||ph.edge[j]>10)continue;Ls.push(ph.L[j*3],ph.L[j*3+1],ph.L[j*3+2]);Rs.push(ph.rgb[j*3],ph.rgb[j*3+1],ph.rgb[j*3+2]);}}
  const N=Ls.length/3;if(N<100)return [];const L=Float32Array.from(Ls),Wt=new Float32Array(N).fill(1),cents=C.kmeans(L,Wt,14,C.RNG(7));
  const cl=cents.map(()=>({r:0,g:0,b:0,n:0}));
  for(let i=0;i<N;i++){let b=0,bd=Infinity;for(let c=0;c<cents.length;c++){const d=(L[i*3]-cents[c][0])**2+(L[i*3+1]-cents[c][1])**2+(L[i*3+2]-cents[c][2])**2;if(d<bd){bd=d;b=c;}}const q=cl[b];q.r+=Rs[i*3];q.g+=Rs[i*3+1];q.b+=Rs[i*3+2];q.n++;}
  let G=cl.filter(q=>q.n>0).map(q=>({rgb:[q.r/q.n/255,q.g/q.n/255,q.b/q.n/255],area:q.n}));
  const twin=(A,B)=>{const a=C.lab(...A.rgb),b=C.lab(...B.rgb);
    if(C.dE(a,b)<10)return true;
    const [big,small,lb,ls]=A.area>=B.area?[A,B,a,b]:[B,A,b,a],cB=Math.hypot(lb[1],lb[2]),cS=Math.hypot(ls[1],ls[2]);
    if(small.area>0.5*big.area||cB<20)return false;
    let dh=Math.abs(Math.atan2(lb[2],lb[1])-Math.atan2(ls[2],ls[1]))*180/Math.PI;if(dh>180)dh=360-dh;
    if(dh<14&&ls[0]<lb[0]-8)return true;          /* shadow */
    if(dh<10&&ls[0]>lb[0]+8&&cS<cB)return true;   /* shine */
    return false;};
  for(;;){let m=null;for(let i=0;i<G.length&&!m;i++)for(let j=i+1;j<G.length;j++)if(twin(G[i],G[j])){m=[i,j];break;}
    if(!m)break;const A=G[m[0]],B=G[m[1]],[big,small]=A.area>=B.area?[A,B]:[B,A];big.area+=small.area;G=G.filter(x=>x!==small);}
  const tot=G.reduce((s,q)=>s+q.area,0);
  return G.filter(q=>q.area>=0.004*tot).sort((a,b)=>b.area-a.area).map(q=>q.rgb);
}
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
  if(photos.length>=2&&(isFront(photos[0])&&!isFront(photos[1])||isBack(photos[1])&&!isBack(photos[0]))){use.push([0,-1],[1,1]);}
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
    const stray=[...Array(R).keys()].filter(L=>ar[L]>0&&ar[L]<Math.max(2,0.03*tot)&&shown[L]<0.25*ar[L]);
    if(!stray.length)continue;const isS=new Uint8Array(R);stray.forEach(L=>isS[L]=1);
    for(let pass=0;pass<30;pass++){let ch=0;
      for(let t=0;t<n;t++){const i=o+t,L=S.label[i];if(L<0||!isS[L])continue;const v=new Map();
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
  const assign=()=>S.regions.forEach(r=>{const l=C.lab(...r.rgb);let b=-1,bd=Infinity;for(const i of allowed){const d=C.dE(l,PL[i]);if(d<bd){bd=d;b=i;}}r.fil=b;r.dE=bd;});
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
    const opts=order.map(([j,d])=>`<option value="${j}"${j===r.fil?" selected":""}>${esc(C.fname(C.PAL[j]))}${C.PAL[j].owned===false?" (not owned)":""} · ΔE ${d.toFixed(0)}</option>`).join("");
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
  const opts=C.PAL.map((f,j)=>[j,C.dE(ref,PL[j])]).sort((x,y)=>(x[0]===curFil?-1:y[0]===curFil?1:x[1]-y[1])).map(([j])=>`<option value="${j}"${j===curFil?" selected":""}>${esc(C.fname(C.PAL[j]))}${C.PAL[j].owned===false?" (not owned)":""}</option>`).join("");
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
  }catch(e){log(e.message,true);}finally{q("spcSave").disabled=false;}
};
q("spcClear").onclick=()=>{Object.assign(S,{target:null,figure:null,images:[],colored:null,parts:[],project:null,raw:null,label:null,regions:[],undo:[],selected:-1});
  q("spcViewWrap").hidden=true;chips();renderPieces();renderRegions();log("");q("spcSave").disabled=true;q("spcState").textContent="no model";ready();};
})();
