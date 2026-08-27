'use strict';
// Build test PDPs by injecting the socket's 7 blocks into DR2 (24 items) with
// different subsets of the 5 index bumps applied. Goal: find which index fields
// Raumplan actually needs to LOAD the file.
//   V_full     : all 5 bumps  -> must byte-equal DR1 (sanity)
//   V_noTopo   : count + segment only; SKIP the 3 topology-handle bumps
//   V_countOnly: item-count only
// Michael opens each in Raumplan and reports which load (and render correctly).
const fs = require('fs');
const PDP = 'G:/My Drive/קבצים ללמידת מכונה/PDP/';
const OUT = 'G:/My Drive/claude/ordx-pdp-converter/analysis/out/';
const A = fs.readFileSync(PDP + '2918_Ktchn_TRIO_Nir_DR1.pdp'); // donor of blocks
const B = fs.readFileSync(PDP + '2918_Ktchn_TRIO_Nir_DR2.pdp'); // base
fs.mkdirSync(OUT, { recursive: true });

// 7 inserted blocks: [DR1 offset, length] -> inserted at DR2 position (=DR1off - cumBefore)
const BLOCKS = [[0x514, 173], [0x240d, 168], [0x44ee, 210], [0x68ff, 256], [0x96c0, 291], [0xecc1, 795], [0x13085, 3]];
let cum = 0;
const inserts = BLOCKS.map(([off, len]) => { const at = off - cum; cum += len; return { pos: at, bytes: A.subarray(off, off + len) }; });

// 5 index-bump subs: {pos in DR2, DR1 bytes, tag}
const subs = [
  { pos: 0x11a, bytes: A.subarray(0x11a, 0x11a + 1), tag: 'count' },      // RUN1
  { pos: 0x1566, bytes: A.subarray(0x1613, 0x1613 + 1), tag: 'segments' }, // RUN2
  { pos: 0x3ade, bytes: A.subarray(0x3c33, 0x3c33 + 3), tag: 'topo1' },    // RUN3
  { pos: 0x3c3c, bytes: A.subarray(0x3d91, 0x3d91 + 3), tag: 'topo2' },    // RUN4
  { pos: 0x442a, bytes: A.subarray(0x4651, 0x4651 + 3), tag: 'topo3' },    // RUN5
];

function build(useSubTags) {
  const useSub = subs.filter(s => useSubTags.includes(s.tag));
  // ordered ops over B
  const ops = [
    ...inserts.map(x => ({ kind: 'ins', pos: x.pos, bytes: x.bytes })),
    ...useSub.map(s => ({ kind: 'sub', pos: s.pos, bytes: s.bytes })),
  ].sort((a, b2) => a.pos - b2.pos || (a.kind === 'sub' ? -1 : 1));
  const out = []; let bp = 0;
  for (const op of ops) {
    if (op.pos > bp) { out.push(B.subarray(bp, op.pos)); bp = op.pos; }
    if (op.kind === 'ins') out.push(Buffer.from(op.bytes));
    else { out.push(Buffer.from(op.bytes)); bp += op.bytes.length; } // sub consumes B bytes
  }
  out.push(B.subarray(bp));
  return Buffer.concat(out);
}

const variants = {
  '2918_Vfull':      ['count', 'segments', 'topo1', 'topo2', 'topo3'],
  '2918_VnoTopo':    ['count', 'segments'],
  '2918_VcountOnly': ['count'],
};
for (const [name, tags] of Object.entries(variants)) {
  const buf = build(tags);
  fs.writeFileSync(OUT + name + '.pdp', buf);
  const note = name === '2918_Vfull' ? `  (== DR1? ${buf.length === A.length && buf.equals(A)})` : '';
  console.log(`${name}.pdp  len=${buf.length}  subs=[${tags.join(',')}]${note}`);
}
console.log('\nDR1 len', A.length, ' DR2 len', B.length, ' (diff', A.length - B.length, '= 1896 = 7 blocks)');
console.log('output dir:', OUT);
