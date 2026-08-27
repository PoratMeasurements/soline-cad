// ============================================================================
// Soline · Field Survey App — one guided app, start → delivery.
// Generated from the catalog. node gen-app.js → out/app.html (+ app-artifact.html)
// Flow: יציאה → גילוי → מוכנות → שער → מדידה → בקרה → מסירה. All buttons work.
// ============================================================================
"use strict";
const fs = require("fs");
const path = require("path");
const C = require("./src/catalog");
const DATA = JSON.stringify({ parts: C.PARTS, elements: C.ELEMENTS, locate: C.LOCATE, phase: C.PHASE });

const head = `<title>Soline · אפליקציית מדידה</title>
<style>
  :root{ --bg:#0c1420; --bezel:#161e29; --scr:#f4f7fb; --panel:#fff; --panel2:#eef3f9; --line:#dbe3ee; --line2:#c4d0e0;
    --ink:#0e1f36; --ink2:#42567a; --muted:#7688a5; --accent:#0d6fbf; --accent-d:#0a5aa0; --accent-soft:#e6f0fa;
    --go:#0a9d63; --go-soft:#e6f6ef; --warn:#c67c10; --warn-soft:#fbf1e0; --bad:#d23a3f; --bad-soft:#fdecec;
    --mono:ui-monospace,"SF Mono","Consolas",monospace; --sans:ui-sans-serif,system-ui,"Segoe UI","Arial Hebrew",Arial,sans-serif;
    --r:16px; --sh:0 8px 30px -14px rgba(16,40,80,.28); }
  @media(prefers-color-scheme:dark){ :root{ --scr:#0a111d; --panel:#101b2c; --panel2:#16233a; --line:#25344a; --line2:#33475f;
    --ink:#e8effb; --ink2:#b3c4e0; --muted:#8296b6; --accent:#5cc8ff; --accent-d:#3aa0e0; --accent-soft:#12283e;
    --go:#2fce8f; --go-soft:#0f2a20; --warn:#f5b544; --warn-soft:#2a2110; --bad:#ff6b70; --bad-soft:#2c1416; } }
  *{box-sizing:border-box} html,body{height:100%}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased;display:grid;place-items:center;padding:16px}
  .ltr{direction:ltr;unicode-bidi:isolate}.mono{font-family:var(--mono);font-variant-numeric:tabular-nums}
  .tablet{width:min(1200px,100%);aspect-ratio:16/10.6;background:var(--bezel);border-radius:26px;padding:13px;box-shadow:0 40px 90px -35px rgba(0,0,0,.75)}
  .app{width:100%;height:100%;background:var(--scr);border-radius:15px;overflow:hidden;direction:rtl;display:grid;grid-template-rows:auto 1fr auto;position:relative}
  @media(max-width:880px){ body{padding:0} .tablet{aspect-ratio:auto;height:100dvh;border-radius:0;padding:0} .app{border-radius:0} }

  /* header + stepper */
  .hd{display:flex;align-items:center;gap:12px;padding:11px 18px;background:var(--panel);border-bottom:1px solid var(--line)}
  .hd .mk{width:30px;height:30px;border-radius:8px;background:var(--accent);color:#fff;display:grid;place-items:center;font-weight:800}
  .hd .job{font-weight:750;font-size:14px}.hd .job small{display:block;color:var(--muted);font-weight:500;font-size:10.5px;font-family:var(--mono)}
  .stepper{margin-inline-start:auto;display:flex;gap:3px;align-items:center;flex-wrap:wrap}
  .sp{display:flex;align-items:center;gap:7px;padding:5px 10px;border-radius:999px;cursor:pointer;font-size:11.5px;font-weight:650;color:var(--muted);background:transparent;border:1px solid transparent;white-space:nowrap}
  .sp .no{width:19px;height:19px;border-radius:50%;display:grid;place-items:center;font-size:10px;font-weight:800;background:var(--panel2);color:var(--muted);border:1px solid var(--line2)}
  .sp.done{color:var(--go)} .sp.done .no{background:var(--go);color:#fff;border-color:var(--go)}
  .sp.cur{color:var(--ink);background:var(--accent-soft);border-color:var(--accent)} .sp.cur .no{background:var(--accent);color:#fff;border-color:var(--accent)}
  .sp .lb{display:none} @media(min-width:1000px){ .sp .lb{display:inline} }

  /* stage viewport */
  .view{overflow:auto;position:relative}
  .stage{padding:22px clamp(16px,4vw,44px);max-width:920px;margin:0 auto;animation:in .28s ease}
  .stage.wide{max-width:none;padding:0;height:100%}
  @keyframes in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  @media(prefers-reduced-motion:reduce){.stage{animation:none}}
  .eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);display:flex;gap:8px;align-items:center}
  .eyebrow::before{content:"";width:20px;height:1px;background:var(--accent)}
  h1{font-size:clamp(22px,3.4vw,30px);font-weight:800;letter-spacing:-.01em;margin:10px 0 0}
  .lead{color:var(--ink2);font-size:14.5px;margin:8px 0 0;max-width:60ch}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--sh);padding:18px;margin-top:18px}
  .grid{display:grid;gap:12px}.g2{grid-template-columns:1fr 1fr}.g3{grid-template-columns:1fr 1fr 1fr}
  @media(max-width:640px){.g2,.g3{grid-template-columns:1fr}}
  .f label{display:block;font-size:10.5px;color:var(--muted);font-family:var(--mono);margin-bottom:5px}
  .f input,.f select{width:100%;height:46px;border:1px solid var(--line2);background:var(--panel2);border-radius:11px;padding:0 12px;color:var(--ink);font-size:15px;font-family:var(--sans)}
  .f input:focus,.f select:focus{outline:2px solid var(--accent);outline-offset:1px;border-color:var(--accent)}

  /* job cover */
  .cover{display:flex;flex-direction:column;gap:16px}
  .jobcard{background:linear-gradient(135deg,var(--accent-soft),transparent);border:1px solid var(--accent);border-radius:var(--r);padding:22px}
  .jobcard .big{font-size:26px;font-weight:800;margin-top:4px}
  .jmeta{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:16px}
  @media(max-width:640px){.jmeta{grid-template-columns:1fr 1fr}}
  .jmeta .k{font-family:var(--mono);font-size:10px;color:var(--muted);text-transform:uppercase}.jmeta .v{font-weight:700;margin-top:2px}
  .ahead{display:grid;gap:8px}
  .aitem{display:flex;gap:11px;align-items:center;font-size:13.5px;color:var(--ink2)}
  .aitem .n{width:22px;height:22px;border-radius:50%;background:var(--panel2);border:1px solid var(--line2);display:grid;place-items:center;font-size:11px;font-family:var(--mono);color:var(--muted)}

  /* readiness */
  .chk{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;margin-bottom:8px;cursor:pointer;background:var(--panel);transition:border-color .15s}
  .chk:hover{border-color:var(--accent)}
  .chk .bx{width:30px;height:30px;border-radius:9px;border:2px solid var(--line2);display:grid;place-items:center;font-weight:800;flex:0 0 auto}
  .chk.ok .bx{background:var(--go);border-color:var(--go);color:#fff}.chk.bad .bx{background:var(--bad);border-color:var(--bad);color:#fff}.chk.q .bx{border-color:var(--warn);color:var(--warn)}
  .chk .t{font-size:14.5px;font-weight:550}.chk .t small{display:block;color:var(--muted);font-size:11.5px;font-weight:400}
  .chk.req .t::after{content:" ★";color:var(--bad);font-size:11px}
  .prog{height:8px;border-radius:99px;background:var(--panel2);overflow:hidden;margin:4px 0 14px}.prog>i{display:block;height:100%;background:var(--go);border-radius:99px;transition:width .3s}

  /* verdict / gate */
  .verdict{font-family:var(--mono);font-weight:800;padding:16px;border-radius:14px;text-align:center;font-size:16px}
  .verdict.go{color:var(--go);background:var(--go-soft);border:1px solid var(--go)}
  .verdict.nogo{color:var(--bad);background:var(--bad-soft);border:1px solid var(--bad)}
  .gatebtns{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}
  .bigb{border:none;border-radius:16px;padding:26px;font-weight:800;font-size:19px;color:#fff;cursor:pointer;display:flex;flex-direction:column;gap:3px;align-items:center}
  .bigb small{font-weight:500;font-size:12px;opacity:.9}
  .bigb.go{background:var(--go)}.bigb.go:disabled{opacity:.4;cursor:not-allowed}.bigb.nogo{background:var(--bad)}

  /* MEASURE workspace */
  .ws{display:grid;grid-template-columns:1fr 350px;height:100%}
  @media(max-width:880px){.ws{grid-template-columns:1fr}}
  .stagew{position:relative;background:linear-gradient(rgba(20,60,110,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(20,60,110,.045) 1px,transparent 1px);background-size:26px 26px;display:grid;place-items:center;overflow:hidden}
  .stagew svg{width:100%;height:100%;touch-action:none}
  .vtog{position:absolute;inset-block-start:12px;inset-inline-start:12px;display:flex;gap:6px;z-index:3;align-items:center;flex-wrap:wrap}
  .vt{font-size:11.5px;font-weight:700;padding:7px 12px;border-radius:10px;border:1px solid var(--line2);background:var(--panel);cursor:pointer}
  .vt[aria-current="true"]{background:var(--accent);color:#fff;border-color:var(--accent)}
  .placing{position:absolute;inset-block-start:12px;inset-inline-end:12px;z-index:3;background:var(--accent);color:#fff;font-size:12px;font-weight:700;padding:9px 13px;border-radius:11px;box-shadow:var(--sh)}
  .wshint{position:absolute;inset-block-end:10px;inset-inline-start:14px;font-size:11px;color:var(--muted);font-family:var(--mono)}
  .tools{background:var(--panel);border-inline-start:1px solid var(--line);display:flex;flex-direction:column;min-height:0}
  .ttabs{display:flex;gap:4px;padding:10px;border-bottom:1px solid var(--line)}
  .ttab{flex:1;padding:10px 6px;border-radius:11px;border:1px solid var(--line);background:var(--panel2);font-size:12.5px;font-weight:700;cursor:pointer;display:flex;flex-direction:column;gap:3px;align-items:center}
  .ttab[aria-current="true"]{background:var(--accent);color:#fff;border-color:var(--accent)}
  .ttab .i{font-size:16px}
  .tbody{padding:14px;overflow:auto;flex:1}
  .parts{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px}
  .pbtn{font-size:11.5px;font-weight:650;padding:7px 9px;border-radius:9px;border:1px solid var(--line);background:var(--panel2);cursor:pointer}
  .pbtn[aria-current="true"]{border-color:var(--accent);color:var(--accent)}
  .grp{font-size:10px;font-family:var(--mono);color:var(--muted);text-transform:uppercase;margin:10px 0 5px;border-bottom:1px solid var(--line);padding-bottom:4px}
  .chips2{display:flex;flex-wrap:wrap;gap:5px}
  .ec{font-size:12px;font-weight:600;padding:7px 10px;border-radius:9px;border:1px solid var(--line);background:var(--panel);cursor:pointer;display:inline-flex;gap:6px;align-items:center}
  .ec:hover{border-color:var(--accent)}.ec[aria-current="true"]{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent-soft)}
  .ec .d{width:8px;height:8px;border-radius:50%}
  .locate{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:10px;font-size:12px;color:var(--ink2);margin:10px 0}.locate b{color:var(--accent)}
  .wallrow{display:grid;grid-template-columns:auto 1fr 1fr auto;gap:7px;align-items:end;margin-bottom:7px}
  .wallrow .lbl{font-family:var(--mono);font-size:11px;color:var(--muted);padding-bottom:13px}.wallrow .del{border:none;background:transparent;color:var(--bad);cursor:pointer;font-size:17px;padding-bottom:10px}
  .item{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:9px 11px;margin-bottom:7px}
  .item .dot{width:11px;height:11px;border-radius:50%}.item .t{font-weight:640;font-size:12.5px}.item .m{font-family:var(--mono);font-size:10px;color:var(--muted)}
  .item .rm{border:none;background:transparent;color:var(--muted);cursor:pointer;font-size:17px}
  .check{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:baseline;font-size:13.5px;padding:11px 13px;border:1px solid var(--line);border-radius:11px;margin-bottom:8px;background:var(--panel)}
  .check.ok{border-color:#cdeadd}.check.ok .mk{color:var(--go)}.check.bad{border-color:#f3c9c9;background:var(--bad-soft)}.check.bad .mk{color:var(--bad)}.check .mk{font-weight:800}

  /* delivery */
  .pkg{display:grid;grid-template-columns:1fr 300px;gap:16px}@media(max-width:760px){.pkg{grid-template-columns:1fr}}
  .thumb{background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:10px;display:grid;place-items:center}.thumb svg{width:100%;height:auto;max-height:280px}
  .sumrow{display:flex;justify-content:space-between;font-size:13.5px;padding:8px 0;border-bottom:1px solid var(--line)}.sumrow:last-child{border:0}.sumrow b{font-weight:700}
  .dlbtn{display:flex;align-items:center;gap:10px;width:100%;border:1px solid var(--line2);background:var(--panel);border-radius:12px;padding:14px;font-weight:700;font-size:14px;cursor:pointer;margin-top:8px;color:var(--ink)}
  .dlbtn .i{width:34px;height:34px;border-radius:9px;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;font-weight:800}
  .done{text-align:center;padding:36px 20px}.done .big{width:78px;height:78px;border-radius:50%;background:var(--go);color:#fff;display:grid;place-items:center;font-size:38px;margin:0 auto 16px}

  /* bottom bar */
  .bar{display:flex;align-items:center;gap:12px;padding:12px 18px;background:var(--panel);border-top:1px solid var(--line)}
  .bar .sp1{margin-inline-start:auto}
  .btn{border:none;border-radius:13px;padding:14px 22px;font-weight:800;font-size:14.5px;background:var(--accent);color:#fff;cursor:pointer;font-family:var(--sans)}
  .btn:hover{background:var(--accent-d)} .btn:disabled{opacity:.4;cursor:not-allowed}
  .btn.sec{background:transparent;border:1px solid var(--line2);color:var(--ink)} .btn.go{background:var(--go)}
  .btn.block{width:100%}

  /* toast */
  .toast{position:absolute;inset-block-end:78px;inset-inline:0;margin:auto;width:max-content;max-width:80%;background:var(--ink);color:var(--scr);padding:11px 18px;border-radius:12px;font-size:13.5px;font-weight:600;opacity:0;transform:translateY(10px);transition:.25s;pointer-events:none;z-index:20}
  .toast.show{opacity:1;transform:none}
  .empty{color:var(--muted);font-size:13px;text-align:center;padding:22px}
</style>`;

