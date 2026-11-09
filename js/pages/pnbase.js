/* Страница «PN Base» (база деталей). Данные хранятся в Supabase, таблица public.pn_base:
   id, panel_pn, data (date), pn, location, info.
   Контейнер: <section id="pnbasePage">. Язык берётся из общего i18n.js, поддерживаются uk / pl / en.
   Библиотека JsBarcode подключается в index.html обычным <script> (window.JsBarcode).
   Кнопки управляются через data-act (раньше были inline onclick="pb.xxx()"). */
import { APP_CONFIG } from '../core/config.js';
import { sb } from '../core/supabase.js';
import { esc } from '../core/util.js';
import { printInFrame, pageCss } from '../core/print.js';
import { pick, onLangChange } from '../i18n.js';

const CSS = `
#pnbaseSection .pb-row { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
#pnbaseSection .pb-row .form-group { flex: 1; min-width: 150px; }
#pnbaseSection .manual-input-title { font-size: 16px; font-weight: 700; color: #111827; margin-bottom: 10px; }
#pnbaseSection .code-text { font-family: Consolas, 'Courier New', monospace; }
#pnbaseSection .pb-status { font-size: 12px; font-weight: 600; color: #2563EB; margin-top: 8px; }
#pnbaseSection .pb-hint { font-size: 12px; color: #6B7280; margin: 0 0 10px; }
#pnbaseSection #pb_edit { background: #F3F4F6; border: 1px solid #D1D5DB; border-radius: 8px; padding: 14px; margin: 12px 0; }
#pnbaseSection .pb-red { background: #991B1B; }
#pnbaseSection .pb-red:hover { background: #B91C1C; }
#pnbaseSection .pb-print { background: none; border: none; cursor: pointer; font-size: 16px; padding: 2px 6px; border-radius: 4px; }
#pnbaseSection .pb-print:hover { background: #E5E7EB; }
#pnbaseSection .data-table { border-collapse: collapse; width: 100%; font-size: 13px; color: #111827; }
#pnbaseSection .data-table th, #pnbaseSection .data-table td { padding: 8px 12px; border-bottom: 1px solid #E5E7EB; text-align: left; }
#pnbaseSection .data-table th { background: #F3F4F6; color: #374151; font-weight: 600; }
#pnbaseSection .pb-btnrow { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
#pnbaseSection .pb-sync { position: relative; width: 44px; height: 44px; padding: 0; border: none; border-radius: 10px; background: transparent; cursor: pointer; color: #34a853; }
#pnbaseSection .pb-sync:hover { background: rgba(255,255,255,.08); }
#pnbaseSection .pb-sync:disabled { opacity: .6; cursor: default; }
#pnbaseSection .pb-sync svg { width: 34px; height: 34px; display: block; margin: 0 auto; }
#pnbaseSection .pb-sync.pb-spin svg { animation: pbspin 1s linear infinite; }
@keyframes pbspin { to { transform: rotate(360deg); } }
.pb-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; z-index: 10000; }
.pb-box { background: #1f2b35; border: 1px solid #374151; border-radius: 12px; padding: 20px; max-width: 340px; color: #fff; font-size: 14px; text-align: center; }
.pb-box p { margin: 0 0 16px; }
.pb-box .btn { margin: 0 4px; }`;

// Иконка синхронизации (раньше были две встроенные картинки base64): два круговых стрелки
const SYNC_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 0-15.5-6.2L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 15.5 6.2L21 16"/><path d="M21 21v-5h-5"/></svg>`;

