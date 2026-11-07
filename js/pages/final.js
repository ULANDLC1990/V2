/* Final inspection station I и II: списки SN из Google Таблицы (вкладки FI 1 и FI 2), печать этикеток.
   Один модуль на обе станции. Каждая станция создаётся отдельно (createStation): своя страница, свой список,
   свой формат 100×78 или 130×76, свои ключи в localStorage. Общее: подключение к базе, база PN на устройстве
   (core/pncache.js), горячие клавиши.

   Горячие клавиши (работают на любой странице сайта):
     Открыта страница Final I: печатает Final I. Иначе (Final II, Repair Log, любая другая страница): печатает Final II.
     Shift+P — печать без бренда (первая строка или выделенные). В полях ввода не срабатывает.
     Ctrl+P  — то же; стандартное окно печати браузера не открывается.
     Alt+P   — печать с брендом в выбранном формате.
     Ctrl+C  — копирование выделенной колонки (только на открытой странице Final I или Final II).
   Двойной клик по серийному номеру — копирование в буфер обмена (без уведомления).
   Данные обновляются в фоне каждые 5 секунд, независимо от того, открыта ли страница.

   printFinal2BySn(sn, offline) — печать по SN на станции II в формате, выбранном на её странице.
   Её вызывает журнал ремонта (repairlog.js); не зависит от того, какая страница открыта.

   Контейнеры: <section id="final1Page"> и <section id="final2Page">.
   Экспорт: final1 и final2 ({ init, show }); язык берётся из i18n.js. */
import { createTranslator, onLangChange } from '../i18n.js';
import { APP_CONFIG } from '../core/config.js';
import { sb } from '../core/supabase.js';
import { esc, parseCSV, isTyping, copyText } from '../core/util.js';
import { printList } from '../core/print.js';
import { TV, fromBase, localPn, pnbRemember } from '../core/pncache.js';

// ===== Общее для обеих станций =====
const SHEET_ID = APP_CONFIG.SHEET_ID;
const RETRY_MS = 3000, REFRESH_MS = 5000, FETCH_TIMEOUT_MS = 15000, MAX_ROWS = 10;

// Станции: страница, вкладка таблицы, ключ формата
const CONFIGS = {
  final1: {
    name: 'final1',
    gid: '0',                       // вкладка таблицы: FI 1
    pageId: 'final1Page',
    modeKey: 'final1Mode'
  },
  final2: {
    name: 'final2',
    gid: '193025884',               // вкладка таблицы: FI 2
    pageId: 'final2Page',
    modeKey: 'final2Mode'
  }
};

