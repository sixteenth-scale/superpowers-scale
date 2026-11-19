/* Self-test for the color tool. On the live page, in the console:
     await import("./dev/selftest.js")
   Builds a simple three-piece figure, parts laid out on a plate and a colored
   GLB, drops them into the tool, colors, picks, paints a patch and saves. */
const SPC=window.SPC, $=id=>document.getElementById(id), wait=ms=>new Promise(r=>setTimeout(r,ms));
function cyl(r,h,z0,seg=96,rings=40){const v=[],f=[];for(let j=0;j<=rings;j++)for(let i=0;i<seg;i++){const a=i/seg*2*Math.PI;v.push(r*Math.cos(a),r*Math.sin(a),z0+h*j/rings);}
  for(let j=0;j<rings;j++)for(let i=0;i<seg;i++){const a=j*seg+i,b=j*seg+(i+1)%seg,c=a+seg,d=b+seg;f.push(a,b,d,a,d,c);}
  const cb=v.length/3;v.push(0,0,z0);const ct=v.length/3;v.push(0,0,z0+h);for(let i=0;i<seg;i++){f.push(cb,(i+1)%seg,i);f.push(ct,rings*seg+i,rings*seg+(i+1)%seg);}return {v,f};}
function sph(r,zc,n=48){const v=[],f=[];for(let j=0;j<=n;j++)for(let i=0;i<n*2;i++){const th=j/n*Math.PI,ph=i/(n*2)*2*Math.PI;v.push(r*Math.sin(th)*Math.cos(ph),r*Math.sin(th)*Math.sin(ph),zc+r*Math.cos(th));}
  const W=n*2;for(let j=0;j<n;j++)for(let i=0;i<W;i++){const a=j*W+i,b=j*W+(i+1)%W,c=a+W,d=b+W;f.push(a,c,d,a,d,b);}return {v,f};}
