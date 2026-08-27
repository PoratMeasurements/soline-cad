const {parseOrdxFile}=require('../src/parseOrdx');
const d="G:/My Drive/קבצים ללמידת מכונה/ORDX/";
const A=parseOrdxFile(d+"2918_Ktchn_TRIO_Nir_DR1.ordx");
const B=parseOrdxFile(d+"2918_Ktchn_TRIO_Nir_DR2.ordx");
function items(m){const a=[];m.rooms.forEach((r,ri)=>r.walls.forEach((w,wi)=>{
  [...w.fixtures,...w.furnishings].forEach(it=>a.push({wall:w.number,wi,name:it.name||it.description,cls:it.class,type:it.type,
    x:it.position&&it.position.x,y:it.position&&it.position.y,size:it.size}));
}));return a;}
const ai=items(A),bi=items(B);
console.log("DR1 items:",ai.length,"  DR2 items:",bi.length);
const key=it=>`${it.name}|${it.x}|${it.y}`;
const bset=new Set(bi.map(key));
console.log("\n== items in DR1 not in DR2 (by name|x|y) ==");
ai.filter(it=>!bset.has(key(it))).forEach(it=>console.log(JSON.stringify(it)));
const aset=new Set(ai.map(key));
console.log("\n== items in DR2 not in DR1 ==");
bi.filter(it=>!aset.has(key(it))).forEach(it=>console.log(JSON.stringify(it)));
