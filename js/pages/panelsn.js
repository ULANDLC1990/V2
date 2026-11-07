/* ==========================================================
   LCDR HUB — Panel SN Filter
   Загружает Excel/CSV, фильтрует строки, убирает дубликаты по Panel SN
   и отдаёт CSV (panel_sn, tpv_pn, brand) для импорта в Supabase.
   Контейнер: #panelsnPage (создан в index.html). Язык: en / uk / ru / pl.
   Библиотека XLSX подключается в index.html обычным <script> (window.XLSX).
   ========================================================== */
import { createTranslator, onLangChange } from '../i18n.js';

/* ---------- Тексты ---------- */
const TXT = {
  en: { downloadDropped: "Download dropped", droppedPrefix: "Not in the list", expandAll: "Expand all", collapseAll: "Collapse all", copied: "SQL script copied to clipboard — paste it in the Supabase SQL Editor", copyFail: "Could not copy the SQL script automatically", download: "Download CSV (for Supabase)", dropTitle: "Click or drop a file here", dropSub: ".xlsx, .xls, .csv — columns: Panel SN, TPV PN, Brand, Process", empty: "Upload a file to see the result", none: "No rows left after filtering", inFile: "In file", afterFilters: "After filters", dupes: "Duplicates removed", marked: "Marked as unneeded", ready: "To export", markTitle: "Mark as unneeded", readError: "Could not read the file" },
  uk: { downloadDropped: "Завантажити відсіяні", droppedPrefix: "Не зі списку", expandAll: "Розгорнути все", collapseAll: "Згорнути все", copied: "SQL-скрипт скопійовано в буфер — вставте його в Supabase SQL Editor", copyFail: "Не вдалося автоматично скопіювати SQL-скрипт", download: "Завантажити CSV (для Supabase)", dropTitle: "Натисніть або перетягніть файл", dropSub: ".xlsx, .xls, .csv — колонки: Panel SN, TPV PN, Brand, Process", empty: "Завантажте файл, щоб побачити результат", none: "Після фільтрації рядків не залишилось", inFile: "У файлі", afterFilters: "Після фільтрів", dupes: "Дублікатів прибрано", marked: "Позначено непотрібними", ready: "До вивантаження", markTitle: "Позначити як непотрібне", readError: "Не вдалося прочитати файл" },
  ru: { downloadDropped: "Скачать отсеянные", droppedPrefix: "Не из списка", expandAll: "Раскрыть все", collapseAll: "Свернуть все", copied: "SQL-скрипт скопирован в буфер — вставьте его в Supabase SQL Editor", copyFail: "Не удалось автоматически скопировать SQL-скрипт", download: "Скачать CSV (для Supabase)", dropTitle: "Нажмите или перетащите файл", dropSub: ".xlsx, .xls, .csv — колонки: Panel SN, TPV PN, Brand, Process", empty: "Загрузите файл, чтобы увидеть результат", none: "После фильтрации строк не осталось", inFile: "В файле", afterFilters: "После фильтров", dupes: "Дубликатов убрано", marked: "Отмечено ненужным", ready: "К выгрузке", markTitle: "Отметить как ненужное", readError: "Не удалось прочитать файл" },
  pl: { downloadDropped: "Pobierz odrzucone", droppedPrefix: "Spoza listy", expandAll: "Rozwiń wszystko", collapseAll: "Zwiń wszystko", copied: "Skrypt SQL skopiowany do schowka — wklej go w Supabase SQL Editor", copyFail: "Nie udało się automatycznie skopiować skryptu SQL", download: "Pobierz CSV (dla Supabase)", dropTitle: "Kliknij lub upuść plik", dropSub: ".xlsx, .xls, .csv — kolumny: Panel SN, TPV PN, Brand, Process", empty: "Wgraj plik, aby zobaczyć wynik", none: "Po filtrowaniu nie zostały żadne wiersze", inFile: "W pliku", afterFilters: "Po filtrach", dupes: "Usunięto duplikatów", marked: "Oznaczono jako zbędne", ready: "Do eksportu", markTitle: "Oznacz jako zbędne", readError: "Nie udało się odczytać pliku" }
};
const tx = createTranslator(TXT);

