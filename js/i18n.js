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

// 10 языков. Названия в списке показываются на родном языке
export const LANG_NAMES = {
  en: 'English',
  uk: 'Українська',
  ru: 'Русский',
  pl: 'Polski',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  pt: 'Português',
  tr: 'Türkçe'
};

// Тексты меню, вкладок и служебные надписи сайта
export const SITE = {
  en: { print:"Print", final1:"Final inspection station I", final2:"Final inspection station II", special:"Special Label", panelLabel:"Panel Label", repairCenter:"LCD Repair Center", statDay:"Statistic per day", stats:"Statistic", repairBase:"LCD Repair Center Base", secret:"Repair Log", photo:"Photo", panelsn:"Filter", close:"Close", menu:"Menu", language:"Language", pick:"Select a page in the menu on the left", pending:"Content of “{t}” has not been added yet" },
  uk: { print:"Друк", final1:"Фінальна станція контролю I", final2:"Фінальна станція контролю II", special:"Спеціальна етикетка", panelLabel:"Панельна етикетка", repairCenter:"Центр ремонту LCD", statDay:"Статистика за днями", stats:"Статистика", repairBase:"База Центру ремонту LCD", secret:"Журнал ремонту", photo:"Фото", panelsn:"Фільтр ", close:"Закрити", menu:"Меню", language:"Мова", pick:"Оберіть сторінку в меню ліворуч", pending:"Вміст сторінки «{t}» ще не додано" },
  ru: { print:"Печать", final1:"Финальная станция контроля I", final2:"Финальная станция контроля II", special:"Специальная этикетка", panelLabel:"Панельная этикетка", repairCenter:"Центр ремонта LCD", statDay:"Статистика по дням", stats:"Статистика", repairBase:"База центра ремонта LCD", secret:"Журнал ремонта", photo:"Фото", panelsn:"Фильтр ", close:"Закрыть", menu:"Меню", language:"Язык", pick:"Выберите страницу в меню слева", pending:"Содержимое страницы «{t}» ещё не добавлено" },
  pl: { print:"Druk", final1:"Stacja końcowej kontroli I", final2:"Stacja końcowej kontroli II", special:"Etykieta specjalna", panelLabel:"Etykieta panelu", repairCenter:"Centrum naprawy LCD", statDay:"Statystyka dzienna", stats:"Statystyka", repairBase:"Baza centrum naprawy LCD", secret:"Dziennik napraw", photo:"Zdjęcie", panelsn:"Filtr ", close:"Zamknij", menu:"Menu", language:"Język", pick:"Wybierz stronę w menu po lewej", pending:"Treść strony «{t}» nie została jeszcze dodana" },
  de: { print:"Drucken", final1:"Endkontrollstation I", final2:"Endkontrollstation II", special:"Spezialetikett", panelLabel:"Panel-Etikett", repairCenter:"LCD-Reparaturzentrum", statDay:"Tagesstatistik", stats:"Statistik", repairBase:"LCD-Reparaturzentrum Basis", secret:"Reparaturprotokoll", photo:"Foto", panelsn:"Filter", close:"Schließen", menu:"Menü", language:"Sprache", pick:"Wählen Sie links im Menü eine Seite aus", pending:"Inhalt von „{t}“ wurde noch nicht hinzugefügt" },
  fr: { print:"Impression", final1:"Station d'inspection finale I", final2:"Station d'inspection finale II", special:"Étiquette spéciale", panelLabel:"Étiquette panneau", repairCenter:"Centre de réparation LCD", statDay:"Statistiques par jour", stats:"Statistiques", repairBase:"Base du centre de réparation LCD", secret:"Journal de réparation", photo:"Photo", panelsn:"Filtre", close:"Fermer", menu:"Menu", language:"Langue", pick:"Sélectionnez une page dans le menu à gauche", pending:"Le contenu de « {t} » n'a pas encore été ajouté" },
  es: { print:"Impresión", final1:"Estación de inspección final I", final2:"Estación de inspección final II", special:"Etiqueta especial", panelLabel:"Etiqueta de panel", repairCenter:"Centro de reparación LCD", statDay:"Estadística por día", stats:"Estadística", repairBase:"Base del centro de reparación LCD", secret:"Registro de reparación", photo:"Foto", panelsn:"Filtro", close:"Cerrar", menu:"Menú", language:"Idioma", pick:"Seleccione una página en el menú de la izquierda", pending:"El contenido de «{t}» aún no se ha añadido" },
  it: { print:"Stampa", final1:"Stazione di ispezione finale I", final2:"Stazione di ispezione finale II", special:"Etichetta speciale", panelLabel:"Etichetta pannello", repairCenter:"Centro riparazione LCD", statDay:"Statistiche giornaliere", stats:"Statistiche", repairBase:"Base centro riparazione LCD", secret:"Registro riparazioni", photo:"Foto", panelsn:"Filtro", close:"Chiudi", menu:"Menu", language:"Lingua", pick:"Seleziona una pagina dal menu a sinistra", pending:"Il contenuto di «{t}» non è ancora stato aggiunto" },
  pt: { print:"Impressão", final1:"Estação de inspeção final I", final2:"Estação de inspeção final II", special:"Etiqueta especial", panelLabel:"Etiqueta de painel", repairCenter:"Centro de reparo LCD", statDay:"Estatísticas por dia", stats:"Estatísticas", repairBase:"Base do centro de reparo LCD", secret:"Registro de reparos", photo:"Foto", panelsn:"Filtro", close:"Fechar", menu:"Menu", language:"Idioma", pick:"Selecione uma página no menu à esquerda", pending:"O conteúdo de «{t}» ainda não foi adicionado" },
  tr: { print:"Yazdırma", final1:"Son kontrol istasyonu I", final2:"Son kontrol istasyonu II", special:"Özel etiket", panelLabel:"Panel etiketi", repairCenter:"LCD Onarım Merkezi", statDay:"Günlük istatistik", stats:"İstatistik", repairBase:"LCD Onarım Merkezi Veritabanı", secret:"Onarım günlüğü", photo:"Fotoğraf", panelsn:"Filtresi", close:"Kapat", menu:"Menü", language:"Dil", pick:"Soldaki menüden bir sayfa seçin", pending:"«{t}» sayfasının içeriği henüz eklenmedi" }
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
