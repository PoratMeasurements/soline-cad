const fs=require('fs');
const D="G:/My Drive/claude/ordx-pdp-converter/analysis/out/";
const V2=fs.readFileSync(D+"2918_VnoTopo V2.pdp");
const FULL=fs.readFileSync(D+"2918_Vfull.pdp");
const MARK=Buffer.from([0xe0,0xe9,0xf0,0xe5,0xe3,0xf8,0xe5]); // אינודרו
function count(buf){let n=0,p=0;while(true){const i=buf.indexOf(MARK,p);if(i<0)break;n++;p=i+1;}return n;}
console.log("Vfull  size",FULL.length,"MEP markers:",count(FULL));
console.log("V2save size",V2.length,"MEP markers:",count(V2));
// compare headers (first 32 bytes) and magic
console.log("\nVfull  head:",FULL.subarray(0,16).toString('hex'));
console.log("V2save head:",V2.subarray(0,16).toString('hex'));
// find FRA-type tail in V2 to see how many + values
const TAIL=Buffer.from([0x09,0xac,0x03,0x59,0x00,0xec,0x04,0x00,0x00,0x0b]);
function fraFields(buf,label){let p=0,rows=[];while(true){const i=buf.indexOf(TAIL,p);if(i<0)break;const f=i-3;rows.push(`${buf[f].toString(16)} ${buf[f+1].toString(16)} ${buf[f+2].toString(16)}`);p=i+1;}console.log(label,"FRA records:",rows.length,"| fields:",rows.join(' , '));}
fraFields(FULL,"Vfull ");
fraFields(V2,"V2save");
