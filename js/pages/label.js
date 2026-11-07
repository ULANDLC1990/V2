/* Редактор етикеток для сторінки «Label».
   Модуль сторінки: init() будує редактор у #labelPage, show() перемальовує превʼю при відкритті вкладки.
   Мову (uk / pl / en) задає сайт через i18n.js (підписка onLangChange у init). */
import { resolveLang, onLangChange } from '../i18n.js';
import { esc } from '../core/util.js';
import { printInFrame } from '../core/print.js';

// «Міст» до renderPreview, який живе всередині init(): show() викликає оболонка сайту
let showImpl = () => {};
export function show() { showImpl(); }

export function init() {
    const css = `
/* ===== Пісочниця етикеток ===== */
#sandboxSection .sb-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; }
#sandboxSection .sb-sticky { position: sticky; top: 8px; z-index: 5; }
#sandboxSection #sbPreview { max-width: var(--sb-pv, 760px); margin: 0 auto; border: 1px solid #6B7280; border-radius: 4px; overflow: hidden; background: #fff; }
#sandboxSection .sb-num { width: 84px; text-align: center; padding: 8px 6px; }
#sandboxSection .sb-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 12px; }
#sandboxSection .sb-el { background: #111827; border: 2px solid var(--border-color); border-radius: 10px; padding: 10px; cursor: pointer; }
#sandboxSection .sb-el.sel { border-color: var(--accent-color); }
#sandboxSection .sb-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
#sandboxSection .sb-chk { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text-muted); }
#sandboxSection .sb-el > input[type=text] { width: 100%; }
#sandboxSection .sb-grip { position: absolute; top: 0; bottom: 0; right: -9px; width: 18px; cursor: ew-resize; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 18px; user-select: none; touch-action: none; border-radius: 9px; }
#sandboxSection .sb-grip:hover, #sandboxSection .sb-grip.on { background: rgba(37,99,235,.35); color: #fff; }
`;

    const sectionHtml = `
<div id="sandboxSection">
  <div class="manual-input-card sb-sticky">
    <div id="sbPreview"></div>
    <div class="sb-row" style="margin-top: 12px; justify-content: space-between;">
      <div class="sb-row" id="sbSettings"></div>
      <button class="btn btn-brand" id="sbPrintBtn">🖨️ Друк</button>
    </div>
  </div>
  <div class="manual-input-card">
    <div class="sb-cards" id="sbCards"></div>
  </div>
</div>`;

    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    document.getElementById('labelPage').innerHTML = sectionHtml;

    // ===== редактор =====
  const NS = 'http://www.w3.org/2000/svg', KEY = 'labelSandboxV2';
  const D = { lw: 82, lh: 33, pw: 130, ph: 76, ox: 24, oy: 21.5, copies: 1, dpi: 203, gstyle: 'frame', ggap: 1.5, gth: 0.5, tthr: 165, mode: 'raster' };
  const DE = [
    { t:'bc', v:'LVB500UBF0BPBF5H0X',          x:3.4, y:1.1,  h:2.5, m:1, cs:2.12, cw:21.4, cx:3.4, cy:5.7 },
    { t:'bc', v:'750TBV500S85Z8N000',          x:3.4, y:7.8,  h:2.5, m:1, cs:2.12, cw:19.4, cx:3.2, cy:12.5 },
    { t:'bc', v:'B500UBF0BPBF5NLCAAB5B41529',  x:3.4, y:14.5, h:4.8, m:1, cs:2.47, cw:44.1, cx:3.0, cy:21.6 },
    { t:'bc', v:'TBV500S85Z8X00K80NXB5B41529', x:3.4, y:23.1, h:4.8, m:1, cs:2.47, cw:43.9, cx:3.0, cy:30.9 },
    { t:'tx', v:'Made in China', x:60.1, y:3.5,  fs:2.82, tl:15.5, b:1, serif:0 },
    { t:'tx', v:'RoHS',          x:67.0, y:6.6,  fs:3.18, tl:6.9,  b:1, serif:0 },
    { t:'tx', v:'TPT500WR',      x:44.4, y:6.7,  fs:2.82, tl:12.6, b:1, serif:0 },
    { t:'tx', v:'-QUBF20.K',     x:44.4, y:10.4, fs:2.82, tl:12.6, b:1, serif:0 },
    { t:'tx', v:'REV:STMPZ',     x:60.1, y:10.4, fs:2.82, tl:14.8, b:0, serif:0 },
    { t:'tx', v:'2D',            x:61.8, y:17.8, fs:4.2,  tl:4.9,  b:1, serif:0 },
    { t:'tx', v:'BL',            x:62.5, y:22.2, fs:3.18, tl:3.7,  b:0, serif:0 },
    { t:'tx', v:'000',           x:70.8, y:22.2, fs:3.18, tl:5.0,  b:0, serif:0 },
    { t:'tx', v:'TPV',           x:61.5, y:28.7, fs:7.0,  tl:14.2, b:1, serif:1 }
  ];
  let S = { ...D }, els = JSON.parse(JSON.stringify(DE)), sel = -1, drag = null;

  const $ = (id) => document.getElementById(id);
  const num = (v) => (isFinite(v) ? +(+v).toFixed(2) : 0);
  const dotmm = () => 25.4 / (S.dpi || 203);
  const noTmp = (k, v) => (k[0] === '_' ? undefined : v);
  const showToast = (m) => alert(m);

  function load() { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.S && Array.isArray(d.els)) { S = { ...D, ...d.S }; els = d.els; } } catch (e) {} }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ S, els }, noTmp)); } catch (e) {} }

  // ---------- Малювання ----------
  function txMarkup(v, x, y, fs, tl, bold, serif) {
    if (!v) return '';
    const len = tl > 0 ? ` textLength="${tl}" lengthAdjust="spacingAndGlyphs"` : '';
    const fam = serif ? ` font-family="Georgia, 'Times New Roman', serif"` : '';
    return `<text x="${x}" y="${y}" font-size="${fs}" font-weight="${serif ? 900 : (bold ? 700 : 400)}"${len}${fam}>${esc(v)}</text>`;
  }
  function barcodeCanvas(e) {
    const hd = Math.max(8, Math.round(e.h / dotmm()));
    const m = Math.max(1, Math.round(parseFloat(e.m) || 1));
    const base = document.createElement('canvas');
    window.JsBarcode(base, e.v, { format: 'CODE128B', displayValue: false, margin: 0, width: 1, height: 1, lineColor: '#000000', background: '#ffffff' });
    const n = base.width, row = base.getContext('2d').getImageData(0, 0, n, 1).data;
    const W = Math.max(1, Math.round(n * m));
    const cv = document.createElement('canvas'); cv.width = W; cv.height = hd;
    const c = cv.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, W, hd); c.fillStyle = '#000';
    for (let i = 0; i < n; i++) if (row[i * 4] < 128) { const x0 = Math.round(i * m), x1 = Math.round((i + 1) * m); c.fillRect(x0, 0, Math.max(1, x1 - x0), hd); }
    return cv;
  }
  function bcMarkup(e) {
    if (!e.v) return '';
    const dot = dotmm(), cv = barcodeCanvas(e);
    const w = +(cv.width * dot).toFixed(4), h = +(cv.height * dot).toFixed(4);
    const x = +(Math.round(e.x / dot) * dot).toFixed(4), y = +(Math.round(e.y / dot) * dot).toFixed(4);
    e._w = +w.toFixed(1);
    let out = `<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none" style="image-rendering:crisp-edges;image-rendering:pixelated" href="${cv.toDataURL('image/png')}"/>`;
    if (e.cs > 0) out += txMarkup(e.v, e.cx > 0 ? e.cx : e.x, e.cy > 0 ? e.cy : +(y + h + e.cs * 0.9).toFixed(2), e.cs, e.cw, 1, 0);
    return out;
  }
  function processIm(e) {
    return new Promise((resolve) => {
      if (!e.src) return resolve();
      const dot = dotmm(), wd = Math.max(1, Math.round(e.w / dot)), hd = Math.max(1, Math.round(e.h / dot));
      const key = `${e.src.length}|${wd}|${hd}`;
      if (e._k === key) return resolve();
      const im = new Image();
      im.onload = () => {
        const cv = document.createElement('canvas'); cv.width = wd; cv.height = hd;
        const ctx = cv.getContext('2d', { willReadFrequently: true });
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, wd, hd);
        ctx.imageSmoothingQuality = 'high'; ctx.drawImage(im, 0, 0, wd, hd);
        const id = ctx.getImageData(0, 0, wd, hd), d = id.data;
        for (let i = 0; i < d.length; i += 4) { const v = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) < 160 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
        ctx.putImageData(id, 0, 0);
        e._d = cv.toDataURL('image/png'); e._k = key; resolve();
      };
      im.onerror = () => { e._d = ''; e._k = key; resolve(); };
      im.src = e.src;
    });
  }
  function imMarkup(e) {
    if (!e.src) return '';
    const dot = dotmm(), wd = Math.max(1, Math.round(e.w / dot)), hd = Math.max(1, Math.round(e.h / dot));
    if (e._k !== `${e.src.length}|${wd}|${hd}`) { processIm(e).then(renderPreview); return ''; }
    if (!e._d) return '';
    const x = +(Math.round(e.x / dot) * dot).toFixed(4), y = +(Math.round(e.y / dot) * dot).toFixed(4);
    return `<image x="${x}" y="${y}" width="${+(wd * dot).toFixed(4)}" height="${+(hd * dot).toFixed(4)}" preserveAspectRatio="none" style="image-rendering:crisp-edges;image-rendering:pixelated" href="${e._d}"/>`;
  }
  function guidesMarkup(ox = 0, oy = 0) {
    if (!S.gstyle || S.gstyle === 'off') return '';
    const dot = dotmm(), sn = (v) => +(Math.round(v / dot) * dot).toFixed(4);
    const t = Math.max(dot, sn(S.gth || 0.5)), g = S.ggap || 0;
    const x0 = sn(ox - g), y0 = sn(oy - g), x1 = sn(ox + S.lw + g), y1 = sn(oy + S.lh + g);
    if (S.gstyle === 'marks') {
      const L = 4;
      const d = `M${x0} ${y0 + L}V${y0}H${x0 + L} M${x1 - L} ${y0}H${x1}V${y0 + L} M${x1} ${y1 - L}V${y1}H${x1 - L} M${x0 + L} ${y1}H${x0}V${y1 - L}`;
      return `<path d="${d}" fill="none" stroke="#000" stroke-width="${t}" stroke-linecap="square" shape-rendering="crispEdges"/>`;
    }
    return `<rect x="${x0}" y="${y0}" width="${+(x1 - x0).toFixed(4)}" height="${+(y1 - y0).toFixed(4)}" fill="none" stroke="#000" stroke-width="${t}" shape-rendering="crispEdges"/>`;
  }
  function buildSvg(preview = true) {
    const on = S.gstyle && S.gstyle !== 'off';
    const pad = preview && on ? (S.ggap || 0) + (S.gth || 0.5) + 3 : 0;
    const size = preview ? 'style="width:100%;height:auto;display:block;background:#fff;touch-action:none"' : `width="${S.lw}mm" height="${S.lh}mm"`;
    let s = `<svg xmlns="${NS}" viewBox="${-pad} ${-pad} ${S.lw + 2 * pad} ${S.lh + 2 * pad}" ${size} font-family="Arial, Helvetica, sans-serif" fill="#000">`;
    s += `<rect x="${-pad}" y="${-pad}" width="${S.lw + 2 * pad}" height="${S.lh + 2 * pad}" fill="#fff"/>`;
    if (pad) s += `<rect width="${S.lw}" height="${S.lh}" fill="none" stroke="#D1D5DB" stroke-width="0.15" stroke-dasharray="1 0.8"/>`;
    els.forEach((e, i) => {
      let inner = '';
      try { inner = e.t === 'bc' ? bcMarkup(e) : e.t === 'im' ? imMarkup(e) : txMarkup(e.v, e.x, e.y, e.fs, e.tl, e.b, e.serif); } catch (err) {}
      s += `<g data-i="${i}">${inner}</g>`;
    });
    return s + (preview ? guidesMarkup() : '') + '</svg>';
  }
  function renderPreview() {
    const box = $('sbPreview');
    if (!box || !box.offsetParent) return;           // секція прихована: getBBox не працює
    box.innerHTML = buildSvg();
    box.firstChild.querySelectorAll('g[data-i]').forEach((g) => {
      let bb; try { bb = g.getBBox(); } catch (e) { return; }
      if (!bb.width) return;
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', bb.x - 0.4); r.setAttribute('y', bb.y - 0.4);
      r.setAttribute('width', bb.width + 0.8); r.setAttribute('height', bb.height + 0.8);
      r.setAttribute('fill', 'rgba(0,0,0,0)'); r.setAttribute('pointer-events', 'all');
      if (+g.dataset.i === sel) { r.setAttribute('stroke', '#2563EB'); r.setAttribute('stroke-width', '0.25'); r.setAttribute('stroke-dasharray', '0.8 0.5'); }
      r.style.cursor = 'move'; g.appendChild(r);
    });
  }
  showImpl = renderPreview;      // викликається оболонкою (show) при відкритті вкладки Label

  // ---------- Перетягування ----------
  function toMm(svg, ev) { const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); }
  $('sbPreview').addEventListener('pointerdown', (ev) => {
    const g = ev.target.closest && ev.target.closest('g[data-i]');
    if (!g) { selectEl(-1); return; }
    const i = +g.dataset.i, p = toMm($('sbPreview').firstChild, ev);
    drag = { i, sx: p.x, sy: p.y, ox: els[i].x, oy: els[i].y };
    selectEl(i); ev.preventDefault();
  });
  document.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const p = toMm($('sbPreview').firstChild, ev), e = els[drag.i];
    e.x = num(Math.round((drag.ox + p.x - drag.sx) * 10) / 10);
    e.y = num(Math.round((drag.oy + p.y - drag.sy) * 10) / 10);
    const ix = $(`sbf_${drag.i}_x`), iy = $(`sbf_${drag.i}_y`);
    if (ix) ix.value = e.x; if (iy) iy.value = e.y;
    renderPreview();
  });
  document.addEventListener('pointerup', () => { if (drag) { drag = null; save(); } });

  // ---------- Картки елементів (без заголовків, без ✕, без підписів полів) ----------
  const FIELDS = {
    bc: [['x','X'],['y','Y'],['h','Висота, мм'],['m','Модуль, точок (ціле)'],['cs','Підпис: розмір'],['cw','Підпис: ширина'],['cx','Підпис: X'],['cy','Підпис: Y (низ)']],
    im: [['x','X'],['y','Y'],['w','Ширина, мм'],['h','Висота, мм']],
    tx: [['x','X'],['y','Y (низ)'],['fs','Розмір'],['tl','Ширина']]
  };
  function renderCards() {
    const host = $('sbCards'); host.innerHTML = '';
    els.forEach((e, i) => {
      const d = document.createElement('div');
      d.className = 'sb-el' + (i === sel ? ' sel' : '');
      d.onclick = () => selectEl(i);
      const nums = FIELDS[e.t].map(([k, label]) =>
        `<input type="number" class="form-input sb-num" data-k="${k}" step="${k === 'm' ? 1 : 0.1}" ${k === 'm' ? 'min="1"' : ''} title="${t(label)}" id="sbf_${i}_${k}" value="${e[k] ?? 0}">`
      ).join('');
      const extra = e.t === 'tx' ? `<label class="sb-chk"><input type="checkbox" data-k="b" ${e.b ? 'checked' : ''}> ${t('жирний')}</label><label class="sb-chk"><input type="checkbox" data-k="serif" ${e.serif ? 'checked' : ''}> ${t('з засічками')}</label>` : '';
      d.innerHTML = `${e.t === 'im' ? '<input type="file" accept="image/*" style="color:#9CA3AF;font-size:12px">' : `<input type="text" class="form-input code-text" data-k="v" value="${esc(e.v)}">`}
        <div class="sb-grid">${nums}${extra}</div>`;
      host.appendChild(d);
      d.querySelectorAll('input').forEach((inp) => {
        if (inp.type === 'file') {
          inp.onchange = () => { const f = inp.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { e.src = r.result; e._k = null; renderPreview(); save(); }; r.readAsDataURL(f); };
          return;
        }
        inp.addEventListener('input', () => {
          const k = inp.dataset.k;
          if (k === 'v') e.v = inp.value; else if (inp.type === 'checkbox') e[k] = inp.checked ? 1 : 0; else e[k] = parseFloat(inp.value) || 0;
          renderPreview(); save();
        });
        inp.addEventListener('focus', () => { if (sel !== i) selectEl(i); });
      });
    });
  }
  function selectEl(i) { sel = i; document.querySelectorAll('#sbCards .sb-el').forEach((c, idx) => c.classList.toggle('sel', idx === i)); renderPreview(); }

  // ---------- Налаштування (без підписів, підказка — при наведенні) ----------
  const NUM = { lw:['Етикетка Ш, мм',.5], lh:['Етикетка В, мм',.5], pw:['Папір Ш, мм',.5], ph:['Папір В, мм',.5], ox:['Зліва, мм',.1], oy:['Зверху, мм',.1], copies:['Копій',1], dpi:['DPI принтера',1], tthr:['Жирність тексту (поріг)',5], ggap:['Відступ лінії, мм',.1], gth:['Товщина, мм',.1] };
  const fld = (k) => `<input type="number" class="form-input sb-num" id="sb_${k}" step="${NUM[k][1]}" title="${t(NUM[k][0])}">`;
  const sel_ = (id, label, opts) => `<select class="form-input" id="${id}" title="${t(label)}">${opts.map(([v, x]) => `<option value="${v}">${t(x)}</option>`).join('')}</select>`;
  function syncSettings() {
    if (!S.paper) S.paper = (S.pw === 130 && S.ph === 76) ? '130x76' : (S.pw === 100 && S.ph === 78) ? '100x78' : 'custom';
    Object.keys(NUM).forEach((k) => { $('sb_' + k).value = S[k]; });
    $('sb_gstyle').value = S.gstyle; $('sb_paper').value = S.paper; $('sb_mode').value = S.mode || 'raster';
  }
  function initSettings() {
    $('sbSettings').innerHTML = fld('lw') + fld('lh') +
      sel_('sb_paper', 'Формат паперу', [['130x76','130×76 мм'],['100x78','100×78 мм'],['custom','Свій розмір']]) +
      fld('pw') + fld('ph') + fld('ox') + fld('oy') + fld('copies') + fld('dpi') + sel_('sb_mode', 'Режим друку', [['raster','Растр 1-біт (рекоменд.)'],['vector','Вектор']]) + fld('tthr') +
      sel_('sb_gstyle', 'Лінії різу', [['off','Немає'],['frame','Рамка'],['marks','Кутики']]) + fld('ggap') + fld('gth');
    Object.keys(NUM).forEach((k) => {
      $('sb_' + k).oninput = (ev) => {
        S[k] = parseFloat(ev.target.value) || 0;
        if (k === 'pw' || k === 'ph') { S.paper = 'custom'; $('sb_paper').value = 'custom'; }
        renderPreview(); save();
      };
    });
    $('sb_gstyle').onchange = (ev) => { S.gstyle = ev.target.value; renderPreview(); save(); };
    $('sb_mode').onchange = (ev) => { S.mode = ev.target.value; save(); };
    $('sb_paper').onchange = (ev) => {
      S.offs = S.offs || {}; S.offs[S.paper || 'custom'] = { ox: S.ox, oy: S.oy };
      S.paper = ev.target.value;
      if (S.paper === '130x76') { S.pw = 130; S.ph = 76; } else if (S.paper === '100x78') { S.pw = 100; S.ph = 78; }
      const o = S.offs[S.paper];
      S.ox = o ? o.ox : +(((S.pw - S.lw) / 2).toFixed(1)); S.oy = o ? o.oy : +(((S.ph - S.lh) / 2).toFixed(1));
      syncSettings(); renderPreview(); save();
    };
    syncSettings();
  }

  // ---------- Друк: 1-бітний растр точно по точках принтера ----------
  const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  async function renderRaster() {
    const dot = dotmm(), SS = 4, px = (mm) => Math.round(mm / dot);
    const W = px(S.pw), H = px(S.ph), ox = px(S.ox), oy = px(S.oy);
    const tc = document.createElement('canvas'); tc.width = W * SS; tc.height = H * SS;
    const tx = tc.getContext('2d');
    tx.fillStyle = '#fff'; tx.fillRect(0, 0, tc.width, tc.height); tx.fillStyle = '#000'; tx.textBaseline = 'alphabetic';
    const drawText = (v, x, y, fs, tl, bold, serif) => {
      if (!v) return;
      tx.save();
      tx.font = `${serif ? 900 : (bold ? 700 : 400)} ${(fs / dot) * SS}px ${serif ? "Georgia, 'Times New Roman', serif" : 'Arial, Helvetica, sans-serif'}`;
      const w0 = tx.measureText(v).width, sx = tl > 0 && w0 > 0 ? ((tl / dot) * SS) / w0 : 1;
      tx.translate((ox + x / dot) * SS, (oy + y / dot) * SS); tx.scale(sx, 1); tx.fillText(v, 0, 0); tx.restore();
    };
    els.forEach((e) => {
      if (e.t === 'tx') drawText(e.v, e.x, e.y, e.fs, e.tl, e.b, e.serif);
      else if (e.t === 'bc' && e.v && e.cs > 0) drawText(e.v, e.cx > 0 ? e.cx : e.x, e.cy > 0 ? e.cy : e.y + e.h + e.cs * 0.9, e.cs, e.cw, 1, 0);
    });
    const fc = document.createElement('canvas'); fc.width = W; fc.height = H;
    const f = fc.getContext('2d', { willReadFrequently: true });
    f.imageSmoothingQuality = 'high'; f.drawImage(tc, 0, 0, W, H);
    const id = f.getImageData(0, 0, W, H), d = id.data, thr = S.tthr || 165;
    for (let i = 0; i < d.length; i += 4) { const v = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) < thr ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    f.putImageData(id, 0, 0); f.imageSmoothingEnabled = false;
    for (const e of els) {
      if (e.t === 'bc' && e.v) f.drawImage(barcodeCanvas(e), ox + px(e.x), oy + px(e.y));
      else if (e.t === 'im' && e.src && e._d) { const im = await loadImg(e._d); if (im) f.drawImage(im, ox + px(e.x), oy + px(e.y)); }
    }
    if (S.gstyle && S.gstyle !== 'off') {
      const th = Math.max(1, px(S.gth || 0.5)), half = Math.floor(th / 2), g = px(S.ggap || 0);
      const x0 = ox - g, y0 = oy - g, x1 = ox + px(S.lw) + g, y1 = oy + px(S.lh) + g;
      f.fillStyle = '#000';
      if (S.gstyle === 'marks') {
        const L = px(4), rx = x1 - half + th - L, by = y1 - half + th - L;
        f.fillRect(x0 - half, y0 - half, L, th); f.fillRect(x0 - half, y0 - half, th, L);
        f.fillRect(rx, y0 - half, L, th);        f.fillRect(x1 - half, y0 - half, th, L);
        f.fillRect(x0 - half, y1 - half, L, th); f.fillRect(x0 - half, by, th, L);
        f.fillRect(rx, y1 - half, L, th);        f.fillRect(x1 - half, by, th, L);
      } else {
        f.fillRect(x0 - half, y0 - half, x1 - x0 + th, th); f.fillRect(x0 - half, y1 - half, x1 - x0 + th, th);
        f.fillRect(x0 - half, y0 - half, th, y1 - y0 + th); f.fillRect(x1 - half, y0 - half, th, y1 - y0 + th);
      }
    }
    return { url: fc.toDataURL('image/png'), wmm: (W * dot).toFixed(4), hmm: (H * dot).toFixed(4) };
  }

  function printVector() {
    let svg;
    try { svg = buildSvg(false); } catch (e) { alert(t('Помилка побудови етикетки')); return; }
    const copies = Math.min(500, Math.max(1, Math.round(S.copies) || 1)), dot = dotmm();
    const ox = (Math.round(S.ox / dot) * dot).toFixed(4), oy = (Math.round(S.oy / dot) * dot).toFixed(4);
    const gsvg = (S.gstyle && S.gstyle !== 'off') ? `<svg class="guides" xmlns="${NS}" viewBox="0 0 ${S.pw} ${S.ph}" width="${S.pw}mm" height="${S.ph}mm">${guidesMarkup(+ox, +oy)}</svg>` : '';
    let pages = ''; for (let i = 0; i < copies; i++) pages += `<div class="page">${gsvg}${svg}</div>`;
    printInFrame(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>LABEL</title><style>
      @page { size: ${S.pw}mm ${S.ph}mm; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; }
      image { image-rendering: crisp-edges; image-rendering: pixelated; }
      .page { position: relative; width: ${S.pw}mm; height: ${(S.ph - 0.4).toFixed(2)}mm; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
      .page svg { position: absolute; left: ${ox}mm; top: ${oy}mm; width: ${S.lw}mm; height: ${S.lh}mm; display: block; }
      .page svg.guides { left: 0; top: 0; width: ${S.pw}mm; height: ${S.ph}mm; }
      .page:not(:last-child) { break-after: page; page-break-after: always; }
    </style></head><body>${pages}</body></html>`, { id: 'sbPrintFrame', delay: 400 });
  }

  // ---------- Багатомовність (UK / PL / EN). Ключ = український текст. Мову задає сайт. ----------
  const I18N = {
    '🖨️ Друк': { pl: '🖨️ Drukuj', en: '🖨️ Print' },
    'Формат паперу': { pl: 'Format papieru', en: 'Paper size' },
    '130×76 мм': { pl: '130×76 mm', en: '130×76 mm' },
    '100×78 мм': { pl: '100×78 mm', en: '100×78 mm' },
    'Свій розмір': { pl: 'Własny rozmiar', en: 'Custom size' },
    'Етикетка Ш, мм': { pl: 'Etykieta szer., mm', en: 'Label W, mm' },
    'Етикетка В, мм': { pl: 'Etykieta wys., mm', en: 'Label H, mm' },
    'Папір Ш, мм': { pl: 'Papier szer., mm', en: 'Paper W, mm' },
    'Папір В, мм': { pl: 'Papier wys., mm', en: 'Paper H, mm' },
    'Зліва, мм': { pl: 'Od lewej, mm', en: 'From left, mm' },
    'Зверху, мм': { pl: 'Od góry, mm', en: 'From top, mm' },
    'Копій': { pl: 'Kopii', en: 'Copies' },
    'DPI принтера': { pl: 'DPI drukarki', en: 'Printer DPI' },
    'Режим друку': { pl: 'Tryb druku', en: 'Print mode' },
    'Растр 1-біт (рекоменд.)': { pl: 'Raster 1-bit (zalecany)', en: '1-bit raster (recommended)' },
    'Вектор': { pl: 'Wektor', en: 'Vector' },
    'Жирність тексту (поріг)': { pl: 'Grubość tekstu (próg)', en: 'Text weight (threshold)' },
    'Лінії різу': { pl: 'Linie cięcia', en: 'Cut lines' },
    'Немає': { pl: 'Brak', en: 'None' },
    'Рамка': { pl: 'Ramka', en: 'Frame' },
    'Кутики': { pl: 'Narożniki', en: 'Corner marks' },
    'Відступ лінії, мм': { pl: 'Odstęp linii, mm', en: 'Line offset, mm' },
    'Товщина, мм': { pl: 'Grubość, mm', en: 'Thickness, mm' },
    'Висота, мм': { pl: 'Wysokość, mm', en: 'Height, mm' },
    'Модуль, точок (ціле)': { pl: 'Moduł, punkty (liczba całk.)', en: 'Module, dots (integer)' },
    'Підпис: розмір': { pl: 'Podpis: rozmiar', en: 'Caption: size' },
    'Підпис: ширина': { pl: 'Podpis: szerokość', en: 'Caption: width' },
    'Підпис: X': { pl: 'Podpis: X', en: 'Caption: X' },
    'Підпис: Y (низ)': { pl: 'Podpis: Y (dół)', en: 'Caption: Y (bottom)' },
    'Ширина, мм': { pl: 'Szerokość, mm', en: 'Width, mm' },
    'Y (низ)': { pl: 'Y (dół)', en: 'Y (bottom)' },
    'Розмір': { pl: 'Rozmiar', en: 'Size' },
    'Ширина': { pl: 'Szerokość', en: 'Width' },
    'жирний': { pl: 'pogrubiony', en: 'bold' },
    'з засічками': { pl: 'szeryfowy', en: 'serif' },
    'Помилка побудови етикетки': { pl: 'Błąd budowy etykiety', en: 'Label build error' },
    'Помилка растрового режиму: ': { pl: 'Błąd trybu rastrowego: ', en: 'Raster mode error: ' },
    'Скинути все до прикладу?': { pl: 'Przywrócić wszystko do przykładu?', en: 'Reset everything to the example?' },
    'Макет скопійовано в буфер обміну!': { pl: 'Układ skopiowany do schowka!', en: 'Layout copied to clipboard!' },
    'Скопіюйте макет:': { pl: 'Skopiuj układ:', en: 'Copy the layout:' },
    'Вставте JSON макета:': { pl: 'Wklej JSON układu:', en: 'Paste the layout JSON:' },
    'Невірний JSON': { pl: 'Nieprawidłowy JSON', en: 'Invalid JSON' }
  };
  let LANG = resolveLang(['uk', 'pl', 'en']);
  function t(str) { if (LANG === 'uk') return str; const m = I18N[str]; return (m && m[LANG]) || str; }

  function applyLang() {
    const walker = document.createTreeWalker($('sandboxSection'), NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        const p = n.parentElement;
        if (!p || p.closest('#sbCards, #sbPreview, #sbSettings, script, style')) return NodeFilter.FILTER_REJECT;
        return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((n) => {
      if (n._o === undefined) n._o = n.nodeValue;
      const lead = n._o.match(/^\s*/)[0], trail = n._o.match(/\s*$/)[0];
      n.nodeValue = lead + t(n._o.trim()) + trail;
    });
    initSettings(); renderCards(); renderPreview();
  }

  // ---------- Внутрішнє API редактора (раніше window.sb) ----------
  const sandbox = {
    add(type) {
      els.push(type === 'bc' ? { t:'bc', v:'12345', x:3, y:3, h:4, m:1, cs:2.5, cw:0 }
        : type === 'im' ? { t:'im', src:'', x:61.5, y:23.5, w:14.2, h:5.2 }
        : { t:'tx', v:'TEXT', x:3, y:10, fs:3, tl:0, b:1, serif:0 });
      sel = els.length - 1; renderCards(); renderPreview(); save();
    },
    reset() {
      if (!confirm(t('Скинути все до прикладу?'))) return;
      S = { ...D }; els = JSON.parse(JSON.stringify(DE)); sel = -1; syncSettings(); renderCards(); renderPreview(); save();
    },
    exportJson() {
      const txt = JSON.stringify({ S, els }, noTmp);
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(
        () => showToast('✅ ' + t('Макет скопійовано в буфер обміну!')), () => prompt(t('Скопіюйте макет:'), txt));
    },
    importJson() {
      const txt = prompt(t('Вставте JSON макета:')); if (!txt) return;
      try {
        const d = JSON.parse(txt); if (!d.S || !Array.isArray(d.els)) throw 0;
        S = { ...D, ...d.S }; els = d.els; sel = -1; syncSettings(); renderCards(); renderPreview(); save();
      } catch (e) { alert(t('Невірний JSON')); }
    },
    async print() {
      await Promise.all(els.filter((e) => e.t === 'im').map(processIm));
      if (S.mode === 'vector') { printVector(); return; }
      let r;
      try { r = await renderRaster(); } catch (err) { alert(t('Помилка растрового режиму: ') + err.message); return; }
      const n = Math.min(500, Math.max(1, Math.round(S.copies) || 1));
      let pg = ''; for (let i = 0; i < n; i++) pg += `<div class="page"><img src="${r.url}"></div>`;
      printInFrame(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>LABEL</title><style>
        @page { size: ${S.pw}mm ${S.ph}mm; margin: 0; }
        html, body { margin: 0; padding: 0; background: #fff; }
        .page { position: relative; width: ${S.pw}mm; height: ${(S.ph - 0.4).toFixed(2)}mm; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
        .page img { position: absolute; left: 0; top: 0; width: ${r.wmm}mm; height: ${r.hmm}mm; image-rendering: crisp-edges; image-rendering: pixelated; }
        .page:not(:last-child) { break-after: page; page-break-after: always; }
      </style></head><body>${pg}</body></html>`, { id: 'sbPrintFrame', delay: 400 });
    }
  };
  $('sbPrintBtn').addEventListener('click', () => sandbox.print());

  // Мову задає сайт (i18n.js): при зміні перекладаємо розмітку редактора
  onLangChange(() => { LANG = resolveLang(['uk', 'pl', 'en']); applyLang(); });

  // ---------- Розтягування робочої зони (ручка справа від превʼю) ----------
  const WKEY = 'labelSandboxW', secEl = $('sandboxSection'), panel = secEl.querySelector('.sb-sticky');
  let W = 0; try { W = parseInt(localStorage.getItem(WKEY)) || 0; } catch (e) {}
  const grip = document.createElement('div'); grip.className = 'sb-grip'; grip.textContent = '⋮'; panel.appendChild(grip);
  function gripTitle() { grip.title = t('Потягніть, щоб розтягнути робочу зону (подвійний клік — скинути)'); }
  function applyW() {
    const base = secEl.parentElement.clientWidth, max = document.documentElement.clientWidth - 40;
    const w = W ? Math.min(Math.max(W, base), max) : 0;
    if (!w || w <= base) { secEl.style.width = ''; secEl.style.marginLeft = ''; secEl.style.removeProperty('--sb-pv'); }
    else { secEl.style.width = w + 'px'; secEl.style.marginLeft = `calc(50% - ${w / 2}px)`; secEl.style.setProperty('--sb-pv', Math.min(1000, w - 120) + 'px'); }
  }
  let gd = null;
  grip.addEventListener('pointerdown', (ev) => { gd = { x: ev.clientX, w: secEl.getBoundingClientRect().width }; grip.classList.add('on'); grip.setPointerCapture(ev.pointerId); ev.preventDefault(); });
  grip.addEventListener('pointermove', (ev) => { if (!gd) return; W = Math.round(gd.w + 2 * (ev.clientX - gd.x)); applyW(); });
  const gripEnd = () => { if (!gd) return; gd = null; grip.classList.remove('on'); try { localStorage.setItem(WKEY, String(W)); } catch (e) {} };
  grip.addEventListener('pointerup', gripEnd); grip.addEventListener('pointercancel', gripEnd);
  grip.addEventListener('dblclick', () => { W = 0; try { localStorage.removeItem(WKEY); } catch (e) {} applyW(); });
  window.addEventListener('resize', applyW);
  gripTitle(); applyW();

  load(); initSettings(); renderCards();
  if (LANG !== 'uk') applyLang();
}
