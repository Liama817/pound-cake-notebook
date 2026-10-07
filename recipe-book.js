// ── RECIPE BOOK ─────────────────────────────────────────────
// The recipes as a small book of their own, one spread per recipe: the cake
// and the baker's note on the left page, ingredients and method on the right.
// The Recipes page is the shelf (recipe-shelf.js); choosing a cake there
// opens this book at that cake's recipe, over the shelf. "Back to the shelf",
// Escape, a click beside the book, or turning back past the first recipe
// close it again. Pages bend and curl as they turn (StPageFlip, as in
// history-book.js).
//
// If the library can't load, nothing here runs and the shelf opens the
// recipe card (openRecipeModal) instead.
//
// Relies on globals from index.html: RJ, T, t, currentLang, getStampState,
// switchSection, setLang; and window.recipeShelf (recipe-shelf.js).

import { PageFlip } from 'https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.module.js';
import { bookDrag } from './book-drag.js';

Object.assign(T.en, {
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
const FIRST_FOLIO = 15;   // the History chapter ends on page 14
const FADE_MS = 360;      // the book leaving the shelf: book first, then the table (recipe-book.css)
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Text ──
const isZh = () => currentLang === 'zh';
const numberOf = id => t('book.no').replace('{n}', IDS.indexOf(id) + 1);
const nameOf = id => isZh() ? (RJ[id].zh_name || t('recipe.' + id)) : t('recipe.' + id);
const sourceOf = id => isZh() ? (RJ[id].zh_source || RJ[id].source) : RJ[id].source;
const field = (id, key) => (isZh() && RJ[id]['zh_' + key]) || RJ[id][key];

// ── Pages ──

function page(cls, html, n){
  const el = document.createElement('div');
  el.className = 'hb-page ' + cls;
  el.innerHTML = html + `<span class="hb-num">${n}</span>`;
  return el;
}

function recipePages(firstNumber){
  const pages = [];
  IDS.forEach((id, i) => {
    const n = firstNumber + i * 2;
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

// ── The book ──

const stage = document.createElement('div');
stage.className = 'hb-stage rb-stage away';
stage.innerHTML = '<div class="hb-book"></div>';
document.body.appendChild(stage);
const bookEl = stage.querySelector('.hb-book');

const pageFlip = new PageFlip(bookEl, {
  width: 460, height: 620, size: 'stretch',
  minWidth: 240, maxWidth: 620, minHeight: 320, maxHeight: 840,
  showCover: false,
  usePortrait: true,          // one page at a time on narrow screens
  flippingTime: 700,
  maxShadowOpacity: 0.45,
  drawShadow: true,
  showPageCorners: false,     // the pages hold buttons: no corner lifting under the mouse
  disableFlipByClick: true,   // …and a click is for them, not for turning (drag a corner to turn)
  mobileScrollSupport: true,  // vertical swipes scroll a long recipe; sideways ones turn
  autoSize: false,            // history-book.css sizes .hb-book
});
pageFlip.loadFromHTML(recipePages(FIRST_FOLIO));
const { canTurn, drag } = bookDrag(pageFlip);

const pageOf = id => IDS.indexOf(id) * 2;
const isOpen = () => !stage.classList.contains('away');
// The recipe open in the book, or null when the book is closed.
const where = () => isOpen() ? IDS[Math.floor(pageFlip.getCurrentPageIndex() / 2)] || null : null;

let fading = false;
// The table starts right under the site's header, whatever its height.
function fitUnderHeader(){
  const header = document.querySelector('.book-header');
  stage.style.top = header ? `${Math.round(header.getBoundingClientRect().bottom)}px` : '';
}
window.addEventListener('resize', () => { if(isOpen()) fitUnderHeader(); });

// Open the book at a recipe, over the shelf.
function open(id){
  if(!(id in RJ)) return;
  pageFlip.turnToPage(pageOf(id));
  stage.classList.remove('away');
  document.body.classList.add('rb-reading');
  document.body.classList.remove('on-recipes');
  fitUnderHeader();   // after the header has taken the dark reading look, which changes its height
  stage.querySelectorAll('.rb-scroll, .rb-note-wrap').forEach(el => { el.scrollTop = 0; });
  requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.add('shown')));
}
// Close the book and go back to the shelf, where the cake you came from is lit.
function close({ toShelf = true } = {}){
  if(!isOpen()) return;
  const id = where();
  drag.end();
  stage.classList.remove('shown');
  document.body.classList.remove('rb-reading');
  const done = () => {
    fading = false;
    stage.classList.add('away');
  };
  if(toShelf){
    document.body.classList.add('on-recipes');
    window.recipeShelf?.settle(id, { returned:true });
    fading = true;
    setTimeout(done, reducedMotion() ? 0 : FADE_MS);
  } else {
    window.recipeShelf?.settle(id, { returned:false });
    done();
  }
}
const back = () => close();
const nextChapter = () => switchSection('tips');

function mark(kind, id = where()){
  if(!id) return false;
  const on = toggleStamp(id, kind);
  bookEl.querySelectorAll(`.rb-in[data-recipe="${id}"]`).forEach(el => renderStampButtons(el, id));
  return on;
}

bookEl.addEventListener('click', e => {
  if(e.target.closest('.rb-back')){ back(); return; }
  const stamp = e.target.closest('.rb-stamp');
  if(stamp){ mark(stamp.dataset.kind, stamp.closest('.rb-in').dataset.recipe); return; }
  if(e.target.closest('.rb-next')) nextChapter();
});
// A click beside the book puts it down.
stage.addEventListener('click', e => { if(e.target === stage) back(); });

document.addEventListener('keydown', e => {
  if(!isOpen() || fading) return;
  if(e.key === 'Escape'){ e.preventDefault(); back(); }
  if(e.key === 'ArrowRight'){ e.preventDefault(); canTurn(1) ? pageFlip.flipNext('bottom') : nextChapter(); }
  if(e.key === 'ArrowLeft'){ e.preventDefault(); canTurn(-1) ? pageFlip.flipPrev('bottom') : back(); }
});

// A long recipe scrolls inside its page; the fade at the foot lifts at the end.
bookEl.querySelectorAll('.rb-scroll, .rb-note-wrap').forEach(el => {
  const update = () => el.classList.toggle('at-end', el.scrollTop + el.clientHeight >= el.scrollHeight - 4);
  el.addEventListener('scroll', update, { passive:true });
  requestAnimationFrame(update);
});
function scrollBy(amount){
  const id = where();
  const el = id && bookEl.querySelector(`.rb-scroll[data-recipe="${id}"]`);
  if(el) el.scrollTop += amount * el.clientHeight;
}

// Any other section (or Recipes again, from its tab) puts the book away.
const originalSwitchSection = window.switchSection;
window.switchSection = function(s){
  if(isOpen()) close({ toShelf:false });
  originalSwitchSection(s);
};

const originalSetLang = window.setLang;
window.setLang = function(lang){
  originalSetLang(lang);
  bookEl.querySelectorAll('.hb-page').forEach(fill);
};

// For the hand tracker (hand-flip.js) and tests.
window.recipeBook = {
  pageFlip, stage, open, back, where, mark, scrollBy, canTurn, drag, nextChapter, pageOf,
  get visible(){ return isOpen() && !fading; },
  get busy(){ return fading || drag.active || pageFlip.getState() !== 'read'; },
};
