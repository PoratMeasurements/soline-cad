const fs=require('fs');
const {scaleSymbol,bbox}=require('../src/symbol');
const OUT="G:/My Drive/claude/ordx-pdp-converter/analysis/out/";
const DR1=fs.readFileSync("G:/My Drive/קבצים ללמידת מכונה/PDP/2918_Ktchn_TRIO_Nir_DR1.pdp");
const SIG=DR1.subarray(0x240d,0x240d+16);
function build(srcName,dstName,W,H){
  const buf=Buffer.from(fs.readFileSync(OUT+srcName));
  let p=0,hits=[];while(true){const i=buf.indexOf(SIG,p);if(i<0)break;hits.push(i);p=i+1;}
  hits.forEach(off=>scaleSymbol(buf,off,W/150,H/120,0,0)); // scale about ORIGIN
  fs.writeFileSync(OUT+dstName,buf);
  const bb=bbox(buf,hits[0]);
  console.log(`${dstName}: ${hits.length} icons scaled about origin -> bbox X[${bb.minX}..${bb.maxX}] Y[${bb.minY}..${bb.maxY}] (element box 0..${W} / 0..${H})`);
}
build("2918_size_big400.pdp","2918_size_big400_icon2.pdp",400,300);
build("2918_size_real160.pdp","2918_size_real160_icon2.pdp",160,80);
