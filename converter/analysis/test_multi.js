const fs=require('fs');
const {injectSockets}=require('../src/inject');
const {orientationCode}=require('../src/placement');
const PDP="G:/My Drive/קבצים ללמידת מכונה/PDP/";
const OUT="G:/My Drive/claude/ordx-pdp-converter/analysis/out/";
const DR1=fs.readFileSync(PDP+"2918_Ktchn_TRIO_Nir_DR1.pdp");
const DR2=fs.readFileSync(PDP+"2918_Ktchn_TRIO_Nir_DR2.pdp");
const W={x1:3070,y1:2540,x2:7555,y2:2540},offX=-22876,offY=-9480,WID=160;
const dx=W.x2-W.x1,dy=W.y2-W.y1,L=Math.hypot(dx,dy),ux=dx/L,uy=dy/L;
const place=(along,h)=>{const s=along+WID/2,px=W.x1+s*ux,py=W.y1+s*uy;
  return{x:Math.round(px+offX),y:Math.round(-py+offY),orientation:orientationCode(dx,dy),height:h,width:WID,depth:15,dimHeight:80};};
const places=[place(500,1100),place(2000,1100),place(3500,1100)];
const buf=injectSockets(DR2,DR1,places);
fs.writeFileSync(OUT+"2918_multi3.pdp",buf);

// structural self-check
const MARK=Buffer.from([0xe0,0xe9,0xf0,0xe5,0xe3,0xf8,0xe5]);
let p=0,offs=[];while(true){const i=buf.indexOf(MARK,p);if(i<0)break;offs.push(i-0x28);p=i+1;}
const strides=[...new Set(offs.slice(1).map((o,k)=>o-offs[k]))];
console.log("injected",places.length,"sockets into DR2(24)");
console.log("new len",buf.length,"(DR2",DR2.length,"+",buf.length-DR2.length,"=",places.length,"x 1896 =",places.length*1896,")");
console.log("MEP records:",offs.length,"(expect 27)  strides:",strides.join(','),"(expect 173)");
console.log("item count @0x11a:",buf.readUInt8(0x11a),"(expect 27)");
// segment count: read at 0x1566 base? in DR2 it's at 0x1566; after inject shifted. find via DR2 value + 42
console.log("DR2 seg@0x1566:",DR2.readUInt16LE(0x1566),"-> expect new = +42");
