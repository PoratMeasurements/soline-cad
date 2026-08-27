// ============================================================================
// Soline · Field Surveyor Tablet App (generator) — v2
// ----------------------------------------------------------------------------
// One-screen tablet UI. Main measurement screen = live room drawing + step rail.
// v2 adds: (1) interactive drawing — drag elements + tap-to-place with wall snap;
// (2) non-rectangular room — real traverse over walls[{length,angle}] with
// closure; (3) plan/elevation toggle; (4) opening flow stages discovery /
// readiness / GO-NO-GO gate. Generated from the catalog. node gen-tablet.js
// ============================================================================
"use strict";
const fs = require("fs");
const path = require("path");
const C = require("./src/catalog");
const DATA = JSON.stringify({ parts: C.PARTS, elements: C.ELEMENTS, locate: C.LOCATE, phase: C.PHASE });

const head = `<title>Soline · אפליקציית המודד</title>
<style>
  :root{ --bg:#0c1420; --bezel:#1b2431; --scr:#eef2f7; --panel:#fff; --panel2:#f1f5fa; --line:#d3dce8; --line2:#b9c6d8;
    --ink:#0e1f36; --ink2:#3d5273; --muted:#6a7a95; --accent:#0d6fbf; --accent2:#0a9d63; --warn:#c67c10; --bad:#d23a3f;
    --mono:ui-monospace,"SF Mono","Consolas",monospace; --sans:ui-sans-serif,system-ui,"Segoe UI","Arial Hebrew",Arial,sans-serif; }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased;min-height:100vh;display:grid;place-items:center;padding:16px}
  .ltr{direction:ltr;unicode-bidi:isolate}.mono{font-family:var(--mono);font-variant-numeric:tabular-nums}
  .tablet{width:min(1200px,100%);aspect-ratio:16/10.4;background:var(--bezel);border-radius:26px;padding:14px;box-shadow:0 30px 80px -30px rgba(0,0,0,.7)}
  .screen{width:100%;height:100%;background:var(--scr);border-radius:14px;overflow:hidden;direction:rtl;display:grid;grid-template-rows:auto 1fr;position:relative}
  @media(max-width:860px){ body{padding:0} .tablet{aspect-ratio:auto;height:100vh;border-radius:0;padding:0} .screen{border-radius:0} }
  .top{display:flex;align-items:center;gap:12px;padding:11px 16px;background:var(--panel);border-bottom:1px solid var(--line)}
  .top .mk{width:32px;height:32px;border-radius:9px;background:var(--accent);color:#fff;display:grid;place-items:center;font-weight:800}
  .top .job{font-weight:750;font-size:15px}.top .job small{display:block;color:var(--muted);font-weight:500;font-size:11px;font-family:var(--mono)}
  .top .chips{margin-inline-start:auto;display:flex;gap:8px;flex-wrap:wrap}
  .chip{font-family:var(--mono);font-size:11px;padding:5px 11px;border-radius:999px;border:1px solid var(--line2);color:var(--ink2);display:inline-flex;gap:6px;align-items:center;white-space:nowrap}
  .chip.ok{color:var(--accent2);border-color:var(--accent2);background:rgba(10,157,99,.1)}
  .chip.go{color:var(--accent2);border-color:var(--accent2);background:rgba(10,157,99,.12);font-weight:700}
  .chip.nogo{color:var(--bad);border-color:var(--bad);background:rgba(210,58,63,.1);font-weight:700}
  .main{display:grid;grid-template-columns:1fr 138px;min-height:0}
  .stage{position:relative;overflow:hidden;background:linear-gradient(rgba(20,60,110,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(20,60,110,.05) 1px,transparent 1px);background-size:28px 28px;display:grid;place-items:center}
  .stage svg{width:100%;height:100%;touch-action:none}
  .viewtog{position:absolute;inset-block-start:10px;inset-inline-start:10px;display:flex;gap:6px;z-index:3;flex-wrap:wrap;align-items:center}
  .vt{font-size:11.5px;font-weight:700;padding:7px 11px;border-radius:9px;border:1px solid var(--line2);background:var(--panel);cursor:pointer;font-family:var(--sans)}
  .vt[aria-current="true"]{background:var(--accent);color:#fff;border-color:var(--accent)}
  .vt.wsel{padding:5px 8px}
  .hint{position:absolute;inset-block-end:8px;inset-inline-start:12px;font-size:11px;color:var(--muted);font-family:var(--mono)}
  .placing{position:absolute;inset-block-start:10px;inset-inline-end:10px;z-index:3;background:var(--accent);color:#fff;font-size:12px;font-weight:700;padding:8px 12px;border-radius:10px;box-shadow:0 6px 18px -8px rgba(0,0,0,.4)}
  .rail{background:var(--panel);border-inline-start:1px solid var(--line);display:flex;flex-direction:column;gap:7px;padding:11px 10px;overflow:auto}
  .rail .div{font-size:9.5px;font-family:var(--mono);color:var(--muted);text-align:center;letter-spacing:.06em;margin:4px 0 0}
  .step{border:1px solid var(--line);border-radius:13px;background:var(--panel2);padding:9px 6px;cursor:pointer;text-align:center;display:flex;flex-direction:column;gap:3px;align-items:center;min-height:62px;justify-content:center;position:relative}
  .step:hover{border-color:var(--accent)}
  .step[aria-current="true"]{border-color:var(--accent);background:var(--accent);color:#fff}
  .step .ic{font-size:19px;line-height:1}.step .t{font-size:11.5px;font-weight:700}
  .step .badge{position:absolute;inset-block-start:5px;inset-inline-start:6px;font-family:var(--mono);font-size:9px;background:var(--accent);color:#fff;border-radius:8px;padding:0 4px}
  .step[aria-current="true"] .badge{background:#fff;color:var(--accent)}
  .sheet{position:absolute;inset-inline:0;inset-block-end:0;background:var(--panel);border-top:1px solid var(--line2);border-radius:18px 18px 0 0;box-shadow:0 -18px 40px -24px rgba(0,0,0,.4);transform:translateY(102%);transition:transform .22s ease;max-height:66%;display:flex;flex-direction:column;z-index:5}
  .sheet.open{transform:translateY(0)}
  .sheet .sh{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line)}
  .sheet .sh h2{font-size:15px;font-weight:750;margin:0}.sheet .sh .x{margin-inline-start:auto;border:none;background:var(--panel2);width:32px;height:32px;border-radius:9px;cursor:pointer;font-size:16px;color:var(--ink2)}
  .sheet .body{padding:14px 16px;overflow:auto}
  .grid{display:grid;gap:10px}.g2{grid-template-columns:1fr 1fr}.g3{grid-template-columns:1fr 1fr 1fr}
  @media(max-width:640px){.g3{grid-template-columns:1fr 1fr}}
  .f label{display:block;font-size:10.5px;color:var(--muted);font-family:var(--mono);margin-bottom:4px}
  .f input,.f select{width:100%;height:44px;border:1px solid var(--line2);background:var(--panel2);border-radius:10px;padding:0 10px;color:var(--ink);font-size:15px;font-family:var(--sans)}
  .btn{border:none;border-radius:12px;padding:14px;font-weight:800;font-size:14px;background:var(--accent);color:#fff;cursor:pointer;width:100%}
  .btn.sec{background:transparent;border:1px solid var(--line2);color:var(--ink)}.btn.go{background:var(--accent2)}.btn.bad{background:var(--bad)}
  .parts{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
  .pbtn{font-size:12px;font-weight:650;padding:8px 11px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);cursor:pointer}
  .pbtn[aria-current="true"]{border-color:var(--accent);color:var(--accent)}
  .chips2{display:flex;flex-wrap:wrap;gap:6px}
  .ec{font-size:12.5px;font-weight:600;padding:8px 11px;border-radius:10px;border:1px solid var(--line);background:var(--panel);cursor:pointer;display:inline-flex;gap:6px;align-items:center}
  .ec:hover{border-color:var(--accent)}.ec[aria-current="true"]{border-color:var(--accent);box-shadow:inset 0 0 0 1px rgba(13,111,191,.12)}
  .ec .d{width:8px;height:8px;border-radius:50%}
  .grp{font-size:10.5px;font-family:var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin:10px 0 6px;border-bottom:1px solid var(--line);padding-bottom:4px}
  .locate{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:10px;font-size:12px;color:var(--ink2);margin:10px 0}.locate b{color:var(--accent)}
  .item{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:9px 11px;margin-bottom:7px}
  .item .dot{width:12px;height:12px;border-radius:50%}.item .t{font-weight:640;font-size:13px}.item .m{font-family:var(--mono);font-size:10.5px;color:var(--muted)}
  .item .rm{border:none;background:transparent;color:var(--muted);cursor:pointer;font-size:18px}
  .wallrow{display:grid;grid-template-columns:auto 1fr 1fr auto;gap:8px;align-items:end;margin-bottom:8px}
  .wallrow .lbl{font-family:var(--mono);font-size:12px;color:var(--muted);padding-bottom:12px}
  .wallrow .del{border:none;background:transparent;color:var(--bad);cursor:pointer;font-size:18px;padding-bottom:8px}
  .check{display:grid;grid-template-columns:auto 1fr;gap:9px;align-items:baseline;font-size:13px;padding:8px 10px;border:1px solid var(--line);border-radius:9px;margin-bottom:6px}
  .check.ok{border-color:#cdeadd}.check.ok .mk{color:var(--accent2)}
  .check.bad{border-color:#f3c9c9;background:rgba(210,58,63,.05)}.check.bad .mk{color:var(--bad)}.check .mk{font-weight:800}
  .chk{display:flex;align-items:center;gap:11px;padding:11px 12px;border:1px solid var(--line);border-radius:11px;margin-bottom:7px;cursor:pointer}
  .chk .bx{width:28px;height:28px;border-radius:8px;border:2px solid var(--line2);display:grid;place-items:center;font-weight:800;flex:0 0 auto}
  .chk.ok .bx{background:var(--accent2);border-color:var(--accent2);color:#fff}
  .chk.bad .bx{background:var(--bad);border-color:var(--bad);color:#fff}
  .chk .t{font-size:14px;font-weight:550}.chk .t small{display:block;color:var(--muted);font-size:11px}
  .chk.req .t::after{content:" ★";color:var(--bad);font-size:11px}
  .empty{color:var(--muted);font-size:13px;text-align:center;padding:18px}
  .verdict{font-family:var(--mono);font-weight:800;padding:12px;border-radius:12px;text-align:center;margin-bottom:12px}
  .verdict.go{color:var(--accent2);background:rgba(10,157,99,.12);border:1px solid var(--accent2)}
  .verdict.nogo{color:var(--bad);background:rgba(210,58,63,.1);border:1px solid var(--bad)}
  .gatebtns{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
  .bigb{border:none;border-radius:14px;padding:20px;font-weight:800;font-size:17px;color:#fff;cursor:pointer}
  .bigb.go{background:var(--accent2)}.bigb.go:disabled{opacity:.4}.bigb.nogo{background:var(--bad)}
  @media(prefers-color-scheme:dark){ .screen{--scr:#0a111d} .top,.panel,.rail,.sheet,.step,.vt,.placing{background:#0f1a2b;color:#e6eefb} :root{--scr:#0a111d;--line:#25344a;--line2:#33475f;--ink:#e6eefb;--ink2:#aebfdc;--panel:#0f1a2b;--panel2:#152134;--muted:#8296b6} }
</style>`;

