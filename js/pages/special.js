/* Спеціальні етикетки (Special Label): великий текст, рамка з 11 рядків, SCC та ICON.
   SCC-текст друкується на 50x30 мм, кількість комплектів діє тільки для SCC.
   ICON друкується окремою кнопкою на 49.5x24.5 мм, одна етикетка за натискання.
   Контейнер: <section id="specialPage">. Мова береться з загального i18n.js.
   Картинка ICON береться з файлу icon.jpg у корені сайту.
   Нижче також пісочниця етикетки RDL400FY (76x40 мм на аркуші 130x76 мм). */
import { esc } from '../core/util.js';
import { printInFrame, pageCss } from '../core/print.js';
import { createTranslator, onLangChange } from '../i18n.js';

const ICON_SRC = 'icon.jpg';
// true  - обрізати білі поля навколо малюнка (кольори та якість не змінюються)
// false - використовувати повний файл icon.jpg як є
const ICON_TRIM = true;

// Розміри друку (мм)
const SCC_WIDTH_MM = 49;
const SCC_LABEL_H = 30;       // висота етикетки SCC
const SCC_TEXT_H = 25;        // висота зони для тексту SCC
const SCC_TEXT_WIDTH_MM = 46;
const ICON_LABEL_W = 49.5;
const ICON_LABEL_H = 24.5;
const SCC_MAX_PT = 60, SCC_MIN_PT = 8, SCC_LINE_HEIGHT = 1.1;

const TR = {
  uk: { print: "🖨️ Друк", printScc: "🖨️ Друк SCC", printIcon: "🖨️ Друк ICON" },
  pl: { print: "🖨️ Drukuj", printScc: "🖨️ Drukuj SCC", printIcon: "🖨️ Drukuj ICON" },
  en: { print: "🖨️ Print", printScc: "🖨️ Print SCC", printIcon: "🖨️ Print ICON" }
};
const t = createTranslator(TR);

const MARKUP = `
<div class="manual-input-card">
  <div class="sp-row">
    <div class="form-group sp-grow">
      <input type="text" id="spBigText" class="form-input code-text" value="OK">
    </div>
    <div class="form-group">
      <select id="spBigSize" class="form-input">
        <option value="100x78">100 × 78 mm</option>
        <option value="80x68">80 × 68 mm</option>
        <option value="50x25">50 × 25 mm</option>
      </select>
    </div>
    <div class="form-group sp-end">
      <button class="btn btn-brand" id="spBtnText" data-sp="print"></button>
    </div>
  </div>
</div>

<div class="manual-input-card">
  <div class="sp-row">
    <div class="form-group sp-grow">
      <input type="text" id="spRepeat" class="form-input code-text" value="TRANSPORTATION FRAME">
    </div>
    <div class="form-group sp-end">
      <button class="btn btn-brand" id="spBtnRepeat" data-sp="print"></button>
    </div>
  </div>
</div>

<div class="manual-input-card">
  <div class="sp-line">
    <input type="checkbox" class="sp-check" id="spChk1">
    <input type="text" id="spVal1" class="form-input code-text">
  </div>
  <div class="sp-line">
    <input type="checkbox" class="sp-check" id="spChk2">
    <input type="text" id="spVal2" class="form-input code-text">
  </div>
  <div class="sp-foot">
    <button class="btn btn-brand" id="spBtnScc" data-sp="printScc"></button>
    <input type="number" id="spCopies" class="form-input" min="1" value="1">
    <button class="btn btn-brand" id="spBtnIcon" data-sp="printIcon"></button>
  </div>
</div>`;

const STYLE = `
#specialPage { width: 100%; max-width: 56rem; margin: 0 auto; }
#specialPage .sp-row { display: flex; flex-wrap: wrap; gap: 0.8rem; align-items: flex-end; }
#specialPage .sp-grow { flex: 1 1 14rem; min-width: 0; }
#specialPage .sp-end { justify-content: flex-end; }
#specialPage .sp-line { display: flex; align-items: center; gap: 0.7rem; margin-bottom: 0.6rem; flex-wrap: wrap; }
#specialPage .sp-line .form-input { flex: 1 1 12rem; min-width: 0; }
#specialPage .sp-check { width: 1.1rem; height: 1.1rem; accent-color: #2563EB; cursor: pointer; }
#specialPage .sp-foot { display: flex; justify-content: space-between; align-items: center; gap: 0.6rem; margin-top: 0.4rem; flex-wrap: wrap; }
#specialPage #spCopies { width: 5.5rem; text-align: center; }
`;

