// app.js — ראוטר + מסכים. offline-first, RTL עברית.
import { db, uid, STAGES, stageOf, nextStage, ensureSeed, saveJob, advanceJob } from './db.js';

const view = document.getElementById('view');
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const TYPE_HE = { kitchen: 'מטבח', electrical: 'חשמל', full: 'מלא', other: 'אחר' };
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }) : '—';
const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const dayName = (iso) => new Date(iso).toLocaleDateString('he-IL', { weekday: 'long' });

// ── net indicator ──────────────────────────────────────────────
function paintNet() {
  const p = document.getElementById('netPill');
  const on = navigator.onLine;
  p.textContent = on ? '● מקוון' : '● לא מקוון';
  p.classList.toggle('off', !on);
}
addEventListener('online', paintNet); addEventListener('offline', paintNet);

// ── router ─────────────────────────────────────────────────────
const routes = [];
const route = (re, handler) => routes.push({ re, handler });
async function render() {
  const hash = location.hash || '#/board';
  for (const r of routes) {
    const m = hash.match(r.re);
    if (m) { await r.handler(...m.slice(1)); syncNav(hash); window.scrollTo(0, 0); return; }
  }
  view.innerHTML = `<div class="empty">מסך לא נמצא</div>`;
}
function syncNav(hash) {
  document.querySelectorAll('#nav button').forEach((b) =>
    b.setAttribute('aria-current', hash.startsWith(b.dataset.route) ? 'true' : 'false'));
}
addEventListener('hashchange', render);
const go = (h) => (location.hash = h);

// ── helpers ────────────────────────────────────────────────────
async function surveyorMap() {
  const arr = await db.all('surveyors');
  return Object.fromEntries(arr.map((s) => [s.id, s]));
}
async function clientMap() {
  const arr = await db.all('clients');
  return Object.fromEntries(arr.map((c) => [c.id, c]));
}
function jobCard(job, clients, surveyors) {
  const st = stageOf(job.stage);
  const cl = clients[job.clientId];
  const sv = surveyors[job.surveyorId];
  return `<div class="card" data-go="#/job/${job.id}">
    <div class="row">
      <span class="code mono">${esc(job.code)}</span>
      <span class="spacer"></span>
      <span class="badge b-${st.color}">${st.label}</span>
    </div>
    <div class="name">${esc(cl ? cl.name : 'לקוח')}</div>
    <div class="addr">📍 ${esc(job.address || (cl && cl.address) || '')}</div>
    <div class="meta">
      <span class="tag">${TYPE_HE[job.type] || job.type}</span>
      ${sv ? `<span class="who"><span class="dot" style="background:${sv.color}"></span>${esc(sv.name)}</span>` : `<span class="tag" style="color:var(--warn)">לא שובץ</span>`}
      ${job.scheduledAt ? `<span class="tag mono">${fmtDate(job.scheduledAt)}</span>` : ''}
    </div>
  </div>`;
}
// הפעלת ניווט על כל אלמנט עם data-go
function wireGo(root = view) {
  root.querySelectorAll('[data-go]').forEach((e) =>
    e.addEventListener('click', () => go(e.dataset.go)));
}

// ── מסך: לוח עבודות ────────────────────────────────────────────
let boardFilter = 'active';
route(/^#\/board$/, async () => {
  const [jobs, clients, surveyors] = [await db.all('jobs'), await clientMap(), await surveyorMap()];
  const active = jobs.filter((j) => j.stage !== 'delivered');
  const filters = [
    { key: 'active', label: `פעילות · ${active.length}` },
    { key: 'all', label: `הכול · ${jobs.length}` },
    ...STAGES.map((s) => ({ key: s.key, label: `${s.label} · ${jobs.filter((j) => j.stage === s.key).length}` })),
  ];
  let list = boardFilter === 'active' ? active : boardFilter === 'all' ? jobs : jobs.filter((j) => j.stage === boardFilter);
  list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  view.innerHTML = `
    <div class="head"><div><h1>עבודות</h1><div class="sub">מערך תפעול מדידות</div></div></div>
    <div class="chips">${filters.map((f) =>
      `<button class="chip" data-f="${f.key}" aria-current="${f.key === boardFilter}">${f.label}</button>`).join('')}</div>
    ${list.length ? list.map((j) => jobCard(j, clients, surveyors)).join('')
      : `<div class="empty">אין עבודות בסינון הזה</div>`}`;

  view.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => { boardFilter = c.dataset.f; render(); }));
  wireGo();
});

