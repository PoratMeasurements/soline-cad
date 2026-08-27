const fs=require('fs');
const A=fs.readFileSync("G:/My Drive/קבצים ללמידת מכונה/PDP/2918_Ktchn_TRIO_Nir_DR1.pdp");
const start=0x96c0,len=291;
console.log("== block#4 transform/index @0x96c0 len 291 ==");
for(let r=0;r<len;r+=16){
  const hx=[],asc=[],f32=[];
  for(let c=0;c<16&&r+c<len;c++)hx.push(A[start+r+c].toString(16).padStart(2,'0'));
  for(let c=0;c<16&&r+c+4<=len;c+=4)f32.push(A.readFloatLE(start+r+c).toPrecision(5).padStart(11));
  for(let c=0;c<16&&r+c<len;c++){const b=A[start+r+c];asc.push(b>=32&&b<127?String.fromCharCode(b):'.');}
  console.log(`+0x${r.toString(16).padStart(3,'0')} ${hx.join(' ').padEnd(48)} ${asc.join('')}  ${f32.join(' ')}`);
}
// scan float32 for plan coords in cm or mm
console.log("\n-- float32 in plausible plan range (mm:-25000..-8000 OR cm:-2500..-800) --");
for(let p=0;p+4<=len;p++){const v=A.readFloatLE(start+p);
  if((v>=-25000&&v<=-8000)||(v>=-2500&&v<=-800)) console.log(`  +0x${p.toString(16)} = ${v}`);}