function applyText() {
  document.querySelectorAll('#specialPage [data-sp]').forEach(el => { el.textContent = t(el.dataset.sp); });
  const rd = document.getElementById('rdPrint');
  if (rd) rd.textContent = t('print');
}

// Текст у SCC переноситься по словах і підбирається до найбільшого розміру, що влазить у зону тексту
function buildWrappedText(text, textHmm) {
  const MM = 96 / 25.4;
  const maxW = SCC_TEXT_WIDTH_MM * MM, maxH = textHmm * MM;
  const words = text.split(/\s+/).filter(Boolean);
  const longest = words.reduce((a, b) => (b.length >= a.length ? b : a), '');

  const wordProbe = document.createElement('div');
  wordProbe.style.cssText = 'position:absolute;visibility:hidden;left:-9999px;top:0;white-space:nowrap;font-family:Arial,Helvetica,sans-serif;font-weight:900;';
  document.body.appendChild(wordProbe);

  const probe = document.createElement('div');
  probe.style.cssText = `position:absolute;visibility:hidden;left:-9999px;top:0;width:${SCC_TEXT_WIDTH_MM}mm;font-family:Arial,Helvetica,sans-serif;font-weight:900;text-align:center;line-height:${SCC_LINE_HEIGHT};`;
  probe.textContent = text;
  document.body.appendChild(probe);

  function fits(pt, anywhere) {
    if (!anywhere) {
      wordProbe.style.fontSize = pt + 'pt';
      wordProbe.textContent = longest;
      if (wordProbe.scrollWidth > maxW + 1) return false;
    }
    probe.style.fontSize = pt + 'pt';
    probe.style.overflowWrap = anywhere ? 'anywhere' : 'normal';
    return probe.scrollHeight <= maxH + 1 && probe.scrollWidth <= probe.clientWidth + 1;
  }
  function findFit(anywhere) {
    let lo = SCC_MIN_PT * 2, hi = SCC_MAX_PT * 2, best = null;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (fits(mid / 2, anywhere)) { best = mid / 2; lo = mid + 1; } else { hi = mid - 1; }
    }
    return best;
  }

  let pt = findFit(false);
  if (pt === null) pt = findFit(true);
  if (pt === null) pt = SCC_MIN_PT;

  document.body.removeChild(wordProbe);
  document.body.removeChild(probe);
  return `<div class="txt" style="font-size:${pt}pt">${esc(text)}</div>`;
}

// ===== ICON: файл icon.jpg використовується як є (або обрізається по малюнку).
let iconUrl = '';

function loadIcon() {
  const url = new URL(ICON_SRC, document.baseURI).href;
  const img = new Image();
  img.onload = () => {
    if (!ICON_TRIM) { iconUrl = url; return; }

    const sw = img.naturalWidth, sh = img.naturalHeight;
    const src = document.createElement('canvas');
    src.width = sw; src.height = sh;
    const sctx = src.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(img, 0, 0);
    const sd = sctx.getImageData(0, 0, sw, sh).data;

    // Шукаємо межі малюнка (тільки для обрізки, самі пікселі не змінюються)
    let minX = sw, minY = sh, maxX = -1, maxY = -1;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const i = (y * sw + x) * 4;
        const g = 0.299 * sd[i] + 0.587 * sd[i + 1] + 0.114 * sd[i + 2];
        if (g < 235) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) { iconUrl = url; return; }

    // Без запасу: обрізка точно по межах малюнка
    const cw = maxX - minX + 1, ch = maxY - minY + 1;

    const out = document.createElement('canvas');
    out.width = cw; out.height = ch;
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = false;
    octx.drawImage(src, minX, minY, cw, ch, 0, 0, cw, ch);
    iconUrl = out.toDataURL('image/png');
  };
  img.onerror = () => { iconUrl = ''; };
  img.src = url;
}

