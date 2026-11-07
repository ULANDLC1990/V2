/* Мелкие общие функции (раньше были скопированы в каждом файле). */

// Экранирование текста для подстановки в innerHTML
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Разбор CSV (кавычки, переносы строк внутри ячеек)
export function parseCSV(str) {
  const arr = [];
  let quote = false;
  for (let row = 0, col = 0, c = 0; c < str.length; c++) {
    const cc = str[c], nc = str[c + 1];
    arr[row] = arr[row] || [];
    arr[row][col] = arr[row][col] || '';
    if (cc === '"' && quote && nc === '"') { arr[row][col] += cc; c++; continue; }
    if (cc === '"') { quote = !quote; continue; }
    if (cc === ',' && !quote) { col++; continue; }
    if (cc === '\r' && nc === '\n' && !quote) { row++; col = 0; c++; continue; }
    if ((cc === '\n' || cc === '\r') && !quote) { row++; col = 0; continue; }
    arr[row][col] += cc;
  }
  return arr;
}

// Запасной способ копирования, если буфер обмена недоступен
export function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);
}

// Копирование в буфер обмена без уведомления (при отказе браузера — запасной способ)
export function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  }
  fallbackCopy(text);
  return Promise.resolve();
}

// Поле ввода, в котором пользователь печатает текст: горячие клавиши там не работают
export function isTyping(target) {
  return !!(target && target.matches && target.matches('input, textarea, select, [contenteditable]'));
}

// Дата в формате yyyy-mm-dd по местному времени (без сдвига через UTC)
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// localStorage, который не падает в приватном режиме
export function lsGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
export function lsSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
}
