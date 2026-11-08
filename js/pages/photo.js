/* Вкладка «Photo»: нажимаешь фамилию работника, сканируешь серийный номер ТВ и делаешь фото.
   Файл сохраняется в Supabase Storage (бакет photos) как ФАМИЛИЯ__серийный.jpg,
   а в списке и при скачивании показывается как серийный.jpg (например tpfdg341234.jpg).
   Фото хранится, пока его не удалят кнопкой «Удалить» (или «Удалить все»).
   Контейнер: <section id="photoPage">. Работает по HTTPS или на localhost.
   Для удаления в Supabase нужна политика на storage.objects (см. инструкцию).
   Тексты вкладки: uk / pl / en (словарь DICT). Камера запускается в show() и гасится в hide(). */
import { createIsolatedClient } from '../core/supabase.js';
import { rows as sheetRows } from '../core/sheets.js';
import { esc } from '../core/util.js';
import { createTranslator, onLangChange } from '../i18n.js';

// Тексты страницы (uk / pl / en)
const DICT = {
  uk: {
    title: 'Фото', snap: '📷 Зробити фото і зберегти', listTitle: 'Фото (зберігаються, поки не видалиш)',
    refresh: 'Оновити список', delAll: 'Видалити всі', colWorker: 'Працівник', colFile: 'Файл', colShot: 'Знято', colDl: 'Завантажено',
    dl: '⬇ Завантажити', del: '🗑 Видалити', empty: 'Зараз немає фото', dlTitle: 'Завантажено: {d}', camN: 'Камера {n}',
    ariaPhotos: 'Фото', ariaClose: 'Закрити',
    autoOk: 'SN з Repair Log: ', autoNone: 'У Repair Log ще немає записів: фото зберегти не можна.', autoErr: 'Не вдалося отримати номер із Repair Log.',
    noCamSupport: 'Браузер не підтримує камеру. Потрібен HTTPS або localhost.', connecting: 'Підключення камери...',
    camUnavail: 'Камера недоступна: {e}', notReady: 'Камера ще не готова', noBlob: 'Не вдалося створити знімок',
    noSn: 'Немає серійного номера: спочатку додайте запис у Repair Log', saving: 'Зберігаю {f}...',
    saved: 'Збережено: {f} ({n})', noName: 'прізвища в таблиці поки не знайдено', saveErr: 'Помилка збереження: {e}',
    listErr: 'Помилка списку: {e}', loading: 'Завантаження {f}...', notFound: 'Фото {f} не знайдено', downloaded: 'Завантажено: {f}',
    noPolicy: 'файл не видалено: перевір політику видалення в Supabase', deleted: 'Видалено: {f}', delErr: 'Помилка видалення: {e}',
    confirmAll: 'Видалити всі фото ({n} шт.)? Це неможливо скасувати.', deletedN: 'Видалено фото: {n}', zoomErr: 'Зум недоступний: {e}'
  },
  pl: {
    title: 'Zdjęcia', snap: '📷 Zrób zdjęcie i zapisz', listTitle: 'Zdjęcia (przechowywane, dopóki ich nie usuniesz)',
    refresh: 'Odśwież listę', delAll: 'Usuń wszystkie', colWorker: 'Pracownik', colFile: 'Plik', colShot: 'Zrobiono', colDl: 'Pobrano',
    dl: '⬇ Pobierz', del: '🗑 Usuń', empty: 'Brak zdjęć', dlTitle: 'Pobrano: {d}', camN: 'Kamera {n}',
    ariaPhotos: 'Zdjęcia', ariaClose: 'Zamknij',
    autoOk: 'SN z Repair Log: ', autoNone: 'W Repair Log nie ma jeszcze wpisów: nie można zapisać zdjęcia.', autoErr: 'Nie udało się pobrać numeru z Repair Log.',
    noCamSupport: 'Przeglądarka nie obsługuje kamery. Wymagane HTTPS lub localhost.', connecting: 'Łączenie z kamerą...',
    camUnavail: 'Kamera niedostępna: {e}', notReady: 'Kamera nie jest jeszcze gotowa', noBlob: 'Nie udało się utworzyć zdjęcia',
    noSn: 'Brak numeru seryjnego: najpierw dodaj wpis w Repair Log', saving: 'Zapisuję {f}...',
    saved: 'Zapisano: {f} ({n})', noName: 'nazwiska w tabeli jeszcze nie znaleziono', saveErr: 'Błąd zapisu: {e}',
    listErr: 'Błąd listy: {e}', loading: 'Pobieranie {f}...', notFound: 'Nie znaleziono zdjęcia {f}', downloaded: 'Pobrano: {f}',
    noPolicy: 'plik nie został usunięty: sprawdź politykę usuwania w Supabase', deleted: 'Usunięto: {f}', delErr: 'Błąd usuwania: {e}',
    confirmAll: 'Usunąć wszystkie zdjęcia ({n} szt.)? Tego nie można cofnąć.', deletedN: 'Usunięto zdjęć: {n}', zoomErr: 'Zoom niedostępny: {e}'
  },
  en: {
    title: 'Photo', snap: '📷 Take photo and save', listTitle: 'Photos (kept until you delete them)',
    refresh: 'Refresh list', delAll: 'Delete all', colWorker: 'Worker', colFile: 'File', colShot: 'Taken', colDl: 'Downloaded',
    dl: '⬇ Download', del: '🗑 Delete', empty: 'No photos right now', dlTitle: 'Downloaded: {d}', camN: 'Camera {n}',
    ariaPhotos: 'Photos', ariaClose: 'Close',
    autoOk: 'SN from Repair Log: ', autoNone: 'No Repair Log entries yet: the photo cannot be saved.', autoErr: 'Could not get the number from Repair Log.',
    noCamSupport: 'This browser does not support the camera. HTTPS or localhost is required.', connecting: 'Connecting to the camera...',
    camUnavail: 'Camera unavailable: {e}', notReady: 'The camera is not ready yet', noBlob: 'Could not create the picture',
    noSn: 'No serial number: add an entry in Repair Log first', saving: 'Saving {f}...',
    saved: 'Saved: {f} ({n})', noName: 'name not found in the table yet', saveErr: 'Save error: {e}',
    listErr: 'List error: {e}', loading: 'Downloading {f}...', notFound: 'Photo {f} not found', downloaded: 'Downloaded: {f}',
    noPolicy: 'file was not deleted: check the delete policy in Supabase', deleted: 'Deleted: {f}', delErr: 'Delete error: {e}',
    confirmAll: 'Delete all photos ({n})? This cannot be undone.', deletedN: 'Photos deleted: {n}', zoomErr: 'Zoom unavailable: {e}'
  }
};
const t = createTranslator(DICT);

