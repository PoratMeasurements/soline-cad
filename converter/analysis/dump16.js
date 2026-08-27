const fs=require('fs');
const buf=fs.readFileSync(process.argv[2]);
const start=parseInt(process.argv[3],16);
const end=parseInt(process.argv[4],16);
function dec(b){ if(b>=0x20&&b<0x7f)return String.fromCharCode(b); if(b>=0xe0&&b<=0xfa)return String.fromCharCode(0x05d0+(b-0xe0)); return '.'; }
for(let r=start;r<end;r+=16){
  let hex='',i16='',txt='';
  for(let c=0;c<16;c++){const i=r+c; if(i>=buf.length)break; hex+=buf[i].toString(16).padStart(2,'0')+(c%2?' ':''); txt+=dec(buf[i]);}
  for(let c=0;c<16;c+=2){const i=r+c; if(i+1>=buf.length)break; i16+=String(buf.readInt16LE(i)).padStart(7);}
  console.log('0x'+r.toString(16).padStart(5,'0'),hex.padEnd(41),'|',i16,'  ',txt);
}
