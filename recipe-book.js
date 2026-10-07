// ── RECIPES IN THE BOOK ─────────────────────────────────────
// The Recipes chapter as pages of the History book (history-book.js).
// First a fold-out plate across the open spread: an oak pâtisserie cabinet
// whose centre post runs down the book's spine, three cakes on each page,
// each beside a small standing card. Then one spread per recipe: the cake
// and the baker's note on the left page, ingredients and method on the right.
//
// history-book.js puts recipePages() into the book, then calls attach() with
// the book. Choosing a cake riffles through the pages to its recipe; "Back to
// the shelf" (or Escape) riffles back.
//
// Relies on globals from index.html: RJ, T, t, currentLang, getStampState.

Object.assign(T.en, {
  'book.recipes.kicker': 'Chapter II',
  'book.recipes.hint': 'Choose a cake to open its recipe.',
  'book.back': '← Back to the shelf',
  'book.ingredients': 'Ingredients',
  'book.method': 'Method',
  'book.note': 'The baker’s note',
  'book.made': '✓ Baked',
  'book.wish': '♡ Want to bake',
  'book.next': 'Next chapter: Baker’s Tips →',
  'book.no': 'No. {n}',
});
Object.assign(T.zh, {
  'book.recipes.kicker': '第二章',
  'book.recipes.hint': '选一块蛋糕，翻到它的食谱。',
  'book.back': '← 回到橱架',
  'book.ingredients': '食材',
  'book.method': '做法',
  'book.note': '烘焙心得',
  'book.made': '✓ 做过了',
  'book.wish': '♡ 想做',
  'book.next': '下一章：烘焙笔记 →',
  'book.no': '第 {n} 款',
});

const IDS = Object.keys(RJ);
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const LIFT_MS = 380;   // the cake rises off the shelf before the pages turn

// ── The fold-out ──
// The painting (images/book/shelf.webp) is 1512×908 px. On the spread it is
// 180cqw wide (a page is 100cqw), 10cqw in from the book's outer edges and
// 18cqw below the top of the page, so its centre post lies on the spine.
// Everything below is in painting pixels and converted to page cqw.
const SHELF = { w:1512, width:180, left:10, top:18 };
const K = SHELF.width / SHELF.w;
const PLATE = { width:245, x:[300, 1212], bottom:[310, 568, 826] };   // per half / per row
const CARD = { width:212, height:100, x:[566, 946] };                 // the standing card beside each plate
const BAY = { x:[[60, 734], [778, 1452]], y:[[76, 316], [334, 574], [592, 832]] };
// Each cut-out cake (images/shelf/scene/*.webp): its size, and its plate's centre, lowest point and width
const SPRITE = {
  orange:       { w:300, h:220, cx:146.5, b:203, pw:271 },
  marble:       { w:305, h:220, cx:153.6, b:203, pw:271 },
  classic:      { w:310, h:220, cx:154.0, b:204, pw:276 },
  rum:          { w:310, h:230, cx:155.5, b:210, pw:273 },
  blueberry:    { w:310, h:230, cx:154.5, b:211, pw:275 },
  chocZucchini: { w:310, h:230, cx:153.0, b:212, pw:276 },
};
const cq = v => `${(v * K).toFixed(3)}cqw`;

// ── Text ──
const isZh = () => currentLang === 'zh';
const numberOf = id => t('book.no').replace('{n}', IDS.indexOf(id) + 1);
const nameOf = id => isZh() ? (RJ[id].zh_name || t('recipe.' + id)) : t('recipe.' + id);
const sourceOf = id => isZh() ? (RJ[id].zh_source || RJ[id].source) : RJ[id].source;
const field = (id, key) => (isZh() && RJ[id]['zh_' + key]) || RJ[id][key];

function stampLine(id){
  const s = getStampState(id);
  return s.made ? t('book.made') : s.wish ? t('book.wish') : '';
}

// ── Pages ──

