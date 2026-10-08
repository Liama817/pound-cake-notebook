// ── HISTORY BOOK ────────────────────────────────────────────
// The History section as a real two-page book: a stiff cover, then one
// spread per era (story on the left page, photograph on the right).
// Pages bend and curl as they turn, using StPageFlip (MIT, page-flip on npm).
//
// The book is also the landing page: closed, it is the cover; turning the
// cover opens the notebook. Mouse and touch can drag page corners; the hand
// tracker (hand-flip.js) drives the same drag through window.historyBook.
//
// If the library can't load, nothing here runs and the original history
// slideshow stays in place.
//
// Relies on globals from index.html: HISTORY_DATA, ERA_KEYS, histDataFor,
// currentLang, openBook, switchSection, setLang, T, t.

import { PageFlip } from 'https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.module.js';

Object.assign(T.en, { 'book.hint': 'Drag a page corner to turn the page', 'book.toCover': 'Back to the cover' });
Object.assign(T.zh, { 'book.hint': '拖动书页的角来翻页', 'book.toCover': '回到封面' });

const PAGE_W = 460, PAGE_H = 620;   // proportions of one page; the book scales to fit

// ── Build the pages ─────────────────────────────────────────

function eraPages(eraId, n){
  const d = HISTORY_DATA[eraId];
  const ld = histDataFor(eraId, currentLang);
  const img = d.images[0];
  const story = document.createElement('div');
  story.className = 'hb-page hb-left';
  story.dataset.era = eraId;
  story.innerHTML = `
    <div class="hb-story">
      <span class="hb-year"></span>
      <h2 class="hb-title"></h2>
      <p class="hb-body"></p>
    </div>
    <span class="hb-num">${n}</span>`;
  const plate = document.createElement('div');
  plate.className = 'hb-page hb-right';
  plate.innerHTML = `
    <figure class="hb-plate">
      <img src="${img.src}" alt="${ld.title}" loading="lazy" draggable="false">
      <figcaption>${img.caption}</figcaption>
    </figure>
    <span class="hb-num">${n + 1}</span>`;
  fillStory(story);
  return [story, plate];
}

function fillStory(story){
  const ld = histDataFor(story.dataset.era, currentLang);
  story.querySelector('.hb-year').textContent = `${ld.year} · ${ld.location}`;
  story.querySelector('.hb-title').textContent = ld.title;
  story.querySelector('.hb-body').textContent = ld.context;
}

function buildPages(){
  const cover = document.createElement('div');
  cover.className = 'hb-page hb-cover';
  cover.dataset.density = 'hard';
  cover.innerHTML = `
    <img src="./pound-cake-hero.jpg" alt="" draggable="false">
    <div class="hb-cover-text">
      <div class="hb-cover-title" data-i18n="cover.title" data-i18n-html="true">${t('cover.title')}</div>
      <div class="hb-cover-rule"></div>
      <div class="hb-cover-tags" data-i18n="cover.tags" data-i18n-html="true">${t('cover.tags')}</div>
    </div>`;
  const pages = [cover];
  ERA_KEYS.forEach((eraId, i) => pages.push(...eraPages(eraId, i * 2 + 1)));
  return pages;
}

// ── Stage ───────────────────────────────────────────────────
// Fixed over the page so the same book sits on the landing "table" and
// inside the History section. It sits above the landing overlay (#cover).

const stage = document.createElement('div');
stage.className = 'hb-stage closed';
stage.innerHTML = `<div class="hb-book"></div>
  <p class="hb-hint" data-i18n="book.hint">${t('book.hint')}</p>`;
document.body.appendChild(stage);
const bookEl = stage.querySelector('.hb-book');

const pageFlip = new PageFlip(bookEl, {
  width: PAGE_W, height: PAGE_H, size: 'stretch',
  minWidth: 240, maxWidth: 620, minHeight: 320, maxHeight: 840,
  showCover: true,
  usePortrait: true,          // one page at a time on narrow screens
  flippingTime: 900,          // slow enough to read as paper, not a slide
  maxShadowOpacity: 0.45,
  drawShadow: true,
  showPageCorners: true,      // corner lifts slightly under the mouse
  mobileScrollSupport: false,
  autoSize: false,            // history-book.css sizes the book to fit the screen; the
                              // library's own sizing makes it as wide as the window
});
pageFlip.loadFromHTML(buildPages());
document.body.classList.add('hb-ready');

const pageIndex = () => pageFlip.getCurrentPageIndex();
const isClosed = () => pageIndex() === 0;
const landscape = () => pageFlip.getOrientation() === 'landscape';

// ── Landing ⇄ open book ─────────────────────────────────────

const coverEl = document.getElementById('cover');
const originalOpenBook = window.openBook;

function showLanding(){
  coverEl.classList.remove('hidden');
  document.getElementById('book').classList.remove('visible');
  stage.classList.add('closed');
}

