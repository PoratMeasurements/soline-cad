const fs=require('fs');
const {parseOrdxFile}=require('../src/parseOrdx');
const DR1=fs.readFileSync("G:/My Drive/קבצים ללמידת מכונה/PDP/2918_Ktchn_TRIO_Nir_DR1.pdp");
// 1) ORDX: heights (Position Y) of all socket-type items
const m=parseOrdxFile("G:/My Drive/קבצים ללמידת מכונה/ORDX/2918_Ktchn_TRIO_Nir_DR1.ordx");
const hs=[];
m.rooms.forEach(r=>r.walls.forEach(w=>[...w.fixtures,...w.furnishings].forEach(it=>{
  if(/socket|שקע/i.test(it.name||'')) hs.push({name:it.name,x:it.position&&it.position.x,y:it.position&&it.position.y});
})));
console.log("ORDX socket items (x=along, y=height):");
hs.forEach(h=>console.log(" ",JSON.stringify(h)));
const uniqH=[...new Set(hs.map(h=>h.y))];
console.log("distinct socket heights:",uniqH.join(', '));

// 2) search the golden socket MEP record (0x514,173) for height-like int16 (1000..1500)
console.log("\nint16 in golden MEP record in range 1000..1500 (height candidates):");
for(let p=0;p+2<=173;p++){const v=DR1.readInt16LE(0x514+p);if(v>=1000&&v<=1500)console.log(`  +0x${p.toString(16)} = ${v}`);}
// also the whole record's nonzero small ints 0..300 (cm heights?)
console.log("bytes/int16 that could be height in cm (100..130):");
for(let p=0;p+2<=173;p++){const v=DR1.readInt16LE(0x514+p);if(v>=100&&v<=130)console.log(`  +0x${p.toString(16)} = ${v}`);}
