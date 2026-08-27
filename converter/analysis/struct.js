const fs=require('fs');
const buf=fs.readFileSync(process.argv[2]);
const L=buf.length;
console.log('FILE len', L, '0x'+L.toString(16));

// 1) header as int32 LE 0..0xE0
console.log('\n== header int32 LE ==');
for(let i=0;i<0xe0;i+=4){
  const v=buf.readInt32LE(i);
  if(v!==0) console.log('0x'+i.toString(16).padStart(3,'0'),'=',v,'(0x'+(v>>>0).toString(16)+')');
}

// 2) locate wall table & counts around 0xc0..0x122
console.log('\n== 0xc8..0x122 int16 ==');
for(let i=0xc8;i<0x122;i+=2) process.stdout.write(buf.readInt16LE(i)+' ');
console.log();

// 3) find first mesh anchor (ascii 'QUADER'/'FENSTER'/'ZYLINDER') and first item ('אינודרו' e0 e9 f0 e5 e3 f8 e5)
function find(bytes,from=0){ return buf.indexOf(Buffer.from(bytes),from); }
const inno=[0xe0,0xe9,0xf0,0xe5,0xe3,0xf8,0xe5];
console.log('\nfirst אינודרו @0x'+find(inno).toString(16));
console.log('first QUADER  @0x'+(buf.indexOf('QUADER')>=0?buf.indexOf('QUADER').toString(16):'-'));
console.log('first FENSTER @0x'+(buf.indexOf('FENSTER')>=0?buf.indexOf('FENSTER').toString(16):'-'));
console.log('first ZYLINDER@0x'+(buf.indexOf('ZYLINDER')>=0?buf.indexOf('ZYLINDER').toString(16):'-'));
console.log('first Wall(txt)@0x'+(buf.indexOf('Wall')>=0?buf.indexOf('Wall').toString(16):'-'));
console.log('first Mauerd  @0x'+(buf.indexOf('Mauerd')>=0?buf.indexOf('Mauerd').toString(16):'-'));

// 4) all 'אינודרו' occurrences (item record starts)
let p=0,arr=[];
while((p=find(inno,p))>=0){ arr.push(p); p+=1; }
console.log('\nאינודרו count',arr.length,'offsets:',arr.map(o=>'0x'+o.toString(16)).join(' '));

// 5) scan for int32 offsets that equal notable section starts (mesh anchor, filelen)
const mesh = buf.indexOf('QUADER')>=0?buf.indexOf('QUADER'):-1;
const targets=[['filelen',L],['mesh~',mesh]];
for(const [nm,tv] of targets){
  if(tv<0) continue;
  const hits=[];
  for(let i=0;i+4<=L;i++){ const v=buf.readInt32LE(i); if(Math.abs(v-tv)<64){hits.push('0x'+i.toString(16)+'='+v);} }
  console.log(nm,tv,'-> int32LE hits:',hits.slice(0,12).join('  ')||'none');
}
