// Generates the field element-picker UI from the catalog (single source of truth).
// node gen-picker.js → out/picker.html (standalone) + out/picker-artifact.html
"use strict";
const fs = require("fs");
const path = require("path");
const C = require("./src/catalog");

const DATA = JSON.stringify({ parts: C.PARTS, elements: C.ELEMENTS, locate: C.LOCATE, phase: C.PHASE });

const head = `<title>Soline · בורר אלמנטים בשטח</title>
<style>
  :root{ --bg:#eef2f7; --grid:rgba(20,60,110,0.05); --panel:#fff; --panel2:#f1f5fa; --line:#d3dce8; --line2:#b9c6d8;
    --ink:#0e1f36; --ink2:#3d5273; --muted:#6a7a95; --accent:#0d6fbf; --accent-soft:rgba(13,111,191,.10);
    --shell:#c67c10; --shell-soft:rgba(198,124,16,.14); --finish:#0a9d63; --finish-soft:rgba(10,157,99,.12);
    --mono:ui-monospace,"SF Mono","Consolas",monospace; --sans:ui-sans-serif,system-ui,"Segoe UI","Arial Hebrew",Arial,sans-serif; }
  @media (prefers-color-scheme:dark){ :root{ --bg:#080f1a; --grid:rgba(120,165,225,.05); --panel:#0f1a2b; --panel2:#152134;
    --line:#25344a; --line2:#33475f; --ink:#e6eefb; --ink2:#aebfdc; --muted:#8296b6; --accent:#5cc8ff; --accent-soft:rgba(92,200,255,.12);
    --shell:#f5b544; --shell-soft:rgba(245,181,68,.16); --finish:#2fce8f; --finish-soft:rgba(47,206,143,.14); } }
  *{box-sizing:border-box}
  body{margin:0;direction:rtl;background:var(--bg);color:var(--ink);font-family:var(--sans);line-height:1.55;
    background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);background-size:26px 26px}
  .wrap{max-width:1080px;margin:0 auto;padding:clamp(14px,3vw,32px) clamp(12px,3vw,28px) 70px}
  h1{font-size:clamp(20px,3vw,28px);font-weight:800;margin:0}
  .sub{color:var(--ink2);font-size:13.5px;margin:6px 0 0;max-width:70ch}
  .parts{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0 16px}
  .parts button{font-family:var(--sans);font-size:13px;font-weight:650;padding:10px 14px;border-radius:12px;border:1px solid var(--line);background:var(--panel);color:var(--ink2);cursor:pointer;display:inline-flex;gap:8px;align-items:center}
  .parts button[aria-current="true"]{border-color:var(--accent);color:var(--ink);box-shadow:inset 0 0 0 1px var(--accent-soft)}
  .layout{display:grid;grid-template-columns:1fr 340px;gap:18px;align-items:start}
  @media(max-width:820px){.layout{grid-template-columns:1fr}}
  .group{margin-bottom:16px}
  .group h3{font-size:12px;font-family:var(--mono);color:var(--muted);letter-spacing:.04em;text-transform:uppercase;margin:0 0 8px;border-bottom:1px solid var(--line);padding-bottom:5px}
  .chips{display:flex;flex-wrap:wrap;gap:7px}
  .chip{font-size:13px;font-weight:600;padding:8px 12px;border-radius:10px;border:1px solid var(--line);background:var(--panel);color:var(--ink);cursor:pointer;display:inline-flex;gap:7px;align-items:center}
  .chip:hover{border-color:var(--accent)}
  .chip[aria-current="true"]{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent-soft)}
  .chip .ph{width:8px;height:8px;border-radius:50%}
  .ph.shell{background:var(--shell)} .ph.finish{background:var(--finish)} .ph.both{background:linear-gradient(90deg,var(--shell),var(--finish))}
  .detail,.list{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px;position:sticky;top:12px}
  .detail h2{font-size:17px;font-weight:750;margin:0}
  .badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
  .b{font-family:var(--mono);font-size:10.5px;padding:3px 8px;border-radius:999px;border:1px solid var(--line2);color:var(--ink2)}
  .b.shell{color:var(--shell);border-color:var(--shell);background:var(--shell-soft)}
  .b.finish{color:var(--finish);border-color:var(--finish);background:var(--finish-soft)}
  .locate{margin-top:12px;background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:11px 12px;font-size:12.5px;color:var(--ink2)}
  .locate b{color:var(--accent)}
  .form{margin-top:12px;display:grid;gap:10px}
  .frow{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .f label{display:block;font-size:11px;color:var(--muted);font-family:var(--mono);margin-bottom:3px}
  .f input,.f select{width:100%;height:38px;border:1px solid var(--line2);background:var(--panel2);border-radius:9px;padding:0 9px;color:var(--ink);font-family:var(--sans);font-size:14px}
  .add{margin-top:4px;border:none;border-radius:11px;padding:13px;font-weight:800;font-size:14px;background:var(--accent);color:#fff;cursor:pointer;width:100%}
  .empty{color:var(--muted);font-size:13px;text-align:center;padding:24px 0}
  .list h3{font-size:13px;font-weight:750;margin:0 0 10px;display:flex;justify-content:space-between}
  .list .n{font-family:var(--mono);color:var(--accent)}
  .item{display:grid;grid-template-columns:1fr auto;gap:4px;border:1px solid var(--line);border-radius:10px;padding:9px 11px;margin-bottom:7px}
  .item .t{font-weight:620;font-size:13px} .item .m{font-family:var(--mono);font-size:11px;color:var(--muted)}
  .item .rm{grid-row:1/3;align-self:center;border:none;background:transparent;color:var(--muted);cursor:pointer;font-size:16px}
  footer{margin-top:34px;padding-top:16px;border-top:1px solid var(--line);font-family:var(--mono);font-size:11px;color:var(--muted);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
  .room{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin:16px 0}
  .room h3{font-size:12px;font-family:var(--mono);color:var(--muted);letter-spacing:.04em;text-transform:uppercase;margin:0 0 10px}
  .rgrid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
  @media(max-width:640px){.rgrid{grid-template-columns:repeat(2,1fr)}}
  .exp{margin-top:10px;border:1px solid var(--accent);border-radius:11px;padding:12px;font-weight:800;font-size:13.5px;font-family:var(--sans);background:var(--accent-soft);color:var(--accent);cursor:pointer;width:100%}
  .exp:hover{background:var(--accent);color:#fff}
</style>`;

