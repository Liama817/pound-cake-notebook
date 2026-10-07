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
import { bookDrag } from './book-drag.js';

Object.assign(T.en, { 'book.hint': 'Drag a page corner to turn the page' });
Object.assign(T.zh, { 'book.hint': '拖动书页的角来翻页' });

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
};

document.addEventListener('keydown', e => {
  if(stage.classList.contains('away')) return;
  if(document.getElementById('recipe-modal')?.classList.contains('open')) return;
  if(e.key === 'ArrowRight'){
    e.preventDefault();
    // past the last era, the next chapter is the Recipes page
    canTurn(1) || isClosed() ? pageFlip.flipNext('bottom') : switchSection('recipes');
  }
  if(e.key === 'ArrowLeft'){ e.preventDefault(); pageFlip.flipPrev('bottom'); }
  if((e.key === 'Enter' || e.key === ' ') && isClosed() && e.target === document.body){ e.preventDefault(); open(); }
});

// ── Drag API for the hand tracker (book-drag.js) ────────────

const { canTurn, drag } = bookDrag(pageFlip, { cover:true });

window.historyBook = {
  pageFlip, stage, open, drag, canTurn, isClosed,
  get visible(){ return !stage.classList.contains('away'); },
  get busy(){ return drag.active || pageFlip.getState() !== 'read'; },
};