function cakeHTML(id, i){
  const side = i < 3 ? 0 : 1, row = i % 3;     // left page holds cakes 1–3, right page 4–6
  const [bx0, bx1] = BAY.x[side], [by0, by1] = BAY.y[row];
  const sp = SPRITE[id], s = PLATE.width / sp.pw;
  const imgX = PLATE.x[side] - sp.cx * s, imgY = PLATE.bottom[row] - sp.b * s;
  const cardX = CARD.x[side] - CARD.width / 2, cardY = PLATE.bottom[row] - 8 - CARD.height;
  const pageLeft = SHELF.left / K - side * 100 / K;   // where the page's left edge is, in painting px
  return `
    <button class="rb-cake" type="button" data-recipe="${id}"
            style="left:${cq(pageLeft + bx0)};top:calc(${SHELF.top}cqw + ${cq(by0)});width:${cq(bx1 - bx0)};height:${cq(by1 - by0)}">
      <span class="rb-cake-shadow" style="left:${cq(PLATE.x[side] - bx0 - PLATE.width * .46)};top:${cq(PLATE.bottom[row] - by0 - PLATE.width * .13)};width:${cq(PLATE.width * .92)};height:${cq(PLATE.width * .16)}"></span>
      <img class="rb-cake-img" src="./images/shelf/scene/${id}.webp" alt="" draggable="false"
           style="left:${cq(imgX - bx0)};top:${cq(imgY - by0)};width:${cq(sp.w * s)};height:${cq(sp.h * s)}">
      <span class="rb-card" style="left:${cq(cardX - bx0)};top:${cq(cardY - by0)};width:${cq(CARD.width)};height:${cq(CARD.height)}">
        <span class="rb-card-no"></span>
        <span class="rb-card-name"></span>
        <span class="rb-card-stamp"></span>
      </span>
    </button>`;
}

function page(cls, html, n){
  const el = document.createElement('div');
  el.className = 'hb-page ' + cls;
  el.innerHTML = html + `<span class="hb-num">${n}</span>`;
  return el;
}

// The chapter's pages, numbered on from `firstNumber` (the folio on the first page).
export function recipePages(firstNumber){
  const shelfImg = `<img class="rb-shelf-img" src="./images/book/shelf.webp" alt="" width="1512" height="908" draggable="false">`;
  const left = page('hb-left rb-opener', `
    ${shelfImg}
    <header class="rb-head">
      <p class="rb-kicker" data-i18n="book.recipes.kicker">${t('book.recipes.kicker')}</p>
      <h2 class="rb-title" data-i18n="recipes.title">${t('recipes.title')}</h2>
    </header>
    ${IDS.slice(0, 3).map((id, i) => cakeHTML(id, i)).join('')}`, firstNumber);
  const right = page('hb-right rb-opener', `
    ${shelfImg}
    <header class="rb-head">
      <p class="rb-dek" data-i18n="recipes.subtitle">${t('recipes.subtitle')}</p>
      <p class="rb-hint" data-i18n="book.recipes.hint">${t('book.recipes.hint')}</p>
    </header>
    ${IDS.slice(3).map((id, i) => cakeHTML(id, i + 3)).join('')}`, firstNumber + 1);
  const pages = [left, right];

  IDS.forEach((id, i) => {
    const n = firstNumber + 2 + i * 2;
    pages.push(page('hb-left rb-recipe', `
      <div class="rb-in" data-recipe="${id}">
        <button class="rb-back" type="button" data-i18n="book.back">${t('book.back')}</button>
        <figure class="rb-plate"><img src="./images/shelf/${id}.webp" alt="" width="640" height="478" draggable="false"></figure>
        <p class="rb-no"></p>
        <h2 class="rb-name"></h2>
        <p class="rb-src"></p>
        <p class="rb-tags"></p>
        <div class="rb-stamps">
          <button class="rb-stamp made" type="button" data-kind="made" aria-pressed="false"></button>
          <button class="rb-stamp wish" type="button" data-kind="wish" aria-pressed="false"></button>
        </div>
        <div class="rb-note-wrap">
          <p class="rb-label rb-note-label" data-i18n="book.note">${t('book.note')}</p>
          <p class="rb-note"></p>
        </div>
      </div>`, n));
    pages.push(page('hb-right rb-recipe', `
      <div class="rb-scroll" data-recipe="${id}">
        <p class="rb-label" data-i18n="book.ingredients">${t('book.ingredients')}</p>
        <ul class="rb-ing"></ul>
        <p class="rb-label" data-i18n="book.method">${t('book.method')}</p>
        <div class="rb-method"></div>
        ${i === IDS.length - 1 ? `<button class="rb-next" type="button" data-i18n="book.next">${t('book.next')}</button>` : ''}
      </div>`, n + 1));
  });

  pages.forEach(fill);
  return pages;
}

