/* Statistic (вкладка «Statistic»): статистика за период, стиль сайта, без колонки Name.
   Язык берётся из общего i18n.js. Мови: uk / pl / en.
   Контейнер: <section id="statsPage">. Дані завантажуються при першому відкритті сторінки (show()).
   Источник данных: база Supabase, таблица fi_log (её каждую минуту заполняет скрипт из рабочей Google Таблицы). */
import { sb } from '../core/supabase.js';
import { fromSerial } from '../core/diagonals.js';
import { esc, localDate } from '../core/util.js';
import { createTranslator, onLangChange } from '../i18n.js';

const VALID_STATUSES = ['OK', 'NDF'];

/* ===== Переклади (uk / pl / en) ===== */
const I18N = {
  en: {
    from: 'From', to: 'To', workers: 'Workers', all: 'all', selectAll: 'Select all', clearAll: 'Clear all',
    update: 'Update', updating: 'Loading...', noData: 'No data for the selected workers',
    total: 'Total (Sum / OK / NDF)', days: 'Days', scrapTitle: '📊 Scrap / Waiting statistics',
    scrapNoData: 'No data', totalRow: 'Total', mainTitle: 'Statistics',
    loadErr: 'Failed to load data'
  },
  uk: {
    from: 'Від', to: 'До', workers: 'Працівники', all: 'всі', selectAll: 'Вибрати всіх', clearAll: 'Зняти всіх',
    update: 'Оновити', updating: 'Завантаження...', noData: 'Немає даних для вибраних працівників',
    total: 'Разом (Сума / OK / NDF)', days: 'Днів', scrapTitle: '📊 Статистика Scrap / Waiting',
    scrapNoData: 'Немає даних', totalRow: 'Разом', mainTitle: 'Статистика',
    loadErr: 'Не вдалося завантажити дані'
  },
  pl: {
    from: 'Od', to: 'Do', workers: 'Pracownicy', all: 'wszyscy', selectAll: 'Zaznacz wszystkich', clearAll: 'Odznacz wszystkich',
    update: 'Aktualizuj', updating: 'Ładowanie...', noData: 'Brak danych dla wybranych pracowników',
    total: 'Razem (Sum / OK / NDF)', days: 'Dni', scrapTitle: '📊 Scrap / Waiting Statistics',
    scrapNoData: 'Brak danych', totalRow: 'Razem / Total', mainTitle: 'Statystyka',
    loadErr: 'Nie udało się wczytać danych'
  }
};
const t = createTranslator(I18N);

