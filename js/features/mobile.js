/* Телефон: меню (свайп), флаги языков, прокрутка таблиц, классы для css/style.css (раздел «Телефон»).
   Вызывается из main.js сразу после initApp (нужен список языков .lang-select из app.js).
   Порог 700 пикселей такой же, как в app.js (там меню закрывается после выбора страницы). */

// Флаги языков в правом верхнем углу. Убрать язык: удалить строку. 'RU' показывается текстом, не флагом

export function init() {
  const app = document.getElementById('app');
  if (!app) return;
  const root = document.documentElement;

  /* ---------- Тип устройства ---------- */
  const coarse = () => !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  // Телефон с сенсорным экраном: короткая сторона экрана меньше 600 (в портрете и в повороте)
  const touchPhone = () => coarse() && Math.min(window.innerWidth, window.innerHeight) < 600;
  const isPhone = () => window.innerWidth < 700 || touchPhone();
  const isOpen = () => !app.classList.contains('collapsed');

  function setClasses() {
    root.classList.toggle('is-phone', isPhone());
    root.classList.toggle('touch-phone', touchPhone());
  }
  setClasses();
  window.addEventListener('resize', setClasses);
  window.addEventListener('orientationchange', () => setTimeout(setClasses, 200));

  /* ---------- Меню ---------- */
  // Затемнение страницы. Лежит внутри #app, чтобы быть в одном слое с меню
  const backdrop = document.createElement('div');
  backdrop.id = 'menuBackdrop';
  app.insertBefore(backdrop, app.firstChild);
  backdrop.addEventListener('click', () => app.classList.add('collapsed'));

  // По умолчанию меню открыто и закрывает страницу: на телефоне при запуске закрываем его
  if (isPhone()) app.classList.add('collapsed');

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isPhone()) app.classList.add('collapsed');
  });

  // Свайпы. Открыть: потянуть вправо, начав в левой трети экрана. Закрыть: потянуть влево при открытом меню.
  // Если палец начал движение внутри таблицы, которую уже прокрутили вправо, это прокрутка таблицы, меню не трогаем.
  const ZONE = 0.3, MIN_DX = 60, MAX_MS = 800;
  let sx = 0, sy = 0, st = 0, track = false;

  function inScrolledTable(el) {
    for (; el && el !== document.body && el.nodeType === 1; el = el.parentNode) {
      const ov = window.getComputedStyle(el).overflowX;
      if ((ov === 'auto' || ov === 'scroll') && el.scrollWidth > el.clientWidth && el.scrollLeft > 0) return true;
    }
    return false;
  }

  document.addEventListener('touchstart', (e) => {
    // При приближении щипком палец двигает страницу, а не открывает меню
    if (!isPhone() || e.touches.length !== 1 || (window.visualViewport && window.visualViewport.scale > 1.05)) { track = false; return; }
    const t = e.touches[0];
    sx = t.clientX; sy = t.clientY; st = Date.now();
    track = isOpen() ? true : (sx < window.innerWidth * ZONE && !inScrolledTable(e.target));
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!track) return;
    track = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Date.now() - st > MAX_MS || Math.abs(dx) < MIN_DX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx > 0 && !isOpen()) app.classList.remove('collapsed');
    else if (dx < 0 && isOpen()) app.classList.add('collapsed');
  }, { passive: true });

  /* ---------- Щипок двумя пальцами ---------- */
  // Приближать можно. Уменьшать страницу меньше экрана нельзя: вокруг неё появляется белое поле браузера
  const vv = window.visualViewport;
  if (vv) {
    let startScale = 1;
    document.addEventListener('gesturestart', () => { startScale = vv.scale; }, { passive: false });
    document.addEventListener('gesturechange', (e) => {
      if (touchPhone() && e.scale && startScale * e.scale < 1) e.preventDefault();
    }, { passive: false });

    // Если страница всё же стала меньше экрана, на мгновение фиксируем масштаб 1 и возвращаем прежние настройки
    let zoomTimer = null;
    const resetZoom = () => {
      const meta = document.querySelector('meta[name="viewport"]');
      if (!meta) return;
      const orig = meta.getAttribute('content') || '';
      const base = orig.replace(/,?\s*(maximum|minimum)-scale=[^,]*/g, '');
      meta.setAttribute('content', base + ', maximum-scale=1, minimum-scale=1');
      setTimeout(() => meta.setAttribute('content', orig), 350);
    };
    vv.addEventListener('resize', () => {
      if (!touchPhone()) return;
      clearTimeout(zoomTimer);
      zoomTimer = setTimeout(() => { if (vv.scale < 0.99) resetZoom(); }, 300);
    });
  }

  /* ---------- Таблицы: каждая прокручивается сама ---------- */
  // Таблица шире экрана, а её родитель не прокручивается: оборачиваем, чтобы вбок двигалась только она, а не вся страница
  function scanTables() {
    if (!touchPhone()) return;
    Array.prototype.forEach.call(document.querySelectorAll('main table'), (tb) => {
      if (tb.closest('.tbl-scroll')) return;
      const p = tb.parentElement;
      if (!p) return;
      const ov = window.getComputedStyle(p).overflowX;
      if (ov === 'auto' || ov === 'scroll') return;           // уже прокручивается отдельно
      if (tb.offsetWidth <= p.clientWidth + 1) return;         // помещается
      const wrap = document.createElement('div');
      wrap.className = 'tbl-scroll';
      p.insertBefore(wrap, tb);
      wrap.appendChild(tb);
    });
  }
  let scanTimer = null;
  const scheduleScan = () => { clearTimeout(scanTimer); scanTimer = setTimeout(scanTables, 150); };
  new MutationObserver(scheduleScan).observe(document.querySelector('main') || document.body, { childList: true, subtree: true });
  window.addEventListener('resize', scheduleScan);
  scheduleScan();
}
