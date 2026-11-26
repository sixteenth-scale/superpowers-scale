/* ---------- color for Bambu Studio ------------------------------------------
   Paint a figure -- or the parted-out pieces of one -- from reference art, on
   the filaments actually on the shelf, and save a 3MF that opens in Bambu
   Studio already painted.

   1. Meshy textures the whole figure from the photos (or drop a model that is
      already colored: a Meshy GLB, or a 3MF painted earlier).
   2. The colors are moved back onto YOUR geometry. Parted-out pieces are found
      on the figure wherever they sit on the plate.
   3. Colors are grouped into regions, each matched to the closest filament.
      Anything without a close match is flagged.
   4. Fix anything: click a region to change its filament, or paint one patch.
   5. Save. A Bambu project keeps its plate, settings and layout -- only the
      paint and the filament list change.

   Everything runs in this page. The only thing sent anywhere is the figure
   and the photos, to Meshy, with your own key. --------------------------- */
const SPC=(()=>{

/* ---------- filaments ---------- */
/* Rob's shelf, from his Bambu store orders. Hex and preset ids are Bambu's own
   (BambuStudio filaments_color_codes.json). */
const OWNED=[
["10601","PLA Basic","Blue","#0A2989","GFA00"],["10101","PLA Basic","Black","#000000","GFA00"],
["10103","PLA Basic","Gray","#8E9089","GFA00"],["10200","PLA Basic","Red","#C12E1F","GFA00"],
["10501","PLA Basic","Bambu Green","#00AE42","GFA00"],["10100","PLA Basic","Jade White","#FFFFFF","GFA00"],
["10700","PLA Basic","Purple","#5E43B7","GFA00"],["10400","PLA Basic","Yellow","#F4EE2A","GFA00"],
["10402","PLA Basic","Sunflower Yellow","#FEC600","GFA00"],["10604","PLA Basic","Cobalt Blue","#0056B8","GFA00"],
["10105","PLA Basic","Dark Gray","#545454","GFA00"],["10201","PLA Basic","Beige","#F7E6DE","GFA00"],
["10800","PLA Basic","Brown","#9D432C","GFA00"],["10102","PLA Basic","Silver","#A6A9AA","GFA00"],
["11602","PLA Matte","Dark Blue","#042F56","GFA01"],["11600","PLA Matte","Marine Blue","#0078BF","GFA01"],
["11401","PLA Matte","Desert Tan","#E8DBB7","GFA01"],["11700","PLA Matte","Lilac Purple","#AE96D4","GFA01"],
["11500","PLA Matte","Grass Green","#61C680","GFA01"],["11803","PLA Matte","Caramel","#AE835B","GFA01"],
["11800","PLA Matte","Latte Brown","#D3B7A7","GFA01"],["11103","PLA Matte","Bone White","#CBC6B8","GFA01"],
["11802","PLA Matte","Dark Chocolate","#4D3324","GFA01"],["11101","PLA Matte","Charcoal","#000000","GFA01"],
["11801","PLA Matte","Dark Brown","#7D6556","GFA01"],["11300","PLA Matte","Mandarin Orange","#F99963","GFA01"],
["11502","PLA Matte","Apple Green","#C2E189","GFA01"],["11203","PLA Matte","Terracotta","#B15533","GFA01"],
["13301","PLA Translucent","Orange","#F74E02","GFA17"],["13210","PLA Translucent","Red","#B50011","GFA17"],
["53101","TPU for AMS","Black","#000000","GFU02"],
["13102","PLA Metal","Iron Gray Metallic","#43403D","GFA02"]
].map(([code,type,color,hex,fid])=>({code,type,color,hex,fid,vendor:"Bambu Lab",owned:true}));
/* Rob's other brands. skin:true is the face filament: faces take it whenever it is in the palette. */
{const dc=OWNED.find(f=>f.color==="Dark Chocolate");if(dc)dc.hairFil=true;} /* the hair filament */
OWNED.push({code:"",type:"PLA Pro",color:"Beige",hex:"#E3C7B0",fid:"GFL99",vendor:"3DHoJor",owned:true,skin:true,ptype:"PLA"});
const PRESET={GFA00:"Bambu PLA Basic",GFA01:"Bambu PLA Matte",GFA17:"Bambu PLA Translucent",
  GFU02:"Bambu TPU for AMS",GFA02:"Bambu PLA Metal",GFA05:"Bambu PLA Silk",GFA06:"Bambu PLA Silk+",
  GFA07:"Bambu PLA Marble",GFA08:"Bambu PLA Sparkle",GFA09:"Bambu PLA Tough",GFA11:"Bambu PLA Aero",
  GFA12:"Bambu PLA Glow",GFA13:"Bambu PLA Dynamic",GFA15:"Bambu PLA Galaxy",GFG00:"Bambu PETG Basic",
  GFG01:"Bambu PETG Translucent",GFG02:"Bambu PETG HF",GFL99:"Generic PLA"};
/* nozzle temperature per filament (first layer, other layers, low, high), so a slot carries its own
   filament's heat and not the heat of the filament it was copied from */
const NOZ={GFA05:[230,230,210,240],GFA06:[230,230,210,240],GFA09:[220,220,190,240],GFA11:[250,250,230,260],
  GFG00:[255,255,230,270],GFG01:[250,250,230,270],GFG02:[245,245,230,270],GFU02:[230,230,220,240],
  PLA:[220,220,190,240],PETG:[255,255,230,270],TPU:[230,230,220,240]};
const CATALOG_URL="https://raw.githubusercontent.com/bambulab/BambuStudio/master/resources/profiles/BBL/filament/filaments_color_codes.json";
const LS_PAL="spcPalette", LS_KEY="spcMeshyKey", LS_SET="spcSettings";
const fname=f=>(f.vendor&&f.vendor!=="Bambu Lab"?f.vendor+" ":"")+(f.type?f.type+" ":"")+f.color;

let PAL=[];
function loadPalette(){
  let saved=null; try{saved=JSON.parse(localStorage.getItem(LS_PAL)||"null");}catch(e){}
  PAL=Array.isArray(saved)&&saved.length?saved:OWNED.map(f=>({...f}));
  /* filaments added to the shelf since the palette was saved join it */
  const k=f=>(f.vendor||"")+"|"+(f.type||"")+"|"+f.color;for(const f of OWNED)if(!PAL.some(p=>k(p)===k(f)))PAL.push({...f});
  for(const f of OWNED)for(const fl of ['skin','hairFil'])if(f[fl]){const p=PAL.find(p=>k(p)===k(f));if(p)p[fl]=true;}
}
function savePalette(){try{localStorage.setItem(LS_PAL,JSON.stringify(PAL));}catch(e){}}
let CATALOG=null;
async function catalog(){
  if(CATALOG)return CATALOG;
  const j=await (await fetch(CATALOG_URL)).json();
  CATALOG=j.data.filter(d=>d.fila_color&&d.fila_color.length===1).map(d=>({
    code:d.fila_color_code,type:d.fila_type,color:(d.fila_color_name&&d.fila_color_name.en)||d.fila_color_code,
    hex:d.fila_color[0].slice(0,7).toUpperCase(),fid:d.fila_id,vendor:"Bambu Lab"}));
  return CATALOG;
}

/* ---------- color math ---------- */
const hex2rgb=h=>{h=h.replace("#","");return [parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255];};
const rgb2hex=c=>"#"+c.map(v=>Math.max(0,Math.min(255,Math.round(v*255))).toString(16).padStart(2,"0")).join("").toUpperCase();
function lab(r,g,b){
  const f=v=>v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);
  r=f(r);g=f(g);b=f(b);
  let x=(r*0.4124+g*0.3576+b*0.1805)/0.95047,y=r*0.2126+g*0.7152+b*0.0722,z=(r*0.0193+g*0.1192+b*0.9505)/1.08883;
  const t=v=>v>0.008856?Math.cbrt(v):7.787*v+16/116;
  x=t(x);y=t(y);z=t(z);
  return [116*y-16,500*(x-y),200*(y-z)];
}
function dE(a,b){ /* CIEDE2000 */
  const [L1,a1,b1]=a,[L2,a2,b2]=b, rad=Math.PI/180;
  const C1=Math.hypot(a1,b1),C2=Math.hypot(a2,b2),Cb=(C1+C2)/2;
  const G=0.5*(1-Math.sqrt(Math.pow(Cb,7)/(Math.pow(Cb,7)+Math.pow(25,7))));
  const a1p=(1+G)*a1,a2p=(1+G)*a2,C1p=Math.hypot(a1p,b1),C2p=Math.hypot(a2p,b2);
  const h=(x,y)=>{if(x===0&&y===0)return 0;let v=Math.atan2(y,x)/rad;return v<0?v+360:v;};
  const h1p=h(a1p,b1),h2p=h(a2p,b2);
  const dL=L2-L1,dC=C2p-C1p;
  let dh=0; if(C1p*C2p!==0){dh=h2p-h1p; if(dh>180)dh-=360; else if(dh<-180)dh+=360;}
  const dH=2*Math.sqrt(C1p*C2p)*Math.sin(dh/2*rad);
  const Lb=(L1+L2)/2,Cbp=(C1p+C2p)/2;
  let hb=h1p+h2p; if(C1p*C2p!==0){hb=Math.abs(h1p-h2p)>180?(h1p+h2p+360)/2:(h1p+h2p)/2;}
  const T=1-0.17*Math.cos((hb-30)*rad)+0.24*Math.cos(2*hb*rad)+0.32*Math.cos((3*hb+6)*rad)-0.2*Math.cos((4*hb-63)*rad);
  const dT=30*Math.exp(-Math.pow((hb-275)/25,2)), RC=2*Math.sqrt(Math.pow(Cbp,7)/(Math.pow(Cbp,7)+Math.pow(25,7)));
  const SL=1+0.015*Math.pow(Lb-50,2)/Math.sqrt(20+Math.pow(Lb-50,2)),SC=1+0.045*Cbp,SH=1+0.015*Cbp*T,RT=-Math.sin(2*dT*rad)*RC;
  return Math.sqrt(Math.pow(dL/SL,2)+Math.pow(dC/SC,2)+Math.pow(dH/SH,2)+RT*(dC/SC)*(dH/SH));
}
const labHex=h=>lab(...hex2rgb(h));

/* ---------- zip ---------- */
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(u8){let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=CRC[(c^u8[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
async function pipe(u8,stream){return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(stream)).arrayBuffer());}
async function unzip(buf){
  const u8=new Uint8Array(buf),dv=new DataView(buf);
  let e=u8.length-22; while(e>=0&&dv.getUint32(e,true)!==0x06054b50)e--;
  if(e<0)throw new Error("not a zip / 3MF");
  let n=dv.getUint16(e+10,true),off=dv.getUint32(e+16,true);
  const out=new Map();
  for(let i=0;i<n;i++){
    const m=dv.getUint16(off+10,true),csz=dv.getUint32(off+20,true),nl=dv.getUint16(off+28,true),
      xl=dv.getUint16(off+30,true),cl=dv.getUint16(off+32,true),lo=dv.getUint32(off+42,true);
    const name=new TextDecoder().decode(u8.subarray(off+46,off+46+nl));
    const lnl=dv.getUint16(lo+26,true),lxl=dv.getUint16(lo+28,true),ds=lo+30+lnl+lxl;
    const raw=u8.subarray(ds,ds+csz);
    out.set(name,m===0?raw.slice():await pipe(raw,new DecompressionStream("deflate-raw")));
    off+=46+nl+xl+cl;
  }
  return out;
}
async function zip(files){ /* files: Map name->Uint8Array|string */
  const enc=new TextEncoder(),parts=[],cen=[];let off=0;
  for(const [name,d0] of files){
    const data=typeof d0==="string"?enc.encode(d0):d0, nm=enc.encode(name), crc=crc32(data);
    const comp=data.length>256?await pipe(data,new CompressionStream("deflate-raw")):data, method=comp===data?0:8;
    const lh=new DataView(new ArrayBuffer(30));
    lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(8,method,true);
    lh.setUint32(14,crc,true);lh.setUint32(18,comp.length,true);lh.setUint32(22,data.length,true);lh.setUint16(26,nm.length,true);
    parts.push(lh.buffer,nm,comp);
    const ch=new DataView(new ArrayBuffer(46));
    ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(10,method,true);
    ch.setUint32(16,crc,true);ch.setUint32(20,comp.length,true);ch.setUint32(24,data.length,true);ch.setUint16(28,nm.length,true);
    ch.setUint32(42,off,true);
    cen.push(ch.buffer,nm); off+=30+nm.length+comp.length;
  }
  const csz=cen.reduce((s,b)=>s+(b.byteLength||b.length),0), end=new DataView(new ArrayBuffer(22));
  end.setUint32(0,0x06054b50,true);end.setUint16(8,files.size,true);end.setUint16(10,files.size,true);
  end.setUint32(12,csz,true);end.setUint32(16,off,true);
  return new Blob([...parts,...cen,end.buffer],{type:"application/vnd.ms-package.3dmanufacturing-3dmodel+xml"});
}

/* ---------- meshes ---------- */
/* mesh = {v:Float32Array xyz, f:Uint32Array abc} in its own frame; M = 4x4 column-major
   local->world (3MF transforms are row-vector; converted on read). */
const I4=()=>[1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
function mul4(a,b){const o=new Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s;}return o;}
function inv4(m){ /* affine */
  const [a,b,c,,d,e,f,,g,h,i]=m, det=a*(e*i-f*h)-d*(b*i-c*h)+g*(b*f-c*e);
  const r=[(e*i-f*h)/det,(c*h-b*i)/det,(b*f-c*e)/det,0,(f*g-d*i)/det,(a*i-c*g)/det,(c*d-a*f)/det,0,
    (d*h-e*g)/det,(b*g-a*h)/det,(a*e-b*d)/det,0,0,0,0,1];
  const t=[m[12],m[13],m[14]];
  for(let k=0;k<3;k++)r[12+k]=-(r[k]*t[0]+r[4+k]*t[1]+r[8+k]*t[2]);
  return r;
}
function xf(m,v){const o=new Float32Array(v.length);for(let i=0;i<v.length;i+=3){const x=v[i],y=v[i+1],z=v[i+2];
  o[i]=m[0]*x+m[4]*y+m[8]*z+m[12];o[i+1]=m[1]*x+m[5]*y+m[9]*z+m[13];o[i+2]=m[2]*x+m[6]*y+m[10]*z+m[14];}return o;}
const tf3mf=s=>{if(!s)return I4();const p=s.trim().split(/\s+/).map(Number);
  return [p[0],p[1],p[2],0, p[3],p[4],p[5],0, p[6],p[7],p[8],0, p[9],p[10],p[11],1];};

function weld(tri){ /* triangle soup -> indexed */
  const n=tri.length/9, map=new Map(), v=[], f=new Uint32Array(n*3);
  for(let i=0;i<n*3;i++){
    const x=tri[i*3],y=tri[i*3+1],z=tri[i*3+2], k=x.toFixed(5)+","+y.toFixed(5)+","+z.toFixed(5);
    let id=map.get(k); if(id===undefined){id=v.length/3;map.set(k,id);v.push(x,y,z);} f[i]=id;
  }
  return {v:new Float32Array(v),f};
}
function areas(m,M){
  const v=M?xf(M,m.v):m.v, f=m.f, n=f.length/3, a=new Float32Array(n);
  for(let t=0;t<n;t++){const i=f[t*3]*3,j=f[t*3+1]*3,k=f[t*3+2]*3;
    const ux=v[j]-v[i],uy=v[j+1]-v[i+1],uz=v[j+2]-v[i+2],wx=v[k]-v[i],wy=v[k+1]-v[i+1],wz=v[k+2]-v[i+2];
    a[t]=0.5*Math.hypot(uy*wz-uz*wy,uz*wx-ux*wz,ux*wy-uy*wx);}
  return a;
}
function adjacency(m){ /* per face: up to 3 neighbor faces (-1 if none) */
  const f=m.f,n=f.length/3,V=m.v.length/3, nb=new Int32Array(n*3).fill(-1), map=new Map();
  for(let t=0;t<n;t++)for(let e=0;e<3;e++){
    const a=f[t*3+e],b=f[t*3+(e+1)%3], key=a<b?a*V+b:b*V+a, o=map.get(key);
    if(o===undefined)map.set(key,t*3+e); else {nb[t*3+e]=o/3|0; nb[o]=t; map.delete(key);}
  }
  return nb;
}
function subdivide(m){ /* 1->4, crack free */
  const f=m.f,n=f.length/3,V=m.v.length/3,mid=new Map(),v=Array.from(m.v),nf=new Uint32Array(n*12);
  const md=(a,b)=>{const k=a<b?a*V+b:b*V+a;let id=mid.get(k);if(id===undefined){id=v.length/3;
    v.push((v[a*3]+v[b*3])/2,(v[a*3+1]+v[b*3+1])/2,(v[a*3+2]+v[b*3+2])/2);mid.set(k,id);}return id;};
  for(let t=0;t<n;t++){const a=f[t*3],b=f[t*3+1],c=f[t*3+2],ab=md(a,b),bc=md(b,c),ca=md(c,a);
    nf.set([a,ab,ca, ab,b,bc, ca,bc,c, ab,bc,ca],t*12);}
  return {v:new Float32Array(v),f:nf};
}
/* long thin triangles (a flat cut face, a plain dome) take one paint each, so a paint edge across them comes out
   as saw teeth. Split every edge longer than L at its midpoint (crack free: both triangles on the edge split
   the same way). Points land on the existing flat triangles, so the shape does not change */
function splitLong(m,M,L,maxF){let cur=m;
  for(let round=0;round<8;round++){const f=cur.f,n=f.length/3,V=cur.v.length/3,w=M?xf(M,cur.v):cur.v,L2=L*L,mid=new Map(),v=Array.from(cur.v);
    const len2=(a,b)=>{const dx=w[a*3]-w[b*3],dy=w[a*3+1]-w[b*3+1],dz=w[a*3+2]-w[b*3+2];return dx*dx+dy*dy+dz*dz;};
    const key=(a,b)=>a<b?a*V+b:b*V+a;
    for(let t=0;t<n;t++)for(let e=0;e<3;e++){const a=f[t*3+e],b=f[t*3+(e+1)%3];if(len2(a,b)>L2){const k=key(a,b);if(!mid.has(k)){mid.set(k,v.length/3);v.push((v[a*3]+v[b*3])/2,(v[a*3+1]+v[b*3+1])/2,(v[a*3+2]+v[b*3+2])/2);}}}
    if(!mid.size||n+mid.size*2>maxF)break;
    const nf=[];const M_=(a,b)=>mid.get(key(a,b));
    for(let t=0;t<n;t++){const a=f[t*3],b=f[t*3+1],c=f[t*3+2],ab=M_(a,b),bc=M_(b,c),ca=M_(c,a),k=(ab!==undefined)+(bc!==undefined)+(ca!==undefined);
      if(k===0){nf.push(a,b,c);continue;}
      if(k===3){nf.push(a,ab,ca, ab,b,bc, ca,bc,c, ab,bc,ca);continue;}
      /* rotate so the corners read x,y,z with the split edges first */
      let x=a,y=b,z=c,xy=ab,yz=bc,zx=ca;
      const rot=()=>{[x,y,z]=[y,z,x];[xy,yz,zx]=[yz,zx,xy];};
      if(k===1){while(xy===undefined)rot();nf.push(x,xy,z, xy,y,z);continue;}
      while(zx!==undefined)rot(); /* now xy and yz are split, zx is not */
      nf.push(xy,y,yz);
      if(len2(x,yz)<len2(z,xy))nf.push(x,xy,yz, x,yz,z);else nf.push(x,xy,z, xy,yz,z);}
    cur={v:new Float32Array(v),f:new Uint32Array(nf)};}
  return cur;
}
function meanEdge(m,M){let s=0;const v=M?xf(M,m.v):m.v,f=m.f,n=Math.min(f.length/3,20000);
  for(let t=0;t<n;t++){const i=f[t*3]*3,j=f[t*3+1]*3;s+=Math.hypot(v[j]-v[i],v[j+1]-v[i+1],v[j+2]-v[i+2]);}return s/n;}

/* ---------- STL ---------- */
function stlOf(buf){
  if(typeof parseSTL==="function"){const g=parseSTL(buf);if(g)return weld(g.tri);}
  return null;
}
function stlBytes(meshes){ /* [{m,M}] -> binary STL ArrayBuffer (world coords) */
  const n=meshes.reduce((s,x)=>s+x.m.f.length/3,0), out=new ArrayBuffer(84+50*n), dv=new DataView(out);
  dv.setUint32(80,n,true); let o=84;
  for(const {m,M} of meshes){const v=M?xf(M,m.v):m.v,f=m.f;
    for(let t=0;t<f.length;t+=3){for(let k=0;k<3;k++){const i=f[t+k]*3;
      dv.setFloat32(o+12+k*12,v[i],true);dv.setFloat32(o+16+k*12,v[i+1],true);dv.setFloat32(o+20+k*12,v[i+2],true);}o+=50;}}
  return out;
}

/* ---------- 3MF ---------- */
function attrs(s){const o={};s.replace(/([\w:]+)="([^"]*)"/g,(_,k,v)=>{o[k]=v;});return o;}
function parseMesh(xml,from,to){
  const seg=xml.slice(from,to), vs=[], fs=[], paint=[];
  const vre=/<vertex\s([^>]*)\/?>/g; let m;
  while((m=vre.exec(seg))){const a=m[1];
    vs.push(+/\bx="([^"]+)"/.exec(a)[1],+/\by="([^"]+)"/.exec(a)[1],+/\bz="([^"]+)"/.exec(a)[1]);}
  const tre=/<triangle\s([^>]*)\/?>/g; let hasPaint=false;
  while((m=tre.exec(seg))){const a=m[1];
    fs.push(+/\bv1="(\d+)"/.exec(a)[1],+/\bv2="(\d+)"/.exec(a)[1],+/\bv3="(\d+)"/.exec(a)[1]);
    const p=/\bpaint_color="([0-9A-Fa-f]+)"/.exec(a)||/mmu_segmentation="([0-9A-Fa-f]+)"/.exec(a);
    paint.push(p?p[1].toUpperCase():""); if(p)hasPaint=true;}
  return {v:new Float32Array(vs),f:new Uint32Array(fs),paint:hasPaint?paint:null};
}
function meshSpans(xml){ /* object id -> {from,to} of the inside of <mesh> */
  const out=new Map(), ore=/<object\s([^>]*)>/g; let m;
  while((m=ore.exec(xml))){const id=attrs(m[1]).id, ms=xml.indexOf("<mesh",m.index), oe=xml.indexOf("</object>",m.index);
    if(ms<0||(oe>=0&&ms>oe))continue; const me=xml.indexOf("</mesh>",ms);
    out.set(id,{from:xml.indexOf(">",ms)+1,to:me,objAt:m.index});}
  return out;
}
async function read3MF(buf,name){
  const files=await unzip(buf), dec=new TextDecoder();
  const mainName=[...files.keys()].find(k=>/^3D\/[^/]+\.model$/i.test(k))||"3D/3dmodel.model";
  const main=dec.decode(files.get(mainName)), texts=new Map([[mainName,main]]);
  const getText=p=>{p=p.replace(/^\//,"");if(!texts.has(p)){const b=files.get(p);if(!b)return null;texts.set(p,dec.decode(b));}return texts.get(p);};
  const objs=new Map(), ore=/<object\s([^>]*)>([\s\S]*?)<\/object>/g; let m;
  while((m=ore.exec(main))){const a=attrs(m[1]); const comps=[];
    const cre=/<component\s([^>]*)\/?>/g; let c; while((c=cre.exec(m[2])))comps.push(attrs(c[1]));
    objs.set(a.id,{a,comps,hasMesh:/<mesh/.test(m[2])});}
  const items=[], ire=/<item\s([^>]*)\/?>/g; while((m=ire.exec(main)))items.push(attrs(m[1]));
  const parts=[];
  for(const it of items){
    const o=objs.get(it.objectid); if(!o)continue; const Mi=tf3mf(it.transform);
    const nm=(o.a.name||"")||`${name} ${it.objectid}`;
    const add=(path,id,Mc,label)=>{const xml=getText(path); if(!xml)return; const sp=meshSpans(xml).get(id); if(!sp)return;
      const mesh=parseMesh(xml,sp.from,sp.to);
      parts.push({name:label,m:{v:mesh.v,f:mesh.f},paint:mesh.paint,M:mul4(Mi,Mc),src:{path:path.replace(/^\//,""),id},objectid:it.objectid});};
    if(o.hasMesh) add(mainName,it.objectid,I4(),nm);
    o.comps.forEach((c,ci)=>add(c["p:path"]||mainName,c.objectid,tf3mf(c.transform),o.comps.length>1?`${nm} ${ci+1}`:nm));
  }
  /* names from Bambu's model_settings */
  const ms=files.get("Metadata/model_settings.config");
  if(ms){const t=dec.decode(ms); const re=/<object id="(\d+)">\s*<metadata key="name" value="([^"]*)"/g; let k;
    const names=new Map(); while((k=re.exec(t)))names.set(k[1],k[2].replace(/\.(stl|obj|3mf)$/i,""));
    const per=new Map(); parts.forEach(p=>per.set(p.objectid,(per.get(p.objectid)||0)+1));
    const seen=new Map();
    parts.forEach(p=>{if(!names.has(p.objectid))return; const n=per.get(p.objectid), i=(seen.get(p.objectid)||0)+1; seen.set(p.objectid,i);
      p.name=n>1?`${names.get(p.objectid)} ${i}`:names.get(p.objectid);});}
  /* which plate each object is on (Bambu lists them per plate) */
  const plates=new Map();
  if(ms){const t=dec.decode(ms),pre=/<plate>([\s\S]*?)<\/plate>/g;let pm;
    while((pm=pre.exec(t))){const id=(/plater_id" value="(\d+)"/.exec(pm[1])||[])[1],nm=(/plater_name" value="([^"]*)"/.exec(pm[1])||[])[1]||"";
      const ore2=/<model_instance>\s*<metadata key="object_id" value="(\d+)"/g;let om;
      while((om=ore2.exec(pm[1])))plates.set(om[1],{id:+id,name:nm});}}
  /* Bambu lays plates out in a grid, one bed plus a 20% gap apart; a piece's plate is where it sits */
  let bed=256; try{const pa=JSON.parse(dec.decode(files.get("Metadata/project_settings.config"))).printable_area;
    if(pa)bed=Math.max(...pa.map(s=>+s.split("x")[0]))||256;}catch(e){}
  const nPlates=Math.max(1,(ms?(dec.decode(ms).match(/<plate>/g)||[]).length:1)),cols=Math.ceil(Math.sqrt(nPlates)),stride=bed*1.2;
  parts.forEach(p=>{const v=xf(p.M,p.m.v),b=bboxOf(v),x=(b.lo[0]+b.hi[0])/2,y=(b.lo[1]+b.hi[1])/2;
    const col=Math.floor(x/stride),row=Math.floor((bed-y)/stride),inBed=x-col*stride<=bed+1&&x-col*stride>=-1;
    const id=col>=0&&col<cols&&row>=0&&inBed?row*cols+col+1:0;
    p.plate=id>=1&&id<=nPlates?id:0;});
  let ps=null; const psb=files.get("Metadata/project_settings.config");
  if(psb){try{ps=JSON.parse(dec.decode(psb));}catch(e){}}
  return {files,texts,parts,ps,bambu:/BambuStudio/.test(main)};
}

/* paint codes: Bambu/Prusa TriangleSelector, unsplit triangle */
const PAINT=s=>s<=0?"":s===1?"4":s===2?"8":(s-3).toString(16).toUpperCase()+"C";
function unpaint(code){
  if(!code)return 0; if(code==="4")return 1; if(code==="8")return 2;
  if(/^[0-9A-F]C$/.test(code))return parseInt(code[0],16)+3;
  /* split triangle: take the state of the last leaf written */
  const c=code[code.length-1]; const n=parseInt(c,16);
  if((n&3)===3&&code.length>=2)return parseInt(code[code.length-2],16)+3; return (n>>2)&3;
}

/* ---------- GLB ---------- */
async function readGLB(buf){
  const dv=new DataView(buf); if(dv.getUint32(0,true)!==0x46546C67)throw new Error("not a GLB");
  let off=12, json=null, bin=null;
  while(off<buf.byteLength){const len=dv.getUint32(off,true),type=dv.getUint32(off+4,true);
    if(type===0x4E4F534A)json=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,off+8,len)));
    else if(type===0x004E4942)bin=new Uint8Array(buf,off+8,len); off+=8+len;}
  const view=i=>{const bv=json.bufferViews[i];return new Uint8Array(bin.buffer,bin.byteOffset+(bv.byteOffset||0),bv.byteLength);};
  const acc=i=>{const a=json.accessors[i],bv=json.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
    const base=bin.byteOffset+(bv.byteOffset||0)+(a.byteOffset||0), CT={5126:[Float32Array,4],5125:[Uint32Array,4],5123:[Uint16Array,2],5121:[Uint8Array,1]}[a.componentType];
    const stride=bv.byteStride||n*CT[1], out=new Float32Array(a.count*n), d=new DataView(bin.buffer);
    for(let i=0;i<a.count;i++)for(let k=0;k<n;k++){const p=base+i*stride+k*CT[1];
      let v=a.componentType===5126?d.getFloat32(p,true):a.componentType===5125?d.getUint32(p,true):a.componentType===5123?d.getUint16(p,true):d.getUint8(p);
      if(a.normalized)v/=a.componentType===5123?65535:255; out[i*n+k]=v;}
    return out;};
  const images=[];
  const imgData=async ti=>{if(ti==null)return null; if(images[ti])return images[ti];
    const tex=json.textures[ti], im=json.images[tex.source], blob=new Blob([view(im.bufferView)],{type:im.mimeType||"image/png"});
    const bmp=await createImageBitmap(blob), cv=new OffscreenCanvas(bmp.width,bmp.height), cx=cv.getContext("2d");
    cx.drawImage(bmp,0,0); images[ti]=cx.getImageData(0,0,bmp.width,bmp.height); return images[ti];};
  const out=[];
  const node=async(ni,P)=>{const nd=json.nodes[ni]; let M=I4();
    if(nd.matrix)M=nd.matrix.slice();
    else{const t=nd.translation||[0,0,0],r=nd.rotation||[0,0,0,1],s=nd.scale||[1,1,1],[x,y,z,w]=r;
      M=[(1-2*(y*y+z*z))*s[0],2*(x*y+z*w)*s[0],2*(x*z-y*w)*s[0],0, 2*(x*y-z*w)*s[1],(1-2*(x*x+z*z))*s[1],2*(y*z+x*w)*s[1],0,
         2*(x*z+y*w)*s[2],2*(y*z-x*w)*s[2],(1-2*(x*x+y*y))*s[2],0, t[0],t[1],t[2],1];}
    M=mul4(P,M);
    if(nd.mesh!=null)for(const pr of json.meshes[nd.mesh].primitives){
      if(pr.extensions&&pr.extensions.KHR_draco_mesh_compression)throw new Error("Draco-compressed GLB - export from Meshy without compression");
      const v=xf(M,acc(pr.attributes.POSITION)), f=pr.indices!=null?Uint32Array.from(acc(pr.indices)):Uint32Array.from({length:v.length/3},(_,i)=>i);
      const mat=pr.material!=null?json.materials[pr.material]:{}, pbr=mat.pbrMetallicRoughness||{};
      const uv=pr.attributes.TEXCOORD_0!=null?acc(pr.attributes.TEXCOORD_0):null;
      const col=pr.attributes.COLOR_0!=null?acc(pr.attributes.COLOR_0):null, cn=col?json.accessors[pr.attributes.COLOR_0].type==="VEC4"?4:3:0;
      out.push({m:{v,f},uv,img:uv&&pbr.baseColorTexture?await imgData(pbr.baseColorTexture.index):null,
        factor:pbr.baseColorFactor||[1,1,1,1],col,cn});}
    for(const c of nd.children||[])await node(c,M);};
  for(const r of json.scenes[json.scene||0].nodes)await node(r,I4());
  return out;
}

/* ---------- spatial grid (nearest point) ---------- */
function grid(pts,cell){ /* dense CSR grid: cell lookups are array reads */
  const n=pts.length/3, lo=[Infinity,Infinity,Infinity], hi=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<pts.length;i+=3)for(let k=0;k<3;k++){const v=pts[i+k];if(v<lo[k])lo[k]=v;if(v>hi[k])hi[k]=v;}
  let dim=[0,1,2].map(k=>Math.max(1,Math.ceil((hi[k]-lo[k])/cell)+1));
  while(dim[0]*dim[1]*dim[2]>6e6){cell*=1.25;dim=[0,1,2].map(k=>Math.max(1,Math.ceil((hi[k]-lo[k])/cell)+1));}
  const [nx,ny,nz]=dim, nc=nx*ny*nz, cnt=new Int32Array(nc+1), cid=new Int32Array(n);
  for(let i=0;i<n;i++){const x=Math.floor((pts[i*3]-lo[0])/cell),y=Math.floor((pts[i*3+1]-lo[1])/cell),z=Math.floor((pts[i*3+2]-lo[2])/cell);
    const c=(z*ny+y)*nx+x;cid[i]=c;cnt[c+1]++;}
  for(let c=0;c<nc;c++)cnt[c+1]+=cnt[c];
  const fill=cnt.slice(0,nc), idx=new Int32Array(n);for(let i=0;i<n;i++)idx[fill[cid[i]]++]=i;
  function near(x,y,z,maxR=6){
    const cx=Math.floor((x-lo[0])/cell),cy=Math.floor((y-lo[1])/cell),cz=Math.floor((z-lo[2])/cell);
    let best=-1,bd=Infinity;
    for(let r=0;r<=maxR;r++){
      const x0=cx-r,x1=cx+r,y0=cy-r,y1=cy+r,z0=cz-r,z1=cz+r;
      for(let k=Math.max(0,z0);k<=Math.min(nz-1,z1);k++)for(let j=Math.max(0,y0);j<=Math.min(ny-1,y1);j++){
        const edge=(k===z0||k===z1||j===y0||j===y1), step=edge?1:(x1-x0);
        for(let i=x0;i<=x1;i+=step||1){if(i<0||i>=nx)continue;const c=(k*ny+j)*nx+i;
          for(let q=cnt[c];q<cnt[c+1];q++){const p=idx[q],dx=pts[p*3]-x,dy=pts[p*3+1]-y,dz=pts[p*3+2]-z,d=dx*dx+dy*dy+dz*dz;if(d<bd){bd=d;best=p;}}}}
      if(best>=0&&Math.sqrt(bd)<=r*cell)break;}
    return [best,Math.sqrt(bd)];}
  return {near};
}
function samplePts(m,M,n,rng){ /* area-weighted surface samples (world) -> {p, fid, b} */
  const v=M?xf(M,m.v):m.v,f=m.f,a=areas({v,f}),cum=new Float64Array(a.length);let s=0;
  for(let i=0;i<a.length;i++){s+=a[i];cum[i]=s;}
  const p=new Float32Array(n*3),fid=new Uint32Array(n),b=new Float32Array(n*2);
  for(let i=0;i<n;i++){let r=rng()*s,lo=0,hi=a.length-1;while(lo<hi){const md=(lo+hi)>>1;if(cum[md]<r)lo=md+1;else hi=md;}
    let u=rng(),w=rng();if(u+w>1){u=1-u;w=1-w;}const t=lo,ia=f[t*3]*3,ib=f[t*3+1]*3,ic=f[t*3+2]*3;
    for(let k=0;k<3;k++)p[i*3+k]=v[ia+k]+u*(v[ib+k]-v[ia+k])+w*(v[ic+k]-v[ia+k]);
    fid[i]=t;b[i*2]=u;b[i*2+1]=w;}
  return {p,fid,b,area:s};
}
const RNG=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};

/* ---------- registration ---------- */
function jacobi4(A){ /* symmetric 4x4 -> eigenvector of largest eigenvalue */
  const a=A.map(r=>r.slice()),V=[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]];
  for(let sw=0;sw<50;sw++){let off=0;for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)off+=a[i][j]*a[i][j];if(off<1e-18)break;
    for(let p=0;p<4;p++)for(let q=p+1;q<4;q++){if(Math.abs(a[p][q])<1e-20)continue;
      const th=(a[q][q]-a[p][p])/(2*a[p][q]),t=Math.sign(th||1)/(Math.abs(th)+Math.sqrt(th*th+1)),c=1/Math.sqrt(t*t+1),s=t*c;
      for(let k=0;k<4;k++){const akp=a[k][p],akq=a[k][q];a[k][p]=c*akp-s*akq;a[k][q]=s*akp+c*akq;}
      for(let k=0;k<4;k++){const apk=a[p][k],aqk=a[q][k];a[p][k]=c*apk-s*aqk;a[q][k]=s*apk+c*aqk;}
      for(let k=0;k<4;k++){const vkp=V[k][p],vkq=V[k][q];V[k][p]=c*vkp-s*vkq;V[k][q]=s*vkp+c*vkq;}}}
  let bi=0;for(let i=1;i<4;i++)if(a[i][i]>a[bi][bi])bi=i; return [V[0][bi],V[1][bi],V[2][bi],V[3][bi]];
}
function horn(P,Q,scale){ /* best R,s,t with Q ~ s R P + t; P,Q arrays of [x,y,z] */
  const n=P.length,cp=[0,0,0],cq=[0,0,0];
  for(let i=0;i<n;i++)for(let k=0;k<3;k++){cp[k]+=P[i][k]/n;cq[k]+=Q[i][k]/n;}
  const S=[[0,0,0],[0,0,0],[0,0,0]];let sp=0,sq=0;
  for(let i=0;i<n;i++){const a=[P[i][0]-cp[0],P[i][1]-cp[1],P[i][2]-cp[2]],b=[Q[i][0]-cq[0],Q[i][1]-cq[1],Q[i][2]-cq[2]];
    for(let r=0;r<3;r++)for(let c=0;c<3;c++)S[r][c]+=a[r]*b[c]; sp+=a[0]*a[0]+a[1]*a[1]+a[2]*a[2]; sq+=b[0]*b[0]+b[1]*b[1]+b[2]*b[2];}
  const [[xx,xy,xz],[yx,yy,yz],[zx,zy,zz]]=S;
  const N=[[xx+yy+zz,yz-zy,zx-xz,xy-yx],[yz-zy,xx-yy-zz,xy+yx,zx+xz],[zx-xz,xy+yx,-xx+yy-zz,yz+zy],[xy-yx,zx+xz,yz+zy,-xx-yy+zz]];
  const [w,x,y,z]=jacobi4(N);
  const R=[[1-2*(y*y+z*z),2*(x*y-w*z),2*(x*z+w*y)],[2*(x*y+w*z),1-2*(x*x+z*z),2*(y*z-w*x)],[2*(x*z-w*y),2*(y*z+w*x),1-2*(x*x+y*y)]];
  const s=scale?Math.sqrt(sq/Math.max(sp,1e-12)):1;
  const t=[0,1,2].map(r=>cq[r]-s*(R[r][0]*cp[0]+R[r][1]*cp[1]+R[r][2]*cp[2]));
  return [s*R[0][0],s*R[1][0],s*R[2][0],0, s*R[0][1],s*R[1][1],s*R[2][1],0, s*R[0][2],s*R[1][2],s*R[2][2],0, t[0],t[1],t[2],1];
}
const ap=(M,x,y,z)=>[M[0]*x+M[4]*y+M[8]*z+M[12],M[1]*x+M[5]*y+M[9]*z+M[13],M[2]*x+M[6]*y+M[10]*z+M[14]];
function rot24(){const out=[],perms=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
  for(const p of perms)for(let s=0;s<8;s++){const R=[[0,0,0],[0,0,0],[0,0,0]];
    for(let i=0;i<3;i++)R[i][p[i]]=(s>>i)&1?-1:1;
    const det=R[0][0]*(R[1][1]*R[2][2]-R[1][2]*R[2][1])-R[0][1]*(R[1][0]*R[2][2]-R[1][2]*R[2][0])+R[0][2]*(R[1][0]*R[2][1]-R[1][1]*R[2][0]);
    if(det>0)out.push([R[0][0],R[1][0],R[2][0],0,R[0][1],R[1][1],R[2][1],0,R[0][2],R[1][2],R[2][2],0,0,0,0,1]);}
  return out;}