const body = `<div class="tablet"><div class="screen">
  <div class="top">
    <div class="mk">S</div>
    <div class="job">מטבח · אושרת ינקו<small>רוטשילד 22 · שיש</small></div>
    <div class="chips">
      <span class="chip" id="gateChip">שער: –</span>
      <span class="chip ok" id="closureChip">מתאר —</span>
      <span class="chip" id="cntChip">0 אלמנטים</span>
    </div>
  </div>
  <div class="main">
    <div class="stage">
      <div class="viewtog">
        <button class="vt" data-view="plan" aria-current="true">מבט על</button>
        <button class="vt" data-view="elevation">חזית</button>
        <select class="vt wsel" id="elevWall" style="display:none"></select>
      </div>
      <div class="placing" id="placing" style="display:none">מצב הנחה — הקש על השרטוט</div>
      <svg id="draw" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"></svg>
      <div class="hint" id="hint">מסך מדידה ראשי · גרור אלמנט להזיז · בחר שלב מימין ←</div>
    </div>
    <div class="rail" id="rail"></div>
  </div>
  <div class="sheet" id="sheet"><div class="sh"><h2 id="shTitle"></h2><button class="x" id="shClose">×</button></div><div class="body" id="shBody"></div></div>
</div></div>
<script>
var DB=${DATA};
var D2R=Math.PI/180;
var st={
  walls:[{id:"W1",length:3620,angle:90},{id:"W2",length:2400,angle:90},{id:"W3",length:3620,angle:90},{id:"W4",length:2400,angle:90}],
  height:2743, placements:[], step:null, part:1, el:null, view:"plan", elevWall:"W1",
  placing:null, drag:null,
  discovery:{type:"מטבח · שיש", plans:"כן", risks:"קומה 13, גישה מוגבלת"},
  readiness:[
    {t:"רצפה נגישה ומדידה",req:true,s:1},{t:"תקרה נגישה",req:true,s:1},{t:"קירות נגישים",req:true,s:1},
    {t:"תאורה/חשמל למכשיר",req:true,s:1},{t:"אתר בטוח ומפונה",req:true,s:1},{t:"תוכניות זמינות",req:true,s:1},
    {t:"ארונות מותקנים ומפולסים",req:true,s:1},{t:"מיקומי חיתוך (כיור/כיריים) ידועים",req:false,s:2}
  ], gate:null
};
var STEPS=[
  {id:"discovery",ic:"🔎",t:"גילוי",grp:"הכנה"},{id:"readiness",ic:"📋",t:"מוכנות",grp:"הכנה"},{id:"gate",ic:"🚦",t:"שער",grp:"הכנה"},
  {id:"room",ic:"📐",t:"חדר",grp:"מדידה"},{id:"elements",ic:"🧰",t:"אלמנטים",grp:"מדידה"},{id:"measure",ic:"📝",t:"מדידות",grp:"מדידה"},
  {id:"controls",ic:"✓",t:"בקרה",grp:"מדידה"},{id:"export",ic:"⬇",t:"ייצוא",grp:"מדידה"}
];
function LC(layer){var p=(layer||"").split("-")[0];if(layer=="WALL")return "#0e1f36";if(p=="ELEC")return "#c9a227";if(p=="LIGHT")return "#e0952a";if(p=="PLUMB"||layer=="GAS"||layer=="SANITARY")return "#0aa5c8";if(p=="DOOR"||layer=="WINDOW"||layer=="SHUTTER"||layer=="SILL")return "#0a9d63";if(p=="HVAC")return "#b23ec8";return "#6a7a95";}
function clamp(x,mx){return Math.max(0,Math.min(mx,x||0));}

// --- geometry: traverse walls[{length,angle}] ---
function geo(){ var vs=[[0,0]],p=[0,0],b=0,n=st.walls.length;
  for(var i=0;i<n;i++){ var L=st.walls[i].length,r=b*D2R; p=[p[0]+L*Math.cos(r),p[1]+L*Math.sin(r)]; if(i<n-1)vs.push([p[0],p[1]]); b+=180-st.walls[i].angle; }
  var cl=Math.hypot(p[0]-vs[0][0],p[1]-vs[0][1]);
  var segs=st.walls.map(function(w,i){var a=vs[i],c=vs[(i+1)%vs.length];var L=Math.hypot(c[0]-a[0],c[1]-a[1])||1;return {id:w.id,a:a,b:c,dir:[(c[0]-a[0])/L,(c[1]-a[1])/L],len:L};});
  var angSum=st.walls.reduce(function(s,w){return s+w.angle;},0);
  return {vs:vs,segs:segs,closure:cl,angleSum:angSum,close:p}; }
function seg(id){var g=geo();return g.segs.find(function(s){return s.id==id;});}
function resolvePts(p){var out=[];var s=p.wallId?seg(p.wallId):null;var on=function(o){return [s.a[0]+s.dir[0]*o,s.a[1]+s.dir[1]*o];};
  if(p.locateBy=="point"){if(s)out.push(on(clamp(p.offset,s.len)));else if(p.cx!=null)out.push([p.cx,p.cy]);}
  else if(p.locateBy=="array"){if(s){var n=p.count||3;for(var i=0;i<n;i++)out.push(on(clamp((p.offset||0)+i*(p.spacing||71),s.len)));}}
  else if(p.locateBy=="span"){if(s)out.push(on(p.offset||0),on(clamp((p.offset||0)+(p.width||600),s.len)));else if(p.cx!=null)out.push([p.cx,p.cy],[p.cx+(p.width||600),p.cy]);}
  else if(p.locateBy=="opening"){if(s)out.push(on(p.offset||0),on(clamp((p.offset||0)+(p.width||800),s.len)));}
  else if(p.locateBy=="area"){if(p.cx!=null)out.push([p.cx,p.cy]);else if(s)out.push(on(clamp(p.offset||s.len/2,s.len)));}
  return out;}

// --- screen<->world ---
var _M=0,_minX=0,_maxY=0;
function world(evt){var svg=document.getElementById('draw');var pt=svg.createSVGPoint();pt.x=evt.clientX;pt.y=evt.clientY;var u=pt.matrixTransform(svg.getScreenCTM().inverse());return [u.x-_M+_minX,_maxY-(u.y-_M)];}
function projectWall(w){var g=geo();var best=null;g.segs.forEach(function(s){var vx=w[0]-s.a[0],vy=w[1]-s.a[1];var t=clamp(vx*s.dir[0]+vy*s.dir[1],s.len);var px=s.a[0]+s.dir[0]*t,py=s.a[1]+s.dir[1]*t;var d=Math.hypot(w[0]-px,w[1]-py);if(!best||d<best.d)best={id:s.id,offset:t,d:d,pt:[px,py]};});return best;}

// --- draw ---
function draw(){ if(st.view=="elevation")return drawElev();
  var g=geo();var xs=g.vs.map(function(v){return v[0];}).concat([g.close[0]]),ys=g.vs.map(function(v){return v[1];}).concat([g.close[1]]);
  var minX=Math.min.apply(0,xs),maxX=Math.max.apply(0,xs),minY=Math.min.apply(0,ys),maxY=Math.max.apply(0,ys);
  var M=Math.max(600,(maxX-minX)*0.14);_M=M;_minX=minX;_maxY=maxY;
  var W=(maxX-minX)+2*M,H=(maxY-minY)+2*M;var mp=function(pt){return [pt[0]-minX+M,maxY-pt[1]+M];};
  var s='<polygon points="'+g.vs.map(function(p){var q=mp(p);return q[0]+','+q[1];}).join(' ')+'" fill="rgba(13,111,191,.05)" stroke="none"/>';
  g.segs.forEach(function(sg){var a=mp(sg.a),b=mp(sg.b);s+='<line x1="'+a[0]+'" y1="'+a[1]+'" x2="'+b[0]+'" y2="'+b[1]+'" stroke="#0e1f36" stroke-width="26" stroke-linecap="round"/>';var md=[(a[0]+b[0])/2,(a[1]+b[1])/2];s+='<text x="'+md[0]+'" y="'+(md[1]-30)+'" text-anchor="middle" font-size="115" font-family="monospace" fill="#0d6fbf">'+Math.round(sg.len)+'</text>';s+='<text x="'+a[0]+'" y="'+a[1]+'" dx="24" dy="126" font-size="88" font-family="monospace" fill="#6a7a95">'+sg.id+'</text>';});
  // closure gap
  if(g.closure>5){var a=mp(g.vs[0]),b=mp(g.close);s+='<line x1="'+a[0]+'" y1="'+a[1]+'" x2="'+b[0]+'" y2="'+b[1]+'" stroke="#d23a3f" stroke-width="20" stroke-dasharray="46 26"/><text x="'+((a[0]+b[0])/2)+'" y="'+((a[1]+b[1])/2-30)+'" text-anchor="middle" font-size="120" fill="#d23a3f" font-family="var(--sans)">פער '+Math.round(g.closure)+'</text>';}
  st.placements.forEach(function(p,i){var pts=resolvePts(p).map(mp);var col=LC(p.layer);s+='<g data-pi="'+i+'" style="cursor:grab">';
    if((p.locateBy=="span"||p.locateBy=="opening")&&pts.length>1){s+='<line x1="'+pts[0][0]+'" y1="'+pts[0][1]+'" x2="'+pts[1][0]+'" y2="'+pts[1][1]+'" stroke="'+col+'" stroke-width="36"/>';}
    else pts.forEach(function(q){s+='<circle cx="'+q[0]+'" cy="'+q[1]+'" r="92" fill="#fff" stroke="'+col+'" stroke-width="18"/><line x1="'+(q[0]-66)+'" y1="'+q[1]+'" x2="'+(q[0]+66)+'" y2="'+q[1]+'" stroke="'+col+'" stroke-width="14"/><line x1="'+q[0]+'" y1="'+(q[1]-66)+'" x2="'+q[0]+'" y2="'+(q[1]+66)+'" stroke="'+col+'" stroke-width="14"/>';});
    s+='</g>';});
  setSvg(W,H,s); chips(); }
function drawElev(){ var wl=seg(st.elevWall);if(!wl){setSvg(100,100,'');return;} var L=wl.len,Hh=st.height;var M=500;_M=M;_minX=0;_maxY=Hh;
  var W=L+2*M,H=Hh+2*M;var mp=function(x,z){return [x+M,Hh-z+M];};
  var s='<line x1="'+mp(-200,0)[0]+'" y1="'+mp(-200,0)[1]+'" x2="'+mp(L+200,0)[0]+'" y2="'+mp(L+200,0)[1]+'" stroke="#0e1f36" stroke-width="14"/>';
  s+='<polygon points="'+[mp(0,0),mp(L,0),mp(L,Hh),mp(0,Hh)].map(function(p){return p[0]+','+p[1];}).join(' ')+'" fill="rgba(13,111,191,.05)" stroke="#0e1f36" stroke-width="16"/>';
  s+='<text x="'+mp(L/2,Hh)[0]+'" y="'+(mp(L/2,Hh)[1]-40)+'" text-anchor="middle" font-size="120" font-family="monospace" fill="#6a7a95">קיר '+st.elevWall+' · '+Math.round(L)+'×'+Hh+'</text>';
  st.placements.filter(function(p){return p.wallId==st.elevWall;}).forEach(function(p){var col=LC(p.layer);var h=p.height!=null?p.height:900;
    if(p.locateBy=="opening"){var x1=p.offset||0,x2=x1+(p.width||800),sill=p.sill||0,top=sill+(p.height||1000);s+='<polygon points="'+[mp(x1,sill),mp(x2,sill),mp(x2,top),mp(x1,top)].map(function(q){return q[0]+','+q[1];}).join(' ')+'" fill="none" stroke="'+col+'" stroke-width="20"/>';}
    else{var q=mp(p.offset||0,h);s+='<circle cx="'+q[0]+'" cy="'+q[1]+'" r="86" fill="#fff" stroke="'+col+'" stroke-width="18"/><line x1="'+q[0]+'" y1="'+q[1]+'" x2="'+q[0]+'" y2="'+mp(p.offset||0,0)[1]+'" stroke="#0d6fbf" stroke-width="5" stroke-dasharray="18 12"/><text x="'+(q[0])+'" y="'+(mp(p.offset||0,0)[1]-20)+'" text-anchor="middle" font-size="92" font-family="monospace" fill="#0d6fbf">'+h+'</text>';}
  });
  setSvg(W,H,s); }
function setSvg(W,H,s){var el=document.getElementById('draw');el.setAttribute('viewBox','0 0 '+Math.round(W)+' '+Math.round(H));el.innerHTML=s;}

// --- rail / steps ---
function rail(){var last='';document.getElementById('rail').innerHTML=STEPS.map(function(x){var d='';if(x.grp!=last){d='<div class="div">'+x.grp+'</div>';last=x.grp;}
  var badge=x.id=="measure"&&st.placements.length?('<span class="badge">'+st.placements.length+'</span>'):(x.id=="gate"&&st.gate?('<span class="badge">'+(st.gate=="GO"?'✓':'✗')+'</span>'):'');
  return d+'<div class="step" data-step="'+x.id+'" aria-current="'+(st.step==x.id)+'"><span class="ic">'+x.ic+'</span><span class="t">'+x.t+'</span>'+badge+'</div>';}).join('');
  document.querySelectorAll('.step').forEach(function(b){b.onclick=function(){openStep(b.dataset.step);};});}
function openStep(id){st.step=id;rail();document.getElementById('shTitle').textContent={discovery:'גילוי',readiness:'מוכנות',gate:'שער GO / NO-GO',room:'הגדרת חדר',elements:'הוספת אלמנט',measure:'רשימת מדידה',controls:'בקרות',export:'ייצוא'}[id];document.getElementById('shBody').innerHTML=panel(id);document.getElementById('sheet').classList.add('open');wire(id);}
function closeSheet(){st.step=null;rail();document.getElementById('sheet').classList.remove('open');}

function panel(id){
  if(id=="discovery")return '<div class="grid"><div class="f"><label>סוג פרויקט</label><input id="d_type" value="'+st.discovery.type+'"></div><div class="f"><label>תוכניות</label><input id="d_plans" value="'+st.discovery.plans+'"></div><div class="f"><label>סיכונים</label><input id="d_risks" value="'+st.discovery.risks+'"></div><button class="btn" id="dSave">שמור והמשך</button></div>';
  if(id=="readiness")return st.readiness.map(function(it,i){return '<div class="chk '+(it.s==1?'ok':it.s==0?'bad':'')+(it.req?' req':'')+'" data-i="'+i+'"><span class="bx">'+(it.s==1?'✓':it.s==0?'✕':'?')+'</span><span class="t">'+it.t+'</span></div>';}).join('')+'<div class="locate">הקש על פריט כדי לסמן תקין / חוסם / לא רלוונטי. פריטי חובה מסומנים ★.</div>';
  if(id=="gate"){var r=gate();var v='<div class="verdict '+(r.go?'go':'nogo')+'">'+(r.go?'✓ מוכן ל-GO':'⛔ יש חוסמים ל-NO-GO')+'</div>';var reasons=r.blockers.length?('<div class="locate">חוסמים: '+r.blockers.join(' · ')+'</div>'):'';return v+reasons+'<div class="gatebtns"><button class="bigb go" id="gGo" '+(r.go?'':'disabled')+'>GO</button><button class="bigb nogo" id="gNogo">NO-GO</button></div>';}
  if(id=="room"){var rows=st.walls.map(function(w,i){return '<div class="wallrow"><span class="lbl">'+w.id+'</span><div class="f"><label>אורך (מ״מ)</label><input class="wLen" data-i="'+i+'" value="'+w.length+'" inputmode="numeric"></div><div class="f"><label>זווית פינה (°)</label><input class="wAng" data-i="'+i+'" value="'+w.angle+'" inputmode="numeric"></div><button class="del" data-i="'+i+'" '+(st.walls.length<=3?'disabled style="opacity:.3"':'')+'>×</button></div>';}).join('');
    return rows+'<div class="grid g2" style="margin-top:6px"><button class="btn sec" id="addWall">+ הוסף קיר</button><div class="f"><label>גובה קיר (מ״מ)</label><input id="rH" value="'+st.height+'" inputmode="numeric"></div></div><button class="btn" id="roomApply" style="margin-top:10px">עדכן חדר</button><div class="locate">חדר לא-מלבני: שנה זוויות (למשל 135° לפינה קטומה), הוסף/הסר קירות. המנוע בונה את המתאר ובודק סגירה.</div>';}
  if(id=="elements"){var els=DB.elements.filter(function(e){return e.part==st.part;}),groups={};els.forEach(function(e){(groups[e.group]=groups[e.group]||[]).push(e);});
    var cat='<div class="parts">'+DB.parts.map(function(p){return '<button class="pbtn" data-part="'+p.id+'" aria-current="'+(p.id==st.part)+'">'+p.icon+' '+p.name.split(',')[0]+'</button>';}).join('')+'</div>';
    cat+=Object.keys(groups).map(function(gr){return '<div class="grp">'+gr+'</div><div class="chips2">'+groups[gr].map(function(e){return '<button class="ec" data-el="'+e.id+'" aria-current="'+(st.el==e.id)+'"><span class="d" style="background:'+LC(e.layer)+'"></span>'+e.nameHe+'</button>';}).join('')+'</div>';}).join('');
    var det='',e=DB.elements.find(function(x){return x.id==st.el;});
    if(e)det='<div class="locate">📍 <b>'+e.nameHe+'</b> · '+DB.locate[e.locateBy]+(e.notes?('<br>ℹ️ '+e.notes):'')+'</div>'+placeForm(e)+'<div class="grid g2"><button class="btn" id="placeBtn">הנח לפי מספרים +</button><button class="btn sec" id="tapBtn">הנח בהקשה על השרטוט</button></div>';
    return '<div class="grid" style="grid-template-columns:1fr 300px;align-items:start;gap:14px"><div>'+cat+'</div><div>'+(det||'<div class="empty">בחר אלמנט →</div>')+'</div></div>';}
  if(id=="measure"){if(!st.placements.length)return '<div class="empty">אין אלמנטים. פתח "אלמנטים" והנח על השרטוט (גם בגרירה).</div>';return st.placements.map(function(p,i){return '<div class="item"><span class="dot" style="background:'+LC(p.layer)+'"></span><div><div class="t">'+p.nameHe+'</div><div class="m">'+meta(p)+'</div></div><button class="rm" data-i="'+i+'">×</button></div>';}).join('');}
  if(id=="controls"){var r=controls();var v='<div class="verdict '+(r.go?'go':'nogo')+'">'+(r.go?'✓ GO — כל הבקרות עברו':'✗ NO-GO — '+r.fails+' בקרות נכשלו')+'</div>';return v+r.checks.map(function(c){return '<div class="check '+(c.ok?'ok':'bad')+'"><span class="mk">'+(c.ok?'✓':'✗')+'</span><span>'+c.msg+'</span></div>';}).join('');}
  if(id=="export")return '<div class="grid"><button class="btn" id="expDxf">⬇ ייצא DXF</button><button class="btn sec" id="expCsv">⬇ ייצא רשימת חיתוך (CSV)</button><div class="locate">כולל מתאר החדר וכל '+st.placements.length+' האלמנטים, כל אחד על השכבה והסמל שלו.</div></div>';
  return '';}
function placeForm(e){var lb=e.locateBy,host=e.host=="wall",f='';var wallSel='<div class="f"><label>קיר</label><select id="p_wall">'+st.walls.map(function(w){return '<option>'+w.id+'</option>';}).join('')+'</select></div>';
  if(lb=="point")f=(host?wallSel:'')+'<div class="grid g2">'+num('p_off','היסט')+num('p_h','גובה')+'</div>';
  else if(lb=="array")f=wallSel+'<div class="grid g3">'+num('p_off','מרכז ראשון')+num('p_cnt','כמות')+num('p_sp','מרווח')+'</div>'+num('p_h','גובה');
  else if(lb=="span")f=(host?wallSel:'')+'<div class="grid g2">'+num('p_off','התחלה')+num('p_w','אורך')+'</div>';
  else if(lb=="opening")f=wallSel+'<div class="grid g3">'+num('p_off','היסט')+num('p_w','רוחב')+num('p_h','גובה')+'</div>'+num('p_sill','סף');
  else if(lb=="area")f='<div class="grid g3">'+num('p_cx','מרכז X')+num('p_cy','מרכז Y')+num('p_h','גובה')+'</div>';
  var sz=e.sizes?('<div class="f"><label>וריאנט</label><select id="p_size">'+e.sizes.map(function(o){return '<option>'+o+'</option>';}).join('')+'</select></div>'):'';return sz+f;}
function num(id,l){return '<div class="f"><label>'+l+'</label><input id="'+id+'" inputmode="numeric"></div>';}
function val(id){var e=document.getElementById(id);return e?e.value:'';}
function numv(id){var v=parseFloat(val(id));return isNaN(v)?null:v;}

function wire(id){
  if(id=="discovery")document.getElementById('dSave').onclick=function(){st.discovery={type:val('d_type'),plans:val('d_plans'),risks:val('d_risks')};closeSheet();};
  if(id=="readiness")document.querySelectorAll('.chk').forEach(function(b){b.onclick=function(){var i=+b.dataset.i;st.readiness[i].s=(st.readiness[i].s+2)%3;openStep('readiness');chips();};});
  if(id=="gate"){var r=gate();var gg=document.getElementById('gGo');if(gg)gg.onclick=function(){st.gate="GO";chips();closeSheet();};document.getElementById('gNogo').onclick=function(){st.gate="NO_GO";chips();closeSheet();};}
  if(id=="room"){document.querySelectorAll('.wLen').forEach(function(x){x.oninput=function(){st.walls[+x.dataset.i].length=parseFloat(x.value)||st.walls[+x.dataset.i].length;};});
    document.querySelectorAll('.wAng').forEach(function(x){x.oninput=function(){st.walls[+x.dataset.i].angle=parseFloat(x.value)||st.walls[+x.dataset.i].angle;};});
    document.querySelectorAll('.del').forEach(function(b){b.onclick=function(){if(st.walls.length>3){st.walls.splice(+b.dataset.i,1);reId();openStep('room');draw();}};});
    document.getElementById('addWall').onclick=function(){st.walls.push({id:"W"+(st.walls.length+1),length:1000,angle:90});reId();openStep('room');};
    document.getElementById('roomApply').onclick=function(){st.height=numv('rH')||st.height;draw();chips();closeSheet();};}
  if(id=="elements"){document.querySelectorAll('.pbtn').forEach(function(b){b.onclick=function(){st.part=+b.dataset.part;st.el=null;openStep('elements');};});
    document.querySelectorAll('.ec').forEach(function(b){b.onclick=function(){st.el=b.dataset.el;openStep('elements');};});
    var pb=document.getElementById('placeBtn');if(pb)pb.onclick=addPlace;var tb=document.getElementById('tapBtn');if(tb)tb.onclick=startTap;}
  if(id=="measure")document.querySelectorAll('.rm').forEach(function(b){b.onclick=function(){st.placements.splice(+b.dataset.i,1);draw();rail();openStep('measure');chips();};});
  if(id=="export"){document.getElementById('expDxf').onclick=exportDXF;document.getElementById('expCsv').onclick=exportCSV;}
}
function reId(){st.walls.forEach(function(w,i){w.id="W"+(i+1);});}
function collectP(e){return {catalogId:e.id,nameHe:e.nameHe,symbol:e.symbol,layer:e.layer,locateBy:e.locateBy,host:e.host,wallId:val('p_wall')||null,offset:numv('p_off'),height:numv('p_h'),width:numv('p_w'),sill:numv('p_sill'),count:numv('p_cnt'),spacing:numv('p_sp'),cx:numv('p_cx'),cy:numv('p_cy'),size:val('p_size')};}
function addPlace(){var e=DB.elements.find(function(x){return x.id==st.el;});if(!e)return;st.placements.push(collectP(e));draw();rail();chips();closeSheet();}
function startTap(){var e=DB.elements.find(function(x){return x.id==st.el;});if(!e)return;st.placing=collectP(e);document.getElementById('placing').style.display='block';closeSheet();}
function meta(p){var a=[];if(p.wallId)a.push(p.wallId);if(p.offset!=null)a.push('היסט '+Math.round(p.offset));if(p.count)a.push('×'+p.count+'@'+(p.spacing||71));if(p.width)a.push('רוחב '+p.width);if(p.cx!=null)a.push('XY '+Math.round(p.cx)+','+Math.round(p.cy));if(p.height!=null)a.push('גובה '+p.height);if(p.size)a.push(p.size);return a.join(' · ');}

// --- pointer interaction ---
var svgEl;
function initPointer(){svgEl=document.getElementById('draw');
  svgEl.addEventListener('pointerdown',function(evt){ if(st.view!="plan")return;
    var g=evt.target.closest('[data-pi]');
    if(g){st.drag={i:+g.getAttribute('data-pi')};svgEl.setPointerCapture(evt.pointerId);return;}
    if(st.placing){var w=world(evt);var pr=projectWall(w);var p=st.placing;
      if(p.host=="wall"){p.wallId=pr.id;p.offset=Math.round(pr.offset);if(p.height==null)p.height=900;}
      else{p.cx=Math.round(w[0]);p.cy=Math.round(w[1]);}
      st.placements.push(p);st.placing=null;document.getElementById('placing').style.display='none';draw();rail();chips();}
  });
  svgEl.addEventListener('pointermove',function(evt){ if(!st.drag||st.view!="plan")return; var p=st.placements[st.drag.i];var w=world(evt);
    if(p.host=="wall"||p.wallId){var pr=projectWall(w);p.wallId=pr.id;p.offset=Math.round(pr.offset);}else{p.cx=Math.round(w[0]);p.cy=Math.round(w[1]);}draw();});
  svgEl.addEventListener('pointerup',function(){st.drag=null;});
}

// --- gate / controls / chips ---
function gate(){var blockers=st.readiness.filter(function(it){return it.req&&it.s==0;}).map(function(it){return it.t;});var unrez=st.readiness.filter(function(it){return it.req&&it.s==2;}).map(function(it){return it.t+' (לא הוכרע)';});var all=blockers.concat(unrez);return {go:all.length==0,blockers:all};}
function controls(){var g=geo();var checks=[];var n=st.walls.length;
  checks.push({ok:g.closure<=5,msg:g.closure<=5?'סגירת מתאר: פער '+g.closure.toFixed(1)+' מ״מ ✓':'סגירת מתאר: פער '+Math.round(g.closure)+' מ״מ — בדוק אורכים/זוויות.'});
  var exp=(n-2)*180,ae=Math.abs(g.angleSum-exp);checks.push({ok:ae<=n,msg:ae<=n?'סכום זוויות: '+g.angleSum+'° מול '+exp+'° ✓':'סכום זוויות: '+g.angleSum+'° במקום '+exp+'°.'});
  var fitBad=0;st.placements.forEach(function(p){if(p.wallId){var L=seg(p.wallId).len;var end=(p.offset||0)+(p.width||0)+(p.locateBy=='array'?((p.count||1)-1)*(p.spacing||71):0);if((p.offset||0)<0||end>L+2)fitBad++;}if(p.height!=null&&p.height>st.height)fitBad++;});
  checks.push({ok:fitBad==0,msg:fitBad==0?'התאמת אלמנטים: כולם בתוך הקירות/הגובה ✓':fitBad+' אלמנטים חורגים.'});
  checks.push({ok:st.placements.length>0,msg:st.placements.length>0?'שלמות: '+st.placements.length+' אלמנטים ✓':'לא נמדדו אלמנטים.'});
  var fails=checks.filter(function(c){return !c.ok;}).length;return {go:fails==0,fails:fails,checks:checks};}
function chips(){var g=geo();var c=document.getElementById('closureChip');var ok=g.closure<=5;c.textContent='מתאר '+(ok?'✓':'פער '+Math.round(g.closure));c.className='chip '+(ok?'ok':'nogo');
  document.getElementById('cntChip').textContent=st.placements.length+' אלמנטים';
  var gc=document.getElementById('gateChip');gc.textContent='שער: '+(st.gate?st.gate:'–');gc.className='chip '+(st.gate=="GO"?'go':st.gate=="NO_GO"?'nogo':'');}

// --- views toggle ---
function initViews(){document.querySelectorAll('.vt[data-view]').forEach(function(b){b.onclick=function(){st.view=b.dataset.view;document.querySelectorAll('.vt[data-view]').forEach(function(x){x.setAttribute('aria-current',x.dataset.view==st.view);});
  var sel=document.getElementById('elevWall');sel.style.display=st.view=="elevation"?'inline-block':'none';if(st.view=="elevation"){sel.innerHTML=st.walls.map(function(w){return '<option>'+w.id+'</option>';}).join('');sel.value=st.elevWall;}draw();};});
  document.getElementById('elevWall').onchange=function(e){st.elevWall=e.target.value;draw();};}

// --- export ---
function gc(c,v){return c+"\\n"+v+"\\n";}
function exportDXF(){if(!st.placements.length){alert('אין אלמנטים לייצוא');return;}var g=geo();var ents='';var layers={WALL:7};
  g.segs.forEach(function(s){ents+=gc(0,'LINE')+gc(8,'WALL')+gc(10,s.a[0])+gc(20,s.a[1])+gc(30,0)+gc(11,s.b[0])+gc(21,s.b[1])+gc(31,0);});
  st.placements.forEach(function(p){var pts=resolvePts(p);layers[p.layer]=aci(p.layer);if((p.locateBy=='span'||p.locateBy=='opening')&&pts.length>1)ents+=gc(0,'LINE')+gc(8,p.layer)+gc(10,pts[0][0])+gc(20,pts[0][1])+gc(30,0)+gc(11,pts[1][0])+gc(21,pts[1][1])+gc(31,0);else pts.forEach(function(q){ents+=gc(0,'CIRCLE')+gc(8,p.layer)+gc(10,q[0])+gc(20,q[1])+gc(30,0)+gc(40,80);});});
  var lt=gc(0,'TABLE')+gc(2,'LAYER')+gc(70,Object.keys(layers).length);Object.keys(layers).forEach(function(n){lt+=gc(0,'LAYER')+gc(2,n)+gc(70,0)+gc(62,layers[n])+gc(6,'CONTINUOUS');});lt+=gc(0,'ENDTAB');
  var dxf=gc(0,'SECTION')+gc(2,'HEADER')+gc(9,'$INSUNITS')+gc(70,4)+gc(0,'ENDSEC')+gc(0,'SECTION')+gc(2,'TABLES')+lt+gc(0,'ENDSEC')+gc(0,'SECTION')+gc(2,'ENTITIES')+ents+gc(0,'ENDSEC')+gc(0,'EOF');
  dl(dxf,'soline-measurement.dxf','application/dxf');}
function aci(l){var p=(l||'').split('-')[0];if(p=='ELEC'||p=='LIGHT')return 2;if(p=='PLUMB'||l=='GAS'||l=='SANITARY')return 4;if(p=='DOOR'||l=='WINDOW')return 3;if(p=='HVAC')return 6;return 7;}
function exportCSV(){var rows=[['אלמנט','שכבה','קיר','היסט','גובה','וריאנט']];st.placements.forEach(function(p){rows.push([p.nameHe,p.layer,p.wallId||'',p.offset||'',p.height||'',p.size||'']);});var csv="\\uFEFF"+rows.map(function(r){return r.map(function(c){return '"'+String(c).replace(/"/g,'""')+'"';}).join(',');}).join("\\n");dl(csv,'soline-cutlist.csv','text/csv');}
function dl(s,name,type){var b=new Blob([s],{type:type});var u=URL.createObjectURL(b);var a=document.createElement('a');a.href=u;a.download=name;a.click();URL.revokeObjectURL(u);}

document.getElementById('shClose').onclick=closeSheet;
initPointer();initViews();rail();draw();chips();
</script>`;

const outDir = path.join(__dirname, "out");
fs.mkdirSync(outDir, { recursive: true });
const standalone = `<!doctype html>\n<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n${head}\n</head><body>\n${body}\n</body></html>\n`;
fs.writeFileSync(path.join(outDir, "tablet.html"), standalone, "utf8");
fs.writeFileSync(path.join(outDir, "tablet-artifact.html"), head + "\n" + body, "utf8");
console.log("tablet app v2 generated ·", JSON.stringify(C.stats()));