const SECTION = `
<div id="pnbaseSection">
  <div class="manual-input-card">
    <div class="manual-input-title" data-i18n="addTitle">Bulk Add</div>
    <div class="form-group" style="margin-bottom: 12px;">
      <label data-i18n="labelPanelPn">Panel_pn (List, one per line)</label>
      <textarea id="pb_panelPn" class="form-input code-text" rows="3" placeholder="750TBV500S74HHN000&#10;750TBV500S78AHN000..."></textarea>
    </div>
    <div class="pb-row">
      <div class="form-group"><label data-i18n="labelData">DATA</label><input type="date" id="pb_addData" class="form-input"></div>
      <div class="form-group"><label data-i18n="labelPn">PN</label><input type="text" id="pb_addPn" class="form-input code-text" placeholder="203BYQ..."></div>
      <div class="form-group"><label data-i18n="labelLocation">Location</label><input type="text" id="pb_addLocation" class="form-input code-text" placeholder="KUWETA 666"></div>
      <div class="form-group"><label data-i18n="labelInfo">info</label><input type="text" id="pb_addInfo" class="form-input code-text" placeholder="DIFF PLATE 50"></div>
    </div>
    <div class="pb-btnrow">
      <button class="btn" data-act="addBulk" data-i18n="btnAdd">+ Add List</button>
      <button class="pb-sync" id="pb_syncBtn" type="button" data-act="sync" data-i18n-title="syncTip" title="Sync with Google Sheets">${SYNC_ICON}</button>
    </div>
    <div id="pb_addStatus" class="pb-status"></div>
  </div>

  <div class="manual-input-card">
    <div class="manual-input-title" data-i18n="searchTitle">Search & Edit</div>
    <div class="pb-row" style="margin-bottom: 6px;">
      <input type="text" id="pb_query" class="form-input code-text" style="flex: 3; min-width: 200px;" data-i18n-placeholder="searchPlaceholder" placeholder="Enter PN or Panel_pn">
      <button class="btn" style="flex: 1;" data-act="search" data-i18n="btnSearch">Search</button>
    </div>
    <div id="pb_searchStatus" class="pb-status"></div>
    <div id="pb_edit" style="display: none;">
      <div class="manual-input-title" data-i18n="editTitle">Edit Found Rows</div>
      <p class="pb-hint" data-i18n="editHint">Leave the field empty if you don't want to change it.</p>
      <div class="pb-row">
        <div class="form-group"><label data-i18n="labelNewData">New Date</label><input type="date" id="pb_editData" class="form-input"></div>
        <div class="form-group"><label data-i18n="labelNewLocation">New Location</label><input type="text" id="pb_editLocation" class="form-input code-text"></div>
        <div class="form-group"><label data-i18n="labelNewInfo">New info</label><input type="text" id="pb_editInfo" class="form-input code-text"></div>
      </div>
      <button class="btn btn-brand" data-act="update" data-i18n="btnUpdate">Apply Changes</button>
    </div>
    <button class="btn pb-red" id="pb_dedupeBtn" style="display: none; margin-bottom: 10px;" data-act="dedupe" data-i18n="btnDedupe">Remove duplicates</button>
    <div style="overflow-x: auto;"><div id="pb_results"></div></div>
  </div>
</div>`;

const TABLE = 'pn_base';
const COLS = 'id, panel_pn, data, pn, location, info';
const PAGE_SIZE = 1000;   // Supabase отдаёт максимум 1000 строк за запрос, дальше листаем
const CHUNK = 200;        // сколько id отправляем в одном запросе на правку или удаление

