const {parseOrdxFile}=require('../src/parseOrdx');
const m=parseOrdxFile("G:/My Drive/קבצים ללמידת מכונה/ORDX/2918_Ktchn_TRIO_Nir_DR1.ordx");
m.rooms.forEach(r=>r.walls.forEach(w=>{
  if(![3,5].includes(w.number))return;
  const p=w.position;
  console.log(`\n== wall ${w.number}: (${p.startX},${p.startY})->(${p.endX},${p.endY}) len=${Math.hypot(p.endX-p.startX,p.endY-p.startY).toFixed(0)} ==`);
  [...w.fixtures,...w.furnishings].forEach(it=>{
    console.log(` ${(it.name||'?').padEnd(14)} cls=${(it.class||'').padEnd(11)} X=${it.position&&it.position.x}  W=${it.size&&it.size.width}`);
  });
}));