const CSS = `
/* ----- Панель фильтров ----- */
#statsPage .st-controls {
  display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; justify-content: center;
  width: 95%; max-width: 1200px; margin: 0 auto 20px;
}
#statsPage .st-field { display: flex; flex-direction: column; gap: 4px; }
#statsPage .st-field label { font-size: 12px; color: #9CA3AF; font-weight: 600; }
#statsPage input[type=date] { padding: 9px 12px; font-size: 14px; color-scheme: dark; }

#statsPage .st-btn { padding: 10px 22px; font-size: 14px; }
#statsPage .st-btn:disabled { opacity: 0.6; cursor: wait; }
#statsPage .st-btn-ghost {
  background: #111827; color: #fff; border: 1px solid #374151; padding: 10px 16px; border-radius: 8px;
  font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap;
}
#statsPage .st-btn-ghost:hover { border-color: #2563EB; }

/* ----- Выбор работников ----- */
#statsPage .st-dd { position: relative; }
#statsPage .st-dd-content {
  display: none; position: absolute; top: calc(100% + 6px); left: 0; min-width: 240px; max-height: 300px;
  overflow-y: auto; background: #111827; border: 1px solid #374151; border-radius: 10px; padding: 12px;
  z-index: 100; box-shadow: 0 10px 25px rgba(0,0,0,0.6);
}
#statsPage .st-dd-content.show { display: block; }
#statsPage .st-dd-actions {
  display: flex; justify-content: center; gap: 12px; font-size: 12px; color: #4d94ff;
  padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid #1f2937;
}
#statsPage .st-dd-actions span { cursor: pointer; }
#statsPage .st-dd-actions span:hover { color: #fff; text-decoration: underline; }
#statsPage .st-check { display: flex; align-items: center; gap: 10px; padding: 5px 0; font-size: 13px; cursor: pointer; color: #E5E7EB; }
#statsPage .st-check input { accent-color: #7c3aed; width: 16px; height: 16px; cursor: pointer; }

/* ----- Карточки и таблицы ----- */
#statsPage .st-card { width: 95%; max-width: 1200px; margin: 0 auto 20px; }
#statsPage .st-head {
  cursor: pointer; user-select: none;
  padding: 12px 18px; background: #111827; color: #fff; font-weight: 700; font-size: 15px;
  border-bottom: 1px solid #1f2937;
}
#statsPage .st-head:hover { color: #4d94ff; }
#statsPage .st-card.collapsed .st-head { border-bottom: none; }
#statsPage .st-card.collapsed .st-body { display: none; }

#statsPage .st-table-wrap { overflow-x: auto; }
#statsPage th, #statsPage td { white-space: nowrap; }
#statsPage td.name-cell { text-align: left; color: #fff; font-weight: 600; }
#statsPage tr.person-row:hover td { background: rgba(255,255,255,0.03); }
#statsPage .st-split { display: inline-flex; gap: 6px; align-items: center; justify-content: center; }
#statsPage .st-sum { color: #fff; font-weight: 700; }
#statsPage .st-sep { color: #6B7280; }
#statsPage .st-okc { color: #4d94ff; }
#statsPage .st-ndfc { color: #f472b6; }
#statsPage .st-msg { color: #9CA3AF; text-align: center; padding: 20px; margin: 0; }
#statsPage .st-warn { color: #F87171; text-align: center; padding: 10px; margin: 0; font-weight: 600; }

/* ----- Scrap / Waiting ----- */
#statsPage .scrap { color: #f87171; font-weight: 700; }
#statsPage .waiting { color: #fbbf24; font-weight: 700; }
#statsPage .st-cell-split { display: flex; justify-content: center; gap: 10px; }

#statsPage details.st-details {
  width: 95%; max-width: 1200px; margin: 0 auto 20px; background: #0e0e0e; border: 1px solid #1f2937;
  border-radius: 10px; overflow: hidden;
}
#statsPage details.st-details > summary {
  cursor: pointer; padding: 12px 18px; background: #111827; color: #fff; font-weight: 700; font-size: 15px; list-style: none;
}
#statsPage details.st-details > summary:hover { color: #4d94ff; }
#statsPage details.st-details > .st-card { width: 100%; max-width: none; margin: 0; border: none; border-radius: 0; box-shadow: none; }

@media (max-width: 1080px) {
  #statsPage .st-controls, #statsPage .st-card, #statsPage details.st-details { width: 100%; }
}
`;

const MARKUP = `
<div class="st-controls">
  <div class="st-field">
    <label for="st-from" data-st="from"></label>
    <input type="date" id="st-from">
  </div>
  <div class="st-field">
    <label for="st-to" data-st="to"></label>
    <input type="date" id="st-to">
  </div>
  <div class="st-field st-dd" id="st-dd">
    <label>&nbsp;</label>
    <button type="button" id="st-dd-btn" class="st-btn-ghost"></button>
    <div id="st-dd-content" class="st-dd-content">
      <div class="st-dd-actions">
        <span id="st-all" data-st="selectAll"></span>
        <span id="st-none" data-st="clearAll"></span>
      </div>
      <div id="st-checkboxes"></div>
    </div>
  </div>
  <div class="st-field">
    <label>&nbsp;</label>
    <button type="button" id="st-update" class="st-btn"></button>
  </div>
</div>

<div class="st-card" id="st-stats">
  <div class="st-head" id="st-head" data-st="mainTitle"></div>
  <div class="st-body" id="st-body"></div>
</div>

<details class="st-details" id="st-scrap-details">
  <summary data-st="scrapTitle"></summary>
  <div class="st-card" id="st-scrap"></div>
</details>
`;

const $ = (id) => document.getElementById(id);

