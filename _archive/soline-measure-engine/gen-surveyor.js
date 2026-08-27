// ============================================================================
// Soline · Surveyor Day Dashboard (phone) — generator
// ----------------------------------------------------------------------------
// The surveyor's phone app: receive jobs from the office, run each job through
// its lifecycle (request → contact client → check access → measure → submit →
// drive to next), manage the day's route, and capture times + km for the office
// to monitor. Includes carpenter-order intake with scope-based time estimation
// and scheduling recommendations. node gen-surveyor.js → out/surveyor.html
// ============================================================================
"use strict";
const fs = require("fs");
const path = require("path");

const head = `<title>Soline · דאשבורד המודד</title>
<style>
  :root{ --bg:#0c1420; --bezel:#0f1620; --scr:#f4f7fb; --panel:#fff; --panel2:#eef3f9; --line:#dde5f0; --line2:#c6d2e2;
    --ink:#0e1f36; --ink2:#42567a; --muted:#7688a5; --accent:#0d6fbf; --accent-d:#0a5aa0; --accent-soft:#e7f1fb;
    --go:#0a9d63; --go-soft:#e6f6ef; --warn:#c67c10; --warn-soft:#fbf1e0; --bad:#d23a3f; --bad-soft:#fdecec; --purple:#6b3fc9;
    --mono:ui-monospace,"SF Mono","Consolas",monospace; --sans:ui-sans-serif,system-ui,"Segoe UI","Arial Hebrew",Arial,sans-serif;
    --r:16px; --sh:0 8px 26px -14px rgba(16,40,80,.3); }
  @media(prefers-color-scheme:dark){ :root{ --scr:#0a111d; --panel:#101b2c; --panel2:#16233a; --line:#25344a; --line2:#33475f;
    --ink:#e8effb; --ink2:#b3c4e0; --muted:#8296b6; --accent:#5cc8ff; --accent-soft:#12283e; --go:#2fce8f; --go-soft:#0f2a20; --warn:#f5b544; --warn-soft:#2a2110; --bad:#ff6b70; --bad-soft:#2c1416; --purple:#a78bfa; } }
  *{box-sizing:border-box} html,body{height:100%}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased;display:grid;place-items:center;padding:16px}
  .mono{font-family:var(--mono);font-variant-numeric:tabular-nums}.ltr{direction:ltr;unicode-bidi:isolate}
  .phone{width:400px;max-width:100%;height:min(860px,94vh);background:var(--bezel);border-radius:42px;padding:12px;box-shadow:0 40px 90px -30px rgba(0,0,0,.8)}
  .app{width:100%;height:100%;background:var(--scr);border-radius:32px;overflow:hidden;direction:rtl;display:grid;grid-template-rows:auto 1fr auto;position:relative}
  @media(max-width:460px){body{padding:0}.phone{width:100%;height:100dvh;border-radius:0;padding:0}.app{border-radius:0}}

  .hd{padding:16px 18px 12px;background:var(--panel);border-bottom:1px solid var(--line)}
  .hd .row{display:flex;align-items:center;gap:10px}
  .hd .mk{width:34px;height:34px;border-radius:10px;background:var(--accent);color:#fff;display:grid;place-items:center;font-weight:800}
  .hd .who{font-weight:750;font-size:14px}.hd .who small{display:block;color:var(--muted);font-size:11px;font-family:var(--mono)}
  .hd .clock{margin-inline-start:auto;font-family:var(--mono);font-weight:700;font-size:15px;color:var(--accent)}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px}
  .stat{background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:9px 6px;text-align:center}
  .stat .v{font-family:var(--mono);font-weight:800;font-size:16px}.stat .k{font-size:9.5px;color:var(--muted);margin-top:1px}

  .view{overflow:auto;padding:14px 16px 18px}
  .eyebrow{font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:8px}

  /* route timeline */
  .job{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:13px 14px;margin-bottom:11px;box-shadow:var(--sh);cursor:pointer;position:relative;overflow:hidden}
  .job::before{content:"";position:absolute;inset-block:0;inset-inline-start:0;width:4px;background:var(--line2)}
  .job.cur::before{background:var(--accent)}.job.done::before{background:var(--go)}.job.active::before{background:var(--warn)}
  .job .top{display:flex;align-items:center;gap:8px}
  .job .nm{font-weight:750;font-size:15px}.job .eta{margin-inline-start:auto;font-family:var(--mono);font-size:12px;color:var(--muted)}
  .job .ad{font-size:12px;color:var(--ink2);margin-top:3px}
  .job .foot{display:flex;gap:8px;align-items:center;margin-top:9px;flex-wrap:wrap}
  .pill{font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:99px}
  .pill.sched{background:var(--panel2);color:var(--muted)}.pill.active{background:var(--warn-soft);color:var(--warn)}.pill.done{background:var(--go-soft);color:var(--go)}.pill.cur{background:var(--accent-soft);color:var(--accent)}
  .tag{font-size:10.5px;color:var(--muted);font-family:var(--mono)}
  .drive{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:11px;font-family:var(--mono);margin:2px 0 8px 8px}

  /* job detail */
  .back{border:none;background:transparent;color:var(--accent);font-weight:700;font-size:14px;cursor:pointer;padding:0;margin-bottom:8px}
  .dcard{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px;box-shadow:var(--sh)}
  .dcard h2{font-size:19px;font-weight:800;margin:0}.dcard .sub{color:var(--ink2);font-size:13px;margin-top:3px}
  .qa{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
  .qb{display:flex;align-items:center;justify-content:center;gap:7px;border:1px solid var(--line2);background:var(--panel2);border-radius:11px;padding:11px;font-weight:700;font-size:13px;cursor:pointer;color:var(--ink);text-decoration:none}
  .scope{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}
  .sc{font-size:11px;background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:4px 9px;color:var(--ink2)}
  .est{margin-top:12px;background:var(--accent-soft);border:1px solid var(--accent);border-radius:11px;padding:11px;font-size:12.5px;color:var(--ink2)}.est b{color:var(--accent)}
  /* lifecycle */
  .life{margin-top:14px}
  .ls{display:flex;gap:11px;padding:9px 0}
  .ls .dot{width:26px;height:26px;border-radius:50%;border:2px solid var(--line2);display:grid;place-items:center;font-size:12px;flex:0 0 auto;background:var(--panel);z-index:1}
  .ls.done .dot{background:var(--go);border-color:var(--go);color:#fff}.ls.cur .dot{background:var(--accent);border-color:var(--accent);color:#fff}
  .ls .body{flex:1}.ls .t{font-weight:650;font-size:13.5px}.ls .tm{font-family:var(--mono);font-size:11px;color:var(--muted)}
  .ls-wrap{position:relative}.ls-wrap::before{content:"";position:absolute;inset-block:13px;inset-inline-start:13px;width:2px;background:var(--line)}
  .action{margin-top:14px}
  .bigb{width:100%;border:none;border-radius:14px;padding:17px;font-weight:800;font-size:16px;background:var(--accent);color:#fff;cursor:pointer}
  .bigb.go{background:var(--go)}.bigb.warn{background:var(--warn)}
  .bigb:disabled{opacity:.4}

  /* intake / estimate */
  .intake{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:15px;margin-bottom:12px;box-shadow:var(--sh)}
  .intake .from{font-size:11px;color:var(--muted);font-family:var(--mono)}
  .intake h3{font-size:15px;font-weight:750;margin:3px 0 0}
  .estbar{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}
  .eb{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:9px 6px;text-align:center}.eb .v{font-family:var(--mono);font-weight:800;font-size:15px}.eb .k{font-size:9.5px;color:var(--muted)}
  .reco{background:var(--go-soft);border:1px solid var(--go);border-radius:10px;padding:10px;font-size:12.5px;color:var(--ink2);margin-bottom:10px}.reco b{color:var(--go)}
  .rowbtn{display:grid;grid-template-columns:1fr auto;gap:8px}
  .btn{border:none;border-radius:12px;padding:12px;font-weight:800;font-size:13.5px;background:var(--accent);color:#fff;cursor:pointer}.btn.sec{background:transparent;border:1px solid var(--line2);color:var(--ink)}

  /* day monitor */
  .mono-head{font-size:12px;color:var(--muted);margin-bottom:10px}
  .tl{position:relative;padding-inline-start:20px}.tl::before{content:"";position:absolute;inset-block:6px;inset-inline-start:6px;width:2px;background:var(--line)}
  .tle{position:relative;margin-bottom:12px}.tle::before{content:"";position:absolute;inset-inline-start:-17px;inset-block-start:4px;width:11px;height:11px;border-radius:50%;background:var(--accent);border:2px solid var(--scr)}
  .tle .h{display:flex;align-items:center;gap:8px}.tle .tm{font-family:var(--mono);font-size:12px;color:var(--accent);font-weight:700}.tle .nm{font-weight:700;font-size:13.5px}
  .tle .bd{font-size:12px;color:var(--ink2);margin-top:2px}
  .mrow{display:flex;justify-content:space-between;font-size:12.5px;padding:7px 0;border-bottom:1px solid var(--line)}.mrow b{font-family:var(--mono)}

  /* bottom nav */
  .nav{display:grid;grid-template-columns:repeat(4,1fr);background:var(--panel);border-top:1px solid var(--line)}
  .nav button{border:none;background:transparent;padding:10px 4px 12px;display:flex;flex-direction:column;gap:3px;align-items:center;color:var(--muted);cursor:pointer;font-family:var(--sans);font-size:10.5px;font-weight:650;position:relative}
  .nav button .i{font-size:19px}.nav button[aria-current="true"]{color:var(--accent)}
  .nav .bdg{position:absolute;top:6px;inset-inline-start:calc(50% + 8px);background:var(--bad);color:#fff;font-size:9px;font-weight:800;border-radius:9px;padding:0 5px;font-family:var(--mono)}
  .empty{color:var(--muted);font-size:13px;text-align:center;padding:30px 16px}
  .toast{position:absolute;inset-block-end:80px;inset-inline:0;margin:auto;width:max-content;max-width:80%;background:var(--ink);color:var(--scr);padding:10px 16px;border-radius:11px;font-size:13px;font-weight:600;opacity:0;transform:translateY(8px);transition:.25s;pointer-events:none;z-index:30}.toast.show{opacity:1;transform:none}
</style>`;

