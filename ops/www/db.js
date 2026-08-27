// db.js — שכבת נתונים offline-first מעל IndexedDB. בלי תלויות.
// מודל מלא: משתמשים/תפקידים, נגרים, קטלוג+מחירונים, עבודות (11 שלבים), מדידות, תוצרים, מדדים.

const DB_NAME = 'soline-ops';
const DB_VERSION = 2;
const STORES = {
  users: 'id', carpenters: 'id', catalog: 'sku', carpenterRates: 'id',
  jobs: 'id', measurements: 'id', deliverables: 'id', metrics: 'jobId',
};

let _db = null;
function open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const [name, key] of Object.entries(STORES)) {
        let os;
        if (!db.objectStoreNames.contains(name)) os = db.createObjectStore(name, { keyPath: key });
        else os = e.target.transaction.objectStore(name);
        if (name === 'jobs') {
          if (!os.indexNames.contains('stage')) os.createIndex('stage', 'stage');
          if (!os.indexNames.contains('carpenterId')) os.createIndex('carpenterId', 'carpenterId');
          if (!os.indexNames.contains('surveyorId')) os.createIndex('surveyorId', 'surveyorId');
        }
        if ((name === 'measurements' || name === 'deliverables') && !os.indexNames.contains('jobId'))
          os.createIndex('jobId', 'jobId');
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}
function tx(store, mode = 'readonly') { return open().then((db) => db.transaction(store, mode).objectStore(store)); }
function done(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.abs(Math.floor(performance.now() * 1e3)).toString(36));
const nowISO = () => new Date().toISOString();

export const db = {
  async all(store) { return done((await tx(store)).getAll()); },
  async get(store, id) { return done((await tx(store)).get(id)); },
  async byIndex(store, index, value) { const os = await tx(store); return done(os.index(index).getAll(value)); },
  async put(store, obj) { const os = await tx(store, 'readwrite'); await done(os.put(obj)); return obj; },
  async del(store, id) { const os = await tx(store, 'readwrite'); return done(os.delete(id)); },
};

// ── תפקידים ────────────────────────────────────────────────────
export const ROLES = {
  carpenter:   { key: 'carpenter',   label: 'נגר',   icon: '👤', home: '#/orders' },
  surveyor:    { key: 'surveyor',    label: 'מודד',  icon: '📱', home: '#/field' },
  coordinator: { key: 'coordinator', label: 'מתאם',  icon: '🖥️', home: '#/console' },
  manager:     { key: 'manager',     label: 'מנהל',  icon: '📊', home: '#/dashboard' },
};

// session מקומי (dev): מי מחובר. בעתיד — התחברות אמיתית.
export const session = {
  get() { try { return JSON.parse(localStorage.getItem('soline-session')) || null; } catch { return null; } },
  set(userId) { localStorage.setItem('soline-session', JSON.stringify({ userId })); },
  async user() { const s = this.get(); return s ? db.get('users', s.userId) : null; },
};

// ── שלבים (11) ─────────────────────────────────────────────────
export const STAGES = [
  { key: 'submitted',  label: 'נשלחה',        color: 'muted'  },
  { key: 'accepted',   label: 'התקבלה',       color: 'accent' },
  { key: 'assessment', label: 'בירור שטח',    color: 'ai'     },
  { key: 'scheduled',  label: 'משובצת',       color: 'accent' },
  { key: 'in_field',   label: 'במדידה',       color: 'warn'   },
  { key: 'measured',   label: 'נמדדה · DR1',  color: 'ai'     },
  { key: 'processing', label: 'בעיבוד',       color: 'accent' },
  { key: 'review',     label: 'בבדיקה · DR2', color: 'warn'   },
  { key: 'delivered',  label: 'נמסרה',        color: 'go'     },
  { key: 'approved',   label: 'אושרה',        color: 'go'     },
  { key: 'closed',     label: 'סגורה',        color: 'muted'  },
];
export const stageOf = (k) => STAGES.find((s) => s.key === k) || STAGES[0];
export const stageIdx = (k) => STAGES.findIndex((s) => s.key === k);
export const nextStage = (k) => { const i = stageIdx(k); return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1].key : k; };

