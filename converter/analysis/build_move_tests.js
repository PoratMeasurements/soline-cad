const fs=require('fs');
const {injectSocket}=require('../src/inject');
const {orientationCode}=require('../src/placement');
const PDP="G:/My Drive/קבצים ללמידת מכונה/PDP/";
const OUT="G:/My Drive/claude/ordx-pdp-converter/analysis/out/";
const DR1=fs.readFileSync(PDP+"2918_Ktchn_TRIO_Nir_DR1.pdp"); // donor
const DR2=fs.readFileSync(PDP+"2918_Ktchn_TRIO_Nir_DR2.pdp"); // base

// wall 2 (ordx#1) and transform
const W={x1:3070,y1:2540,x2:7555,y2:2540};
const offX=-22876, offY=-9480, WIDTH=160;
const dx=W.x2-W.x1, dy=W.y2-W.y1, L=Math.hypot(dx,dy), ux=dx/L, uy=dy/L;
function place(ordxX){
  const s=ordxX+WIDTH/2, px=W.x1+s*ux, py=W.y1+s*uy;
  return {x:Math.round(px+offX), y:Math.round(-py+offY), orientation:orientationCode(dx,dy)};
}

// sanity: original position 1720 -> should equal VnoTopo
const pOrig=place(1720);
console.log("orig place:",pOrig,"(expect x=-18006,y=-12020,orient=0)");
const vno=fs.readFileSync(OUT+"2918_VnoTopo.pdp");
const sanity=injectSocket(DR2,DR1,pOrig);
console.log("inject@1720 == VnoTopo:", sanity.equals(vno), " len",sanity.length);

// moved variants
const cases={A:500, B:4000};
for(const [name,ox] of Object.entries(cases)){
  const p=place(ox);
  const buf=injectSocket(DR2,DR1,p);
  const fn=OUT+`2918_move${name}_ordx${ox}.pdp`;
  fs.writeFileSync(fn,buf);
  console.log(`move${name}: ORDX ${ox} -> PDP (${p.x},${p.y}) orient ${p.orientation}  ->  ${fn.split('/').pop()}  len ${buf.length}`);
}