// Write (or rewrite, on a language change) the words on one page.
function fill(pg){
  pg.querySelectorAll('.rb-cake').forEach(btn => {
    const id = btn.dataset.recipe;
    btn.setAttribute('aria-label', nameOf(id));
    btn.querySelector('.rb-card-no').textContent = numberOf(id);
    btn.querySelector('.rb-card-name').innerHTML = nameOf(id);
    btn.querySelector('.rb-card-stamp').textContent = stampLine(id);
  });
  const intro = pg.querySelector('.rb-in');
  if(intro){
    const id = intro.dataset.recipe, r = RJ[id];
    intro.querySelector('.rb-plate img').alt = nameOf(id);
    intro.querySelector('.rb-no').textContent = numberOf(id);
    intro.querySelector('.rb-name').innerHTML = nameOf(id);
    intro.querySelector('.rb-src').textContent = sourceOf(id);
    intro.querySelector('.rb-tags').textContent = (field(id, 'tags') || []).join(' · ');
    intro.querySelector('.rb-note').innerHTML = field(id, 'thinking') || '';
    renderStampButtons(intro, id);
  }
  const body = pg.querySelector('.rb-scroll');
  if(body){
    const id = body.dataset.recipe;
    body.querySelector('.rb-ing').innerHTML = (field(id, 'ing') || []).map(line => {
      const s = line.trim();
      return /^[—–]/.test(s) ? `<li class="note">${s.replace(/^[—–]\s*/, '')}</li>` : `<li>${s}</li>`;
    }).join('');
    const method = field(id, 'method');
    body.querySelector('.rb-method').innerHTML = Array.isArray(method)
      ? `<ol>${method.map(step => `<li>${step}</li>`).join('')}</ol>`
      : `<p>${method || ''}</p>`;
  }
}

function renderStampButtons(scope, id){
  const s = getStampState(id);
  scope.querySelectorAll('.rb-stamp').forEach(b => {
    const on = !!s[b.dataset.kind];
    b.setAttribute('aria-pressed', String(on));
    b.textContent = t('book.' + b.dataset.kind);
  });
}

// ✓ Baked and ♡ Want to bake rule each other out, as on the recipe card.
function toggleStamp(id, kind){
  const other = kind === 'made' ? 'wish' : 'made';
  try {
    if(localStorage.getItem(`rj-${kind}-${id}`)) localStorage.removeItem(`rj-${kind}-${id}`);
    else { localStorage.setItem(`rj-${kind}-${id}`, '1'); localStorage.removeItem(`rj-${other}-${id}`); }
  } catch(e){ /* storage unavailable: nothing to remember */ }
  return getStampState(id)[kind];
}