const PAGE_ID = 'photoPage';
const BUCKET = 'photos';

// Работник берётся из рабочей таблицы Final II: вкладка SHEET_TAB, ищется строка с этим серийным номером
// (столбец C), фамилия из столбца F. Фамилия попадает в имя файла и в подпись в списке ниже.
const SHEET_TAB = 'FI Station 2 ULANOVYCH.R';
const SHEET_SN_COL = 2;
const SHEET_NAME_COL = 5;
const SHEET_TTL_MS = 60000;
const NO_NAME = 'NONAME';

// Прежний список: только чтобы подписать старые фото, снятые до этой версии
const LEGACY_WORKERS = [
  { key: 'BLASZKOWSKA',  label: 'BŁASZKOWSKA M.' },
  { key: 'PYNTIA',       label: 'PYNTIA A.' },
  { key: 'ZAHUBYPALETS', label: 'ZAHUBYPALETS K.' },
  { key: 'KUKU',         label: 'KUKU O.' },
  { key: 'NIKOLAIEV',    label: 'NIKOLAIEV D.' },
  { key: 'YAROSHENKO',   label: 'YAROSHENKO L.' },
  { key: 'POKALCHUK',    label: 'POKALCHUK A.' },
  { key: 'HROZDOVA',     label: 'HROZDOVA A.' },
  { key: 'BUJKO',        label: 'BUJKO K.' },
  { key: 'ULANOVYCH',    label: 'ULANOVYCH R.' }
];

