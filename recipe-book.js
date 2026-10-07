// ── RECIPES IN THE BOOK ─────────────────────────────────────
// The Recipes chapter as pages of the History book (history-book.js).
// First a fold-out plate printed across the open spread, as in a lay-flat
// book: the oak pâtisserie cabinet with its six cakes, three to a shelf, and
// only a faint crease at the fold. Then one spread per recipe: the cake and
// the baker's note on the left page, ingredients and method on the right.
//
// history-book.js puts recipePages() into the book, then calls attach() with
// the book. Choosing a cake turns one page and its recipe is open; "Back to
// the shelf" (or Escape) turns one page back. Pages further apart than one
// turn are reached the same way (see turnTo below).
//
// Relies on globals from index.html: RJ, T, t, currentLang, getStampState.

Object.assign(T.en, {
  'book.recipes.kicker': 'Chapter II',
  'book.recipes.hint': 'Choose a cake to open its recipe.',
  'book.recipes.count': '{n} cakes on the shelf',
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
  'book.recipes.count': '架上 {n} 款蛋糕',
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
const LIFT_MS = 160;   // the cake rises off the shelf before the page turns
const TURN_MS = 700;   // a turn to or from a recipe: brisk, the same for every cake
const RETURNED_MS = 1800;   // back on the shelf, the cake you came from stays lit this long

// ── The fold-out ──
// The painting (images/shelf/scene/cabinet.webp, 1536×1024, the same one the
// Recipes page uses outside the book) is laid across both pages: the same
// .rb-spread layer sits on each page, shifted by a page width, and each page
// shows its own half. Inside the layer, 1cqw is 1% of the painting's width.
// recipe-book.css sizes and places the layer (174cqw wide, 13cqw in from each
// outer edge).
// Each cake has a cut-out of the painting and a patch of bare shelf to put
// behind it, so it can be lifted off the shelf: x, y, w, h of the cut-out;
// tx is the plate's centre within the box; ty the label's top within the box.
const SCENE = {
  orange:       { x:14.118, y:25.372, w:17.857, h:13.096, tx:8.809, ty:13.453 },
  marble:       { x:40.309, y:25.372, w:18.155, h:13.096, tx:9.048, ty:13.453 },
  classic:      { x:67.393, y:25.372, w:18.452, h:13.096, tx:9.048, ty:13.453 },
  rum:          { x:13.821, y:46.801, w:18.452, h:13.691, tx:9.204, ty:13.928 },
  blueberry:    { x:40.309, y:46.801, w:18.452, h:13.691, tx:9.137, ty:13.928 },
  chocZucchini: { x:67.096, y:46.801, w:18.452, h:13.691, tx:9.018, ty:13.928 },
};
const LAYER = { width:174, left:13 };   // in page cqw, as in recipe-book.css

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

// A cake on one page's half of the spread. The middle column lies across the
// fold, so it is drawn on both pages; the right-hand copy is a twin, left out
// of the tab order, that lights and lifts with the original.
function cakeHTML(id, twin){
  const b = SCENE[id];
  return `
    <button class="rb-cake" type="button" data-recipe="${id}"${twin ? ' data-twin tabindex="-1" aria-hidden="true"' : ''}
            style="--x:${b.x}cqw;--y:${b.y}cqw;--w:${b.w}cqw;--h:${b.h}cqw;--tx:${b.tx}cqw;--ty:${b.ty}cqw">
      <img class="rb-cake-bare" src="./images/shelf/scene/${id}-bare.webp" alt="" draggable="false">
      <img class="rb-cake-img" src="./images/shelf/scene/${id}.webp" alt="" draggable="false">
      <span class="rb-tag">
        <span class="rb-tag-no"><small>No.</small><span class="rb-tag-n"></span></span>
        <span class="rb-tag-text"><span class="rb-tag-name"></span><span class="rb-tag-src"></span></span>
        <span class="rb-tag-stamp"></span>
      </span>
    </button>`;
}

// The cakes whose box reaches onto a page (side 0 left, 1 right).
function spreadHTML(side){
  const pageStart = side * 100, pageEnd = pageStart + 100;
  const toSpread = v => LAYER.left + v * LAYER.width / 100;
  const cakes = IDS.filter(id => {
    const b = SCENE[id];
    return toSpread(b.x) < pageEnd && toSpread(b.x + b.w) > pageStart;
  }).map(id => {
    const onBoth = toSpread(SCENE[id].x) < 100 && toSpread(SCENE[id].x + SCENE[id].w) > 100;
    return cakeHTML(id, side === 1 && onBoth);
  });
  return `
    <div class="rb-spread">
      <img class="rb-shelf-img" src="./images/shelf/scene/cabinet.webp" alt="" width="1536" height="1024" draggable="false">
      ${cakes.join('')}
    </div>`;
}

function page(cls, html, n){
  const el = document.createElement('div');
  el.className = 'hb-page ' + cls;
  el.innerHTML = html + `<span class="hb-num">${n}</span>`;
  return el;
}

// The chapter's pages, numbered on from `firstNumber` (the folio on the first page).
export function recipePages(firstNumber){
  const left = page('hb-left rb-opener', `
    ${spreadHTML(0)}
    <header class="rb-head">
      <p class="rb-kicker" data-i18n="book.recipes.kicker">${t('book.recipes.kicker')}</p>
      <h2 class="rb-title" data-i18n="recipes.title">${t('recipes.title')}</h2>
    </header>`, firstNumber);
  const right = page('hb-right rb-opener', `
    ${spreadHTML(1)}
    <header class="rb-head">
      <p class="rb-count"></p>
      <p class="rb-dek" data-i18n="recipes.subtitle">${t('recipes.subtitle')}</p>
      <p class="rb-hint" data-i18n="book.recipes.hint">${t('book.recipes.hint')}</p>
    </header>`, firstNumber + 1);
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
    btn.querySelector('.rb-tag-n').textContent = IDS.indexOf(id) + 1;
    btn.querySelector('.rb-tag-name').innerHTML = nameOf(id);
    btn.querySelector('.rb-tag-src').textContent = sourceOf(id);
    tagStamp(btn, id);
  });
  const count = pg.querySelector('.rb-count');
  if(count) count.textContent = t('book.recipes.count').replace('{n}', IDS.length);
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

function tagStamp(btn, id){
  const el = btn.querySelector('.rb-tag-stamp'), s = getStampState(id);
  el.textContent = stampLine(id);
  el.className = 'rb-tag-stamp' + (s.made ? ' made' : s.wish ? ' wish' : '');
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
//   pages: every page element of the book, in order;
//   isOpen(): whether the book is showing; onNextChapter(): go on to Tips.
export function attach(pageFlip, { start, root, pages, isOpen, onNextChapter }){
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

  // ── One turn to any page ──
  // Turning page by page to a recipe five spreads on means watching five other
  // recipes go by. Instead, the spread next to this one borrows the target's
  // pages for a single turn: going forward, the turn reveals the borrowed
  // pages, then the book quietly settles on the real ones (they look the
  // same); going back, the book first settles on the borrowing spread, then
  // turns back. Both swaps happen between two frames, so nothing jumps.
  const pagesOf = sp => landscape() ? (sp === 0 ? [0] : [2 * sp - 1, 2 * sp]) : [sp];
  const firstPage = sp => pagesOf(sp)[0];
  // Swap two pages' contents: their children, and our classes and data (not the library's own).
  function swapPages(a, b){
    const own = el => [...el.classList].filter(c => !c.startsWith('stf__'));
    const ca = own(a), cb = own(b), ea = a.dataset.era, eb = b.dataset.era;
    const kids = [...a.childNodes];
    a.replaceChildren(...b.childNodes);
    b.replaceChildren(...kids);
    a.classList.remove(...ca); a.classList.add(...cb);
    b.classList.remove(...cb); b.classList.add(...ca);
    if(eb === undefined) delete a.dataset.era; else a.dataset.era = eb;
    if(ea === undefined) delete b.dataset.era; else b.dataset.era = ea;
  }
  function swapSpreads(s1, s2){
    const p1 = pagesOf(s1), p2 = pagesOf(s2);
    p1.forEach((p, k) => swapPages(pages[p], pages[p2[k]]));
  }

  let riffle = null;   // the turn under way: { dir, to, swapped, done, started }
  const normalTime = pageFlip.getSettings().flippingTime;
  // 'fold_corner' is only the corner lifting under the mouse: a turn can start from it.
  const ready = () => ['read', 'fold_corner'].includes(pageFlip.getState());
  function turnTo(target, done){
    const from = spreadOf(index()), to = spreadOf(target);
    if(from === to){ done?.(); return; }
    const dir = Math.sign(to - from);
    riffle = { dir, to, done, swapped:null };
    pageFlip.getSettings().flippingTime = TURN_MS;
    if(Math.abs(to - from) > 1){
      if(dir > 0){
        // the next spread wears the target's pages for the turn
        riffle.swapped = [from + 1, to];
        swapSpreads(from + 1, to);
      } else {
        // the spread beside the target wears this one's pages; settle there first
        riffle.swapped = [to + 1, from];
        swapSpreads(to + 1, from);
        pageFlip.turnToPage(firstPage(to + 1));
      }
    }
    requestAnimationFrame(turn);
  }
  function turn(){
    if(!riffle) return;
    if(!ready()){ setTimeout(turn, 30); return; }
    riffle.started = true;
    riffle.dir > 0 ? pageFlip.flipNext('bottom') : pageFlip.flipPrev('bottom');
  }
  // (the quiet jump to the borrowing spread is a 'flip' too: only the turn's own one counts)
  pageFlip.on('flip', () => {
    if(!riffle?.started) return;
    const { swapped, to, done } = riffle;
    riffle = null;
    pageFlip.getSettings().flippingTime = normalTime;
    if(swapped){
      swapSpreads(...swapped);
      if(spreadOf(index()) !== to) pageFlip.turnToPage(firstPage(to));
    }
    done?.();
  });

  const cakeButtons = id => root.querySelectorAll(`.rb-cake[data-recipe="${id}"]`);
  let returnedTimer = 0;

  let picking = false;   // a cake is lifted and its recipe is about to open
  function pick(id){
    if(riffle || picking || !ready() || where() !== 'shelf') return;
    const btns = cakeButtons(id);
    btns.forEach(b => b.classList.add('lifted'));
    picking = true;
    setTimeout(() => turnTo(pageOf(id), () => { picking = false; btns.forEach(b => b.classList.remove('lifted', 'pointed', 'hover')); }),
      reducedMotion() ? 0 : LIFT_MS);
  }
  // Back to the shelf; the cake you came from stays lit for a moment, so you know where you were.
  function back(){
    const id = where();
    if(riffle || !id || id === 'shelf') return;
    turnTo(start, () => {
      root.querySelectorAll('.rb-cake.returned').forEach(b => b.classList.remove('returned'));
      cakeButtons(id).forEach(b => b.classList.add('returned'));
      clearTimeout(returnedTimer);
      returnedTimer = setTimeout(() => cakeButtons(id).forEach(b => b.classList.remove('returned')), RETURNED_MS);
    });
  }
  function point(id){
    root.querySelectorAll('.rb-cake').forEach(b => b.classList.toggle('pointed', b.dataset.recipe === id));
  }

  function refreshStamps(id){
    root.querySelectorAll(`.rb-in[data-recipe="${id}"]`).forEach(el => renderStampButtons(el, id));
    cakeButtons(id).forEach(b => tagStamp(b, id));
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

  // A cake drawn across the fold is two buttons: hovering or focusing either lights both.
  const light = (e, on) => {
    const cake = e.target.closest?.('.rb-cake');
    if(cake && !(e.relatedTarget && cake.contains(e.relatedTarget))) cakeButtons(cake.dataset.recipe).forEach(b => b.classList.toggle('hover', on));
  };
  root.addEventListener('mouseover', e => light(e, true));
  root.addEventListener('mouseout', e => light(e, false));
  root.addEventListener('focusin', e => light(e, true));
  root.addEventListener('focusout', e => light(e, false));

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
    start, pageOf, where, pick, back, point, mark, scrollBy, riffleTo: turnTo,
    cakes: () => where() === 'shelf' ? [...root.querySelectorAll('.rb-cake:not([data-twin])')] : [],
    get busy(){ return !!riffle || picking; },
    refresh(){ root.querySelectorAll('.hb-page').forEach(fill); },
  };
}
