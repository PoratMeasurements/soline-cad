const fs=require('fs');
const {scaleSymbol,bbox}=require('../src/symbol');
const OUT="G:/My Drive/claude/ordx-pdp-converter/analysis/out/";
// original socket symbol signature (from DR1 @0x240d)
const DR1=fs.readFileSync("G:/My Drive/קבצים ללמידת מכונה/PDP/2918_Ktchn_TRIO_Nir_DR1.pdp");
const SIG=DR1.subarray(0x240d,0x240d+16);

function build(srcName,dstName,W,H){
  const buf=Buffer.from(fs.readFileSync(OUT+srcName));
  // find all socket symbol blocks by original signature, scale each to W x H
  let p=0,hits=[];while(true){const i=buf.indexOf(SIG,p);if(i<0)break;hits.push(i);p=i+1;}
  const sx=W/150, sy=H/120;
  hits.forEach(off=>scaleSymbol(buf,off,sx,sy));
  fs.writeFileSync(OUT+dstName,buf);
  const bb=bbox(buf,hits[0]);
  console.log(`${dstName}: scaled ${hits.length} icons  sx=${sx.toFixed(3)} sy=${sy.toFixed(3)}  new bbox X[${bb.minX}..${bb.maxX}] Y[${bb.minY}..${bb.maxY}]`);
}
// match the size fields already in these files: big400 -> W400 H300 ; real160 -> W160 H80
build("2918_size_big400.pdp","2918_size_big400_icon.pdp",400,300);
build("2918_size_real160.pdp","2918_size_real160_icon.pdp",160,80);