// ── Behaviour ──
// attach(pageFlip, options)
//   start: index of the chapter's first page; root: the book element;
//   isOpen(): whether the book is showing; onNextChapter(): go on to Tips.
export function attach(pageFlip, { start, root, isOpen, onNextChapter }){
  const pageOf = id => start + 2 + IDS.indexOf(id) * 2;
  const landscape = () => pageFlip.getOrientation() === 'landscape';
  const spreadOf = p => landscape() ? (p === 0 ? 0 : Math.floor((p + 1) / 2)) : p;
  const index = () => pageFlip.getCurrentPageIndex();

  // 'shelf', a recipe id, or null when the book is elsewhere.
  function where(){
    const i = index();
    if(!isOpen() || i < start) return null;
    if(i < start + 2) return 'shelf';
    return IDS[Math.floor((i - start - 2) / 2)] || null;
  }

  // ── Riffle: turn page after page until `target` is open, quickly when it is far ──
  let riffle = null;
  const normalTime = pageFlip.getSettings().flippingTime;
  function riffleTo(target, done){
    const from = spreadOf(index()), to = spreadOf(target);
    if(from === to){ done?.(); return; }
    const steps = Math.abs(to - from);
    riffle = { dir: Math.sign(to - from), to, done };
    pageFlip.getSettings().flippingTime = steps === 1 ? normalTime : Math.max(140, Math.min(420, 1300 / steps));
    turn();
  }
  // 'fold_corner' is only the corner lifting under the mouse: a turn can start from it.
  const ready = () => ['read', 'fold_corner'].includes(pageFlip.getState());
  function turn(){
    if(!riffle) return;
    if(!ready()){ setTimeout(turn, 30); return; }
    riffle.dir > 0 ? pageFlip.flipNext('bottom') : pageFlip.flipPrev('bottom');
  }
  pageFlip.on('flip', () => {
    if(!riffle) return;
    if(spreadOf(index()) !== riffle.to){ setTimeout(turn, 20); return; }
    const done = riffle.done;
    riffle = null;
    pageFlip.getSettings().flippingTime = normalTime;
    done?.();
  });

  const cakeButton = id => root.querySelector(`.rb-cake[data-recipe="${id}"]`);

  let picking = false;   // a cake is lifted and its recipe is about to open
  function pick(id){
    if(riffle || picking || !ready() || where() !== 'shelf') return;
    const btn = cakeButton(id);
    btn?.classList.add('lifted');
    picking = true;
    setTimeout(() => riffleTo(pageOf(id), () => { picking = false; btn?.classList.remove('lifted', 'pointed'); }),
      reducedMotion() ? 0 : LIFT_MS);
  }
  function back(){
    if(riffle || !where() || where() === 'shelf') return;
    riffleTo(start);
  }
  function point(id){
    root.querySelectorAll('.rb-cake').forEach(b => b.classList.toggle('pointed', b.dataset.recipe === id));
  }

  function refreshStamps(id){
    root.querySelectorAll(`.rb-in[data-recipe="${id}"]`).forEach(el => renderStampButtons(el, id));
    const card = cakeButton(id)?.querySelector('.rb-card-stamp');
    if(card) card.textContent = stampLine(id);
  }
  function mark(kind, id = where()){
    if(!id || id === 'shelf') return false;
    const on = toggleStamp(id, kind);
    refreshStamps(id);
    return on;
  }

  root.addEventListener('click', e => {
    const cake = e.target.closest('.rb-cake');
    if(cake){ pick(cake.dataset.recipe); return; }
    if(e.target.closest('.rb-back')){ back(); return; }
    const stamp = e.target.closest('.rb-stamp');
    if(stamp){ mark(stamp.dataset.kind, stamp.closest('.rb-in').dataset.recipe); return; }
    if(e.target.closest('.rb-next')) onNextChapter?.();
  });

  // A long recipe scrolls inside its page; the fade at the foot lifts at the end.
  root.querySelectorAll('.rb-scroll, .rb-note-wrap').forEach(el => {
    const update = () => el.classList.toggle('at-end', el.scrollTop + el.clientHeight >= el.scrollHeight - 4);
    el.addEventListener('scroll', update, { passive:true });
    requestAnimationFrame(update);
  });
  function scrollBy(amount){
    const id = where();
    const el = id && id !== 'shelf' && root.querySelector(`.rb-scroll[data-recipe="${id}"]`);
    if(el) el.scrollTop += amount * el.clientHeight;
  }

  return {
    start, pageOf, where, pick, back, point, mark, scrollBy, riffleTo,
    cakes: () => where() === 'shelf' ? [...root.querySelectorAll('.rb-cake')] : [],
    get busy(){ return !!riffle || picking; },
    refresh(){ root.querySelectorAll('.hb-page').forEach(fill); },
  };
}