function icp(P,G,Q,M,iters,scale,maxR=6,cap=Infinity){ /* P: points to move ([x,y,z]); G grid on Q */
  let err=Infinity;
  for(let it=0;it<=iters;it++){
    const A=[],B=[],D=[];let miss=0;
    for(const p of P){const q=ap(M,...p),[j,d]=G.near(q[0],q[1],q[2],maxR);if(j<0||d>cap){miss++;continue;}A.push(q);B.push([Q[j*3],Q[j*3+1],Q[j*3+2]]);D.push(d);}
    if(A.length<Math.max(8,P.length*0.3))return {M,err:Infinity};
    const srt=D.slice().sort((a,b)=>a-b), cut=srt[Math.floor(srt.length*0.9)];
    err=(D.reduce((s,d)=>s+d,0)+miss*(isFinite(cap)?cap:srt[srt.length-1]))/(D.length+miss);
    if(it===iters)break;
    const A2=[],B2=[];for(let i=0;i<A.length;i++)if(D[i]<=cut){A2.push(A[i]);B2.push(B[i]);}
    M=mul4(horn(A2,B2,scale),M);
  }
  return {M,err};
}
const bboxOf=v=>{const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<v.length;i+=3)for(let k=0;k<3;k++){if(v[i+k]<lo[k])lo[k]=v[i+k];if(v[i+k]>hi[k])hi[k]=v[i+k];}return {lo,hi};};
async function alignSource(srcV,tgt,tick){ /* Meshy may rescale and re-axis. returns M src->target */
  const tb=bboxOf(tgt.p),diag=Math.hypot(tb.hi[0]-tb.lo[0],tb.hi[1]-tb.lo[1],tb.hi[2]-tb.lo[2]);
  const G=grid(tgt.p,diag/60);
  const P=[];const step=Math.max(1,Math.floor(srcV.length/3/600));for(let i=0;i<srcV.length/3;i+=step)P.push([srcV[i*3],srcV[i*3+1],srcV[i*3+2]]);
  let best={err:Infinity};
  for(const R of rot24()){
    const rv=P.map(p=>ap(R,...p)), b={lo:[Infinity,Infinity,Infinity],hi:[-Infinity,-Infinity,-Infinity]};
    rv.forEach(p=>{for(let k=0;k<3;k++){if(p[k]<b.lo[k])b.lo[k]=p[k];if(p[k]>b.hi[k])b.hi[k]=p[k];}});
    const s=diag/Math.hypot(b.hi[0]-b.lo[0],b.hi[1]-b.lo[1],b.hi[2]-b.lo[2]);
    const t=[0,1,2].map(k=>(tb.lo[k]+tb.hi[k])/2-s*(b.lo[k]+b.hi[k])/2);
    let M=R.map((x,i)=>i<12?x*s:x);M[12]=t[0];M[13]=t[1];M[14]=t[2];
    const r=icp(P,G,tgt.p,M,0,false); if(r.err<best.err)best={err:r.err,M};
    await tick();
  }
  const r=icp(P,G,tgt.p,best.M,30,true);
  return {M:r.err<best.err?r.M:best.M,err:Math.min(r.err,best.err),diag};
}
async function registerPart(part,fig,G,tick0,cell,accept,fine){ /* find where a cut piece sits on the figure; fine: a denser cloud {p,G} for the last pass */
  let last=Date.now(); const tick=async()=>{if(Date.now()-last>40){await tick0();last=Date.now();}};
  const rng=RNG(7), smp=samplePts(part.m,part.M,400,rng), P=[];
  for(let i=0;i<400;i++)P.push([smp.p[i*3],smp.p[i*3+1],smp.p[i*3+2]]);
  const pc=[0,1,2].map(k=>P.reduce((s,p)=>s+p[k],0)/P.length), P60=P.filter((_,i)=>i%5===0);
  const starts=[];for(let i=0;i<64;i++){const j=Math.floor(rng()*fig.p.length/3);starts.push([fig.p[j*3],fig.p[j*3+1],fig.p[j*3+2]]);}
  const cap=cell*8, cand=[];
  for(const R of rot24()){
    for(const st of starts){const c=ap(R,...pc),M=R.slice();M[12]=st[0]-c[0];M[13]=st[1]-c[1];M[14]=st[2]-c[2];
      const r=icp(P60,G,fig.p,M,8,false,4,cap); if(isFinite(r.err))cand.push(r);
      await tick();}
  }
  cand.sort((a,b)=>a.err-b.err);
  if(accept){const ok=cand.filter(r=>accept(r.M));if(ok.length)cand.splice(0,cand.length,...ok);}
  let best={err:Infinity};
  for(const c of cand.slice(0,24)){const r=icp(P.filter((_,i)=>i%2===0),G,fig.p,c.M,25,false,3,cap*2);if(r.err<best.err&&(!accept||accept(r.M)))best=r;await tick();}
  if(!isFinite(best.err))return {M:I4(),err:Infinity};
  const r=icp(P,G,fig.p,best.M,30,false,4);
  const out=r.err<=best.err&&(!accept||accept(r.M))?r:best;
  /* the last word: 2000 points of the piece settled on a cloud ten times denser, so the fit is not limited by the coarse cloud's spacing */
  if(fine&&isFinite(out.err)){const s2=samplePts(part.m,part.M,2000,RNG(11)),P2=[];for(let i=0;i<2000;i++)P2.push([s2.p[i*3],s2.p[i*3+1],s2.p[i*3+2]]);
    const r2=icp(P2,fine.G,fine.p,out.M,40,false,3);if(isFinite(r2.err)&&(!accept||accept(r2.M)))return r2;}
  return out;
}

