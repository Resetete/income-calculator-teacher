/* ══════════════════════════════════════════
   UNTERRICHTSRECHNER — app.js
   ══════════════════════════════════════════ */

// ════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════

const state = {
  bundesland:  'BE',
  kurse:       [],
  schueler:    [],
  activeDays:  new Set([1, 2, 3, 4, 5]),
  basePlan:    { 0:[], 1:[], 2:[], 3:[], 4:[], 5:[], 6:[] },
  overrides:   {},
  year:        new Date().getFullYear(),
  month:       new Date().getMonth(),
  jahrYear:    new Date().getFullYear(),
};

let nextId = 1;
const uid = () => nextId++;

const MONTH_NAMES = ['Januar','Februar','März','April','Mai','Juni',
                     'Juli','August','September','Oktober','November','Dezember'];
const DAY_LONG    = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];


// ════════════════════════════════════════════════════
// FEIERTAGE — alle 16 Bundesländer
// ════════════════════════════════════════════════════

function getEaster(year) {
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4;
  const f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30;
  const i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  const mo=Math.floor((h+l-7*m+114)/31)-1, dy=((h+l-7*m+114)%31)+1;
  return new Date(year, mo, dy);
}

function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }

function fmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getHolidays(year, bl) {
  const e = getEaster(year);
  // Common to all Bundesländer
  const h = {
    [fmt(new Date(year,0,1))]:   'Neujahr',
    [fmt(addDays(e,-2))]:        'Karfreitag',
    [fmt(e)]:                    'Ostersonntag',
    [fmt(addDays(e,1))]:         'Ostermontag',
    [fmt(new Date(year,4,1))]:   'Tag der Arbeit',
    [fmt(addDays(e,39))]:        'Christi Himmelfahrt',
    [fmt(addDays(e,49))]:        'Pfingstsonntag',
    [fmt(addDays(e,50))]:        'Pfingstmontag',
    [fmt(new Date(year,9,3))]:   'Tag d. Dt. Einheit',
    [fmt(new Date(year,11,25))]: 'Weihnachten',
    [fmt(new Date(year,11,26))]: '2. Weihnachtstag',
  };
  // Bundesland-specific
  const add = (date, name) => { h[fmt(date)] = name; };
  const cc  = addDays(e, 60); // Fronleichnam

  if (['BW','BY','ST'].includes(bl)) add(new Date(year,0,6),  'Heilige Drei Könige');
  if (['BB','MV','SN','ST','TH'].includes(bl)) add(new Date(year,9,31), 'Reformationstag');
  if (['BW','BY','NW','RP','SL'].includes(bl)) add(cc, 'Fronleichnam');
  if (['SN'].includes(bl)) add(new Date(year,10,20), 'Buß- und Bettag'); // approx Wed before Nov 23
  // Correct Buß- und Bettag: Wednesday before Nov 23
  if (bl === 'SN') {
    let bbt = new Date(year, 10, 22);
    while (bbt.getDay() !== 3) bbt.setDate(bbt.getDate() - 1);
    add(bbt, 'Buß- und Bettag');
  }
  if (['BW','BY','SL'].includes(bl)) add(new Date(year,7,15), 'Mariä Himmelfahrt');
  if (['BY','SL'].includes(bl)) add(new Date(year,10,1), 'Allerheiligen');
  if (['BE','BB','HB','HH','MV','NI','SH'].includes(bl)) add(new Date(year,2,8), 'Internationaler Frauentag'); // Berlin only
  if (bl === 'BE') {
    // Berlin only: Frauentag (March 8 since 2019)
    if (year >= 2019) { /* already added above as generic, remove generic and add specific */ }
  }
  // Remove Frauentag if not Berlin
  if (bl !== 'BE') {
    const fkey = fmt(new Date(year,2,8));
    if (h[fkey] === 'Internationaler Frauentag') delete h[fkey];
  }
  // Hamburg
  if (bl === 'HH') add(new Date(year,2,8), 'Internationaler Frauentag'); // Hamburg since 2020? No, only BE.
  // Clean up: only Berlin has Frauentag
  Object.keys(h).forEach(k => { if (h[k] === 'Internationaler Frauentag' && bl !== 'BE') delete h[k]; });

  return h;
}


// ════════════════════════════════════════════════════
// SCHULFERIEN — alle 16 Bundesländer (approximiert)
// Quellen: Kultusministerkonferenz, bitte jährlich prüfen
// ════════════════════════════════════════════════════

