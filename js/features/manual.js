/* Ручне / масове введення та друк (SN, PN, Brand) з оригіналу.
   Блок стоїть над таблицею на сторінках Final station I та II, згортається кліком по смузі над полями.
   Формат друку (100×78 або 130×76) береться з перемикача на сторінці (localStorage final1Mode / final2Mode).
   Мову задає загальний i18n.js.
   Викликається з main.js ПІСЛЯ pages/final.js (init() цього модуля достроює їхні сторінки). */
import { sb } from '../core/supabase.js';
import { TV } from '../core/pncache.js';
import { printList } from '../core/print.js';
import { lsGet, lsSet } from '../core/util.js';
import { createTranslator, onLangChange } from '../i18n.js';

const PAGES = [
  { id: 'final1Page', modeKey: 'final1Mode' },
  { id: 'final2Page', modeKey: 'final2Mode' }
];

const COLLAPSE_KEY = 'manualCollapse:';

/* ===== Переклади (10 мов сайту) ===== */
const I18N = {
  en: { sn: "Serial Number (SN)", pn: "Part Number (PN)", brand: "Brand", print: "🖨️ Print", printBrand: "🖨️ With Brand", alertFill: "Please fill in at least Serial Number or Part Number!", alertNoData: "No data found to print!" },
  uk: { sn: "Serial Number (SN)", pn: "Part Number (PN)", brand: "Brand", print: "🖨️ Друк", printBrand: "🖨️ З Brand", alertFill: "Будь ласка, заповніть хоча б Serial Number або Part Number!", alertNoData: "Не знайдено даних для друку!" },
  ru: { sn: "Serial Number (SN)", pn: "Part Number (PN)", brand: "Brand", print: "🖨️ Печать", printBrand: "🖨️ С Brand", alertFill: "Пожалуйста, заполните хотя бы Serial Number или Part Number!", alertNoData: "Не найдено данных для печати!" },
  pl: { sn: "Serial Number (SN)", pn: "Part Number (PN)", brand: "Brand", print: "🖨️ Drukuj", printBrand: "🖨️ Z Brand", alertFill: "Wypełnij co najmniej Serial Number lub Part Number!", alertNoData: "Nie znaleziono danych do druku!" },
  de: { sn: "Serial Number (SN)", pn: "Part Number (PN)", brand: "Brand", print: "🖨️ Drucken", printBrand: "🖨️ Mit Brand", alertFill: "Bitte mindestens Serial Number oder Part Number ausfüllen!", alertNoData: "Keine Daten zum Drucken gefunden!" },
  fr: { sn: "Serial Number (SN)", pn: "Part Number (PN)", brand: "Brand", print: "🖨️ Imprimer", printBrand: "🖨️ Avec Brand", alertFill: "Veuillez remplir au moins Serial Number ou Part Number !", alertNoData: "Aucune donnée à imprimer !" },
  es: { sn: "Serial Number (SN)", pn: "Part Number (PN)", brand: "Brand", print: "🖨️ Imprimir", printBrand: "🖨️ Con Brand", alertFill: "¡Complete al menos Serial Number o Part Number!", alertNoData: "¡No se encontraron datos para imprimir!" },
  it: { sn: "Serial Number (SN)", pn: "Part Number (PN)", brand: "Brand", print: "🖨️ Stampa", printBrand: "🖨️ Con Brand", alertFill: "Compila almeno Serial Number o Part Number!", alertNoData: "Nessun dato da stampare!" },
  pt: { sn: "Serial Number (SN)", pn: "Part Number (PN)", brand: "Brand", print: "🖨️ Imprimir", printBrand: "🖨️ Com Brand", alertFill: "Preencha pelo menos Serial Number ou Part Number!", alertNoData: "Nenhum dado encontrado para imprimir!" },
  tr: { sn: "Serial Number (SN)", pn: "Part Number (PN)", brand: "Brand", print: "🖨️ Yazdır", printBrand: "🖨️ Brand ile", alertFill: "En az Serial Number veya Part Number doldurun!", alertNoData: "Yazdırılacak veri bulunamadı!" }
};
const t = createTranslator(I18N);