let started = false;
let loaded = false;
let busy = false;
let loadFailed = false;      // часть данных (или все) не удалось загрузить
let mainCollapsed = false;
let lastFilteredData = [];
let selectedPeople = new Set();
let allPeople = [];

// Диагонали: общая таблица в core/diagonals.js
function getDiagonals(serial) {
  const d = fromSerial(serial);
  return d ? [d] : [];
}

// Один человек может быть записан по-разному: «STAROZHYLOVA A.», «ANNA STAROZHYLOVA», «Kuca J.» и «KUCA J.».
// Объединяем такие записи под одним именем в виде «ФАМИЛИЯ И.». Чтобы понять, какое слово фамилия, нужна форма
// «ФАМИЛИЯ И.»: она берётся из самих данных и из этого списка. Если человек записан полным именем, а в данных
// за период его краткой формы нет, добавьте её сюда. Остальные имена остаются как есть (только заглавными).
const KNOWN_PEOPLE = [
  'STAROZHYLOVA A.', 'ZAHUMENOVA H.', 'HRYSHCHUK O.', 'KUCA J.',
  'PARYTSKA O.', 'ISAŃSKA M.', 'BAKAREVA N.'
];

function normName(s) {
  return String(s || '').replace(/\./g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}

// Для сравнения: без точек, регистра и диакритики (ISAŃSKA = ISANSKA)
function foldName(s) {
  return normName(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/Ł/g, 'L');
}

function mergeNames(rows) {
  const known = new Map(); // «ФАМИЛИЯ|И» (для сравнения) -> «ФАМИЛИЯ И.» (как показываем)
  function addKnown(display) {
    const f = foldName(display).split(' ');
    if (f.length === 2 && f[1].length === 1) {
      const k = f[0] + '|' + f[1];
      if (!known.has(k)) {
        const n = normName(display).split(' ');
        known.set(k, n[0] + ' ' + n[1] + '.');
      }
    }
  }
  KNOWN_PEOPLE.forEach(addKnown);
  rows.forEach(r => addKnown(r.person));

  const cache = new Map();
  function canon(raw) {
    if (cache.has(raw)) return cache.get(raw);
    const n = normName(raw);
    const p = foldName(raw).split(' ');
    let res = n;
    if (p.length === 2) {
      if (p[1].length === 1) {
        res = known.get(p[0] + '|' + p[1]) || n;               // уже «ФАМИЛИЯ И.»
      } else {
        const a = known.get(p[0] + '|' + p[1][0]);            // «ФАМИЛИЯ ИМЯ»
        const b = known.get(p[1] + '|' + p[0][0]);            // «ИМЯ ФАМИЛИЯ»
        if (a && !b) res = a;
        else if (b && !a) res = b;
      }
    }
    cache.set(raw, res);
    return res;
  }

  rows.forEach(r => { r.person = canon(r.person); });
  return rows;
}

// Данные периода из базы (таблица fi_log), включая сегодняшний день
async function fetchFromDb(dateFrom, dateTo) {
  const client = sb();
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from('fi_log')
      .select('day, serial, status, name')
      .gte('day', dateFrom)
      .lte('day', dateTo)
      .order('id')
      .range(from, from + 999);
    if (error) throw error;
    data.forEach(r => out.push({
      date: r.day || '',
      serial: r.serial || '',
      status: String(r.status || '').trim().toUpperCase(),
      person: String(r.name || '').trim()
    }));
    if (data.length < 1000) break;
  }
  return mergeNames(out);
}

async function fetchData(dateFrom, dateTo) {
  try {
    return { rows: await fetchFromDb(dateFrom, dateTo), failed: false };
  } catch (err) {
    console.error('fi_log error:', err);
    return { rows: [], failed: true };
  }
}

function updateDropdownButtonText() {
  const total = allPeople.length;
  const count = selectedPeople.size;
  const label = (total === 0 || count === total) ? t('all') : `${count}/${total}`;
  $('st-dd-btn').textContent = `${t('workers')} (${label}) ▼`;
}

