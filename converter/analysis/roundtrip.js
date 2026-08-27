const fs=require('fs');
const d="G:/My Drive/קבצים ללמידת מכונה/PDP/";
const A=fs.readFileSync(d+"2918_Ktchn_TRIO_Nir_DR1.pdp"); // target: 25 items
const B=fs.readFileSync(d+"2918_Ktchn_TRIO_Nir_DR2.pdp"); // base:   24 items

// 1) Build an edit script (A relative to B) via resync-based alignment.
//    ops: {type:'copyB',n}  copy n bytes from B
//         {type:'insA',bytes} insert bytes that exist only in A (the socket)
//         {type:'subA',bytes} A-only replacement for same-length B region (index bumps)
const RES=16;
let i=0,j=0,ops=[],copyRun=0;
function flushCopy(){ if(copyRun){ops.push({type:'copyB',n:copyRun}); copyRun=0;} }
while(i<A.length&&j<B.length){
  if(A[i]===B[j]){copyRun++;i++;j++;continue;}
  flushCopy();
  // try pure insertion in A
  let handled=false;
  for(let k=1;k<4000&&!handled;k++){
    let ok=true; for(let t=0;t<RES;t++) if(A[i+k+t]!==B[j+t]){ok=false;break;}
    if(ok){ ops.push({type:'insA',bytes:A.subarray(i,i+k)}); i+=k; handled=true; }
  }
  if(handled) continue;
  // substitution (same-length divergence) then resync
  for(let k=1;k<4000&&!handled;k++){
    let ok=true; for(let t=0;t<RES;t++) if(A[i+k+t]!==B[j+k+t]){ok=false;break;}
    if(ok){ ops.push({type:'subA',bytes:A.subarray(i,i+k)}); i+=k; j+=k; handled=true; }
  }
  if(!handled) break;
}
flushCopy();
if(j<B.length) ops.push({type:'copyB',n:B.length-j});
if(i<A.length) ops.push({type:'insA',bytes:A.subarray(i)});

// 2) Apply edit script to B -> reconstruct A
const out=[]; let bp=0;
for(const op of ops){
  if(op.type==='copyB'){ out.push(B.subarray(bp,bp+op.n)); bp+=op.n; }
  else if(op.type==='insA'){ out.push(Buffer.from(op.bytes)); }
  else if(op.type==='subA'){ out.push(Buffer.from(op.bytes)); bp+=op.bytes.length; }
}
const R=Buffer.concat(out);

// 3) Verify
const identical = R.length===A.length && R.equals(A);
console.log("reconstructed len",R.length,"target(DR1) len",A.length,"| IDENTICAL:",identical);

// 4) Summarize the "socket template" = the insA chunks
const ins=ops.filter(o=>o.type==='insA');
const sub=ops.filter(o=>o.type==='subA');
console.log("socket template: "+ins.length+" inserted blocks totalling "+ins.reduce((s,o)=>s+o.bytes.length,0)+" bytes; "+sub.length+" index-bump substitutions");