// ── מסך: לו״ז ──────────────────────────────────────────────────
route(/^#\/schedule$/, async () => {
  const [jobs, clients, surveyors] = [await db.all('jobs'), await clientMap(), await surveyorMap()];
  const sched = jobs.filter((j) => j.scheduledAt).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const byDay = {};
  for (const j of sched) { const d = j.scheduledAt.slice(0, 10); (byDay[d] ||= []).push(j); }

  view.innerHTML = `
    <div class="head"><div><h1>לו״ז</h1><div class="sub">עבודות משובצות לפי יום</div></div></div>
    ${Object.keys(byDay).length ? Object.entries(byDay).map(([d, js]) => `
      <div class="section">
        <h3>${dayName(d)} · ${new Date(d).toLocaleDateString('he-IL')}</h3>
        ${js.map((j) => {
          const sv = surveyors[j.surveyorId]; const cl = clients[j.clientId];
          return `<div class="kv" data-go="#/job/${j.id}" style="cursor:pointer">
            <span class="k">${new Date(j.scheduledAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} · ${esc(cl ? cl.name : '')}</span>
            <span class="v">${sv ? `<span class="dot" style="display:inline-block;background:${sv.color}"></span> ${esc(sv.name)}` : 'לא שובץ'}</span>
          </div>`;
        }).join('')}
      </div>`).join('')
      : `<div class="empty">אין עבודות משובצות</div>`}`;
  wireGo();
});

// ── מסך: מודדים ────────────────────────────────────────────────
route(/^#\/surveyors$/, async () => {
  const [surveyors, jobs] = [await db.all('surveyors'), await db.all('jobs')];
  view.innerHTML = `
    <div class="head"><div><h1>מודדים</h1><div class="sub">צוות השטח</div></div></div>
    ${surveyors.map((s) => {
      const load = jobs.filter((j) => j.surveyorId === s.id && j.stage !== 'delivered').length;
      return `<div class="card" style="cursor:default">
        <div class="row"><span class="dot" style="background:${s.color};width:12px;height:12px"></span>
          <span class="name" style="margin:0">${esc(s.name)}</span>
          <span class="spacer"></span><span class="badge b-accent">${load} פעילות</span></div>
        <div class="addr">📞 ${esc(s.phone)}</div>
      </div>`;
    }).join('')}`;
});

// ── מסך: פרטי עבודה ────────────────────────────────────────────
route(/^#\/job\/([^/]+)$/, async (id) => {
  const job = await db.get('jobs', id);
  if (!job) return go('#/board');
  const [clients, surveyors] = [await clientMap(), await surveyorMap()];
  const cl = clients[job.clientId]; const sv = surveyors[job.surveyorId];
  const curIdx = STAGES.findIndex((s) => s.key === job.stage);
  const meas = await db.byIndex('measurements', 'jobId', id);
  const delivs = await db.byIndex('deliverables', 'jobId', id);

  const nextK = nextStage(job.stage);
  const nextLabel = nextK !== job.stage ? stageOf(nextK).label : null;

  view.innerHTML = `
    <div class="head"><button class="back" data-go="#/board">→</button>
      <div><h1>${esc(cl ? cl.name : 'עבודה')}</h1><div class="sub mono">${esc(job.code)} · ${TYPE_HE[job.type] || job.type}</div></div></div>

    <div class="section"><h3>שלב</h3>
      <div class="rail">${STAGES.map((s, i) =>
        `<span class="step ${i < curIdx ? 'done' : ''} ${i === curIdx ? 'cur' : ''}">${s.label}</span>`).join('')}</div>
    </div>

    <div class="section"><h3>פרטים</h3>
      <div class="kv"><span class="k">לקוח</span><span class="v">${esc(cl ? cl.name : '—')}</span></div>
      <div class="kv"><span class="k">טלפון</span><span class="v mono">${esc(cl ? cl.phone : '—')}</span></div>
      <div class="kv"><span class="k">כתובת</span><span class="v">${esc(job.address || (cl && cl.address) || '—')}</span></div>
      <div class="kv"><span class="k">מודד</span><span class="v">${sv ? esc(sv.name) : 'לא שובץ'}</span></div>
      <div class="kv"><span class="k">מועד</span><span class="v mono">${fmtDateTime(job.scheduledAt)}</span></div>
    </div>

    <div class="section"><h3>פעולות</h3>
      <div class="grid2" style="margin-bottom:10px">
        <button class="btn ghost" data-go="#/job/${id}/schedule">🗓️ שיבוץ</button>
        <button class="btn ghost" data-go="#/job/${id}/capture">📐 קליטת מדידה</button>
      </div>
      <button class="btn ghost" data-go="#/job/${id}/deliver" style="margin-bottom:10px">📤 תוצרים ומסירה ${delivs.length ? `· ${delivs.length}` : ''}</button>
      ${nextLabel ? `<button class="btn go" id="advance">קדם לשלב הבא → ${nextLabel}</button>` : `<span class="empty">העבודה נמסרה ✓</span>`}
    </div>

    ${meas.length ? `<div class="section"><h3>מדידות שטח</h3>
      ${meas.map((m) => `<div class="kv"><span class="k mono">${fmtDateTime(m.capturedAt)}</span>
        <span class="v">${(m.files || []).length} קבצים · ${esc(m.rooms || '')}</span></div>`).join('')}</div>` : ''}

    <div class="section"><h3>יומן</h3>
      <ul class="tl">${(job.history || []).slice().reverse().map((h) =>
        `<li><div class="t">${stageOf(h.stage).label}</div><div class="d">${fmtDateTime(h.at)} · ${esc(h.by || '')}</div></li>`).join('')}</ul>
    </div>`;

  wireGo();
  const adv = $('#advance');
  if (adv) adv.addEventListener('click', async () => {
    await advanceJob(job, nextK);
    render();
  });
});

