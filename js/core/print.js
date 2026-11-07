/* Общая печать этикеток: стили, штрихкод, макеты 100×78 и 130×76, печать через скрытый iframe.
   Раньше этот код был скопирован в final.js, manual.js, label.js, special.js и pnbase.js. */
import { esc } from './util.js';

const NS = 'http://www.w3.org/2000/svg';

// Стили печати (этикетки печатаются в отдельном документе внутри iframe)
export const PRINT_CSS = `
html,body{margin:0;padding:0;background:#fff}
.pg{break-after:page;page-break-after:always}
.pg:last-child{break-after:auto;page-break-after:auto}
.lbl-std{width:100mm;height:77.6mm;position:relative;background:#fff;color:#000;padding:3.2mm 4mm 2.8mm;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;overflow:hidden}
.top-divider{width:100%;height:0;border-top:1.5px solid #000;margin:0 0 2.2mm 0}
.label-section{width:100%;display:block}
.label-section+.label-section{margin-top:3.1mm}
.section-header{width:100%;height:5.5mm;display:block;position:relative;margin:0 0 1.1mm 0;line-height:5.5mm;text-align:center}
.section-header.has-brand{display:flex;justify-content:space-between;align-items:center;text-align:left}
.header-title{display:block;width:100%;font-size:16.5pt;font-weight:900;line-height:5.5mm;text-align:center}
.section-header.has-brand .header-title{display:inline-block;width:auto;text-align:left}
.brand-tag{font-weight:900;font-size:11pt;text-transform:uppercase;line-height:5.5mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70%;text-align:right}
.barcode-box{width:82mm;height:15.5mm;margin:0 auto;display:block;overflow:hidden;text-align:center}
.barcode-box svg{width:auto!important;max-width:100%!important;height:15.5mm!important;display:inline-block;vertical-align:top;shape-rendering:crispEdges}
.val-pn,.val-sn{width:100%;box-sizing:border-box;text-align:center;font-weight:900;white-space:nowrap;overflow:hidden;line-height:1;margin:1.1mm 0 0 0}
.val-pn{font-size:18pt}
.val-sn{font-size:13pt;transform:scale(1,1.8);transform-origin:center top;margin-top:3.5mm}
.lbl-new{width:130mm;height:75.6mm;position:relative;background:#fff;color:#000;padding:19.05mm 2.54mm 6.35mm 2.54mm;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;overflow:hidden}
.lbl-new::after{content:'';position:absolute;top:1.5mm;left:1.5mm;right:1.5mm;bottom:1.5mm;border:0.5mm solid #000;box-sizing:border-box}
.bw-pn,.bw-sn{width:118mm;height:10.5mm;margin:1.2mm auto 0.6mm;display:block;overflow:hidden;text-align:center}
.bw-pn svg,.bw-sn svg{width:100%!important;height:100%!important;display:inline-block;vertical-align:top;shape-rendering:crispEdges}
.cap{font-size:17pt;font-weight:900;text-align:center;line-height:1;margin:0 0 0.4mm 0;width:100%}
.val{font-size:17pt;font-weight:900;text-align:center;line-height:1;white-space:nowrap;width:100%;margin:0 0 0.4mm 0}
.brand-new{position:absolute;top:3mm;left:4mm;right:4mm;height:16mm;display:flex;align-items:center;justify-content:center;font-size:28pt;font-weight:900;text-transform:uppercase;line-height:1;white-space:nowrap;overflow:hidden}
`;

// Штрихкод Code128 строится в скрытом SVG и возвращается как строка разметки
export function barcodeSvg(value, height, width, stretch) {
  const s = document.createElementNS(NS, 'svg');
  s.style.position = 'absolute';
  s.style.visibility = 'hidden';
  document.body.appendChild(s);
  try {
    window.JsBarcode(s, String(value || 'N/A'), {
      format: 'CODE128B', displayValue: false, margin: 0, height, width, flat: true,
      lineColor: '#000000', background: '#ffffff'
    });
  } catch (e) {}
  s.removeAttribute('style');
  if (stretch) s.setAttribute('preserveAspectRatio', 'none');
  const out = s.outerHTML;
  document.body.removeChild(s);
  return out;
}