const STYLE = `
#photoPage { padding: 1.25rem; overflow: auto; }
#photoPage .ph-wrap { max-width: 1000px; margin: 0 auto; padding: 1.25rem; border-radius: 16px;
  background: rgba(8,10,18,0.6); border: 1px solid rgba(255,255,255,0.14); color: #fff;
  box-shadow: 0 8px 30px rgba(0,0,0,0.5); backdrop-filter: blur(8px); }
#photoPage h2 { margin: 0 0 1rem; font-size: 1.15rem; font-weight: 700; color: #c4b5fd; }
#photoPage .ph-bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 12px; }
#photoPage select, #photoPage input { padding: 9px 10px; background: #111827; color: #fff; border: 1px solid #374151; border-radius: 8px; }
#photoPage #ph-cam { min-width: 14rem; }
#photoPage #ph-serial { min-width: 18rem; font-size: 16px; letter-spacing: .03em; }
#photoPage .ph-auto { margin: -2px 0 10px 0; font-size: 13px; color: #9CA3AF; }
#photoPage .ph-auto.warn { color: #fbbf24; }
#photoPage .ph-workers { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
#photoPage .ph-w { padding: 9px 14px; border: 1px solid #374151; border-radius: 8px; background: #111827;
  color: #e5e7eb; cursor: pointer; font-weight: 600; }
#photoPage .ph-w:hover { border-color: #7c3aed; }
#photoPage .ph-w.sel { background: linear-gradient(135deg,#4f46e5,#7c3aed); border-color: transparent; color: #fff; }
#photoPage .ph-btn { padding: 9px 18px; border: 0; border-radius: 8px; color: #fff; cursor: pointer;
  background: linear-gradient(135deg,#4f46e5,#7c3aed); font-weight: 600; }
#photoPage .ph-btn:disabled { opacity: .4; cursor: not-allowed; }
#photoPage .ph-btn.ghost { background: #374151; }
#photoPage .ph-btn.danger { background: #991B1B; }
#photoPage .ph-btn.danger:hover { background: #B91C1C; }
#photoPage .ph-stage { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
#photoPage .ph-box { background: #000; border: 1px solid #1f2937; border-radius: 10px; min-height: 200px;
  display: flex; align-items: center; justify-content: center; overflow: hidden; }
#photoPage video, #photoPage img { max-width: 100%; max-height: 50vh; display: block; }
#photoPage .ph-msg { color: #9CA3AF; font-size: 13px; margin: 10px 0 14px; min-height: 1.2em; }
#photoPage .ph-table { width: 100%; border-collapse: collapse; background: #0e0e0e; border-radius: 8px; overflow: hidden; }
#photoPage .ph-table th, #photoPage .ph-table td { padding: 8px 12px; border-bottom: 1px solid #1f2937; font-size: 13px; text-align: left; }
#photoPage .ph-table th { background: #111827; color: #9CA3AF; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; font-size: 11px; }
#photoPage .ph-table td.acts { display: flex; gap: 8px; justify-content: flex-end; }
#photoPage .ph-done { color: #4ade80; font-size: 18px; font-weight: 700; text-align: center; }
#photoPage .ph-empty { color: #6B7280; font-size: 13px; padding: 10px 2px; }
@media (max-width: 800px) { #photoPage .ph-stage { grid-template-columns: 1fr; } }

/* ----- Телефон: вкладка открывается как фотоаппарат ----- */
#photoPage .ph-thumb, #photoPage .ph-close, #photoPage .ph-flash { display: none; }
html.touch-phone #photoPage { position: fixed; inset: 0; z-index: 800; margin: 0; padding: 0; background: #000; }
html.touch-phone #photoPage .ph-wrap { position: absolute; inset: 0; max-width: none; margin: 0; padding: 0; border: 0;
  border-radius: 0; background: #000; box-shadow: none; -webkit-backdrop-filter: none; backdrop-filter: none; overflow: hidden; }
html.touch-phone #photoPage h2 { display: none; }
html.touch-phone #photoPage #ph-top { display: contents; }
html.touch-phone #photoPage .ph-stage { position: absolute; inset: 0; display: block; gap: 0; }
html.touch-phone #photoPage .ph-box { position: absolute; inset: 0; border: 0; border-radius: 0; min-height: 0; background: #000; }
html.touch-phone #photoPage video { width: 100%; height: 100%; max-width: none; max-height: none; object-fit: contain; }
html.touch-phone #photoPage .ph-auto { position: absolute; z-index: 3; top: calc(env(safe-area-inset-top, 0px) + 10px); left: 12px; right: 12px;
  margin: 0; padding: 8px 12px; border-radius: 12px; background: rgba(0,0,0,.6); color: #fff; font-size: 13px; text-align: center;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
html.touch-phone #photoPage .ph-auto:empty { display: none; }
html.touch-phone #photoPage #ph-cam { position: absolute; z-index: 3; top: calc(env(safe-area-inset-top, 0px) + 54px); left: 12px;
  max-width: calc(100% - 24px); min-width: 0; background: rgba(0,0,0,.6); border-color: rgba(255,255,255,.25); }
html.touch-phone #photoPage .ph-msg { position: absolute; z-index: 3; left: 12px; right: 12px; margin: 0; text-align: center;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 178px); padding: 8px 12px; border-radius: 12px; background: rgba(0,0,0,.65); color: #fff; font-size: 14px; }
html.touch-phone #photoPage .ph-msg:empty { display: none; }
/* Кнопка съёмки: большой белый круг внизу по центру, как в камере iPhone */
html.touch-phone #photoPage #ph-snap { position: absolute; z-index: 4; left: 50%; bottom: calc(env(safe-area-inset-bottom, 0px) + 28px);
  transform: translateX(-50%); width: 78px; height: 78px; padding: 0; border-radius: 50%; font-size: 0; background: #fff;
  border: 5px solid #000; box-shadow: 0 0 0 4px #fff; }
html.touch-phone #photoPage #ph-snap:active:not(:disabled) { transform: translateX(-50%) scale(.9); }
html.touch-phone #photoPage #ph-snap:disabled { opacity: .35; }
/* Телефон повёрнут горизонтально: кнопка съёмки в правом нижнем углу, под большой палец */
@media (orientation: landscape) {
  html.touch-phone #photoPage #ph-snap { left: auto; right: calc(env(safe-area-inset-right, 0px) + 28px);
    bottom: calc(env(safe-area-inset-bottom, 0px) + 24px); transform: none; }
  html.touch-phone #photoPage #ph-snap:active:not(:disabled) { transform: scale(.9); }
}
html.touch-phone #photoPage .ph-thumb { display: flex; position: absolute; z-index: 4; width: 58px; height: 58px;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 38px); padding: 0; border-radius: 14px; align-items: center; justify-content: center;
  background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.35); color: #fff; font-size: 26px; cursor: pointer; }
html.touch-phone #photoPage .ph-thumb { left: 24px; }
html.touch-phone #photoPage .ph-count { position: absolute; top: -7px; right: -7px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px;
  background: #7c3aed; color: #fff; font-size: 12px; line-height: 20px; text-align: center; }
html.touch-phone #photoPage .ph-count:empty { display: none; }
html.touch-phone #photoPage .ph-flash { display: block; position: absolute; inset: 0; z-index: 6; background: #fff; opacity: 0; pointer-events: none; transition: opacity .25s; }
html.touch-phone #photoPage .ph-flash.on { opacity: .85; transition: none; }
/* Список фото открывается поверх камеры по кнопке слева внизу */
html.touch-phone #photoPage .ph-listbox { display: none; position: absolute; inset: 0; z-index: 7; background: #0b0f1a; overflow: auto;
  -webkit-overflow-scrolling: touch; padding: calc(env(safe-area-inset-top, 0px) + 60px) 12px calc(env(safe-area-inset-bottom, 0px) + 16px); }
html.touch-phone #photoPage .ph-wrap.ph-open .ph-listbox { display: block; }
html.touch-phone #photoPage .ph-wrap.ph-open .ph-close { display: block; position: absolute; z-index: 8; top: calc(env(safe-area-inset-top, 0px) + 10px);
  right: 12px; width: 44px; height: 44px; padding: 0; border: 0; border-radius: 12px; background: #374151; color: #fff; font-size: 20px; cursor: pointer; }
html.touch-phone.ph-camera #langFlags { display: none !important; }

/* Как в стандартной камере: без надписи SN и без списка камер, зум 0,5 / 1 над затвором */
html.touch-phone #photoPage .ph-auto, html.touch-phone #photoPage #ph-cam { display: none !important; }
#photoPage .ph-zoom { display: none; }
html.touch-phone #photoPage .ph-zoom.has { display: flex; position: absolute; z-index: 4; left: 50%; transform: translateX(-50%); gap: 6px;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 124px); padding: 4px; border-radius: 24px; background: rgba(0,0,0,.45); }
html.touch-phone #photoPage .ph-zoom button { min-width: 38px; height: 38px; padding: 0 6px; border: 0; border-radius: 19px; background: transparent;
  color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; -webkit-tap-highlight-color: transparent; }
html.touch-phone #photoPage .ph-zoom button.on { background: rgba(0,0,0,.55); color: #ffd60a; }
@media (orientation: landscape) {
  html.touch-phone #photoPage .ph-zoom.has { left: auto; right: calc(env(safe-area-inset-right, 0px) + 28px); transform: none;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 114px); }
}
#photoPage .ph-thumb.has-img { font-size: 0; background-size: cover; background-position: center; }
`;