function faceNormals(m,M){const v=M?xf(M,m.v):m.v,f=m.f,n=f.length/3,o=new Float32Array(n*3);
  for(let t=0;t<n;t++){const i=f[t*3]*3,j=f[t*3+1]*3,k=f[t*3+2]*3;
    const ux=v[j]-v[i],uy=v[j+1]-v[i+1],uz=v[j+2]-v[i+2],wx=v[k]-v[i],wy=v[k+1]-v[i+1],wz=v[k+2]-v[i+2];
    let x=uy*wz-uz*wy,y=uz*wx-ux*wz,z=ux*wy-uy*wx;const l=Math.hypot(x,y,z)||1;o[t*3]=x/l;o[t*3+1]=y/l;o[t*3+2]=z/l;}
  return o;}

/* ---------- colored source -> point cloud ---------- */
function sampleColor(src,fid,u,w){
  const f=src.m.f,a=f[fid*3],b=f[fid*3+1],c=f[fid*3+2],z=1-u-w;
  if(src.img&&src.uv){const uv=src.uv, U=z*uv[a*2]+u*uv[b*2]+w*uv[c*2], V=z*uv[a*2+1]+u*uv[b*2+1]+w*uv[c*2+1];
    const im=src.img, x=Math.min(im.width-1,Math.max(0,Math.floor((U-Math.floor(U))*im.width))),
      y=Math.min(im.height-1,Math.max(0,Math.floor((V-Math.floor(V))*im.height))), o=(y*im.width+x)*4;
    return [im.data[o]/255*src.factor[0],im.data[o+1]/255*src.factor[1],im.data[o+2]/255*src.factor[2]];}
  if(src.col){const n=src.cn,C=src.col;return [0,1,2].map(k=>z*C[a*n+k]+u*C[b*n+k]+w*C[c*n+k]);}
  if(src.faceRGB)return [src.faceRGB[fid*3],src.faceRGB[fid*3+1],src.faceRGB[fid*3+2]];
  return [src.factor[0],src.factor[1],src.factor[2]];
}
function colorCloud(sources,M,spacing){
  const tot=sources.reduce((s,x)=>s+areas(x.m,M).reduce((a,b)=>a+b,0),0);
  const N=Math.min(3000000,Math.max(200000,Math.round(tot/(spacing*spacing))));
  const pts=[],cols=[],nrms=[];const rng=RNG(3);
  for(const src of sources){const a=areas(src.m,M).reduce((x,y)=>x+y,0),n=Math.round(N*a/tot);
    const s=samplePts(src.m,M,n,rng);pts.push(s.p);const c=new Float32Array(n*3),nn=new Float32Array(n*3),fn=faceNormals(src.m,M);
    for(let i=0;i<n;i++){const r=sampleColor(src,s.fid[i],s.b[i*2],s.b[i*2+1]);c[i*3]=r[0];c[i*3+1]=r[1];c[i*3+2]=r[2];
      const f=s.fid[i];nn[i*3]=fn[f*3];nn[i*3+1]=fn[f*3+1];nn[i*3+2]=fn[f*3+2];}cols.push(c);nrms.push(nn);}
  const P=new Float32Array(pts.reduce((s,x)=>s+x.length,0)),C=new Float32Array(P.length),NN=new Float32Array(P.length);let o=0;
  pts.forEach((p,i)=>{P.set(p,o);C.set(cols[i],o);NN.set(nrms[i],o);o+=p.length;});
  return {P,C,N:NN,G:grid(P,spacing*2)};
}
async function transferColors(part,cloud,Mextra,tick0){
  let last=Date.now(); /* -> Float32Array rgb per face */
  const M=Mextra?mul4(Mextra,part.M):part.M, v=xf(M,part.m.v),f=part.m.f,n=f.length/3,out=new Float32Array(n*3),dist=new Float32Array(n),
    dot=new Float32Array(n),fn=faceNormals(part.m,M);
  const B=[[1/3,1/3]]; /* one sample: averaging across a boundary invents blend colors */
  for(let t=0;t<n;t++){if(tick0&&(t&4095)===0&&Date.now()-last>40){await tick0();last=Date.now();}
    const a=f[t*3]*3,b=f[t*3+1]*3,c=f[t*3+2]*3;let r=0,g=0,bl=0,k=0;
    for(const [u,w] of B){const z=1-u-w,x=z*v[a]+u*v[b]+w*v[c],y=z*v[a+1]+u*v[b+1]+w*v[c+1],zz=z*v[a+2]+u*v[b+2]+w*v[c+2];
      let [j,d]=cloud.G.near(x,y,zz,4); if(j<0)[j,d]=cloud.G.near(x,y,zz,40); if(j<0){d=1e9;continue;}
      r+=cloud.C[j*3];g+=cloud.C[j*3+1];bl+=cloud.C[j*3+2];k++;dist[t]=d;
      dot[t]=fn[t*3]*cloud.N[j*3]+fn[t*3+1]*cloud.N[j*3+1]+fn[t*3+2]*cloud.N[j*3+2];}
    if(k){out[t*3]=r/k;out[t*3+1]=g/k;out[t*3+2]=bl/k;}else{dist[t]=1e9;}}
  /* a face that points a different way from the surface it's nearest to (a cut face beside the
     neck, a socket wall) is not that surface: mark it hidden. Meshy's winding may be reversed. */
  let pos=0;for(let t=0;t<n;t+=7)if(dot[t]>0)pos++;const flip=pos<Math.ceil(n/7)/2?-1:1;
  /* hidden = points a different way from the nearest figure surface (cut faces, socket walls), or is
     far from it. A piece reshaped in part-out (extended limb, rounded hip) still faces the same way as
     the figure, so it stays visible up to 3 mm off the figure. */
  for(let t=0;t<n;t++){if(dot[t]*flip<0.35)dist[t]=Math.max(dist[t],1e6);else if(dist[t]<3)dist[t]=0;}
  return {rgb:out,dist};
}

