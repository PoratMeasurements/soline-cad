const fs=require('fs');
const {scaleSymbol,bbox}=require('../src/symbol');
const OUT="G:/My Drive/claude/ordx-pdp-converter/analysis/out/";
const DR1=fs.readFileSync("G:/My Drive/קבצים ללמידת מכונה/PDP/2918_Ktchn_TRIO_Nir_DR1.pdp");
const SIG=DR1.subarray(0x240d,0x240d+16);
// real ORDX sizes: Duplex 160x80. Build 2 variants on the real160-size base:
//  A) width-only: scale X by 160/150, Y native (keeps symbol shape, matches width)
//  B) width+height: scale X by 160/150, Y by 80/120 (fills box, squishes Y)
function build(dst,sx,sy){
  const buf=Buffer.from(fs.readFileSync(OUT+"2918_size_real160.pdp"));
  let p=0,hits=[];while(true){const i=buf.indexOf(SIG,p);if(i<0)break;hits.push(i);p=i+1;}
  hits.forEach(off=>scaleSymbol(buf,off,sx,sy,0,0));
  fs.writeFileSync(OUT+dst,buf);
  const bb=bbox(buf,hits[0]);
  console.log(`${dst}: sx=${sx.toFixed(2)} sy=${sy.toFixed(2)} -> icon bbox X[${bb.minX}..${bb.maxX}] Y[${bb.minY}..${bb.maxY}]`);
}
build("2918_icon_Wonly.pdp",160/150,1);
build("2918_icon_WH.pdp",160/150,80/120);