const MARKUP = `
<div class="ph-wrap" id="ph-wrap">
  <h2 data-i18n="title">Photo</h2>
  <div class="ph-bar" id="ph-top">
    <select id="ph-cam"></select>
    <button type="button" class="ph-btn" id="ph-snap" data-i18n="snap" disabled>📷</button>
  </div>
  <div class="ph-auto" id="ph-auto"></div>
  <div class="ph-stage" style="grid-template-columns:1fr">
    <div class="ph-box"><video id="ph-video" autoplay playsinline muted></video></div>
  </div>
  <div class="ph-msg" id="ph-msg"></div>
  <div class="ph-zoom" id="ph-zoom"><button type="button" data-z="0.5">0,5</button><button type="button" data-z="1" class="on">1</button></div>
  <button type="button" class="ph-thumb" id="ph-thumb" data-i18n-aria="ariaPhotos" aria-label="Photo">🖼<span class="ph-count" id="ph-count"></span></button>
  <div class="ph-flash" id="ph-flash"></div>
  <button type="button" class="ph-close" id="ph-close" data-i18n-aria="ariaClose" aria-label="Close">✕</button>
  <div class="ph-listbox" id="ph-listbox">
    <div class="ph-bar" style="justify-content:space-between">
      <strong style="color:#c4b5fd" data-i18n="listTitle"></strong>
      <div class="ph-bar" style="margin:0">
        <button type="button" class="ph-btn ghost" id="ph-refresh" data-i18n="refresh"></button>
        <button type="button" class="ph-btn danger" id="ph-delall" data-i18n="delAll"></button>
      </div>
    </div>
    <div id="ph-list"></div>
  </div>
</div>`;

