// ── SECTION TRANSITIONS ─────────────────────────────────────
// Moving between the notebook's sections (History → Recipes → Tips) slides:
// forward, the old section drifts left and fades as the new one comes in from
// the right; back, the other way. The header and the hand-mode camera window
// stay where they are. Uses the browser's View Transitions; where they aren't
// supported, sections change at once as before.
//
// The new section's pictures are given a moment to load before the slide, so
// a page never assembles itself in front of the reader; and every section's
// main pictures are fetched ahead of time once the page is idle.
//
// Wraps window.switchSection, so tabs, chapter links, keys and hand mode all
// slide. Relies on globals from index.html: switchSection.

const ORDER = ['history', 'recipes', 'tips'];
const IMAGE_WAIT_MS = 350;   // longest the slide waits for the new section's pictures
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const current = () => document.querySelector('.tab-btn.active')?.dataset.section || null;
// Only once the notebook is open: the landing cover and the title page have their own entrances.
const notebookOpen = () => document.getElementById('cover')?.classList.contains('hidden') && !document.querySelector('.fp');

// Wait (briefly) for the pictures now showing to be ready, so they are in the slide's last frame.
function picturesReady(){
  const imgs = [...document.querySelectorAll('#recipes-panel.active img, #tips-panel.active img, .hb-stage:not(.away) img')]
    .filter(img => !img.complete);
  if(!imgs.length) return Promise.resolve();
  const loads = imgs.map(img => img.decode().catch(() => {}));
  return Promise.race([Promise.all(loads), new Promise(r => setTimeout(r, IMAGE_WAIT_MS))]);
}

const originalSwitchSection = window.switchSection;
window.switchSection = function(s){
  const from = current();
  const slide = document.startViewTransition && !reducedMotion() && notebookOpen()
    && from && from !== s && ORDER.includes(from) && ORDER.includes(s)
    && !window.sectionSlideOff;   // the hand tracker's own page turn is already moving
  if(!slide) return originalSwitchSection(s);
  document.documentElement.dataset.slide = ORDER.indexOf(s) > ORDER.indexOf(from) ? 'forward' : 'back';
  const t = document.startViewTransition(async () => {
    originalSwitchSection(s);
    await picturesReady();
  });
  t.finished.finally(() => { delete document.documentElement.dataset.slide; });
};

// Fetch every section's main pictures once the page is idle, so they are ready before they're needed.
const PRELOAD = [
  './images/shelf/scene/cabinet.webp',
  ...['orange', 'marble', 'classic', 'rum', 'blueberry', 'chocZucchini'].flatMap(id =>
    [`./images/shelf/scene/${id}.webp`, `./images/shelf/scene/${id}-bare.webp`, `./images/shelf/${id}.webp`]),
  './images/shelf/shelf.webp',
];
const idle = window.requestIdleCallback || (fn => setTimeout(fn, 1500));
idle(() => {
  PRELOAD.forEach(src => { const img = new Image(); img.decoding = 'async'; img.src = src; });
  // and the Tips pictures, wherever the page keeps them
  document.querySelectorAll('#tips-panel img').forEach(img => { if(!img.complete){ const i = new Image(); i.src = img.currentSrc || img.src; } });
});
