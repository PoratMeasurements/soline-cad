const fs=require('fs');
const {assemble}=require('../src/assemble');
const PDP="G:/My Drive/קבצים ללמידת מכונה/PDP/";
const ORDX="G:/My Drive/קבצים ללמידת מכונה/ORDX/";
const OUT="G:/My Drive/claude/ordx-pdp-converter/analysis/out/";
const DR1=fs.readFileSync(PDP+"2918_Ktchn_TRIO_Nir_DR1.pdp");
const DR2=fs.readFileSync(PDP+"2918_Ktchn_TRIO_Nir_DR2.pdp");
const r=assemble({ordxPath:ORDX+"2918_Ktchn_TRIO_Nir_DR1.ordx",base:DR2,donor:DR1,offX:-22876,offY:-9480});
fs.writeFileSync(OUT+"2918_assembled_sockets.pdp",r.buf);
console.log(`assembled ${r.placed} socket-class items from ORDX -> injected into DR2 base`);
r.report.forEach(l=>console.log("  "+l));
// structural check
const MARK=Buffer.from([0xe0,0xe9,0xf0,0xe5,0xe3,0xf8,0xe5]);
let p=0,n=0;while(true){const i=r.buf.indexOf(MARK,p);if(i<0)break;n++;p=i+1;}
console.log(`\nnew len ${r.buf.length} (DR2 ${DR2.length} + ${r.placed}x1896=${r.placed*1896})  MEP records ${n} (expect ${24+r.placed}) count@0x11a=${r.buf.readUInt8(0x11a)}`);