const $ = (id) => document.getElementById(id);
let inited = false;
let stream = null;
let client = null;
let userCam = false;     // камеру выбрали вручную: автовыбор её не меняет
let autoCamTried = false; // автовыбор камеры за это открытие вкладки уже выполнен
let sheetCache = { at: 0, idx: null }; // серийный номер -> фамилия из таблицы
let listed = [];     // имена файлов, которые сейчас показаны в списке
let autoSn = '';       // последний серийный номер из Repair Log
let autoInfo = '';     // дата и время этой записи
let autoState = 'wait'; // wait | ok | none | err
const RL_QUEUE_KEY = 'rl_queue_v1'; // записи Repair Log, ещё не отправленные в базу (нет связи)

let msgTimer = null;
function msg(text) {
  $('ph-msg').textContent = text || '';
  clearTimeout(msgTimer);
  if (text) msgTimer = setTimeout(() => { $('ph-msg').textContent = ''; }, 8000);
}

// Отдельный клиент для вкладки Photo (без сессии), чтобы не конфликтовать с другими клиентами сайта
function sb() {
  if (!client) {
    client = createIsolatedClient({
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'sb-photo-tab'
      }
    });
  }
  return client;
}

/* ---------- Серийный номер из Repair Log ---------- */

// Самая свежая запись Repair Log. Неотправленные записи этого устройства новее базы
async function latestRepairSn() {
  try {
    const q = JSON.parse(localStorage.getItem(RL_QUEUE_KEY) || '[]');
    if (q.length) { const r = q[q.length - 1]; return { sn: r.sn, when: ((r.date || '') + ' ' + (r.time || '')).trim() }; }
  } catch (e) {}
  const res = await Promise.race([
    sb().from('repair_log').select('panel_sn,repair_date,repair_time').order('id', { ascending: false }).limit(1),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
  ]);
  if (res.error) throw res.error;
  const r = res.data && res.data[0];
  return r ? { sn: r.panel_sn, when: ((r.repair_date || '') + ' ' + (r.repair_time || '')).trim() } : null;
}

function showAuto() {
  const el = $('ph-auto');
  if (!el) return;
  let text = '', warn = false;
  if (autoState === 'ok') text = t('autoOk') + autoSn + (autoInfo ? ' · ' + autoInfo : '');
  else if (autoState === 'none') { text = t('autoNone'); warn = true; }
  else if (autoState === 'err') { text = t('autoErr'); warn = true; }
  el.textContent = text;
  el.className = 'ph-auto' + (warn ? ' warn' : '');
}

async function refreshAuto() {
  try {
    const r = await latestRepairSn();
    autoSn = r ? cleanSerial(r.sn) : '';
    autoInfo = r ? r.when : '';
    autoState = autoSn ? 'ok' : 'none';
  } catch (e) {
    autoState = 'err';
  }
  showAuto();
}

// Серийный номер: только буквы, цифры, _ и -
function cleanSerial(v) {
  return String(v || '').trim().replace(/[^A-Za-z0-9_-]/g, '');
}

/* ---------- Работники ---------- */

// «BŁASZKOWSKA M.» -> BLASZKOWSKA (первое слово, без диакритики)
function workerKey(label) {
  const folded = String(label || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/Ł/g, 'L').replace(/ł/g, 'l').toUpperCase();
  const m = /[A-Z]+/.exec(folded);
  return m ? m[0] : '';
}

function labelForKey(key) {
  if (key === NO_NAME) return '—';
  const w = LEGACY_WORKERS.find(x => x.key === key);
  return w ? w.label : key;
}

// Индекс «серийный номер -> фамилия» из вкладки таблицы (последняя запись по номеру главнее). Кэш на минуту
async function sheetIndex(force) {
  if (!force && sheetCache.idx && Date.now() - sheetCache.at < SHEET_TTL_MS) return sheetCache.idx;
  try {
    const rows = await sheetRows(SHEET_TAB);
    const idx = new Map();
    (rows || []).slice(1).forEach(r => {
      const sn = String(r[SHEET_SN_COL] || '').trim().toUpperCase();
      const name = String(r[SHEET_NAME_COL] || '').trim();
      if (sn && name) idx.set(sn, name);
    });
    sheetCache = { at: Date.now(), idx };
  } catch (e) {
    // Таблица недоступна: пользуемся прошлым индексом, если он есть
    if (!sheetCache.idx) sheetCache = { at: 0, idx: new Map() };
  }
  return sheetCache.idx;
}

// Фамилия по серийному номеру: сначала из кэша, при отсутствии один раз перечитываем таблицу
async function workerFor(serial) {
  const sn = String(serial || '').toUpperCase();
  let name = (await sheetIndex(false)).get(sn);
  if (!name) name = (await sheetIndex(true)).get(sn);
  return name || '';
}