/* ---------- regions ---------- */
function kmeans(L,W,k,rng){ /* L: Float32 lab*3, W weights; on a subsample */
  const n=L.length/3, idx=[];const take=Math.min(n,40000);for(let i=0;i<take;i++)idx.push(Math.floor(rng()*n));
  const C=[];const d2=(i,c)=>{const dx=L[i*3]-c[0],dy=L[i*3+1]-c[1],dz=L[i*3+2]-c[2];return dx*dx+dy*dy+dz*dz;};
  C.push([L[idx[0]*3],L[idx[0]*3+1],L[idx[0]*3+2]]);
  const D=new Float64Array(take).fill(Infinity);
  while(C.length<k){let s=0;idx.forEach((i,j)=>{D[j]=Math.min(D[j],d2(i,C[C.length-1]))*1;s+=D[j]*W[i];});
    if(s<=0)break; let r=rng()*s,j=0;for(;j<take;j++){r-=D[j]*W[idx[j]];if(r<=0)break;}
    const i=idx[Math.min(j,take-1)];C.push([L[i*3],L[i*3+1],L[i*3+2]]);}
  for(let it=0;it<15;it++){const S=C.map(()=>[0,0,0,0]);
    for(const i of idx){let b=0,bd=Infinity;C.forEach((c,ci)=>{const d=d2(i,c);if(d<bd){bd=d;b=ci;}});
      const w=W[i];S[b][0]+=L[i*3]*w;S[b][1]+=L[i*3+1]*w;S[b][2]+=L[i*3+2]*w;S[b][3]+=w;}
    C.forEach((c,ci)=>{if(S[ci][3]>0){c[0]=S[ci][0]/S[ci][3];c[1]=S[ci][1]/S[ci][3];c[2]=S[ci][2]/S[ci][3];}});}
  return C;
}
function cleanIslands(nb,area,lab,minA){ /* merge same-label patches under minA into neighbor */
  const n=lab.length;
  for(let round=0;round<3;round++){
    const comp=new Int32Array(n).fill(-1),stack=[];let nc=0;const cA=[],cL=[];
    for(let s=0;s<n;s++){if(comp[s]>=0)continue;let a=0;comp[s]=nc;stack.push(s);
      while(stack.length){const t=stack.pop();a+=area[t];for(let e=0;e<3;e++){const o=nb[t*3+e];if(o>=0&&comp[o]<0&&lab[o]===lab[t]){comp[o]=nc;stack.push(o);}}}
      cA.push(a);cL.push(lab[s]);nc++;}
    const votes=new Map();let any=false;
    for(let t=0;t<n;t++){const c=comp[t];if(cA[c]>=minA)continue;any=true;
      for(let e=0;e<3;e++){const o=nb[t*3+e];if(o<0||comp[o]===c)continue;const k=c+":"+lab[o];votes.set(k,(votes.get(k)||0)+1);}}
    if(!any)break;
    const best=new Map();for(const [k,v] of votes){const [c,l]=k.split(":").map(Number);const b=best.get(c);if(!b||v>b[1])best.set(c,[l,v]);}
    for(let t=0;t<n;t++){const b=best.get(comp[t]);if(b)lab[t]=b[0];}
  }
  return lab;
}

/* ---------- viewer (WebGL2) ---------- */
function Viewer(canvas,onPick){
  const gl=canvas.getContext("webgl2",{antialias:true,preserveDrawingBuffer:false});
  if(!gl)return null;
  const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw gl.getShaderInfoLog(o);return o;};
  const prog=(vs,fs)=>{const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,vs));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);return p;};
  const VS=`#version 300 es
in vec3 p;in vec3 c;uniform mat4 mvp;uniform mat4 mv;out vec3 vp;out vec3 vc;flat out int id;
void main(){gl_Position=mvp*vec4(p,1.);vp=(mv*vec4(p,1.)).xyz;vc=c;id=gl_VertexID/3;}`;
  const FS=`#version 300 es
precision highp float;in vec3 vp;in vec3 vc;flat in int id;uniform int pick;uniform int hi;out vec4 o;
void main(){if(pick==1){int i=id+1;o=vec4(float(i&255)/255.,float((i>>8)&255)/255.,float((i>>16)&255)/255.,1.);return;}
vec3 n=normalize(cross(dFdx(vp),dFdy(vp)));float l=.35+.65*abs(dot(n,normalize(vec3(.3,.5,1.))));
vec3 col=vc*l;o=vec4(col,1.);}`;
  const P=prog(VS,FS),aP=gl.getAttribLocation(P,"p"),aC=gl.getAttribLocation(P,"c");
  const bP=gl.createBuffer(),bC=gl.createBuffer();let count=0,center=[0,0,0],radius=1;
  let yaw=-Math.PI/2,pitch=0.15,dist=3,panX=0,panY=0;
  const fbo=gl.createFramebuffer(),rb=gl.createRenderbuffer(),db=gl.createRenderbuffer();
  let P0=new Float32Array(0);
  function fitBox(b){center=[0,1,2].map(k=>(b.lo[k]+b.hi[k])/2);radius=Math.hypot(b.hi[0]-b.lo[0],b.hi[1]-b.lo[1],b.hi[2]-b.lo[2])/2||1;dist=radius*2.6;panX=panY=0;draw();}
  function setGeometry(pos,keepView){gl.bindBuffer(gl.ARRAY_BUFFER,bP);gl.bufferData(gl.ARRAY_BUFFER,pos,gl.STATIC_DRAW);count=pos.length/3;P0=pos;
    if(!keepView&&count)fitBox(bboxOf(pos));else draw();}
  function faceCenter(id){const o=id*9;return [(P0[o]+P0[o+3]+P0[o+6])/3,(P0[o+1]+P0[o+4]+P0[o+7])/3,(P0[o+2]+P0[o+5]+P0[o+8])/3];}
  function lookAt(p,shrink){center=p;panX=panY=0;if(shrink)dist=Math.max(radius*0.02,dist*shrink);draw();}
  function setColors(col){gl.bindBuffer(gl.ARRAY_BUFFER,bC);gl.bufferData(gl.ARRAY_BUFFER,col,gl.DYNAMIC_DRAW);draw();}
  function mats(){const w=canvas.clientWidth,h=canvas.clientHeight,asp=w/Math.max(h,1),f=1/Math.tan(0.35),nr=dist/50,fr=dist*10;
    const Pm=[f/asp,0,0,0,0,f,0,0,0,0,(fr+nr)/(nr-fr),-1,0,0,2*fr*nr/(nr-fr),0];
    const eye=[center[0]+dist*Math.cos(pitch)*Math.cos(yaw),center[1]+dist*Math.cos(pitch)*Math.sin(yaw),center[2]+dist*Math.sin(pitch)];
    const zf=[eye[0]-center[0],eye[1]-center[1],eye[2]-center[2]],zl=Math.hypot(...zf),z=zf.map(x=>x/zl);
    let x=[-z[1],z[0],0];const xl=Math.hypot(...x)||1;x=x.map(v=>v/xl);const y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];
    const V=[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-(x[0]*eye[0]+x[1]*eye[1]+x[2]*eye[2])+panX,-(y[0]*eye[0]+y[1]*eye[1]+y[2]*eye[2])+panY,-(z[0]*eye[0]+z[1]*eye[1]+z[2]*eye[2]),1];
    return {mv:V,mvp:mul4(Pm,V)};}
  function render(pick){const dpr=window.devicePixelRatio||1,w=Math.round(canvas.clientWidth*dpr),h=Math.round(canvas.clientHeight*dpr);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    gl.viewport(0,0,w,h);gl.enable(gl.DEPTH_TEST);
    const bg=pick?[0,0,0]:(getComputedStyle(canvas).getPropertyValue("--sunken")?[0.9,0.92,0.96]:[0.9,0.92,0.96]);
    gl.clearColor(...bg,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(!count)return;
    gl.useProgram(P);const m=mats();gl.uniformMatrix4fv(gl.getUniformLocation(P,"mvp"),false,m.mvp);gl.uniformMatrix4fv(gl.getUniformLocation(P,"mv"),false,m.mv);
    gl.uniform1i(gl.getUniformLocation(P,"pick"),pick?1:0);
    gl.bindBuffer(gl.ARRAY_BUFFER,bP);gl.enableVertexAttribArray(aP);gl.vertexAttribPointer(aP,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,bC);gl.enableVertexAttribArray(aC);gl.vertexAttribPointer(aC,3,gl.UNSIGNED_BYTE,true,0,0);
    gl.drawArrays(gl.TRIANGLES,0,count);}
  let raf=0;function draw(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;render(false);});}
  function pickAt(x,y){const dpr=window.devicePixelRatio||1,w=Math.round(canvas.clientWidth*dpr),h=Math.round(canvas.clientHeight*dpr);
    gl.bindRenderbuffer(gl.RENDERBUFFER,rb);gl.renderbufferStorage(gl.RENDERBUFFER,gl.RGBA8,w,h);
    gl.bindRenderbuffer(gl.RENDERBUFFER,db);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,w,h);
    gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,rb);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,db);
    gl.disable(gl.BLEND);render(true);const px=new Uint8Array(4);gl.readPixels(Math.round(x*dpr),Math.round(h-y*dpr),1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);draw();return (px[0]|(px[1]<<8)|(px[2]<<16))-1;}
  let drag=null,moved=0;
  canvas.addEventListener("pointerdown",e=>{drag={x:e.clientX,y:e.clientY,b:e.button,shift:e.shiftKey};moved=0;canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener("pointermove",e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;moved+=Math.abs(dx)+Math.abs(dy);drag.x=e.clientX;drag.y=e.clientY;
    if(drag.b===2||drag.shift){panX+=dx*dist/canvas.clientHeight;panY-=dy*dist/canvas.clientHeight;}
    else{yaw-=dx*0.01;pitch=Math.max(-1.5,Math.min(1.5,pitch+dy*0.01));}draw();});
  canvas.addEventListener("pointerup",e=>{if(drag&&moved<4&&drag.b===0){const r=canvas.getBoundingClientRect();const id=pickAt(e.clientX-r.left,e.clientY-r.top);if(id>=0)onPick(id,e);}drag=null;});
  /* wheel zooms toward whatever is under the cursor */
  let wheelPick=0;
  canvas.addEventListener("wheel",e=>{e.preventDefault();const f=Math.exp(e.deltaY*0.0015);
    if(f<1&&Date.now()-wheelPick>120){wheelPick=Date.now();const r=canvas.getBoundingClientRect(),id=pickAt(e.clientX-r.left,e.clientY-r.top);
      if(id>=0){const p=faceCenter(id),t=1-f;center=center.map((c0,k)=>c0+(p[k]-c0)*t*1.6);}}
    dist=Math.max(radius*0.02,Math.min(radius*12,dist*f));draw();},{passive:false});
  canvas.addEventListener("dblclick",e=>{const r=canvas.getBoundingClientRect(),id=pickAt(e.clientX-r.left,e.clientY-r.top);if(id>=0)lookAt(faceCenter(id),0.45);});
  canvas.addEventListener("contextmenu",e=>e.preventDefault());
  new ResizeObserver(draw).observe(canvas);
  return {setGeometry,setColors,draw,fitBox,lookAt,
    view:(y,p)=>{yaw=y;pitch=p;draw();},zoom:f=>{dist=Math.max(radius*0.02,Math.min(radius*12,dist*f));draw();},
    fit:()=>{if(count)fitBox(bboxOf(P0));}};
}

