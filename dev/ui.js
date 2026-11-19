(()=>{
const C=SPC, q=id=>document.getElementById(id);
if(!q("spc"))return;
const S={on:new Set(),figPart:-1,target:null,figure:null,images:[],colored:null, parts:[],project:null, offs:[],nFaces:0,
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
  S.on=nPl>1?new Set():new Set(t.parts.map((_,i)=>i));S.figPart=-1;
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
function visibleParts(){const on=[...S.on].filter(i=>i!==S.figPart);return on.length?on.sort((a,b)=>a-b):S.parts.map((_,i)=>i);}
function showViewer(keepView){
  q("spcViewWrap").hidden=false;
  if(!S.viewer){S.viewer=C.Viewer(q("spcCv"),onPick);if(!S.viewer){log("This browser has no WebGL2 — the 3D view is off, but coloring and saving still work.",true);return;}}
  const vis=visibleParts();let n=0;vis.forEach(pi=>n+=S.parts[pi].m.f.length/3);
  const pos=new Float32Array(n*9);S.vmap=new Int32Array(n);S.vrange=new Map();let o=0;
  vis.forEach(pi=>{const p=S.parts[pi],v=C.xf(p.M,p.m.v),f=p.m.f,nf=f.length/3,g=S.offs[pi];
    for(let i=0;i<f.length;i++){const k=f[i]*3;pos[o*9+i*3]=v[k];pos[o*9+i*3+1]=v[k+1];pos[o*9+i*3+2]=v[k+2];}
    for(let t=0;t<nf;t++)S.vmap[o+t]=g+t; S.vrange.set(pi,[o,o+nf]); o+=nf;});
  S.vpos=pos; S.viewer.setGeometry(pos,keepView); paint();
  q("spcFocus").innerHTML='<option value="">Zoom to piece…</option>'+vis.map(pi=>`<option value="${pi}">${esc(S.parts[pi].name)}</option>`).join("");
}
function paint(){ if(!S.viewer||!S.vmap)return;
  const n=S.vmap.length,col=new Uint8Array(n*9);
  const fc=S.regions.map((r,ri)=>{const c=S.showRaw||r.fil<0?r.rgb:C.hex2rgb(C.PAL[r.fil].hex);
    const h=ri===S.selected?0.35:0;return c.map(x=>Math.round(255*(x+(1-x)*h)));});
  for(let d=0;d<n;d++){const i=S.vmap[d];let c;const L=S.label?S.label[i]:-1;
    if(S.showRaw&&S.raw&&L>=0)c=[S.raw[i*3]*255,S.raw[i*3+1]*255,S.raw[i*3+2]*255];
    else if(L>=0)c=fc[L];else c=[205,205,212];
    if(S.showRaw&&L>=0&&L===S.selected)c=c.map(x=>x+(255-x)*0.35);
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
  const raws=[],tol=[];let flags=[],lastErr=0;
  for(let pi=0;pi<S.parts.length;pi++){const p=S.parts[pi];
    if(!active.includes(pi)){raws.push(null);continue;}
    if(C.meanEdge(p.m,p.M)>detail){let guard=0;while(C.meanEdge(p.m,p.M)>detail&&p.m.f.length/3<2e6&&guard++<4){p.m=C.subdivide(p.m);p.subdivided=true;p.paint=null;}}
    let Mx=null;
    if(parted){log(`Finding piece ${active.indexOf(pi)+1} of ${active.length} on the figure: ${p.name}…`);await tick();
      const r=await C.registerPart(p,figPts,G,tick,al.diag/80); Mx=r.M; lastErr=r.err; if(r.err>0.6)flags.push(`${p.name} (${r.err.toFixed(2)} mm)`);}
    log(`Coloring ${p.name}…`);await tick();
    const tr=await C.transferColors(p,cloud,Mx,tick);raws.push(tr);tol[pi]=Math.max(0.5,3*(Mx?lastErr:0)+2*al.err);}
  rebuildIndex();
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
  /* merge regions that are the same color in practice */
  const k=cents.length, rgbSum=cents.map(()=>[0,0,0,0]);
  for(let i=0;i<S.nFaces;i++){if(lab[i]<0)continue;const s=rgbSum[lab[i]],a=S.area[i];s[0]+=S.raw[i*3]*a;s[1]+=S.raw[i*3+1]*a;s[2]+=S.raw[i*3+2]*a;s[3]+=a;}
  let regs=rgbSum.map((s,i)=>({rgb:s[3]?[s[0]/s[3],s[1]/s[3],s[2]/s[3]]:[0,0,0],area:s[3],alias:i}));
  for(;;){let best=null;const live=regs.filter(r=>r.area>0&&r.alias===regs.indexOf(r));
    for(let a=0;a<live.length;a++)for(let b=a+1;b<live.length;b++){const d=C.dE(C.lab(...live[a].rgb),C.lab(...live[b].rgb));if(d<7&&(!best||d<best[0]))best=[d,live[a],live[b]];}
    if(!best)break;const [,A,B]=best,ia=regs.indexOf(A),ib=regs.indexOf(B),t=A.area+B.area;
    A.rgb=A.rgb.map((x,j)=>(x*A.area+B.rgb[j]*B.area)/t);A.area=t;B.area=0;regs.forEach(r=>{if(r.alias===ib)r.alias=ia;});}
  for(let i=0;i<S.nFaces;i++)if(lab[i]>=0)lab[i]=regs[lab[i]].alias;
  /* edges follow the sculpt: a color boundary costs a lot across smooth surface and almost nothing
     along a crease, so boundaries settle into the helmet rim, cuffs, belt edges; blotches dissolve */
  log("Tidying color edges along the sculpt…");await tick();
  {const cl=new Map();regs.forEach((r,i)=>{if(r.alias===i&&r.area>0)cl.set(i,C.lab(...r.rgb));});
   for(const pi of active){const p=S.parts[pi],o=S.offs[pi],n=p.m.f.length/3,nb=S.nb[pi],fn=C.faceNormals(p.m);
     const w=new Float32Array(n*3);for(let t=0;t<n;t++)for(let e=0;e<3;e++){const u2=nb[t*3+e];if(u2<0)continue;
       const cs=fn[t*3]*fn[u2*3]+fn[t*3+1]*fn[u2*3+1]+fn[t*3+2]*fn[u2*3+2];w[t*3+e]=Math.exp(-(1-cs)/0.08);}
     const cost=(t,Lb)=>{const c0=cl.get(Lb);if(!c0)return 99;const i=o+t;return Math.hypot(L[i*3]-c0[0],L[i*3+1]-c0[1],L[i*3+2]-c0[2])/18;};
     for(let sweep=0;sweep<6;sweep++){let changed=0;
       for(let t=0;t<n;t++){const i=o+t;if(hid[i]||lab[i]<0)continue;
         const cand=new Set([lab[i]]);for(let e=0;e<3;e++){const u2=nb[t*3+e];if(u2>=0&&lab[o+u2]>=0&&!hid[o+u2])cand.add(lab[o+u2]);}
         if(cand.size<2)continue;let best=lab[i],be=Infinity;
         for(const Lb of cand){let en=cost(t,Lb);for(let e=0;e<3;e++){const u2=nb[t*3+e];if(u2<0||hid[o+u2]||lab[o+u2]<0)continue;if(lab[o+u2]!==Lb)en+=1.6*w[t*3+e];}
           if(en<be){be=en;best=Lb;}}
         if(best!==lab[i]){lab[i]=best;changed++;}}
       if(!changed)break;await tick();}}}
  S.parts.forEach((p,pi)=>{if(!active.includes(pi))return;const n=p.m.f.length/3,sub=lab.subarray(S.offs[pi],S.offs[pi]+n);
    C.cleanIslands(S.nb[pi],S.area.subarray(S.offs[pi],S.offs[pi]+n),sub,Math.max(0.5,detail*detail*4));});
  /* specks of color under 0.1% of the model go to the nearest-colored region */
  {const tot=W.reduce((a,b)=>a+b,0),ar=new Map();for(let i=0;i<S.nFaces;i++)if(lab[i]>=0)ar.set(lab[i],(ar.get(lab[i])||0)+S.area[i]);
    const big=[...ar.keys()].filter(x=>ar.get(x)>=tot*0.001),to=new Map();
    for(const [x,a] of ar)if(a<tot*0.001&&big.length){const l=C.lab(...regs[x].rgb);let b=big[0],bd=Infinity;
      for(const y of big){const d=C.dE(l,C.lab(...regs[y].rgb));if(d<bd){bd=d;b=y;}}to.set(x,b);}
    if(to.size)for(let i=0;i<S.nFaces;i++)if(to.has(lab[i]))lab[i]=to.get(lab[i]);}
  const ids=[...new Set(lab)].filter(x=>x>=0);const remap=new Map(ids.map((x,i)=>[x,i]));remap.set(-1,-1);
  S.label=Int32Array.from(lab,x=>remap.get(x));
  fillHidden(hid);
  S.regions=ids.map((x,i)=>({id:i,rgb:regs[x].rgb,fil:-1,area:0,dE:0,patch:false}));
  sumAreas();S.regions.sort((a,b)=>b.area-a.area);{const ord=new Map(S.regions.map((r,i)=>[r.id,i]));S.regions.forEach((r,i)=>r.id=i);S.label=S.label.map(x=>x<0?-1:ord.get(x));}
  /* region colors from final labels */
  {const acc=S.regions.map(()=>[0,0,0,0]);for(let i=0;i<S.nFaces;i++){if(S.label[i]<0||hid[i])continue;const s=acc[S.label[i]],a=S.area[i];s[0]+=S.raw[i*3]*a;s[1]+=S.raw[i*3+1]*a;s[2]+=S.raw[i*3+2]*a;s[3]+=a;}
    S.regions.forEach((r,i)=>{if(acc[i][3])r.rgb=[acc[i][0]/acc[i][3],acc[i][1]/acc[i][3],acc[i][2]/acc[i][3]];});}
  matchFilaments(slots);
  S.undo=[];q("spcUndo").disabled=true;S.selected=-1;
  showViewer(true);renderRegions();q("spcSave").disabled=false;q("spcGo").disabled=false;
  const bad=S.regions.filter(r=>r.dE>10).length;
  log(`Done — ${S.regions.length} regions on ${new Set(S.regions.map(r=>r.fil)).size} filaments.`+
    (bad?` ${bad} flagged: no close match on your shelf.`:"")+(flags.length?`\nCheck these pieces, they did not fit the figure cleanly: ${flags.join(", ")}`:""));
}
/* hidden patches take the color around them. Each connected hidden patch gets one color (fewer
   filament swaps): the neighbor color with the most shared edge, weighted by how much of the piece
   that color covers, so a body color beats a thin trim like a belt. */
function fillHidden(hid){
  S.parts.forEach((p,pi)=>{const o=S.offs[pi],n=p.m.f.length/3,nb=S.nb[pi];
    const share=new Map();let tot=0;
    for(let i=0;i<n;i++){const L=S.label[o+i];if(L<0||hid[o+i])continue;share.set(L,(share.get(L)||0)+S.area[o+i]);tot+=S.area[o+i];}
    if(!tot)return;
    const seen=new Uint8Array(n);
    for(let s=0;s<n;s++){if(seen[s]||!hid[o+s]||S.label[o+s]<0)continue;
      const patch=[s],votes=new Map();seen[s]=1;
      for(let q2=0;q2<patch.length;q2++){const t=patch[q2];
        for(let e=0;e<3;e++){const u2=nb[t*3+e];if(u2<0)continue;
          if(hid[o+u2]){if(!seen[u2]&&S.label[o+u2]>=0){seen[u2]=1;patch.push(u2);}}
          else{const L=S.label[o+u2];if(L>=0)votes.set(L,(votes.get(L)||0)+1);}}}
      if(!votes.size)continue; /* a whole piece hidden inside (knee pins): keep its nearest color */
      let best=-1,bs=-1;for(const [L,cnt] of votes){const sc=cnt*Math.sqrt((share.get(L)||0)/tot);if(sc>bs){bs=sc;best=L;}}
      patch.forEach(t=>S.label[o+t]=best);}
  });
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
function select(i){S.selected=S.selected===i?-1:i;paint();renderRegions();}
function pushUndo(u){S.undo.push(u);if(S.undo.length>40)S.undo.shift();q("spcUndo").disabled=false;}
q("spcUndo").onclick=()=>{const u=S.undo.pop();if(!u)return;
  if(u.type==="fil")S.regions[u.i].fil=u.prev;
  if(u.type==="patch"){u.faces.forEach((f,k)=>{S.label[f]=u.prev[k];});if(u.newRegion)S.regions.pop();sumAreas();}
  q("spcUndo").disabled=!S.undo.length;paint();renderRegions();};

/* ---------- picking ---------- */
function onPick(dface){
  const face=S.vmap?S.vmap[dface]:dface;
  if(!S.label||face<0||face>=S.nFaces||S.label[face]<0)return;
  if(S.mode==="sel"){select(S.label[face]);const el=q("spcRegions").querySelector(`[data-i="${S.label[face]}"]`);if(el)el.scrollIntoView({block:"nearest"});return;}
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
q("spcFocus").onchange=e=>{const pi=+e.target.value;if(e.target.value===""||!S.viewer)return;const [a,b]=S.vrange.get(pi);
  S.viewer.fitBox(C.bboxOf(S.vpos.subarray(a*9,b*9)));};
const press=(on,off)=>{q(on).setAttribute("aria-pressed","true");q(off).setAttribute("aria-pressed","false");};
q("spcShowFil").onclick=()=>{S.showRaw=false;press("spcShowFil","spcShowRaw");paint();};
q("spcShowRaw").onclick=()=>{if(!S.raw)return;S.showRaw=true;press("spcShowRaw","spcShowFil");paint();};
q("spcModeSel").onclick=()=>{S.mode="sel";press("spcModeSel","spcModePaint");};
q("spcModePaint").onclick=()=>{S.mode="paint";press("spcModePaint","spcModeSel");};

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
      for(let i=0;i<n;i++)if(S.label[o+i]<0)return;
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