/* ---------- Камера ---------- */

function stopStream() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  const v = $('ph-video');
  if (v) v.srcObject = null;
  const b = $('ph-snap');
  if (b) b.disabled = true;
}

const isTouch = () => !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

// Названия камер зависят от языка iPhone: «Задняя двойная широкоугольная камера», «Back Dual Wide Camera» и т.п.
function pickPreferredCamera(devices) {
  const l = (d) => (d.label || '').toLowerCase();
  const back = /(задн|back|rear|tyln|tylny)/;
  const dual = /(двойн|подвійн|dual|podwójn|podwojn)/;
  const wide = /(широкоугол|ширококут|wide|szerokok)/;
  const ultra = /(сверх|надш|ultra|ultraszerok)/;
  const exact = devices.find(d => back.test(l(d)) && dual.test(l(d)) && wide.test(l(d)) && !ultra.test(l(d)));
  if (exact) return exact;
  // Двойной нет (другая модель): обычная задняя камера, но не сверхширокая и не телеобъектив
  return devices.find(d => back.test(l(d)) && !ultra.test(l(d)) && !/(телефото|telephoto|tele|тройн|потрійн|triple)/.test(l(d))) || null;
}

// Сверхширокая камера (0,5×). Названия зависят от языка iPhone
function pickUltraCamera(devices) {
  const l = (d) => (d.label || '').toLowerCase();
  return devices.find(d => /(задн|back|rear|tyln|tylny)/.test(l(d)) && /(сверх|надш|ultra|ultraszerok)/.test(l(d))) || null;
}

// Кнопки 0,5 и 1 как в камере телефона. iPhone: это две разные камеры. Android: зум самой камеры
let zoomMode = '';   // device | zoom | ''
let zoomIds = { main: '', ultra: '' };

function markZoom(active) {
  const box = $('ph-zoom');
  if (!box) return;
  box.querySelectorAll('button').forEach((b) => {
    const on = Number(b.dataset.z) === active;
    b.classList.toggle('on', on);
    b.textContent = (b.dataset.z === '0.5' ? '0,5' : '1') + (on ? '×' : '');
  });
}

async function setupZoom() {
  const box = $('ph-zoom');
  if (!box) return;
  zoomMode = '';
  box.classList.remove('has');
  if (!isTouch() || !stream) return;
  const track = stream.getVideoTracks && stream.getVideoTracks()[0];
  if (!track) return;
  const curId = track.getSettings ? (track.getSettings().deviceId || '') : '';
  const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
  const main = pickPreferredCamera(devs), ultra = pickUltraCamera(devs);
  if (main && ultra) {
    zoomMode = 'device';
    zoomIds = { main: main.deviceId, ultra: ultra.deviceId };
    box.classList.add('has');
    markZoom(curId === ultra.deviceId ? 0.5 : 1);
    return;
  }
  const caps = track.getCapabilities ? track.getCapabilities() : {};
  if (caps.zoom && caps.zoom.min <= 0.6) {
    zoomMode = 'zoom';
    box.classList.add('has');
    const z = track.getSettings ? track.getSettings().zoom : 1;
    markZoom(z && z < 0.9 ? 0.5 : 1);
  }
}

async function onZoomClick(value) {
  if (zoomMode === 'device') {
    const id = value === 0.5 ? zoomIds.ultra : zoomIds.main;
    $('ph-cam').value = id;
    userCam = true;
    markZoom(value);
    await startCamera();
  } else if (zoomMode === 'zoom') {
    const track = stream && stream.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ zoom: value }] });
      markZoom(value);
    } catch (e) { msg(t('zoomErr', { e: e.message })); }
  }
}

async function fillCameraList() {
  const sel = $('ph-cam');
  const current = sel.value;
  const devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
  sel.innerHTML = '';
  devices.forEach((d, i) => {
    const opt = document.createElement('option');
    opt.value = d.deviceId;
    opt.textContent = d.label || t('camN', { n: i + 1 });
    sel.appendChild(opt);
  });
  if (current && devices.some(d => d.deviceId === current)) sel.value = current;
}

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    msg(t('noCamSupport'));
    return;
  }
  stopStream();
  msg(t('connecting'));
  const deviceId = $('ph-cam').value;
  // На телефоне без выбранной камеры сразу открываем заднюю (потом подбирается двойная широкоугольная)
  const video = deviceId
    ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
    : (isTouch()
        ? { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }
        : { width: { ideal: 1920 }, height: { ideal: 1080 } });
  const constraints = { audio: false, video };
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    $('ph-video').srcObject = stream;
    await $('ph-video').play().catch(() => {});
    $('ph-snap').disabled = false;
    await fillCameraList();
    msg('');
    // Только телефон: сам выбираем «Заднюю двойную широкоугольную камеру», если её не выбрали вручную
    if (isTouch() && !userCam && !autoCamTried) {
      autoCamTried = true;
      const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
      const pref = pickPreferredCamera(devs);
      const track = stream && stream.getVideoTracks && stream.getVideoTracks()[0];
      const curId = track && track.getSettings ? track.getSettings().deviceId : '';
      if (pref) {
        $('ph-cam').value = pref.deviceId;
        if (pref.deviceId !== curId) { await startCamera(); return; }
      }
    }
    await setupZoom();
  } catch (err) {
    msg(t('camUnavail', { e: err.name + ' — ' + err.message }));
  }
}