const INVALID_TPV = ["750TBV", "730TOV", "730TOG", "730TBV", "750GOV", "750TOG", "750JBG"];

// Группировка: строки с одинаковыми первыми символами Panel SN сворачиваются в один список
const GROUP_LEN = 3;

// В файл «отсеянные» не попадают номера, начинающиеся на эти буквы (Panel SN или TPV PN)
const DROPPED_SKIP = ["TOV", "TBV"];
const isSkipped = (v) => {
  const t = String(v).trim().toUpperCase();
  return DROPPED_SKIP.some((p) => t.startsWith(p) || new RegExp("^\\d{3}" + p).test(t));
};

// Разрешённые префиксы Panel SN. Остальные строки отсеиваются.
// Обычный префикс — 3 первых символа (WW1). Более длинный (236W) тоже работает:
// такие номера собираются в отдельную группу. Нужен новый префикс — допишите его в список.
const ALLOWED_PREFIXES = new Set([
  "3C0", "3H0", "3M0", "3P0", "3Q0", "3U0",
  "CLC", "CLJ", "CMA", "CMS", "CRJ", "CRP", "CRZ", "CTH", "CUK",
  "GBV", "GOV", "JBV", "SQ1",
  "WC0", "WC7", "WC8", "WH0", "WH8", "WM0", "WM5", "WM6", "WP0", "WP5", "WQ0", "WU0", "WW1",
  "236W", "238C", "238L"
]);
const LONG_PREFIXES = [...ALLOWED_PREFIXES].filter((p) => p.length > GROUP_LEN);
const prefixOf = (sn) => LONG_PREFIXES.find((p) => sn.startsWith(p)) || sn.slice(0, GROUP_LEN);
const groupKey = (r) => prefixOf(String(r.panel_sn).trim().toUpperCase());

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// SQL для Supabase (копируется в буфер вместе со скачиванием CSV)
const SQL_SCRIPT = `BEGIN;
INSERT INTO televisions (panel_sn, tpv_pn, brand)
SELECT DISTINCT ON (panel_sn) panel_sn, tpv_pn, brand
FROM televisions_temp
ON CONFLICT (panel_sn)
DO UPDATE SET 
    tpv_pn = EXCLUDED.tpv_pn,
    brand = EXCLUDED.brand;
TRUNCATE TABLE televisions_temp;
COMMIT;`;

// Строгая версия копирования: при отказе браузера сообщает об ошибке (нужно для подсказки «не удалось скопировать»)
function copyStrict(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  // запасной способ, если буфер недоступен
  return new Promise((resolve, reject) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    ok ? resolve() : reject(new Error("copy failed"));
  });
}