const body = `<div class="tablet"><div class="app">
  <div class="hd">
    <div class="mk">S</div>
    <div class="job" id="jobHd"></div>
    <div class="stepper" id="stepper"></div>
  </div>
  <div class="view" id="view"></div>
  <div class="bar" id="bar"></div>
  <div class="toast" id="toast"></div>
</div></div>
<script>
var DB=${DATA};var D2R=Math.PI/180;
var STAGES=[
  {id:"start",t:"יציאה"},{id:"discovery",t:"גילוי"},{id:"readiness",t:"מוכנות"},{id:"gate",t:"שער"},
  {id:"measure",t:"מדידה"},{id:"controls",t:"בקרה"},{id:"delivery",t:"מסירה"}
];
var st=load()||{
  cur:0, done:[],
  job:{client:"אושרת ינקו",address:"רוטשילד 22, קומה 13",vertical:"שיש",type:"משטח מטבח"},
  discovery:{type:"משטח מטבח · אבן קיסר",plans:"כן (2 קבצים)",risks:"קומה 13, גישה מוגבלת"},
  readiness:[
    {t:"רצפה נגישה ומדידה",req:true,s:1},{t:"תקרה נגישה",req:true,s:1},{t:"קירות נגישים",req:true,s:1},
    {t:"תאורה/חשמל למכשיר",req:true,s:1},{t:"אתר בטוח ומפונה",req:true,s:1},{t:"תוכניות זמינות",req:true,s:1},
    {t:"ארונות מותקנים ומפולסים",req:true,s:1},{t:"מיקומי חיתוך ידועים",req:false,s:2}
  ], gate:null,
  walls:[{id:"W1",length:3620,angle:90},{id:"W2",length:2400,angle:90},{id:"W3",length:3620,angle:90},{id:"W4",length:2400,angle:90}],
  height:2743, placements:[],
  tool:"room", view:"plan", elevWall:"W1", part:1, el:null
};
st.placing=null;st.drag=null;
function save(){try{var c={};for(var k in st)if(k!="placing"&&k!="drag")c[k]=st[k];localStorage.setItem("soline-survey",JSON.stringify(c));}catch(e){}}
function load(){try{var s=localStorage.getItem("soline-survey");return s?JSON.parse(s):null;}catch(e){return null;}}
function toast(m){var t=document.getElementById('toast');t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(function(){t.classList.remove('show');},1600);}

function LC(l){var p=(l||"").split("-")[0];if(l=="WALL")return "#0e1f36";if(p=="ELEC")return "#c9a227";if(p=="LIGHT")return "#e0952a";if(p=="PLUMB"||l=="GAS"||l=="SANITARY")return "#0aa5c8";if(p=="DOOR"||l=="WINDOW"||l=="SHUTTER"||l=="SILL")return "#0a9d63";if(p=="HVAC")return "#b23ec8";return "#7688a5";}
function clamp(x,mx){return Math.max(0,Math.min(mx,x||0));}

/* ---- geometry (traverse) ---- */
function geo(){var vs=[[0,0]],p=[0,0],b=0,n=st.walls.length;for(var i=0;i<n;i++){var L=st.walls[i].length,r=b*D2R;p=[p[0]+L*Math.cos(r),p[1]+L*Math.sin(r)];if(i<n-1)vs.push([p[0],p[1]]);b+=180-st.walls[i].angle;}
  var cl=Math.hypot(p[0]-vs[0][0],p[1]-vs[0][1]);var segs=st.walls.map(function(w,i){var a=vs[i],c=vs[(i+1)%vs.length];var L=Math.hypot(c[0]-a[0],c[1]-a[1])||1;return{id:w.id,a:a,b:c,dir:[(c[0]-a[0])/L,(c[1]-a[1])/L],len:L};});
  var area=0;for(var i=0;i<vs.length;i++){var a=vs[i],c=vs[(i+1)%vs.length];area+=a[0]*c[1]-c[0]*a[1];}area=Math.abs(area)/2;
  return{vs:vs,segs:segs,closure:cl,angleSum:st.walls.reduce(function(s,w){return s+w.angle;},0),area:area,close:p};}
function seg(id){return geo().segs.find(function(s){return s.id==id;});}
function resolvePts(p){var out=[];var s=p.wallId?seg(p.wallId):null;var on=function(o){return[s.a[0]+s.dir[0]*o,s.a[1]+s.dir[1]*o];};
  if(p.locateBy=="point"){if(s)out.push(on(clamp(p.offset,s.len)));else if(p.cx!=null)out.push([p.cx,p.cy]);}
  else if(p.locateBy=="array"){if(s){var n=p.count||3;for(var i=0;i<n;i++)out.push(on(clamp((p.offset||0)+i*(p.spacing||71),s.len)));}}
  else if(p.locateBy=="span"){if(s)out.push(on(p.offset||0),on(clamp((p.offset||0)+(p.width||600),s.len)));else if(p.cx!=null)out.push([p.cx,p.cy],[p.cx+(p.width||600),p.cy]);}
  else if(p.locateBy=="opening"){if(s)out.push(on(p.offset||0),on(clamp((p.offset||0)+(p.width||800),s.len)));}
  else if(p.locateBy=="area"){if(p.cx!=null)out.push([p.cx,p.cy]);else if(s)out.push(on(clamp(p.offset||s.len/2,s.len)));}return out;}

/* ---- drawing (shared) ---- */
var _M=0,_minX=0,_maxY=0,_svg=null;
function drawInto(svg){_svg=svg;if(st.view=="elevation")return drawElev(svg);
  var g=geo();var xs=g.vs.map(function(v){return v[0];}).concat([g.close[0]]),ys=g.vs.map(function(v){return v[1];}).concat([g.close[1]]);
  var minX=Math.min.apply(0,xs),maxX=Math.max.apply(0,xs),minY=Math.min.apply(0,ys),maxY=Math.max.apply(0,ys);
  var M=Math.max(600,(maxX-minX)*0.14);_M=M;_minX=minX;_maxY=maxY;var W=(maxX-minX)+2*M,H=(maxY-minY)+2*M;var mp=function(pt){return[pt[0]-minX+M,maxY-pt[1]+M];};
  var s='<polygon points="'+g.vs.map(function(p){var q=mp(p);return q[0]+','+q[1];}).join(' ')+'" fill="rgba(13,111,191,.05)"/>';
  g.segs.forEach(function(sg){var a=mp(sg.a),b=mp(sg.b);s+='<line x1="'+a[0]+'" y1="'+a[1]+'" x2="'+b[0]+'" y2="'+b[1]+'" stroke="#0e1f36" stroke-width="26" stroke-linecap="round"/>';var md=[(a[0]+b[0])/2,(a[1]+b[1])/2];s+='<text x="'+md[0]+'" y="'+(md[1]-28)+'" text-anchor="middle" font-size="112" font-family="monospace" fill="#0d6fbf">'+Math.round(sg.len)+'</text>';s+='<text x="'+a[0]+'" y="'+a[1]+'" dx="22" dy="122" font-size="86" font-family="monospace" fill="#7688a5">'+sg.id+'</text>';});
  if(g.closure>5){var a=mp(g.vs[0]),b=mp(g.close);s+='<line x1="'+a[0]+'" y1="'+a[1]+'" x2="'+b[0]+'" y2="'+b[1]+'" stroke="#d23a3f" stroke-width="20" stroke-dasharray="46 26"/><text x="'+((a[0]+b[0])/2)+'" y="'+((a[1]+b[1])/2-28)+'" text-anchor="middle" font-size="118" fill="#d23a3f">פער '+Math.round(g.closure)+'</text>';}
  st.placements.forEach(function(p,i){var pts=resolvePts(p).map(mp);var col=LC(p.layer);s+='<g data-pi="'+i+'" style="cursor:grab">';
    if((p.locateBy=="span"||p.locateBy=="opening")&&pts.length>1)s+='<line x1="'+pts[0][0]+'" y1="'+pts[0][1]+'" x2="'+pts[1][0]+'" y2="'+pts[1][1]+'" stroke="'+col+'" stroke-width="36"/>';
    else pts.forEach(function(q){s+='<circle cx="'+q[0]+'" cy="'+q[1]+'" r="92" fill="#fff" stroke="'+col+'" stroke-width="18"/><line x1="'+(q[0]-64)+'" y1="'+q[1]+'" x2="'+(q[0]+64)+'" y2="'+q[1]+'" stroke="'+col+'" stroke-width="13"/><line x1="'+q[0]+'" y1="'+(q[1]-64)+'" x2="'+q[0]+'" y2="'+(q[1]+64)+'" stroke="'+col+'" stroke-width="13"/>';});
    s+='</g>';});
  svg.setAttribute('viewBox','0 0 '+Math.round(W)+' '+Math.round(H));svg.innerHTML=s;}
function drawElev(svg){var wl=seg(st.elevWall);if(!wl){svg.innerHTML='';return;}var L=wl.len,Hh=st.height,M=500;_M=M;_minX=0;_maxY=Hh;var W=L+2*M,H=Hh+2*M;var mp=function(x,z){return[x+M,Hh-z+M];};
  var s='<line x1="'+mp(-200,0)[0]+'" y1="'+mp(-200,0)[1]+'" x2="'+mp(L+200,0)[0]+'" y2="'+mp(L+200,0)[1]+'" stroke="#0e1f36" stroke-width="14"/>';
  s+='<polygon points="'+[mp(0,0),mp(L,0),mp(L,Hh),mp(0,Hh)].map(function(p){return p[0]+','+p[1];}).join(' ')+'" fill="rgba(13,111,191,.05)" stroke="#0e1f36" stroke-width="16"/>';
  s+='<text x="'+mp(L/2,Hh)[0]+'" y="'+(mp(L/2,Hh)[1]-38)+'" text-anchor="middle" font-size="118" font-family="monospace" fill="#7688a5">קיר '+st.elevWall+' · '+Math.round(L)+'×'+Hh+'</text>';
  st.placements.filter(function(p){return p.wallId==st.elevWall;}).forEach(function(p){var col=LC(p.layer);var h=p.height!=null?p.height:900;
    if(p.locateBy=="opening"){var x1=p.offset||0,x2=x1+(p.width||800),sill=p.sill||0,top=sill+(p.height||1000);s+='<polygon points="'+[mp(x1,sill),mp(x2,sill),mp(x2,top),mp(x1,top)].map(function(q){return q[0]+','+q[1];}).join(' ')+'" fill="none" stroke="'+col+'" stroke-width="20"/>';}
    else{var q=mp(p.offset||0,h),f=mp(p.offset||0,0);s+='<line x1="'+q[0]+'" y1="'+q[1]+'" x2="'+f[0]+'" y2="'+f[1]+'" stroke="#0d6fbf" stroke-width="5" stroke-dasharray="18 12"/><circle cx="'+q[0]+'" cy="'+q[1]+'" r="86" fill="#fff" stroke="'+col+'" stroke-width="18"/><text x="'+q[0]+'" y="'+(f[1]-18)+'" text-anchor="middle" font-size="90" font-family="monospace" fill="#0d6fbf">'+h+'</text>';}});
  svg.setAttribute('viewBox','0 0 '+Math.round(W)+' '+Math.round(H));svg.innerHTML=s;}
function world(evt){var pt=_svg.createSVGPoint();pt.x=evt.clientX;pt.y=evt.clientY;var u=pt.matrixTransform(_svg.getScreenCTM().inverse());return[u.x-_M+_minX,_maxY-(u.y-_M)];}
function projectWall(w){var best=null;geo().segs.forEach(function(s){var vx=w[0]-s.a[0],vy=w[1]-s.a[1];var t=clamp(vx*s.dir[0]+vy*s.dir[1],s.len);var px=s.a[0]+s.dir[0]*t,py=s.a[1]+s.dir[1]*t;var d=Math.hypot(w[0]-px,w[1]-py);if(!best||d<best.d)best={id:s.id,offset:t,d:d};});return best;}

/* ---- gate / controls ---- */
function gate(){var b=st.readiness.filter(function(it){return it.req&&it.s==0;}).map(function(it){return it.t;});var u=st.readiness.filter(function(it){return it.req&&it.s==2;}).map(function(it){return it.t+" (לא הוכרע)";});var all=b.concat(u);return{go:all.length==0,blockers:all};}
function controls(){var g=geo(),checks=[],n=st.walls.length;
  checks.push({ok:g.closure<=5,msg:g.closure<=5?"סגירת מתאר: פער "+g.closure.toFixed(1)+" מ״מ ✓":"סגירת מתאר: פער "+Math.round(g.closure)+" מ״מ — בדוק אורכים/זוויות."});
  var exp=(n-2)*180,ae=Math.abs(g.angleSum-exp);checks.push({ok:ae<=n,msg:ae<=n?"סכום זוויות: "+g.angleSum+"° מול "+exp+"° ✓":"סכום זוויות "+g.angleSum+"° במקום "+exp+"°."});
  var fb=0;st.placements.forEach(function(p){if(p.wallId){var L=seg(p.wallId).len;var end=(p.offset||0)+(p.width||0)+(p.locateBy=="array"?((p.count||1)-1)*(p.spacing||71):0);if((p.offset||0)<0||end>L+2)fb++;}if(p.height!=null&&p.height>st.height)fb++;});
  checks.push({ok:fb==0,msg:fb==0?"התאמת אלמנטים: כולם בתוך הקירות/הגובה ✓":fb+" אלמנטים חורגים."});
  checks.push({ok:st.placements.length>0,msg:st.placements.length>0?"שלמות: "+st.placements.length+" אלמנטים ✓":"לא נמדדו אלמנטים."});
  var fails=checks.filter(function(c){return !c.ok;}).length;return{go:fails==0,fails:fails,checks:checks};}

/* ================= ROUTER ================= */
function go(i){ if(i<0||i>=STAGES.length)return; st.cur=i; if(st.done.indexOf(i)<0){} save(); render(); }
function complete(i){ if(st.done.indexOf(i)<0)st.done.push(i); }
function render(){ document.getElementById('jobHd').innerHTML=st.job.client+"<small>"+st.job.address+"</small>";
  stepper(); var v=document.getElementById('view'); var s=STAGES[st.cur].id;
  v.innerHTML='<div class="stage'+(s=="measure"?' wide':'')+'" id="stg"></div>';
  var st1=document.getElementById('stg'); st1.innerHTML=SCREEN[s]().html; bar(s); if(SCREEN[s]().wire)SCREEN[s]().wire(); }
function stepper(){document.getElementById('stepper').innerHTML=STAGES.map(function(x,i){var cls=i==st.cur?'cur':(st.done.indexOf(i)>=0?'done':'');
  return '<button class="sp '+cls+'" data-i="'+i+'"><span class="no">'+(st.done.indexOf(i)>=0&&i!=st.cur?'✓':(i+1))+'</span><span class="lb">'+x.t+'</span></button>';}).join('');
  document.querySelectorAll('.sp').forEach(function(b){b.onclick=function(){go(+b.dataset.i);};});}
function bar(s){var B=document.getElementById('bar');var back=st.cur>0?'<button class="btn sec" onclick="go('+(st.cur-1)+')">← חזור</button>':'';
  var next='';
  if(s=="start")next='<button class="btn" onclick="complete('+st.cur+');go(1)">התחל מדידה ←</button>';
  else if(s=="gate"){var r=gate();next='<button class="btn go" '+(st.gate=="GO"?'':'disabled')+' onclick="complete('+st.cur+');go(4)">המשך למדידה ←</button>';}
  else if(s=="measure")next='<button class="btn" onclick="complete('+st.cur+');go(5)">המשך לבקרה ←</button>';
  else if(s=="controls"){var r=controls();next='<button class="btn go" '+(r.go?'':'disabled')+' onclick="complete('+st.cur+');go(6)">המשך למסירה ←</button>';}
  else if(s=="delivery")next='';
  else next='<button class="btn" onclick="complete('+st.cur+');go('+(st.cur+1)+')">המשך ←</button>';
  B.innerHTML=back+'<span class="sp1"></span>'+next;}

/* ================= SCREENS ================= */
var SCREEN={
 start:function(){return{html:
   '<div class="eyebrow">שלב 1 · יציאה למדידה</div><h1>מוכן לצאת לשטח</h1><p class="lead">עבור על פרטי העבודה. בסיום המדידה תקבל חבילת מסירה מוכנה לנגר.</p>'+
   '<div class="cover"><div class="jobcard"><div class="eyebrow" style="color:var(--accent)">עבודה</div><div class="big">'+st.job.client+'</div>'+
   '<div class="jmeta"><div><div class="k">כתובת</div><div class="v">'+st.job.address+'</div></div><div><div class="k">תחום</div><div class="v">'+st.job.vertical+'</div></div><div><div class="k">סוג</div><div class="v">'+st.job.type+'</div></div><div><div class="k">טולרנס</div><div class="v mono">±1.5 מ״מ</div></div></div></div>'+
   '<div class="card"><div class="grp">מה לפניך</div><div class="ahead">'+
   ['גילוי — הבנת הפרויקט והסיכונים','מוכנות — בדיקת תנאי השטח','שער GO/NO-GO — החלטה אם למדוד','מדידה — חדר ואלמנטים','בקרה — אימות שאין טעויות','מסירה — חבילת DXF לנגר'].map(function(t,i){return '<div class="aitem"><span class="n">'+(i+1)+'</span>'+t+'</div>';}).join('')+
   '</div></div></div>'};},

 discovery:function(){return{html:
   '<div class="eyebrow">שלב 2 · גילוי</div><h1>הבנת הפרויקט</h1><p class="lead">אסוף את מה שרלוונטי לבנייה — מובנה, לא זריקת נתונים.</p>'+
   '<div class="card"><div class="grid"><div class="f"><label>סוג פרויקט</label><input id="d_type" value="'+st.discovery.type+'"></div><div class="f"><label>תוכניות</label><input id="d_plans" value="'+st.discovery.plans+'"></div><div class="f"><label>סיכונים / הערות</label><input id="d_risks" value="'+st.discovery.risks+'"></div></div></div>',
   wire:function(){['d_type','d_plans','d_risks'].forEach(function(id){var e=document.getElementById(id);e.oninput=function(){st.discovery={type:val('d_type'),plans:val('d_plans'),risks:val('d_risks')};save();};});}};},

 readiness:function(){var okc=st.readiness.filter(function(i){return i.s==1;}).length;return{html:
   '<div class="eyebrow">שלב 3 · מוכנות</div><h1>בדיקת תנאי השטח</h1><p class="lead">הקש על פריט לסימון: תקין → חוסם → לא רלוונטי. פריטי חובה מסומנים ★.</p>'+
   '<div class="prog"><i style="width:'+Math.round(okc/st.readiness.length*100)+'%"></i></div>'+
   '<div class="card">'+st.readiness.map(function(it,i){return '<div class="chk '+(it.s==1?'ok':it.s==0?'bad':'q')+(it.req?' req':'')+'" data-i="'+i+'"><span class="bx">'+(it.s==1?'✓':it.s==0?'✕':'?')+'</span><span class="t">'+it.t+'</span></div>';}).join('')+'</div>',
   wire:function(){document.querySelectorAll('.chk').forEach(function(b){b.onclick=function(){var i=+b.dataset.i;st.readiness[i].s=(st.readiness[i].s+2)%3;save();render();};});}};},

 gate:function(){var r=gate();return{html:
   '<div class="eyebrow">שלב 4 · שער GO / NO-GO</div><h1>החלטה: למדוד או לא</h1><p class="lead">מדידה על תשתית לא מוכנה = לוח שגוי. הכרע לפי המוכנות.</p>'+
   '<div class="card"><div class="verdict '+(r.go?'go':'nogo')+'">'+(r.go?'✓ מוכן — אפשר GO':'⛔ יש חוסמים')+'</div>'+
   (r.blockers.length?'<div class="locate">חוסמים פתוחים: '+r.blockers.join(' · ')+'</div>':'')+
   '<div class="gatebtns"><button class="bigb go" id="gGo" '+(r.go?'':'disabled')+'>GO<small>המשך למדידה</small></button><button class="bigb nogo" id="gNo">NO-GO<small>חזור למוכנות</small></button></div></div>',
   wire:function(){var g=document.getElementById('gGo');if(g)g.onclick=function(){st.gate="GO";save();toast("שער: GO");complete(3);go(4);};document.getElementById('gNo').onclick=function(){st.gate="NO_GO";save();toast("שער: NO-GO");go(2);};}};},

 measure:function(){return{html:
   '<div class="ws"><div class="stagew"><div class="vtog"><button class="vt" data-view="plan" aria-current="'+(st.view=="plan")+'">מבט על</button><button class="vt" data-view="elevation" aria-current="'+(st.view=="elevation")+'">חזית</button><select class="vt" id="elevWall" style="'+(st.view=="elevation"?'':'display:none')+'"></select></div>'+
   '<div class="placing" id="placing" style="'+(st.placing?'':'display:none')+'">מצב הנחה — הקש על השרטוט</div>'+
   '<svg id="draw" preserveAspectRatio="xMidYMid meet"></svg><div class="wshint">גרור אלמנט להזיז · snap לקיר</div></div>'+
   '<div class="tools"><div class="ttabs">'+[['room','📐','חדר'],['elements','🧰','אלמנטים'],['measure','📝','מדידות']].map(function(t){return '<button class="ttab" data-tool="'+t[0]+'" aria-current="'+(st.tool==t[0])+'"><span class="i">'+t[1]+'</span>'+t[2]+'</button>';}).join('')+'</div><div class="tbody" id="tbody"></div></div></div>',
   wire:function(){var svg=document.getElementById('draw');drawInto(svg);
     svg.addEventListener('pointerdown',function(evt){if(st.view!="plan")return;var g=evt.target.closest('[data-pi]');if(g){st.drag={i:+g.getAttribute('data-pi')};svg.setPointerCapture(evt.pointerId);return;}if(st.placing){var w=world(evt);var p=st.placing;if(p.host=="wall"){var pr=projectWall(w);p.wallId=pr.id;p.offset=Math.round(pr.offset);if(p.height==null)p.height=900;}else{p.cx=Math.round(w[0]);p.cy=Math.round(w[1]);}st.placements.push(p);st.placing=null;document.getElementById('placing').style.display='none';drawInto(svg);toolBody();save();toast("אלמנט הונח");}});
     svg.addEventListener('pointermove',function(evt){if(!st.drag||st.view!="plan")return;var p=st.placements[st.drag.i];var w=world(evt);if(p.host=="wall"||p.wallId){var pr=projectWall(w);p.wallId=pr.id;p.offset=Math.round(pr.offset);}else{p.cx=Math.round(w[0]);p.cy=Math.round(w[1]);}drawInto(svg);});
     svg.addEventListener('pointerup',function(){if(st.drag){st.drag=null;save();}});
     document.querySelectorAll('.vt[data-view]').forEach(function(b){b.onclick=function(){st.view=b.dataset.view;document.querySelectorAll('.vt[data-view]').forEach(function(x){x.setAttribute('aria-current',x.dataset.view==st.view);});var sel=document.getElementById('elevWall');sel.style.display=st.view=="elevation"?'inline-block':'none';if(st.view=="elevation"){sel.innerHTML=st.walls.map(function(w){return '<option>'+w.id+'</option>';}).join('');sel.value=st.elevWall;}drawInto(svg);};});
     document.getElementById('elevWall').onchange=function(e){st.elevWall=e.target.value;drawInto(svg);};
     document.querySelectorAll('.ttab').forEach(function(b){b.onclick=function(){st.tool=b.dataset.tool;document.querySelectorAll('.ttab').forEach(function(x){x.setAttribute('aria-current',x.dataset.tool==st.tool);});toolBody();};});
     toolBody();}};},

 controls:function(){var r=controls();return{html:
   '<div class="eyebrow">שלב 6 · בקרה</div><h1>אימות — שלא תהיה טעות</h1><p class="lead">הבקרות תופסות טעות לפני שהיא הופכת ללוח חתוך לא נכון.</p>'+
   '<div class="card"><div class="verdict '+(r.go?'go':'nogo')+'">'+(r.go?'✓ GO — כל הבקרות עברו':'✗ NO-GO — '+r.fails+' בקרות נכשלו')+'</div>'+
   r.checks.map(function(c){return '<div class="check '+(c.ok?'ok':'bad')+'"><span class="mk">'+(c.ok?'✓':'✗')+'</span><span>'+c.msg+'</span></div>';}).join('')+'</div>'};},

 delivery:function(){var g=geo();var r=controls();return{html:st._delivered?
   '<div class="done"><div class="big">✓</div><h1>נמסר לנגר</h1><p class="lead" style="margin-inline:auto">חבילת המדידה של '+st.job.client+' נשלחה. '+st.placements.length+' אלמנטים · '+(g.area/1e6).toFixed(2)+' מ״ר.</p><button class="btn" style="margin-top:18px" onclick="resetAll()">התחל עבודה חדשה</button></div>'
   :
   '<div class="eyebrow">שלב 7 · מסירה</div><h1>חבילת מסירה לנגר</h1><p class="lead">הכל מאומת. הורד את הקבצים ומסור.</p>'+
   '<div class="pkg"><div class="card"><div class="grp">מבט על</div><div class="thumb" id="thumb"></div></div>'+
   '<div><div class="card"><div class="grp">סיכום</div>'+
   '<div class="sumrow"><span>לקוח</span><b>'+st.job.client+'</b></div><div class="sumrow"><span>אלמנטים</span><b>'+st.placements.length+'</b></div><div class="sumrow"><span>שטח</span><b>'+(g.area/1e6).toFixed(2)+' מ״ר</b></div><div class="sumrow"><span>מתאר</span><b style="color:var(--go)">'+(g.closure<=5?'נסגר ✓':'פער '+Math.round(g.closure))+'</b></div><div class="sumrow"><span>בקרה</span><b style="color:'+(r.go?'var(--go)':'var(--bad)')+'">'+(r.go?'GO':'NO-GO')+'</b></div></div>'+
   '<div class="card"><div class="grp">קבצים</div><button class="dlbtn" id="dxf"><span class="i">DXF</span><div style="text-align:start"><div>שרטוט ליצרן</div><div class="m mono" style="color:var(--muted);font-size:11px">מ״מ · שכבות · סמלים</div></div></button><button class="dlbtn" id="csv"><span class="i">CSV</span><div style="text-align:start">רשימת אלמנטים</div></button></div>'+
   '<button class="btn go block" id="deliver" style="margin-top:12px">✓ סיים ומסור לנגר</button></div></div>',
   wire:function(){if(st._delivered)return;var t=document.getElementById('thumb');if(t){var s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('preserveAspectRatio','xMidYMid meet');t.appendChild(s);var pv=st.view;st.view='plan';drawInto(s);st.view=pv;}
     document.getElementById('dxf').onclick=exportDXF;document.getElementById('csv').onclick=exportCSV;
     document.getElementById('deliver').onclick=function(){st._delivered=true;complete(6);save();toast("נמסר ✓");render();};}};}
};

/* ---- measure tool bodies ---- */
function toolBody(){var el=document.getElementById('tbody');if(!el)return;
  if(st.tool=="room"){el.innerHTML=st.walls.map(function(w,i){return '<div class="wallrow"><span class="lbl">'+w.id+'</span><div class="f"><label>אורך</label><input class="wLen" data-i="'+i+'" value="'+w.length+'" inputmode="numeric"></div><div class="f"><label>זווית °</label><input class="wAng" data-i="'+i+'" value="'+w.angle+'" inputmode="numeric"></div><button class="del" data-i="'+i+'" '+(st.walls.length<=3?'style="opacity:.3"':'')+'>×</button></div>';}).join('')+
    '<div class="grid g2"><button class="btn sec" id="addWall">+ קיר</button><div class="f"><label>גובה קיר</label><input id="rH" value="'+st.height+'" inputmode="numeric"></div></div><div class="locate">שנה אורך/זווית → השרטוט מתעדכן. 135° = פינה קטומה.</div>';
    document.querySelectorAll('.wLen').forEach(function(x){x.oninput=function(){st.walls[+x.dataset.i].length=parseFloat(x.value)||st.walls[+x.dataset.i].length;redraw();};});
    document.querySelectorAll('.wAng').forEach(function(x){x.oninput=function(){st.walls[+x.dataset.i].angle=parseFloat(x.value)||st.walls[+x.dataset.i].angle;redraw();};});
    var rh=document.getElementById('rH');rh.oninput=function(){st.height=parseFloat(rh.value)||st.height;save();};
    document.querySelectorAll('.del').forEach(function(b){b.onclick=function(){if(st.walls.length>3){st.walls.splice(+b.dataset.i,1);reId();redraw();toolBody();}};});
    document.getElementById('addWall').onclick=function(){st.walls.push({id:"W"+(st.walls.length+1),length:1000,angle:90});reId();redraw();toolBody();};}
  else if(st.tool=="elements"){var els=DB.elements.filter(function(e){return e.part==st.part;}),groups={};els.forEach(function(e){(groups[e.group]=groups[e.group]||[]).push(e);});
    var h='<div class="parts">'+DB.parts.map(function(p){return '<button class="pbtn" data-part="'+p.id+'" aria-current="'+(p.id==st.part)+'">'+p.icon+' '+p.name.split(',')[0]+'</button>';}).join('')+'</div>';
    h+=Object.keys(groups).map(function(gr){return '<div class="grp">'+gr+'</div><div class="chips2">'+groups[gr].map(function(e){return '<button class="ec" data-el="'+e.id+'" aria-current="'+(st.el==e.id)+'"><span class="d" style="background:'+LC(e.layer)+'"></span>'+e.nameHe+'</button>';}).join('')+'</div>';}).join('');
    var e=DB.elements.find(function(x){return x.id==st.el;});
    if(e)h+='<div class="locate">📍 <b>'+e.nameHe+'</b> · '+DB.locate[e.locateBy]+'</div>'+placeForm(e)+'<div class="grid g2"><button class="btn" id="placeBtn">הנח +</button><button class="btn sec" id="tapBtn">הנח בהקשה</button></div>';
    el.innerHTML=h;
    document.querySelectorAll('.pbtn').forEach(function(b){b.onclick=function(){st.part=+b.dataset.part;st.el=null;toolBody();};});
    document.querySelectorAll('.ec').forEach(function(b){b.onclick=function(){st.el=b.dataset.el;toolBody();};});
    var pb=document.getElementById('placeBtn');if(pb)pb.onclick=function(){var e2=DB.elements.find(function(x){return x.id==st.el;});st.placements.push(collectP(e2));redraw();save();toast("אלמנט נוסף");};
    var tb=document.getElementById('tapBtn');if(tb)tb.onclick=function(){var e2=DB.elements.find(function(x){return x.id==st.el;});st.placing=collectP(e2);document.getElementById('placing').style.display='block';toast("הקש על השרטוט");};}
  else{if(!st.placements.length){el.innerHTML='<div class="empty">אין אלמנטים. פתח "אלמנטים".</div>';return;}
    el.innerHTML=st.placements.map(function(p,i){return '<div class="item"><span class="dot" style="background:'+LC(p.layer)+'"></span><div><div class="t">'+p.nameHe+'</div><div class="m">'+meta(p)+'</div></div><button class="rm" data-i="'+i+'">×</button></div>';}).join('');
    document.querySelectorAll('.rm').forEach(function(b){b.onclick=function(){st.placements.splice(+b.dataset.i,1);redraw();toolBody();save();};});}
}
function redraw(){var s=document.getElementById('draw');if(s)drawInto(s);save();}
function reId(){st.walls.forEach(function(w,i){w.id="W"+(i+1);});}
function placeForm(e){var lb=e.locateBy,host=e.host=="wall",f='';var wallSel='<div class="f"><label>קיר</label><select id="p_wall">'+st.walls.map(function(w){return '<option>'+w.id+'</option>';}).join('')+'</select></div>';
  if(lb=="point")f=(host?wallSel:'')+'<div class="grid g2">'+num('p_off','היסט')+num('p_h','גובה')+'</div>';
  else if(lb=="array")f=wallSel+'<div class="grid g3">'+num('p_off','ראשון')+num('p_cnt','כמות')+num('p_sp','מרווח')+'</div>'+num('p_h','גובה');
  else if(lb=="span")f=(host?wallSel:'')+'<div class="grid g2">'+num('p_off','התחלה')+num('p_w','אורך')+'</div>';
  else if(lb=="opening")f=wallSel+'<div class="grid g3">'+num('p_off','היסט')+num('p_w','רוחב')+num('p_h','גובה')+'</div>'+num('p_sill','סף');
  else if(lb=="area")f='<div class="grid g3">'+num('p_cx','X')+num('p_cy','Y')+num('p_h','גובה')+'</div>';
  var sz=e.sizes?('<div class="f"><label>וריאנט</label><select id="p_size">'+e.sizes.map(function(o){return '<option>'+o+'</option>';}).join('')+'</select></div>'):'';return sz+f;}
function num(id,l){return '<div class="f"><label>'+l+'</label><input id="'+id+'" inputmode="numeric"></div>';}
function val(id){var e=document.getElementById(id);return e?e.value:'';}
function numv(id){var v=parseFloat(val(id));return isNaN(v)?null:v;}
function collectP(e){return{catalogId:e.id,nameHe:e.nameHe,symbol:e.symbol,layer:e.layer,locateBy:e.locateBy,host:e.host,wallId:val('p_wall')||null,offset:numv('p_off'),height:numv('p_h'),width:numv('p_w'),sill:numv('p_sill'),count:numv('p_cnt'),spacing:numv('p_sp'),cx:numv('p_cx'),cy:numv('p_cy'),size:val('p_size')};}
function meta(p){var a=[];if(p.wallId)a.push(p.wallId);if(p.offset!=null)a.push('היסט '+Math.round(p.offset));if(p.count)a.push('×'+p.count);if(p.width)a.push('ר'+p.width);if(p.cx!=null)a.push('XY');if(p.height!=null)a.push('ג'+p.height);if(p.size)a.push(p.size);return a.join(' · ');}

/* ---- export ---- */
function gcd(c,v){return c+"\\n"+v+"\\n";}
function exportDXF(){if(!st.placements.length){alert('אין אלמנטים');return;}var g=geo();var ents='',layers={WALL:7};
  g.segs.forEach(function(s){ents+=gcd(0,'LINE')+gcd(8,'WALL')+gcd(10,s.a[0])+gcd(20,s.a[1])+gcd(30,0)+gcd(11,s.b[0])+gcd(21,s.b[1])+gcd(31,0);});
  st.placements.forEach(function(p){var pts=resolvePts(p);layers[p.layer]=aci(p.layer);if((p.locateBy=='span'||p.locateBy=='opening')&&pts.length>1)ents+=gcd(0,'LINE')+gcd(8,p.layer)+gcd(10,pts[0][0])+gcd(20,pts[0][1])+gcd(30,0)+gcd(11,pts[1][0])+gcd(21,pts[1][1])+gcd(31,0);else pts.forEach(function(q){ents+=gcd(0,'CIRCLE')+gcd(8,p.layer)+gcd(10,q[0])+gcd(20,q[1])+gcd(30,0)+gcd(40,80);});});
  var lt=gcd(0,'TABLE')+gcd(2,'LAYER')+gcd(70,Object.keys(layers).length);Object.keys(layers).forEach(function(n){lt+=gcd(0,'LAYER')+gcd(2,n)+gcd(70,0)+gcd(62,layers[n])+gcd(6,'CONTINUOUS');});lt+=gcd(0,'ENDTAB');
  var dxf=gcd(0,'SECTION')+gcd(2,'HEADER')+gcd(9,'$INSUNITS')+gcd(70,4)+gcd(0,'ENDSEC')+gcd(0,'SECTION')+gcd(2,'TABLES')+lt+gcd(0,'ENDSEC')+gcd(0,'SECTION')+gcd(2,'ENTITIES')+ents+gcd(0,'ENDSEC')+gcd(0,'EOF');
  dl(dxf,'soline-'+st.job.client+'.dxf','application/dxf');toast("DXF הורד");}
function aci(l){var p=(l||'').split('-')[0];if(p=='ELEC'||p=='LIGHT')return 2;if(p=='PLUMB'||l=='GAS'||l=='SANITARY')return 4;if(p=='DOOR'||l=='WINDOW')return 3;if(p=='HVAC')return 6;return 7;}
function exportCSV(){var rows=[['אלמנט','שכבה','קיר','היסט','גובה','וריאנט']];st.placements.forEach(function(p){rows.push([p.nameHe,p.layer,p.wallId||'',p.offset||'',p.height||'',p.size||'']);});var csv="\\uFEFF"+rows.map(function(r){return r.map(function(c){return '"'+String(c).replace(/"/g,'""')+'"';}).join(',');}).join("\\n");dl(csv,'soline-cutlist.csv','text/csv');toast("CSV הורד");}
function dl(s,name,type){var b=new Blob([s],{type:type});var u=URL.createObjectURL(b);var a=document.createElement('a');a.href=u;a.download=name;a.click();URL.revokeObjectURL(u);}
function resetAll(){localStorage.removeItem("soline-survey");location.reload();}

render();
</script>`;

const outDir = path.join(__dirname, "out");
fs.mkdirSync(outDir, { recursive: true });
const standalone = `<!doctype html>\n<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0d6fbf">\n${head}\n</head><body>\n${body}\n</body></html>\n`;
fs.writeFileSync(path.join(outDir, "app.html"), standalone, "utf8");
fs.writeFileSync(path.join(outDir, "app-artifact.html"), head + "\n" + body, "utf8");
console.log("survey app generated ·", JSON.stringify(C.stats()));