const SCHOOL_HOLS = {
  BE: {
    2024: [[0,15,0,20],[1,5,1,10],[3,22,5,1],[7,1,8,14],[9,3,9,19],[11,23,11,31]],
    2025: [[0,1,0,4],[1,24,3,5],[6,24,8,6],[9,20,10,1],[11,22,11,31]],
    2026: [[0,1,0,3],[1,2,2,21],[6,16,8,28],[9,12,9,24],[11,21,11,31]],
  },
  BB: {
    2024: [[0,1,0,5],[3,22,4,3],[6,20,8,30],[9,21,10,5],[11,23,11,31]],
    2025: [[0,1,0,3],[1,24,4,5],[7,24,9,3],[10,20,11,1],[11,22,11,31]],
    2026: [[0,1,0,2],[1,9,2,28],[7,16,8,29],[10,12,10,24],[11,21,11,31]],
  },
  BW: {
    2024: [[0,1,0,5],[3,27,4,5],[5,31,7,12],[9,28,10,12],[11,23,11,31]],
    2025: [[0,1,0,4],[4,12,4,25],[7,31,9,13],[10,27,11,1],[11,22,11,31]],
    2026: [[0,1,0,3],[3,28,4,10],[7,30,9,12],[10,26,10,31],[11,23,11,31]],
  },
  BY: {
    2024: [[0,1,0,5],[2,25,3,5],[5,29,7,9],[9,28,10,11],[11,21,11,31]],
    2025: [[0,1,0,4],[2,3,2,14],[7,28,9,9],[10,27,10,31],[11,22,11,31]],
    2026: [[0,1,0,3],[2,2,2,13],[7,27,9,8],[10,26,10,30],[11,23,11,31]],
  },
  HB: {
    2024: [[0,1,0,5],[1,31,2,9],[3,23,4,5],[6,4,7,14],[9,30,10,12],[11,23,11,31]],
    2025: [[0,1,0,3],[1,17,2,1],[3,14,4,26],[7,3,8,13],[10,13,10,25],[11,22,11,31]],
    2026: [[0,1,0,2],[2,16,2,27],[4,6,4,18],[7,2,8,12],[10,5,10,17],[11,23,11,31]],
  },
  HE: {
    2024: [[0,29,1,9],[3,22,4,5],[6,8,8,16],[9,23,10,5],[11,23,11,31]],
    2025: [[0,1,0,18],[3,14,4,26],[6,7,8,15],[9,22,10,4],[11,22,11,31]],
    2026: [[0,1,0,3],[3,6,4,18],[7,9,8,21],[10,12,10,24],[11,23,11,31]],
  },
  HH: {
    2024: [[0,1,0,5],[1,16,2,2],[3,22,5,3],[6,18,7,28],[9,30,10,11],[11,23,11,31]],
    2025: [[0,1,0,3],[2,3,2,14],[3,14,4,25],[6,25,8,6],[10,13,10,25],[11,22,11,31]],
    2026: [[0,1,0,2],[1,23,2,6],[4,6,4,17],[7,16,8,26],[10,5,10,17],[11,23,11,31]],
  },
  MV: {
    2024: [[0,1,0,5],[3,22,3,30],[5,22,8,3],[9,23,10,5],[11,23,11,31]],
    2025: [[0,1,0,4],[1,24,2,7],[3,14,3,22],[6,21,8,2],[10,13,10,25],[11,22,11,31]],
    2026: [[0,1,0,3],[1,16,2,6],[4,6,4,14],[6,25,8,8],[10,5,10,17],[11,23,11,31]],
  },
  NI: {
    2024: [[0,29,1,9],[3,22,4,5],[6,4,8,14],[9,30,10,12],[11,23,11,31]],
    2025: [[0,1,0,17],[3,7,4,18],[6,3,8,13],[10,6,10,18],[11,22,11,31]],
    2026: [[0,1,0,2],[2,23,3,6],[3,30,4,10],[7,23,9,2],[10,5,10,17],[11,23,11,31]],
  },
  NW: {
    2024: [[3,22,4,5],[6,1,8,16],[9,30,10,11],[11,23,11,31]],
    2025: [[0,1,0,4],[3,14,4,26],[6,23,8,5],[10,6,10,18],[11,22,11,31]],
    2026: [[0,1,0,3],[4,6,4,18],[7,6,8,18],[10,5,10,17],[11,23,11,31]],
  },
  RP: {
    2024: [[3,22,4,5],[7,1,8,9],[9,30,10,11],[11,23,11,31]],
    2025: [[0,1,0,4],[3,14,4,25],[7,7,8,15],[10,13,10,24],[11,22,11,31]],
    2026: [[0,1,0,3],[3,6,4,17],[7,6,8,14],[10,5,10,16],[11,23,11,31]],
  },
  SH: {
    2024: [[0,1,0,5],[3,22,5,3],[7,1,8,10],[9,21,10,4],[11,23,11,31]],
    2025: [[0,1,0,3],[3,14,4,25],[6,23,8,3],[10,6,10,18],[11,22,11,31]],
    2026: [[0,1,0,2],[3,6,4,17],[6,22,8,1],[10,5,10,17],[11,23,11,31]],
  },
  SL: {
    2024: [[3,22,4,5],[6,1,8,9],[9,30,10,12],[11,21,11,31]],
    2025: [[0,1,0,4],[3,14,4,26],[7,7,8,15],[10,13,10,25],[11,22,11,31]],
    2026: [[0,1,0,3],[3,6,4,18],[7,6,8,14],[10,5,10,17],[11,23,11,31]],
  },
  SN: {
    2024: [[1,12,1,23],[3,22,4,5],[7,1,8,16],[9,28,10,11],[11,23,11,31]],
    2025: [[0,1,0,4],[1,17,1,28],[3,14,4,26],[7,21,9,1],[10,20,11,1],[11,22,11,31]],
    2026: [[0,1,0,3],[2,2,2,13],[4,6,4,18],[7,20,8,31],[10,12,10,24],[11,23,11,31]],
  },
  ST: {
    2024: [[1,12,1,23],[3,22,4,5],[7,1,8,9],[9,28,10,11],[11,23,11,31]],
    2025: [[0,1,0,4],[1,17,1,31],[3,14,4,25],[7,7,8,20],[10,20,10,31],[11,22,11,31]],
    2026: [[0,1,0,3],[1,23,2,6],[3,30,4,10],[7,6,8,19],[10,12,10,23],[11,23,11,31]],
  },
  TH: {
    2024: [[1,12,1,23],[3,22,4,5],[6,8,8,14],[9,28,10,11],[11,23,11,31]],
    2025: [[0,1,0,4],[1,17,1,28],[3,14,4,26],[6,28,8,6],[10,20,10,31],[11,22,11,31]],
    2026: [[0,1,0,3],[1,16,1,27],[4,6,4,18],[7,27,9,5],[10,12,10,23],[11,23,11,31]],
  },
};

