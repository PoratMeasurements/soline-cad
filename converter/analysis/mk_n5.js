const fs=require('fs');
const tpl='C:/Users/michael sibony/Desktop/בדיקה.pdp';
const out='C:/Users/michael sibony/Desktop/twister-n5_FROM-EMPTY.pdp';
const b=fs.readFileSync(tpl);
const OX=-25692, OY=-14973;
const tx=x=>Math.round(x+OX), ty=y=>Math.round(-y+OY);
const walls=[
  {x1:4130,y1:4480,x2:4130,y2:4150,th:100,h:2771},
  {x1:4130,y1:4150,x2:4732.0,y2:4151.05,th:100,h:2771},
  {x1:4732.0,y1:4151.05,x2:4730.573,y2:4968.049,th:100,h:2771},
];
const offs=[0x1a5,0x1bb,0x1d1];
walls.forEach((w,i)=>{
  const s=offs[i];
  b.writeInt32LE(tx(w.x1),s); b.writeInt32LE(ty(w.y1),s+4);
  b.writeInt32LE(tx(w.x2),s+8); b.writeInt32LE(ty(w.y2),s+12);
  b.writeInt16LE(w.th,s+16); b.writeInt16LE(w.h,s+18);
});
fs.writeFileSync(out,b);
console.log('wrote',out,b.length,'bytes');
offs.forEach((s,i)=>console.log('rec'+(i+1),
  b.readInt32LE(s),b.readInt32LE(s+4),b.readInt32LE(s+8),b.readInt32LE(s+12),
  'th',b.readInt16LE(s+16),'h',b.readInt16LE(s+18)));