// Стандартная этикетка 100x78 мм, по 2 копии на каждый SN. list: [{ sn, pn, brand }]
export function stdPages(list, withBrand) {
  let out = '';
  list.forEach((p) => {
    const pn = p.pn || 'N/A', sn = p.sn || 'N/A', brand = p.brand || '-';
    const one = `<div class="pg"><div class="lbl-std">
        <div class="top-divider"></div>
        <div class="label-section">
          <div class="section-header${withBrand ? ' has-brand' : ''}"><span class="header-title">PN:</span>${withBrand ? `<span class="brand-tag">${esc(brand)}</span>` : ''}</div>
          <div class="barcode-box">${barcodeSvg(pn, 48, 1.18)}</div>
          <div class="val-pn">${esc(pn)}</div>
        </div>
        <div class="label-section">
          <div class="section-header"><span class="header-title">SN:</span></div>
          <div class="barcode-box">${barcodeSvg(sn, 48, 0.92)}</div>
          <div class="val-sn">${esc(sn)}</div>
        </div>
      </div></div>`;
    out += one + one;
  });
  return out;
}

// Новая этикетка 130x76 мм, по 2 копии на каждый SN
export function newPages(list, withBrand) {
  let out = '';
  list.forEach((p) => {
    const pn = p.pn || 'N/A', sn = p.sn || 'N/A', brand = p.brand || '-';
    const one = `<div class="pg"><div class="lbl-new">
        ${withBrand ? `<div class="brand-new">${esc(brand)}</div>` : ''}
        <div class="bw-pn">${barcodeSvg(pn, 48, 1.3, true)}</div>
        <div class="cap">PN</div>
        <div class="val">${esc(pn)}</div>
        <div class="cap">SN</div>
        <div class="bw-sn">${barcodeSvg(sn, 48, 1.0, true)}</div>
        <div class="val">${esc(sn)}</div>
      </div></div>`;
    out += one + one;
  });
  return out;
}

/* Печать HTML-документа через скрытый iframe.
   opts.id          id iframe (прежний удаляется), по умолчанию 'printFrame'
   opts.delay       пауза перед печатью, мс (по умолчанию 250; для растровых картинок 400)
   opts.beforePrint функция(win): подгонка документа перед печатью (получает окно iframe)
   opts.cleanupMs   через сколько мс после печати убрать iframe */
export function printInFrame(html, opts = {}) {
  const { id = 'printFrame', delay = 250, beforePrint = null, cleanupMs = 500 } = opts;
  const old = document.getElementById(id);
  if (old) old.remove();
  const f = document.createElement('iframe');
  f.id = id;
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;';
  document.body.appendChild(f);
  const w = f.contentWindow;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.onafterprint = () => setTimeout(() => f.remove(), cleanupMs);
  setTimeout(() => {
    if (beforePrint) { try { beforePrint(w); } catch (e) {} }
    w.focus();
    w.print();
  }, delay);
}

// Документ этикеток размером w×h мм из готовых страниц (stdPages / newPages)
export function printDoc(pages, w, h, opts) {
  printInFrame(
    `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Label</title><style>@page{size:${w}mm ${h}mm;margin:0}${PRINT_CSS}</style></head><body>${pages}</body></html>`,
    opts
  );
}

// Печать списка в нужном формате: mode '2' = 130×76, иначе 100×78
export function printList(list, withBrand, mode, opts) {
  if (mode === '2') printDoc(newPages(list, withBrand), 130, 76, opts);
  else printDoc(stdPages(list, withBrand), 100, 78, opts);
}
