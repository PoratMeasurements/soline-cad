const fs=require('fs');
const DR1=fs.readFileSync("G:/My Drive/קבצים ללמידת מכונה/PDP/2918_Ktchn_TRIO_Nir_DR1.pdp");
// MEP array: 25 x 173 from 0x106 -> ends at:
const mepEnd=0x106+25*173;
console.log("MEP array 0x106..0x"+mepEnd.toString(16),"(25x173)");
// What's between MEP end and first 2D symbol (0x2215)?
console.log("gap after MEP:",(0x2215-mepEnd),"bytes (0x"+mepEnd.toString(16)+"..0x2215)");
// dump start of that gap
function row(off){let h='',a='';for(let c=0;c<16;c++){const b=DR1[off+c];h+=b.toString(16).padStart(2,'0')+' ';a+=(b>=32&&b<127?String.fromCharCode(b):'.')}return h+' '+a;}
console.log("\n-- region after MEP array (0x"+mepEnd.toString(16)+") --");
for(let r=0;r<160;r+=16)console.log("0x"+(mepEnd+r).toString(16)+"  "+row(mepEnd+r));
console.log("\n-- just before first socket 2D symbol (0x2215) --");
for(let r=-64;r<16;r+=16)console.log("0x"+(0x2215+r).toString(16)+"  "+row(0x2215+r));
// count how many 168B-stride blocks from 0x2215 look like symbols (start 00 00 xx 00)
