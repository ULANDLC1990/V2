/* Состояние сайта: индикатор в шапке, журнал ошибок, установка как приложения.
   Подключение: первый <script type="module"> в index.html (чтобы ловить ошибки при загрузке остальных модулей).

   Индикатор (точка в шапке рядом с названием страницы), клик открывает окно с подробностями:
     зелёная  — всё в порядке;
     жёлтая   — есть записи Repair Log, не отправленные в базу; или данные давно не обновлялись в рабочее время;
                или за последние 15 минут были ошибки на этом устройстве;
     красная  — нет интернета или база не отвечает;
     серая    — ещё не проверено.
   Журнал ошибок: хранится на этом устройстве (последние 100 записей). Ловит ошибки скриптов, необработанные ошибки
   запросов, ошибки загрузки файлов и всё, что сайт пишет через console.error. Одинаковые подряд идущие ошибки склеиваются.
   Название устройства задаётся в окне (например «Станция II, ПК»): оно записывается в каждую ошибку.
   Если в config.js задать ERROR_TABLE: 'client_errors', ошибки дополнительно уходят в эту таблицу Supabase,
   и их видно со всех устройств.

   Для отладки из консоли: window.lcdrLog('текст', 'откуда') и window.lcdrHealth. */
import { APP_CONFIG } from './core/config.js';
import { sb, hasSupabase } from './core/supabase.js';
import { esc, lsGet, lsSet, localDate } from './core/util.js';
import { pnbInfo } from './core/pncache.js';
import { getLang } from './i18n.js';

const BUILD = '2026-11-01.1-v2';    // версия сайта: попадает в каждую запись журнала
const LOG_KEY = 'lcdr_errlog_v1', DEV_KEY = 'lcdr_device_v1', NAME_KEY = 'lcdr_device_name_v1';
const MAX_LOG = 100;
const PING_MS = 60000;              // как часто проверять базу
const STALE_MIN = 180;              // данные старше этого (в минутах) в рабочее время считаются устаревшими
const WORK_FROM = 6, WORK_TO = 22;  // рабочие часы для проверки «данные устарели»
const RECENT_ERR_MS = 15 * 60000;   // ошибки за это время делают точку жёлтой

const IGNORE = /ResizeObserver loop|chrome-extension:|moz-extension:/i;

/* ---------- Хранилище ---------- */
function deviceId() {
  let id = lsGet(DEV_KEY);
  if (!id) { id = Math.random().toString(16).slice(2, 8); lsSet(DEV_KEY, id); }
  return id;
}
const deviceName = () => lsGet(NAME_KEY) || '';

function browserInfo() {
  const ua = navigator.userAgent || '';
  const br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  const sc = window.screen; const scr = (sc && sc.width) ? sc.width + 'x' + sc.height : '';
  return [br, os, scr].filter(Boolean).join(' · ');
}

function currentPage() {
  try {
    const sec = Array.from(document.querySelectorAll('main .label-page')).find(s => s.style.display !== 'none');
    return sec ? sec.id : 'content';
  } catch (e) { return ''; }
}