const TR = {
  en: {addTitle:"Bulk Add",labelPanelPn:"Panel_pn (List, one per line)",labelData:"DATA",labelPn:"PN",labelLocation:"Location",labelInfo:"info",btnAdd:"+ Add List",searchTitle:"Search & Edit",searchPlaceholder:"Enter PN or Panel_pn",btnSearch:"Search",editTitle:"Edit Found Rows",editHint:"Leave the field empty if you don't want to change it.",labelNewData:"New Date",labelNewLocation:"New Location",labelNewInfo:"New info",btnUpdate:"Apply Changes",statusRecord:"Saving...",statusSearch:"Searching...",statusUpdate:"Updating...",notFound:"Nothing found.",errEnterPn:"Enter at least one Panel_pn",errEnterQuery:"Enter search query",errFillOne:"Fill out at least one field!",confirmUpdate:c=>`Update ${c} rows?`,confirmYes:"Yes",confirmNo:"Cancel",btnDedupe:"Remove duplicates",noDuplicates:"No duplicates.",statusDedupe:"Deleting...",confirmDedupe:c=>`Delete ${c} duplicates? Only the latest entry by date will be kept.`,err:"Error",printTip:"Print label",pasteNoCol:"Customer Model column not found",pasteAdded:c=>`✅ Panel_pn added: ${c}`,msgAdded:c=>`✅ Added rows: ${c}`,msgUpdated:c=>`✅ Updated rows: ${c}`,msgDeleted:c=>`✅ Deleted rows: ${c}`,errNoAccess:"Nothing was changed. Check the access policies of table pn_base in Supabase."},
  uk: {addTitle:"Масове додавання",labelPanelPn:"Panel_pn (Список з нового рядка)",labelData:"DATA",labelPn:"PN",labelLocation:"Location",labelInfo:"info",btnAdd:"+ Додати список",searchTitle:"Пошук та Редагування",searchPlaceholder:"Введіть PN або Panel_pn",btnSearch:"Знайти",editTitle:"Змінити знайдені рядки",editHint:"Залиште поле порожнім, якщо не хочете його змінювати.",labelNewData:"Нова Дата",labelNewLocation:"Нова Локація",labelNewInfo:"Нове info",btnUpdate:"Застосувати зміни",statusRecord:"Запис...",statusSearch:"Пошук...",statusUpdate:"Оновлення...",notFound:"Нічого не знайдено.",errEnterPn:"Введіть хоча б один Panel_pn",errEnterQuery:"Введіть запит",errFillOne:"Заповніть хоча б одне поле!",confirmUpdate:c=>`Оновити ${c} рядків?`,confirmYes:"Так",confirmNo:"Скасувати",btnDedupe:"Видалити дублікати",noDuplicates:"Дублікатів немає.",statusDedupe:"Видалення...",confirmDedupe:c=>`Видалити ${c} дублікатів? Залишиться лише останній запис за датою.`,err:"Помилка",printTip:"Друк етикетки",pasteNoCol:"Колонку Customer Model не знайдено",pasteAdded:c=>`✅ Додано Panel_pn: ${c}`,msgAdded:c=>`✅ Додано рядків: ${c}`,msgUpdated:c=>`✅ Оновлено рядків: ${c}`,msgDeleted:c=>`✅ Видалено рядків: ${c}`,errNoAccess:"Нічого не змінено. Перевірте політики доступу таблиці pn_base у Supabase."},
  pl: {addTitle:"Masowe dodawanie",labelPanelPn:"Panel_pn (Lista z nowej linii)",labelData:"DATA",labelPn:"PN",labelLocation:"Location",labelInfo:"info",btnAdd:"+ Dodaj listę",searchTitle:"Wyszukiwanie i Edycja",searchPlaceholder:"Wpisz PN lub Panel_pn",btnSearch:"Szukaj",editTitle:"Edytuj znalezione wiersze",editHint:"Pozostaw pole puste, jeśli chcesz je pominąć.",labelNewData:"Nowa Data",labelNewLocation:"Nowa Lokalizacja",labelNewInfo:"Nowe info",btnUpdate:"Zastosuj zmiany",statusRecord:"Zapisywanie...",statusSearch:"Szukanie...",statusUpdate:"Aktualizacja...",notFound:"Nic nie znaleziono.",errEnterPn:"Wprowadź co najmniej jeden Panel_pn",errEnterQuery:"Wprowadź zapytanie",errFillOne:"Wypełnij co najmniej jedno pole!",confirmUpdate:c=>`Zaktualizować ${c} wierszy?`,confirmYes:"Tak",confirmNo:"Anuluj",btnDedupe:"Usuń duplikaty",noDuplicates:"Brak duplikatów.",statusDedupe:"Usuwanie...",confirmDedupe:c=>`Usunąć ${c} duplikatów? Zostanie tylko najnowszy wpis wg daty.`,err:"Błąd",printTip:"Drukuj etykietę",pasteNoCol:"Nie znaleziono kolumny Customer Model",pasteAdded:c=>`✅ Dodano Panel_pn: ${c}`,msgAdded:c=>`✅ Dodano wierszy: ${c}`,msgUpdated:c=>`✅ Zaktualizowano wierszy: ${c}`,msgDeleted:c=>`✅ Usunięto wierszy: ${c}`,errNoAccess:"Nic nie zmieniono. Sprawdź polityki dostępu tabeli pn_base w Supabase."}
};

