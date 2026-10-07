// ── RECIPE SHELF ────────────────────────────────────────────
// The Recipes section as a kitchen shelf in daylight, drawn in the project's
// watercolor-illustration style: each recipe is a painted slice of cake on
// its own porcelain plate, with a tag hanging from the shelf below it.
// Choosing a cake lifts it off the shelf, then opens the existing recipe
// card (openRecipeModal). Closing the card sets the cake back down.
//
// Replaces buildRecipesPage from index.html, so switching to Recipes and
// changing language both render the shelf.
//
// Relies on globals from index.html: RJ, buildRecipesPage, openRecipeModal,
// closeRecipeModal, getStampState, currentLang, T, t.

Object.assign(T.en, {
  'shelf.plate': 'Plate II',
  'shelf.caption': 'The pâtisserie shelf: {n} pound cakes, one slice of each.',
  'shelf.choose': 'Choose a cake, on the shelf or below, to open its recipe.',
  'shelf.made': '✓ Baked',
  'shelf.wish': '♡ Want to bake',
  'shelf.next': 'Next chapter',
  'shelf.prev': 'Previous chapter',
});
Object.assign(T.zh, {
  'shelf.plate': '图二',
  'shelf.caption': '甜品店的橱架：{n} 款磅蛋糕，每款一片。',
  'shelf.choose': '在架上或下方选一款蛋糕，打开它的食谱。',
  'shelf.made': '✓ 做过了',
  'shelf.wish': '♡ 想做',
  'shelf.next': '下一章',
  'shelf.prev': '上一章',
});

const LIFT_MS = 380;   // the cake rises off the shelf before the card opens
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let liftedId = null;

function stampFor(id){
  const s = getStampState(id);
  if(s.made) return `<span class="tag-stamp made">${t('shelf.made')}</span>`;
  if(s.wish) return `<span class="tag-stamp wish">${t('shelf.wish')}</span>`;
  return '';
}

// Wider screens show one painting of a pâtisserie cabinet with all six cakes
// in it (images/shelf/scene/cabinet.webp). Each cake also exists as a cut-out
// of that painting, plus a patch of bare shelf to put behind it: at rest the
// painting shows alone; when a cake is hovered or chosen, its patch and
// cut-out appear and the cut-out rises.
// Boxes are in % of the painting's width (1536px): x, y, w, h of the cut-out.
// The painting carries no text: names live in the index below it, laid out
// like the shelf (upper row, lower row), and the two light up together.
const SCENE = {
  orange:       { x:10.742, y:21.484, w:19.531, h:14.323 },
  marble:       { x:39.388, y:21.484, w:19.857, h:14.323 },
  classic:      { x:69.01,  y:21.484, w:20.182, h:14.323 },
  rum:          { x:10.417, y:44.922, w:20.182, h:14.974 },
  blueberry:    { x:39.388, y:44.922, w:20.182, h:14.974 },
  chocZucchini: { x:68.685, y:44.922, w:20.182, h:14.974 },
};

// A pencil-drawn arrow for the chapter links.
const ARROW = '<path d="M2 9.6c9-.9 22-.3 33 .3M27.5 3.5c2.6 2.4 5.2 4.6 8 6.5-2.9 1.6-5.8 3.6-8.3 6.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>';
const ARROW_R = `<svg class="arrow" viewBox="0 0 38 20" aria-hidden="true">${ARROW}</svg>`;
const ARROW_L = `<svg class="arrow flip" viewBox="0 0 38 20" aria-hidden="true">${ARROW}</svg>`;

function tagHTML(id, r, i){
  const name = t('recipe.' + id) || r.name;
  const source = currentLang === 'zh' ? (r.zh_source || r.source) : r.source;
  return `
      <span class="slice-tag">
        <span class="tag-no"><small>No.</small>${i + 1}</span>
        <span class="tag-text">
          <span class="tag-name">${name}</span>
          <span class="tag-src">${source}</span>
        </span>
        <span class="stamp-slot">${stampFor(id)}</span>
      </span>`;
}