/* ---------- Meshy ---------- */
const MESHY="https://api.meshy.ai/openapi/v1/retexture";
const toDataURL=blob=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(blob);});
async function imageURI(file){
  const bmp=await createImageBitmap(file),sc=Math.min(1,2048/Math.max(bmp.width,bmp.height));
  const cv=document.createElement("canvas");cv.width=Math.round(bmp.width*sc);cv.height=Math.round(bmp.height*sc);
  cv.getContext("2d").drawImage(bmp,0,0,cv.width,cv.height);
  return await toDataURL(await new Promise(r=>cv.toBlob(r,"image/png")));
}
async function meshyTexture(key,stlBuf,images,log){
  const model=await toDataURL(new Blob([stlBuf],{type:"application/octet-stream"}));
  if(model.length>99e6)throw new Error("figure is too big to send inline (Meshy takes up to 100 MB)");
  const body={model_url:model,ai_model:"meshy-7",enable_original_uv:false,enable_pbr:false,texture_resolution:"4k",target_formats:["glb"]};
  const uris=[];for(const f of images.slice(0,4))uris.push(await imageURI(f));
  if(uris.length>=2)body.multiview_image_urls=uris; else body.image_style_url=uris[0];
  log("Sending the figure to Meshy…");
  const r=await fetch(MESHY,{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(`Meshy refused the job (${r.status}): ${j.message||JSON.stringify(j).slice(0,200)}`);
  const id=j.result; try{localStorage.setItem("spcLastTask",id);}catch(e){}
  return await meshyWait(key,id,log);
}
async function meshyWait(key,id,log){
  for(;;){const s=await (await fetch(`${MESHY}/${id}`,{headers:{Authorization:`Bearer ${key}`}})).json();
    log(`Meshy: ${String(s.status||"").toLowerCase()} ${s.progress||0}%`);
    if(s.status==="SUCCEEDED"){
      try{return await (await fetch(s.model_urls.glb)).arrayBuffer();}
      catch(e){const err=new Error("Meshy finished painting. Your browser won't fetch the file from Meshy directly, so:");err.url=s.model_urls.glb;throw err;}}
    if(["FAILED","CANCELED","EXPIRED"].includes(s.status))throw new Error("Meshy task "+s.status+": "+((s.task_error&&s.task_error.message)||""));
    await new Promise(r=>setTimeout(r,6000));}
}

/* ---------- project settings ---------- */
/* keys that carry one block per filament, from a Bambu Studio 2.x project. Blocks
   are filament-major: k values per filament. */
const FK1="activate_air_filtration additional_cooling_fan_speed additional_fan_full_speed_layer chamber_temperatures circle_compensation_speed close_additional_fan_first_x_layers close_fan_the_first_x_layers complete_print_exhaust_fan_speed cool_plate_temp cool_plate_temp_initial_layer cooling_perimeter_transition_distance cooling_slowdown_logic counter_coef_1 counter_coef_2 counter_coef_3 counter_limit_max counter_limit_min default_filament_colour diameter_limit during_print_exhaust_fan_speed enable_overhang_bridge_fan enable_pressure_advance eng_plate_temp eng_plate_temp_initial_layer fan_cooling_layer_time fan_max_speed fan_min_speed first_x_layer_fan_speed first_x_layer_part_fan_speed full_fan_speed_layer hole_coef_1 hole_coef_2 hole_coef_3 hole_limit_max hole_limit_min hot_plate_temp hot_plate_temp_initial_layer impact_strength_z ironing_fan_speed no_slow_down_for_cooling_on_outwalls nozzle_temperature_range_high nozzle_temperature_range_low overhang_fan_speed overhang_fan_threshold overhang_threshold_participating_cooling pre_start_fan_time pressure_advance reduce_fan_stop_start_freq required_nozzle_HRC slow_down_for_layer_cooling slow_down_layer_time supertack_plate_temp supertack_plate_temp_initial_layer temperature_vitrification textured_plate_temp textured_plate_temp_initial_layer".split(" ");
const FK2="filament_adaptive_volumetric_speed filament_bridge_speed filament_cooling_before_tower filament_deretraction_speed filament_dev_ams_drying_ams_limitations filament_enable_overhang_speed filament_extruder_variant filament_flow_ratio filament_flush_temp filament_flush_temp_fast filament_flush_volumetric_speed filament_long_retractions_when_cut filament_max_volumetric_speed filament_overhang_1_4_speed filament_overhang_2_4_speed filament_overhang_3_4_speed filament_overhang_4_4_speed filament_overhang_totally_speed filament_pre_cooling_temperature filament_pre_cooling_temperature_nc filament_preheat_temperature_delta filament_ramming_travel_time filament_ramming_travel_time_nc filament_ramming_volumetric_speed filament_ramming_volumetric_speed_nc filament_retract_before_wipe filament_retract_length_nc filament_retract_restart_extra filament_retract_when_changing_layer filament_retraction_distances_when_cut filament_retraction_length filament_retraction_minimum_travel filament_retraction_speed filament_self_index filament_wipe filament_wipe_distance filament_z_hop filament_z_hop_types flush_volumes_vector long_retractions_when_ec nozzle_temperature nozzle_temperature_initial_layer override_process_overhang_speed retraction_distances_when_ec slow_down_min_speed volumetric_speed_coefficients".split(" ");
function setFilaments(ps,fils){
  const N0=(ps.filament_colour||[]).length||1, N=fils.length;
  const blockK=(k,v)=>{if(!Array.isArray(v))return 0; if(k==="flush_volumes_matrix")return -1;
    if(FK2.includes(k)&&v.length===2*N0)return 2; if(v.length===4*N0&&k.startsWith("filament_dev_ams_drying"))return 4;
    if(v.length===N0&&(FK1.includes(k)||k.startsWith("filament_")))return 1; return 0;};
  for(const [k,v] of Object.entries(ps)){const b=blockK(k,v);if(!b)continue;
    if(b===-1){const old=v,m=[];for(let i=0;i<N;i++)for(let j=0;j<N;j++)
      m.push(i===j?"0":(i<N0&&j<N0&&old[i*N0+j]!=null?old[i*N0+j]:"300"));ps[k]=m;continue;}
    const out=[];for(let i=0;i<N;i++){const src=Math.min(i,N0-1);for(let j=0;j<b;j++)out.push(v[src*b+j]);}ps[k]=out;}
  const suffix=((ps.filament_settings_id||[""])[0].match(/ @.*$/)||[" @BBL P1S 0.4 nozzle"])[0];
  fils.forEach((f,i)=>{ if(f.keep)return;
    ps.filament_colour[i]=f.hex; if(ps.filament_multi_colour)ps.filament_multi_colour[i]=f.hex;
    const bambu=f.vendor==="Bambu Lab"&&PRESET[f.fid];
    if(ps.filament_settings_id)ps.filament_settings_id[i]=(bambu?PRESET[f.fid]:"Generic "+(/PETG/.test(f.type||"")?"PETG":/TPU/.test(f.type||"")?"TPU":"PLA"))+suffix;
    if(ps.filament_ids)ps.filament_ids[i]=bambu?f.fid:(/PETG/.test(f.type||"")?"GFG99":/TPU/.test(f.type||"")?"GFU99":"GFL99");
    if(ps.filament_vendor)ps.filament_vendor[i]=bambu?"Bambu Lab":"Generic";
    if(ps.filament_type)ps.filament_type[i]=/PETG/.test(f.type||"")?"PETG":/TPU/.test(f.type||"")?"TPU":"PLA";
    {const ty=/PETG/.test(f.type||"")?"PETG":/TPU/.test(f.type||"")?"TPU":"PLA",t=(bambu&&NOZ[f.fid])||NOZ[ty];
      const put=(k,val)=>{const v=ps[k];if(!Array.isArray(v))return;const b=v.length/N;for(let j=0;j<b;j++)v[i*b+j]=String(val);};
      put("nozzle_temperature_initial_layer",t[0]);put("nozzle_temperature",t[1]);put("nozzle_temperature_range_low",t[2]);put("nozzle_temperature_range_high",t[3]);}
    if(ps.filament_self_index){const b=ps.filament_self_index.length/N;for(let j=0;j<b;j++)ps.filament_self_index[i*b+j]=String(i+1);}
  });
  return ps;
}
function minimalSettings(fils){
  return setFilaments({filament_colour:["#FFFFFF"],filament_multi_colour:["#FFFFFF"],filament_settings_id:["Bambu PLA Basic @BBL P1S 0.4 nozzle"],
    filament_ids:["GFA00"],filament_vendor:["Bambu Lab"],filament_type:["PLA"],printer_settings_id:"Bambu Lab P1S 0.4 nozzle",
    printer_model:"Bambu Lab P1S",print_settings_id:"0.20mm Standard @BBL X1C"},fils);
}

/* ---------- fine paint inside a triangle (Bambu / PrusaSlicer TriangleSelector) ----------
   A painted triangle can carry a tree of sub-triangles, each split into 4 at its edge midpoints, so a paint
   edge can run through the middle of a big triangle instead of following its edges. The model's shape and
   triangle list stay exactly as they were.
   Encoding (TriangleSelector::serialize): per node 2 bits split count; split nodes add 2 bits special side and
   their children last-to-first; leaves add 2 bits state (or 0b11 + 4 bits state-3). Bits are read 4 at a time
   (first bit lowest) into hex digits, written last digit first. */
function paintStrings(p,states,M){const _t0=performance.now();let _pa=0;
  const base=p.m0||p.m, lv=p.m0?(p.lv||0):0, W=p.m, wv=M?xf(M,W.v):W.v, bv=M?xf(M,base.v):base.v;
  const nW=W.f.length/3, V=W.v.length/3;
  /* weld corners that sit at the same point, so neighbours are found even in a mesh saved one triangle at a time */
  const WF=new Uint32Array(W.f.length);{const seen=new Map(),canon=new Uint32Array(V);
    for(let i=0;i<V;i++){const k=Math.round(W.v[i*3]*1e4)+","+Math.round(W.v[i*3+1]*1e4)+","+Math.round(W.v[i*3+2]*1e4);const c=seen.get(k);canon[i]=c===undefined?(seen.set(k,i),i):c;}
    for(let i=0;i<W.f.length;i++)WF[i]=canon[W.f[i]];}
  /* the paint around each vertex of the working mesh, by corner angle: lets a paint edge run straight
     across a long thin triangle instead of zig-zagging along its neighbours */
  const vs=new Int32Array(V+1);for(let t=0;t<nW;t++)for(let k=0;k<3;k++)vs[WF[t*3+k]+1]++;for(let i=0;i<V;i++)vs[i+1]+=vs[i];
  const vf=new Int32Array(vs[V]),fill=vs.slice(0,V);for(let t=0;t<nW;t++)for(let k=0;k<3;k++)vf[fill[WF[t*3+k]]++]=t;
  const P=(i)=>[wv[i*3],wv[i*3+1],wv[i*3+2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],len=a=>Math.hypot(a[0],a[1],a[2]);
  const ang=(t,k)=>{const a=P(WF[t*3+k]),b=P(WF[t*3+(k+1)%3]),c=P(WF[t*3+(k+2)%3]),u=sub(b,a),w=sub(c,a),lu=len(u),lw=len(w);if(!lu||!lw)return 0;
    return Math.acos(Math.max(-1,Math.min(1,(u[0]*w[0]+u[1]*w[1]+u[2]*w[2])/(lu*lw))));};
  const vvote=new Map(),vote=v=>{let m=vvote.get(v);if(m)return m;m=new Map();let s=0;
    for(let q=vs[v];q<vs[v+1];q++){const t=vf[q],k=WF[t*3]===v?0:WF[t*3+1]===v?1:2,a=ang(t,k),st=states[t];m.set(st,(m.get(st)||0)+a);s+=a;}
    if(s>0)for(const [k2,x] of m)m.set(k2,x/s);vvote.set(v,m);return m;};
  const R=0.6,FINE=0.3,MAXD=5,DISC=1.5;
  const maxEdge=t=>{const a=P(WF[t*3]),b=P(WF[t*3+1]),c=P(WF[t*3+2]);return Math.max(len(sub(a,b)),len(sub(b,c)),len(sub(c,a)));};
  const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2];
  const kidsOurs=([a,b,c])=>{const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);return [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]];};
  const kidsPrusa=([a,b,c])=>{const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);return [[a,ab,ca],[ab,b,bc],[bc,c,ca],[ab,bc,ca]];};
  const cen=t=>[(t[0][0]+t[1][0]+t[2][0])/3,(t[0][1]+t[1][1]+t[2][1])/3,(t[0][2]+t[1][2]+t[2][2])/3];
  const d2=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
  const triA=t=>{const u=sub(t[1],t[0]),w=sub(t[2],t[0]);return 0.5*Math.hypot(u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]);};
  /* broad paints (typical width over 2.5 mm) may move their shared border; stripes and piping never do */
  const area=new Map(),perim=new Map();
  for(let t=0;t<nW;t++){const st=states[t],T=[P(WF[t*3]),P(WF[t*3+1]),P(WF[t*3+2])];area.set(st,(area.get(st)||0)+triA(T));
    for(let e=0;e<3;e++){const a=WF[t*3+e],b=WF[t*3+(e+1)%3];let u=-1;
      for(let q=vs[a];q<vs[a+1];q++){const tt=vf[q];if(tt!==t&&(WF[tt*3]===b||WF[tt*3+1]===b||WF[tt*3+2]===b)){u=tt;break;}}
      if(u>=0&&states[u]===st)continue;perim.set(st,(perim.get(st)||0)+len(sub(P(a),P(b))));}}
  let allA=0;for(const a of area.values())allA+=a;
  const broad=new Set([...area].filter(([st,a])=>a>0.15*allA||2*a/Math.max(perim.get(st)||0,1e-6)>2.5).map(([st])=>st));
  /* paint samples spread over the surface (big triangles get many), for a disc vote at any point */
  const cell=DISC,grid=new Map(),gk=(x,y,z)=>((Math.floor(x/cell)+512)*1024+(Math.floor(y/cell)+512))*1024+(Math.floor(z/cell)+512);
  const addS=(p,w,st)=>{const k=gk(p[0],p[1],p[2]);let g=grid.get(k);if(!g){g=[];grid.set(k,g);}g.push(p[0],p[1],p[2],w,st);};
  const spread=(T,st,d)=>{const e=Math.max(len(sub(T[0],T[1])),len(sub(T[1],T[2])),len(sub(T[2],T[0])));
    if(e<=1.0||d>=3){addS(cen(T),triA(T),st);return;}for(const k of kidsPrusa(T))spread(k,st,d+1);};
  /* samples gather into 0.4 mm boxes first (one point per box and paint), so a disc vote reads a few hundred points */
  const box=new Map(),bk=(p)=>((Math.floor(p[0]/0.4)+4096)*8192+(Math.floor(p[1]/0.4)+4096))*8192+(Math.floor(p[2]/0.4)+4096);
  const addS0=addS;
  const addB=(p,w,st)=>{const k=bk(p)*32+st;let b=box.get(k);if(!b){b=[0,0,0,0,st];box.set(k,b);}b[0]+=p[0]*w;b[1]+=p[1]*w;b[2]+=p[2]*w;b[3]+=w;};
  const spreadB=(T,st,d)=>{const e=Math.max(len(sub(T[0],T[1])),len(sub(T[1],T[2])),len(sub(T[2],T[0])));
    if(e<=0.4||d>=4){addB(cen(T),triA(T),st);return;}for(const k of kidsPrusa(T))spreadB(k,st,d+1);};
  for(let t=0;t<nW;t++)if(broad.has(states[t]))spreadB([P(WF[t*3]),P(WF[t*3+1]),P(WF[t*3+2])],states[t],0);
  for(const b of box.values())if(b[3]>0)addS0([b[0]/b[3],b[1]/b[3],b[2]/b[3]],b[3],b[4]);
  const disc=p=>{const m=new Map(),cx=Math.floor(p[0]/cell),cy=Math.floor(p[1]/cell),cz=Math.floor(p[2]/cell),r2=DISC*DISC;
    for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){const g=grid.get(((cx+i+512)*1024+(cy+j+512))*1024+(cz+k+512));if(!g)continue;
      for(let q=0;q<g.length;q+=5){const dx=g[q]-p[0],dy=g[q+1]-p[1],dz=g[q+2]-p[2];if(dx*dx+dy*dy+dz*dz<=r2)m.set(g[q+4],(m.get(g[q+4])||0)+g[q+3]);}}
    return m;};
  const top=m=>{let b=-1,bv=-1,s2=0;for(const [k,v] of m){s2+=v;if(v>bv){bv=v;b=k;}}return [b,s2?bv/s2:0];};
  /* a fitted crease plane (hip of an upper leg): faces near it are cut exactly along it */
  const PL=p.capPlane,sdP=q=>(q[0]-PL.m[0])*PL.n[0]+(q[1]-PL.m[1])*PL.n[1]+(q[2]-PL.m[2])*PL.n[2];
  let capS=-1,bodyS=-1;
  if(PL){const mc=new Map(),mb=new Map();for(let t=0;t<nW;t++){const T=[P(WF[t*3]),P(WF[t*3+1]),P(WF[t*3+2])],d=sdP(cen(T));
      if(d>0.5&&d<6)mc.set(states[t],(mc.get(states[t])||0)+1);else if(d<-0.5&&d>-6)mb.set(states[t],(mb.get(states[t])||0)+1);}
    capS=top(mc)[0];bodyS=top(mb)[0];if(capS===bodyS)capS=-1;}
  const onPlane=t=>{if(capS<0)return false;const st=states[t];if(st!==capS&&st!==bodyS)return false;
    const T=[P(WF[t*3]),P(WF[t*3+1]),P(WF[t*3+2])],d=[sdP(T[0]),sdP(T[1]),sdP(T[2])];return Math.min(...d)<0&&Math.max(...d)>0;};
  function refinePlane(tri,depth){const d=[sdP(tri[0]),sdP(tri[1]),sdP(tri[2])];
    if(Math.min(...d)>=0)return {leaf:capS};if(Math.max(...d)<=0)return {leaf:bodyS};
    const e=Math.max(len(sub(tri[0],tri[1])),len(sub(tri[1],tri[2])),len(sub(tri[2],tri[0])));
    if(depth>=7||e<=0.12)return {leaf:sdP(cen(tri))>0?capS:bodyS};
    const kids=kidsPrusa(tri).map(k=>refinePlane(k,depth+1));
    if(kids.every(k=>k.leaf!==undefined&&k.leaf===kids[0].leaf))return {leaf:kids[0].leaf};return {kids};}
  /* straight paint lines (see straightLines): the side of each smoothed border decides the paint */
  const SL=straightLines(wv,W.f,states,{sigma:+(globalThis._spcLineSigma||1.0),snap:/(torso|chest|body)/i.test(p.name||""),snapR:0.7,snapW:0.7,snapOnly:globalThis._spcSnapStates||null}); /* (crease snapping on the torso's emblem; limbs' stripes are drawn on their cords already) */
  const needs=t=>SL.inBand[t]===1;
  /* strokes: piping laid as a line of one width along a smooth centre line. Near a stroke the paint is decided
     exactly by the distance to that line (within half the width it is the stroke's paint; on the faces the stroke
     owns, anything else is the paint round it), so its edges are true parallel curves at any resolution. */
  const STK=globalThis._spcStrokes&&globalThis._spcStrokes.get(p);let sgrid=null,sDist=null;
  /* a stroke with an axis (an emblem's outline seen from the front) is measured as seen along that axis, and only on
     faces that look that way, so it runs on unbroken over a step or a seam in the surface */
  const frontF=new Map();const fnW=t=>{const i=W.f[t*3]*3,j=W.f[t*3+1]*3,k=W.f[t*3+2]*3;const ux=wv[j]-wv[i],uy=wv[j+1]-wv[i+1],uz=wv[j+2]-wv[i+2],vx=wv[k]-wv[i],vy=wv[k+1]-wv[i+1],vz=wv[k+2]-wv[i+2];const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,l=Math.hypot(nx,ny,nz)||1;return [nx/l,ny/l,nz/l];};
  const basis=ax=>{const a=Math.abs(ax[0])<0.9?[1,0,0]:[0,1,0];let u=[ax[1]*a[2]-ax[2]*a[1],ax[2]*a[0]-ax[0]*a[2],ax[0]*a[1]-ax[1]*a[0]];const l=Math.hypot(...u);u=u.map(x=>x/l);const v=[ax[1]*u[2]-ax[2]*u[1],ax[2]*u[0]-ax[0]*u[2],ax[0]*u[1]-ax[1]*u[0]];return [u,v];};
  const P2=(B,q)=>[q[0]*B[0][0]+q[1]*B[0][1]+q[2]*B[0][2],q[0]*B[1][0]+q[1]*B[1][1]+q[2]*B[1][2]];
  const seg2=(q,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy||1e-12;let u=((q[0]-a[0])*dx+(q[1]-a[1])*dy)/l2;u=u<0?0:u>1?1:u;return Math.hypot(q[0]-a[0]-u*dx,q[1]-a[1]-u*dy);};
  const isFront=(sk,t)=>{const k=sk;let m=frontF.get(k);if(!m){m=new Map();frontF.set(k,m);}let v=m.get(t);if(v===undefined){const n=fnW(t);v=n[0]*sk.ax[0]+n[1]*sk.ax[1]+n[2]*sk.ax[2]>-0.3;m.set(t,v);}return v;};
  if(STK&&STK.list.length){const G=1.0,gk=(x,y,z)=>((Math.floor(x/G)+4096)*8192+(Math.floor(y/G)+4096))*8192+(Math.floor(z/G)+4096);sgrid=new Map();const SEG=[];
    const axS=[];
    for(const sk of STK.list){if(sk.ax){sk.B=basis(sk.ax);sk.X2=sk.X.map(q=>P2(sk.B,q));if(sk.inner)sk.I2=sk.inner.map(q=>P2(sk.B,q));
        const g2=new Map();for(let i=1;i<sk.X2.length;i++){const a=sk.X2[i-1],b=sk.X2[i],R=sk.r+3.2;for(let x=Math.floor((Math.min(a[0],b[0])-R)/G);x<=Math.floor((Math.max(a[0],b[0])+R)/G);x++)for(let y=Math.floor((Math.min(a[1],b[1])-R)/G);y<=Math.floor((Math.max(a[1],b[1])+R)/G);y++){const k=(x+8192)*16384+(y+8192);let L=g2.get(k);if(!L){L=[];g2.set(k,L);}L.push(i);}}sk.g2=g2;
        if(sk.I2){const gi=new Map();for(let i=1;i<sk.I2.length;i++){const a=sk.I2[i-1],b=sk.I2[i],R=4.5;for(let x=Math.floor((Math.min(a[0],b[0])-R)/G);x<=Math.floor((Math.max(a[0],b[0])+R)/G);x++)for(let y=Math.floor((Math.min(a[1],b[1])-R)/G);y<=Math.floor((Math.max(a[1],b[1])+R)/G);y++){const k=(x+8192)*16384+(y+8192);let L=gi.get(k);if(!L){L=[];gi.set(k,L);}L.push(i);}}sk.gi=gi;}
        axS.push(sk);continue;}
      for(let i=1;i<sk.X.length;i++){const a=sk.X[i-1],b=sk.X[i];const id=SEG.length;SEG.push([a,b,sk]);const R=sk.r+(sk.inner?3.2:1.5);
      const lo=[0,1,2].map(c=>Math.floor((Math.min(a[c],b[c])-R)/G)),hi=[0,1,2].map(c=>Math.floor((Math.max(a[c],b[c])+R)/G));
      for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++){const k=((x+4096)*8192+(y+4096))*8192+(z+4096);let L=sgrid.get(k);if(!L){L=[];sgrid.set(k,L);}L.push(id);}}}
    /* the nearest stroke: [distance, stroke] */
    sDist=(q,t)=>{let bd=Infinity,bs=null;const L=sgrid.get(gk(q[0],q[1],q[2]));if(L)for(const id of L){const [a,b,sk]=SEG[id];const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],l2=dx*dx+dy*dy+dz*dz||1e-12;let u=((q[0]-a[0])*dx+(q[1]-a[1])*dy+(q[2]-a[2])*dz)/l2;u=u<0?0:u>1?1:u;const d=Math.hypot(q[0]-a[0]-u*dx,q[1]-a[1]-u*dy,q[2]-a[2]-u*dz)-sk.r;if(d<bd){bd=d;bs=sk;}}
      for(const sk of axS){if(t==null||!isFront(sk,t))continue;const q2=P2(sk.B,q);const L2=sk.g2.get((Math.floor(q2[0])+8192)*16384+(Math.floor(q2[1])+8192));if(!L2)continue;for(const i of L2){const d=seg2(q2,sk.X2[i-1],sk.X2[i])-sk.r;if(d<bd){bd=d;bs=sk;}}}
      return bs?[bd,bs]:null;};}
  const stkOwn=t=>STK&&STK.own&&STK.own[t];
  /* a band with an inner edge (an emblem's outline): past the band on the inner curve's side is the emblem */
  const inD=sk=>{if(!sk.inner)return null;if(sk.gi)return q=>{const q2=P2(sk.B,q);const L=sk.gi.get((Math.floor(q2[0])+8192)*16384+(Math.floor(q2[1])+8192));if(!L)return Infinity;let bd=Infinity;for(const i of L){const d=seg2(q2,sk.I2[i-1],sk.I2[i]);if(d<bd)bd=d;}return bd;};
    if(!sk._g){const G=1.0,g=new Map();for(let i=1;i<sk.inner.length;i++){const a=sk.inner[i-1],b=sk.inner[i];const lo=[0,1,2].map(c=>Math.floor((Math.min(a[c],b[c])-4.5)/G)),hi=[0,1,2].map(c=>Math.floor((Math.max(a[c],b[c])+4.5)/G));for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++){const k=((x+4096)*8192+(y+4096))*8192+(z+4096);let L=g.get(k);if(!L){L=[];g.set(k,L);}L.push(i);}}sk._g=g;}
    return q=>{const L=sk._g.get(((Math.floor(q[0])+4096)*8192+(Math.floor(q[1])+4096))*8192+(Math.floor(q[2])+4096));if(!L)return Infinity;let bd=Infinity;for(const i of L){const a=sk.inner[i-1],b=sk.inner[i],dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],l2=dx*dx+dy*dy+dz*dz||1e-12;let u=((q[0]-a[0])*dx+(q[1]-a[1])*dy+(q[2]-a[2])*dz)/l2;u=u<0?0:u>1?1:u;const d=Math.hypot(q[0]-a[0]-u*dx,q[1]-a[1]-u*dy,q[2]-a[2]-u*dz);if(d<bd)bd=d;}return bd;};};
  const inFn=new Map();
  let _paF=0,_curT=-1;function paintAt(q,t){_pa++;if(sDist){const r=sDist(q,t);if(r&&r[0]<=0)return r[1].s;
    if(r&&r[1].inner&&r[0]<3.0&&!globalThis._noInner){let f=inFn.get(r[1]);if(!f){f=inD(r[1]);inFn.set(r[1],f);}const di=f(q);if(di<r[0]+r[1].r)return (r[1].ax||states[t]===r[1].innerS)?r[1].innerS:r[1].base; /* (only where the face is the emblem's: a surface close by in space but outside the star stays suit) */if(stkOwn(t))return r[1].base;}if(stkOwn(t)){const l=SL.at(q,t);return l===STK.ownS[t]?STK.ownBase[t]:l;}}return SL.at(q,t);}
  const LFINE=+(globalThis._spcLineFine||0.06),LMAXD=9;
  let _rc=0;function refine(tri,wt,wf,depth){
    const pc=paintAt(cen(tri),wf);
    const e=Math.max(len(sub(tri[0],tri[1])),len(sub(tri[1],tri[2])),len(sub(tri[2],tri[0])));
    if(depth>=LMAXD||e<=LFINE)return {leaf:pc};
    const p0=paintAt(tri[0],wf),p1=paintAt(tri[1],wf),p2=paintAt(tri[2],wf);
    if(p0===pc&&p1===pc&&p2===pc){/* check edge midpoints too: a thin line could pass between corners */
      const k=kidsPrusa(tri);if(paintAt(k[3][0],wf)===pc&&paintAt(k[3][1],wf)===pc&&paintAt(k[3][2],wf)===pc&&e<0.6)return {leaf:pc};
      if(e<0.25)return {leaf:pc};}
    const kids=kidsPrusa(tri).map(k=>refine(k,wt,wf,depth+1));
    if(kids.every(k=>k.leaf!==undefined&&k.leaf===kids[0].leaf))return {leaf:kids[0].leaf};
    return {kids};}
  paintStrings.lineInfo={chains:SL.chains,segs:SL.segs};
  /* node of the original triangle: down through the working-mesh subdivision, then refinement */
  let _nc=0;function node(triP,triO,level,idx,depth){
    if(level===lv){const t=idx;const wt=[P(WF[t*3]),P(WF[t*3+1]),P(WF[t*3+2])];
      if(onPlane(t))return refinePlane(triP,depth);
      if(!needs(t)&&!(sDist&&(stkOwn(t)||(()=>{const c=cen(wt),r=sDist(c,t);return r&&r[0]<1.2;})())))return {leaf:states[t]};
      /* the working face's corners in its own order; triP covers the same triangle */
      return refine(triP,wt,t,depth);}
    const ko=kidsOurs(triO),kp=kidsPrusa(triP);
    const kids=kp.map(k=>{const c=cen(k);let j=0,bd=Infinity;for(let i=0;i<4;i++){const dd=d2(c,cen(ko[i]));if(dd<bd){bd=dd;j=i;}}
      return node(k,ko[j],level+1,idx*4+j,depth+1);});
    if(kids.every(k=>k.leaf!==undefined&&k.leaf===kids[0].leaf))return {leaf:kids[0].leaf};
    return {kids};}
  function bits(nd,out){
    if(nd.leaf!==undefined){out.push(0,0);const n=nd.leaf;if(n<3){out.push(n&1,(n>>1)&1);}else{out.push(1,1);const m=n-3;for(let b=0;b<4;b++)out.push((m>>b)&1);}return;}
    out.push(1,1,0,0);for(let i=3;i>=0;i--)bits(nd.kids[i],out);}
  const nB=base.f.length/3,res=new Array(nB);let fine=0;
  const BP=i=>[bv[i*3],bv[i*3+1],bv[i*3+2]];
  for(let t=0;t<nB;t++){const tri=[BP(base.f[t*3]),BP(base.f[t*3+1]),BP(base.f[t*3+2])];
    const nd=node(tri,tri,0,t,0);
    if(nd.leaf!==undefined){res[t]=PAINT(nd.leaf);continue;}
    fine++;const b=[];bits(nd,b);while(b.length%4)b.push(0);let str="";
    for(let i=0;i<b.length;i+=4){const v=b[i]|(b[i+1]<<1)|(b[i+2]<<2)|(b[i+3]<<3);str=v.toString(16).toUpperCase()+str;}
    res[t]=str;}
  paintStrings.last={fine,total:nB};
  return res;
}
/* ---------- straight paint lines ----------
   Every border between two paints is pulled out of the mesh as a chain of points (a curve), the chain is
   smoothed as a curve (Taubin smoothing, which straightens without shrinking; about 1 mm wide, less for small
   closed loops such as eyes), and the paint at any point near a border is decided by which side of that
   smoothed curve it lies on. The line then runs straight through the middle of triangles at any resolution,
   instead of stepping along triangle edges. Ends where three paints meet stay put. */
