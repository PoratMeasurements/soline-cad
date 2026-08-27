const fs=require('fs');
const DR1=fs.readFileSync("G:/My Drive/קבצים ללמידת מכונה/PDP/2918_Ktchn_TRIO_Nir_DR1.pdp");
// MEP dims region of golden socket (block#0 @0x514). Dump +0x9c..+0xad as bytes+int16
console.log("golden socket MEP tail (+0x9c..+0xac):");
for(let p=0x9c;p<173;p++){const abs=0x514+p;process.stdout.write(DR1[abs].toString(16).padStart(2,'0')+' ');}
console.log();
console.log("int16 at +0xa1..: ", [0xa1,0xa3,0xa5,0xa7,0xa9,0xab].map(o=>DR1.readInt16LE(0x514+o)).join(', '));

// Check dims across ALL socket MEP records (are they all identical / catalog-based?)
const SOC=Buffer.from([0xf9,0xf7,0xf2]);
console.log("\nper-socket dims (+0xa1,+0xa3,+0xa5) — should all be catalog 150/10/120 if size ignored:");
for(let k=0;k<25;k++){const s=0x106+k*173;
  if(!DR1.subarray(s+0x31,s+0x34).equals(SOC))continue;
  const d=[0xa1,0xa3,0xa5].map(o=>DR1.readInt16LE(s+o));
  console.log(`  rec${k} @0x${s.toString(16)}: ${d.join('/')}`);}

// Also inspect the 3D mesh (block#2 @0x44ee) QUADER dims
console.log("\n3D mesh QUADER header (block#2 @0x44ee, first 32 bytes):");
let str='';for(let p=0;p<32;p++){const b=DR1[0x44ee+p];str+=(b>=32&&b<127?String.fromCharCode(b):'.')}
console.log(" ascii:",str);
console.log(" int16@+8:",[8,10,12,14].map(o=>DR1.readInt16LE(0x44ee+o)).join(', '));