// One entry of the index under the painting. These are the keyboard and
// screen-reader way in; the cakes in the painting are for the pointer.
function indexHTML(id, r, i){
  const name = t('recipe.' + id) || r.name;
  const source = currentLang === 'zh' ? (r.zh_source || r.source) : r.source;
  const tags = (currentLang === 'zh' ? (r.zh_tags || r.tags) : r.tags) || [];
  return `
    <li>
      <button class="ix-item" type="button" data-recipe="${id}">
        <span class="ix-no">${i + 1}</span>
        <span class="ix-name">${name}</span>
        <span class="ix-src">${source}</span>
        <span class="ix-tags">${tags.join(' · ')}</span>
        <span class="stamp-slot">${stampFor(id)}</span>
      </button>
    </li>`;
}

function sceneCakeHTML(id, r){
  const b = SCENE[id];
  const name = t('recipe.' + id) || r.name;
  return `
    <button class="slice${id === liftedId ? ' lifted' : ''}" type="button" data-recipe="${id}" aria-label="${name}"
            tabindex="-1" aria-hidden="true" style="--x:${b.x}cqw;--y:${b.y}cqw;--w:${b.w}cqw;--h:${b.h}cqw">
      <img class="slice-bare" src="./images/shelf/scene/${id}-bare.webp" alt="" draggable="false">
      <img class="slice-img" src="./images/shelf/scene/${id}.webp" alt="" draggable="false">
    </button>`;
}

// Phones: a painted oak plank per pair of cakes, each cake its own painting.
function plankCakeHTML(id, r, i){
  const name = t('recipe.' + id) || r.name;
  return `
    <button class="slice${id === liftedId ? ' lifted' : ''}" type="button" data-recipe="${id}" aria-label="${name}">
      <span class="slice-stage">
        <span class="plate-shadow" aria-hidden="true"></span>
        <img class="slice-img" src="./images/shelf/${id}.webp" alt="" width="640" height="478" draggable="false">
      </span>
      ${tagHTML(id, r, i)}
    </button>`;
}

function shelfRow(items){
  return `
    <div class="shelf-row">
      <img class="shelf-board" src="./images/shelf/shelf.webp" alt="" width="1481" height="321" aria-hidden="true">
      <div class="shelf-items">${items}</div>
    </div>`;
}

function buildShelf(){
  const panel = document.getElementById('recipes-panel');
  if(!panel) return;
  const entries = Object.entries(RJ);
  let rows = '';
  if(window.matchMedia('(max-width:640px)').matches){
    const all = entries.map(([id, r], i) => plankCakeHTML(id, r, i));
    for(let k = 0; k < all.length; k += 2) rows += shelfRow(all.slice(k, k + 2).join(''));
  } else {
    rows = `
      <figure class="plate">
        <div class="cabinet">
          <img class="cabinet-img" src="./images/shelf/scene/cabinet.webp" alt="" width="1536" height="1024" aria-hidden="true">
          ${entries.map(([id, r]) => sceneCakeHTML(id, r)).join('')}
        </div>
        <figcaption><b>${t('shelf.plate')}</b>${t('shelf.caption').replace('{n}', entries.length)}</figcaption>
      </figure>
      <ol class="shelf-index" aria-label="${t('recipes.title')}">${entries.map(([id, r], i) => indexHTML(id, r, i)).join('')}</ol>`;
  }
  panel.innerHTML = `
    <div class="shelf-wrap">
      <header class="shelf-head">
        <h1 class="shelf-title" data-i18n="recipes.title">${t('recipes.title')}</h1>
        <div class="head-note">
          <p class="shelf-sub" data-i18n="recipes.subtitle">${t('recipes.subtitle')}</p>
          <p class="shelf-hint">${t('shelf.choose')}</p>
        </div>
      </header>
      <div class="shelf">${rows}</div>
      <nav class="shelf-foot">
        <button class="foot-prev" type="button" data-go="history"><small data-i18n="shelf.prev">${t('shelf.prev')}</small><span>${ARROW_L}<span data-i18n="nav.history">${t('nav.history')}</span></span></button>
        <button class="foot-hand" type="button" hidden></button>
        <button class="foot-next" type="button" data-go="tips"><small data-i18n="shelf.next">${t('shelf.next')}</small><span><span data-i18n="nav.tips">${t('nav.tips')}</span>${ARROW_R}</span></button>
      </nav>
    </div>`;
  panel.querySelectorAll('.slice, .ix-item').forEach(btn => {
    btn.addEventListener('click', () => pick(btn.dataset.recipe));
  });
  // a cake and its index entry light up together
  const pair = (id, on) => {
    panel.querySelector(`.slice[data-recipe="${id}"]`)?.classList.toggle('pointed', on);
    panel.querySelector(`.ix-item[data-recipe="${id}"]`)?.classList.toggle('lit', on);
  };
  panel.querySelectorAll('.cabinet .slice, .ix-item').forEach(el => {
    const id = el.dataset.recipe;
    el.addEventListener('pointerenter', () => pair(id, true));
    el.addEventListener('pointerleave', () => pair(id, false));
    el.addEventListener('focus', () => pair(id, true));
    el.addEventListener('blur', () => pair(id, false));
  });
  panel.querySelectorAll('[data-go]').forEach(btn => {
    btn.addEventListener('click', () => switchSection(btn.dataset.go));
  });
  mirrorHandToggle(panel.querySelector('.foot-hand'));
}

