/* ══════════════════════════════════════════
   UNTERRICHTSRECHNER — app.js
   ══════════════════════════════════════════ */

// ════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════

const state = {
  kurse:      [],                          // { id, name, dauer, preis }
  schueler:   [],                          // { id, name }
  activeDays: new Set([1, 2, 3, 4, 5]),   // Mon–Fri active by default
  basePlan:   { 0:[], 1:[], 2:[], 3:[], 4:[], 5:[], 6:[] }, // dow → [{schuelerId, kursId}]
  overrides:  {},                          // weekKey → dow → { absent: Set, extra: [] }
  year:       new Date().getFullYear(),
  month:      new Date().getMonth(),
};

let nextId = 1;
const uid = () => nextId++;


// ════════════════════════════════════════════════════
// BERLIN FEIERTAGE (Gauss'sche Osterformel)
// ════════════════════════════════════════════════════

function getHolidays(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const dy = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, mo, dy);

  const add = (d, n) => new Date(d.getTime() + n * 86400000);
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return {
    [fmt(new Date(year, 0, 1))]:  'Neujahr',
    [fmt(add(easter, -2))]:       'Karfreitag',
    [fmt(add(easter, 1))]:        'Ostermontag',
    [fmt(new Date(year, 4, 1))]:  'Tag der Arbeit',
    [fmt(add(easter, 39))]:       'Christi Himmelfahrt',
    [fmt(add(easter, 50))]:       'Pfingstmontag',
    [fmt(new Date(year, 9, 3))]:  'Tag d. Dt. Einheit',
    [fmt(new Date(year, 11, 25))]: 'Weihnachten',
    [fmt(new Date(year, 11, 26))]: '2. Weihnachtstag',
  };
}


// ════════════════════════════════════════════════════
// BERLIN SCHULFERIEN (2024–2027, bitte jährlich prüfen)
// ════════════════════════════════════════════════════

function getSchoolHols(year) {
  const ranges = {
    2024: [[0,15,0,20],[1,5,1,10],[3,22,5,1],[7,1,8,14],[9,3,9,19],[11,23,11,31]],
    2025: [[0,1,0,4],[1,24,3,5],[6,24,8,6],[9,20,10,1],[11,22,11,31]],
    2026: [[0,1,0,3],[1,2,2,21],[6,16,8,28],[9,12,9,24],[11,21,11,31]],
    2027: [[0,1,0,2],[1,22,3,9],[6,22,9,3],[9,4,9,16],[11,22,11,31]],
  };
  const r = ranges[year] || ranges[2025];
  const s = new Set();
  r.forEach(([sm, sd, em, ed]) => {
    for (let d = new Date(year, sm, sd); d <= new Date(year, em, ed); d.setDate(d.getDate() + 1)) {
      s.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
  });
  return s;
}

function dkey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}


// ════════════════════════════════════════════════════
// TABS
// ════════════════════════════════════════════════════

function switchTab(name) {
  const names = ['kurse', 'schueler', 'wochenplan', 'monat'];
  document.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', names[i] === name));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  if (name === 'wochenplan') renderBasePlan();
  if (name === 'monat')      renderMonth();
}


// ════════════════════════════════════════════════════
// TAB 1 — KURSE
// ════════════════════════════════════════════════════

function addKurs(name = '', dauer = 45, preis = 35) {
  state.kurse.push({ id: uid(), name, dauer, preis });
  renderKurse();
}

