const fs=require('fs'), path=require('path');
const dir='G:/My Drive/קבצים ללמידת מכונה/PDP';
const files=fs.readdirSync(dir).filter(f=>f.toLowerCase().endsWith('.pdp'));
const inno=Buffer.from([0xe0,0xe9,0xf0,0xe5,0xe3,0xf8,0xe5]);

function detectWallInfo(b){
  // int16 walls: 14-byte records [x1,y1,x2,y2,thick,height,pad]; thick~100, height 1500..4200
  for(let s=0x80;s<0x200;s++){
    let n=0;
    while(true){const o=s+n*14; if(o+12>b.length)break;
      const th=b.readInt16LE(o+8), ht=b.readInt16LE(o+10);
      let ok=th>30&&th<400&&ht>1500&&ht<4200;
      for(let k=0;k<8&&ok;k+=2) if(Math.abs(b.readInt16LE(o+k))>60000) ok=false;
      if(!ok)break; n++;}
    if(n>=3) return {wallOff:s, wallCount:n, afterWalls:s+n*14};
  }
  return null;
}
console.log('file            innoN  wallOff wallN  cntField(val@off)  echoesOfInnoN(first8 offsets)');
for(const f of files){
  const b=fs.readFileSync(path.join(dir,f));
  let p=0,ic=0; while((p=b.indexOf(inno,p))>=0){ic++;p+=1;}
  const wi=detectWallInfo(b);
  let cntField='-';
  if(wi){ const v=b.readInt16LE(wi.afterWalls); cntField=`${v}@0x${wi.afterWalls.toString(16)}`; }
  // find int16==ic occurrences in whole file
  const echoes=[];
  for(let i=0;i+2<=b.length;i++){ if(b.readInt16LE(i)===ic) echoes.push('0x'+i.toString(16)); if(echoes.length>=8)break; }
  console.log(
    f.slice(0,4).padEnd(6),
    String(ic).padStart(4),
    (wi?('0x'+wi.wallOff.toString(16)):'-').padStart(7),
    String(wi?wi.wallCount:'-').padStart(4),
    cntField.padStart(14),
    ' ', echoes.join(' '));
}