const SYNC_TR = {
  en: {syncTip:"Sync with Google Sheets",statusSync:"Syncing...",msgSynced:c=>`✅ Google Sheet updated. Rows: ${c}`,errSyncUrl:"Sync link is not set. Add PNBASE_SYNC_URL to config.js"},
  uk: {syncTip:"Синхронізувати з Google Таблицею",statusSync:"Синхронізація...",msgSynced:c=>`✅ Google Таблицю оновлено. Рядків: ${c}`,errSyncUrl:"Не вказано посилання синхронізації. Додайте PNBASE_SYNC_URL у config.js"},
  pl: {syncTip:"Synchronizuj z Arkuszem Google",statusSync:"Synchronizacja...",msgSynced:c=>`✅ Arkusz Google zaktualizowany. Wierszy: ${c}`,errSyncUrl:"Nie ustawiono linku synchronizacji. Dodaj PNBASE_SYNC_URL w config.js"}
};
Object.keys(SYNC_TR).forEach((l) => Object.assign(TR[l], SYNC_TR[l]));

const T = () => pick(TR);
const $ = (id) => document.getElementById(id);
const showToast = (m) => alert(m);
let results = [];

const fmtDate = (v) => { if (!v) return ''; const s = String(v), m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}.${m[2]}.${m[1]}` : s; };
const fail = (e) => showToast(T().err + ': ' + (e && e.message ? e.message : e));
const chunks = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

function applyLang() {
  document.querySelectorAll('#pnbaseSection [data-i18n]').forEach((el) => { const v = T()[el.dataset.i18n]; if (v) el.textContent = v; });
  document.querySelectorAll('#pnbaseSection [data-i18n-title]').forEach((el) => { const v = T()[el.dataset.i18nTitle]; if (v) el.title = v; });
  document.querySelectorAll('#pnbaseSection [data-i18n-placeholder]').forEach((el) => { const v = T()[el.dataset.i18nPlaceholder]; if (v) el.placeholder = v; });
  if (results.length) renderTable(results);
}

function ask(message) {
  return new Promise((resolve) => {
    const o = document.createElement('div'); o.className = 'pb-overlay';
    o.innerHTML = '<div class="pb-box"><p></p><button class="btn" data-y></button><button class="btn btn-secondary" data-n></button></div>';
    o.querySelector('p').textContent = message;
    o.querySelector('[data-y]').textContent = T().confirmYes;
    o.querySelector('[data-n]').textContent = T().confirmNo;
    document.body.appendChild(o);
    const done = (r) => { o.remove(); resolve(r); };
    o.querySelector('[data-y]').onclick = () => done(true);
    o.querySelector('[data-n]').onclick = () => done(false);
    o.addEventListener('click', (e) => { if (e.target === o) done(false); });
  });
}

// ===== запросы к Supabase =====
// Экранируем символы шаблона ilike, чтобы % и _ искались как обычные символы
const likeEsc = (s) => s.replace(/[\\%_]/g, '\\$&');

// Все строки, где колонка подходит под шаблон (листаем по 1000 строк)
async function fetchAll(col, pattern) {
  const out = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await sb().from(TABLE).select(COLS).ilike(col, pattern).order('id').range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return out;
}

// Поиск по PN или Panel_pn (без учёта регистра)
async function findBy(pattern) {
  const [a, b] = await Promise.all([fetchAll('panel_pn', pattern), fetchAll('pn', pattern)]);
  const map = new Map();
  [...a, ...b].forEach((r) => map.set(r.id, r));
  return [...map.values()].map((r) => ({ ...r, rowNumber: r.id }));
}

// ===== друк етикетки 130x90 мм =====
function printLabels(data, pn, location) {
  let d = data;
  if (!d) { const n = new Date(); d = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.position = 'absolute'; svg.style.visibility = 'hidden';
  document.body.appendChild(svg);
  window.JsBarcode(svg, String(pn), { format: 'CODE128B', displayValue: false, width: 2, height: 95, margin: 0, lineColor: '#000', background: '#fff' });
  svg.removeAttribute('style'); svg.setAttribute('class', 'print-barcode');
  const bc = svg.outerHTML; document.body.removeChild(svg);
  const blk = (title, val, last) => `<div class="print-block${last ? ' print-block-last' : ''}"><div class="print-title">${title}</div><div class="print-value">${esc(val)}</div></div>`;
  printFrame(`<div class="print-label">${bc}${blk('DATE', fmtDate(d))}${blk('PN', pn)}${blk('LOCATION', location, true)}</div>`);
}

function printFrame(labelHtml) {
  const docHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Label</title><style>
${pageCss(130, 90)}
*{box-sizing:border-box}
.print-label{width:130mm;height:90mm;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif;padding:6mm 6mm 5mm 6mm;overflow:hidden;break-inside:avoid;page-break-inside:avoid}
.print-block{width:100%;max-width:118mm;margin-bottom:3mm}
.print-block-last{margin-bottom:0}
.print-title{font-size:10pt;font-weight:900;line-height:1;margin-bottom:1.5mm}
.print-value{width:100%;max-width:118mm;font-size:16pt;font-weight:900;line-height:1.1;white-space:normal;overflow:visible;overflow-wrap:anywhere;word-break:break-word}
.print-barcode{display:block;width:118mm !important;max-width:118mm !important;height:26mm !important;margin:0 0 4mm 0}
</style></head><body>${labelHtml}</body></html>`;
  printInFrame(docHtml, {
    id: 'pbPrintFrame',
    // якщо текст не влазить: спочатку зменшуємо шрифт, потім штрихкод
    beforePrint: (win) => {
      const el = win.document.querySelector('.print-label');
      if (!el) return;
      const vals = el.querySelectorAll('.print-value'), bar = el.querySelector('.print-barcode');
      let size = 16, scale = 1;
      while (el.scrollHeight > el.clientHeight && (size > 7 || scale > 0.5)) {
        if (size > 7) { size -= 0.5; vals.forEach((v) => { v.style.fontSize = size + 'pt'; }); }
        else { scale -= 0.05; if (bar) bar.style.height = (26 * scale) + 'mm'; }
      }
    }
  });
}