async function glbOf(figParts){
  let V=[],F=[],UV=[];figParts.forEach(p=>{const o=V.length/3;for(let i=0;i<p.m.v.length;i+=3){const x=p.m.v[i],y=p.m.v[i+1],z=p.m.v[i+2];
    V.push(x*0.01,z*0.01-0.55,-y*0.01);UV.push(((Math.atan2(y,x)/(2*Math.PI))+1)%1,1-z/115);}for(const k of p.m.f)F.push(k+o);});
  const cv=new OffscreenCanvas(256,256),cx=cv.getContext("2d");
  for(let r=0;r<256;r++){const t=1-r/255;cx.fillStyle=t<0.47?"#14288C":t<0.50?"#EEE432":t<0.84?"#BE2823":"#E5BC9E";cx.fillRect(0,r,256,1);}
  cx.fillStyle="#111";cx.fillRect(Math.floor(0.70*256),Math.floor((1-0.78)*256),26,26);
  const png=new Uint8Array(await (await cv.convertToBlob({type:"image/png"})).arrayBuffer());
  const pos=new Float32Array(V),uvs=new Float32Array(UV),idx=new Uint32Array(F),pad=n=>(n+3)&~3,chunks=[pos,uvs,idx,png];
  let off=0;const views=[];chunks.forEach(c=>{views.push({buffer:0,byteOffset:off,byteLength:c.byteLength});off=pad(off+c.byteLength);});
  const bin=new Uint8Array(off);let o2=0;chunks.forEach(c=>{bin.set(new Uint8Array(c.buffer,c.byteOffset,c.byteLength),o2);o2=pad(o2+c.byteLength);});
  const b=SPC.bboxOf(pos);
  const json={asset:{version:"2.0"},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0,TEXCOORD_0:1},indices:2,material:0}]}],
    materials:[{pbrMetallicRoughness:{baseColorTexture:{index:0}}}],textures:[{source:0}],images:[{bufferView:3,mimeType:"image/png"}],
    accessors:[{bufferView:0,componentType:5126,count:pos.length/3,type:"VEC3",min:b.lo,max:b.hi},{bufferView:1,componentType:5126,count:uvs.length/2,type:"VEC2"},{bufferView:2,componentType:5125,count:idx.length,type:"SCALAR"}],
    bufferViews:views,buffers:[{byteLength:off}]};
  const js=new TextEncoder().encode(JSON.stringify(json)),jl=pad(js.length),jsp=new Uint8Array(jl).fill(32);jsp.set(js);
  const glb=new Uint8Array(28+jl+off),dv=new DataView(glb.buffer);dv.setUint32(0,0x46546C67,true);dv.setUint32(4,2,true);dv.setUint32(8,glb.length,true);
  dv.setUint32(12,jl,true);dv.setUint32(16,0x4E4F534A,true);glb.set(jsp,20);dv.setUint32(20+jl,off,true);dv.setUint32(24+jl,0x004E4942,true);glb.set(bin,28+jl);
  return glb;
}
async function drop(id,file){const dt=new DataTransfer();dt.items.add(file);$(id).dispatchEvent(new DragEvent("drop",{dataTransfer:dt,bubbles:true,cancelable:true}));await wait(1200);}
function hooks(){
  window._errs=window._errs||[];window.addEventListener("error",e=>_errs.push(e.message));window.addEventListener("unhandledrejection",e=>_errs.push(String(e.reason&&e.reason.message||e.reason)));
  if(!window._saved){window._saved=[];const oc=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download){_saved.push({name:this.download,href:this.href});return;}return oc.call(this);};}
}
export async function setup(){
  hooks();
  const toMesh=g=>({v:new Float32Array(g.v),f:new Uint32Array(g.f)}), legs=cyl(8,55,0),torso=cyl(13,40,56),head=sph(9,106);
  const pieces=[["Legs",legs,[0,1,0,0,-1,0,0,0,0,0,1,0,-60,0,0,1]],["Torso",torso,[1,0,0,0,0,0,1,0,0,-1,0,0,20,-50,13,1]],["Head",head,[-1,0,0,0,0,-1,0,0,0,0,1,0,70,40,-97,1]]];
  const figParts=pieces.map(p=>({m:toMesh(p[1]),M:SPC.I4()})), parts=pieces.map(p=>({name:p[0],m:toMesh(p[1]),M:p[2]}));
  const blob3=await SPC.save3MF({project:null,parts},[{hex:"#FFFFFF",vendor:"Bambu Lab",fid:"GFA00",type:"PLA Basic"}],parts.map(p=>new Uint8Array(p.m.f.length/3)));
  await drop("spcDropT",new File([blob3],"SynthParts.3mf"));
  await drop("spcDropF",new File([SPC.stlBytes(figParts)],"SynthFigure.stl"));
  await drop("spcDropI",new File([await glbOf(figParts)],"SynthColored.glb"));
  return $("spcFiles").innerText;
}
export function status(){return {log:$("spcLog").innerText,regions:[...document.querySelectorAll(".spc-reg")].map(r=>r.querySelector("select").selectedOptions[0].text.split(" · ")[0]+" | "+r.querySelector("small").innerText),errs:window._errs};}

export async function setupLoose(){ /* three loose STLs in box 1 */
  hooks();
  const toMesh=g=>({v:new Float32Array(g.v),f:new Uint32Array(g.f)}), legs=cyl(8,55,0),torso=cyl(13,40,56),head=sph(9,106);
  const figParts=[legs,torso,head].map(g=>({m:toMesh(g),M:SPC.I4()}));
  const dt=new DataTransfer();
  [["Synth_legs",legs,[0,1,0,0,-1,0,0,0,0,0,1,0,-60,0,0,1]],["Synth_torso",torso,[1,0,0,0,0,0,1,0,0,-1,0,0,20,-50,13,1]],["Synth_head",head,SPC.I4()]]
    .forEach(([n,g,M])=>dt.items.add(new File([SPC.stlBytes([{m:toMesh(g),M}])],n+".stl")));
  $("spcDropT").dispatchEvent(new DragEvent("drop",{dataTransfer:dt,bubbles:true,cancelable:true}));await wait(2500);
  await drop("spcDropF",new File([SPC.stlBytes(figParts)],"SynthFigure.stl"));
  await drop("spcDropI",new File([await glbOf(figParts)],"SynthColored.glb"));
  return $("spcFiles").innerText;
}
