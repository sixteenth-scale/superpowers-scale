/* ---- sculpt rules ----------------------------------------------------------------------------------------
   The paint edges that matter are sculpted: a boot's top band, a glove's cuff ring, a belt, the hem of the
   trunks on a hip dome, a feathered cap. These rules read them off the mesh itself and put the paint there,
   using the photos only to decide WHICH paint each sculpted region gets. They run last, after the photo
   passes, and own the pieces they handle (named by Rob's part names: calf, leg, thigh, arm, torso).

   Rules (from the hand-edited references):
   R1  band between two crest loops round a limb: the paint edge sits 0.4 mm past each crest, at its foot,
       never on the crest itself. Lip and lower crest are found per 5 degrees round the limb.
   R2  the trunks on a leg end at the valley ring where the hip dome meets the thigh.
   R3  a feathered cap or chest piece is the dense-relief region, grown 1.2 mm to the feather tips but never
       into the valley under them; the piece is solid above its lowest tip at each angle.
   R4  a band's, cap's or trunk's paint is whichever photo color is seen most inside that sculpted region;
       the two sides of a band take the photo color of their own side.                                       */
const RULES={
  /* local height of each face above the area-weighted mean of the faces within R (own normal) */
  localHeight(g,A,o,R){const n=g.n,c=g.c,fn=g.fn,cell=R,R2=R*R,key=(x,y,z)=>((Math.floor(x/cell)+2048)*4096+(Math.floor(y/cell)+2048))*4096+(Math.floor(z/cell)+2048),H=new Map();
    for(let t=0;t<n;t++){const k=key(c[t*3],c[t*3+1],c[t*3+2]);let a=H.get(k);if(!a)H.set(k,a=[]);a.push(t);}
    const h=new Float32Array(n);
    for(let t=0;t<n;t++){const x=c[t*3],y=c[t*3+1],z=c[t*3+2];let sx=0,sy=0,sz=0,w=0;
      for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k2=-1;k2<=1;k2++){const a=H.get(key(x+i*cell,y+j*cell,z+k2*cell));if(!a)continue;
        for(const u of a){if(u===t)continue;const dx=c[u*3]-x,dy=c[u*3+1]-y,dz=c[u*3+2]-z;if(dx*dx+dy*dy+dz*dz>R2)continue;const a2=A[o+u];sx+=c[u*3]*a2;sy+=c[u*3+1]*a2;sz+=c[u*3+2]*a2;w+=a2;}}
      if(w>1e-9)h[t]=(x-sx/w)*fn[t*3]+(y-sy/w)*fn[t*3+1]+(z-sz/w)*fn[t*3+2];}
    return h;},
  /* the fraction of the area within r of each face (in the mask `where`) that is `rel` */
  density(g,A,o,rel,where,r){const n=g.n,c=g.c,cell=r,R2=r*r,key=(x,y,z)=>((Math.floor(x/cell)+2048)*4096+(Math.floor(y/cell)+2048))*4096+(Math.floor(z/cell)+2048),H=new Map();
    for(let t=0;t<n;t++){if(!where[t])continue;const k=key(c[t*3],c[t*3+1],c[t*3+2]);let a=H.get(k);if(!a)H.set(k,a=[]);a.push(t);}
    const fr=new Float32Array(n);
    for(let t=0;t<n;t++){if(!where[t])continue;const x=c[t*3],y=c[t*3+1],z=c[t*3+2];let s=0,w=0;
      for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k2=-1;k2<=1;k2++){const a=H.get(key(x+i*cell,y+j*cell,z+k2*cell));if(!a)continue;
        for(const u of a){const dx=c[u*3]-x,dy=c[u*3+1]-y,dz=c[u*3+2]-z;if(dx*dx+dy*dy+dz*dz>R2)continue;w+=A[o+u];if(rel[u])s+=A[o+u];}}
      fr[t]=w>0?s/w:0;}
    return fr;},
  geo(g,nb,seed,maxd){return geoDist(g,nb,g.n,seed,maxd);},
  /* geodesic close (rc) then open (ro) of a mask, inside vis */
  smooth(g,nb,mask,vis,rc,ro){const n=g.n;const not=m=>{const r=new Uint8Array(n);for(let t=0;t<n;t++)r[t]=vis[t]&&!m[t]?1:0;return r;};
    let d=RULES.geo(g,nb,mask,rc);const dil=new Uint8Array(n);for(let t=0;t<n;t++)dil[t]=vis[t]&&d[t]<=rc?1:0;
    d=RULES.geo(g,nb,not(dil),rc);const closed=new Uint8Array(n);for(let t=0;t<n;t++)closed[t]=dil[t]&&!(d[t]<=rc)?1:0;
    if(!ro)return closed;
    d=RULES.geo(g,nb,not(closed),ro);const er=new Uint8Array(n);for(let t=0;t<n;t++)er[t]=closed[t]&&!(d[t]<=ro)?1:0;
    d=RULES.geo(g,nb,er,ro);const out=new Uint8Array(n);for(let t=0;t<n;t++)out[t]=vis[t]&&d[t]<=ro?1:0;return out;},
  /* connected components of a mask: returns [labels, areas] */
  comps(g,nb,A,o,mask){const n=g.n,lab=new Int32Array(n).fill(-1),ar=[];let k=0;const q=[];
    for(let s=0;s<n;s++){if(!mask[s]||lab[s]>=0)continue;lab[s]=k;q.length=0;q.push(s);let a=0;
      for(let h=0;h<q.length;h++){const t=q[h];a+=A[o+t];for(let e=0;e<3;e++){const u=nb[t*3+e];if(u<0||!mask[u]||lab[u]>=0)continue;lab[u]=k;q.push(u);}}
      ar.push(a);k++;}
    return [lab,ar];},
  fillHoles(g,nb,A,o,mask,maxA){const n=g.n,inv=new Uint8Array(n);for(let t=0;t<n;t++)inv[t]=mask[t]?0:1;const [lab,ar]=RULES.comps(g,nb,A,o,inv);
    const out=Uint8Array.from(mask);for(let t=0;t<n;t++)if(inv[t]&&ar[lab[t]]<maxA)out[t]=1;return out;},
  largest(g,nb,A,o,mask,minA){const n=g.n,[lab,ar]=RULES.comps(g,nb,A,o,mask);let best=-1;for(let i=0;i<ar.length;i++)if(best<0||ar[i]>ar[best])best=i;
    const out=new Uint8Array(n);for(let t=0;t<n;t++)if(mask[t]&&(minA!=null?ar[lab[t]]>=minA:lab[t]===best))out[t]=1;return out;},
  /* a per-angle curve round an axis: bins of 5 degrees, gaps interpolated, then median-of-5 and a 3-tap mean */
  angleBins(g,sel,nb_){const n=g.n,c=g.c;let cx=0,cy=0,m=0;for(let t=0;t<n;t++)if(sel[t]){cx+=c[t*3];cy+=c[t*3+1];m++;}cx/=m||1;cy/=m||1;
    const th=new Float32Array(n),bi=new Int32Array(n);for(let t=0;t<n;t++){th[t]=Math.atan2(c[t*3+1]-cy,c[t*3]-cx);bi[t]=Math.floor((th[t]+Math.PI)/(2*Math.PI)*nb_)%nb_;}
    return {cx,cy,th,bi,nb:nb_};},
  fillCurve(v){const nb=v.length,ok=[];for(let k=0;k<nb;k++)if(Number.isFinite(v[k]))ok.push(k);if(ok.length<3)return null;
    const out=new Float64Array(nb);for(let k=0;k<nb;k++){if(Number.isFinite(v[k])){out[k]=v[k];continue;}
      let a=-1,b=-1,da=nb,db=nb;for(const j of ok){let d=(k-j+nb)%nb;if(d<da){da=d;a=j;}d=(j-k+nb)%nb;if(d<db){db=d;b=j;}}out[k]=(v[a]*db+v[b]*da)/(da+db);}
    const med=new Float64Array(nb);for(let k=0;k<nb;k++){const w=[];for(let i=-2;i<=2;i++)w.push(out[(k+i+nb)%nb]);w.sort((a,b)=>a-b);med[k]=w[2];}
    const sm=new Float64Array(nb);for(let k=0;k<nb;k++)sm[k]=(med[(k-1+nb)%nb]+med[k]+med[(k+1)%nb])/3;return sm;},
  curveAt(curve,th){const nb=curve.length;let a=(th+Math.PI)/(2*Math.PI)*nb-0.5;a=((a%nb)+nb)%nb;const i=Math.floor(a),f=a-i;return curve[i%nb]*(1-f)+curve[(i+1)%nb]*f;},
  /* R1: the band between the two crest loops nearest `zGuess` along z (the limb turned so its axis is z).
     Returns per-face: 0 below the band, 1 band, 2 above; or null when no two loops are found. */
  band(g,nb,A,o,h,zGuess,opt){const n=g.n,c=g.c,fn=g.fn,lo=opt.lo||2.2,hi=opt.hi||0.5,foot=opt.foot==null?0.4:opt.foot;
    const zone=new Uint8Array(n);for(let t=0;t<n;t++)zone[t]=(c[t*3+2]>zGuess-5&&c[t*3+2]<zGuess+4&&Math.abs(fn[t*3+2])<0.85)?1:0;
    const ab=RULES.angleBins(g,zone,72),lip=new Float64Array(72).fill(NaN),low=new Float64Array(72).fill(NaN);
    for(let k=0;k<72;k++){const zz=[];for(let t=0;t<n;t++)if(zone[t]&&ab.bi[t]===k&&h[t]>0.03)zz.push(c[t*3+2]);if(zz.length<4)continue;
      /* the lip: the topmost crest loop under the guess (within +3/-1 of it); the lower loop: the crest 0.5-2.2 mm under the lip */
      const up=zz.filter(z=>z<=zGuess+3&&z>=zGuess-1.5);if(up.length>=3){up.sort((a,b)=>b-a);lip[k]=up[Math.floor(up.length*0.1)];}
      if(Number.isFinite(lip[k])){const dn=zz.filter(z=>z<=lip[k]-hi&&z>=lip[k]-lo);if(dn.length>=3){dn.sort((a,b)=>b-a);low[k]=dn[Math.floor(dn.length*0.2)];}}}
    const L=RULES.fillCurve(lip);if(!L)return null;const Lo=RULES.fillCurve(low)||L.map(z=>z-1.2);
    const side=new Uint8Array(n),fB=new Float32Array(n);
    for(let t=0;t<n;t++){const z=c[t*3+2],zl=RULES.curveAt(L,ab.th[t])+foot,zo=RULES.curveAt(Lo,ab.th[t])-foot;side[t]=z>zl?2:z>zo?1:0;fB[t]=Math.min(z-zo,zl-z);}
    return {side,fB,lip:L,low:Lo};},
  /* scan for the crest loop with the best angular coverage in a z window: where the band is */
  findLoop(g,h,z0,z1){const n=g.n,c=g.c;let best=[NaN,0];
    for(let zs=z0;zs<z1;zs+=0.3){const sel=new Uint8Array(n);let m=0;for(let t=0;t<n;t++)if(c[t*3+2]>=zs&&c[t*3+2]<zs+0.3){sel[t]=1;m++;}if(m<20)continue;
      const ab=RULES.angleBins(g,sel,36),seen=new Set();for(let t=0;t<n;t++)if(sel[t]&&h[t]>0.03)seen.add(ab.bi[t]);const cov=seen.size/36;if(cov>best[1])best=[zs,cov];}
    return best;},
  /* R2: the trunks on a leg top: everything above the valley ring at the hip dome's base */
  trunk(g,nb,A,o,h,zTop){const n=g.n,c=g.c,fn=g.fn,zone=new Uint8Array(n);for(let t=0;t<n;t++)zone[t]=c[t*3+2]>zTop-16?1:0;
    const ab=RULES.angleBins(g,zone,72),val=new Float64Array(72).fill(NaN);
    for(let k=0;k<72;k++){const zz=[];for(let t=0;t<n;t++)if(zone[t]&&ab.bi[t]===k&&h[t]<-0.035&&Math.abs(fn[t*3])<0.98&&Math.abs(fn[t*3+2])<0.98&&c[t*3+2]<zTop-2)zz.push(c[t*3+2]);
      if(zz.length<4)continue;const bins=new Map();for(const z of zz){const b=Math.floor((z-(zTop-16))/0.4);bins.set(b,(bins.get(b)||0)+1);}let pk=-1,pc=0;for(const [b,cnt] of bins)if(cnt>pc){pc=cnt;pk=b;}
      if(pc>=3)val[k]=zTop-16+(pk+0.5)*0.4;}
    const V=RULES.fillCurve(val)||new Float64Array(72).fill(zTop-8);const trunk=new Uint8Array(n),fT=new Float32Array(n);
    for(let t=0;t<n;t++){const e=RULES.curveAt(V,ab.th[t]);fT[t]=c[t*3+2]-e;trunk[t]=zone[t]&&c[t*3+2]>e?1:0;}return {trunk,fT};},
  /* R3: feathered region in `where`: dense relief grown to the tips */
  feathers(g,nb,A,o,h,where,vis){const n=g.n,rel=new Uint8Array(n);for(let t=0;t<n;t++)rel[t]=Math.abs(h[t])>0.05?1:0;
    const fr=RULES.density(g,A,o,rel,where,1.2),core=new Uint8Array(n);for(let t=0;t<n;t++)core[t]=where[t]&&fr[t]>0.25?1:0;
    const d=RULES.geo(g,nb,core,1.2);let fea=new Uint8Array(n);for(let t=0;t<n;t++)fea[t]=where[t]&&d[t]<=1.2&&h[t]>-0.04?1:0;
    fea=RULES.fillHoles(g,nb,A,o,fea,20);fea=RULES.smooth(g,nb,fea,vis,0.6,0.5);return fea;},
  /* geodesic flood from one face over faces allowed by `ok`, up to maxd */
  flood(g,nb,ok,seed,maxd){const n=g.n,gg={n,c:g.c},mask=new Uint8Array(n);const nb2=new Int32Array(nb.length);for(let i=0;i<nb.length;i++){const u=nb[i];nb2[i]=(u>=0&&ok[u])?u:-1;}
    const sd=new Uint8Array(n);sd[seed]=1;const d=geoDist(gg,nb2,n,sd,maxd);for(let t=0;t<n;t++)if(ok[t]&&d[t]<=maxd)mask[t]=1;return mask;},
  /* R4: the photo's favourite paint inside a mask (area-weighted votes), or -1 */
  vote(photo,o,A,mask,R){if(!photo)return -1;const s=new Float64Array(R);let any=0;for(let t=0;t<mask.length;t++){if(!mask[t])continue;const i=o+t,w=photo.w[i];if(!(w>0))continue;any=1;
      for(let L=0;L<R;L++)s[L]+=A[i]*w*Math.max(0,40-photo.dist[i*R+L]);}
    if(!any)return -1;let b=0;for(let L=1;L<R;L++)if(s[L]>s[b])b=L;return s[b]>0?b:-1;},
  /* the long axis of a piece turned to z, with the narrow end (hand) or the sole at the bottom */
  upright(g,A,o,want){const n=g.n,c=g.c;const mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];for(let t=0;t<n;t++)for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],c[t*3+k]);mx[k]=Math.max(mx[k],c[t*3+k]);}
    const ext=[mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2]];let ax=0;for(let k=1;k<3;k++)if(ext[k]>ext[ax])ax=k;const oth=[0,1,2].filter(k=>k!==ax);
    /* which end is "down": the narrower end for an arm (hand), the end with the sole (flat faces facing along the axis) for a leg */
    const width=(p0,p1)=>{const lo=[1e9,1e9],hi=[-1e9,-1e9];for(let t=0;t<n;t++){const p=c[t*3+ax];if(p<p0||p>p1)continue;for(let k=0;k<2;k++){lo[k]=Math.min(lo[k],c[t*3+oth[k]]);hi[k]=Math.max(hi[k],c[t*3+oth[k]]);}}return Math.max(hi[0]-lo[0],hi[1]-lo[1]);};
    let flip;if(want==='narrow')flip=width(mn[ax],mn[ax]+2)>width(mx[ax]-2,mx[ax]);
    else{let lo=0,hi=0;for(let t=0;t<n;t++){const p=c[t*3+ax];if(Math.abs(g.fn[t*3+ax])<0.9)continue;if(p<mn[ax]+3)lo+=A[o+t];if(p>mx[ax]-3)hi+=A[o+t];}flip=hi>lo;}
    const v=new Float32Array(n*3),fn=new Float32Array(n*3);
    for(let t=0;t<n;t++){v[t*3]=c[t*3+oth[0]];v[t*3+1]=c[t*3+oth[1]];v[t*3+2]=flip?mx[ax]-c[t*3+ax]:c[t*3+ax]-mn[ax];
      fn[t*3]=g.fn[t*3+oth[0]];fn[t*3+1]=g.fn[t*3+oth[1]];fn[t*3+2]=flip?-g.fn[t*3+ax]:g.fn[t*3+ax];}
    return {pi:g.pi,n,c:v,fn,ax,flip,height:ext[ax]};},
};
/* ---- the stage: runs over the active pieces it knows, writes S.label for them, reports what it did ---- */
async function sculptRules(active,regM,hid,photo){const rep=[],R=S.regions.length,A=S.area,dbg=(window._spcDbg=window._spcDbg||{});dbg.rules=[];
  const kindOf=nm=>{nm=nm.toLowerCase();if(/pin|peg|wing/.test(nm))return null;if(/calf|leg/.test(nm))return 'boot';if(/thigh/.test(nm))return 'thigh';if(/arm/.test(nm))return 'arm';if(/torso|body|chest/.test(nm))return 'torso';if(/head|helmet/.test(nm))return 'head';return null;};
  for(const pi of active){const p=S.parts[pi],kind=kindOf(p.name);if(!kind)continue;const o=S.offs[pi],nb=S.nb[pi],n=p.m.f.length/3;
    logS(`Sculpt rules: ${p.name}…`);await tick();const t0=performance.now();
    try{
      const g0=pieceGeo(pi,null);const vis=new Uint8Array(n);for(let t=0;t<n;t++)vis[t]=hid[o+t]?0:1;
      const lab=t=>S.label[o+t],setL=(t,L)=>{if(L>=0)S.label[o+t]=L;};
      const cur=new Int32Array(n);for(let t=0;t<n;t++)cur[t]=S.label[o+t];
      const note=[];
      if(kind==='boot'||kind==='arm'){
        const g=RULES.upright(g0,A,o,kind==='arm'?'narrow':'sole'),h=RULES.localHeight(g,A,o,0.7);
        /* where the band is: the crest loop with the best coverage; a boot's sits in the lower half, a cuff in the lower 60% */
        const [zL,cov]=RULES.findLoop(g,h,kind==='arm'?0.3*g.height:0.25*g.height,kind==='arm'?0.65*g.height:0.55*g.height);
        if(!(cov>0.5))throw new Error('no crest loop found (coverage '+cov.toFixed(2)+')');
        const b=RULES.band(g,nb,A,o,h,zL+0.6,{lo:2.2,hi:0.5});if(!b)throw new Error('band not found');
        const below=new Uint8Array(n),band=new Uint8Array(n),above=new Uint8Array(n);for(let t=0;t<n;t++){if(!vis[t])continue;if(b.side[t]===0)below[t]=1;else if(b.side[t]===1)band[t]=1;else above[t]=1;}
        let Lb=RULES.vote(photo,o,A,below,R),La=RULES.vote(photo,o,A,above,R),Lm=RULES.vote(photo,o,A,band,R);
        if(Lb<0)Lb=majorityOf(cur,below,o);if(La<0)La=majorityOf(cur,above,o);if(Lm<0||Lm===Lb||Lm===La)Lm=bandColor(photo,o,A,band,R,Lb,La);
        for(let t=0;t<n;t++){if(!vis[t])continue;setL(t,b.side[t]===0?Lb:b.side[t]===1?Lm:La);}
        note.push(`band at ${zL.toFixed(1)} mm (loop coverage ${cov.toFixed(2)}), below→${rname(Lb)} band→${rname(Lm)} above→${rname(La)}`);
        if(kind==='arm'){/* the feathered shoulder cap at the wide end */
          let zt=-1e9;for(let t=0;t<n;t++)zt=Math.max(zt,g.c[t*3+2]);const top=new Uint8Array(n);for(let t=0;t<n;t++)top[t]=g.c[t*3+2]>zt-18&&Math.abs(g.fn[t*3+2])<0.9?1:0;
          const fea=RULES.feathers(g,nb,A,o,h,top,vis);let Lf=RULES.vote(photo,o,A,fea,R);if(Lf<0||Lf===La)Lf=bandColor(photo,o,A,fea,R,La,La);
          let a=0;for(let t=0;t<n;t++)if(fea[t]&&vis[t]){setL(t,Lf);a+=A[o+t];}note.push(`shoulder cap ${a.toFixed(0)} mm²→${rname(Lf)}`);}
        if(kind==='boot'&&/leg/.test(p.name.toLowerCase())&&!/calf/.test(p.name.toLowerCase())){/* an uncut leg carries the trunks on its hip dome */
          let zt=-1e9;for(let t=0;t<n;t++)zt=Math.max(zt,g.c[t*3+2]);const {trunk}=RULES.trunk(g,nb,A,o,h,zt);let Lt=RULES.vote(photo,o,A,trunk,R);if(Lt<0||Lt===La)Lt=Lb;
          let a=0;for(let t=0;t<n;t++)if(trunk[t]&&vis[t]&&b.side[t]===2){setL(t,Lt);a+=A[o+t];}note.push(`trunks ${a.toFixed(0)} mm²→${rname(Lt)}`);}
      }else if(kind==='thigh'){
        const g=RULES.upright(g0,A,o,'hip'),h=RULES.localHeight(g,A,o,0.7);let zt=-1e9;for(let t=0;t<n;t++)zt=Math.max(zt,g.c[t*3+2]);
        const {trunk}=RULES.trunk(g,nb,A,o,h,zt);const rest=new Uint8Array(n);for(let t=0;t<n;t++)rest[t]=vis[t]&&!trunk[t]?1:0;
        let Lr=RULES.vote(photo,o,A,rest,R);if(Lr<0)Lr=majorityOf(cur,rest,o);let Lt=RULES.vote(photo,o,A,trunk,R);if(Lt<0||Lt===Lr)Lt=bandColor(photo,o,A,trunk,R,Lr,Lr);
        let a=0;for(let t=0;t<n;t++)if(vis[t]){setL(t,trunk[t]?Lt:Lr);if(trunk[t])a+=A[o+t];}note.push(`thigh→${rname(Lr)}, trunks ${a.toFixed(0)} mm²→${rname(Lt)}`);
      }else if(kind==='torso'){
        const g=g0,h=RULES.localHeight(g,A,o,0.7),c=g.c;let zt=-1e9,zb=1e9;for(let t=0;t<n;t++){zt=Math.max(zt,c[t*3+2]);zb=Math.min(zb,c[t*3+2]);}
        /* the belt: the band between two crest loops in the lower half */
        const [zL,cov]=RULES.findLoop(g,h,zb+0.2*(zt-zb),zb+0.55*(zt-zb));
        let belt=null;if(cov>0.5){belt=RULES.band(g,nb,A,o,h,zL+0.6,{lo:6,hi:1.5});}
        const bodyM=new Uint8Array(n),beltM=new Uint8Array(n),colM=new Uint8Array(n);
        for(let t=0;t<n;t++){if(!vis[t])continue;const s=belt?belt.side[t]:2;if(s===2)bodyM[t]=1;else if(s===1)beltM[t]=1;else colM[t]=1;}
        let Lbody=RULES.vote(photo,o,A,bodyM,R);if(Lbody<0)Lbody=majorityOf(cur,bodyM,o);
        for(let t=0;t<n;t++)if(vis[t]&&bodyM[t])setL(t,Lbody);
        if(belt){let Lbelt=RULES.vote(photo,o,A,beltM,R),Lcol=RULES.vote(photo,o,A,colM,R);if(Lcol<0)Lcol=majorityOf(cur,colM,o);if(Lbelt<0||Lbelt===Lbody&&Lbelt===Lcol)Lbelt=bandColor(photo,o,A,beltM,R,Lbody,Lcol);
          for(let t=0;t<n;t++)if(vis[t]){if(beltM[t])setL(t,Lbelt);else if(colM[t])setL(t,Lcol);}note.push(`belt at ${zL.toFixed(1)}→${rname(Lbelt)}, below→${rname(Lcol)}, body→${rname(Lbody)}`);}
        /* the feathered chest piece: dense relief in the upper part, solid above its lowest tip per angle, plus the neck */
        const upper=new Uint8Array(n);for(let t=0;t<n;t++)upper[t]=c[t*3+2]>zb+0.55*(zt-zb)?1:0;
        let fea=RULES.feathers(g,nb,A,o,h,upper,vis);fea=RULES.largest(g,nb,A,o,fea,20);
        const ab=RULES.angleBins(g,upper,72),lowZ=new Float64Array(72).fill(NaN);
        for(let k=0;k<72;k++){const zz=[];for(let t=0;t<n;t++)if(fea[t]&&ab.bi[t]===k)zz.push(c[t*3+2]);if(zz.length>=10){zz.sort((a,b)=>a-b);lowZ[k]=zz[Math.floor(zz.length*0.03)];}}
        const LZ=RULES.fillCurve(lowZ);let afea=0;for(let t=0;t<n;t++)if(fea[t])afea+=A[o+t];
        if(LZ&&afea>100){for(let t=0;t<n;t++)if(upper[t]&&c[t*3+2]>RULES.curveAt(LZ,ab.th[t])+0.3)fea[t]=1;
          let Lf=RULES.vote(photo,o,A,fea,R);if(Lf<0||Lf===Lbody)Lf=bandColor(photo,o,A,fea,R,Lbody,Lbody);let a=0;for(let t=0;t<n;t++)if(fea[t]&&vis[t]){setL(t,Lf);a+=A[o+t];}note.push(`chest piece ${a.toFixed(0)} mm²→${rname(Lf)}`);}
        /* a raised disc or medallion on the chest front: flooded from the chest's front-most point, bounded by the valley round it; an engraved
           emblem inside it (the biggest piece once the grooves are cut out) gets its own paint when the photos show one */
        {let xs=0,m=0;for(let t=0;t<n;t++){xs+=c[t*3];m++;}const xc=xs/m,zm=(zt+zb)/2;let seed=-1,ymin=1e9;
          for(let t=0;t<n;t++){const z=c[t*3+2];if(z>zm&&z<zm+9&&Math.abs(c[t*3]-xc)<2.5&&c[t*3+1]<ymin){ymin=c[t*3+1];seed=t;}}
          if(seed>=0){const ok=new Uint8Array(n);for(let t=0;t<n;t++)ok[t]=h[t]>-0.03?1:0;let disc=RULES.flood(g,nb,ok,seed,6);disc=RULES.fillHoles(g,nb,A,o,disc,15);
            let ad=0,ext=[1e9,-1e9];for(let t=0;t<n;t++)if(disc[t]){ad+=A[o+t];ext[0]=Math.min(ext[0],c[t*3+2]);ext[1]=Math.max(ext[1],c[t*3+2]);}
            if(ad>8&&ad<120&&ext[1]-ext[0]<14){const under=new Uint8Array(n);for(let t=0;t<n;t++)under[t]=disc[t]?1:0;let Ld=bandColor(photo,o,A,under,R,Lbody,Lbody);
              const gv=new Uint8Array(n);for(let t=0;t<n;t++)gv[t]=disc[t]&&h[t]<=-0.012?1:0;const dg=RULES.geo(g,nb,gv,0.08),inner=new Uint8Array(n);for(let t=0;t<n;t++)inner[t]=disc[t]&&!(dg[t]<=0.08)?1:0;
              const emb=RULES.largest(g,nb,A,o,inner);let Lm=bandColor(photo,o,A,emb,R,Ld,Ld);let ae=0;
              for(let t=0;t<n;t++)if(disc[t]&&vis[t]){if(emb[t]&&Lm!==Ld){setL(t,Lm);ae+=A[o+t];}else setL(t,Ld);}
              note.push(`chest disc ${ad.toFixed(0)} mm²→${rname(Ld)}`+(ae>0?`, emblem ${ae.toFixed(0)} mm²→${rname(Lm)}`:''));}}}
      }else if(kind==='head'){
        const g=g0,h=RULES.localHeight(g,A,o,0.7),c=g.c,fn=g.fn;let zt=-1e9,zb=1e9,xs=0,m=0;for(let t=0;t<n;t++){zt=Math.max(zt,c[t*3+2]);zb=Math.min(zb,c[t*3+2]);xs+=c[t*3];m++;}const xc=xs/m,zm=(zt+zb)/2;
        /* the face opening: flooded from the mouth (the front-most smooth point a little under mid height) over faces that are neither crest nor valley, so the helmet's rim stops it */
        let seed=-1,ymin=1e9;for(let t=0;t<n;t++){const z=c[t*3+2];if(z>zm-5&&z<zm-2&&Math.abs(c[t*3]-xc)<1.5&&fn[t*3+1]<-0.7&&Math.abs(h[t])<0.03&&c[t*3+1]<ymin){ymin=c[t*3+1];seed=t;}}
        if(seed<0)throw new Error('no mouth seed');
        const ok=new Uint8Array(n);for(let t=0;t<n;t++)ok[t]=(h[t]>-0.035&&h[t]<0.045)?1:0;
        let skin0=RULES.flood(g,nb,ok,seed,10);skin0=RULES.fillHoles(g,nb,A,o,skin0,25);skin0=RULES.smooth(g,nb,skin0,vis,0.6,0.6);
        let a0=0;for(let t=0;t<n;t++)if(skin0[t])a0+=A[o+t];if(a0<20)throw new Error('face opening not found ('+a0.toFixed(0)+' mm²)');
        /* the edge goes to the foot of the rim crest just outside the opening (rule 1) */
        const dS=RULES.geo(g,nb,skin0,4.0),cr=new Uint8Array(n);for(let t=0;t<n;t++)cr[t]=(h[t]>0.03&&dS[t]>0.05&&dS[t]<2.0&&!skin0[t])?1:0;
        const crD=RULES.density(g,A,o,cr,cr,0.8),crest=new Uint8Array(n);for(let t=0;t<n;t++)crest[t]=cr[t]&&crD[t]>0.3?1:0;
        const d05=RULES.geo(g,nb,crest,0.5),near=new Uint8Array(n);for(let t=0;t<n;t++)near[t]=d05[t]<=0.5?1:0;const rim=RULES.largest(g,nb,A,o,near);for(let t=0;t<n;t++)rim[t]=rim[t]&&crest[t]?1:0;
        const dR=RULES.geo(g,nb,rim,6.0);let skin=new Uint8Array(n);for(let t=0;t<n;t++)skin[t]=(skin0[t]||(dS[t]<dR[t]&&dR[t]>0.4&&dS[t]<3.0))?1:0;skin=RULES.smooth(g,nb,skin,vis,0.5,0.3);
        /* eyes: the lid pocket on each side just above the opening; the better one is mirrored across the midline */
        let zs=[];for(let t=0;t<n;t++)if(skin[t])zs.push(c[t*3+2]);zs.sort((a,b)=>a-b);const zTop=zs[Math.floor(zs.length*0.95)];
        const dsk=RULES.geo(g,nb,skin,6.0),sock=new Uint8Array(n);for(let t=0;t<n;t++)sock[t]=(dsk[t]<=6&&!skin[t]&&c[t*3+2]>zTop-2&&c[t*3+2]<zTop+7&&fn[t*3+1]<-0.2)?1:0;
        const vv=new Uint8Array(n);for(let t=0;t<n;t++)vv[t]=h[t]<=-0.03?1:0;const dw=RULES.geo(g,nb,vv,0.1),wall=new Uint8Array(n);for(let t=0;t<n;t++)wall[t]=dw[t]<=0.1?1:0;
        const cand=new Uint8Array(n);for(let t=0;t<n;t++)cand[t]=sock[t]&&!wall[t]?1:0;const [lab,ar]=RULES.comps(g,nb,A,o,cand);
        let eyes=new Uint8Array(n);for(const sgn of [-1,1]){const sc=new Map();for(let t=0;t<n;t++){if(!cand[t]||sgn*(c[t*3]-xc)<=0.5||h[t]>=0)continue;const k=lab[t];if(ar[k]>12||ar[k]<1)continue;if(fn[t*3+1]<-0.4)sc.set(k,(sc.get(k)||0)+A[o+t]);}
          let bk=-1,bv=0;for(const [k,v] of sc)if(v>bv){bv=v;bk=k;}if(bk>=0)for(let t=0;t<n;t++)if(cand[t]&&lab[t]===bk)eyes[t]=1;}
        {const de=RULES.geo(g,nb,eyes,0.15);for(let t=0;t<n;t++)eyes[t]=(de[t]<=0.15&&(eyes[t]||wall[t])&&sock[t])?1:0;eyes=RULES.smooth(g,nb,eyes,vis,0.2,0.1);
          let aL=0,aR=0;for(let t=0;t<n;t++)if(eyes[t]){if(c[t*3]<xc)aL+=A[o+t];else aR+=A[o+t];}const useL=aL>=aR;const best=new Uint8Array(n);for(let t=0;t<n;t++)best[t]=eyes[t]&&((c[t*3]<xc)===useL)?1:0;
          /* mirror: the nearest face to each mirrored centre */
          const cell=0.5,key=(x,y,z)=>((Math.floor(x/cell)+2048)*4096+(Math.floor(y/cell)+2048))*4096+(Math.floor(z/cell)+2048),H=new Map();for(let t=0;t<n;t++){const k=key(c[t*3],c[t*3+1],c[t*3+2]);let a=H.get(k);if(!a)H.set(k,a=[]);a.push(t);}
          const mir=new Uint8Array(n);for(let t=0;t<n;t++){if(!best[t])continue;const x=2*xc-c[t*3],y=c[t*3+1],z=c[t*3+2];let bu=-1,bd=0.09;
            for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k2=-1;k2<=1;k2++){const a=H.get(key(x+i*cell,y+j*cell,z+k2*cell));if(!a)continue;for(const u of a){const d2=(c[u*3]-x)**2+(c[u*3+1]-y)**2+(c[u*3+2]-z)**2;if(d2<bd){bd=d2;bu=u;}}}
            if(bu>=0)mir[bu]=1;}
          const mm=RULES.smooth(g,nb,mir,vis,0.25,0.1);for(let t=0;t<n;t++)eyes[t]=(best[t]||mm[t])?1:0;}
        /* paints: the helmet from the photos on everything else; hair = the photo paint on the back that differs from the helmet */
        const rest=new Uint8Array(n),back=new Uint8Array(n);for(let t=0;t<n;t++){rest[t]=vis[t]&&!skin[t]&&!eyes[t]?1:0;back[t]=rest[t]&&fn[t*3+1]>0.3?1:0;}
        let Lh=RULES.vote(photo,o,A,rest,R);if(Lh<0)Lh=majorityOf(cur,rest,o);let Lhair=RULES.vote(photo,o,A,back,R);
        let hair=new Uint8Array(n);if(photo&&Lhair>=0&&Lhair!==Lh){for(let t=0;t<n;t++){const i=o+t;if(rest[t]&&photo.w[i]>0&&photo.sure[i*2]===Lhair)hair[t]=1;}
          hair=RULES.smooth(g,nb,hair,vis,1.0,0.8);hair=RULES.fillHoles(g,nb,A,o,hair,30);hair=RULES.largest(g,nb,A,o,hair,50);for(let t=0;t<n;t++)if(skin[t]||eyes[t])hair[t]=0;}
        let Ls=RULES.vote(photo,o,A,skin,R);if(Ls<0||Ls===Lh)Ls=bandColor(photo,o,A,skin,R,Lh,Lh);let Le=bandColor(photo,o,A,eyes,R,Lh,Ls);
        let as=0,ae=0,ah=0;for(let t=0;t<n;t++){if(!vis[t])continue;if(eyes[t]){setL(t,Le);ae+=A[o+t];}else if(skin[t]){setL(t,Ls);as+=A[o+t];}else if(hair[t]){setL(t,Lhair);ah+=A[o+t];}else setL(t,Lh);}
        note.push(`helmet→${rname(Lh)}, face ${as.toFixed(0)} mm²→${rname(Ls)}, eyes ${ae.toFixed(1)} mm²→${rname(Le)}, hair ${ah.toFixed(0)} mm²→${rname(Lhair)}`);
      }
      dbg.rules.push([p.name,Math.round(performance.now()-t0),note.join('; ')]);rep.push(`${p.name}: ${note.join('; ')}`);
    }catch(e){dbg.rules.push([p.name,Math.round(performance.now()-t0),'skipped: '+String(e&&e.message||e)]);rep.push(`${p.name}: left to the photo passes (${String(e&&e.message||e)})`);}
  }
  return rep;
  function rname(L){const r=L>=0&&S.regions[L];if(!r)return '?';return r.fil>=0&&C.PAL[r.fil]?(C.PAL[r.fil].hex+' '+C.fname(C.PAL[r.fil])):('region '+L);}
  function majorityOf(cur,mask,o){const s=new Map();for(let t=0;t<mask.length;t++)if(mask[t]&&cur[t]>=0)s.set(cur[t],(s.get(cur[t])||0)+A[o+t]);let b=-1,bv=-1;for(const [k,v] of s)if(v>bv){bv=v;b=k;}return b;}
  /* a band's own paint: the photo's best paint inside it that is not either neighbour; failing that, the neighbour it is closest to in the photos */
  function bandColor(photo,o,A,mask,R,La,Lb){if(!photo)return La;const s=new Float64Array(R);for(let t=0;t<mask.length;t++){if(!mask[t])continue;const i=o+t,w=photo.w[i];if(!(w>0))continue;for(let L=0;L<R;L++)s[L]+=A[i]*w*Math.max(0,40-photo.dist[i*R+L]);}
    let b=-1;for(let L=0;L<R;L++)if(L!==La&&L!==Lb&&(b<0||s[L]>s[b]))b=L;if(b>=0&&s[b]>0.35*Math.max(s[La]||0,s[Lb]||0,1e-9))return b;return s[La]>=s[Lb]?La:Lb;}
}
window._spcRules=sculptRules;