const CSS = `
.mn-card { max-width: 1200px; width: 100%; margin: 0 auto 16px; box-sizing: border-box; }
.mn-head { height: 12px; margin: -6px 0 10px 0; border-radius: 6px; background: #1f2937; cursor: pointer; user-select: none; }
.mn-head:hover { background: #374151; }
.mn-card.mn-collapsed .mn-body { display: none; }
.mn-card.mn-collapsed .mn-head { margin-bottom: -6px; }
.mn-grid { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 12px; align-items: end; }
.mn-grid .form-group { min-width: 0; }
.mn-grid textarea { width: 100%; resize: vertical; min-height: 72px; font-size: 13px; line-height: 1.4; box-sizing: border-box; }
.mn-card .code-text { font-family: Consolas, 'Courier New', monospace; }
.mn-btns { display: flex; flex-direction: column; gap: 10px; }
.mn-btns .btn { width: 100%; }
@media (max-width: 900px) { .mn-grid { grid-template-columns: 1fr; } }
`;

const MARKUP = `
<div class="manual-input-card mn-card">
  <div class="mn-head"></div>
  <div class="mn-body">
    <div class="mn-grid">
      <div class="form-group">
        <label data-mn-t="sn"></label>
        <textarea class="form-input code-text mn-sn" rows="3"></textarea>
      </div>
      <div class="form-group">
        <label data-mn-t="pn"></label>
        <textarea class="form-input code-text mn-pn" rows="3"></textarea>
      </div>
      <div class="form-group">
        <label data-mn-t="brand"></label>
        <textarea class="form-input mn-brand" rows="3"></textarea>
      </div>
      <div class="mn-btns">
        <button type="button" class="btn btn-secondary mn-print" data-mn-t="print"></button>
        <button type="button" class="btn btn-brand mn-print-brand" data-mn-t="printBrand"></button>
      </div>
    </div>
  </div>
</div>`.trim();

const dbCache = new Map();

// Текущий формат печати той же страницы: 100x78 или 130x76 (перемикатель на странице)
function currentMode(modeKey) {
  return lsGet(modeKey) === '2' ? '2' : '1';
}

// PN и Brand по SN из базы (с запасным вариантом для TBV/TOV, как в оригинале)
async function lookupPn(sn) {
  const cached = dbCache.get(sn);
  if (cached) return cached;

  let result = { pn: '', brand: '' };
  try {
    const { data, error } = await sb().from(TV.TABLE).select(`${TV.PN}, ${TV.BRAND}`).eq(TV.SN, sn).limit(1);
    if (!error && data && data.length) {
      result = { pn: data[0][TV.PN] || '', brand: data[0][TV.BRAND] || '' };
    } else {
      const u = sn.toUpperCase();
      if (u.startsWith('TBV') && u.length >= 11) result = { pn: `750${u.substring(0, 11)}N000`, brand: 'PHP[PHP]' };
      else if (u.startsWith('TOV') && u.length >= 11) result = { pn: `730${u.substring(0, 11)}N000`, brand: 'PHP[PHP]' };
    }
  } catch (e) {}

  if (result.pn) dbCache.set(sn, result);
  return result;
}

// Разбор строки, скопированной из таблицы (колонки через Tab)
function parseSheetRow(parts) {
  if (!parts || parts.length === 0) return null;
  if (parts.length >= 8) {
    if ((parts[5] || '').toLowerCase() === 'panel sn') return null;
    if (!parts[5] && !parts[7]) return null;
    return { sn: parts[5] || '', pn: parts[7] || '', brand: parts[4] || '' };
  }
  if ((parts[0] || '').toLowerCase().startsWith('total')) return null;
  if (!parts[0]) return null;
  return { sn: parts[0] || '', pn: parts[1] || '', brand: parts[2] || '' };
}

// Формат берётся из переключателя страницы: 100x78 или 130x76
function printItems(items, inc, modeKey) {
  printList(items, inc, currentMode(modeKey), { id: 'mnPrintFrame' });
}