function straightLines(v,f,lab,opt){opt=opt||{};const SIG=opt.sigma||1.0,BAND=opt.band||2.0;
  const V=v.length/3,nF=f.length/3;
  const WF=new Uint32Array(f.length);{const seen=new Map(),canon=new Uint32Array(V);
    for(let i=0;i<V;i++){const k=Math.round(v[i*3]*1e4)+","+Math.round(v[i*3+1]*1e4)+","+Math.round(v[i*3+2]*1e4);const c=seen.get(k);canon[i]=c===undefined?(seen.set(k,i),i):c;}
    for(let i=0;i<f.length;i++)WF[i]=canon[f[i]];}
  const P=i=>[v[i*3],v[i*3+1],v[i*3+2]];
  /* directed border edges, paint a on the left */
  const em=new Map(),dir=[],dirF=[];
  for(let t=0;t<nF;t++)for(let k=0;k<3;k++){const u=WF[t*3+k],w=WF[t*3+(k+1)%3];if(u===w)continue;const key=u<w?u*V+w:w*V+u;const o=em.get(key);
    if(o===undefined){em.set(key,t);continue;}if(o<0)continue;em.set(key,-1);const la=lab[t],lb=lab[o];if(la===lb||la<0||lb<0)continue;
    /* in face t the edge runs u->w with t on its left */
    /* the a-side face, for the way into it (normals can't be trusted: a mesh may be wound both ways) */
    if(la<lb)dir.push(u,w,la,lb),dirF.push(t);else dir.push(w,u,lb,la),dirF.push(o);}
  const nE=dir.length/4,deg=new Map();for(let e=0;e<nE;e++){for(const x of [dir[e*4],dir[e*4+1]])deg.set(x,(deg.get(x)||0)+1);}
  /* chains, followed without regard to which way each face is wound */
  const inc=new Map();for(let e=0;e<nE;e++)for(const x of [dir[e*4],dir[e*4+1]]){if(!inc.has(x))inc.set(x,[]);inc.get(x).push(e);}
  const used=new Uint8Array(nE),chains=[];
  const node=x=>deg.get(x)!==2;
  const follow=(e0,start)=>{const a=dir[e0*4+2],b=dir[e0*4+3],pts=[start],es=[];let e=e0,cur=start;
    for(;;){used[e]=1;es.push(e);const w=dir[e*4]===cur?dir[e*4+1]:dir[e*4];pts.push(w);cur=w;if(node(w))break;
      const nx=(inc.get(w)||[]).find(q=>!used[q]&&dir[q*4+2]===a&&dir[q*4+3]===b);if(nx===undefined)break;e=nx;}
    return {pts,a,b,es};};
  for(let e=0;e<nE;e++){if(used[e])continue;const u=dir[e*4],w=dir[e*4+1];if(node(u))chains.push(follow(e,u));else if(node(w))chains.push(follow(e,w));}
  for(let e=0;e<nE;e++)if(!used[e])chains.push(follow(e,dir[e*4]));
  /* sculpted creases: a vertex on a sharp fold (faces round it meeting at 14 degrees or more) */
  const fnA=new Float32Array(nF*3);for(let t=0;t<nF;t++){const a=P(WF[t*3]),b=P(WF[t*3+1]),c=P(WF[t*3+2]);const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],w=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];const nn=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],l=Math.hypot(...nn)||1;fnA[t*3]=nn[0]/l;fnA[t*3+1]=nn[1]/l;fnA[t*3+2]=nn[2]/l;}
  const crease=new Float32Array(V);{const em2=new Map();for(let t=0;t<nF;t++)for(let k=0;k<3;k++){const u=WF[t*3+k],w=WF[t*3+(k+1)%3];if(u===w)continue;const key=u<w?u*V+w:w*V+u;const o=em2.get(key);if(o===undefined){em2.set(key,t);continue;}
      const dt=Math.abs(fnA[t*3]*fnA[o*3]+fnA[t*3+1]*fnA[o*3+1]+fnA[t*3+2]*fnA[o*3+2]),c=1-dt;if(c>crease[u])crease[u]=c;if(c>crease[w])crease[w]=c;}}
  const CR=+(opt.crease!=null?opt.crease:0.03),vg=new Map(),vk=(x,y,z)=>((Math.floor(x/0.6)+8192)*16384+(Math.floor(y/0.6)+8192))*16384+(Math.floor(z/0.6)+8192);
  for(let i=0;i<V;i++)if(crease[i]>CR){const k=vk(v[i*3],v[i*3+1],v[i*3+2]);let g=vg.get(k);if(!g){g=[];vg.set(k,g);}g.push(i);}
  const creaseNear=(q,R)=>{const cx=Math.floor(q[0]/0.6),cy=Math.floor(q[1]/0.6),cz=Math.floor(q[2]/0.6);let sw=0,x=0,y=0,z=0;
    for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){const g=vg.get(((cx+i+8192)*16384+(cy+j+8192))*16384+(cz+k+8192));if(!g)continue;
      for(const vi of g){const d=Math.hypot(v[vi*3]-q[0],v[vi*3+1]-q[1],v[vi*3+2]-q[2]);if(d>R)continue;const w=crease[vi]*(1-d/R);sw+=w;x+=v[vi*3]*w;y+=v[vi*3+1]*w;z+=v[vi*3+2]*w;}}
    return sw>0?[x/sw,y/sw,z/sw]:null;};
  /* smooth each chain */
  const segs=[],segChain=[],segLeft=[];let sumLen=0,snapped=0;
  for(const ch of chains){const n=ch.pts.length;if(n<2)continue;const closed=ch.pts[0]===ch.pts[n-1]&&n>3;
    let X=ch.pts.map(P);let L=0;for(let i=1;i<n;i++)L+=Math.hypot(X[i][0]-X[i-1][0],X[i][1]-X[i-1][1],X[i][2]-X[i-1][2]);sumLen+=L;
    const h=L/Math.max(1,n-1)||0.4,sg=Math.min(SIG,L/(closed?14:6)),K=Math.max(0,Math.min(200,Math.round((sg/h)**2*2)));
    for(let it=0;it<K;it++)for(const lam of [0.5,-0.53]){const Y=X.map(q=>q.slice());
      for(let i=0;i<n;i++){let ip,in_;if(closed){if(i===n-1)continue;ip=i===0?n-2:i-1;in_=i+1;}else{if(i===0||i===n-1)continue;ip=i-1;in_=i+1;}
        for(let c=0;c<3;c++)Y[i][c]=X[i][c]+lam*((X[ip][c]+X[in_][c])/2-X[i][c]);}
      if(closed)Y[n-1]=Y[0].slice();X=Y;}
    /* a border that runs along a sculpted crease is laid onto it (where most of its length has a crease within
       0.6 mm), then evened out again */
    /* small closed shapes (an eye, an eyebrow): drawn as a smooth closed curve, the shape's outline kept to its
       first few waves round (an almond stays an almond, blotches and dents go) */
    if(closed&&L<25&&n>8){const M=64,pts=[];let acc=[0];for(let i=1;i<n;i++)acc.push(acc[i-1]+Math.hypot(X[i][0]-X[i-1][0],X[i][1]-X[i-1][1],X[i][2]-X[i-1][2]));const Lt=acc[n-1]||1;
      let j=0;for(let k=0;k<M;k++){const sA=k*Lt/M;while(j<n-2&&acc[j+1]<sA)j++;const f=(sA-acc[j])/((acc[j+1]-acc[j])||1);pts.push([0,1,2].map(c=>X[j][c]+f*(X[j+1][c]-X[j][c])));}
      const KH=+(opt.harm||4),out=pts.map(()=>[0,0,0]);
      for(let c=0;c<3;c++){const re=[],im=[];for(let h2=0;h2<=KH;h2++){let a=0,b=0;for(let k=0;k<M;k++){const w=2*Math.PI*h2*k/M;a+=pts[k][c]*Math.cos(w);b+=pts[k][c]*Math.sin(w);}re.push(a/M);im.push(b/M);}
        for(let k=0;k<M;k++){let x=re[0];for(let h2=1;h2<=KH;h2++){const w=2*Math.PI*h2*k/M;x+=2*(re[h2]*Math.cos(w)+im[h2]*Math.sin(w));}out[k][c]=x;}}
      /* back onto the chain's own point count */
      X=X.map((q,i)=>out[Math.min(M-1,Math.round(acc[i]/Lt*M)%M)].slice());X[n-1]=X[0].slice();}
    if(n>6&&opt.snap!==false&&!(closed&&L<25)&&(!opt.snapOnly||opt.snapOnly.has(ch.a)||opt.snapOnly.has(ch.b))){ /* (not small closed shapes: an eyebrow or an eye keeps its own outline) */const SR=+(opt.snapR||0.6),tg=X.map(q=>creaseNear(q,SR));const hit=tg.filter(Boolean).length;
      if(hit>0.6*n){const SW=+(opt.snapW||0.7);X=X.map((q,i)=>tg[i]?[(1-SW)*q[0]+SW*tg[i][0],(1-SW)*q[1]+SW*tg[i][1],(1-SW)*q[2]+SW*tg[i][2]]:q);
        for(let it=0;it<Math.min(K,8);it++)for(const lam of [0.5,-0.53]){const Y=X.map(q=>q.slice());
          for(let i=0;i<n;i++){let ip,in_;if(closed){if(i===n-1)continue;ip=i===0?n-2:i-1;in_=i+1;}else{if(i===0||i===n-1)continue;ip=i-1;in_=i+1;}
            for(let c=0;c<3;c++)Y[i][c]=X[i][c]+lam*((X[ip][c]+X[in_][c])/2-X[i][c]);}
          if(closed)Y[n-1]=Y[0].slice();X=Y;}snapped++;}}
    const c0=segs.length/8;for(let i=1;i<n;i++){segs.push(X[i-1][0],X[i-1][1],X[i-1][2],X[i][0],X[i][1],X[i][2],ch.a,ch.b);segChain.push(c0,c0+n-2,closed?1:0);
      /* the way into the a side: from the original edge toward the a-face's third corner */
      /* stored as the surface normal that puts the a side on the left of the curve as it runs (the mesh's own
         winding can't be trusted): N = edge x (way into the a face) */
      const e=ch.es[i-1],u=ch.pts[i-1],w=ch.pts[i],t=dirF[e];let x=-1;for(let k=0;k<3;k++){const z=WF[t*3+k];if(z!==u&&z!==w)x=z;}
      const pu=P(u),pw=P(w),px=x>=0?P(x):pu,m=[(pu[0]+pw[0])/2,(pu[1]+pw[1])/2,(pu[2]+pw[2])/2],ed=[pw[0]-pu[0],pw[1]-pu[1],pw[2]-pu[2]],lf=[px[0]-m[0],px[1]-m[1],px[2]-m[2]];
      const N=[ed[1]*lf[2]-ed[2]*lf[1],ed[2]*lf[0]-ed[0]*lf[2],ed[0]*lf[1]-ed[1]*lf[0]],nl=Math.hypot(...N)||1;segLeft.push(N[0]/nl,N[1]/nl,N[2]/nl);}
      /* even the normals out along the curve */
      for(let it=0;it<3;it++){const c1=segs.length/8;const tmp=segLeft.slice(c0*3,c1*3);for(let i=c0+1;i<c1-1;i++)for(let k=0;k<3;k++)segLeft[i*3+k]=(tmp[(i-1-c0)*3+k]+2*tmp[(i-c0)*3+k]+tmp[(i+1-c0)*3+k])/4;}}
  const NS=segs.length/8,cell=1.0,grid=new Map(),gk=(x,y,z)=>((x+4096)*8192+(y+4096))*8192+(z+4096);
  for(let i=0;i<NS;i++){const o=i*8,x0=Math.floor(Math.min(segs[o],segs[o+3])/cell),x1=Math.floor(Math.max(segs[o],segs[o+3])/cell),y0=Math.floor(Math.min(segs[o+1],segs[o+4])/cell),y1=Math.floor(Math.max(segs[o+1],segs[o+4])/cell),z0=Math.floor(Math.min(segs[o+2],segs[o+5])/cell),z1=Math.floor(Math.max(segs[o+2],segs[o+5])/cell);
    for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++){const k=gk(x,y,z);let g=grid.get(k);if(!g){g=[];grid.set(k,g);}g.push(i);}}
  const fn=new Float32Array(nF*3);for(let t=0;t<nF;t++){const a=P(WF[t*3]),b=P(WF[t*3+1]),c=P(WF[t*3+2]);const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],w=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];const n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],l=Math.hypot(...n)||1;fn[t*3]=n[0]/l;fn[t*3+1]=n[1]/l;fn[t*3+2]=n[2]/l;}
  /* nearest smoothed border at a point, among borders of the face's own paint */
  function near(q,t){const L0=lab[t],cx=Math.floor(q[0]/cell),cy=Math.floor(q[1]/cell),cz=Math.floor(q[2]/cell);let bd=BAND*BAND,bi=-1,bp=null,bs=0;
    for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++)for(let k=-2;k<=2;k++){const g=grid.get(gk(cx+i,cy+j,cz+k));if(!g)continue;
      for(const sI of g){const o=sI*8;if(segs[o+6]!==L0&&segs[o+7]!==L0)continue;const ax=segs[o],ay=segs[o+1],az=segs[o+2],dx=segs[o+3]-ax,dy=segs[o+4]-ay,dz=segs[o+5]-az,dd=dx*dx+dy*dy+dz*dz||1e-12;
        let s2=((q[0]-ax)*dx+(q[1]-ay)*dy+(q[2]-az)*dz)/dd;s2=Math.max(0,Math.min(1,s2));const px=ax+s2*dx,py=ay+s2*dy,pz=az+s2*dz,d=(q[0]-px)**2+(q[1]-py)**2+(q[2]-pz)**2;
        if(d<bd){bd=d;bi=sI;bp=[px,py,pz];bs=s2;}}}
    return bi<0?null:{i:bi,p:bp,d:Math.sqrt(bd),s:bs};}
  /* tangent at the nearest point: at a joint between two segments, the average of both (so the side is right
     round a bend); past the open end of a curve, the face keeps its paint */
  const tan=i=>{const o=i*8,x=segs[o+3]-segs[o],y=segs[o+4]-segs[o+1],z=segs[o+5]-segs[o+2],l=Math.hypot(x,y,z)||1;return [x/l,y/l,z/l];};
  function at(q,t){const r=near(q,t);if(!r)return lab[t];const o=r.i*8,c0=segChain[r.i*3],c1=segChain[r.i*3+1],cl=segChain[r.i*3+2],n=[fn[t*3],fn[t*3+1],fn[t*3+2]];
    let T0=tan(r.i);if(r.s<=0){let j=r.i-1;if(j<c0){if(!cl)return lab[t];j=c1;}const T1=tan(j);T0=[T0[0]+T1[0],T0[1]+T1[1],T0[2]+T1[2]];}
    else if(r.s>=1){let j=r.i+1;if(j>c1){if(!cl)return lab[t];j=c0;}const T1=tan(j);T0=[T0[0]+T1[0],T0[1]+T1[1],T0[2]+T1[2]];}
    /* side: the way into the a side, square to the curve here */
    const Nx=segLeft[r.i*3],Ny=segLeft[r.i*3+1],Nz=segLeft[r.i*3+2],tx=T0[0],ty=T0[1],tz=T0[2];const lx=Ny*tz-Nz*ty,ly=Nz*tx-Nx*tz,lz=Nx*ty-Ny*tx;
    const sd=lx*(q[0]-r.p[0])+ly*(q[1]-r.p[1])+lz*(q[2]-r.p[2]);
    return sd>=0?segs[o+6]:segs[o+7];}
  const inBand=new Uint8Array(nF);for(let t=0;t<nF;t++){const a=P(WF[t*3]),b=P(WF[t*3+1]),c=P(WF[t*3+2]),m=[(a[0]+b[0]+c[0])/3,(a[1]+b[1]+c[1])/3,(a[2]+b[2]+c[2])/3];
    const e=Math.max(Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]),Math.hypot(b[0]-c[0],b[1]-c[1],b[2]-c[2]),Math.hypot(c[0]-a[0],c[1]-a[1],c[2]-a[2]));const r=near(m,t);if(r&&r.d<e+0.3)inBand[t]=1;}
  return {at,inBand,chains:chains.length,segs:NS,len:sumLen,snapped};}