// ===== дії =====
async function addBulk() {
  const panelPns = $('pb_panelPn').value.trim();
  if (!panelPns) return showToast(T().errEnterPn);
  const data = $('pb_addData').value, pn = $('pb_addPn').value.trim(), location = $('pb_addLocation').value.trim(), info = $('pb_addInfo').value.trim();

  // список Panel_pn: по одному в строке, без пустых и повторов внутри списка
  const list = [...new Set(panelPns.split(/\r?\n/).map((s) => s.trim().toUpperCase()).filter(Boolean))];
  if (!list.length) return showToast(T().errEnterPn);
  const rows = list.map((p) => ({ panel_pn: p, data: data || null, pn: pn || null, location: location || null, info: info || null }));

  $('pb_addStatus').textContent = T().statusRecord;
  try {
    for (const part of chunks(rows, 500)) {
      const { error } = await sb().from(TABLE).insert(part);
      if (error) throw error;
    }
  } catch (e) {
    $('pb_addStatus').textContent = '';
    return fail(e);
  }
  $('pb_addStatus').textContent = '';
  printLabels(data, pn, location);
  $('pb_panelPn').value = ''; $('pb_addInfo').value = '';
  showToast(T().msgAdded(rows.length));
}

async function search() {
  const q = $('pb_query').value.trim();
  if (!q) return showToast(T().errEnterQuery);
  $('pb_searchStatus').textContent = T().statusSearch;
  $('pb_results').innerHTML = '';
  $('pb_edit').style.display = 'none'; $('pb_dedupeBtn').style.display = 'none';
  try {
    // сначала точное совпадение, если ничего нет, то поиск по части текста
    const pat = likeEsc(q);
    let found = await findBy(pat);
    if (!found.length) found = await findBy('%' + pat + '%');
    // сначала самые свежие по дате
    found.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')) || b.id - a.id);
    results = found;
  } catch (e) {
    $('pb_searchStatus').textContent = '';
    return fail(e);
  }
  $('pb_searchStatus').textContent = '';
  if (results.length) {
    renderTable(results);
    $('pb_edit').style.display = 'block'; $('pb_dedupeBtn').style.display = 'inline-flex';
  } else $('pb_results').innerHTML = `<p class="pb-hint">${T().notFound}</p>`;
}