function buildPersonDropdown() {
  const box = $('st-checkboxes');
  box.innerHTML = '';
  allPeople.forEach(person => {
    const label = document.createElement('label');
    label.className = 'st-check';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = person;
    cb.checked = selectedPeople.has(person);
    cb.addEventListener('change', () => {
      if (cb.checked) selectedPeople.add(person);
      else selectedPeople.delete(person);
      updateDropdownButtonText();
      renderFilteredViews();
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(person));
    box.appendChild(label);
  });
  updateDropdownButtonText();
}

function selectAllPeople(select) {
  selectedPeople = select ? new Set(allPeople) : new Set();
  $('st-checkboxes').querySelectorAll('input[type=checkbox]').forEach(cb => { cb.checked = select; });
  updateDropdownButtonText();
  renderFilteredViews();
}

async function update() {
  if (busy) return;
  const dateFrom = $('st-from').value;
  const dateTo = $('st-to').value;
  if (!dateFrom || !dateTo) return;

  busy = true;
  $('st-update').disabled = true;
  $('st-update').textContent = t('updating');

  try {
    const result = await fetchData(dateFrom, dateTo);
    lastFilteredData = result.rows;
    loadFailed = result.failed;

    allPeople = Array.from(new Set(lastFilteredData.map(d => d.person).filter(Boolean))).sort();
    const kept = allPeople.filter(p => selectedPeople.has(p));
    selectedPeople = new Set(kept.length ? kept : allPeople);

    buildPersonDropdown();
    loaded = true;
    renderFilteredViews();
  } finally {
    busy = false;
    $('st-update').disabled = false;
    $('st-update').textContent = t('update');
  }
}

function renderFilteredViews() {
  if (!loaded) return;
  const data = lastFilteredData.filter(d => selectedPeople.has(d.person));
  renderTable(calculateDetailedStats(data));
  renderScrapWaitingTable(calculateScrapWaitingStats(data));
}

function calculateDetailedStats(data) {
  const stats = {};
  data.forEach(({ date, serial, status, person }) => {
    if (!VALID_STATUSES.includes(status)) return;
    const diagonals = getDiagonals(serial);
    if (diagonals.length === 0) return;

    if (!stats[person]) stats[person] = { diagonals: {}, okCount: 0, ndfCount: 0, days: new Set() };

    const day = date.split(' ')[0];
    if (day) stats[person].days.add(day);
    if (status === 'OK') stats[person].okCount++;
    if (status === 'NDF') stats[person].ndfCount++;

    diagonals.forEach(diagonal => {
      if (!stats[person].diagonals[diagonal]) stats[person].diagonals[diagonal] = { sum: 0 };
      stats[person].diagonals[diagonal].sum++;
    });
  });
  return stats;
}

function calculateScrapWaitingStats(data) {
  const stats = {};
  data.forEach(({ serial, status, person }) => {
    if (!person || !serial || !status) return;
    const upper = status.toUpperCase();
    const type = upper.includes('SCRAP') ? 'scrap' : upper.includes('WAITING') ? 'waiting' : null;
    if (!type) return;
    const diagonals = getDiagonals(serial);
    if (diagonals.length === 0) return;
    if (!stats[person]) stats[person] = {};
    diagonals.forEach(diagonal => {
      if (!stats[person][diagonal]) stats[person][diagonal] = { scrap: 0, waiting: 0 };
      stats[person][diagonal][type]++;
    });
  });
  return stats;
}

function splitCell(total, ok, ndf) {
  return `<div class="st-split">
    <span class="st-sum">${total}</span><span class="st-sep">/</span>
    <span class="st-okc">${ok}</span><span class="st-sep">/</span>
    <span class="st-ndfc">${ndf}</span>
  </div>`;
}

function renderTable(stats) {
  const body = $('st-body');
  const warn = loadFailed ? `<p class="st-warn">${esc(t('loadErr'))}</p>` : '';

  const diagonals = Array.from(new Set(
    Object.values(stats).flatMap(p => Object.keys(p.diagonals).map(Number))
  )).sort((a, b) => b - a);

  const people = Object.keys(stats).sort((a, b) =>
    (stats[b].okCount + stats[b].ndfCount) - (stats[a].okCount + stats[a].ndfCount)
  );

  if (people.length === 0) {
    body.innerHTML = loadFailed ? warn : `<p class="st-msg">${esc(t('noData'))}</p>`;
    return;
  }

  const diagTotals = {};
  diagonals.forEach(d => { diagTotals[d] = 0; });
  let gOk = 0, gNdf = 0;

  const rows = people.map(person => {
    const p = stats[person];
    const rowTotal = p.okCount + p.ndfCount;
    gOk += p.okCount;
    gNdf += p.ndfCount;
    const cells = diagonals.map(d => {
      const v = p.diagonals[d] ? p.diagonals[d].sum : 0;
      diagTotals[d] += v;
      return `<td>${v || '-'}</td>`;
    }).join('');
    return `<tr class="person-row">
      <td class="name-cell">${esc(person)}</td>${cells}
      <td class="sum-col">${splitCell(rowTotal, p.okCount, p.ndfCount)}</td>
      <td>${p.days.size}</td>
    </tr>`;
  }).join('');

  const footCells = diagonals.map(d => `<td>${diagTotals[d] || '-'}</td>`).join('');

  body.innerHTML = warn + `
    <div class="st-table-wrap">
      <table>
        <thead>
          <tr>
            <th></th>
            ${diagonals.map(d => `<th>${d}</th>`).join('')}
            <th class="sum-col">${esc(t('total'))}</th>
            <th>${esc(t('days'))}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td class="name-cell">${esc(t('totalRow'))}</td>
            ${footCells}
            <td class="sum-col">${splitCell(gOk + gNdf, gOk, gNdf)}</td>
            <td>-</td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

function renderScrapWaitingTable(stats) {
  const container = $('st-scrap');
  const diagonals = Array.from(new Set(
    Object.values(stats).flatMap(p => Object.keys(p).map(Number))
  )).sort((a, b) => b - a);

  if (diagonals.length === 0) {
    container.innerHTML = `<p class="st-msg">${esc(t('scrapNoData'))}</p>`;
    return;
  }

  const rows = Object.keys(stats).map(person => {
    const cells = diagonals.map(d => {
      const c = stats[person][d];
      return c
        ? `<td><div class="st-cell-split"><span class="scrap">${c.scrap}</span><span class="waiting">${c.waiting}</span></div></td>`
        : '<td>-</td>';
    }).join('');
    return `<tr><td class="name-cell">${esc(person)}</td>${cells}</tr>`;
  }).join('');

  container.innerHTML = `
    <div class="st-table-wrap">
      <table>
        <thead>
          <tr><th></th>${diagonals.map(d => `<th>${d}</th>`).join('')}</tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// Сворачивание основной таблицы: состояние помнится между сменами языка и фильтров
function applyMainCollapsed() {
  $('st-stats').classList.toggle('collapsed', mainCollapsed);
}

function applyText() {
  document.querySelectorAll('#statsPage [data-st]').forEach(el => {
    el.textContent = t(el.dataset.st);
  });
  $('st-update').textContent = busy ? t('updating') : t('update');
  updateDropdownButtonText();
}

export function init() {
  const root = $('statsPage');
  if (!root) return;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  root.innerHTML = MARKUP;

  $('st-from').value = localDate();
  $('st-to').value = localDate();

  $('st-dd-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    $('st-dd-content').classList.toggle('show');
  });
  document.addEventListener('click', (e) => {
    if (!$('st-dd').contains(e.target)) $('st-dd-content').classList.remove('show');
  });

  $('st-all').addEventListener('click', () => selectAllPeople(true));
  $('st-none').addEventListener('click', () => selectAllPeople(false));
  $('st-update').addEventListener('click', update);

  $('st-head').addEventListener('click', () => {
    mainCollapsed = !mainCollapsed;
    applyMainCollapsed();
  });

  applyText();
  applyMainCollapsed();

  onLangChange(() => {
    applyText();
    renderFilteredViews();
  });
}

// Оболочка вызывает при открытии вкладки Statistic.
// Данные загружаются при первом открытии, дальше — по кнопке «Обновить».
export function show() {
  if (started) return;
  started = true;
  update();
}
