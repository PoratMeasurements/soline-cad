const fs=require('fs');
const A=fs.readFileSync("G:/My Drive/קבצים ללמידת מכונה/PDP/2918_Ktchn_TRIO_Nir_DR1.pdp");
// signature of the socket 2D symbol (start of injected block#1 @0x240d)
const sig=A.subarray(0x240d,0x240d+16);
let p=0,hits=[];
while(true){const i=A.indexOf(sig,p); if(i<0)break; hits.push(i); p=i+1;}
console.log("socket 2D-symbol signature occurrences:",hits.length);
console.log(hits.map(h=>'0x'+h.toString(16)).join(' '));
// are the full 168B blocks byte-identical?
const ref=A.subarray(hits[0],hits[0]+168);
let allEqual=true;
for(const h of hits){ if(!A.subarray(h,h+168).equals(ref)){allEqual=false;break;} }
console.log("all 168B 2D-symbol blocks byte-identical:",allEqual);
// stride between consecutive symbols
console.log("strides:",hits.slice(1).map((h,i)=>h-hits[i]).join(' '));