// ===== Одна станция (своё всё: список, выбор, формат, язык, таймер обновления) =====
function createStation(CFG) {
  const P = CFG.name;
  const PAGE = `#${CFG.pageId}`;
  const PRINT_OPTS = { id: `${P}PrintFrame` };

  /* ===== Переклади (10 мов сайту) ===== */
  const I18N = {
    en: { colSn: "Serial Number (SN)", colPn: "Part Number (PN)", colBrand: "Brand", colPrint: "Print", loading: "Loading data...", noRecords: "No records in the sheet yet", batchNormal: "🖨️ Print selected", batchBrand: "🖨️ Print selected with Brand", titleNew: "Print new format 130x76 mm", titleTwo: "Print 2 copies", titleTwoBrand: "Print 2 copies with Brand", toastSel: "🖍️ Selected {n} — Ctrl+C to copy", toastCopied: "✅ Copied {n} values", toastPn: "⏳ PN not found in the database yet" },
    uk: { colSn: "Serial Number (SN)", colPn: "Part Number (PN)", colBrand: "Brand", colPrint: "Друк", loading: "Завантаження даних...", noRecords: "У таблиці ще немає записів", batchNormal: "🖨️ Друк вибраних", batchBrand: "🖨️ Друк вибраних з Brand", titleNew: "Друк новий формат 130x76мм", titleTwo: "Друк 2 копії", titleTwoBrand: "Друк 2 копії з Brand", toastSel: "🖍️ Виділено {n} — Ctrl+C щоб скопіювати", toastCopied: "✅ Скопійовано {n} значень", toastPn: "⏳ PN ще не знайдено в базі" },
    ru: { colSn: "Serial Number (SN)", colPn: "Part Number (PN)", colBrand: "Brand", colPrint: "Печать", loading: "Загрузка данных...", noRecords: "В таблице пока нет записей", batchNormal: "🖨️ Печать выбранных", batchBrand: "🖨️ Печать выбранных с Brand", titleNew: "Печать нового формата 130x76 мм", titleTwo: "Печать 2 копий", titleTwoBrand: "Печать 2 копий с Brand", toastSel: "🖍️ Выделено {n} — Ctrl+C, чтобы скопировать", toastCopied: "✅ Скопировано значений: {n}", toastPn: "⏳ PN ещё не найден в базе" },
    pl: { colSn: "Serial Number (SN)", colPn: "Part Number (PN)", colBrand: "Brand", colPrint: "Druk", loading: "Ładowanie danych...", noRecords: "W arkuszu nie ma jeszcze rekordów", batchNormal: "🖨️ Drukuj wybrane", batchBrand: "🖨️ Drukuj wybrane z Brand", titleNew: "Drukuj nowy format 130x76 mm", titleTwo: "Drukuj 2 kopie", titleTwoBrand: "Drukuj 2 kopie z Brand", toastSel: "🖍️ Zaznaczono {n} — Ctrl+C, aby skopiować", toastCopied: "✅ Skopiowano wartości: {n}", toastPn: "⏳ PN nie został jeszcze znaleziony w bazie" },
    de: { colSn: "Serial Number (SN)", colPn: "Part Number (PN)", colBrand: "Brand", colPrint: "Druck", loading: "Daten werden geladen...", noRecords: "Noch keine Einträge in der Tabelle", batchNormal: "🖨️ Ausgewählte drucken", batchBrand: "🖨️ Ausgewählte mit Brand drucken", titleNew: "Neues Format 130x76 mm drucken", titleTwo: "2 Kopien drucken", titleTwoBrand: "2 Kopien mit Brand drucken", toastSel: "🖍️ {n} ausgewählt — Strg+C zum Kopieren", toastCopied: "✅ {n} Werte kopiert", toastPn: "⏳ PN noch nicht in der Datenbank gefunden" },
    fr: { colSn: "Serial Number (SN)", colPn: "Part Number (PN)", colBrand: "Brand", colPrint: "Impression", loading: "Chargement des données...", noRecords: "Aucun enregistrement dans la feuille pour l'instant", batchNormal: "🖨️ Imprimer la sélection", batchBrand: "🖨️ Imprimer la sélection avec Brand", titleNew: "Imprimer le nouveau format 130x76 mm", titleTwo: "Imprimer 2 copies", titleTwoBrand: "Imprimer 2 copies avec Brand", toastSel: "🖍️ {n} sélectionnés — Ctrl+C pour copier", toastCopied: "✅ {n} valeurs copiées", toastPn: "⏳ PN pas encore trouvé dans la base" },
    es: { colSn: "Serial Number (SN)", colPn: "Part Number (PN)", colBrand: "Brand", colPrint: "Imprimir", loading: "Cargando datos...", noRecords: "Aún no hay registros en la hoja", batchNormal: "🖨️ Imprimir seleccionados", batchBrand: "🖨️ Imprimir seleccionados con Brand", titleNew: "Imprimir formato nuevo 130x76 mm", titleTwo: "Imprimir 2 copias", titleTwoBrand: "Imprimir 2 copias con Brand", toastSel: "🖍️ Seleccionados {n} — Ctrl+C para copiar", toastCopied: "✅ Copiados {n} valores", toastPn: "⏳ PN aún no encontrado en la base de datos" },
    it: { colSn: "Serial Number (SN)", colPn: "Part Number (PN)", colBrand: "Brand", colPrint: "Stampa", loading: "Caricamento dati...", noRecords: "Nessun record nel foglio per ora", batchNormal: "🖨️ Stampa selezionati", batchBrand: "🖨️ Stampa selezionati con Brand", titleNew: "Stampa nuovo formato 130x76 mm", titleTwo: "Stampa 2 copie", titleTwoBrand: "Stampa 2 copie con Brand", toastSel: "🖍️ Selezionati {n} — Ctrl+C per copiare", toastCopied: "✅ Copiati {n} valori", toastPn: "⏳ PN non ancora trovato nel database" },
    pt: { colSn: "Serial Number (SN)", colPn: "Part Number (PN)", colBrand: "Brand", colPrint: "Imprimir", loading: "Carregando dados...", noRecords: "Ainda não há registros na planilha", batchNormal: "🖨️ Imprimir selecionados", batchBrand: "🖨️ Imprimir selecionados com Brand", titleNew: "Imprimir novo formato 130x76 mm", titleTwo: "Imprimir 2 cópias", titleTwoBrand: "Imprimir 2 cópias com Brand", toastSel: "🖍️ Selecionados {n} — Ctrl+C para copiar", toastCopied: "✅ Copiados {n} valores", toastPn: "⏳ PN ainda não encontrado no banco de dados" },
    tr: { colSn: "Serial Number (SN)", colPn: "Part Number (PN)", colBrand: "Brand", colPrint: "Yazdır", loading: "Veriler yükleniyor...", noRecords: "Tabloda henüz kayıt yok", batchNormal: "🖨️ Seçilenleri yazdır", batchBrand: "🖨️ Seçilenleri Brand ile yazdır", titleNew: "Yeni format 130x76 mm yazdır", titleTwo: "2 kopya yazdır", titleTwoBrand: "Brand ile 2 kopya yazdır", toastSel: "🖍️ {n} seçildi — kopyalamak için Ctrl+C", toastCopied: "✅ {n} değer kopyalandı", toastPn: "⏳ PN veritabanında henüz bulunamadı" }
  };

  const t = createTranslator(I18N);

  const CSS = `
${PAGE} .f-wrap{max-width:1200px;margin:0 auto}
${PAGE} .f-bar{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;margin-bottom:14px}
${PAGE} .f-group{display:flex;gap:10px;align-items:center}
${PAGE} .f-mode{background:#111827;color:#9CA3AF;border:1px solid #374151;border-radius:8px;padding:8px 18px;cursor:pointer;font:600 13px "Segoe UI",Tahoma,Arial,sans-serif}
${PAGE} .f-mode.active{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border-color:transparent}
${PAGE} .btn:disabled{opacity:.4;cursor:not-allowed;filter:none}
${PAGE} .f-new{background:linear-gradient(135deg,#7c3aed,#6d28d9)}
${PAGE} .f-card{background:#0e0e0e;border:1px solid #1f2937;border-radius:10px;overflow:auto;box-shadow:0 10px 25px -5px rgba(0,0,0,.5)}
${PAGE} table{width:100%;border-collapse:collapse}
${PAGE} th,${PAGE} td{padding:10px 12px;text-align:center;border-bottom:1px solid #1f2937;color:#E5E7EB;font-size:14px;white-space:nowrap}
${PAGE} th{background:#111827;color:#9CA3AF;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em}
${PAGE} td[data-col="sn"],${PAGE} td[data-col="pn"]{font-family:Consolas,'Courier New',monospace;font-weight:600}
${PAGE} td[data-col="sn"]{cursor:copy}
${PAGE} td.f-sel{background:rgba(37,99,235,.35)!important}
${PAGE} .f-brand{background:#374151;padding:3px 8px;border-radius:4px;font-size:12px;font-weight:600}
${PAGE} .f-acts{display:flex;gap:8px;justify-content:flex-end;align-items:center}
${PAGE} .f-msg{color:#9CA3AF}
${PAGE} .f-spin{display:inline-block;width:12px;height:12px;border:2px solid #374151;border-top-color:#2563EB;border-radius:50%;animation:fSpin .8s linear infinite}
@keyframes fSpin{to{transform:rotate(360deg)}}
.f-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#111827;color:#F9FAFB;border:1px solid #374151;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;z-index:9999;opacity:0;pointer-events:none;transition:opacity .2s}
.f-toast.show{opacity:1}
`;

  const MARKUP = `
<div class="f-wrap">
  <div class="f-bar">
    <div class="f-group">
      <button type="button" class="f-mode active" data-mode="1">100×78</button>
      <button type="button" class="f-mode" data-mode="2">130×76</button>
    </div>
    <div class="f-group">
      <button type="button" class="btn btn-secondary" id="${P}BatchNorm" data-lv="batchNormal" disabled></button>
      <button type="button" class="btn btn-brand" id="${P}BatchBrand" data-lv="batchBrand" disabled></button>
    </div>
  </div>
  <div class="f-card">
    <table>
      <thead><tr>
        <th style="width:40px"><input type="checkbox" id="${P}All"></th>
        <th>#</th>
        <th data-lv="colSn"></th>
        <th data-lv="colPn"></th>
        <th data-lv="colBrand"></th>
        <th style="text-align:right" data-lv="colPrint"></th>
      </tr></thead>
      <tbody id="${P}Body"></tbody>
    </table>
  </div>
</div>`;

  const $ = (id) => document.getElementById(id);
  let mode = '1';
  let products = [];
  let selected = new Set();
  let dbCache = new Map();
  let loaded = false;
  let loading = false;
  let inited = false;
  let pollTimer = null;
  let colSel = { active: false, col: null, start: -1, cells: [] };

  function isVisible() {
    const el = $(CFG.pageId);
    return !!el && el.style.display !== 'none';
  }

  function applyText() {
    document.querySelectorAll(`${PAGE} [data-lv]`).forEach(el => { el.textContent = t(el.dataset.lv); });
  }

  function toast(msg) {
    let el = $(`${P}Toast`);
    if (!el) {
      el = document.createElement('div');
      el.id = `${P}Toast`;
      el.className = 'f-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 1800);
  }

  /* ---------- Данные: таблица Google (CSV) и PN из базы ---------- */

  // offline = true: связи нет, для TBV и TOV базу не спрашиваем
  async function getPn(sn, offline) {
    const now = Date.now();
    const c = dbCache.get(sn);
    if (c && (c.ok || now - c.t < RETRY_MS)) return c.data;

    if (offline || navigator.onLine === false) {
      const lp = fromBase(sn) || localPn(sn);
      if (lp) return lp;
    }

    try {
      const lookup = sb().from(TV.TABLE).select(`${TV.PN}, ${TV.BRAND}`).eq(TV.SN, sn).limit(1);
      const { data, error } = await Promise.race([
        lookup,
        new Promise((_, rej) => setTimeout(() => rej(new Error('network timeout')), 8000))
      ]);
      if (!error && data && data.length) {
        const d = { pn: data[0][TV.PN] || 'N/A', brand: data[0][TV.BRAND] || '-' };
        pnbRemember(sn, d.pn, d.brand);
        dbCache.set(sn, { ok: true, data: d, t: now });
        return d;
      }
      if (!error) {
        const fb = localPn(sn);
        if (fb) { dbCache.set(sn, { ok: true, data: fb, t: now }); return fb; }
      } else {
        // ошибка связи: PN из базы на устройстве, для TBV и TOV ещё и по номеру (в кэш не кладём, чтобы потом взять настоящий из базы)
        const fb = fromBase(sn) || localPn(sn);
        if (fb) return fb;
      }
    } catch (e) {
      const fb = fromBase(sn) || localPn(sn);
      if (fb) return fb;
    }

    const nf = { pn: null, brand: '-' };
    dbCache.set(sn, { ok: false, data: nf, t: now });
    return nf;
  }

  // Загрузка идёт независимо от того, открыта ли страница
  async function loadProducts() {
    if (loading) return;
    loading = true;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      // Основной адрес и запасной: если один не отвечает, пробуем другой
      // Основной адрес качает только колонку C (серийники), запасной: всю таблицу
      const urls = [
        `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${CFG.gid}&range=C:C&_nc=${Date.now()}`,
        `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${CFG.gid}&_nc=${Date.now()}`,
        `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${CFG.gid}&_nc=${Date.now()}`
      ];
      let res = null;
      for (const url of urls) {
        try {
          const r = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
          if (r.ok) { res = r; break; }
        } catch (e) {}
      }
      if (!res) throw new Error('sheet');
      const rows = parseCSV(await res.text());
      // В коротком ответе одна колонка (серийники), в полном серийник стоит третьим
      const col = rows[0] && rows[0].length === 1 ? 0 : 2;

      const sns = [];
      for (let i = 1; i < rows.length; i++) {
        const sn = rows[i] && rows[i][col] ? rows[i][col].trim() : '';
        if (sn && sn.toUpperCase() !== 'SERIAL NUMBER') sns.push(sn);
      }
      const last = sns.slice(-MAX_ROWS).reverse();
      const keep = new Set(last);
      for (const k of dbCache.keys()) if (!keep.has(k)) dbCache.delete(k);

      const items = [];
      for (const sn of last) {
        const d = await getPn(sn);
        items.push({ sn, pn: d.pn, brand: d.brand });
      }

      products = items;
      // Убираем из выбора строки, которых уже нет в таблице
      const present = new Set(products.map(p => p.sn));
      for (const sn of [...selected]) if (!present.has(sn)) selected.delete(sn);
      flushRender();
    } catch (e) {
      console.warn(`${P}: данные временно недоступны`);
    } finally {
      clearTimeout(timer);
      loaded = true;
      loading = false;
    }
  }

  // Не перерисовываем таблицу, пока пользователь выделяет текст или колонку
  function hasTableSelection() {
    if (colSel.cells.length) return true;
    const s = window.getSelection();
    if (!s || s.rangeCount === 0 || s.isCollapsed) return false;
    const body = $(`${P}Body`);
    return !!body && body.contains(s.getRangeAt(0).commonAncestorContainer);
  }

  // Перерисовка таблицы. Пока пользователь выделяет текст, DOM не трогаем,
  // следующее фоновое обновление перерисует таблицу
  function flushRender() {
    if (hasTableSelection()) return;
    render();
  }

  /* ---------- Таблица ---------- */

  function render() {
    const body = $(`${P}Body`);
    if (!products.length) {
      body.innerHTML = `<tr><td colspan="6" class="f-msg">${esc(t(loaded ? 'noRecords' : 'loading'))}</td></tr>`;
    } else {
      body.innerHTML = products.map((p, i) => `
        <tr>
          <td><input type="checkbox" class="f-row" data-sn="${esc(p.sn)}" ${selected.has(p.sn) ? 'checked' : ''}></td>
          <td><strong>${i + 1}</strong></td>
          <td data-col="sn">${esc(p.sn)}</td>
          <td data-col="pn">${p.pn ? esc(p.pn) : '<span class="f-spin"></span>'}</td>
          <td data-col="brand"><span class="f-brand">${esc(p.brand)}</span></td>
          <td><div class="f-acts">
            <button type="button" class="btn f-new" data-act="new" data-i="${i}" title="${esc(t('titleNew'))}">🆕</button>
            <button type="button" class="btn" data-act="two" data-i="${i}" title="${esc(t('titleTwo'))}">🖨️</button>
            <button type="button" class="btn btn-brand" data-act="brand" data-i="${i}" title="${esc(t('titleTwoBrand'))}">🖨️ Brand</button>
          </div></td>
        </tr>`).join('');
    }
    updateBar();
  }

  function updateBar() {
    const none = selected.size === 0;
    $(`${P}BatchNorm`).disabled = none;
    $(`${P}BatchBrand`).disabled = none;
    $(`${P}All`).checked = products.length > 0 && products.every(p => selected.has(p.sn));
    document.querySelectorAll(`${PAGE} .f-mode`).forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  }

  function setMode(m) {
    mode = m === '2' ? '2' : '1';
    try { localStorage.setItem(CFG.modeKey, mode); } catch (e) {}
    updateBar();
  }

  /* ---------- Выделение колонки (Ctrl + перетягивание) ---------- */

  function rowIdx(td) {
    return Array.from($(`${P}Body`).rows).indexOf(td.parentElement);
  }

  function highlightCol(a, b) {
    const lo = Math.min(a, b), hi = Math.max(a, b);
    document.querySelectorAll(`${PAGE} td.f-sel`).forEach(td => td.classList.remove('f-sel'));
    colSel.cells = [];
    Array.from($(`${P}Body`).rows).forEach((tr, i) => {
      if (i < lo || i > hi) return;
      const td = tr.querySelector(`td[data-col="${colSel.col}"]`);
      if (td) { td.classList.add('f-sel'); colSel.cells.push(td); }
    });
  }

  function clearColSel() {
    document.querySelectorAll(`${PAGE} td.f-sel`).forEach(td => td.classList.remove('f-sel'));
    colSel = { active: false, col: null, start: -1, cells: [] };
  }

  /* ---------- Печать ---------- */

  function printStd(list, inc) { printList(list, inc, '1', PRINT_OPTS); }
  function printNew(list, inc) { printList(list, inc, '2', PRINT_OPTS); }

  // Пакетная печать и Shift+P: формат зависит от выбранной кнопки 100×78 / 130×76
  function printCurrent(list, inc) {
    printList(list, inc, mode, PRINT_OPTS);
  }

  function printBatch(inc) {
    const list = products.filter(p => selected.has(p.sn));
    if (!list.length) return;
    printCurrent(list, inc);
    selected.clear();
    render();
  }

  // Печать по SN для журнала ремонта (вызывается из repairlog.js при статусе OK).
  // Формат берётся из переключателя этой вкладки: 100×78 или 130×76.
  // Возвращает false, если PN по SN не найден в базе.
  const printBySn = async function (sn, offline) {
    const clean = String(sn || '').trim().toUpperCase();
    if (!clean) return false;
    const d = await getPn(clean, offline);
    if (!d.pn) return false;

    let m = mode;
    try { m = localStorage.getItem(CFG.modeKey) === '2' ? '2' : '1'; } catch (e) {}

    const item = { sn: clean, pn: d.pn, brand: d.brand };
    if (m === '2') printNew([item], false);
    else printStd([item], false);
    return true;
  };

  // Горячие клавиши принимает общий обработчик внизу файла: он решает, какая станция сейчас активна.
  function hotPrint(withBrand) {
    if (!products.length) return;
    if (!selected.size && !products[0].pn) { toast(t('toastPn')); return; }
    if (selected.size) printBatch(withBrand);
    else printCurrent([products[0]], withBrand);
  }

  // Ctrl+C: копирование выделенной колонки
  function copyColumn() {
    if (!colSel.cells.length) return;
    const text = colSel.cells.map(td => td.textContent.trim()).join('\n');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => toast(t('toastCopied', { n: colSel.cells.length })));
    }
  }

  /* ---------- События ---------- */

  function bindEvents() {
    const body = $(`${P}Body`);

    body.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      const p = products[+b.dataset.i];
      if (!p) return;
      if (b.dataset.act === 'new') printNew([p], false);
      else if (b.dataset.act === 'two') printStd([p], false);
      else printStd([p], true);
    });

    // Двойной клик по серийному номеру: копирование в буфер обмена, без уведомления
    body.addEventListener('dblclick', (e) => {
      const td = e.target.closest('td[data-col="sn"]');
      if (!td) return;
      const sn = td.textContent.trim();
      if (!sn) return;
      copyText(sn);
    });

    body.addEventListener('change', (e) => {
      if (!e.target.classList.contains('f-row')) return;
      const sn = e.target.dataset.sn;
      if (e.target.checked) selected.add(sn);
      else selected.delete(sn);
      updateBar();
    });

    body.addEventListener('mousedown', (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const td = e.target.closest('td[data-col]');
      if (!td) return;
      e.preventDefault();
      clearColSel();
      colSel.active = true;
      colSel.col = td.dataset.col;
      colSel.start = rowIdx(td);
      highlightCol(colSel.start, colSel.start);
    });

    document.addEventListener('mousemove', (e) => {
      if (!colSel.active) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const td = el && el.closest(`td[data-col="${colSel.col}"]`);
      if (td) highlightCol(colSel.start, rowIdx(td));
    });

    document.addEventListener('mouseup', () => {
      if (!colSel.active) return;
      colSel.active = false;
      if (colSel.cells.length) toast(t('toastSel', { n: colSel.cells.length }));
    });

    document.addEventListener('mousedown', (e) => {
      if (!(e.ctrlKey || e.metaKey)) clearColSel();
    });

    $(`${P}All`).addEventListener('change', (e) => {
      products.forEach(p => {
        if (e.target.checked) selected.add(p.sn);
        else selected.delete(p.sn);
      });
      render();
    });

    $(`${P}BatchNorm`).addEventListener('click', () => printBatch(false));
    $(`${P}BatchBrand`).addEventListener('click', () => printBatch(true));

    document.querySelectorAll(`${PAGE} .f-mode`).forEach(b => {
      b.addEventListener('click', () => setMode(b.dataset.mode));
    });
  }

  /* ---------- Инициализация и вызовы из сайта ---------- */

  // Фоновое обновление: работает постоянно, а не только на открытой странице
  function startBackgroundRefresh() {
    if (pollTimer) return;
    pollTimer = setInterval(() => { if (!document.hidden) loadProducts(); }, REFRESH_MS);
  }

  function init() {
    ensureHotkeys();

    const root = $(CFG.pageId);
    if (!root) return;

    try { mode = localStorage.getItem(CFG.modeKey) === '2' ? '2' : '1'; } catch (e) {}

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    root.innerHTML = MARKUP;
    bindEvents();
    applyText();
    render();
    inited = true;

    // Язык задаёт сайт (i18n.js)
    onLangChange(() => { applyText(); render(); });

    startBackgroundRefresh();
    loadProducts();
  }

  // Вызывается сайтом (app.js) при открытии страницы: показываем свежие данные сразу
  function show() {
    if (!inited) return;
    loadProducts();
    startBackgroundRefresh();
  }

  return { init, show, isVisible, hotPrint, copyColumn, printBySn };
}