// ── מסך: שיבוץ ─────────────────────────────────────────────────
route(/^#\/job\/([^/]+)\/schedule$/, async (id) => {
  const job = await db.get('jobs', id);
  if (!job) return go('#/board');
  const surveyors = await db.all('surveyors');
  view.innerHTML = `
    <div class="head"><button class="back" data-go="#/job/${id}">→</button><div><h1>שיבוץ</h1><div class="sub mono">${esc(job.code)}</div></div></div>
    <div class="section">
      <label>מודד</label>
      <select id="sv">${surveyors.map((s) => `<option value="${s.id}" ${s.id === job.surveyorId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
      <label>תאריך ושעה</label>
      <input id="dt" type="datetime-local">
      <div style="height:16px"></div>
      <button class="btn" id="save">שמור שיבוץ</button>
    </div>`;
  wireGo();
  if (job.scheduledAt) $('#dt').value = new Date(job.scheduledAt).toISOString().slice(0, 16);
  $('#save').addEventListener('click', async () => {
    job.surveyorId = $('#sv').value;
    const dt = $('#dt').value; job.scheduledAt = dt ? new Date(dt).toISOString() : job.scheduledAt;
    if (job.stage === 'new') await advanceJob(job, 'scheduled', 'שיבוץ'); else await saveJob(job);
    go(`#/job/${id}`);
  });
});

// ── מסך: קליטת מדידה ───────────────────────────────────────────
route(/^#\/job\/([^/]+)\/capture$/, async (id) => {
  const job = await db.get('jobs', id);
  if (!job) return go('#/board');
  view.innerHTML = `
    <div class="head"><button class="back" data-go="#/job/${id}">→</button><div><h1>קליטת מדידה</h1><div class="sub mono">${esc(job.code)}</div></div></div>
    <div class="section">
      <label>חדרים / אזורים שנמדדו</label>
      <input id="rooms" placeholder="למשל: מטבח, ממ״ד, סלון">
      <label>קובץ מדידה (ORDX)</label>
      <input id="file" type="file" accept=".ordx,.xml">
      <label>הערות שטח</label>
      <textarea id="notes" placeholder="הערות, אילוצים, מה לצלם..."></textarea>
      <div style="height:16px"></div>
      <button class="btn go" id="save">שמור מדידה וסמן כ״נמדדה DR1״</button>
    </div>`;
  wireGo();
  $('#save').addEventListener('click', async () => {
    const f = $('#file').files[0];
    const m = {
      id: uid(), jobId: id, capturedAt: new Date().toISOString(), surveyorId: job.surveyorId,
      rooms: $('#rooms').value, fieldNotes: $('#notes').value,
      files: f ? [{ name: f.name, kind: f.name.toLowerCase().endsWith('.ordx') ? 'ordx' : 'file', size: f.size }] : [],
      disto: [],
    };
    await db.put('measurements', m);
    if (STAGES.findIndex((s) => s.key === job.stage) < STAGES.findIndex((s) => s.key === 'measured'))
      await advanceJob(job, 'measured', 'מדידה');
    go(`#/job/${id}`);
  });
});

