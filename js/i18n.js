/* ==========================================================
   LCDR HUB v2 — общий модуль языка (ES-модуль).
   Один источник правды для языка сайта: здесь хранится выбранный язык,
   рассылается его смена и даётся функция перевода для любого модуля.

   Как пользоваться в модуле:
     import { createTranslator, onLangChange, getLang } from '../i18n.js';
     const t = createTranslator({ en: { ok: 'OK' }, uk: { ok: 'Гаразд' } });
     onLangChange(() => { applyText(); render(); });   // перерисовать при смене языка
     t('ok')            // строка на текущем языке, если ключа нет — английская
     t('n', { n: 5 })   // подстановка {n}

   Добавляя язык: добавьте его в LANG_NAMES и в SITE (меню), а модули, где нет
   перевода, автоматически покажут английский.
   ========================================================== */

export const DEFAULT_LANG = 'en';
const STORAGE_KEY = 'siteLang';

// Языки сайта (порядок = порядок флагов). Остальные языки убраны: сохранённый
// ранее язык, которого нет в списке, заменяется английским
export const LANG_NAMES = {
  uk: 'Українська',
  pl: 'Polski',
  en: 'English'
};

// Тексты меню, вкладок и служебные надписи сайта
export const SITE = {
  en: { print:"Print", final1:"Final inspection station I", final2:"Final inspection station II", special:"Special Label", panelLabel:"Panel Label", repairCenter:"LCD Repair Center", statDay:"Statistic per day", stats:"Statistic", repairBase:"LCD Repair Center Base", secret:"Repair Log", photo:"Photo", panelsn:"Filter", close:"Close", menu:"Menu", language:"Language", pick:"Select a page in the menu on the left", pending:"Content of “{t}” has not been added yet" },
  uk: { print:"Друк", final1:"Фінальна станція контролю I", final2:"Фінальна станція контролю II", special:"Спеціальна етикетка", panelLabel:"Панельна етикетка", repairCenter:"Центр ремонту LCD", statDay:"Статистика за днями", stats:"Статистика", repairBase:"База Центру ремонту LCD", secret:"Журнал ремонту", photo:"Фото", panelsn:"Фільтр ", close:"Закрити", menu:"Меню", language:"Мова", pick:"Оберіть сторінку в меню ліворуч", pending:"Вміст сторінки «{t}» ще не додано" },
  pl: { print:"Druk", final1:"Stacja końcowej kontroli I", final2:"Stacja końcowej kontroli II", special:"Etykieta specjalna", panelLabel:"Etykieta panelu", repairCenter:"Centrum naprawy LCD", statDay:"Statystyka dzienna", stats:"Statystyka", repairBase:"Baza centrum naprawy LCD", secret:"Dziennik napraw", photo:"Zdjęcie", panelsn:"Filtr ", close:"Zamknij", menu:"Menu", language:"Język", pick:"Wybierz stronę w menu po lewej", pending:"Treść strony «{t}» nie została jeszcze dodana" }
};

/* ---------- Состояние языка ---------- */

let current = DEFAULT_LANG;
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && LANG_NAMES[saved]) current = saved;
} catch (e) {}
try { document.documentElement.lang = current; } catch (e) {}

const listeners = new Set();

// Текущий язык сайта
export const getLang = () => current;

// Меняет язык сайта и оповещает все подписанные модули
export function setLang(next) {
  if (!LANG_NAMES[next]) next = DEFAULT_LANG;
  current = next;
  try { localStorage.setItem(STORAGE_KEY, current); } catch (e) {}
  document.documentElement.lang = current;
  listeners.forEach((fn) => {
    try { fn(current); } catch (e) { console.error(e); }
  });
}

// Подписка на смену языка. Возвращает функцию отписки
export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ---------- Перевод ---------- */

// Язык из списка поддерживаемых модулем, иначе английский.
// Пример: resolveLang(['uk', 'pl', 'en'])
export function resolveLang(supported) {
  return supported.includes(current) ? current : DEFAULT_LANG;
}

// Весь словарь модуля для текущего языка (английский, если языка нет).
// Нужен там, где словарь содержит вложенные объекты
export function pick(dict) {
  return dict[current] || dict[DEFAULT_LANG] || {};
}

// Создаёт функцию t(ключ, {подстановки}) для словаря вида { en: {...}, uk: {...} }.
// Нет ключа в языке — берётся английский, нет и там — возвращается сам ключ.
export function createTranslator(dict) {
  return function t(key, vars) {
    const d = dict[current] || dict[DEFAULT_LANG] || {};
    let s = d[key];
    if (s === undefined) s = (dict[DEFAULT_LANG] || {})[key];
    if (s === undefined) s = key;
    if (vars && typeof s === 'string') {
      for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    }
    return s;
  };
}

// Перевод текстов самого сайта (меню, вкладки)
export const t = createTranslator(SITE);
