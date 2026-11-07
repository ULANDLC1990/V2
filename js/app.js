/* ==========================================================
   LCDR HUB v2 — оболочка сайта: меню, вкладки, переключатель языка.
   Модули страниц сюда не «вшиваются»: main.js передаёт их в initApp(),
   а оболочка вызывает у них show() / hide() при открытии и закрытии страницы.

   Добавляя новую страницу:
   1) добавьте её в PAGES (key — ключ названия в SITE из i18n.js, container — id секции из index.html)
   2) добавьте пункт меню в index.html (с data-page="ваш_id") и секцию-контейнер в <main>
   3) создайте модуль js/pages/имя.js с экспортами init() и, если нужно, show() / hide()
   4) подключите его в main.js
   ========================================================== */
import { LANG_NAMES, getLang, setLang, onLangChange, t } from './i18n.js';

// Страницы сайта. key — ключ названия в SITE; container — секция в index.html
// dateTitle — вместо названия показывается текущая дата (например, 18.10.2026), обновляется сама
export const PAGES = {
  final1:  { key: 'final1',     container: 'final1Page' },
  final2:  { key: 'final2',     container: 'final2Page' },
  special: { key: 'special',    container: 'specialPage' },
  label:   { key: 'panelLabel', container: 'labelPage' },
  live:    { key: 'statDay',    container: 'livePage', dateTitle: true },
  stats:   { key: 'stats',      container: 'statsPage' },
  parts:   { key: 'repairBase', container: 'pnbasePage' },
  photo:   { key: 'photo',      container: 'photoPage' },
  panelsn: { key: 'panelsn',    container: 'panelsnPage' },
  secret:  { key: 'secret',     container: 'secretPage' }
};

// Сегодняшняя дата в формате ДД.ММ.ГГГГ, например 18.10.2026
function todayDisplay() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/* modules: { id страницы -> { init(), show?(), hide?() } }.
   Оболочка вызывает show() каждый раз, когда страницу открывают, и hide(), когда с неё уходят. */
export function initApp(modules = {}) {
  const app        = document.getElementById('app');
  const menuToggle = document.getElementById('menuToggle');
  const tabsEl     = document.getElementById('tabs');
  const contentEl  = document.getElementById('content');
  const titleEl    = document.getElementById('pageTitle');

  // При загрузке сайта вкладок нет — пользователь открывает их сам из меню
  const state = { openTabs: [], active: null };
  let shownId = null;
  let lastShownDate = todayDisplay();

  /* ---------- Язык ---------- */

  const langSelect = document.createElement('select');
  langSelect.className = 'lang-select';
  langSelect.innerHTML = Object.entries(LANG_NAMES)
    .map(([code, name]) => `<option value="${code}">${name}</option>`)
    .join('');
  document.querySelector('.topbar').appendChild(langSelect);

  function pageTitle(id) {
    const page = PAGES[id];
    return page.dateTitle ? todayDisplay() : t(page.key);
  }

  // Переводит статичные надписи меню и верхней панели
  function applySiteText() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      // Пункт «Statistic per day» показывает текущую дату вместо текста
      el.textContent = el.dataset.i18n === 'statDay' ? todayDisplay() : t(el.dataset.i18n);
    });
    menuToggle.setAttribute('aria-label', t('menu'));
    langSelect.title = t('language');
    langSelect.value = getLang();
  }

  /* ---------- Отрисовка ---------- */

  function render() {
    renderTabs();
    renderNav();
    renderContent();
    titleEl.textContent = state.active ? pageTitle(state.active) : '';
  }

  function renderTabs() {
    tabsEl.innerHTML = '';
    state.openTabs.forEach((id) => {
      const tab = document.createElement('div');
      tab.className = 'tab' + (id === state.active ? ' active' : '');
      tab.dataset.id = id;
      tab.innerHTML = `<span class="tab-title">${pageTitle(id)}</span><span class="close" title="${t('close')}">✕</span>`;
      tabsEl.appendChild(tab);
    });
  }

  function renderNav() {
    document.querySelectorAll('.nav-item[data-page]').forEach((item) => {
      item.classList.toggle('active', item.dataset.page === state.active);
    });
  }

  function renderContent() {
    // Со страницы ушли: даём модулю остановить фоновую работу (например, камеру на Photo)
    if (shownId && shownId !== state.active) {
      const m = modules[shownId];
      if (m && m.hide) m.hide();
    }
    shownId = state.active;

    // Контейнеры страниц не пересоздаются, поэтому их состояние сохраняется
    Object.values(PAGES).forEach((p) => {
      const el = document.getElementById(p.container);
      if (el) el.style.display = 'none';
    });

    const page = state.active ? PAGES[state.active] : null;
    const container = page && document.getElementById(page.container);
    if (container) {
      contentEl.style.display = 'none';
      container.style.display = 'block';
      return;
    }

    contentEl.style.display = 'flex';
    contentEl.innerHTML = state.active
      ? `<div class="empty"><div class="empty-icon">📄</div><p>${t('pending', { t: pageTitle(state.active) })}</p></div>`
      : `<div class="empty"><div class="empty-icon">🗂️</div><p>${t('pick')}</p></div>`;
  }

  /* ---------- Действия ---------- */

  // Делает страницу активной и сообщает об этом её модулю
  function activate(id) {
    state.active = id;
    render();
    const m = id && modules[id];
    if (m && m.show) m.show();
  }

  // Открывается одна страница, предыдущая закрывается
  function openPage(id) {
    if (!PAGES[id]) return;
    state.openTabs = [id];
    activate(id);
  }

  function closePage(id) {
    state.openTabs = state.openTabs.filter((tab) => tab !== id);
    if (state.active === id) activate(state.openTabs[state.openTabs.length - 1] || null);
    else render();
  }

  /* ---------- Обработчики событий ---------- */

  menuToggle.addEventListener('click', () => app.classList.toggle('collapsed'));

  document.querySelectorAll('.nav-parent').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('open');
      btn.nextElementSibling.classList.toggle('open');
    });
  });

  document.querySelectorAll('.nav-item[data-page]').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      openPage(item.dataset.page);
    });
  });

  tabsEl.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    const id = tab.dataset.id;
    if (e.target.classList.contains('close')) closePage(id);
    else activate(id);
  });

  langSelect.addEventListener('change', (e) => setLang(e.target.value));

  // Смена языка из любого места (список, флаги на телефоне): обновляем меню и заголовки
  onLangChange(() => { applySiteText(); render(); });

  // Страница может попросить закрыть себя (Repair Log при скрытии по Alt+Q)
  document.addEventListener('lcdr:close-page', (e) => closePage(e.detail));

  // Скрытая вкладка Repair Log: показывается и прячется по Alt+Q
  document.addEventListener('keydown', (e) => {
    if (!(e.altKey && (e.key === 'q' || e.key === 'Q' || e.code === 'KeyQ'))) return;
    e.preventDefault();
    const tab = document.getElementById('secretTab');
    if (!tab) return;
    const hide = tab.style.display !== 'none';
    tab.style.display = hide ? 'none' : '';
    if (hide && state.active === 'secret') closePage('secret');
  });

  // Проверка смены дня: если наступила полночь, дата в меню и на вкладке обновляется сама
  setInterval(() => {
    const now = todayDisplay();
    if (now !== lastShownDate) {
      lastShownDate = now;
      applySiteText();
      render();
    }
  }, 30000);

  /* ---------- Старт ---------- */

  if (window.innerWidth < 700) app.classList.add('collapsed');

  applySiteText();
  render();

  return { openPage, closePage };
}
