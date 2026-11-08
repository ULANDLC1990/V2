# LCDR HUB v2 — переход на ES-модули и общий i18n

Цель: убрать глобальные переменные и зависимость от порядка `<script>`, вынести общий язык в `js/i18n.js`.
Поведение сайта при этом **не меняется** — это чистый рефакторинг. Старый сайт остаётся как есть.

## Структура

```
index.html            два <script type="module">: health.js (первым) и main.js
sw.js                 кэш lcdr-hub-v2-esm-1, обновлён список файлов
js/
  main.js             точка входа: импортирует страницы, вызывает init() в нужном порядке
  app.js              оболочка: меню, вкладки, список языков, Alt+Q (экспорт PAGES, initApp)
  i18n.js             ЯЗЫК: getLang/setLang/onLangChange, createTranslator, pick, resolveLang, SITE
  health.js           индикатор состояния и журнал ошибок (самостоятельный модуль)
  core/
    config.js         APP_CONFIG
    supabase.js       sb() общий клиент, hasSupabase(), createIsolatedClient(opts)
    util.js           esc, parseCSV, copyText, fallbackCopy, isTyping, localDate, lsGet, lsSet
    print.js          PRINT_CSS, barcodeSvg, stdPages, newPages, printInFrame, printDoc, printList
    sheets.js         rows(sheetName, spreadsheetId, gid) — чтение Google Таблиц
    diagonals.js      PREFIX, SUFFIX, fromSerial
    pncache.js        база PN в IndexedDB: TV, fromBase, localPn, pnbRemember, pnbInfo, startPnCache
  pages/              final, label, pnbase, special, livedata, statistic, repairlog, photo, panelsn
  features/           manual, collapse, mobile (достраивают чужие страницы / DOM)
```

## Правила (для всех модулей)

1. **Никаких `window.xxx`** для связи между модулями. Только `import` / `export`.
   Допустимые глобалы — только библиотеки с CDN: `window.supabase`, `window.JsBarcode`, `window.XLSX`.
   Для отладки из консоли разрешены `window.lcdrLog` и `window.lcdrHealth` (в health.js).
2. **Модуль не делает работу при импорте.** Весь код, который трогает DOM или запускает таймеры,
   лежит в `export function init()`. Импорт модуля ничего не создаёт.
3. **Контракт страницы:**
   ```js
   export function init() {}   // один раз при старте: построить DOM в контейнере, повесить обработчики
   export function show() {}   // необязательно: страницу открыли (оболочка зовёт при каждом открытии)
   export function hide() {}   // необязательно: со страницы ушли
   ```
   Оболочка (`app.js`) вызывает `show()` только когда страницу открывают (а не при смене языка).
4. **Язык:** никаких `window.setXxxLang`, `localStorage.getItem('siteLang')`, `document.documentElement.lang`.
   ```js
   import { createTranslator, onLangChange, getLang } from '../i18n.js';
   const t = createTranslator(DICT);          // DICT = { en: {...}, uk: {...}, ... } — словарь остаётся в модуле
   onLangChange(() => { applyText(); render(); });   // подписка внутри init()
   ```
   Начальный язык берётся из `getLang()`. Если у модуля нет какого-то из языков, английский подставится сам
   (`createTranslator` / `pick`). Если модуль поддерживает только часть языков и логика зависит от кода языка — `resolveLang(['uk','pl','en'])`.
5. **Supabase:** `import { sb } from '../core/supabase.js'` вместо `window.__lcdrSb` и своих `createClient`.
   Исключение — Photo (`createIsolatedClient`, отдельный клиент без сессии).
6. **Общий код** берётся из `core/*`: `esc`, `parseCSV`, `copyText`, печать (`printInFrame`, `stdPages`, …).
   Копии этих функций в модулях удаляются.
7. **Inline `onclick="..."` в разметке запрещены** (они требовали глобальных `pb`, `sb`). Вместо них —
   `data-act="..."` и `addEventListener` / делегирование.
8. Между страницами, которые раньше звали друг друга через window:
   - `window.printFinal2BySn` → `export async function printFinal2BySn(sn, offline)` в `pages/final.js`, repairlog импортирует её.
   - `window.lcdrPnBaseInfo` → `pnbInfo()` из `core/pncache.js`.
   - `window.siteClosePage('secret')` → `document.dispatchEvent(new CustomEvent('lcdr:close-page', { detail: 'secret' }))`.
   - `window.LCDR_SHEETS` → `import { rows } from '../core/sheets.js'`; `window.LCDR_DIAG` → `import { fromSerial } from '../core/diagonals.js'`.
   - `window.APP_CONFIG` → `import { APP_CONFIG } from '../core/config.js'`.
9. Логику, тексты, разметку, CSS и тайминги **не менять** (кроме перечисленного выше). Комментарии на русском сохранить.
10. Алгоритмы и идентификаторы DOM (`id`, классы) оставлять как есть — на них завязан `style.css`.

## Что изменилось в поведении (намеренно)

- Страницы вызываются через `show()` только при открытии (раньше `render()` дёргал `xxxShow` и при смене языка,
  из-за чего, например, на Photo камера перезапускалась при выборе другого языка).
- Alt+Q обрабатывается в одном месте (`app.js`), а не в index.html и repairlog.js.
- Язык хранится только в `siteLang`. Старые ключи `labelLang` и `pnbase_lang` больше не используются.
- `<title>` страницы заполнен.
- Языков три: uk, pl, en. Вместо выпадающего списка — флаги (SVG) в правом углу верхней панели на всех устройствах. Ранее сохранённый ru/de/… заменяется английским. Словари остальных языков в модулях остались, их можно удалить позже.

## Как запустить

Модули не работают с `file://`. Нужен любой статический сервер:

```
python3 -m http.server 8080      # затем открыть http://localhost:8080/
```

## Что осталось прежним (не трогали)

CDN-библиотеки без SRI и с плавающей версией `supabase-js@2`, `xlsx@0.18.5`; ключи и таблицы Supabase;
база данных общая с рабочим сайтом — **эксперименты, которые пишут в базу, меняют боевые данные**.