function renderTable(data) {
  const x = T();
  let h = `<table class="data-table"><thead><tr><th></th><th>Panel_pn</th><th>${esc(x.labelData)}</th><th>${esc(x.labelPn)}</th><th>${esc(x.labelLocation)}</th><th>${esc(x.labelInfo)}</th></tr></thead><tbody>`;
  data.forEach((r, i) => {
    h += `<tr><td>${i === 0 ? `<button class="pb-print" data-print="0" title="${esc(x.printTip)}">🖨️</button>` : ''}</td><td class="code-text">${esc(r.panel_pn)}</td><td>${esc(r.data)}</td><td class="code-text">${esc(r.pn)}</td><td>${esc(r.location)}</td><td>${esc(r.info)}</td></tr>`;
  });
  $('pb_results').innerHTML = h + '</tbody></table>';
  const b = $('pb_results').querySelector('[data-print]');
  if (b) b.onclick = () => { const r = results[0]; if (r) printLabels(r.data, r.pn, r.location); };
}

async function update() {
  if (!results.length) return;
  const ids = results.map((r) => r.id);
  const nd = $('pb_editData').value, nl = $('pb_editLocation').value.trim(), ni = $('pb_editInfo').value.trim();
  if (!nd && !nl && !ni) return showToast(T().errFillOne);
  if (!(await ask(T().confirmUpdate(ids.length)))) return;

  const patch = {};
  if (nd) patch.data = nd;
  if (nl) patch.location = nl;
  if (ni) patch.info = ni;

  $('pb_searchStatus').textContent = T().statusUpdate;
  let done = 0;
  try {
    for (const part of chunks(ids, CHUNK)) {
      const { data, error } = await sb().from(TABLE).update(patch).in('id', part).select('id');
      if (error) throw error;
      done += data.length;
    }
  } catch (e) {
    $('pb_searchStatus').textContent = '';
    return fail(e);
  }
  $('pb_searchStatus').textContent = '';
  // 0 строк без ошибки значит, что политики Supabase не разрешили изменение
  if (!done) return showToast(T().errNoAccess);

  const f = results[0];
  printLabels(nd || f.data || '', f.pn || '', nl || f.location || '');
  $('pb_editData').value = ''; $('pb_editLocation').value = ''; $('pb_editInfo').value = '';
  setTimeout(search, 700);
  showToast(T().msgUpdated(done));
}