function getSchoolHols(year, bl) {
  const blData = SCHOOL_HOLS[bl] || SCHOOL_HOLS['BE'];
  // Fallback to closest year
  const r = blData[year] || blData[2025] || blData[Object.keys(blData)[0]];
  const s = new Set();
  if (!r) return s;
  r.forEach(([sm, sd, em, ed]) => {
    for (let d = new Date(year, sm, sd); d <= new Date(year, em, ed); d.setDate(d.getDate()+1)) {
      s.add(fmt(d));
    }
  });
  return s;
}

function dkey(y, m, d) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}


// ════════════════════════════════════════════════════
// BUNDESLAND
// ════════════════════════════════════════════════════

const BL_NAMES = {
  BE:'Berlin', BB:'Brandenburg', BW:'Baden-Württemberg', BY:'Bayern',
  HB:'Bremen', HE:'Hessen', HH:'Hamburg', MV:'Mecklenburg-Vorpommern',
  NI:'Niedersachsen', NW:'Nordrhein-Westfalen', RP:'Rheinland-Pfalz',
  SH:'Schleswig-Holstein', SL:'Saarland', SN:'Sachsen', ST:'Sachsen-Anhalt', TH:'Thüringen',
};

function onBundeslandChange() {
  state.bundesland = document.getElementById('selBundesland').value;
  document.getElementById('headerSubtitle').textContent = BL_NAMES[state.bundesland];
}


// ════════════════════════════════════════════════════
// TABS
// ════════════════════════════════════════════════════

function switchTab(name) {
  const names = ['kurse','schueler','wochenplan','monat','jahr'];
  document.querySelectorAll('.tab').forEach((t,i) => t.classList.toggle('active', names[i] === name));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  if (name === 'wochenplan') renderBasePlan();
  if (name === 'monat')      renderMonth();
  if (name === 'jahr')       renderJahr();
}


// ════════════════════════════════════════════════════
// TAB 1 — KURSE
// ════════════════════════════════════════════════════

function addKurs(name='', dauer=45, preis=35) {
  state.kurse.push({ id: uid(), name, dauer, preis });
  renderKurse();
}

function removeKurs(id) {
  state.kurse = state.kurse.filter(k => k.id !== id);
  for (const dow in state.basePlan)
    state.basePlan[dow] = state.basePlan[dow].filter(s => s.kursId !== id);
  renderKurse(); renderBasePlan();
}

function updateKurs(el) {
  const k = state.kurse.find(k => k.id === +el.dataset.id);
  if (!k) return;
  k[el.dataset.field] = el.dataset.field === 'name' ? el.value : parseFloat(el.value) || 0;
  renderBasePlan();
}

function renderKurse() {
  const el = document.getElementById('kursList');
  el.innerHTML = '';
  state.kurse.forEach(k => {
    const row = document.createElement('div');
    row.className = 'kurs-row';
    row.innerHTML = `
      <input type="text"   value="${esc(k.name)}" placeholder="z.B. Gitarre 45 min"
             data-id="${k.id}" data-field="name"  oninput="updateKurs(this)">
      <input type="number" value="${k.dauer}" min="15" max="180" step="5"
             data-id="${k.id}" data-field="dauer" oninput="updateKurs(this)">
      <input type="number" value="${k.preis}" min="0" step="0.5"
             data-id="${k.id}" data-field="preis" oninput="updateKurs(this)">
      <button class="btn-icon" onclick="removeKurs(${k.id})">×</button>`;
    el.appendChild(row);
  });
}


// ════════════════════════════════════════════════════
// TAB 2 — SCHÜLER
// ════════════════════════════════════════════════════

function addSchueler() {
  const inp  = document.getElementById('newSchuelerName');
  const name = inp.value.trim();
  if (!name) return;
  state.schueler.push({ id: uid(), name });
  inp.value = '';
  renderSchueler();
}

function removeSchueler(id) {
  state.schueler = state.schueler.filter(s => s.id !== id);
  for (const dow in state.basePlan)
    state.basePlan[dow] = state.basePlan[dow].filter(s => s.schuelerId !== id);
  renderSchueler(); renderBasePlan();
}

function renderSchueler() {
  const el = document.getElementById('schuelerList');
  el.innerHTML = '';
  state.schueler.forEach(s => {
    const row = document.createElement('div');
    row.className = 'schueler-row';
    row.innerHTML = `
      <div class="schueler-name-display">${esc(s.name)}</div>
      <button class="btn-icon" onclick="removeSchueler(${s.id})">×</button>`;
    el.appendChild(row);
  });
}