/* ---------- Снимок и сохранение ---------- */

// Короткая белая вспышка и вибрация (где поддерживается): видно, что снимок сделан
function flash() {
  const f = $('ph-flash');
  if (f) { f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 120); }
  try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) {}
}

// Последний снимок на кнопке слева внизу, как в камере телефона
function setThumb(src) {
  try {
    const t = $('ph-thumb');
    const c = document.createElement('canvas');
    c.width = c.height = 116;
    const side = Math.min(src.width, src.height);
    c.getContext('2d').drawImage(src, (src.width - side) / 2, (src.height - side) / 2, side, side, 0, 0, 116, 116);
    t.style.backgroundImage = `url(${c.toDataURL('image/jpeg', 0.7)})`;
    t.classList.add('has-img');
  } catch (e) {}
}

async function takeShot() {
  const video = $('ph-video');
  if (!stream || !video.videoWidth) { msg(t('notReady')); return; }

  // Кадр снимаем сразу при нажатии
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) { msg(t('noBlob')); return; }
  flash();
  setThumb(canvas);

  // Серийный номер: самый свежий из Repair Log
  await refreshAuto();
  const serial = autoSn;
  if (serial.length < 3) {
    msg(t('noSn'));
    return;
  }

  // Фамилия по этому номеру из рабочей таблицы Final II
  const name = await workerFor(serial);
  const key = workerKey(name) || NO_NAME;
  const objectName = `${key}__${serial}.jpg`;
  msg(t('saving', { f: serial + '.jpg' }));
  $('ph-snap').disabled = true;

  try {
    const { error } = await sb().storage.from(BUCKET).upload(objectName, blob, {
      upsert: true,
      contentType: 'image/jpeg',
      cacheControl: '0'
    });
    if (error) throw error;
    // Повторный снимок этого номера: убираем прежний файл, если он был записан под другой фамилией
    const stale = listed.filter(n => n !== objectName && n.endsWith('__' + serial + '.jpg'));
    if (stale.length) { try { await removeFiles(stale); } catch (e) {} }
    msg(t('saved', { f: serial + '.jpg', n: name || t('noName') }));
    refreshAuto();
    refreshList();
  } catch (err) {
    msg(t('saveErr', { e: err.message || err }));
  } finally {
    $('ph-snap').disabled = !stream;
  }
}

/* ---------- Список, скачивание и удаление ---------- */

// ФАМИЛИЯ__серийный.jpg -> { worker, serial }
function parseName(name) {
  const m = /^([A-Z]+)__([A-Za-z0-9_-]+)\.jpg$/.exec(name);
  if (!m) return null;
  return { worker: labelForKey(m[1]), serial: m[2] };
}

async function refreshList() {
  const { data, error } = await sb().storage.from(BUCKET).list('', {
    limit: 1000,
    sortBy: { column: 'updated_at', order: 'desc' }
  });
  if (error) { msg(t('listErr', { e: error.message })); return; }

  const items = (data || [])
    .map(f => ({ f, p: parseName(f.name) }))
    .filter(x => x.p);
  listed = items.map(x => x.f.name);
  if ($('ph-count')) $('ph-count').textContent = listed.length ? String(listed.length) : '';
  const idx = await sheetIndex(false);

  // Отметки «скачано» (таблица photo_downloads). Если таблицы нет, отметок просто не будет
  const downloaded = {};
  if (items.length) {
    try {
      const { data: dd } = await sb().from('photo_downloads')
        .select('file_name, downloaded_at')
        .in('file_name', listed);
      (dd || []).forEach(r => { downloaded[r.file_name] = r.downloaded_at; });
    } catch (e) {}
  }

  const rows = items.map(x => {
    // Галочка, если фото скачали уже после того, как оно было снято (повторный снимок сбрасывает отметку)
    const d = downloaded[x.f.name];
    const done = d && x.f.updated_at && new Date(d) > new Date(x.f.updated_at);
    const mark = done ? `<span title="${esc(t('dlTitle', { d: new Date(d).toLocaleString() }))}">✔</span>` : '';
    return `<tr>
      <td>${esc(idx.get(x.p.serial.toUpperCase()) || x.p.worker)}</td>
      <td>${esc(x.p.serial)}.jpg</td>
      <td>${esc(x.f.updated_at ? new Date(x.f.updated_at).toLocaleString() : '')}</td>
      <td class="ph-done">${mark}</td>
      <td class="acts">
        <button type="button" class="ph-btn ghost" data-dl="${esc(x.f.name)}">${esc(t('dl'))}</button>
        <button type="button" class="ph-btn danger" data-del="${esc(x.f.name)}">${esc(t('del'))}</button>
      </td>
    </tr>`;
  }).join('');

  $('ph-list').innerHTML = rows
    ? `<table class="ph-table">
        <thead><tr><th>${esc(t('colWorker'))}</th><th>${esc(t('colFile'))}</th><th>${esc(t('colShot'))}</th><th style="text-align:center">${esc(t('colDl'))}</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`
    : `<div class="ph-empty">${esc(t('empty'))}</div>`;
  $('ph-delall').disabled = !listed.length;
}