// ===== RDL400FY: пісочниця етикетки 76x40 мм на аркуші 130x76 мм (Code128 + підпис з номера) =====
function initRdl(host) {
  const KEY = 'spRdl_v1';
  const SET = ['aw','ah','preset','pw','ph','ox','oy','dw','dpi','mode','thr','guide','pm','gap','thick','bt'];
  const DEF = [
    { id: 'model', name: 'Model', text: 'RDL400FY', x: 48, y: 3, size: 3.2, bold: true, serif: false },
    { id: 'rev', name: 'Rev', text: '(QW0-003) Rev. 00', x: 45, y: 7.2, size: 2.8, bold: false, serif: false },
    { id: 'bc', name: 'Barcode + caption', text: 'WU0E02S2449F01000520', x: 5, y: 12, size: 12, mw: 2, capSize: 3.6, capGap: 1.2, capBold: true, capSerif: false, type: 'barcode' },
    { id: 'code', name: 'N012301-010205-002', text: 'N012301-010205-002', x: 5, y: 31, size: 3.2, bold: true, serif: false, fmt: true },
    { id: 'rohs', name: 'RoHS', text: 'RoHS', x: 62, y: 31, size: 2.8, bold: true, serif: false }
  ];
  let F; try { F = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  if (!F) F = JSON.parse(JSON.stringify(DEF));
  let S0 = {}; try { S0 = JSON.parse(localStorage.getItem(KEY + '_s') || '{}'); } catch (e) {}

  const st = document.createElement('style');
  st.textContent = `
#spRdl .rd-prev{display:flex;justify-content:center;padding:14px;overflow:auto;background:#000;border-radius:10px;margin-bottom:.8rem}
#spRdl #rdCv{background:#fff;border-radius:3px;flex:none;max-width:none}
#spRdl .rd-cfg{display:flex;flex-wrap:wrap;gap:.5rem;align-items:flex-end;margin-bottom:.8rem}
#spRdl .rd-cfg label{display:flex}
#spRdl .rd-cfg input,#spRdl .rd-cfg select{width:5.2rem}
#spRdl .rd-cfg select{width:auto}
#spRdl .rd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(14rem,1fr));gap:.7rem}
#spRdl .rd-mod{border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:.6rem;display:flex;flex-direction:column;gap:.4rem}
#spRdl .rd-nums{display:grid;grid-template-columns:1fr 1fr;gap:.4rem}
#spRdl .rd-mod input[type=text],#spRdl .rd-nums input{width:100%;box-sizing:border-box}
#spRdl .rd-chk{display:flex;gap:.8rem;font-size:.8rem;align-items:center;color:#E5E7EB}
`;
  document.head.appendChild(st);

  host.insertAdjacentHTML('beforeend', `
<div class="manual-input-card" id="spRdl">
<div class="rd-prev"><canvas id="rdCv"></canvas></div>
<div class="rd-cfg">
  <label>Area W<input class="form-input" type="number" id="rd_aw" value="76" step="0.5"></label>
  <label>Area H<input class="form-input" type="number" id="rd_ah" value="40" step="0.5"></label>
  <label>Sheet<select class="form-input" id="rd_preset"><option>130×76 mm</option><option>100×76 mm</option><option>76×40 mm</option></select></label>
  <label>W<input class="form-input" type="number" id="rd_pw" value="130"></label>
  <label>H<input class="form-input" type="number" id="rd_ph" value="76"></label>
  <label>X mm<input class="form-input" type="number" id="rd_ox" value="27" step="0.1"></label>
  <label>Y mm<input class="form-input" type="number" id="rd_oy" value="18" step="0.1"></label>
  <label>Dash px<input class="form-input" type="number" id="rd_dw" value="1" step="0.5"></label>
  <label>DPI<input class="form-input" type="number" id="rd_dpi" value="203"></label>
  <label>Mode<select class="form-input" id="rd_mode"><option value="bw">1-bit raster (recommended)</option><option value="gray">Grayscale</option></select></label>
  <label>Threshold<input class="form-input" type="number" id="rd_thr" value="165"></label>
  <label>Guides<select class="form-input" id="rd_guide"><option value="marks">Corner marks</option><option value="frame">Frame</option><option value="dash">Dashed only</option><option value="none">None</option></select></label>
  <label>Barcode<select class="form-input" id="rd_bt"><option value="CODE128B">Code128 B</option><option value="CODE39">Code39</option></select></label>
  <label>Print marks<select class="form-input" id="rd_pm"><option value="1">Yes</option><option value="0">No</option></select></label>
  <label>Mark gap<input class="form-input" type="number" id="rd_gap" value="1.5" step="0.1"></label>
  <label>Mark thick<input class="form-input" type="number" id="rd_thick" value="0.5" step="0.1"></label>
  <button class="btn btn-brand" id="rdPrint" style="margin-left:auto"></button>
  <button class="btn" id="rdReset">↺</button>
</div>
<div class="rd-grid" id="rdMods"></div>
</div>`);

  // Подписи над полями убраны: название поля показывается подсказкой при наведении
  host.querySelectorAll('#spRdl .rd-cfg label').forEach((l) => {
    const tn = [...l.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    const ctl = l.querySelector('input, select');
    if (tn && ctl) { ctl.title = tn.textContent.trim(); tn.remove(); }
  });

  const $ = (id) => document.getElementById(id);
  const g = (k) => $('rd_' + k);
  $('rdPrint').textContent = t('print');

  // SPN012301010205002 / N012301010205002 -> N012301-010205-002
  function fmtCode(s) {
    const v = String(s).toUpperCase().replace(/[\s_-]/g, '').replace(/^SP(?=N)/, '');
    const m = v.match(/^N(\d{6})(\d{6})(\d{3})$/);
    return m ? 'N' + m[1] + '-' + m[2] + '-' + m[3] : null;
  }
  function save() {
    const s = {}; SET.forEach(k => s[k] = g(k).value);
    try { localStorage.setItem(KEY, JSON.stringify(F)); localStorage.setItem(KEY + '_s', JSON.stringify(s)); } catch (e) {}
  }
  SET.forEach(k => {
    if (S0[k] !== undefined) g(k).value = S0[k];
    g(k).oninput = () => {
      if (k === 'preset') { const p = g(k).value.split(' ')[0].split('×'); g('pw').value = p[0]; g('ph').value = p[1]; }
      save(); draw();
    };
  });

  if (!g('bt').value) g('bt').value = 'CODE128B';

  function build() {
    const box = $('rdMods'); box.innerHTML = '';
    F.forEach(f => {
      const B = f.type === 'barcode';
      const d = document.createElement('div'); d.className = 'rd-mod';
      d.title = f.name;
      d.innerHTML = `<input type="text" class="form-input code-text" value="${esc(f.text)}">
        <div class="rd-nums">
          <input class="form-input" type="number" step="0.1" value="${f.x}" title="X mm">
          <input class="form-input" type="number" step="0.1" value="${f.y}" title="Y mm">
          <input class="form-input" type="number" step="0.1" value="${f.size}" title="${B ? 'Barcode height mm' : 'Font size mm'}">
          ${B ? `<input class="form-input" type="number" step="1" min="1" value="${f.mw}" title="Module, dots">
          <input class="form-input" type="number" step="0.1" value="${f.capSize}" title="Caption size mm">
          <input class="form-input" type="number" step="0.1" value="${f.capGap}" title="Caption gap mm">` : ''}
        </div>
        <div class="rd-chk"><label><input type="checkbox" ${(B ? f.capBold : f.bold) ? 'checked' : ''}> bold</label>
        <label><input type="checkbox" ${(B ? f.capSerif : f.serif) ? 'checked' : ''}> serif</label></div>`;
      const tx = d.querySelector('input[type=text]'), n = d.querySelectorAll('.rd-nums input'), c = d.querySelectorAll('.rd-chk input');
      tx.oninput = () => { if (f.fmt) { const r = fmtCode(tx.value); if (r) tx.value = r; } f.text = tx.value; save(); draw(); };
      (B ? ['x','y','size','mw','capSize','capGap'] : ['x','y','size']).forEach((k, j) => {
        n[j].oninput = () => { f[k] = k === 'mw' ? Math.max(1, parseInt(n[j].value, 10) || 1) : +n[j].value; save(); draw(); };
      });
      c[0].onchange = () => { f[B ? 'capBold' : 'bold'] = c[0].checked; save(); draw(); };
      c[1].onchange = () => { f[B ? 'capSerif' : 'serif'] = c[1].checked; save(); draw(); };
      box.appendChild(d);
    });
  }
  const font = (sz, b, s) => (b ? 'bold ' : '') + sz + 'px ' + (s ? '"Times New Roman",serif' : 'Arial,Helvetica,sans-serif');

  // як у «Label»: базовий штрихкод 1 точка/модуль, далі кожен модуль масштабується в m точок (чіткі краї)
  function barcodeCanvas(text, mw, hd) {
    const base = document.createElement('canvas');
    window.JsBarcode(base, text, { format: g('bt').value || 'CODE128B', displayValue: false, margin: 0, width: 1, height: 1, lineColor: '#000000', background: '#ffffff' });
    const n = base.width, row = base.getContext('2d').getImageData(0, 0, n, 1).data;
    const W = Math.max(1, Math.round(n * mw));
    const cv = document.createElement('canvas'); cv.width = W; cv.height = Math.max(8, hd);
    const c = cv.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, W, cv.height); c.fillStyle = '#000';
    for (let i = 0; i < n; i++) if (row[i * 4] < 128) {
      const x0 = Math.round(i * mw), x1 = Math.round((i + 1) * mw);
      c.fillRect(x0, 0, Math.max(1, x1 - x0), cv.height);
    }
    return cv;
  }

  function render(forPrint) {
    const dpi = +g('dpi').value || 203, mm = (v) => Math.round(v * dpi / 25.4);
    const cv = document.createElement('canvas'); cv.width = mm(+g('pw').value); cv.height = mm(+g('ph').value);
    const x = cv.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height);
    const ox = +g('ox').value, oy = +g('oy').value;
    x.fillStyle = '#000'; x.textBaseline = 'top';
    F.forEach(f => {
      const px = mm(ox + f.x), py = mm(oy + f.y);
      if (f.type === 'barcode') {
        if (!f.text) return;
        try { x.imageSmoothingEnabled = false; x.drawImage(barcodeCanvas(f.text, f.mw, mm(f.size)), px, py); } catch (e) {}
        x.font = font(mm(f.capSize), f.capBold, f.capSerif);
        x.fillText(f.text, px, py + mm(f.size + f.capGap));
      } else { x.font = font(mm(f.size), f.bold, f.serif); x.fillText(f.text, px, py); }
    });
    if (g('mode').value === 'bw') {
      const im = x.getImageData(0, 0, cv.width, cv.height), d = im.data, th = +g('thr').value;
      for (let i = 0; i < d.length; i += 4) {
        const v = (d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11) < th ? 0 : 255;
        d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
      }
      x.putImageData(im, 0, 0);
    }
    const gm = g('guide').value;
    const aw = mm(+g('aw').value), ah = mm(+g('ah').value), X = mm(ox), Y = mm(oy);
    if (!forPrint && gm !== 'none') {
      x.strokeStyle = '#aaa'; x.lineWidth = (+g('dw').value || 1) * dpi / 96; x.setLineDash([mm(1.5), mm(1)]);
      x.strokeRect(X, Y, aw, ah); x.setLineDash([]);
    }
    if ((gm === 'marks' || gm === 'frame') && (!forPrint || g('pm').value === '1')) {
      const gp = mm(+g('gap').value), T = Math.max(1, mm(+g('thick').value));
      const x0 = X - gp, y0 = Y - gp, x1 = X + aw + gp, y1 = Y + ah + gp;
      x.fillStyle = '#000';
      if (gm === 'frame') {
        x.fillRect(x0 - T, y0 - T, x1 - x0 + 2 * T, T);   // верх
        x.fillRect(x0 - T, y1, x1 - x0 + 2 * T, T);       // низ
        x.fillRect(x0 - T, y0, T, y1 - y0);               // лево
        x.fillRect(x1, y0, T, y1 - y0);                   // право
      } else {
        const L = mm(6);
        [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]].forEach(([cx, cy, sx, sy]) => {
          x.fillRect(sx > 0 ? cx - T : cx, sy > 0 ? cy - T : cy, sx > 0 ? L + T : -(L + T), T);
          x.fillRect(sx > 0 ? cx - T : cx, sy > 0 ? cy - T : cy, T, sy > 0 ? L + T : -(L + T));
        });
      }
    }
    return cv;
  }
  function draw() {
    const r = render(false), c = $('rdCv');
    c.width = r.width; c.height = r.height; c.getContext('2d').drawImage(r, 0, 0);
    c.style.width = g('pw').value + 'mm'; c.style.height = g('ph').value + 'mm'; // фізичний розмір
  }
  $('rdPrint').onclick = () => {
    // як у «Label»: 1 піксель = 1 точка принтера, розмір картинки = кількість точок × розмір точки
    const r = render(true), url = r.toDataURL('image/png'), w = g('pw').value, h = g('ph').value;
    const dot = 25.4 / (+g('dpi').value || 203), wm = (r.width * dot).toFixed(4), hm = (r.height * dot).toFixed(4);
    printInFrame(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>LABEL</title><style>
      ${pageCss(w, h)}
      .page { position: relative; width: ${w}mm; height: ${(h - 0.4).toFixed(2)}mm; overflow: hidden; }
      .page img { position: absolute; left: 0; top: 0; width: ${wm}mm; height: ${hm}mm; image-rendering: crisp-edges; image-rendering: pixelated; }
    </style></head><body><div class="page"><img src="${url}" alt=""></div></body></html>`);
  };
  $('rdReset').onclick = () => { F = JSON.parse(JSON.stringify(DEF)); save(); build(); draw(); };
  build(); draw();
}

export function init() {
  const host = document.getElementById('specialPage');
  if (!host) return;

  const st = document.createElement('style');
  st.textContent = STYLE;
  document.head.appendChild(st);
  host.innerHTML = MARKUP;

  const $ = (id) => document.getElementById(id);

  // Текст на всю етикетку (100x78, 80x68 або 50x25 мм)
  function printBigText() {
    const text = $('spBigText').value.trim().toUpperCase();
    if (!text) return;
    const [labelW, labelH] = $('spBigSize').value.split('x').map(Number);

    const svgNS = 'http://www.w3.org/2000/svg';
    const tmp = document.createElementNS(svgNS, 'svg');
    const tt = document.createElementNS(svgNS, 'text');
    tt.setAttribute('font-family', 'Arial, Helvetica, sans-serif');
    tt.setAttribute('font-weight', '900');
    tt.setAttribute('font-size', '100');
    tt.textContent = text;
    tmp.appendChild(tt);
    tmp.style.position = 'absolute'; tmp.style.visibility = 'hidden';
    document.body.appendChild(tmp);
    const b = tt.getBBox();
    document.body.removeChild(tmp);

    const px = b.width * 0.02, py = b.height * 0.05;
    const vb = [b.x - px, b.y - py, b.width + 2 * px, b.height + 2 * py].join(' ');
    const h = (labelH - 0.4).toFixed(1);

    printInFrame(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      ${pageCss(labelW, labelH)}
      .lbl { width: ${labelW}mm; height: ${h}mm; overflow: hidden; background: #fff; }
      .lbl svg { display: block; width: 100%; height: 100%; }
    </style></head><body><div class="lbl">
      <svg viewBox="${vb}" preserveAspectRatio="none">
        <text x="${b.x + b.width / 2}" y="${b.y + b.height / 2}" dominant-baseline="central" text-anchor="middle"
          font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="100">${esc(text)}</text>
      </svg>
    </div></body></html>`);
  }

  // Рамка з 11 рядків: етикетка 76 x 130 мм (ширина x довжина).
  // Текст іде поперек етикетки, по всій ширині 76 мм, без повороту.
  // 11 рядків рівномірно розподілені по довжині 130 мм.
  function printRepeatText() {
    const text = $('spRepeat').value.trim().toUpperCase();
    if (!text) return;

    const LABEL_W = 76;   // ширина етикетки (мм), текст іде по ній
    const LABEL_H = 130;  // довжина етикетки (мм)
    const LINES = 11;

    // Крок між рядками по довжині етикетки
    const PITCH = LABEL_H / LINES;
    // Розмір шрифту, при якому текст займає всю ширину 76 мм (Arial Bold, ~13.9 em)
    const FONT = LABEL_W / 13.9;
    // Висота великих літер ≈ 0.716 від розміру шрифту
    const CAP = FONT * 0.716;

    let rows = '';
    for (let i = 0; i < LINES; i++) {
      // Базова лінія рядка: центр кроку + половина висоти літер
      const y = i * PITCH + PITCH / 2 + CAP / 2;
      rows += `<text x="0" y="${y.toFixed(3)}" font-family="Arial, Helvetica, sans-serif" font-weight="700"
        font-size="${FONT.toFixed(3)}" textLength="${LABEL_W}" lengthAdjust="spacing">${esc(text)}</text>`;
    }

    printInFrame(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      ${pageCss(LABEL_W, LABEL_H)}
      .lbl { width: ${LABEL_W}mm; height: ${LABEL_H}mm; overflow: hidden; background: #fff; }
      .lbl svg { display: block; width: ${LABEL_W}mm; height: ${LABEL_H}mm; }
    </style></head><body><div class="lbl">
      <svg viewBox="0 0 ${LABEL_W} ${LABEL_H}" preserveAspectRatio="none">${rows}</svg>
    </div></body></html>`);
  }

  // Кнопка SCC: друкує відмічені SCC 1 / SCC 2 на 50x30 мм. Кількість комплектів діє тільки тут.
  function printSCC() {
    const v1 = $('spVal1').value.trim(), v2 = $('spVal2').value.trim();
    const blocks = [];
    if ($('spChk1').checked && v1) blocks.push(buildWrappedText(v1, SCC_TEXT_H));
    if ($('spChk2').checked && v2) blocks.push(buildWrappedText(v2, SCC_TEXT_H));

    if (blocks.length === 0) return;

    let n = parseInt($('spCopies').value, 10);
    if (!n || n < 1) n = 1;
    if (n > 500) n = 500;

    // Порядок у комплекті: SCC 1 -> SCC 2
    let body = '';
    for (let i = 0; i < n; i++) {
      blocks.forEach(b => { body += `<div class="lbl">${b}</div>`; });
    }

    printInFrame(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      ${pageCss(SCC_WIDTH_MM, SCC_LABEL_H)}
      .lbl { display: grid; place-items: center; width: ${SCC_WIDTH_MM}mm; height: ${SCC_LABEL_H - 0.5}mm;
             padding: 2mm; box-sizing: border-box; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
      .lbl:not(:last-child) { break-after: page; page-break-after: always; }
      .txt { width: 100%; color: #000; font-family: Arial, Helvetica, sans-serif; font-weight: 900;
             line-height: 1.1; overflow-wrap: anywhere; text-align: center; }
    </style></head><body>${body}</body></html>`);
  }

  // Кнопка ICON: одна етикетка 49.5x24.5 мм, без кількості комплектів
  function printIcon() {
    if (!iconUrl) return;

    printInFrame(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      ${pageCss(ICON_LABEL_W, ICON_LABEL_H)}
      .lbl { width: ${ICON_LABEL_W}mm; height: ${ICON_LABEL_H}mm; overflow: hidden; display: block; }
      .pic { width: 100%; height: 100%; object-fit: contain; display: block; }
    </style></head><body><div class="lbl"><img class="pic" src="${iconUrl}" alt=""></div></body></html>`);
  }

  $('spBtnText').onclick = printBigText;
  $('spBtnRepeat').onclick = printRepeatText;
  $('spBtnScc').onclick = printSCC;
  $('spBtnIcon').onclick = printIcon;

  loadIcon();
  initRdl(host);
  applyText();

  onLangChange(applyText);
}