/* ---------- Журнал ошибок ---------- */
function readLog() {
  try { const a = JSON.parse(lsGet(LOG_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}
function writeLog(a) { lsSet(LOG_KEY, JSON.stringify(a.slice(-MAX_LOG))); }

function pushErr(type, msg, src) {
  try {
    msg = String(msg == null ? '' : msg).slice(0, 400);
    if (!msg || IGNORE.test(msg) || IGNORE.test(String(src || ''))) return;
    const log = readLog();
    const now = Date.now();
    const last = log[log.length - 1];
    if (last && last.type === type && last.msg === msg && now - last.t < 60000) {
      last.n = (last.n || 1) + 1;
      last.t = now;
      last.sent = false;
    } else {
      log.push({ t: now, type, msg, src: src || '', page: currentPage(), build: BUILD,
        device: deviceId(), name: deviceName(), n: 1, sent: false });
    }
    writeLog(log);
    refresh();
    sendRemote();
  } catch (e) {}
}

function fmt(a) {
  if (a instanceof Error) return a.message;
  if (a && typeof a === 'object') { try { return JSON.stringify(a).slice(0, 200); } catch (e) { return String(a); } }
  return String(a);
}

/* ---------- Отправка журнала в Supabase (если задана таблица) ---------- */
let remoteOff = false, sending = false;
async function sendRemote() {
  const c = APP_CONFIG;
  if (!c.ERROR_TABLE || remoteOff || sending || navigator.onLine === false || !c.SUPABASE_URL) return;
  const log = readLog();
  const pending = log.filter(e => !e.sent).slice(0, 20);
  if (!pending.length) return;
  sending = true;
  try {
    const res = await fetch(c.SUPABASE_URL + '/rest/v1/' + c.ERROR_TABLE, {
      method: 'POST',
      headers: { apikey: c.SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(pending.map(e => ({
        device: e.device, device_name: e.name || null, page: e.page || null, type: e.type,
        message: e.msg, source: e.src || null, count: e.n || 1, build: e.build,
        user_agent: browserInfo(), occurred_at: new Date(e.t).toISOString()
      })))
    });
    if (res.ok) {
      const keys = new Set(pending.map(e => e.t + '|' + e.msg));
      const fresh = readLog();
      fresh.forEach(e => { if (keys.has(e.t + '|' + e.msg)) e.sent = true; });
      writeLog(fresh);
    } else if (res.status >= 400 && res.status < 500) {
      remoteOff = true; // таблицы нет или нет права записи: до перезагрузки не пробуем
    }
  } catch (e) { /* нет связи: отправим позже */ }
  finally { sending = false; }
}

/* ---------- Проверка состояния ---------- */
const H = { ping: null, lastData: null };
let deferredInstall = null;

async function ping() {
  if (navigator.onLine === false) { H.ping = { ok: false, t: Date.now(), err: 'offline' }; refresh(); return; }
  try {
    if (!hasSupabase()) throw new Error('supabase not loaded');
    const t0 = performance.now();
    const res = await Promise.race([
      sb().from('fi_log').select('updated_at').eq('day', localDate()).order('updated_at', { ascending: false }).limit(1),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
    ]);
    if (res.error) throw res.error;
    H.ping = { ok: true, ms: Math.round(performance.now() - t0), t: Date.now() };
    const row = res.data && res.data[0];
    H.lastData = row && row.updated_at ? Date.parse(row.updated_at) : null;
  } catch (e) {
    H.ping = { ok: false, t: Date.now(), err: String((e && e.message) || e).slice(0, 120) };
  }
  refresh();
}

function queueCount() {
  try { return (JSON.parse(lsGet('rl_queue_v1') || '[]') || []).length; } catch (e) { return 0; }
}

function recentErrors() {
  const from = Date.now() - RECENT_ERR_MS;
  return readLog().filter(e => e.t >= from).length;
}

function dataAgeMin() {
  return H.lastData ? Math.max(0, Math.round((Date.now() - H.lastData) / 60000)) : null;
}

function inWorkHours() {
  const h = new Date().getHours();
  return h >= WORK_FROM && h < WORK_TO;
}

// 'unknown' | 'ok' | 'warn' | 'bad' и причины
function compute() {
  const reasons = [];
  if (navigator.onLine === false) return { level: 'bad', reasons: ['offline'] };
  if (!H.ping) return { level: 'unknown', reasons };
  if (!H.ping.ok) return { level: 'bad', reasons: ['db'] };
  const age = dataAgeMin();
  if (queueCount() > 0) reasons.push('queue');
  if (age !== null && age > STALE_MIN && inWorkHours()) reasons.push('stale');
  if (recentErrors() > 0) reasons.push('errors');
  return { level: reasons.length ? 'warn' : 'ok', reasons };
}

/* ---------- Тексты (здесь только 4 языка, остальные показывают английский) ---------- */
const T = {
  en: {
    title: 'Site status', internet: 'Internet', on: 'connected', off: 'no connection', db: 'Database',
    dbOk: 'OK, {ms} ms', dbFail: 'not responding', dbWait: 'checking…', data: 'Last data update today', dataNone: 'no data today yet',
    pnbase: 'PN base on this device', rows: 'rows, updated', never: 'not loaded yet', queue: 'Repair Log, waiting to send',
    version: 'Site version', device: 'Device', devName: 'Device name', devNamePh: 'e.g. Station II PC',
    errors: 'Errors on this device', noErrors: 'no errors', copy: 'Copy log', copied: 'Copied', clear: 'Clear', close: 'Close',
    install: 'Install as an app', installed: 'Installed as an app', iosHint: 'To install: Share → Add to Home Screen',
    now: 'just now', min: 'min', h: 'h', d: 'd', ago: 'ago', level: { ok: 'All good', warn: 'Attention', bad: 'Problem', unknown: 'Checking…' }
  },
  ru: {
    title: 'Состояние сайта', internet: 'Интернет', on: 'есть', off: 'нет связи', db: 'База данных',
    dbOk: 'OK, {ms} мс', dbFail: 'не отвечает', dbWait: 'проверяется…', data: 'Последнее обновление данных сегодня', dataNone: 'сегодня данных ещё нет',
    pnbase: 'База PN на этом устройстве', rows: 'строк, обновлена', never: 'ещё не загружена', queue: 'Repair Log, ждут отправки',
    version: 'Версия сайта', device: 'Устройство', devName: 'Название устройства', devNamePh: 'например: Станция II, ПК',
    errors: 'Ошибки на этом устройстве', noErrors: 'ошибок нет', copy: 'Копировать журнал', copied: 'Скопировано', clear: 'Очистить', close: 'Закрыть',
    install: 'Установить как приложение', installed: 'Установлено как приложение', iosHint: 'Чтобы установить: Поделиться → На экран «Домой»',
    now: 'только что', min: 'мин', h: 'ч', d: 'д', ago: 'назад', level: { ok: 'Всё в порядке', warn: 'Внимание', bad: 'Проблема', unknown: 'Проверка…' }
  },
  uk: {
    title: 'Стан сайту', internet: 'Інтернет', on: 'є', off: 'немає зв\'язку', db: 'База даних',
    dbOk: 'OK, {ms} мс', dbFail: 'не відповідає', dbWait: 'перевіряється…', data: 'Останнє оновлення даних сьогодні', dataNone: 'сьогодні даних ще немає',
    pnbase: 'База PN на цьому пристрої', rows: 'рядків, оновлена', never: 'ще не завантажена', queue: 'Repair Log, чекають відправки',
    version: 'Версія сайту', device: 'Пристрій', devName: 'Назва пристрою', devNamePh: 'наприклад: Станція II, ПК',
    errors: 'Помилки на цьому пристрої', noErrors: 'помилок немає', copy: 'Копіювати журнал', copied: 'Скопійовано', clear: 'Очистити', close: 'Закрити',
    install: 'Встановити як застосунок', installed: 'Встановлено як застосунок', iosHint: 'Щоб встановити: Поділитися → На екран «Додому»',
    now: 'щойно', min: 'хв', h: 'год', d: 'д', ago: 'тому', level: { ok: 'Усе гаразд', warn: 'Увага', bad: 'Проблема', unknown: 'Перевірка…' }
  },
  pl: {
    title: 'Stan witryny', internet: 'Internet', on: 'jest', off: 'brak połączenia', db: 'Baza danych',
    dbOk: 'OK, {ms} ms', dbFail: 'nie odpowiada', dbWait: 'sprawdzanie…', data: 'Ostatnia aktualizacja danych dzisiaj', dataNone: 'dzisiaj jeszcze brak danych',
    pnbase: 'Baza PN na tym urządzeniu', rows: 'wierszy, zaktualizowana', never: 'jeszcze nie wczytana', queue: 'Repair Log, czeka na wysłanie',
    version: 'Wersja witryny', device: 'Urządzenie', devName: 'Nazwa urządzenia', devNamePh: 'np. Stacja II, PC',
    errors: 'Błędy na tym urządzeniu', noErrors: 'brak błędów', copy: 'Kopiuj dziennik', copied: 'Skopiowano', clear: 'Wyczyść', close: 'Zamknij',
    install: 'Zainstaluj jako aplikację', installed: 'Zainstalowano jako aplikację', iosHint: 'Aby zainstalować: Udostępnij → Do ekranu początkowego',
    now: 'przed chwilą', min: 'min', h: 'godz.', d: 'd', ago: 'temu', level: { ok: 'Wszystko w porządku', warn: 'Uwaga', bad: 'Problem', unknown: 'Sprawdzanie…' }
  }
};
const tx = () => T[String(getLang() || 'en').slice(0, 2)] || T.en;

function agoText(ms) {
  const t = tx(), m = Math.round(ms / 60000);
  if (m < 1) return t.now;
  if (m < 60) return m + ' ' + t.min + ' ' + t.ago;
  if (m < 1440) return Math.floor(m / 60) + ' ' + t.h + ' ' + (m % 60) + ' ' + t.min + ' ' + t.ago;
  return Math.floor(m / 1440) + ' ' + t.d + ' ' + t.ago;
}
const hhmmss = (ms) => new Date(ms).toLocaleTimeString([], { hour12: false });

/* ---------- Индикатор и окно ---------- */
const COLORS = { ok: '#22c55e', warn: '#f59e0b', bad: '#ef4444', unknown: '#6b7280' };
let btn = null, overlay = null;

const CSS = `
.lcdr-dot { display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; margin-left:10px;
  border-radius:50%; border:1px solid rgba(255,255,255,.18); background:rgba(17,24,39,.7); cursor:pointer; padding:0; flex:0 0 auto; }
.lcdr-dot:hover { border-color:rgba(255,255,255,.4); }
.lcdr-dot i { width:10px; height:10px; border-radius:50%; background:var(--c,#6b7280); box-shadow:0 0 6px var(--c,#6b7280); }
#lcdrHealth { position:fixed; inset:0; z-index:10001; display:none; align-items:center; justify-content:center; background:rgba(0,0,0,.75); }
#lcdrHealth.show { display:flex; }
#lcdrHealth .lh-box { background:#111827; color:#fff; border:1px solid #374151; border-radius:12px; padding:18px 20px;
  width:92%; max-width:560px; max-height:88%; overflow:auto; box-shadow:0 10px 25px rgba(0,0,0,.6); font-size:14px; }
#lcdrHealth h3 { margin:0 0 12px 0; font-size:17px; display:flex; align-items:center; gap:8px; }
#lcdrHealth h3 i { width:11px; height:11px; border-radius:50%; background:var(--c); display:inline-block; }
#lcdrHealth .lh-row { display:flex; justify-content:space-between; gap:14px; padding:7px 0; border-bottom:1px solid #1f2937; }
#lcdrHealth .lh-k { color:#9CA3AF; }
#lcdrHealth .lh-v { text-align:right; font-weight:600; }
#lcdrHealth .lh-ok { color:#4ade80; } #lcdrHealth .lh-warn { color:#fbbf24; } #lcdrHealth .lh-bad { color:#f87171; }
#lcdrHealth .lh-name { width:100%; box-sizing:border-box; margin-top:6px; padding:8px 10px; border-radius:8px; border:1px solid #374151;
  background:#0b1220; color:#fff; font-family:inherit; }
#lcdrHealth .lh-sec { margin:14px 0 6px 0; color:#9CA3AF; font-size:12px; text-transform:uppercase; letter-spacing:.06em; }
#lcdrHealth .lh-errs { max-height:190px; overflow:auto; background:#0b1220; border-radius:8px; padding:6px 10px; }
#lcdrHealth .lh-err { padding:5px 0; border-bottom:1px solid #1f2937; font-size:12px; word-break:break-word; color:#E5E7EB; }
#lcdrHealth .lh-err b { color:#9CA3AF; font-weight:600; }
#lcdrHealth .lh-btns { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }
#lcdrHealth button.lh-b { background:#1f2937; color:#fff; border:1px solid #374151; border-radius:8px; padding:8px 14px; cursor:pointer; font-family:inherit; font-weight:600; }
#lcdrHealth button.lh-b:hover { background:#374151; }
#lcdrHealth button.lh-main { background:linear-gradient(135deg,#4f46e5,#7c3aed); border:none; }
#lcdrHealth .lh-hint { color:#9CA3AF; font-size:12px; margin-top:8px; }`;

function mount() {
  if (btn) return;
  const css = document.createElement('style');
  css.textContent = CSS;
  document.head.appendChild(css);

  btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'lcdr-dot';
  btn.innerHTML = '<i></i>';
  btn.addEventListener('click', openPanel);
  const title = document.getElementById('pageTitle');
  if (title && title.parentNode) title.parentNode.insertBefore(btn, title.nextSibling);
  else (document.querySelector('.topbar') || document.body).appendChild(btn);

  overlay = document.createElement('div');
  overlay.id = 'lcdrHealth';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closePanel(); });
  document.body.appendChild(overlay);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
  refresh();
}

const isOpen = () => overlay && overlay.classList.contains('show');
function closePanel() { if (overlay) overlay.classList.remove('show'); }
function openPanel() { overlay.classList.add('show'); renderPanel(); }

function refresh() {
  if (!btn) return;
  const s = compute();
  btn.style.setProperty('--c', COLORS[s.level]);
  btn.title = tx().title + ': ' + tx().level[s.level];
  if (isOpen()) renderPanel();
}

function row(k, v, cls) {
  return `<div class="lh-row"><span class="lh-k">${esc(k)}</span><span class="lh-v ${cls || ''}">${v}</span></div>`;
}

function renderPanel() {
  // Не перерисовываем окно, пока в поле названия устройства идёт ввод
  if (overlay.querySelector('.lh-name') && document.activeElement === overlay.querySelector('.lh-name')) return;
  const t = tx(), s = compute();
  const online = navigator.onLine !== false;
  const age = dataAgeMin();
  const pn = pnbInfo();
  const q = queueCount();
  const log = readLog().slice().reverse();
  const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent || '');

  const dbVal = !H.ping ? esc(t.dbWait) : H.ping.ok ? esc(t.dbOk.replace('{ms}', H.ping.ms)) : esc(t.dbFail);
  const dbCls = !H.ping ? '' : H.ping.ok ? 'lh-ok' : 'lh-bad';
  const dataVal = age === null ? esc(t.dataNone) : esc(agoText(age * 60000) + ' (' + hhmmss(H.lastData) + ')');
  const dataCls = age !== null && age > STALE_MIN && inWorkHours() ? 'lh-warn' : '';

  let html = `<div class="lh-box"><h3 style="--c:${COLORS[s.level]}"><i></i>${esc(t.title)}: ${esc(t.level[s.level])}</h3>`;
  html += row(t.internet, esc(online ? t.on : t.off), online ? 'lh-ok' : 'lh-bad');
  html += row(t.db, dbVal, dbCls);
  html += row(t.data, dataVal, dataCls);
  html += row(t.pnbase, pn && pn.rows ? esc(pn.rows + ' ' + t.rows + ' ' + (pn.lastSync ? new Date(pn.lastSync).toLocaleString() : '-')) : esc(t.never));
  html += row(t.queue, String(q), q ? 'lh-warn' : '');
  html += row(t.version, esc(BUILD));
  html += row(t.device, esc(deviceId() + ' · ' + browserInfo()));
  html += `<input class="lh-name" maxlength="40" placeholder="${esc(t.devNamePh)}" value="${esc(deviceName())}" aria-label="${esc(t.devName)}">`;

  html += `<div class="lh-sec">${esc(t.errors)} (${log.length})</div><div class="lh-errs">`;
  html += log.length
    ? log.slice(0, 15).map(e => `<div class="lh-err"><b>${esc(hhmmss(e.t))}</b> [${esc(e.page || '')}] ${esc(e.msg)}${e.n > 1 ? ' ×' + e.n : ''}</div>`).join('')
    : `<div class="lh-err">${esc(t.noErrors)}</div>`;
  html += '</div><div class="lh-btns">';
  if (standalone) html += `<span class="lh-hint">${esc(t.installed)}</span>`;
  else if (deferredInstall) html += `<button type="button" class="lh-b lh-main" data-act="install">${esc(t.install)}</button>`;
  html += `<button type="button" class="lh-b" data-act="copy">${esc(t.copy)}</button>`;
  html += `<button type="button" class="lh-b" data-act="clear">${esc(t.clear)}</button>`;
  html += `<button type="button" class="lh-b" data-act="close">${esc(t.close)}</button></div>`;
  if (!standalone && !deferredInstall && ios) html += `<div class="lh-hint">${esc(t.iosHint)}</div>`;
  html += '</div>';
  overlay.innerHTML = html;

  const name = overlay.querySelector('.lh-name');
  name.addEventListener('change', () => { lsSet(NAME_KEY, name.value.trim()); });
  overlay.querySelectorAll('button[data-act]').forEach(b => b.addEventListener('click', () => onAction(b.dataset.act, b)));
}

function reportText() {
  const head = ['LCDR HUB ' + BUILD, 'device: ' + deviceId() + (deviceName() ? ' (' + deviceName() + ')' : ''),
    browserInfo(), new Date().toLocaleString()];
  const lines = readLog().map(e => new Date(e.t).toLocaleString() + ' [' + (e.page || '') + '] ' + e.type + ': ' + e.msg +
    (e.src ? ' @' + e.src : '') + (e.n > 1 ? ' x' + e.n : ''));
  return head.concat(lines.length ? lines : ['no errors']).join('\n');
}

async function onAction(act, b) {
  if (act === 'close') return closePanel();
  if (act === 'clear') { writeLog([]); refresh(); renderPanel(); return; }
  if (act === 'copy') {
    try { await navigator.clipboard.writeText(reportText()); b.textContent = tx().copied; }
    catch (e) { b.textContent = '!'; }
    return;
  }
  if (act === 'install' && deferredInstall) {
    deferredInstall.prompt();
    try { await deferredInstall.userChoice; } catch (e) {}
    deferredInstall = null;
    renderPanel();
  }
}

/* ---------- Перехват ошибок: ставится сразу при импорте (это единственное исключение из правила 2) ---------- */
window.addEventListener('error', (e) => {
  const t = e.target;
  if (t && t !== window && (t.src || t.href)) { pushErr('resource', 'Не загрузился файл: ' + (t.src || t.href)); return; }
  pushErr('error', e.message, (e.filename || '').split('/').pop() + ':' + (e.lineno || 0));
}, true);

window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason;
  pushErr('promise', r && r.message ? r.message : fmt(r));
});

const origConsoleError = console.error;
console.error = function () {
  try { pushErr('console', Array.prototype.map.call(arguments, fmt).join(' ')); } catch (e) {}
  return origConsoleError.apply(console, arguments);
};

window.lcdrLog = (msg, src) => pushErr('manual', msg, src);
window.lcdrHealth = { compute, readLog, ping, BUILD };

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; refresh(); });
window.addEventListener('appinstalled', () => { deferredInstall = null; refresh(); });
window.addEventListener('online', () => { ping(); sendRemote(); });
window.addEventListener('offline', refresh);
document.addEventListener('visibilitychange', () => { if (!document.hidden) ping(); });

function start() {
  mount();
  setTimeout(ping, 3000);
  setInterval(() => { if (!document.hidden) ping(); else refresh(); }, PING_MS);
  setInterval(sendRemote, 30000);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