// ===== Запуск обеих станций =====
// Создание станций ничего не делает с DOM: всё начинается в init()
const station1 = createStation(CONFIGS.final1);
const station2 = createStation(CONFIGS.final2);

export const final1 = { init: station1.init, show: station1.show };
export const final2 = { init: station2.init, show: station2.show };

// Для журнала ремонта: печатает станция II, даже если открыта другая страница
export async function printFinal2BySn(sn, offline) {
  return station2.printBySn(sn, offline);
}

// ===== Горячие клавиши (один обработчик на обе станции) =====
let hotkeysBound = false;

function ensureHotkeys() {
  if (hotkeysBound) return;
  hotkeysBound = true;

  document.addEventListener('keydown', (e) => {
    // Клавиши определяем по физической позиции (e.code), а не по букве:
    // при украинской или русской раскладке e.key для P даёт другой символ
    const isP = e.code === 'KeyP' || (e.key && e.key.toLowerCase() === 'p');
    const isC = e.code === 'KeyC';

    const onFinal1 = station1.isVisible();
    const onFinal2 = station2.isVisible();
    // Открыта Final I: печатает она. На любой другой странице (в том числе Final II и Repair Log) печатает Final II
    const target = onFinal1 ? station1 : station2;

    // Shift+P: печать без бренда. В полях ввода не срабатывает, чтобы можно было печатать заглавные буквы
    if (e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && isP && !isTyping(e.target)) {
      e.preventDefault();
      if (e.repeat) return;
      target.hotPrint(false);
      return;
    }

    // Alt+P: печать с брендом
    if (e.altKey && !e.ctrlKey && !e.metaKey && isP) {
      e.preventDefault();
      if (e.repeat) return;
      target.hotPrint(true);
      return;
    }

    // Ctrl+P: печать без бренда. Стандартное окно печати браузера не открывается
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && isP) {
      e.preventDefault();
      if (e.repeat) return;
      target.hotPrint(false);
      return;
    }

    // Ctrl+C: копирование выделенной колонки, только на открытой странице Final I или Final II
    if ((e.ctrlKey || e.metaKey) && !e.altKey && isC) {
      if (onFinal1) station1.copyColumn();
      else if (onFinal2) station2.copyColumn();
    }
  });
}