// дублікати: по Panel_pn лишається рядок з найпізнішою датою
function findDuplicates(rows) {
  const groups = {};
  rows.forEach((r) => { const k = String(r.panel_pn || '').trim().toUpperCase(); if (k) (groups[k] = groups[k] || []).push(r); });
  const del = [];
  Object.values(groups).forEach((g) => {
    if (g.length < 2) return;
    g.sort((a, b) => { const d = String(b.data || '').localeCompare(String(a.data || '')); return d !== 0 ? d : b.id - a.id; });
    g.slice(1).forEach((r) => del.push({ id: r.id, panel_pn: r.panel_pn }));
  });
  return del;
}

async function dedupe() {
  const del = findDuplicates(results);
  if (!del.length) return showToast(T().noDuplicates);
  if (!(await ask(T().confirmDedupe(del.length)))) return;
  $('pb_searchStatus').textContent = T().statusDedupe;
  let done = 0;
  try {
    for (const part of chunks(del.map((r) => r.id), CHUNK)) {
      const { data, error } = await sb().from(TABLE).delete().in('id', part).select('id');
      if (error) throw error;
      done += data.length;
    }
  } catch (e) {
    $('pb_searchStatus').textContent = '';
    return fail(e);
  }
  $('pb_searchStatus').textContent = '';
  if (!done) return showToast(T().errNoAccess);
  showToast(T().msgDeleted(done));
  search();
}

// ===== синхронизация с Google Таблицей (Apps Script) =====
async function sync() {
  const url = APP_CONFIG.PNBASE_SYNC_URL;
  if (!url) return showToast(T().errSyncUrl);
  const btn = $('pb_syncBtn');
  btn.disabled = true; btn.classList.add('pb-spin');
  $('pb_addStatus').textContent = T().statusSync;
  try {
    const res = await fetch(url, { method: 'GET' });
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || 'sync failed');
    $('pb_addStatus').textContent = '';
    showToast(T().msgSynced(j.rows));
  } catch (e) {
    $('pb_addStatus').textContent = '';
    fail(e);
  } finally {
    btn.disabled = false; btn.classList.remove('pb-spin');
  }
}

const ACTIONS = { addBulk, search, update, dedupe, sync };

export function init() {
  const page = document.getElementById('pnbasePage');
  if (!page) return;

  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  page.innerHTML = SECTION;

  // Кнопки через делегирование (раньше inline onclick)
  page.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b && ACTIONS[b.dataset.act]) ACTIONS[b.dataset.act]();
  });

  // ===== вставка таблиці з QSP у Panel_pn: лишається тільки колонка Customer Model =====
  $('pb_panelPn').addEventListener('paste', (e) => {
    const text = (e.clipboardData || window.clipboardData).getData('Text');
    if (!text || !text.includes('\t')) return; // звичайний список з нового рядка — вставляється як є
    e.preventDefault();

    const rows = text.split(/\r?\n/).map((l) => l.split('\t').map((c) => c.trim()));

    // колонку шукаємо за заголовком "Customer Model"; якщо заголовка немає у виділенні — це 3-тя колонка
    let col = 2;
    for (const r of rows) {
      const i = r.findIndex((c) => c.toLowerCase() === 'customer model');
      if (i !== -1) { col = i; break; }
    }

    const seen = new Set();
    const values = [];
    rows.forEach((r) => {
      const v = (r[col] || '').toUpperCase();
      // тільки схожі на Panel_pn (літери/цифри): відсікає заголовки та службові рядки
      if (/^[A-Z0-9]{8,}$/.test(v) && !seen.has(v)) { seen.add(v); values.push(v); }
    });

    if (!values.length) return showToast(T().pasteNoCol);

    const ta = e.target;
    ta.setRangeText(values.join('\n'), ta.selectionStart, ta.selectionEnd, 'end');
    showToast(T().pasteAdded(values.length));
  });

  onLangChange(applyLang);
  applyLang();
}