const body = `<div dir="rtl"><div class="wrap">
  <h1>בורר אלמנטים בשטח</h1>
  <p class="sub">המודד בוחר מה למדוד ומַמקם לפי <b>מרכז + היסט + גובה</b>. הספרייה נטענת ממסד הנתונים (DXF Master Database) — <span id="stat" class="mono"></span>.</p>
  <div class="room" dir="rtl">
    <h3>הגדרת חדר (חדר מלבני)</h3>
    <div class="rgrid">
      <div class="f"><label>קיר W1 (מ״מ)</label><input id="rW1" value="3620" inputmode="numeric"></div>
      <div class="f"><label>קיר W2 (מ״מ)</label><input id="rW2" value="2400" inputmode="numeric"></div>
      <div class="f"><label>קיר W3 (מ״מ)</label><input id="rW3" value="3620" inputmode="numeric"></div>
      <div class="f"><label>קיר W4 (מ״מ)</label><input id="rW4" value="2400" inputmode="numeric"></div>
      <div class="f"><label>גובה קיר (מ״מ)</label><input id="rWH" value="2743" inputmode="numeric"></div>
    </div>
  </div>
  <div class="parts" id="parts"></div>
  <div class="layout">
    <div id="cat"></div>
    <div>
      <div class="detail" id="detail"><div class="empty">בחר אלמנט מהרשימה →</div></div>
      <div class="list" style="margin-top:14px">
        <h3>רשימת מדידה <span class="n" id="cnt">0</span></h3>
        <div id="mlist"><div class="empty">אין אלמנטים עדיין</div></div>
        <button class="exp" id="expdxf">⬇ ייצא DXF</button>
      </div>
    </div>
  </div>
  <footer><span class="ltr" style="direction:ltr">SOLINE · FIELD ELEMENT PICKER</span><span>ספריית אלמנטים ראשונית · מיקום לפי מרכזים/היסטים</span></footer>
</div></div>
<script>
const DB = ${DATA};
const WALLS = ["W1","W2","W3","W4"];
let curPart = 1, curEl = null, mlist = [];
document.getElementById('stat').textContent = DB.parts.length + " חלקים · " + DB.elements.length + " אלמנטים";

function partsBar(){
  document.getElementById('parts').innerHTML = DB.parts.map(function(p){
    return '<button data-part="'+p.id+'" aria-current="'+(p.id===curPart)+'">'+p.icon+' '+p.name+'</button>';
  }).join('');
  document.querySelectorAll('#parts button').forEach(function(b){ b.onclick=function(){ curPart=+b.dataset.part; render(); }; });
}
function render(){
  partsBar();
  var els = DB.elements.filter(function(e){return e.part===curPart;});
  var groups = {};
  els.forEach(function(e){ (groups[e.group]=groups[e.group]||[]).push(e); });
  document.getElementById('cat').innerHTML = Object.keys(groups).map(function(g){
    return '<div class="group"><h3>'+g+'</h3><div class="chips">'+groups[g].map(function(e){
      return '<button class="chip" data-id="'+e.id+'" aria-current="'+(curEl===e.id)+'"><span class="ph '+e.phase+'"></span>'+e.nameHe+'</button>';
    }).join('')+'</div></div>';
  }).join('');
  document.querySelectorAll('.chip').forEach(function(c){ c.onclick=function(){ curEl=c.dataset.id; render(); detail(); }; });
}
function field(id,label,val,type){ return '<div class="f"><label>'+label+'</label><input id="'+id+'" value="'+(val||'')+'" '+(type==='num'?'inputmode="numeric"':'')+'></div>'; }
function sel(id,label,opts){ return '<div class="f"><label>'+label+'</label><select id="'+id+'">'+opts.map(function(o){return '<option>'+o+'</option>';}).join('')+'</select></div>'; }
function detail(){
  var e = DB.elements.find(function(x){return x.id===curEl;}); if(!e){return;}
  var phTxt = DB.phase[e.phase];
  var badges = '<span class="b '+e.phase+'">'+phTxt+'</span><span class="b">מאחז: '+({wall:'קיר',floor:'רצפה',ceiling:'תקרה',freestanding:'חופשי'})[e.host]+'</span>'+(e.dims&&e.dims.spacingMm?'<span class="b">מרווח מרכזים '+e.dims.spacingMm+'</span>':'');
  var form='';
  var hostWall = e.host==='wall';
  var lb=e.locateBy;
  if(lb==='point'){ form=(hostWall?sel('f_wall','קיר',WALLS):'')+'<div class="frow">'+field('f_off','היסט לאורך (מ״מ)','','num')+field('f_h','גובה מהרצפה (מ״מ)','','num')+'</div>'; }
  else if(lb==='array'){ form=sel('f_wall','קיר',WALLS)+'<div class="frow">'+field('f_off','מרכז ראשון (מ״מ)','','num')+field('f_cnt','כמות','','num')+'</div><div class="frow">'+field('f_sp','מרווח מרכזים (מ״מ)',(e.dims&&e.dims.spacingMm)||'','num')+field('f_h','גובה (מ״מ)','','num')+'</div>'; }
  else if(lb==='span'){ form=(hostWall?sel('f_wall','קיר',WALLS):'')+'<div class="frow">'+field('f_s','היסט התחלה (מ״מ)','','num')+field('f_e','היסט סוף (מ״מ)','','num')+'</div>'+field('f_h','גובה (מ״מ)','','num'); }
  else if(lb==='opening'){ form=sel('f_wall','קיר',WALLS)+'<div class="frow">'+field('f_off','היסט מפינה (מ״מ)','','num')+field('f_w','רוחב (מ״מ)','','num')+'</div><div class="frow">'+field('f_h','גובה (מ״מ)','','num')+field('f_sill','סף (מ״מ)','','num')+'</div>'; }
  else if(lb==='area'){ form='<div class="frow">'+field('f_x','מרכז X (מ״מ)','','num')+field('f_y','מרכז Y (מ״מ)','','num')+'</div>'+field('f_h','גובה (מ״מ)','','num'); }
  var sizes = e.sizes ? sel('f_size','וריאנט/מידה',e.sizes) : '';
  document.getElementById('detail').innerHTML =
    '<h2>'+e.nameHe+'</h2><div class="badges">'+badges+'</div>'+
    '<div class="locate">📍 <b>שיטת מיקום:</b> '+DB.locate[lb]+(e.notes?'<br>ℹ️ '+e.notes:'')+'</div>'+
    '<div class="form">'+sizes+form+'<button class="add" id="addbtn">+ הוסף למדידה</button></div>';
  document.getElementById('addbtn').onclick=function(){ addItem(e); };
}
function v(id){ var el=document.getElementById(id); return el?el.value:''; }
function num(id){ var s=v(id); if(s===''||s==null){return null;} var n=parseFloat(s); return isNaN(n)?null:n; }
function addItem(e){
  var lb=e.locateBy;
  var p={
    catalogId:e.id, nameHe:e.nameHe, symbol:e.symbol, layer:e.layer, locateBy:lb,
    wallId:v('f_wall')||null, offset:null, height:num('f_h'), width:null, sill:num('f_sill'),
    count:null, spacing:null, cx:null, cy:null, size:v('f_size')||null
  };
  if(lb==='point'){ p.offset=num('f_off'); }
  else if(lb==='array'){ p.offset=num('f_off'); p.count=num('f_cnt'); p.spacing=num('f_sp'); }
  else if(lb==='span'){ var so=num('f_s'), eo=num('f_e'); p.offset=so; p.width=(so!=null&&eo!=null)?(eo-so):null; }
  else if(lb==='opening'){ p.offset=num('f_off'); p.width=num('f_w'); }
  else if(lb==='area'){ p.cx=num('f_x'); p.cy=num('f_y'); }
  var parts=[];
  if(p.wallId) parts.push(p.wallId);
  if(p.offset!=null) parts.push('היסט '+p.offset);
  if(p.count!=null) parts.push('×'+p.count+' @'+(p.spacing!=null?p.spacing:'?'));
  if(lb==='span'&&p.width!=null) parts.push(p.offset+'→'+(p.offset+p.width));
  if(lb==='opening'&&p.width!=null) parts.push('רוחב '+p.width);
  if(p.cx!=null) parts.push('XY '+p.cx+','+p.cy);
  if(p.height!=null) parts.push('גובה '+p.height);
  if(p.sill!=null) parts.push('סף '+p.sill);
  if(p.size) parts.push(p.size);
  p.name=e.nameHe; p.meta=parts.join(' · ');
  mlist.push(p);
  drawList();
}
// ---- DXF export (client-side, AutoCAD R12 / AC1009 ASCII) ----
function num2(id,def){ var el=document.getElementById(id); if(!el){return def;} var n=parseFloat(el.value); return isNaN(n)?def:n; }
function roomDims(){ return { W1:num2('rW1',3620), W2:num2('rW2',2400), W3:num2('rW3',3620), W4:num2('rW4',2400), H:num2('rWH',2743) }; }
function wallGeom(r){
  var V0=[0,0], V1=[r.W1,0], V2=[r.W1,r.W2], V3=[0,r.W2];
  return { W1:{s:V0,d:[1,0]}, W2:{s:V1,d:[0,1]}, W3:{s:V2,d:[-1,0]}, W4:{s:V3,d:[0,-1]}, verts:[V0,V1,V2,V3] };
}
function ptOnWall(g,wallId,off){ var w=g[wallId]||g.W1; off=off||0; return [w.s[0]+w.d[0]*off, w.s[1]+w.d[1]*off]; }
function resolvePoints(p,g){
  var pts=[];
  if(p.locateBy==='point'){ pts.push(ptOnWall(g,p.wallId,p.offset||0)); }
  else if(p.locateBy==='array'){ var n=Math.max(1,p.count||1); for(var i=0;i<n;i++){ pts.push(ptOnWall(g,p.wallId,(p.offset||0)+i*(p.spacing||0))); } }
  else if(p.locateBy==='span'){ pts.push(ptOnWall(g,p.wallId,p.offset||0)); pts.push(ptOnWall(g,p.wallId,(p.offset||0)+(p.width||0))); }
  else if(p.locateBy==='opening'){ pts.push(ptOnWall(g,p.wallId,p.offset||0)); pts.push(ptOnWall(g,p.wallId,(p.offset||0)+(p.width||0))); }
  else if(p.locateBy==='area'){ pts.push([p.cx||0,p.cy||0]); }
  return pts;
}
function layerColor(layer){
  var L=(layer||'').toUpperCase();
  if(L.indexOf('ELEC')===0) return 2;
  if(L.indexOf('LIGHT')===0) return 3;
  if(L.indexOf('PLUMB')===0||L.indexOf('GAS')===0) return 4;
  if(L.indexOf('DOOR')===0||L.indexOf('WINDOW')===0) return 3;
  if(L.indexOf('HVAC')===0) return 6;
  if(L.indexOf('WALL')===0) return 7;
  return 7;
}
function g2(a,code,val){ a.push(code); a.push(val); }
function dLine(a,L,p1,p2){ g2(a,0,'LINE'); g2(a,8,L); g2(a,10,p1[0]); g2(a,20,p1[1]); g2(a,30,0); g2(a,11,p2[0]); g2(a,21,p2[1]); g2(a,31,0); }
function dCircle(a,L,c,r){ g2(a,0,'CIRCLE'); g2(a,8,L); g2(a,10,c[0]); g2(a,20,c[1]); g2(a,30,0); g2(a,40,r); }
function dCross(a,L,c,arm){ dLine(a,L,[c[0]-arm,c[1]],[c[0]+arm,c[1]]); dLine(a,L,[c[0],c[1]-arm],[c[0],c[1]+arm]); }
function dSquare(a,L,c,side){ var h=side/2; var q=[[c[0]-h,c[1]-h],[c[0]+h,c[1]-h],[c[0]+h,c[1]+h],[c[0]-h,c[1]+h]]; dLine(a,L,q[0],q[1]); dLine(a,L,q[1],q[2]); dLine(a,L,q[2],q[3]); dLine(a,L,q[3],q[0]); }
function dText(a,L,pos,str,h){ g2(a,0,'TEXT'); g2(a,8,L); g2(a,10,pos[0]); g2(a,20,pos[1]+100); g2(a,30,0); g2(a,40,h); g2(a,1,str); }
function buildDXF(){
  var room=roomDims(); var g=wallGeom(room);
  var used={WALL:true}; mlist.forEach(function(p){ used[p.layer||'GEN']=true; });
  var layers=Object.keys(used);
  var a=[];
  g2(a,0,'SECTION'); g2(a,2,'HEADER');
  g2(a,9,'$ACADVER'); g2(a,1,'AC1009');
  g2(a,9,'$INSUNITS'); g2(a,70,4);
  g2(a,0,'ENDSEC');
  g2(a,0,'SECTION'); g2(a,2,'TABLES');
  g2(a,0,'TABLE'); g2(a,2,'LAYER'); g2(a,70,layers.length);
  layers.forEach(function(L){ g2(a,0,'LAYER'); g2(a,2,L); g2(a,70,0); g2(a,62,layerColor(L)); g2(a,6,'CONTINUOUS'); });
  g2(a,0,'ENDTAB'); g2(a,0,'ENDSEC');
  g2(a,0,'SECTION'); g2(a,2,'ENTITIES');
  var V=g.verts;
  dLine(a,'WALL',V[0],V[1]); dLine(a,'WALL',V[1],V[2]); dLine(a,'WALL',V[2],V[3]); dLine(a,'WALL',V[3],V[0]);
  mlist.forEach(function(p){
    var L=p.layer||'GEN'; var pts=resolvePoints(p,g);
    if(p.locateBy==='point'||p.locateBy==='array'){ pts.forEach(function(pt){ dCircle(a,L,pt,80); dCross(a,L,pt,60); }); }
    else if(p.locateBy==='span'||p.locateBy==='opening'){ if(pts.length>=2){ dLine(a,L,pts[0],pts[1]); } }
    else if(p.locateBy==='area'){ if(pts.length){ dSquare(a,L,pts[0],200); } }
    if(pts.length){ dText(a,L,pts[0],p.symbol||p.catalogId,120); }
  });
  g2(a,0,'ENDSEC'); g2(a,0,'EOF');
  return a.join('\n')+'\n';
}
function exportDXF(){
  if(mlist.length===0){ alert('אין אלמנטים לייצוא'); return; }
  var s=buildDXF();
  var blob=new Blob([s],{type:'application/dxf'});
  var url=URL.createObjectURL(blob);
  var aEl=document.createElement('a');
  aEl.href=url; aEl.download='soline-measurement.dxf';
  document.body.appendChild(aEl); aEl.click(); document.body.removeChild(aEl);
  setTimeout(function(){ URL.revokeObjectURL(url); },1000);
}
function drawList(){
  document.getElementById('cnt').textContent = mlist.length;
  document.getElementById('mlist').innerHTML = mlist.length===0 ? '<div class="empty">אין אלמנטים עדיין</div>' :
    mlist.map(function(it,i){ return '<div class="item"><div class="t">'+it.name+'</div><button class="rm" data-i="'+i+'">×</button><div class="m">'+(it.meta||'')+'</div></div>'; }).join('');
  document.querySelectorAll('.rm').forEach(function(b){ b.onclick=function(){ mlist.splice(+b.dataset.i,1); drawList(); }; });
}
document.getElementById('expdxf').onclick=exportDXF;
render();
</script>`;

const outDir = path.join(__dirname, "out");
fs.mkdirSync(outDir, { recursive: true });
const standalone = `<!doctype html>\n<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n${head}\n</head><body>\n${body}\n</body></html>\n`;
fs.writeFileSync(path.join(outDir, "picker.html"), standalone, "utf8");
fs.writeFileSync(path.join(outDir, "picker-artifact.html"), head + "\n" + body, "utf8");
console.log("picker generated ·", JSON.stringify(C.stats()));