/* ---------- writing the 3MF ---------- */
function meshXML(m,codes,keepVerts,oldXml,sp){
  const out=[];
  if(keepVerts){const s=oldXml.slice(sp.from,sp.to),a=s.indexOf("<vertices"),b=s.indexOf("</vertices>")+11;out.push("\n    ",s.slice(a,b));}
  else{out.push("\n    <vertices>\n");const v=m.v;const chunk=[];
    for(let i=0;i<v.length;i+=3){chunk.push(`     <vertex x="${+v[i].toFixed(6)}" y="${+v[i+1].toFixed(6)}" z="${+v[i+2].toFixed(6)}"/>\n`);
      if(chunk.length>50000){out.push(chunk.join(""));chunk.length=0;}}
    out.push(chunk.join(""),"    </vertices>");}
  out.push("\n    <triangles>\n");const f=m.f,chunk=[];
  for(let t=0;t<f.length/3;t++){const c=codes[t];
    chunk.push(`     <triangle v1="${f[t*3]}" v2="${f[t*3+1]}" v3="${f[t*3+2]}"${c?` paint_color="${c}"`:""}/>\n`);
    if(chunk.length>50000){out.push(chunk.join(""));chunk.length=0;}}
  out.push(chunk.join(""),"    </triangles>\n   ");
  return out.join("");
}
/* THE FIGURE PRINT PROFILE: a 0.2 mm nozzle on a Bambu P1S, 0.08 mm layers, for the fewest visible layer lines at the fastest pace
   that still holds the finish, with supports that come off by hand (organic trees, 0.16 mm top gap, a 3-layer raft). Written into
   every 3MF saved here, as the process "Figure 0.2 nozzle HQ", so a figure opens in Bambu Studio ready to slice. */