// סטטוס מפושט לנגר (לא חושפים את הפנימי)
export function carpenterStatus(stage) {
  const map = {
    submitted:  { label: 'נשלחה — ממתינה לאישור', color: 'muted' },
    accepted:   { label: 'התקבלה', color: 'accent' },
    assessment: { label: 'בבירור פרטים', color: 'accent' },
    scheduled:  { label: 'בתיאום מועד', color: 'accent' },
    in_field:   { label: 'במדידה', color: 'warn' },
    measured:   { label: 'במדידה', color: 'warn' },
    processing: { label: 'בעיבוד ובדיקה', color: 'ai' },
    review:     { label: 'בעיבוד ובדיקה', color: 'ai' },
    delivered:  { label: '✅ מוכן — לאשר ולהוריד', color: 'go' },
    approved:   { label: 'הושלם', color: 'go' },
    closed:     { label: 'הושלם', color: 'go' },
  };
  return map[stage] || map.submitted;
}

// ── תמחור ──────────────────────────────────────────────────────
export async function effectivePrice(carpenterId, sku) {
  const rates = await db.byIndex ? null : null; // rates store has no index; scan
  const all = await db.all('carpenterRates');
  const override = all.find((r) => r.carpenterId === carpenterId && r.sku === sku);
  if (override) return override.price;
  const item = await db.get('catalog', sku);
  return item ? item.basePrice : 0;
}
export function priceOrder(items) {
  const subtotal = items.reduce((s, it) => s + (it.lineTotal || it.unitPrice * it.qty), 0);
  return { subtotal, discount: 0, total: subtotal, currency: '₪' };
}

// ── עבודות ─────────────────────────────────────────────────────
export async function advanceJob(job, toStage, by = 'משתמש') {
  job.stage = toStage; job.updatedAt = nowISO();
  job.history = job.history || [];
  job.history.push({ stage: toStage, at: nowISO(), by });
  return db.put('jobs', job);
}
export async function saveJob(job) { job.updatedAt = nowISO(); return db.put('jobs', job); }

export async function nextJobCode() {
  const all = await db.all('jobs');
  return `2026-0${140 + all.length + 1}`;
}

