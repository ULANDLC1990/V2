/* База PN на устройстве (для печати без интернета).
   Вся таблица televisions (серийник -> PN, бренд) хранится в IndexedDB этого устройства.
   Обновляется в фоне раз в час; кроме того, запоминается каждый PN, найденный при обычной работе.
   Раньше жила внутри final.js, а наружу выставлялась через window.lcdrPnBaseInfo. */
import { sb } from './supabase.js';

// Таблица телевизоров в Supabase и её колонки
export const TV = { TABLE: 'televisions', PN: 'tpv_pn', SN: 'panel_sn', BRAND: 'brand' };

const PNB_DB = 'lcdr-pnbase', PNB_STORE = 'kv', PNB_KEY = 'pnmap';
const PNB_FULL_MS = 3600 * 1000, PNB_PAGE = 1000;
const PNB = { map: new Map(), lastSync: 0, syncing: false, saveTimer: null, dbp: null };

function pnbIdb() {
  if (!PNB.dbp) {
    PNB.dbp = new Promise((res, rej) => {
      try {
        const r = indexedDB.open(PNB_DB, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(PNB_STORE);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
  }
  return PNB.dbp;
}

async function pnbGet() {
  try {
    const d = await pnbIdb();
    return await new Promise((res, rej) => {
      const q = d.transaction(PNB_STORE).objectStore(PNB_STORE).get(PNB_KEY);
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
  } catch (e) { return null; }
}

async function pnbPut() {
  try {
    const d = await pnbIdb();
    await new Promise((res, rej) => {
      const tx = d.transaction(PNB_STORE, 'readwrite');
      tx.objectStore(PNB_STORE).put({ t: PNB.lastSync, map: PNB.map }, PNB_KEY);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  } catch (e) {}
}

async function pnbLoad() {
  const v = await pnbGet();
  if (v && v.map instanceof Map) { PNB.map = v.map; PNB.lastSync = v.t || 0; }
}

// Найденный в базе PN запоминаем (сохранение на диск с задержкой, чтобы не писать на каждый серийник)
export function pnbRemember(sn, pn, brand) {
  if (!sn || !pn || pn === 'N/A') return;
  const k = String(sn).trim().toUpperCase();
  const cur = PNB.map.get(k);
  if (cur && cur[0] === pn && cur[1] === (brand || '-')) return;
  PNB.map.set(k, [pn, brand || '-']);
  clearTimeout(PNB.saveTimer);
  PNB.saveTimer = setTimeout(pnbPut, 20000);
}

// PN из базы на устройстве: { pn, brand } или null
export function fromBase(sn) {
  const v = PNB.map.get(String(sn || '').trim().toUpperCase());
  return v ? { pn: v[0], brand: v[1] || '-' } : null;
}

// Полная загрузка таблицы страницами по 1000 строк
async function pnbSync() {
  if (PNB.syncing || navigator.onLine === false) return;
  PNB.syncing = true;
  try {
    const map = new Map();
    for (let from = 0; ; from += PNB_PAGE) {
      const res = await Promise.race([
        sb().from(TV.TABLE).select(`${TV.SN},${TV.PN},${TV.BRAND}`)
          .order(TV.SN, { ascending: true }).range(from, from + PNB_PAGE - 1),
        new Promise((_, rej) => setTimeout(() => rej(new Error('network timeout')), 20000))
      ]);
      if (res.error) throw res.error;
      const d = res.data || [];
      d.forEach((r) => {
        if (r[TV.SN] && r[TV.PN]) map.set(String(r[TV.SN]).trim().toUpperCase(), [r[TV.PN], r[TV.BRAND] || '-']);
      });
      if (d.length < PNB_PAGE) break;
    }
    // то, что запомнили отдельно и чего нет в свежей загрузке, не теряем
    PNB.map.forEach((v, k) => { if (!map.has(k)) map.set(k, v); });
    PNB.map = map;
    PNB.lastSync = Date.now();
    await pnbPut();
  } catch (e) {
    // связи нет или сбой: попробуем позже
  } finally {
    PNB.syncing = false;
  }
}

const due = (ms) => Date.now() - PNB.lastSync > ms;

// Для индикатора состояния и журнала ремонта: сколько строк в базе и когда она обновлялась
export function pnbInfo() {
  return { rows: PNB.map.size, lastSync: PNB.lastSync };
}

// PN для TBV и TOV собирается по самому номеру, база не нужна (работает и без интернета).
// Возвращает { pn, brand } или null
export function localPn(sn) {
  const u = String(sn || '').toUpperCase();
  if (u.startsWith('TBV') && u.length >= 11) return { pn: `750${u.substring(0, 11)}N000`, brand: 'PHP[PHP]' };
  if (u.startsWith('TOV') && u.length >= 11) return { pn: `730${u.substring(0, 11)}N000`, brand: 'PHP[PHP]' };
  return null;
}

let started = false;

// Загрузка при старте, обновление раз в час и при возвращении связи. Безопасно вызывать повторно
export function startPnCache() {
  if (started) return;
  started = true;
  pnbLoad().then(() => {
    setTimeout(() => { if (due(PNB_FULL_MS)) pnbSync(); }, 5000);
  });
  setInterval(() => { if (due(PNB_FULL_MS)) pnbSync(); }, 5 * 60 * 1000);
  window.addEventListener('online', () => { if (due(10 * 60 * 1000)) pnbSync(); });
}