const FIGURE_PROFILE={process:{"print_settings_id": "Figure 0.2 nozzle HQ", "layer_height": "0.08", "initial_layer_print_height": "0.12", "line_width": "0.22", "outer_wall_line_width": "0.22", "inner_wall_line_width": "0.24", "top_surface_line_width": "0.22", "sparse_infill_line_width": "0.24", "internal_solid_infill_line_width": "0.24", "support_line_width": "0.22", "initial_layer_line_width": "0.24", "wall_loops": "3", "top_shell_layers": "7", "bottom_shell_layers": "5", "top_shell_thickness": "0.6", "bottom_shell_thickness": "0.4", "sparse_infill_density": "15%", "sparse_infill_pattern": "gyroid", "infill_wall_overlap": "15%", "wall_generator": "arachne", "precise_outer_wall": "1", "precise_z_height": "1", "wall_sequence": "inner wall/outer wall", "detect_thin_wall": "1", "detect_overhang_wall": "1", "reduce_crossing_wall": "1", "resolution": "0.01", "elefant_foot_compensation": "0.1", "xy_contour_compensation": "0", "xy_hole_compensation": "0", "seam_position": "back", "seam_slope_type": "external", "seam_slope_conditional": "1", "scarf_angle_threshold": "155", "seam_slope_steps": "10", "seam_slope_start_height": "0", "seam_slope_entire_loop": "0", "seam_slope_inner_walls": "0", "ironing_type": "no ironing", "outer_wall_speed": ["40", "40"], "inner_wall_speed": ["80", "80"], "small_perimeter_speed": ["50%", "50%"], "small_perimeter_threshold": ["0", "0"], "sparse_infill_speed": ["120", "120"], "internal_solid_infill_speed": ["100", "100"], "top_surface_speed": ["40", "40"], "gap_infill_speed": ["60", "60"], "support_speed": ["90", "90"], "support_interface_speed": ["50", "50"], "bridge_speed": ["25", "25"], "initial_layer_speed": ["25", "25"], "initial_layer_infill_speed": ["40", "40"], "travel_speed": ["400", "400"], "overhang_1_4_speed": ["40", "40"], "overhang_2_4_speed": ["25", "25"], "overhang_3_4_speed": ["12", "12"], "overhang_4_4_speed": ["8", "8"], "default_acceleration": ["5000", "5000"], "outer_wall_acceleration": ["2500", "2500"], "inner_wall_acceleration": ["4000", "4000"], "top_surface_acceleration": ["2000", "2000"], "initial_layer_acceleration": ["500", "500"], "travel_acceleration": ["8000", "8000"], "sparse_infill_acceleration": ["100%", "100%"], "default_jerk": "9", "outer_wall_jerk": "8", "inner_wall_jerk": "9", "infill_jerk": "9", "top_surface_jerk": "9", "initial_layer_jerk": "9", "travel_jerk": "12", "enable_support": "1", "support_type": "tree(auto)", "support_style": "organic", "support_threshold_angle": "40", "support_on_build_plate_only": "0", "support_top_z_distance": "0.16", "support_bottom_z_distance": "0.16", "support_interface_top_layers": "3", "support_interface_bottom_layers": "2", "support_interface_pattern": "rectilinear_interlaced", "support_interface_spacing": "0.4", "support_object_xy_distance": "0.35", "support_expansion": "0", "bridge_no_support": "1", "max_bridge_length": "8", "support_remove_small_overhang": "1", "support_critical_regions_only": "0", "tree_support_branch_angle": "45", "tree_support_branch_diameter": "3", "tree_support_wall_count": "1", "tree_support_branch_distance": "5", "raft_layers": "3", "raft_contact_distance": "0.12", "raft_first_layer_density": "90%", "raft_first_layer_expansion": "2", "raft_expansion": "1.5", "brim_type": "no_brim", "enable_prime_tower": "1", "prime_tower_width": "20", "prime_tower_brim_width": "3", "flush_into_infill": "1", "flush_into_support": "1", "flush_into_objects": "0", "print_sequence": "by layer", "timelapse_type": "0", "spiral_mode": "0"},printer:{"printer_settings_id": "Bambu Lab P1S 0.2 nozzle", "printer_variant": "0.2", "nozzle_diameter": ["0.2"], "max_layer_height": ["0.14"], "min_layer_height": ["0.04"], "retraction_length": ["0.8", "0.8"], "z_hop": ["0.4", "0.4"], "z_hop_types": ["Auto Lift", "Auto Lift"], "wipe": ["1", "1"], "retract_when_changing_layer": ["1", "1"]},filament:{"filament_max_volumetric_speed": "3", "slow_down_layer_time": "8", "slow_down_min_speed": "10", "fan_max_speed": "100", "fan_min_speed": "100", "overhang_fan_speed": "100", "overhang_fan_threshold": "25%", "additional_cooling_fan_speed": "70", "close_fan_the_first_x_layers": "1", "slow_down_for_layer_cooling": "1", "nozzle_temperature": "220", "nozzle_temperature_initial_layer": "220", "reduce_fan_stop_start_freq": "1"},matteHotter:5};
function applyFigureProfile(ps){if(!ps||globalThis._spcNoProfile)return ps;
  for(const k in FIGURE_PROFILE.process)if(k in ps)ps[k]=FIGURE_PROFILE.process[k];
  for(const k in FIGURE_PROFILE.printer)if(k in ps)ps[k]=FIGURE_PROFILE.printer[k];
  const nf=(ps.filament_colour||[]).length;
  for(const k in FIGURE_PROFILE.filament)if(k in ps&&Array.isArray(ps[k]))ps[k]=ps[k].map(()=>FIGURE_PROFILE.filament[k]);
  /* matte filaments run a little hotter (their matting agent is the one thing here that clogs a 0.2 nozzle) */
  const ids=ps.filament_settings_id||[];for(let i=0;i<ids.length;i++){if(/matte/i.test(ids[i])){for(const k of ["nozzle_temperature","nozzle_temperature_initial_layer"])if(Array.isArray(ps[k])&&ps[k][i]!=null)ps[k][i]=String(+ps[k][i]+FIGURE_PROFILE.matteHotter);}}
  ps.filament_settings_id=ids.map(s=>s.replace(/0\.4 nozzle/g,"0.2 nozzle"));
  return ps;}
async function save3MF(S,fils,faceState){
  /* faceState[pi]: Uint8Array filament number (1-based) per face of part pi */
  if(S.project){
    const pr=S.project, edits=new Map();
    S.parts.forEach((p,pi)=>{const path=p.src.path;if(!edits.has(path))edits.set(path,[]);edits.get(path).push({p,pi});});
    const files=new Map(pr.files);
    for(const [path,list] of edits){let xml=pr.texts.get(path)||new TextDecoder().decode(pr.files.get(path));
      /* replace from the back so earlier offsets stay valid */
      const spans=meshSpans(xml);
      list.sort((a,b)=>spans.get(b.p.src.id).from-spans.get(a.p.src.id).from);
      for(const {p,pi} of list){const sp=spans.get(p.src.id);
        xml=xml.slice(0,sp.from)+meshXML(p.m0||p.m,paintStrings(p,faceState[pi],p.M),!p.subdivided||!!p.m0,xml,sp)+xml.slice(sp.to);}
      files.set(path,xml);}
    /* PLATES BY COLOUR. Every colour on a layer beyond the first costs a filament change, and a plate pays it on every layer the
       colour appears, for every part on the plate. So: a part in one colour gets a plate with only parts of that colour (the
       wings print in gold alone); multi-colour parts group by their colour set, and a part whose colours all belong to another
       group's set rides with it for free; a part with a colour the others lack (a head: skin, hair, eyes) gets its own plate.
       Parts keep their place relative to their old plate, so nothing overlaps. Plate i (1-based) sits in Bambu's grid of
       ceil(sqrt(n)) columns, one plate width plus a fifth of a width apart. */
    let plateNote="";
    try{const msb0=pr.files.get("Metadata/model_settings.config");const mdl=pr.texts.get("3D/3dmodel.model")||new TextDecoder().decode(pr.files.get("3D/3dmodel.model"));
      if(msb0&&mdl){let ms=new TextDecoder().decode(msb0);
        /* top-level object id for each part: 3dmodel.model <object id=TOP><components><component p:path="/3D/Objects/object_k.model" objectid=INNER */
        const top=new Map();for(const m of mdl.matchAll(/<object id="(\d+)"[^>]*>\s*<components>\s*<component p:path="\/([^"]+)" objectid="(\d+)"/g))top.set(m[2]+":"+m[3],m[1]);
        const items=new Map();for(const m of mdl.matchAll(/<item objectid="(\d+)"[^>]*transform="([^"]+)"/g))items.set(m[1],m[2].trim().split(/\s+/).map(Number));
        const plates=[];for(const m of ms.matchAll(/<plate>([\s\S]*?)<\/plate>/g)){const b=m[1];plates.push({id:+(/plater_id" value="(\d+)"/.exec(b)||[0,0])[1],objs:[...b.matchAll(/<metadata key="object_id" value="(\d+)"\/>/g)].map(x=>x[1]),block:m[0]});}
        const W=(()=>{const pa=(pr.ps&&pr.ps.printable_area)||[];let mx=0;for(const q of pa){const v=String(q).split("x").map(Number);mx=Math.max(mx,v[0]||0);}return mx||256;})(),GAP=W*0.2;
        const origin=(i,n)=>{const cols=Math.ceil(Math.sqrt(n)),c=(i-1)%cols,r=Math.floor((i-1)/cols);return [c*(W+GAP),-r*(W+GAP)];};
        /* colour set per painted part (slots covering at least 2% of its area) */
        const info=[];S.parts.forEach((p,pi)=>{const tid=(p.objectid!=null?String(p.objectid):null)||top.get(p.src.path+":"+p.src.id);if(!tid||!faceState[pi])return;const st=faceState[pi],A=areas(p.m0||p.m);let tot=0;const by=new Map();for(let t=0;t<st.length;t++){const a=A[t]||0;tot+=a;by.set(st[t],(by.get(st[t])||0)+a);}
          const cols=[...by].filter(([k,a])=>a>=0.02*tot).map(([k])=>k).sort((x,y)=>x-y);const pl=plates.find(q=>q.objs.includes(tid));if(!pl)return;info.push({pi,p,tid,cols,key:cols.join(","),plate:pl.id,area:tot});});
        if(info.length>=2){
          /* groups */const groups=[];const sub=(a,b)=>a.every(x=>b.includes(x));
          for(const it of info.sort((a,b)=>b.cols.length-a.cols.length||b.area-a.area)){let g=null;
            if(it.cols.length===1)g=groups.find(q=>q.cols.length===1&&q.cols[0]===it.cols[0]);
            else g=groups.find(q=>q.cols.length>1&&sub(it.cols,q.cols));
            if(!g){g={cols:it.cols.slice(),parts:[]};groups.push(g);}g.parts.push(it);}
          /* which group keeps each old plate: the one with most area there; the rest move to new plates */
          const nOld=Math.max(...plates.map(q=>q.id)),moves=[];let next=nOld;
          const byPlate=new Map();for(const g of groups)for(const it of g.parts){if(!byPlate.has(it.plate))byPlate.set(it.plate,new Map());const m=byPlate.get(it.plate);m.set(g,(m.get(g)||0)+it.area);}
          const newPlates=[];
          for(const g of groups){/* a group spread over old plates: it keeps the plate it has most of; others of it move to that plate? no: moving between old plates risks overlap, so each (old plate, group) that is not the keeper of its old plate gets a fresh plate */}
          for(const [pid,m] of byPlate){let keep=null,ka=-1;for(const [g,a] of m)if(a>ka){ka=a;keep=g;}for(const [g] of m){if(g===keep)continue;next++;const np={id:next,name:g.cols.map(k=>(fils[k-1]&&(fils[k-1].color||fils[k-1].hex))||("F"+k)).join("+"),objs:[]};newPlates.push(np);for(const it of g.parts)if(it.plate===pid){moves.push({it,from:pid,to:next});np.objs.push(it.tid);}}}
          if(moves.length){const nAll=next;let m2=files.has("3D/3dmodel.model")?(typeof files.get("3D/3dmodel.model")==="string"?files.get("3D/3dmodel.model"):new TextDecoder().decode(files.get("3D/3dmodel.model"))):mdl;
            const shift=(tid,from,to)=>{const tr=items.get(tid);if(!tr)return;const o0=origin(from,plates.length),o1=origin(to,nAll);const t2=tr.slice();t2[9]+=o1[0]-o0[0];t2[10]+=o1[1]-o0[1];const old=m2.match(new RegExp('<item objectid="'+tid+'"[^>]*transform="[^"]+"'));if(old)m2=m2.replace(old[0],old[0].replace(/transform="[^"]+"/,'transform="'+t2.join(" ")+'"'));};
            for(const mv of moves){shift(mv.it.tid,mv.from,mv.to);const inst=new RegExp('\\s*<model_instance>\\s*<metadata key="object_id" value="'+mv.it.tid+'"\\/>[\\s\\S]*?<\\/model_instance>');const im=ms.match(inst);if(im){mv.inst=im[0];ms=ms.replace(im[0],"");}}
            /* Bambu re-grids the plates when their count changes, so every item that stays on an old plate shifts with its plate */
            for(const pl of plates)for(const tid of pl.objs){if(moves.some(mv=>mv.it.tid===tid))continue;shift(tid,pl.id,pl.id);}
            files.set("3D/3dmodel.model",m2);
            let add="";for(const np of newPlates){add+='  <plate>\n    <metadata key="plater_id" value="'+np.id+'"/>\n    <metadata key="plater_name" value="'+esc(np.name)+'"/>\n    <metadata key="locked" value="false"/>\n    <metadata key="filament_map_mode" value="Auto For Flush"/>\n'+moves.filter(mv=>mv.to===np.id&&mv.inst).map(mv=>mv.inst.trim()+"\n").map(x=>"    "+x).join("")+'  </plate>\n';}
            ms=ms.replace(/<\/config>\s*$/,add+"</config>\n");files.set("Metadata/model_settings.config",new TextEncoder().encode(ms));
            plateNote="\nPlates by colour: "+newPlates.map(np=>"plate "+np.id+" ("+np.name+"): "+moves.filter(mv=>mv.to===np.id).map(mv=>mv.it.p.name.replace(/\.stl$/i,"")).join(", ")).join("; ");}}}}catch(e){console.warn("plate planner",e);plateNote="\n(plates left as they were: "+e.message+")";}
    globalThis._spcPlateNote=plateNote;
    const msb=files.get("Metadata/model_settings.config")||pr.files.get("Metadata/model_settings.config");
    if(msb){let t=new TextDecoder().decode(msb);
      t=t.replace(/(key="filament_maps" value=")([^"]*)"/g,(m,a,v)=>{const s=v.trim().split(/\s+/);while(s.length<fils.length)s.push(s[s.length-1]||"1");return a+s.slice(0,fils.length).join(" ")+'"';});
      t=t.replace(/(key="filament_volume_maps" value=")([^"]*)"/g,(m,a,v)=>{const s=v.trim().split(/\s+/);while(s.length<fils.length)s.push(s[s.length-1]||"0");return a+s.slice(0,fils.length).join(" ")+'"';});
      files.set("Metadata/model_settings.config",t);}
    const ps=applyFigureProfile(setFilaments(JSON.parse(JSON.stringify(pr.ps||minimalSettings([{hex:"#FFFFFF",vendor:"Bambu Lab",fid:"GFA00",type:"PLA Basic"}]))),fils));
    /* a slot nothing is painted with, of a type Bambu Studio warns about under a 0.2 nozzle (translucent, silk, metal...),
       is turned into PLA Basic of the same colour, so the project opens without the warning */
    {const used=new Set();for(const st of faceState||[])if(st)for(let i=0;i<st.length;i++)used.add(st[i]);
     const ids=ps.filament_ids||[],sid=ps.filament_settings_id||[];for(let i=0;i<ids.length;i++){if(used.has(i+1)||i<fils.length&&!fils[i].keep)continue;
       if(/^(GFA17|GFA05|GFA06|GFA02|GFA08|GFA15|GFG01)$/.test(ids[i])||/translucent|silk|metal|sparkle|galaxy/i.test(sid[i]||"")){ids[i]="GFA00";sid[i]="Bambu PLA Basic"+((sid[i]||"").match(/ @.*$/)||[" @BBL P1S 0.2 nozzle"])[0];if(ps.filament_type)ps.filament_type[i]="PLA";if(ps.filament_vendor)ps.filament_vendor[i]="Bambu Lab";}}}
    files.set("Metadata/project_settings.config",JSON.stringify(ps,null,4));
    return zip(files);
  }
  /* new project around the figure */
  const objs=[],items=[],cfg=[];
  S.parts.forEach((p,pi)=>{const id=pi+1;
    objs.push(`  <object id="${id}" name="${esc(p.name)}" type="model">\n   <mesh>${meshXML(p.m0||p.m,paintStrings(p,faceState[pi],p.M),false)}</mesh>\n  </object>\n`);
    const M=p.M, t=`${M[0]} ${M[1]} ${M[2]} ${M[4]} ${M[5]} ${M[6]} ${M[8]} ${M[9]} ${M[10]} ${M[12]} ${M[13]} ${M[14]}`;
    items.push(`  <item objectid="${id}" transform="${t}" printable="1"/>\n`);
    cfg.push(`  <object id="${id}">\n    <metadata key="name" value="${esc(p.name)}"/>\n    <metadata key="extruder" value="1"/>\n    <part id="1" subtype="normal_part">\n      <metadata key="name" value="${esc(p.name)}"/>\n      <metadata key="extruder" value="1"/>\n    </part>\n  </object>\n`);});
  const files=new Map();
  files.set("[Content_Types].xml",`<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="config" ContentType="text/xml"/></Types>`);
  files.set("_rels/.rels",`<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`);
  files.set("3D/3dmodel.model",`<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021">\n <metadata name="Application">BambuStudio-02.08.02.60</metadata>\n <metadata name="BambuStudio:3mfVersion">1</metadata>\n <resources>\n${objs.join("")} </resources>\n <build>\n${items.join("")} </build>\n</model>\n`);
  files.set("Metadata/model_settings.config",`<?xml version="1.0" encoding="UTF-8"?>\n<config>\n${cfg.join("")}</config>\n`);
  files.set("Metadata/project_settings.config",JSON.stringify(applyFigureProfile(minimalSettings(fils)),null,4));
  return zip(files);
}
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");

return {paintStrings,straightLines,inv4,faceNormals,OWNED,PRESET,loadPalette,savePalette,get PAL(){return PAL;},set PAL(v){PAL=v;},catalog,fname,
  hex2rgb,rgb2hex,lab,dE,labHex,unzip,zip,weld,areas,adjacency,subdivide,splitLong,meanEdge,stlOf,stlBytes,read3MF,readGLB,
  PAINT,unpaint,grid,samplePts,RNG,alignSource,registerPart,colorCloud,transferColors,kmeans,cleanIslands,
  Viewer,meshyTexture,meshyWait,setFilaments,save3MF,xf,mul4,inv4,I4,bboxOf,rot24,icp,horn,ap};
})();
window.SPC=SPC;