// Экспорт CSV
function saveCsv(rows, filename) {
  const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
  const csv = "panel_sn,tpv_pn,brand\n" +
    rows.map((r) => q(r.panel_sn) + "," + q(r.tpv_pn) + "," + q(r.brand)).join("\n") + "\n";
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function find(row, keys) {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return "";
}

function dedupe(list) {
  const hasBrand = (r) => { const b = (r.brand || "").trim(); return b !== "" && b !== "-"; };
  const map = new Map();
  list.forEach((r) => {
    const key = String(r.panel_sn).trim().toUpperCase();
    if (!key) return;
    if (!map.has(key)) map.set(key, r);
    else if (!hasBrand(map.get(key)) && hasBrand(r)) map.set(key, r);
  });
  return map;
}

export function init() {
  const root = document.getElementById("panelsnPage");
  if (!root) return;

  /* ---------- Разметка ---------- */
  root.innerHTML = `
    <div class="rl-wrap">
      <input type="file" id="psFile" accept=".xlsx,.xls,.csv" hidden>
      <div id="psDrop" class="ps-drop">
        <div class="ps-drop-icon">⬆</div>
        <div class="ps-drop-title" data-ps="dropTitle"></div>
        <div class="ps-drop-sub" data-ps="dropSub"></div>
      </div>
      <div id="psStatus" class="ps-status"></div>
      <div class="ps-bar">
        <button id="psDownload" class="rl-add" data-ps="download" disabled></button>
        <button id="psDownloadDropped" class="rl-add" disabled></button>
        <button id="psExpand" class="rl-code" data-ps="expandAll"></button>
        <button id="psCollapse" class="rl-code" data-ps="collapseAll"></button>
        <span id="psNote" class="ps-note"></span>
      </div>
    </div>
    <div class="rl-wrap">
      <div class="rl-table-wrap ps-table-wrap">
        <table class="rl-table">
          <thead>
            <tr>
              <th class="col-check">✕</th>
              <th class="ps-sort" id="psSortHead">panel_sn <span id="psSortIcon">⇅</span></th>
              <th>tpv_pn</th>
              <th>brand</th>
            </tr>
          </thead>
          <tbody id="psBody"></tbody>
        </table>
      </div>
    </div>`;

  const drop = root.querySelector("#psDrop");
  const fileInput = root.querySelector("#psFile");
  const body = root.querySelector("#psBody");
  const statusEl = root.querySelector("#psStatus");
  const dlBtn = root.querySelector("#psDownload");
  const noteEl = root.querySelector("#psNote");
  const dlDroppedBtn = root.querySelector("#psDownloadDropped");

  let data = [];
  let sortAsc = null;
  let stats = { total: 0, filtered: 0, dupes: 0, dropped: 0, droppedList: [] };
  let errorMsg = "";
  let openGroups = new Set();
  let droppedData = [];   // строки, отсеянные по префиксу (для отдельного CSV)

  /* ---------- Загрузка файла ---------- */
  drop.addEventListener("click", () => fileInput.click());
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("dragover"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("dragover"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("dragover");
    if (e.dataTransfer.files.length) readFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length) readFile(e.target.files[0]);
    fileInput.value = "";
  });

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = window.XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        errorMsg = "";
        applyFilters(window.XLSX.utils.sheet_to_json(ws, { defval: "" }));
      } catch (err) {
        errorMsg = tx("readError") + ": " + err.message;
        render();
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /* ---------- Фильтры ---------- */
  function applyFilters(rows) {
    const kept = [];
    const droppedMap = new Map();
    const droppedRaw = [];
    rows.forEach((row) => {
      const proc  = String(find(row, ["Process", "process"])).trim().toUpperCase();
      const tpv   = String(find(row, ["TPV PN", "TPV_PN", "tpv_pn", "TPVPN"])).trim().toUpperCase();
      const sn    = String(find(row, ["Panel SN", "PANEL_SN", "panel_sn", "PanelSN"])).trim().toUpperCase();
      const brand = String(find(row, ["Brand", "brand", "BRAND"])).trim();

      if (proc.includes("OCR")) return;
      if (INVALID_TPV.some((p) => tpv.startsWith(p))) return;
      if (sn.startsWith("LCM")) return;

      const prefix = prefixOf(sn);
      if (sn && !ALLOWED_PREFIXES.has(prefix)) {
        if (isSkipped(sn) || isSkipped(tpv)) return;   // TOV / TBV — совсем выбрасываем
        droppedMap.set(prefix, (droppedMap.get(prefix) || 0) + 1);
        droppedRaw.push({
          panel_sn: find(row, ["Panel SN", "PANEL_SN", "panel_sn", "PanelSN"]),
          tpv_pn: find(row, ["TPV PN", "TPV_PN", "tpv_pn", "TPVPN"]),
          brand
        });
        return;
      }

      kept.push({
        panel_sn: find(row, ["Panel SN", "PANEL_SN", "panel_sn", "PanelSN"]),
        tpv_pn: find(row, ["TPV PN", "TPV_PN", "tpv_pn", "TPVPN"]),
        brand
      });
    });

    // Дубликаты по panel_sn: остаётся строка с заполненным brand
    const map = dedupe(kept);
    droppedData = [...dedupe(droppedRaw).values()];

    data = [];
    let id = 0;
    map.forEach((r) => data.push({ id: id++, panel_sn: r.panel_sn, tpv_pn: r.tpv_pn, brand: r.brand, excluded: false }));

    const droppedList = [...droppedMap.entries()].sort((a, b) => b[1] - a[1]);
    stats = {
      total: rows.length,
      filtered: kept.length,
      dupes: kept.length - data.length,
      dropped: droppedList.reduce((n, d) => n + d[1], 0),
      droppedList
    };
    openGroups = new Set();
    sortAsc = true;
    sortData();
    render();
  }

  /* ---------- Сортировка и исключение строк ---------- */
  function sortData() {
    if (sortAsc === null) return;
    data.sort((a, b) => {
      const x = String(a.panel_sn).toLowerCase();
      const y = String(b.panel_sn).toLowerCase();
      if (x < y) return sortAsc ? -1 : 1;
      if (x > y) return sortAsc ? 1 : -1;
      return 0;
    });
  }

  root.querySelector("#psSortHead").addEventListener("click", () => {
    if (!data.length) return;
    sortAsc = sortAsc !== true;
    sortData();
    render();
  });

  body.addEventListener("change", (e) => {
    const t = e.target;
    if (t.classList.contains("ps-check")) {
      const id = Number(t.getAttribute("data-id"));
      const item = data.find((r) => r.id === id);
      if (item) { item.excluded = t.checked; render(); }
    } else if (t.classList.contains("ps-gcheck")) {
      // галочка на группе отмечает/снимает все строки группы
      const key = t.getAttribute("data-g");
      data.forEach((r) => { if (groupKey(r) === key) r.excluded = t.checked; });
      render();
    }
  });

  // клик по строке группы раскрывает/сворачивает её
  body.addEventListener("click", (e) => {
    if (e.target.classList.contains("ps-gcheck")) return;
    const tr = e.target.closest("tr.ps-group");
    if (!tr) return;
    const key = tr.getAttribute("data-g");
    if (openGroups.has(key)) openGroups.delete(key); else openGroups.add(key);
    render();
  });

  root.querySelector("#psExpand").addEventListener("click", () => {
    openGroups = new Set(data.map(groupKey));
    render();
  });
  root.querySelector("#psCollapse").addEventListener("click", () => {
    openGroups = new Set();
    render();
  });

  /* ---------- Отрисовка ---------- */
  function applyText() {
    root.querySelectorAll("[data-ps]").forEach((el) => { el.textContent = tx(el.dataset.ps); });
  }

  // Сколько строк отсеяно по префиксу
  function droppedHtml() {
    return stats.dropped ? `<span>${tx("droppedPrefix")}: <b>${stats.dropped}</b></span>` : "";
  }

  function render() {
    dlDroppedBtn.textContent = tx("downloadDropped") + (droppedData.length ? " (" + droppedData.length + ")" : "");
    dlDroppedBtn.disabled = droppedData.length === 0;
    root.querySelector("#psSortIcon").textContent = sortAsc === true ? "▲" : sortAsc === false ? "▼" : "⇅";

    if (errorMsg) {
      statusEl.innerHTML = `<span>${esc(errorMsg)}</span>`;
      return;
    }

    if (!data.length) {
      const msg = stats.total ? tx("none") : tx("empty");
      body.innerHTML = `<tr><td colspan="4" class="rl-empty">${msg}</td></tr>`;
      dlBtn.disabled = true;
      statusEl.innerHTML = droppedHtml();
      return;
    }

    const excluded = data.filter((r) => r.excluded).length;
    const ready = data.length - excluded;
    dlBtn.disabled = ready === 0;
    statusEl.innerHTML =
      `<span>${tx("inFile")}: <b>${stats.total}</b></span>` +
      `<span>${tx("afterFilters")}: <b>${stats.filtered}</b></span>` +
      `<span>${tx("dupes")}: <b>${stats.dupes}</b></span>` +
      droppedHtml() +
      `<span>${tx("marked")}: <b>${excluded}</b></span>` +
      `<span>${tx("ready")}: <b>${ready}</b></span>`;

    // группы в порядке сортировки (строки уже отсортированы, группы идут подряд)
    const groups = new Map();
    data.forEach((r) => {
      const key = groupKey(r);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    });

    const summary = (vals, unit) => {
      const u = [...new Set(vals.map((v) => String(v).trim()).filter(Boolean))];
      if (u.length === 0) return "";
      return u.length === 1 ? esc(u[0]) : `<span class="ps-multi">${u.length} ${unit}</span>`;
    };

    let html = "";
    groups.forEach((rows, key) => {
      const isOpen = openGroups.has(key);
      const allEx = rows.every((r) => r.excluded);
      html += `
      <tr class="ps-group ${allEx ? "ps-excluded" : ""}" data-g="${esc(key)}">
        <td class="col-check"><input type="checkbox" class="ps-gcheck" data-g="${esc(key)}" ${allEx ? "checked" : ""} title="${tx("markTitle")}"></td>
        <td class="rl-sn"><span class="ps-arrow">${isOpen ? "▼" : "▶"}</span> ${esc(key)} <span class="ps-count">${rows.length}</span></td>
        <td>${summary(rows.map((r) => r.tpv_pn), "PN")}</td>
        <td>${summary(rows.map((r) => r.brand), "brand")}</td>
      </tr>`;
      if (isOpen) {
        rows.forEach((r) => {
          html += `
      <tr class="ps-child ${r.excluded ? "ps-excluded" : ""}">
        <td class="col-check"><input type="checkbox" class="ps-check" data-id="${r.id}" ${r.excluded ? "checked" : ""} title="${tx("markTitle")}"></td>
        <td class="rl-sn">${esc(r.panel_sn)}</td>
        <td>${esc(r.tpv_pn)}</td>
        <td>${esc(r.brand)}</td>
      </tr>`;
        });
      }
    });
    body.innerHTML = html;

    // частично отмеченная группа показывается неполной галочкой
    body.querySelectorAll(".ps-gcheck").forEach((cb) => {
      const rows = groups.get(cb.getAttribute("data-g")) || [];
      const some = rows.some((r) => r.excluded);
      cb.indeterminate = some && !rows.every((r) => r.excluded);
    });
  }

  dlBtn.addEventListener("click", () => {
    const out = data.filter((r) => !r.excluded);
    if (!out.length) return;
    saveCsv(out, "supabase_panel_sn_export.csv");

    copyStrict(SQL_SCRIPT)
      .then(() => { noteEl.textContent = tx("copied"); noteEl.classList.remove("ps-note-err"); })
      .catch(() => { noteEl.textContent = tx("copyFail"); noteEl.classList.add("ps-note-err"); });
  });

  // Отсеянные по префиксу строки: без номеров на TOV / TBV, SQL в буфер не копируется
  dlDroppedBtn.addEventListener("click", () => {
    if (!droppedData.length) return;
    droppedData.sort((a, b) => String(a.panel_sn).localeCompare(String(b.panel_sn)));
    saveCsv(droppedData, "panel_sn_dropped.csv");
  });

  // Смена языка сайта
  onLangChange(() => {
    noteEl.textContent = "";
    applyText();
    render();
  });

  applyText();
  render();
}