function removeKurs(id) {
  state.kurse = state.kurse.filter(k => k.id !== id);
  for (const dow in state.basePlan)
    state.basePlan[dow] = state.basePlan[dow].filter(s => s.kursId !== id);
  renderKurse();
  renderBasePlan();
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
  const inp = document.getElementById('newSchuelerName');
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
  renderSchueler();
  renderBasePlan();
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

const DAY_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function toggleDay(dow) {
  if (state.activeDays.has(dow)) state.activeDays.delete(dow);
  else state.activeDays.add(dow);
  renderWeekdayBtns();
  renderBasePlan();
}

function renderWeekdayBtns() {
  document.querySelectorAll('#weekdayBtns .btn').forEach(btn => {
    const d = +btn.dataset.day;
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

function removeSlot(dow, idx) {
  state.basePlan[dow].splice(idx, 1);
  renderBasePlan();
}

function updateSlot(dow, idx, field, val) {
  state.basePlan[dow][idx][field] = +val;
  renderBasePlan();
}

function renderBasePlan() {
  renderWeekdayBtns();
  const container = document.getElementById('basePlanList');
  container.innerHTML = '';
  const days = [1, 2, 3, 4, 5, 6, 0].filter(d => state.activeDays.has(d));

  if (!days.length) {
    container.innerHTML = '<p class="hint">Wähle oben Unterrichtstage aus.</p>';
    updatePlanSummary();
    return;
  }

  days.forEach(dow => {
    const slots = state.basePlan[dow];
    const totalDay = slots.reduce((s, sl) => {
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
        <select onchange="updateSlot(${dow}, ${idx}, 'schuelerId', this.value)">
          ${state.schueler.map(s => `<option value="${s.id}"${s.id === sl.schuelerId ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}
        </select>
        <select onchange="updateSlot(${dow}, ${idx}, 'kursId', this.value)">
          ${state.kurse.map(k => `<option value="${k.id}"${k.id === sl.kursId ? ' selected' : ''}>${esc(k.name)} · €${k.preis}</option>`).join('')}
        </select>
        <button class="btn-icon" onclick="removeSlot(${dow}, ${idx})">×</button>`;
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
  const el = document.getElementById('planSummary');
  const days = [1, 2, 3, 4, 5, 6, 0].filter(d => state.activeDays.has(d));

  if (!days.length || !state.kurse.length) {
    el.innerHTML = '<div class="hint">Noch keine Einträge.</div>';
    return;
  }

  const totalW = days.reduce((s, dow) =>
    s + state.basePlan[dow].reduce((s2, sl) => {
      const k = state.kurse.find(k => k.id === sl.kursId);
      return s2 + (k ? k.preis : 0);
    }, 0), 0);

  const totalS = days.reduce((s, d) => s + state.basePlan[d].length, 0);

  el.innerHTML = `
    <div class="stat-row"><span class="stat-label">Schüler / Woche</span><span class="stat-val">${totalS}</span></div>
    <div class="stat-row"><span class="stat-label">Einnahmen / Woche</span><span class="stat-val">€ ${totalW.toFixed(2)}</span></div>
    <div class="stat-row"><span class="stat-label">Unterrichtstage</span><span class="stat-val">${days.length}</span></div>`;
}


// ════════════════════════════════════════════════════
// TAB 4 — MONATSABRECHNUNG
// ════════════════════════════════════════════════════

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return {
    week: Math.ceil((((d - yearStart) / 86400000) + 1) / 7),
    year: d.getUTCFullYear(),
  };
}

function getOverride(wk, dow) {
  if (!state.overrides[wk])       state.overrides[wk] = {};
  if (!state.overrides[wk][dow])  state.overrides[wk][dow] = { absent: new Set(), extra: [] };
  return state.overrides[wk][dow];
}

function toggleAbsent(wk, dow, sid) {
  const ov = getOverride(wk, dow);
  if (ov.absent.has(sid)) ov.absent.delete(sid);
  else ov.absent.add(sid);
  renderMonth();
}

function getMonthWeeks(year, month) {
  const seen = new Set(), weeks = [];
  const dim = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= dim; d++) {
    const { week, year: wy } = getISOWeek(new Date(year, month, d));
    const key = `${wy}-W${week}`;
    if (!seen.has(key)) { seen.add(key); weeks.push({ week, year: wy, key }); }
  }
  return weeks;
}

function getWeekStart(isoYear, isoWeek) {
  const jan4 = new Date(isoYear, 0, 4);
  const ws = new Date(jan4);
  ws.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1) + (isoWeek - 1) * 7);
  return ws;
}

// ── Extra-Schüler Modal ──────────────────────────────

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

function closeModal(e) {
  if (e.target.id === 'extraModal')
    document.getElementById('extraModal').style.display = 'none';
}

function removeExtra(wk, dow, idx) {
  getOverride(wk, dow).extra.splice(idx, 1);
  renderMonth();
}

// ── Main render ──────────────────────────────────────

function renderMonth() {
  const { year, month } = state;
  const holidays   = getHolidays(year);
  const schoolHols = getSchoolHols(year);
  const weeks      = getMonthWeeks(year, month);
  const container  = document.getElementById('weeksList');
  container.innerHTML = '';

  let grandTotal = 0, totalWorkDays = 0, totalSlots = 0;
  const kursIncome = {};

  weeks.forEach(({ week, year: wy, key: wk }) => {
    const ws = getWeekStart(wy, week);
    const daysInWeek = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(ws);
      d.setDate(ws.getDate() + i);
      if (d.getMonth() === month && d.getFullYear() === year) daysInWeek.push(d);
    }

    let weekTotal = 0;
    const weekBlock = document.createElement('div');
    weekBlock.className = 'week-block';

    const fmt = d => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    const first = daysInWeek[0], last = daysInWeek[daysInWeek.length - 1];
    const rangeLabel = `KW ${week} · ${fmt(first)}–${fmt(last)}`;

    const header = document.createElement('div');
    header.className = 'week-header';
    const incomeSpan = document.createElement('span');
    incomeSpan.className = 'week-income';
    incomeSpan.textContent = '€ 0,00';
    header.innerHTML = `<span class="week-title">${rangeLabel}</span>`;
    header.appendChild(incomeSpan);

    const body = document.createElement('div');
    body.className = 'week-body open';
    header.onclick = () => body.classList.toggle('open');

    weekBlock.appendChild(header);

    const activeDays = daysInWeek.filter(d => state.activeDays.has(d.getDay()));

    activeDays.forEach(d => {
      const dow    = d.getDay();
      const dk     = dkey(d.getFullYear(), d.getMonth(), d.getDate());
      const isHol  = !!holidays[dk];
      const isSchool = schoolHols.has(dk);
      const ov     = getOverride(wk, dow);
      const slots  = state.basePlan[dow] || [];

      const section = document.createElement('div');
      section.className = 'week-day-section';

      let badge = '';
      if (isHol)    badge = `<span class="badge badge-holiday">Feiertag: ${holidays[dk]}</span>`;
      else if (isSchool) badge = `<span class="badge badge-school">Schulferien</span>`;

      section.innerHTML = `<div class="week-day-label">${DAY_LONG[dow]}, ${d.getDate()}. ${badge}</div>`;

      if (isHol) { body.appendChild(section); return; }

      let dayHasStudents = false;

      // Base slots
      slots.forEach(sl => {
        const sch  = state.schueler.find(s => s.id === sl.schuelerId);
        const kurs = state.kurse.find(k => k.id === sl.kursId);
        if (!sch || !kurs) return;

        const absent = ov.absent.has(sl.schuelerId) || isSchool;
        if (!absent) {
          weekTotal += kurs.preis;
          totalSlots++;
          kursIncome[kurs.id] = (kursIncome[kurs.id] || 0) + kurs.preis;
          dayHasStudents = true;
        }

        const el = document.createElement('div');
        el.className = 'student-slot' + (absent ? ' absent' : '');
        el.title = isSchool ? 'Schulferien' : 'Klicken zum Markieren als abwesend';
        el.innerHTML = `
          <span class="s-name">${esc(sch.name)}</span>
          <span class="s-kurs">${esc(kurs.name)}</span>
          <span class="s-price">${absent ? '–' : '+'} €${kurs.preis.toFixed(2)}</span>`;
        if (!isSchool) el.onclick = () => toggleAbsent(wk, dow, sl.schuelerId);
        section.appendChild(el);
      });

      // Extra slots
      ov.extra.forEach((ex, exIdx) => {
        const sch  = state.schueler.find(s => s.id === ex.schuelerId);
        const kurs = state.kurse.find(k => k.id === ex.kursId);
        if (!sch || !kurs) return;

        weekTotal += kurs.preis;
        totalSlots++;
        kursIncome[kurs.id] = (kursIncome[kurs.id] || 0) + kurs.preis;
        dayHasStudents = true;

        const el = document.createElement('div');
        el.className = 'student-slot extra';
        el.innerHTML = `
          <span class="s-name">${esc(sch.name)} <span style="color:var(--green);font-size:10px">+extra</span></span>
          <span class="s-kurs">${esc(kurs.name)}</span>
          <span class="s-price">+€${kurs.preis.toFixed(2)}</span>
          <button class="btn-icon" style="margin-left:4px"
            onclick="removeExtra('${wk}', ${dow}, ${exIdx}); event.stopPropagation()">×</button>`;
        section.appendChild(el);
      });

      if (dayHasStudents) totalWorkDays++;

      // Add-extra button
      if (!isHol && state.schueler.length && state.kurse.length) {
        const addBtn = document.createElement('button');
        addBtn.className = 'week-extra-btn';
        addBtn.textContent = '+ Zusatz-Schüler';
        addBtn.onclick = () => openExtraModal((sid, kid) => {
          getOverride(wk, dow).extra.push({ schuelerId: sid, kursId: kid });
          renderMonth();
        });
        section.appendChild(addBtn);
      }

      body.appendChild(section);
    });

    grandTotal += weekTotal;
    incomeSpan.textContent = `€ ${weekTotal.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    weekBlock.appendChild(body);
    container.appendChild(weekBlock);
  });

  // ── Sidebar update ──
  document.getElementById('totalIncome').innerHTML =
    `<span>€</span> ${grandTotal.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('incomeSub').textContent =
    `${totalSlots} Unterrichtsstunden diesen Monat`;

  const ks = document.getElementById('kursStats');
  const hasAny = state.kurse.some(k => kursIncome[k.id]);
  ks.innerHTML = hasAny
    ? state.kurse.filter(k => kursIncome[k.id]).map(k => `
        <div class="kurs-stat">
          <span class="kurs-stat-name">${esc(k.name)}</span>
          <span class="kurs-stat-val">€ ${(kursIncome[k.id] || 0).toFixed(2)}</span>
        </div>`).join('')
    : '<div class="hint">Noch keine Daten.</div>';

  document.getElementById('dayStats').innerHTML = `
    <div class="stat-row"><span class="stat-label">Unterrichtstage</span><span class="stat-val">${totalWorkDays}</span></div>
    <div class="stat-row"><span class="stat-label">Schüler-Einheiten</span><span class="stat-val">${totalSlots}</span></div>`;
}


// ════════════════════════════════════════════════════
// YEAR / MONTH SELECTS
// ════════════════════════════════════════════════════

const selYear = document.getElementById('selYear');
const currentYear = new Date().getFullYear();
for (let y = currentYear - 1; y <= currentYear + 3; y++) {
  const o = document.createElement('option');
  o.value = y;
  o.textContent = y;
  if (y === currentYear) o.selected = true;
  selYear.appendChild(o);
}

document.getElementById('selMonth').value = state.month;
document.getElementById('selMonth').addEventListener('change', e => {
  state.month = +e.target.value;
  renderMonth();
});
selYear.addEventListener('change', e => {
  state.year = +e.target.value;
  renderMonth();
});


// ════════════════════════════════════════════════════
// UTILS
// ════════════════════════════════════════════════════

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


// ════════════════════════════════════════════════════
// INIT — Beispieldaten
// ════════════════════════════════════════════════════

addKurs('Gitarre 45 min', 45, 35);
addKurs('Klavier 60 min', 60, 45);
state.schueler.push({ id: uid(), name: 'Max Mustermann' });
state.schueler.push({ id: uid(), name: 'Anna Müller' });

renderSchueler();
renderKurse();
renderWeekdayBtns();