// ════════════════════════════════════════════════════
// TAB 3 — WOCHENPLAN
// ════════════════════════════════════════════════════

function toggleDay(dow) {
  if (state.activeDays.has(dow)) state.activeDays.delete(dow);
  else state.activeDays.add(dow);
  renderWeekdayBtns(); renderBasePlan();
}

function renderWeekdayBtns() {
  document.querySelectorAll('#weekdayBtns .btn').forEach(btn => {
    const d  = +btn.dataset.day;
    const on = state.activeDays.has(d);
    btn.style.borderColor = on ? 'var(--accent)' : '';
    btn.style.color       = on ? 'var(--accent)' : '';
  });
}

function addSlot(dow) {
  if (!state.schueler.length || !state.kurse.length) {
    alert('Bitte zuerst Schüler und Kurse anlegen.');
    return;
  }
  state.basePlan[dow].push({ schuelerId: state.schueler[0].id, kursId: state.kurse[0].id });
  renderBasePlan();
}

function removeSlot(dow, idx) { state.basePlan[dow].splice(idx, 1); renderBasePlan(); }
function updateSlot(dow, idx, field, val) { state.basePlan[dow][idx][field] = +val; renderBasePlan(); }

function renderBasePlan() {
  renderWeekdayBtns();
  const container = document.getElementById('basePlanList');
  container.innerHTML = '';
  const days = [1,2,3,4,5,6,0].filter(d => state.activeDays.has(d));

  if (!days.length) {
    container.innerHTML = '<p class="hint">Wähle oben Unterrichtstage aus.</p>';
    updatePlanSummary(); return;
  }

  days.forEach(dow => {
    const slots    = state.basePlan[dow];
    const totalDay = slots.reduce((s,sl) => {
      const k = state.kurse.find(k => k.id === sl.kursId);
      return s + (k ? k.preis : 0);
    }, 0);

    const block = document.createElement('div');
    block.className = 'day-block';
    block.innerHTML = `
      <div class="day-block-header">
        <span class="day-name">${DAY_LONG[dow]}</span>
        <span class="day-summary">${slots.length} Schüler · € ${totalDay.toFixed(2)}/Tag</span>
      </div>
      <div class="day-block-body"></div>`;

    const body = block.querySelector('.day-block-body');
    slots.forEach((sl, idx) => {
      const row = document.createElement('div');
      row.className = 'slot-row';
      row.innerHTML = `
        <select onchange="updateSlot(${dow},${idx},'schuelerId',this.value)">
          ${state.schueler.map(s => `<option value="${s.id}"${s.id===sl.schuelerId?' selected':''}>${esc(s.name)}</option>`).join('')}
        </select>
        <select onchange="updateSlot(${dow},${idx},'kursId',this.value)">
          ${state.kurse.map(k => `<option value="${k.id}"${k.id===sl.kursId?' selected':''}>${esc(k.name)} · €${k.preis}</option>`).join('')}
        </select>
        <button class="btn-icon" onclick="removeSlot(${dow},${idx})">×</button>`;
      body.appendChild(row);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-add';
    addBtn.textContent = '+ Schüler hinzufügen';
    addBtn.onclick = () => addSlot(dow);
    body.appendChild(addBtn);
    container.appendChild(block);
  });

  updatePlanSummary();
}

function updatePlanSummary() {
  const el   = document.getElementById('planSummary');
  const days = [1,2,3,4,5,6,0].filter(d => state.activeDays.has(d));
  if (!days.length || !state.kurse.length) {
    el.innerHTML = '<div class="hint">Noch keine Einträge.</div>'; return;
  }
  const totalW = days.reduce((s,dow) =>
    s + state.basePlan[dow].reduce((s2,sl) => {
      const k = state.kurse.find(k => k.id === sl.kursId);
      return s2 + (k ? k.preis : 0);
    }, 0), 0);
  const totalS = days.reduce((s,d) => s + state.basePlan[d].length, 0);
  el.innerHTML = `
    <div class="stat-row"><span class="stat-label">Schüler / Woche</span><span class="stat-val">${totalS}</span></div>
    <div class="stat-row"><span class="stat-label">Einnahmen / Woche</span><span class="stat-val">€ ${totalW.toFixed(2)}</span></div>
    <div class="stat-row"><span class="stat-label">Unterrichtstage</span><span class="stat-val">${days.length}</span></div>`;
}


// ════════════════════════════════════════════════════
// HELPER — compute monthly income (pure, no DOM)
// ════════════════════════════════════════════════════

function computeMonthIncome(year, month, bl) {
  const holidays   = getHolidays(year, bl);
  const schoolHols = getSchoolHols(year, bl);
  const weeks      = getMonthWeeks(year, month);
  let total = 0, workDays = 0, slots = 0;
  const kursIncome = {};

  weeks.forEach(({ week, year: wy, key: wk }) => {
    const ws         = getWeekStart(wy, week);
    const daysInWeek = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(ws); d.setDate(ws.getDate() + i);
      if (d.getMonth() === month && d.getFullYear() === year) daysInWeek.push(d);
    }

    const activeDays = daysInWeek.filter(d => state.activeDays.has(d.getDay()));
    activeDays.forEach(d => {
      const dow      = d.getDay();
      const dk       = dkey(d.getFullYear(), d.getMonth(), d.getDate());
      const isHol    = !!holidays[dk];
      const isSchool = schoolHols.has(dk);
      if (isHol || isSchool) return; // no pay

      const ov    = getOverride(wk, dow);
      const bSlots = state.basePlan[dow] || [];
      let dayHas = false;

      bSlots.forEach(sl => {
        const sch  = state.schueler.find(s => s.id === sl.schuelerId);
        const kurs = state.kurse.find(k => k.id === sl.kursId);
        if (!sch || !kurs) return;
        if (ov.absent.has(sl.schuelerId)) return;
        total += kurs.preis; slots++;
        kursIncome[kurs.id] = (kursIncome[kurs.id] || 0) + kurs.preis;
        dayHas = true;
      });

      // extras
      (ov.extra || []).forEach(ex => {
        const kurs = state.kurse.find(k => k.id === ex.kursId);
        if (!kurs) return;
        total += kurs.preis; slots++;
        kursIncome[kurs.id] = (kursIncome[kurs.id] || 0) + kurs.preis;
        dayHas = true;
      });

      if (dayHas) workDays++;
    });
  });

  return { total, workDays, slots, kursIncome };
}

// Simple projection (no overrides) for year view
function projectMonthIncome(year, month, bl) {
  const holidays   = getHolidays(year, bl);
  const schoolHols = getSchoolHols(year, bl);
  const dim        = new Date(year, month+1, 0).getDate();
  let total = 0, workDays = 0;

  for (let day = 1; day <= dim; day++) {
    const d   = new Date(year, month, day);
    const dow = d.getDay();
    if (!state.activeDays.has(dow)) continue;
    const dk = dkey(year, month, day);
    if (holidays[dk] || schoolHols.has(dk)) continue;
    const dayIncome = (state.basePlan[dow] || []).reduce((s, sl) => {
      const k = state.kurse.find(k => k.id === sl.kursId);
      return s + (k ? k.preis : 0);
    }, 0);
    total += dayIncome;
    if (dayIncome > 0) workDays++;
  }
  return { total, workDays };
}


// ════════════════════════════════════════════════════
// TAB 4 — MONATSABRECHNUNG
// ════════════════════════════════════════════════════

function getISOWeek(date) {
  const d   = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { week: Math.ceil((((d-y)/86400000)+1)/7), year: d.getUTCFullYear() };
}

function getMonthWeeks(year, month) {
  const seen = new Set(), weeks = [];
  const dim  = new Date(year, month+1, 0).getDate();
  for (let d = 1; d <= dim; d++) {
    const { week, year: wy } = getISOWeek(new Date(year, month, d));
    const key = `${wy}-W${week}`;
    if (!seen.has(key)) { seen.add(key); weeks.push({ week, year: wy, key }); }
  }
  return weeks;
}

function getWeekStart(isoYear, isoWeek) {
  const jan4 = new Date(isoYear, 0, 4);
  const ws   = new Date(jan4);
  ws.setDate(jan4.getDate() - ((jan4.getDay()||7) - 1) + (isoWeek-1)*7);
  return ws;
}

function getOverride(wk, dow) {
  if (!state.overrides[wk])      state.overrides[wk] = {};
  if (!state.overrides[wk][dow]) state.overrides[wk][dow] = { absent: new Set(), extra: [] };
  return state.overrides[wk][dow];
}

function toggleAbsent(wk, dow, sid) {
  const ov = getOverride(wk, dow);
  if (ov.absent.has(sid)) ov.absent.delete(sid); else ov.absent.add(sid);
  renderMonth();
}

let _extraCallback = null;
function openExtraModal(callback) {
  const ms = document.getElementById('modalSchueler');
  const mk = document.getElementById('modalKurs');
  ms.innerHTML = state.schueler.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  mk.innerHTML = state.kurse.map(k => `<option value="${k.id}">${esc(k.name)} · €${k.preis}</option>`).join('');
  _extraCallback = callback;
  document.getElementById('extraModal').style.display = 'flex';
  document.getElementById('modalConfirm').onclick = () => {
    callback(+ms.value, +mk.value);
    document.getElementById('extraModal').style.display = 'none';
  };
}
function closeModal(e) { if (e.target.id === 'extraModal') document.getElementById('extraModal').style.display = 'none'; }
function removeExtra(wk, dow, idx) { getOverride(wk, dow).extra.splice(idx, 1); renderMonth(); }

function renderMonth() {
  const { year, month, bundesland: bl } = state;
  const holidays   = getHolidays(year, bl);
  const schoolHols = getSchoolHols(year, bl);
  const weeks      = getMonthWeeks(year, month);
  const container  = document.getElementById('weeksList');
  container.innerHTML = '';

  let grandTotal = 0, totalWorkDays = 0, totalSlots = 0;
  const kursIncome = {};

  weeks.forEach(({ week, year: wy, key: wk }) => {
    const ws = getWeekStart(wy, week);
    const daysInWeek = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(ws); d.setDate(ws.getDate() + i);
      if (d.getMonth() === month && d.getFullYear() === year) daysInWeek.push(d);
    }

    let weekTotal = 0;
    const weekBlock  = document.createElement('div');
    weekBlock.className = 'week-block';

    const fmtD = d => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;
    const first = daysInWeek[0], last = daysInWeek[daysInWeek.length-1];

    const header     = document.createElement('div');
    header.className = 'week-header';
    const incomeSpan = document.createElement('span');
    incomeSpan.className = 'week-income';
    incomeSpan.textContent = '€ 0,00';
    header.innerHTML = `<span class="week-title">KW ${week} · ${fmtD(first)}–${fmtD(last)}</span>`;
    header.appendChild(incomeSpan);

    const body       = document.createElement('div');
    body.className   = 'week-body open';
    header.onclick   = () => body.classList.toggle('open');
    weekBlock.appendChild(header);

    const activeDays = daysInWeek.filter(d => state.activeDays.has(d.getDay()));

    activeDays.forEach(d => {
      const dow      = d.getDay();
      const dk       = dkey(d.getFullYear(), d.getMonth(), d.getDate());
      const isHol    = !!holidays[dk];
      const isSchool = schoolHols.has(dk);
      const ov       = getOverride(wk, dow);
      const slots    = state.basePlan[dow] || [];

      const section       = document.createElement('div');
      section.className   = 'week-day-section';
      let badge = '';
      if (isHol)    badge = `<span class="badge badge-holiday">Feiertag: ${holidays[dk]}</span>`;
      else if (isSchool) badge = `<span class="badge badge-school">Schulferien</span>`;
      section.innerHTML = `<div class="week-day-label">${DAY_LONG[dow]}, ${d.getDate()}. ${badge}</div>`;

      let dayHasStudents = false;

      // Base slots
      slots.forEach(sl => {
        const sch  = state.schueler.find(s => s.id === sl.schuelerId);
        const kurs = state.kurse.find(k => k.id === sl.kursId);
        if (!sch || !kurs) return;

        // On holiday/school days: no pay, shown greyed
        const noPay  = isHol || isSchool;
        const absent = !noPay && ov.absent.has(sl.schuelerId);

        if (!noPay && !absent) {
          weekTotal += kurs.preis; totalSlots++;
          kursIncome[kurs.id] = (kursIncome[kurs.id] || 0) + kurs.preis;
          dayHasStudents = true;
        }

        const el         = document.createElement('div');
        el.className     = 'student-slot' + (noPay ? ' no-pay' : absent ? ' absent' : '');
        el.title         = noPay ? 'Kein Unterricht — kein Gehalt' : 'Klicken zum Markieren als abwesend';
        el.innerHTML     = `
          <span class="s-name">${esc(sch.name)}</span>
          <span class="s-kurs">${esc(kurs.name)}</span>
          <span class="s-price">${(noPay || absent) ? '–' : '+'} €${kurs.preis.toFixed(2)}</span>`;
        if (!noPay) el.onclick = () => toggleAbsent(wk, dow, sl.schuelerId);
        section.appendChild(el);
      });

      // Extra slots (only shown on non-holiday days)
      if (!isHol && !isSchool) {
        (ov.extra || []).forEach((ex, exIdx) => {
          const sch  = state.schueler.find(s => s.id === ex.schuelerId);
          const kurs = state.kurse.find(k => k.id === ex.kursId);
          if (!sch || !kurs) return;
          weekTotal += kurs.preis; totalSlots++;
          kursIncome[kurs.id] = (kursIncome[kurs.id] || 0) + kurs.preis;
          dayHasStudents = true;
          const el     = document.createElement('div');
          el.className = 'student-slot extra';
          el.innerHTML = `
            <span class="s-name">${esc(sch.name)} <span style="color:var(--green);font-size:10px">+extra</span></span>
            <span class="s-kurs">${esc(kurs.name)}</span>
            <span class="s-price">+€${kurs.preis.toFixed(2)}</span>
            <button class="btn-icon" style="margin-left:4px"
              onclick="removeExtra('${wk}',${dow},${exIdx});event.stopPropagation()">×</button>`;
          section.appendChild(el);
        });

        if (state.schueler.length && state.kurse.length) {
          const addBtn     = document.createElement('button');
          addBtn.className = 'week-extra-btn';
          addBtn.textContent = '+ Zusatz-Schüler';
          addBtn.onclick   = () => openExtraModal((sid, kid) => {
            getOverride(wk, dow).extra.push({ schuelerId: sid, kursId: kid });
            renderMonth();
          });
          section.appendChild(addBtn);
        }
      }

      if (dayHasStudents) totalWorkDays++;
      body.appendChild(section);
    });

    grandTotal += weekTotal;
    incomeSpan.textContent = `€ ${weekTotal.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    weekBlock.appendChild(body);
    container.appendChild(weekBlock);
  });

  // Sidebar
  document.getElementById('totalIncome').innerHTML =
    `<span>€</span> ${grandTotal.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  document.getElementById('incomeSub').textContent =
    `${totalSlots} Unterrichtsstunden · ${totalWorkDays} Tage`;

  const ks = document.getElementById('kursStats');
  const hasAny = state.kurse.some(k => kursIncome[k.id]);
  ks.innerHTML = hasAny
    ? state.kurse.filter(k => kursIncome[k.id]).map(k => `
        <div class="kurs-stat">
          <span class="kurs-stat-name">${esc(k.name)}</span>
          <span class="kurs-stat-val">€ ${(kursIncome[k.id]||0).toFixed(2)}</span>
        </div>`).join('')
    : '<div class="hint">Noch keine Daten.</div>';

  document.getElementById('dayStats').innerHTML = `
    <div class="stat-row"><span class="stat-label">Unterrichtstage</span><span class="stat-val">${totalWorkDays}</span></div>
    <div class="stat-row"><span class="stat-label">Schüler-Einheiten</span><span class="stat-val">${totalSlots}</span></div>`;
}


// ════════════════════════════════════════════════════
// TAB 5 — JAHRESÜBERSICHT
// ════════════════════════════════════════════════════

let activeJahrMonth = null;

function renderJahr() {
  const year = state.jahrYear;
  const bl   = state.bundesland;
  const data = [];
  let yearTotal = 0;

  for (let m = 0; m < 12; m++) {
    const { total, workDays } = projectMonthIncome(year, m, bl);
    data.push({ month: m, total, workDays });
    yearTotal += total;
  }

  const maxIncome = Math.max(...data.map(d => d.total), 1);
  const avgIncome = yearTotal / 12;

  // ── Bar chart ──
  const chartWrap = document.getElementById('jahresChart');
  chartWrap.innerHTML = `
    <div class="panel-title" style="margin-bottom:12px">Einnahmen pro Monat · ${year}</div>
    <div class="chart-bars" id="chartBars"></div>
    <div class="chart-labels" id="chartLabels"></div>`;

  const barsEl   = chartWrap.querySelector('#chartBars');
  const labelsEl = chartWrap.querySelector('#chartLabels');

  data.forEach(({ month: m, total }) => {
    const pct    = total / maxIncome;
    const height = Math.max(pct * 140, total > 0 ? 4 : 0);
    const isActive = m === (activeJahrMonth ?? state.month);

    const col     = document.createElement('div');
    col.className = 'chart-bar-col' + (isActive ? ' active' : '');

    const valEl     = document.createElement('div');
    valEl.className = 'chart-bar-val';
    valEl.textContent = total > 0 ? `${Math.round(total)}` : '—';

    const bar     = document.createElement('div');
    bar.className = 'chart-bar';
    bar.style.height = height + 'px';

    col.appendChild(valEl);
    col.appendChild(bar);
    col.onclick = () => { activeJahrMonth = m; renderJahr(); };
    barsEl.appendChild(col);

    const lbl     = document.createElement('div');
    lbl.className = 'chart-label' + (isActive ? ' active' : '');
    lbl.textContent = MONTH_NAMES[m].slice(0, 3);
    labelsEl.appendChild(lbl);
  });

  // ── Month table ──
  const tableEl = document.getElementById('jahresTable');
  tableEl.innerHTML = '';
  data.forEach(({ month: m, total, workDays }) => {
    const isActive = m === (activeJahrMonth ?? state.month);
    const pct = total / maxIncome;
    const row = document.createElement('div');
    row.className = 'jahres-month-row' + (isActive ? ' active' : '');
    row.innerHTML = `
      <div class="jm-name">${MONTH_NAMES[m]}</div>
      <div class="jm-bar-wrap"><div class="jm-bar" style="width:${(pct*100).toFixed(1)}%"></div></div>
      <div class="jm-days">${workDays} Tage</div>
      <div class="jm-income">€ ${total.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>`;
    row.onclick = () => {
      activeJahrMonth = m;
      // Also navigate to month tab
      state.month = m;
      document.getElementById('selMonth').value = m;
      renderJahr();
    };
    tableEl.appendChild(row);
  });

  // ── Sidebar ──
  document.getElementById('jahresTotal').innerHTML =
    `<span>€</span> ${yearTotal.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  document.getElementById('jahresSub').textContent =
    `${data.filter(d => d.workDays > 0).length} Monate mit Unterricht`;

  const bestMonth = data.reduce((a,b) => a.total >= b.total ? a : b, data[0]);
  const leanMonth = data.filter(d => d.total > 0).reduce((a,b) => a.total <= b.total ? a : b, data.find(d=>d.total>0)||data[0]);

  document.getElementById('jahresStats').innerHTML = `
    <div class="stat-row"><span class="stat-label">⌀ pro Monat</span><span class="stat-val">€ ${avgIncome.toFixed(2)}</span></div>
    <div class="stat-row"><span class="stat-label">Bester Monat</span><span class="stat-val">${MONTH_NAMES[bestMonth.month]}</span></div>
    ${leanMonth ? `<div class="stat-row"><span class="stat-label">Schwächster Monat</span><span class="stat-val">${MONTH_NAMES[leanMonth.month]}</span></div>` : ''}
    <div class="stat-row"><span class="stat-label">Unterrichtstage</span><span class="stat-val">${data.reduce((s,d)=>s+d.workDays,0)}</span></div>`;
}


// ════════════════════════════════════════════════════
// YEAR / MONTH SELECTS
// ════════════════════════════════════════════════════

function initSelects() {
  const selYear     = document.getElementById('selYear');
  const selJahrYear = document.getElementById('selJahrYear');
  const cy          = new Date().getFullYear();

  [selYear, selJahrYear].forEach(sel => {
    sel.innerHTML = '';
    for (let y = cy - 2; y <= cy + 3; y++) {
      const o = document.createElement('option');
      o.value = y; o.textContent = y;
      if (y === cy) o.selected = true;
      sel.appendChild(o);
    }
  });

  document.getElementById('selMonth').value = state.month;

  selYear.addEventListener('change', e => { state.year  = +e.target.value; renderMonth(); });
  selJahrYear.addEventListener('change', e => { state.jahrYear = +e.target.value; renderJahr(); });
  document.getElementById('selMonth').addEventListener('change', e => { state.month = +e.target.value; renderMonth(); });
  document.getElementById('selBundesland').value = state.bundesland;
}


// ════════════════════════════════════════════════════
// SPEICHERN / LADEN / EXPORT / IMPORT
// ════════════════════════════════════════════════════

const STORAGE_KEY = 'unterrichtsrechner_v2';

function serializeState() {
  return {
    version:    2,
    bundesland: state.bundesland,
    kurse:      state.kurse,
    schueler:   state.schueler,
    activeDays: [...state.activeDays],
    basePlan:   state.basePlan,
    overrides:  serializeOverrides(),
    year:       state.year,
    month:      state.month,
    jahrYear:   state.jahrYear,
  };
}

function serializeOverrides() {
  const out = {};
  for (const wk in state.overrides) {
    out[wk] = {};
    for (const dow in state.overrides[wk]) {
      const ov = state.overrides[wk][dow];
      out[wk][dow] = { absent: [...ov.absent], extra: ov.extra };
    }
  }
  return out;
}

function deserializeOverrides(raw) {
  const out = {};
  for (const wk in raw) {
    out[wk] = {};
    for (const dow in raw[wk]) {
      out[wk][dow] = {
        absent: new Set(raw[wk][dow].absent || []),
        extra:  raw[wk][dow].extra || [],
      };
    }
  }
  return out;
}

function applySerializedState(data) {
  if (!data || data.version < 1) return false;
  state.bundesland = data.bundesland || 'BE';
  state.kurse      = data.kurse      || [];
  state.schueler   = data.schueler   || [];
  state.activeDays = new Set(data.activeDays || [1,2,3,4,5]);
  state.basePlan   = data.basePlan   || { 0:[],1:[],2:[],3:[],4:[],5:[],6:[] };
  state.overrides  = deserializeOverrides(data.overrides || {});
  state.year       = data.year       || new Date().getFullYear();
  state.month      = data.month      || new Date().getMonth();
  state.jahrYear   = data.jahrYear   || new Date().getFullYear();

  // Repair basePlan keys (JSON stores numeric keys as strings)
  const bp = {};
  for (let d = 0; d <= 6; d++) bp[d] = state.basePlan[d] || state.basePlan[String(d)] || [];
  state.basePlan = bp;

  // Re-sync nextId to avoid ID collisions
  const allIds = [...state.kurse.map(k=>k.id), ...state.schueler.map(s=>s.id)];
  if (allIds.length) nextId = Math.max(...allIds) + 1;

  return true;
}

function saveToLocalStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeState()));
  showNotice('✓ Gespeichert');
}

function loadFromLocalStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    return applySerializedState(JSON.parse(raw));
  } catch(e) {
    console.warn('Load failed', e);
    return false;
  }
}

function exportData() {
  const json     = JSON.stringify(serializeState(), null, 2);
  const blob     = new Blob([json], { type: 'application/json' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  a.href         = url;
  a.download     = `unterrichtsrechner_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showNotice('✓ Exportiert');
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (applySerializedState(data)) {
        fullRebuild();
        showNotice('✓ Importiert');
      } else {
        alert('Ungültige Datei.');
      }
    } catch(err) {
      alert('Fehler beim Lesen der Datei.');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

function showNotice(msg) {
  const el = document.getElementById('saveNotice');
  el.textContent = msg;
  el.style.opacity = '1';
  setTimeout(() => { el.style.opacity = '0'; }, 2500);
}

function fullRebuild() {
  document.getElementById('selBundesland').value = state.bundesland;
  document.getElementById('headerSubtitle').textContent = BL_NAMES[state.bundesland];
  document.getElementById('selMonth').value  = state.month;
  document.getElementById('selYear').value   = state.year;
  document.getElementById('selJahrYear').value = state.jahrYear;
  renderKurse();
  renderSchueler();
  renderBasePlan();
  renderMonth();
}


// ════════════════════════════════════════════════════
// UTILS
// ════════════════════════════════════════════════════

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}


// ════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════

initSelects();

const loaded = loadFromLocalStorage();
if (!loaded) {
  // Demo data
  addKurs('Gitarre 45 min', 45, 35);
  addKurs('Klavier 60 min', 60, 45);
  state.schueler.push({ id: uid(), name: 'Max Mustermann' });
  state.schueler.push({ id: uid(), name: 'Anna Müller' });
  renderSchueler();
  renderKurse();
} else {
  renderKurse();
  renderSchueler();
}

renderWeekdayBtns();
renderBasePlan();
document.getElementById('headerSubtitle').textContent = BL_NAMES[state.bundesland];

// Auto-save on page close
window.addEventListener('beforeunload', saveToLocalStorage);
