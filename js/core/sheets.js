/* Чтение вкладок Google Таблицы по имени без ключа API (через gviz CSV).
   Таблица должна быть открыта «всем, у кого есть ссылка» (читатель).
   rows('Имя вкладки', 'ID таблицы (необязательно)', gid (необязательно)) -> массив строк,
   каждая строка — массив значений. Первая строка результата = первая строка вкладки. */
import { APP_CONFIG } from './config.js';
import { parseCSV } from './util.js';

export { parseCSV };

const ATTEMPTS = 3;
const RETRY_MS = 1500;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// rows('Имя вкладки')                          вкладка основной рабочей таблицы
// rows('Имя вкладки', 'ID таблицы')            вкладка другой таблицы
// rows(null, 'ID таблицы', gid)                вкладка другой таблицы по её gid
export async function rows(sheetName, spreadsheetId, gid) {
  const id = spreadsheetId || APP_CONFIG.SHEET_ID;
  const target = (gid !== undefined && gid !== null)
    ? `gid=${encodeURIComponent(gid)}`
    : `sheet=${encodeURIComponent(sheetName)}`;
  let lastErr = null;
  for (let i = 0; i < ATTEMPTS; i++) {
    try {
      // headers=1: первая строка вкладки остаётся строкой данных, а не склеивается с заголовком
      const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&headers=1&${target}&_nc=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
      return parseCSV(await res.text());
    } catch (e) {
      lastErr = e;
      if (i < ATTEMPTS - 1) await wait(RETRY_MS * (i + 1));
    }
  }
  throw lastErr;
}