async function downloadFile(name) {
  const p = parseName(name);
  if (!p) return;
  const fileName = p.serial + '.jpg';
  msg(t('loading', { f: fileName }));

  const { data, error } = await sb().storage.from(BUCKET).download(name);
  if (error || !data) { msg(t('notFound', { f: fileName })); refreshList(); return; }
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  msg(t('downloaded', { f: fileName }));
  try { await sb().rpc('mark_photo_downloaded', { p_name: name }); } catch (e) {}
  refreshList();
}

// Удаляет файлы из хранилища. Если ни один файл не удалён, значит, нет политики на удаление
async function removeFiles(names) {
  const { data, error } = await sb().storage.from(BUCKET).remove(names);
  if (error) throw error;
  if (!data || !data.length) throw new Error(t('noPolicy'));
  return data.length;
}

async function deleteFile(name) {
  const p = parseName(name);
  if (!p) return;
  try {
    await removeFiles([name]);
    msg(t('deleted', { f: p.serial + '.jpg' }));
  } catch (err) {
    msg(t('delErr', { e: err.message || err }));
  }
  refreshList();
}

async function deleteAll() {
  if (!listed.length) return;
  if (!confirm(t('confirmAll', { n: listed.length }))) return;
  try {
    const n = await removeFiles(listed.slice());
    msg(t('deletedN', { n }));
  } catch (err) {
    msg(t('delErr', { e: err.message || err }));
  }
  refreshList();
}

/* ---------- Контракт страницы ---------- */

// Переводит статичные надписи страницы
function applyText() {
  const root = $(PAGE_ID);
  if (!root) return;
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const v = t(el.dataset.i18nAria);
    el.setAttribute('aria-label', v);
    // у кнопки списка внутри лежит счётчик: её текст не трогаем
  });
}

export function init() {
  const root = $(PAGE_ID);
  if (!root) return;

  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);
  root.innerHTML = MARKUP;
  applyText();
  onLangChange(() => { applyText(); showAuto(); if (inited) refreshList(); });
  $('ph-snap').addEventListener('click', takeShot);
  $('ph-cam').addEventListener('change', () => { userCam = true; startCamera(); });
  $('ph-refresh').addEventListener('click', refreshList);
  $('ph-zoom').addEventListener('click', (e) => { const b = e.target.closest('button[data-z]'); if (b) onZoomClick(Number(b.dataset.z)); });
  $('ph-thumb').addEventListener('click', () => { $('ph-wrap').classList.add('ph-open'); refreshList(); });
  $('ph-close').addEventListener('click', () => $('ph-wrap').classList.remove('ph-open'));
  $('ph-delall').addEventListener('click', deleteAll);
  $('ph-list').addEventListener('click', (e) => {
    const dl = e.target.closest('button[data-dl]');
    if (dl) { downloadFile(dl.dataset.dl); return; }
    const del = e.target.closest('button[data-del]');
    if (del) deleteFile(del.dataset.del);
  });

  // Обновляем список раз в 30 секунд, пока открыта вкладка (чтобы видеть фото коллеги)
  setInterval(() => { if (inited && $('ph-list').offsetParent && !document.hidden) refreshList(); }, 30000);
  // Свежий номер из Repair Log подтягиваем каждые 5 секунд, пока открыта вкладка
  setInterval(() => { if (inited && $('ph-auto').offsetParent && !document.hidden) refreshAuto(); }, 5000);

  inited = true;
}

// Страницу открыли
export function show() {
  if (!inited) return;
  document.documentElement.classList.add('ph-camera');
  $('ph-wrap').classList.remove('ph-open');
  if (isTouch()) { userCam = false; $('ph-cam').selectedIndex = -1; }
  autoCamTried = false;
  startCamera();
  refreshList();
  refreshAuto();
}

// Со страницы ушли: камера выключается
export function hide() {
  document.documentElement.classList.remove('ph-camera');
  stopStream();
}
