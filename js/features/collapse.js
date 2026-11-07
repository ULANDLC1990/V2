/* Сворачивание карточек на страницах Panel Label, Special Label и PN Base.
   Клик по заголовку карточки сворачивает/разворачивает её, стрелок нет.
   Вызывается из main.js ПОСЛЕ init() страниц label / pnbase / special (карточки уже построены).
   init({ labelPage: функция }) — что вызвать после раскрытия карточки на странице Label
   (превью этикетки нужно перерисовать после показа). */
import { lsGet, lsSet } from '../core/util.js';

const CSS = `
.card-head {
  cursor: pointer;
  user-select: none;
}
.card-head:hover .manual-input-title { color: #2563EB; }
.card-head.untitled {
  height: 14px;
  margin: -6px -6px 6px -6px;
  border-radius: 6px 6px 0 0;
  background: #1f2937;
}
.card-head.untitled:hover { background: #374151; }
.card-head .manual-input-title { margin-bottom: 0; }
.card-body { display: block; }
.card-collapsed .card-body { display: none; }
.card-collapsed .card-head { margin-bottom: 0; }
`;

function makeCollapsible(card, storageKey, onExpand) {
  if (card.dataset.collapsible) return;
  card.dataset.collapsible = '1';

  // Заголовок карточки (если есть) переносим в шапку, остальное — в тело
  const title = card.querySelector(':scope > .manual-input-title');
  const head = document.createElement('div');
  head.className = 'card-head' + (title ? '' : ' untitled');
  if (title) head.appendChild(title);

  const body = document.createElement('div');
  body.className = 'card-body';
  while (card.firstChild) body.appendChild(card.firstChild);

  card.appendChild(head);
  card.appendChild(body);

  let collapsed = lsGet(storageKey) === '1';
  apply(collapsed);

  head.addEventListener('click', () => {
    collapsed = !collapsed;
    apply(collapsed);
    lsSet(storageKey, collapsed ? '1' : '0');
    if (!collapsed && onExpand) onExpand(); // превью этикетки нужно перерисовать после показа
  });

  function apply(c) {
    card.classList.toggle('card-collapsed', c);
  }
}

export function init({ labelPage } = {}) {
  const PAGE_LIST = [
    { id: 'labelPage',   name: 'label',   onExpand: labelPage || null },
    { id: 'pnbasePage',  name: 'pnbase',  onExpand: null },
    { id: 'specialPage', name: 'special', onExpand: null }
  ];

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  PAGE_LIST.forEach(page => {
    const root = document.getElementById(page.id);
    if (!root) return;
    root.querySelectorAll('.manual-input-card').forEach((card, i) => {
      makeCollapsible(card, `collapse:${page.name}:${i}`, page.onExpand);
    });
  });
}