// The floating hand-mode toggle (hand-flip.js) is hidden on this page; the
// foot of the shelf offers the same switch as a quiet text button.
let handObserver = null;
function mirrorHandToggle(btn){
  const real = document.querySelector('.hf-toggle');
  handObserver?.disconnect();
  if(!btn || !real) return;
  const sync = () => {
    btn.textContent = real.textContent;
    btn.setAttribute('aria-pressed', real.getAttribute('aria-pressed') || 'false');
  };
  sync();
  btn.hidden = false;
  btn.addEventListener('click', () => real.click());
  handObserver = new MutationObserver(sync);
  handObserver.observe(real, { childList:true, characterData:true, subtree:true, attributes:true, attributeFilter:['aria-pressed'] });
}

// Recipes is a daylit paper page: let the header and hand toggle follow it.
const originalSwitch = window.switchSection;
window.switchSection = function(s){
  originalSwitch(s);
  document.body.classList.toggle('on-recipes', s === 'recipes');
};
document.body.classList.toggle('on-recipes',
  !!document.querySelector('.tab-btn.active[data-section="recipes"]'));

// A cabinet on wider screens, a plank per pair on a phone: rebuild when that changes.
window.matchMedia('(max-width:640px)').addEventListener('change', () => {
  if(document.getElementById('recipes-panel')?.classList.contains('active')) buildShelf();
});

// Lift the cake, then open its recipe card.
function pick(id){
  if(liftedId) return;
  const btn = document.querySelector(`.slice[data-recipe="${id}"]`);
  if(!btn) return;
  liftedId = id;
  btn.classList.add('lifted');
  setTimeout(() => openRecipeModal(id), reducedMotion() ? 0 : LIFT_MS);
}

// Set the cake back down when the card closes; its tag may show a new stamp.
const originalClose = window.closeRecipeModal;
window.closeRecipeModal = function(){
  originalClose();
  const id = liftedId;
  liftedId = null;
  const btn = id && document.querySelector(`.slice[data-recipe="${id}"]`);
  if(!btn) return;
  btn.classList.remove('lifted');
  document.querySelectorAll(`[data-recipe="${id}"] .stamp-slot`).forEach(slot => { slot.innerHTML = stampFor(id); });
};

window.buildRecipesPage = buildShelf;
if(document.getElementById('recipes-panel')?.classList.contains('active')) buildShelf();

// For the hand tracker (and tests): the cakes on the shelf, and picking one.
window.recipeShelf = {
  pick,
  cakes: () => [...document.querySelectorAll('#recipes-panel .slice')],
  get open(){ return !!liftedId; },
};