// Друк з полів введення (логіка з оригіналу)
async function printManual(card, inc, modeKey) {
  const snRaw = card.querySelector('.mn-sn').value.trim();
  const pnRaw = card.querySelector('.mn-pn').value.trim();
  const brandRaw = card.querySelector('.mn-brand').value.trim();

  if (!snRaw && !pnRaw) { alert(t('alertFill')); return; }

  const snLines = snRaw ? snRaw.split(/\r?\n/).map(s => s.trim()) : [];
  const pnLines = pnRaw ? pnRaw.split(/\r?\n/).map(s => s.trim()) : [];
  const brandLines = brandRaw ? brandRaw.split(/\r?\n/).map(s => s.trim()) : [];

  const max = Math.max(snLines.length, pnLines.length, brandLines.length);
  const items = [];

  for (let i = 0; i < max; i++) {
    let sn = snLines[i] || '';
    let pn = pnLines[i] || '';
    let brand = brandLines[i] || (brandLines[0] || '-');

    if (sn.includes('\t')) {
      const row = parseSheetRow(sn.split('\t').map(p => p.trim()));
      if (row) {
        sn = row.sn;
        if (row.pn) pn = row.pn;
        if (row.brand) brand = row.brand;
      } else {
        sn = '';
      }
    }

    if (sn && !pn) {
      const db = await lookupPn(sn);
      if (db.pn) pn = db.pn;
      if ((!brand || brand === '-') && db.brand) brand = db.brand;
    }

    if (sn || pn) items.push({ sn: sn || 'N/A', pn: pn || 'N/A', brand: brand || '-' });
  }

  if (!items.length) { alert(t('alertNoData')); return; }

  printItems(items, inc, modeKey);
}

// Вставка таблицы из Google Таблиц: SN, PN и Brand разносятся по полям
function onSnPaste(e) {
  const card = e.target.closest('.mn-card');
  const cd = e.clipboardData || window.clipboardData;
  const text = cd ? cd.getData('Text') : '';
  if (!text || !text.includes('\t')) return;
  e.preventDefault();

  const rows = [];
  text.split(/\r?\n/).filter(l => l.trim() !== '').forEach(line => {
    const row = parseSheetRow(line.split('\t').map(p => p.trim()));
    if (row) rows.push(row);
  });

  card.querySelector('.mn-sn').value = rows.map(r => r.sn).join('\n');
  card.querySelector('.mn-pn').value = rows.some(r => r.pn) ? rows.map(r => r.pn).join('\n') : '';
  card.querySelector('.mn-brand').value = rows.some(r => r.brand) ? rows.map(r => r.brand).join('\n') : '';
}

function applyLang(card) {
  card.querySelectorAll('[data-mn-t]').forEach(el => { el.textContent = t(el.dataset.mnT); });
}

function toggle(card, pageId) {
  const collapsed = card.classList.toggle('mn-collapsed');
  lsSet(COLLAPSE_KEY + pageId, collapsed ? '1' : '0');
}

function mount(page) {
  const root = document.getElementById(page.id);
  if (!root || root.querySelector('.mn-card')) return;

  const holder = document.createElement('div');
  holder.innerHTML = MARKUP;
  const card = holder.firstElementChild;
  root.insertBefore(card, root.firstChild);

  card.querySelector('.mn-head').addEventListener('click', () => toggle(card, page.id));
  card.querySelector('.mn-print').addEventListener('click', () => printManual(card, false, page.modeKey));
  card.querySelector('.mn-print-brand').addEventListener('click', () => printManual(card, true, page.modeKey));
  card.querySelector('.mn-sn').addEventListener('paste', onSnPaste);

  if (lsGet(COLLAPSE_KEY + page.id) === '1') card.classList.add('mn-collapsed');

  applyLang(card);
}

// Вызывается из main.js после init() страниц final1 / final2
export function init() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  PAGES.forEach(mount);

  onLangChange(() => document.querySelectorAll('.mn-card').forEach(applyLang));
}
