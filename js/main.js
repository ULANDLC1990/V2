/* ==========================================================
   LCDR HUB v2 — точка входа. Подключает оболочку и модули страниц.
   Порядок init() важен там, где один модуль достраивает страницу другого:
   manual — после final, collapse — после label / pnbase / special.
   Сбой одного модуля не должен ронять остальные, поэтому каждый init() в try/catch
   (ошибка попадёт в журнал health.js через console.error).
   ========================================================== */
import { initApp } from './app.js';
import { startPnCache } from './core/pncache.js';

import { final1, final2 } from './pages/final.js';
import * as label from './pages/label.js';
import * as pnbase from './pages/pnbase.js';
import * as special from './pages/special.js';
import * as live from './pages/livedata.js';
import * as stats from './pages/statistic.js';
import * as repairlog from './pages/repairlog.js';
import * as photo from './pages/photo.js';
import * as panelsn from './pages/panelsn.js';

import * as manual from './features/manual.js';
import * as collapse from './features/collapse.js';
import * as mobile from './features/mobile.js';

// id страницы (ключ PAGES в app.js) -> модуль
const pages = {
  final1, final2, special, label,
  live, stats, parts: pnbase,
  photo, panelsn, secret: repairlog
};

function safe(name, fn) {
  try { fn(); } catch (e) { console.error(`${name}: ${e && e.message ? e.message : e}`); }
}

initApp(pages);
safe('mobile', () => mobile.init());

// База PN на устройстве (печать без интернета)
safe('pncache', startPnCache);

// Страницы
[
  ['final1', final1], ['final2', final2], ['label', label], ['pnbase', pnbase], ['special', special],
  ['live', live], ['stats', stats], ['repairlog', repairlog], ['photo', photo], ['panelsn', panelsn]
].forEach(([name, m]) => safe(name, () => m.init()));

// Надстройки над готовыми страницами
safe('manual', () => manual.init());
safe('collapse', () => collapse.init({ labelPage: label.show }));

// Работа без интернета: сохраняет сайт на устройстве
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