// ── מסך: תוצרים ומסירה ─────────────────────────────────────────
const DELIV_KINDS = [{ k: 'dxf2d', l: 'DXF 2D' }, { k: 'dxf3d', l: 'DXF 3D' }, { k: 'pdp', l: 'PDP' }, { k: 'pdf', l: 'PDF' }];
route(/^#\/job\/([^/]+)\/deliver$/, async (id) => {
  const job = await db.get('jobs', id);
  if (!job) return go('#/board');
  const delivs = await db.byIndex('deliverables', 'jobId', id);
  const byKind = Object.fromEntries(delivs.map((d) => [d.kind, d]));
  view.innerHTML = `
    <div class="head"><button class="back" data-go="#/job/${id}">→</button><div><h1>תוצרים ומסירה</h1><div class="sub mono">${esc(job.code)}</div></div></div>
    <div class="section"><h3>תוצרים</h3>
      ${DELIV_KINDS.map(({ k, l }) => {
        const d = byKind[k];
        const st = d ? d.status : 'missing';
        const badge = st === 'sent' ? 'b-go' : st === 'approved' ? 'b-accent' : st === 'pending' ? 'b-warn' : 'b-muted';
        const txt = st === 'sent' ? 'נמסר' : st === 'approved' ? 'מאושר' : st === 'pending' ? 'ממתין' : 'חסר';
        return `<div class="kv"><span class="k">${l}</span>
          <span class="v"><button class="badge ${badge}" data-kind="${k}" style="border:0;cursor:pointer">${txt} ▸</button></span></div>`;
      }).join('')}
    </div>
    <div class="section">
      <button class="btn go" id="deliver" ${job.stage === 'delivered' ? 'disabled' : ''}>סמן כ״נמסר ללקוח״</button>
    </div>`;
  wireGo();
  // מחזור סטטוס תוצר בלחיצה
  view.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', async () => {
    const kind = b.dataset.kind;
    const order = ['missing', 'pending', 'approved', 'sent'];
    const cur = byKind[kind] ? byKind[kind].status : 'missing';
    const nx = order[(order.indexOf(cur) + 1) % order.length];
    const rec = byKind[kind] || { id: uid(), jobId: id, kind, fileName: `${job.code}.${kind}` };
    rec.status = nx === 'missing' ? 'pending' : nx; rec.at = new Date().toISOString();
    await db.put('deliverables', rec);
    render();
  }));
  $('#deliver').addEventListener('click', async () => { await advanceJob(job, 'delivered', 'מסירה'); go(`#/job/${id}`); });
});

// ── מסך: עבודה חדשה ────────────────────────────────────────────
route(/^#\/new$/, async () => {
  const clients = await db.all('clients');
  view.innerHTML = `
    <div class="head"><button class="back" data-go="#/board">→</button><div><h1>עבודה חדשה</h1></div></div>
    <div class="section">
      <label>לקוח קיים</label>
      <select id="client"><option value="">— לקוח חדש —</option>
        ${clients.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
      <div id="newClient">
        <label>שם לקוח</label><input id="cname" placeholder="שם">
        <label>טלפון</label><input id="cphone" inputmode="tel" placeholder="050-...">
      </div>
      <label>כתובת</label><input id="addr" placeholder="רחוב, עיר">
      <label>סוג עבודה</label>
      <select id="type"><option value="kitchen">מטבח</option><option value="electrical">חשמל</option><option value="full">מלא</option><option value="other">אחר</option></select>
      <div style="height:16px"></div>
      <button class="btn" id="save">צור עבודה</button>
    </div>`;
  wireGo();
  const toggle = () => { $('#newClient').style.display = $('#client').value ? 'none' : 'block'; };
  $('#client').addEventListener('change', toggle); toggle();
  $('#save').addEventListener('click', async () => {
    let clientId = $('#client').value;
    if (!clientId) {
      const c = { id: uid(), name: $('#cname').value || 'לקוח חדש', phone: $('#cphone').value, address: $('#addr').value, createdAt: new Date().toISOString() };
      await db.put('clients', c); clientId = c.id;
    }
    const all = await db.all('jobs');
    const code = `2026-0${140 + all.length + 1}`;
    const job = {
      id: uid(), code, clientId, address: $('#addr').value, type: $('#type').value,
      stage: 'new', surveyorId: null, scheduledAt: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), notes: '',
      history: [{ stage: 'new', at: new Date().toISOString(), by: 'משתמש' }],
    };
    await db.put('jobs', job);
    go(`#/job/${job.id}`);
  });
});

// ── bootstrap ──────────────────────────────────────────────────
document.getElementById('fab').addEventListener('click', () => go('#/new'));
document.querySelectorAll('#nav button').forEach((b) => b.addEventListener('click', () => go(b.dataset.route)));

(async function main() {
  paintNet();
  await ensureSeed();
  await render();
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('sw.js'); } catch (e) { /* offline dev */ }
  }
})();