const body = `<div class="phone"><div class="app">
  <div class="hd">
    <div class="row"><div class="mk">S</div><div class="who">מיכאל · מודד<small id="today"></small></div><div class="clock" id="clock">08:00</div></div>
    <div class="stats" id="stats"></div>
  </div>
  <div class="view" id="view"></div>
  <div class="nav" id="nav"></div>
  <div class="toast" id="toast"></div>
</div></div>
<script>
function est(j){var base=j.type=='stone'?50:40;var scope=(j.scope.counters||1)*8+(j.scope.cutouts||0)*6+(j.scope.openings||0)*5;var measure=base+scope;var travel=Math.round(j.distanceKm/40*60);return{measure:measure,travel:travel,onsite:measure+20,total:measure+travel+20};}
var LIFE=[
 {id:"scheduled",t:"התקבלה מהמשרד"},
 {id:"enroute",t:"בדרך ללקוח",act:"יצא לדרך",dt:"travel",km:true},
 {id:"contacted",t:"יצירת קשר עם הלקוחה",act:"הגעתי + התקשרתי",dt:0},
 {id:"access",t:"בדיקת גישה",act:"גישה תקינה",dt:5},
 {id:"measuring",t:"מדידה",act:"פתח מדידה",link:1,dt:0},
 {id:"done",t:"סיום מדידה",act:"סיימתי למדוד",dt:"measure"},
 {id:"submitted",t:"הגשה לנגר",act:"הגשתי את העבודה",dt:5}
];
var st=load()||{
  clock:480, km:0, screen:"route", jobId:null,
  jobs:[
    {id:1,client:"שיש שגב",address:"קרית אתא · הנמל 4",carpenter:"נגריית שגב",type:"stone",scope:{counters:2,cutouts:2,openings:0},distanceKm:12,stage:0,times:{}},
    {id:2,client:"מטבחי גנדי",address:"חיפה · הרצל 88",carpenter:"מטבחי גנדי",type:"kitchen",scope:{counters:1,cutouts:1,openings:1},distanceKm:8,stage:0,times:{}},
    {id:3,client:"אושרת ינקו",address:"רוטשילד 22 · ק13",carpenter:"טריו עיצובים",type:"stone",scope:{counters:2,cutouts:3,openings:1},distanceKm:19,stage:0,times:{}}
  ],
  intake:[{id:99,carpenter:"אדור קונספט",client:"משפחת לוי",address:"נשר · הבנים 12",type:"kitchen",scope:{counters:2,cutouts:2,openings:1},distanceKm:10}]
};
function save(){try{localStorage.setItem("soline-surveyor",JSON.stringify(st));}catch(e){}}
function load(){try{var s=localStorage.getItem("soline-surveyor");return s?JSON.parse(s):null;}catch(e){return null;}}
function fmt(m){var h=Math.floor(m/60),mm=Math.round(m%60);return(h<10?'0':'')+h+':'+(mm<10?'0':'')+mm;}
function toast(m){var t=document.getElementById('toast');t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(function(){t.classList.remove('show');},1600);}

/* route ETAs (planned from 08:00) */
function planned(){var t=480,out={};st.jobs.forEach(function(j){var e=est(j);t+=e.travel;out[j.id]={arrive:t};t+=e.onsite;});return out;}
function stats(){var done=st.jobs.filter(function(j){return j.stage>=6;}).length;var left=st.jobs.length-done;
  document.getElementById('stats').innerHTML=
   '<div class="stat"><div class="v">'+done+'/'+st.jobs.length+'</div><div class="k">עבודות</div></div>'+
   '<div class="stat"><div class="v">'+st.km+'</div><div class="k">ק״מ</div></div>'+
   '<div class="stat"><div class="v">'+fmt(st.clock).replace(':','.')+'</div><div class="k">שעה</div></div>'+
   '<div class="stat"><div class="v">'+left+'</div><div class="k">נותרו</div></div>';
  document.getElementById('clock').textContent=fmt(st.clock);
  document.getElementById('today').textContent="יום ב׳ · 4 עבודות מתוכננות";}

var NAV=[["route","🗺️","היום"],["queue","📥","תור"],["track","📋","מעקב"],["day","⏱️","יום"]];
function nav(){document.getElementById('nav').innerHTML=NAV.map(function(n){var bd=n[0]=="queue"&&st.intake.length?('<span class="bdg">'+st.intake.length+'</span>'):'';return '<button data-s="'+n[0]+'" aria-current="'+(st.screen==n[0])+'"><span class="i">'+n[1]+'</span>'+n[2]+bd+'</button>';}).join('');
  document.querySelectorAll('.nav button').forEach(function(b){b.onclick=function(){st.screen=b.dataset.s;st.jobId=null;render();};});}

function render(){stats();nav();var v=document.getElementById('view');
  if(st.jobId)v.innerHTML=jobDetail();else v.innerHTML=SCR[st.screen]();
  wire();save();}

var SCR={
 route:function(){var pl=planned();return '<div class="eyebrow">מסלול היום</div>'+st.jobs.map(function(j,i){var cls=j.stage>=6?'done':(j.stage>0?'active':(firstOpen()==j.id?'cur':''));var e=est(j);
   var drive=i>0?'<div class="drive">🚗 נסיעה ~'+est(st.jobs[i]).travel+' ד׳ · '+j.distanceKm+' ק״מ</div>':'';
   return drive+'<div class="job '+cls+'" data-j="'+j.id+'"><div class="top"><span class="nm">'+j.client+'</span><span class="eta">'+fmt(pl[j.id].arrive)+'</span></div><div class="ad">'+j.address+'</div><div class="foot"><span class="pill '+(j.stage>=6?'done':j.stage>0?'active':'cur')+'">'+(j.stage>=6?'הוגש ✓':j.stage>0?LIFE[j.stage].t:'ממתין')+'</span><span class="tag">'+(j.type=='stone'?'שיש':'מטבח')+' · ~'+e.onsite+' ד׳</span><span class="tag" style="margin-inline-start:auto">'+j.carpenter+'</span></div></div>';}).join('');},

 queue:function(){if(!st.intake.length)return '<div class="empty">אין בקשות חדשות מהמשרד.</div>';
   return '<div class="eyebrow">בקשות נכנסות מהנגרים</div>'+st.intake.map(function(o){var e=est(o);var pl=planned();var last=st.jobs.length?planned()[st.jobs[st.jobs.length-1].id].arrive+est(st.jobs[st.jobs.length-1]).onsite:480;var slot=last+e.travel;
   return '<div class="intake"><div class="from">הזמנה מ: '+o.carpenter+'</div><h3>'+o.client+'</h3><div class="ad" style="font-size:12px;color:var(--ink2);margin-top:3px">'+o.address+' · '+o.distanceKm+' ק״מ · '+(o.type=="stone"?"שיש":"מטבח")+'</div>'+
   '<div class="scope">'+scopeTags(o.scope)+'</div>'+
   '<div class="estbar"><div class="eb"><div class="v">'+e.measure+'\\'</div><div class="k">מדידה</div></div><div class="eb"><div class="v">'+e.travel+'\\'</div><div class="k">נסיעה</div></div><div class="eb"><div class="v">'+e.total+'\\'</div><div class="k">סה״כ</div></div></div>'+
   '<div class="reco">💡 המלצת שיבוץ: <b>אחרי '+(st.jobs.length?st.jobs[st.jobs.length-1].client:'תחילת היום')+' (~'+fmt(slot)+')</b> — תוספת נסיעה מינימלית.</div>'+
   '<div class="rowbtn"><button class="btn" data-accept="'+o.id+'">שבץ ליום</button><button class="btn sec" data-reject="'+o.id+'">דחה</button></div></div>';}).join('');},

 track:function(){return '<div class="eyebrow">מעקב מדידות</div>'+st.jobs.map(function(j){var pill=j.stage>=6?'done':j.stage>0?'active':'sched';return '<div class="job" data-j="'+j.id+'"><div class="top"><span class="nm">'+j.client+'</span><span class="pill '+pill+'" style="margin-inline-start:auto">'+(j.stage>=6?'הוגש ✓':j.stage>0?LIFE[j.stage].t:'ממתין')+'</span></div><div class="ad">'+j.carpenter+' · '+j.address+'</div></div>';}).join('');},

 day:function(){var tl='';st.jobs.forEach(function(j){if(j.stage==0)return;LIFE.forEach(function(s,i){if(j.times[s.id]!=null&&s.id!="scheduled")tl+='<div class="tle"><div class="h"><span class="tm">'+fmt(j.times[s.id])+'</span><span class="nm">'+j.client+'</span></div><div class="bd">'+s.t+'</div></div>';});});
   var driveMin=0,onsiteMin=0;st.jobs.forEach(function(j){var e=est(j);if(j.stage>=2)driveMin+=e.travel;if(j.stage>=6)onsiteMin+=e.onsite;});
   return '<div class="eyebrow">מה שהמשרד רואה · ניטור יום</div><div class="mono-head">כל שלב מתועד אוטומטית עם שעה וק״מ.</div>'+
   '<div class="dcard" style="margin-bottom:12px"><div class="mrow"><span>סה״כ ק״מ</span><b>'+st.km+' ק״מ</b></div><div class="mrow"><span>זמן נסיעה</span><b>'+driveMin+' ד׳</b></div><div class="mrow"><span>זמן באתרים</span><b>'+onsiteMin+' ד׳</b></div><div class="mrow"><span>עבודות שהוגשו</span><b>'+st.jobs.filter(function(j){return j.stage>=6;}).length+'</b></div></div>'+
   (tl?'<div class="tl">'+tl+'</div>':'<div class="empty">היום עוד לא התחיל — התחל עבודה ראשונה.</div>');}
};
function scopeTags(sc){var a=[];if(sc.counters)a.push(sc.counters+' משטחים');if(sc.cutouts)a.push(sc.cutouts+' פתחים');if(sc.openings)a.push(sc.openings+' חלונות/דלתות');return a.map(function(t){return '<span class="sc">'+t+'</span>';}).join('');}
function firstOpen(){var j=st.jobs.find(function(x){return x.stage<6;});return j?j.id:null;}

function jobDetail(){var j=st.jobs.find(function(x){return x.id==st.jobId;});if(!j)return '';var e=est(j);
  var life='<div class="ls-wrap">'+LIFE.map(function(s,i){var cls=i<j.stage?'done':i==j.stage?'cur':'';return '<div class="ls '+cls+'"><div class="dot">'+(i<j.stage?'✓':i+1)+'</div><div class="body"><div class="t">'+s.t+'</div>'+(j.times[s.id]!=null?'<div class="tm">'+fmt(j.times[s.id])+(s.km&&j.times['km_'+s.id]?' · '+j.times['km_'+s.id]+' ק״מ':'')+'</div>':'')+'</div></div>';}).join('')+'</div>';
  var action='';
  if(j.stage<LIFE.length){var s=LIFE[j.stage];var cls=s.id=="measuring"?'warn':(j.stage==LIFE.length-1?'go':'');
    action='<div class="action"><button class="bigb '+cls+'" id="adv">'+(s.act||'המשך')+(s.link?' ↗':'')+'</button></div>';}
  else action='<div class="est" style="text-align:center;color:var(--go);border-color:var(--go);background:var(--go-soft)">✓ העבודה הוגשה. סע למדידה הבאה.</div>';
  return '<button class="back" id="back">← חזרה למסלול</button>'+
   '<div class="dcard"><h2>'+j.client+'</h2><div class="sub">'+j.address+' · הזמנה מ'+j.carpenter+'</div>'+
   '<div class="qa"><a class="qb" href="tel:0500000000">📞 התקשר ללקוחה</a><a class="qb" href="https://maps.google.com/?q='+encodeURIComponent(j.address)+'" target="_blank">🧭 ניווט</a></div>'+
   '<div class="scope">'+scopeTags(j.scope)+'<span class="sc">'+(j.type=="stone"?"שיש ±1.5":"מטבח ±3")+' מ״מ</span></div>'+
   '<div class="est">⏱️ הערכה: מדידה <b>'+e.measure+' ד׳</b> · נסיעה <b>'+e.travel+' ד׳</b> · '+j.distanceKm+' ק״מ</div>'+
   '<div class="life">'+life+'</div>'+action+'</div>';}

function wire(){
  document.querySelectorAll('.job[data-j]').forEach(function(b){b.onclick=function(){st.jobId=+b.dataset.j;render();};});
  var back=document.getElementById('back');if(back)back.onclick=function(){st.jobId=null;render();};
  var adv=document.getElementById('adv');if(adv)adv.onclick=advance;
  document.querySelectorAll('[data-accept]').forEach(function(b){b.onclick=function(){acceptOrder(+b.dataset.accept);};});
  document.querySelectorAll('[data-reject]').forEach(function(b){b.onclick=function(){st.intake=st.intake.filter(function(o){return o.id!=+b.dataset.reject;});render();toast("הבקשה נדחתה");};});
}
function advance(){var j=st.jobs.find(function(x){return x.id==st.jobId;});if(!j||j.stage>=LIFE.length)return;var s=LIFE[j.stage];var e=est(j);
  // advance clock
  var add=s.dt=="travel"?e.travel:(s.dt=="measure"?e.measure:(s.dt||0));st.clock+=add;
  if(s.km){st.km+=j.distanceKm;j.times['km_'+s.id]=j.distanceKm;}
  j.stage++;var ns=LIFE[j.stage]?LIFE[j.stage]:null;if(ns)j.times[ns.id]=st.clock;
  if(s.link){toast("פותח את אפליקציית המדידה…");}
  else toast(s.act+" ✓");
  save();render();}
function acceptOrder(id){var o=st.intake.find(function(x){return x.id==id;});if(!o)return;st.intake=st.intake.filter(function(x){return x.id!=id;});
  st.jobs.push({id:Date.now()%100000,client:o.client,address:o.address,carpenter:o.carpenter,type:o.type,scope:o.scope,distanceKm:o.distanceKm,stage:0,times:{}});
  st.screen="route";toast("שובץ למסלול היום");render();}

render();
</script>`;

const outDir = path.join(__dirname, "out");
fs.mkdirSync(outDir, { recursive: true });
const standalone = `<!doctype html>\n<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0d6fbf">\n${head}\n</head><body>\n${body}\n</body></html>\n`;
fs.writeFileSync(path.join(outDir, "surveyor.html"), standalone, "utf8");
fs.writeFileSync(path.join(outDir, "surveyor-artifact.html"), head + "\n" + body, "utf8");
console.log("surveyor dashboard generated");
