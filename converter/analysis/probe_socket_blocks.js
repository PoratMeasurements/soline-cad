const fs=require('fs');
const DR1=fs.readFileSync("G:/My Drive/קבצים ללמידת מכונה/PDP/2918_Ktchn_TRIO_Nir_DR1.pdp");
// the golden socket's 7 blocks in DR1
const BLK=[["MEP",0x514,173],["2Dsym",0x240d,168],["3Dmesh",0x44ee,210],["idx256",0x68ff,256],["trans291",0x96c0,291],["topo795",0xecc1,795],["tail3",0x13085,3]];
for(const [name,off,len] of BLK){
  const sig=DR1.subarray(off,off+len);
  let p=0,hits=[];while(true){const i=DR1.indexOf(sig,p);if(i<0)break;hits.push(i);p=i+1;}
  console.log(`${name.padEnd(9)} len ${String(len).padStart(4)}  identical copies: ${hits.length}   @ ${hits.map(h=>'0x'+h.toString(16)).join(' ')}`);
}
// MEP array stride check: are MEP records evenly 173 apart from 0x106?
console.log("\nMEP array stride check (marker אינודרו positions):");
const MARK=Buffer.from([0xe0,0xe9,0xf0,0xe5,0xe3,0xf8,0xe5]);
let p=0,offs=[];while(true){const i=DR1.indexOf(MARK,p);if(i<0)break;offs.push(i-0x28);p=i+1;}
const diffs=offs.slice(1).map((o,k)=>o-offs[k]);
console.log("count",offs.length,"first",'0x'+offs[0].toString(16),"strides:",[...new Set(diffs)].join(','));