// ── seed ───────────────────────────────────────────────────────
export async function ensureSeed() {
  if ((await db.all('users')).length) return;

  // קטלוג מק״טים (מחירי דמו — למילוי מול Michael)
  const catalog = [
    { sku: 'MDD-KIT',    name: 'מדידת מטבח',          category: 'מדידה', unit: 'יח׳',  basePrice: 450, active: true },
    { sku: 'MDD-BATH',   name: 'מדידת חדר רחצה',      category: 'מדידה', unit: 'יח׳',  basePrice: 300, active: true },
    { sku: 'MDD-CLST',   name: 'מדידת חדר ארונות',    category: 'מדידה', unit: 'יח׳',  basePrice: 350, active: true },
    { sku: 'MDD-FULL',   name: 'מדידת דירה מלאה',     category: 'מדידה', unit: 'יח׳',  basePrice: 900, active: true },
    { sku: 'ADD-3D',     name: 'תוספת DXF 3D',        category: 'תוספת', unit: 'יח׳',  basePrice: 250, active: true },
    { sku: 'ADD-PDP',    name: 'תוספת קובץ PDP',      category: 'תוספת', unit: 'יח׳',  basePrice: 200, active: true },
    { sku: 'ADD-FLOOR',  name: 'תוספת קומה',          category: 'תוספת', unit: 'קומה', basePrice: 150, active: true },
    { sku: 'ADD-RUSH',   name: 'עבודה דחופה',         category: 'תוספת', unit: 'יח׳',  basePrice: 300, active: true },
    { sku: 'TRV-KM',     name: 'נסיעה מעל 30 ק״מ',    category: 'נסיעה', unit: 'ק״מ',  basePrice: 4,   active: true },
  ];
  for (const c of catalog) await db.put('catalog', c);

  // נגרים (עסקים)
  const carpA = { id: uid(), businessName: 'נגריית אלקינצ׳ו', contactName: 'יוסי אלקינצ׳ו', phone: '03-9998877', email: 'yossi@elkincho.co.il' };
  const carpB = { id: uid(), businessName: 'מטבחי שגב', contactName: 'דוד שגב', phone: '053-1234567', email: 'david@segev.co.il' };
  for (const c of [carpA, carpB]) await db.put('carpenters', c);

  // מחירון מיוחד לנגר A
  await db.put('carpenterRates', { id: uid(), carpenterId: carpA.id, sku: 'MDD-KIT', price: 400 });

  // משתמשים
  const users = [
    { id: uid(), name: 'Michael',        role: 'manager',     phone: '050-0000000', active: true },
    { id: uid(), name: 'שירה (תיאום)',   role: 'coordinator', phone: '050-1111111', active: true },
    { id: uid(), name: 'רון לוי',        role: 'surveyor',    phone: '050-2222222', color: '#0d6fbf', active: true },
    { id: uid(), name: 'עדי כהן',        role: 'surveyor',    phone: '052-3333333', color: '#0a9d63', active: true },
    { id: uid(), name: 'יוסי אלקינצ׳ו',  role: 'carpenter',   phone: carpA.phone, carpenterId: carpA.id, active: true },
    { id: uid(), name: 'דוד שגב',        role: 'carpenter',   phone: carpB.phone, carpenterId: carpB.id, active: true },
  ];
  for (const u of users) await db.put('users', u);
  const surveyorA = users[2].id, surveyorB = users[3].id;

  // עבודות לדוגמה — פרוסות על ה-pipeline
  const mkJob = (n, carpenterId, endClient, items, stage, surveyorId, sched) => {
    const priced = items.map((it) => ({ ...it, lineTotal: it.unitPrice * it.qty }));
    return {
      id: uid(), code: `2026-0${140 + n}`, carpenterId,
      endClient, type: items[0].type || 'kitchen',
      order: { deliverables: ['dxf2d', 'dxf3d'], notes: '', deadline: null, attachments: [], items: priced },
      pricing: { ...priceOrder(priced), quotedAt: stage === 'submitted' ? null : nowISO(),
                 approvedByCarpenterAt: ['scheduled','in_field','measured','processing','review','delivered','approved','closed'].includes(stage) ? nowISO() : null },
      assessment: null,
      stage, surveyorId: surveyorId || null, scheduledAt: sched || null,
      createdAt: nowISO(), updatedAt: nowISO(),
      history: [{ stage: 'submitted', at: nowISO(), by: 'נגר' }],
    };
  };
  const ec = (name, phone, address) => ({ name, phone, address });
  const jobs = [
    mkJob(1, carpA.id, ec('משפחת ברק', '050-1010101', 'הרצל 14, חדרה'),
      [{ sku: 'MDD-KIT', name: 'מדידת מטבח', qty: 1, unitPrice: 400, type: 'kitchen' }, { sku: 'ADD-3D', name: 'תוספת DXF 3D', qty: 1, unitPrice: 250 }],
      'submitted', null, null),
    mkJob(2, carpB.id, ec('דירת שגב', '052-2020202', 'האלון 3, פרדס חנה'),
      [{ sku: 'MDD-FULL', name: 'מדידת דירה מלאה', qty: 1, unitPrice: 900, type: 'full' }],
      'assessment', null, null),
    mkJob(3, carpA.id, ec('משפחת נחום', '053-3030303', 'התעשייה 8, נתניה'),
      [{ sku: 'MDD-KIT', name: 'מדידת מטבח', qty: 1, unitPrice: 400, type: 'kitchen' }],
      'scheduled', surveyorA, '2026-08-18T08:00:00Z'),
    mkJob(4, carpB.id, ec('משפחת גל', '054-4040404', 'הגליל 22, חיפה'),
      [{ sku: 'MDD-BATH', name: 'מדידת חדר רחצה', qty: 2, unitPrice: 300, type: 'kitchen' }],
      'in_field', surveyorB, '2026-08-15T07:30:00Z'),
    mkJob(5, carpA.id, ec('משפחת דהן', '050-5050505', 'ויצמן 5, כפר סבא'),
      [{ sku: 'MDD-KIT', name: 'מדידת מטבח', qty: 1, unitPrice: 400, type: 'kitchen' }, { sku: 'ADD-PDP', name: 'תוספת PDP', qty: 1, unitPrice: 200 }],
      'processing', surveyorA, '2026-08-12T08:00:00Z'),
    mkJob(6, carpB.id, ec('משפחת לוי', '052-6060606', 'ההדר 9, רעננה'),
      [{ sku: 'MDD-FULL', name: 'מדידת דירה מלאה', qty: 1, unitPrice: 900, type: 'full' }],
      'delivered', surveyorB, '2026-08-10T08:00:00Z'),
    mkJob(7, carpA.id, ec('משפחת עוז', '053-7070707', 'הזית 1, חדרה'),
      [{ sku: 'MDD-KIT', name: 'מדידת מטבח', qty: 1, unitPrice: 400, type: 'kitchen' }],
      'closed', surveyorA, '2026-08-05T08:00:00Z'),
  ];
  for (const j of jobs) await db.put('jobs', j);

  // ברירת מחדל: מתחילים כנגר A (dev)
  session.set(users[4].id);
}