function leaveLanding(){
  if(!coverEl.classList.contains('hidden')) originalOpenBook();
  stage.classList.remove('closed');
  const historyTab = document.querySelector('.tab-btn[data-section="history"]');
  if(historyTab && !historyTab.classList.contains('active')) switchSection('history');
}

// A closed book is drawn on the right half of its spread; slide it so the
// cover sits centred, and glide back to centre the spread as it opens.
pageFlip.on('changeState', e => {
  if(!isClosed()) return;
  stage.classList.toggle('opening', e.data === 'flipping' || e.data === 'user_fold');
});
pageFlip.on('flip', e => {
  stage.classList.remove('opening');
  if(e.data === 0) showLanding(); else leaveLanding();
});

// Every way of opening the notebook (wave, Skip, keyboard) turns the cover.
function open(){
  if(isClosed()) pageFlip.flipNext('bottom');
  else leaveLanding();
}
window.openBook = open;

// The notebook's name in the header closes the book again: from Recipes or
// Tips it first slides back to the History book, then the pages turn back
// onto the cover, just as turning them back by hand would.
function toCover(){
  if(isClosed()) return;
  const close = () => { if(pageFlip.getState() === 'read') pageFlip.flip(0, 'bottom'); };
  if(stage.classList.contains('away')){ switchSection('history'); setTimeout(close, 550); }
  else close();
}
window.goToCover = toCover;
function labelHomeButton(){
  const b = document.getElementById('book-home');
  if(b){ b.title = t('book.toCover'); b.setAttribute('aria-label', t('book.toCover')); }
}
labelHomeButton();

// Show the book only in the History section.
const originalSwitchSection = window.switchSection;
window.switchSection = function(s){
  originalSwitchSection(s);
  stage.classList.toggle('away', s !== 'history');
};

// Re-translate the pages when the language changes.
const originalSetLang = window.setLang;
window.setLang = function(lang){
  originalSetLang(lang);
  bookEl.querySelectorAll('.hb-left[data-era]').forEach(fillStory);
  labelHomeButton();
};

document.addEventListener('keydown', e => {
  if(stage.classList.contains('away')) return;
  if(document.getElementById('recipe-modal')?.classList.contains('open')) return;
  if(e.key === 'ArrowRight'){ e.preventDefault(); pageFlip.flipNext('bottom'); }
  if(e.key === 'ArrowLeft'){ e.preventDefault(); pageFlip.flipPrev('bottom'); }
  if((e.key === 'Enter' || e.key === ' ') && isClosed() && e.target === document.body){ e.preventDefault(); open(); }
});

// ── Drag API for the hand tracker ───────────────────────────
// u, v: position across the whole book, 0–1 (u = 0 left edge, 1 right edge).

function toBookPoint(u, v){
  const r = pageFlip.getBoundsRect();
  return { x: r.left + u * r.width, y: r.top + v * r.height };
}

function canTurn(dir){
  const i = pageIndex(), n = pageFlip.getPageCount();
  if(dir < 0) return i > 0;
  if(!landscape()) return i < n - 1;
  return (i === 0 ? 1 : i + 2) < n;     // spreads are [0], [1,2], [3,4]…
}

let dragging = false;
let last = { u:0.5, v:0.85 };   // where the hand last held the page
const drag = {
  // Begin a turn in direction dir (+1 next, -1 back). In landscape the page
  // follows u/v from move(); in portrait the turn just plays.
  begin(dir, v = 0.85){
    if(dragging || !canTurn(dir) || pageFlip.getState() !== 'read') return false;
    if(!landscape()){
      dir > 0 ? pageFlip.flipNext('bottom') : pageFlip.flipPrev('bottom');
      return 'played';
    }
    dragging = true;
    last = { u: dir > 0 ? 0.97 : 0.03, v };
    pageFlip.startUserTouch(toBookPoint(last.u, last.v));
    // The library picks the turn's direction from the first point it is
    // dragged to (left half = back). Fold a little at the starting edge now,
    // so a jumpy first hand position can't turn the page the wrong way.
    last = { u: dir > 0 ? 0.92 : 0.08, v };
    pageFlip.userMove(toBookPoint(last.u, last.v), false);
    return true;
  },
  move(u, v){
    if(!dragging) return;
    last = { u: Math.min(1, Math.max(0, u)), v: Math.min(0.98, Math.max(0.02, v)) };
    pageFlip.userMove(toBookPoint(last.u, last.v), false);
  },
  // Let go: the library finishes the turn if the corner passed the spine,
  // otherwise the page settles back.
  end(){
    if(!dragging) return;
    dragging = false;
    pageFlip.userStop(toBookPoint(last.u, last.v));
  },
  get active(){ return dragging; },
};

window.historyBook = {
  pageFlip, stage, open, toCover, drag, canTurn, isClosed,
  get visible(){ return !stage.classList.contains('away'); },
  get busy(){ return dragging || pageFlip.getState() !== 'read'; },
};
