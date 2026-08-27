const fs = require('fs');
const buf = fs.readFileSync(process.argv[2]);

// Translation-invariant fingerprints (sizes/heights), plus a few coords.
const targets = [
  ['H2845', 2845], ['door.W909', 909], ['door.H2051', 2051],
  ['win.W1045', 1045], ['win.H1035', 1035], ['thick100', 100],
  ['wall1.len3861', 3861], ['wall2.len2762', 2762],
  ['coord6948', 6948], ['coord9710', 9710], ['coord960', 960], ['coord4821', 4821],
  ['pbox.W217', 217], ['pbox.H160', 160], ['sock.W160', 160], ['sw.W80', 80],
];
const scales = [['mm',1],['cm',0.1],['m',0.001],['tenthmm',10]];

function approx(v,tv){ return tv!==0 && Math.abs(v-tv) <= Math.max(0.5, Math.abs(tv)*1e-4); }

function scan(kind, read, size, intMode) {
  const hits = {};
  for (let i=0;i+size<=buf.length;i++){
    let v; try{ v = read.call(buf,i);}catch(e){continue;}
    if(!Number.isFinite(v)||v===0) continue;
    for(const [name,t] of targets){
      for(const [sn,sc] of scales){
        const tv=t*sc;
        if(intMode && Math.abs(tv-Math.round(tv))>1e-9) continue; // ints only match integer-scaled
        if(approx(v,tv)){ const k=name+'|'+sn; (hits[k]=hits[k]||[]).push([i,v]); }
      }
    }
  }
  const keys=Object.keys(hits);
  if(!keys.length){ console.log(`\n===== ${kind} =====  (no hits)`); return; }
  console.log(`\n===== ${kind} =====`);
  for(const k of keys.sort()){
    const arr=hits[k];
    console.log(String(arr.length).padStart(3), k.padEnd(18),
      arr.slice(0,6).map(([o,v])=>'0x'+o.toString(16)+'='+(Math.round(v*100)/100)).join('  '));
  }
}

scan('int16 LE', Buffer.prototype.readInt16LE, 2, true);
scan('uint16 LE', Buffer.prototype.readUInt16LE, 2, true);
scan('int16 BE', Buffer.prototype.readInt16BE, 2, true);
scan('int32 LE', Buffer.prototype.readInt32LE, 4, true);
scan('int32 BE', Buffer.prototype.readInt32BE, 4, true);
scan('float32 BE', Buffer.prototype.readFloatBE, 4, false);
scan('float64 BE', Buffer.prototype.readDoubleBE, 8, false);
scan('float32 LE(wide)', Buffer.prototype.readFloatLE, 4, false);
