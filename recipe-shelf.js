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
  'shelf.count': '{n} cakes on the shelf',
  'shelf.made': '✓ Baked',
  'shelf.wish': '♡ Want to bake',
  'shelf.pinch': 'pinch to take it out',
  'shelf.pulling': 'keep pinching…',
});
Object.assign(T.zh, {
  'shelf.count': '架上 {n} 款蛋糕',
  'shelf.made': '✓ 做过了',
  'shelf.wish': '♡ 想做',
  'shelf.pinch': '捏一下，把它取出来',
  'shelf.pulling': '继续捏住…',
});

const LIFT_MS = 380;   // the cake rises off the shelf before the card opens
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let liftedId = null;

function stampFor(id){
  const s = getStampState(id);
  // a small round seal with just its sign; the words are for screen readers and on hover
  const seal = (kind, sign) => `<span class="tag-stamp ${kind}" role="img" aria-label="${t('shelf.' + kind)}" title="${t('shelf.' + kind)}">${sign}</span>`;
  if(s.made) return seal('made', '✓');
  if(s.wish) return seal('wish', '♡');
  return '';
}

// Wider screens show one painting of a pâtisserie cabinet with all six cakes
// in it (images/shelf/scene/cabinet.webp). Each cake also exists as a cut-out
// of that painting, plus a patch of bare shelf to put behind it: at rest the
// painting shows alone; when a cake is hovered or chosen, its patch and
// cut-out appear and the cut-out rises.
// Boxes are in % of the painting's width (1536px): x, y, w, h of the cut-out;
// tx is the plate's centre within the box; ty the label's top within the box
// (on the shelf lip for the upper floor, on the plinth for the lower).
const SCENE = {
  orange:       { x:14.118, y:25.372, w:17.857, h:13.096, tx:8.809, ty:13.453 },
  blueberry:    { x:40.22,  y:24.777, w:18.452, h:13.691, tx:9.137, ty:14.048 },
  classic:      { x:67.393, y:25.372, w:18.452, h:13.096, tx:9.048, ty:13.453 },
  rum:          { x:13.821, y:46.801, w:18.452, h:13.691, tx:9.204, ty:13.928 },
  marble:       { x:40.398, y:47.396, w:18.155, h:13.096, tx:9.048, ty:13.333 },
  chocZucchini: { x:67.096, y:46.801, w:18.452, h:13.691, tx:9.018, ty:13.928 },
};

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
        ${stampFor(id)}
      </span>`;
}

function sceneCakeHTML(id, r, i){
  const b = SCENE[id];
  const name = t('recipe.' + id) || r.name;
  return `
    <button class="slice${id === liftedId ? ' lifted cc-taken' : ''}" type="button" data-recipe="${id}" aria-label="${name}"
            style="--x:${b.x}cqw;--y:${b.y}cqw;--w:${b.w}cqw;--h:${b.h}cqw;--tx:${b.tx}cqw;--ty:${b.ty}cqw">
      <img class="slice-bare" src="./images/shelf/scene/${id}-bare.webp" alt="" draggable="false">
      <img class="slice-img" src="./images/shelf/scene/${id}.webp" alt="" draggable="false">
      ${tagHTML(id, r, i)}
    </button>`;
}

// Phones: a painted oak plank per pair of cakes, each cake its own painting.
function plankCakeHTML(id, r, i){
  const name = t('recipe.' + id) || r.name;
  return `
    <button class="slice${id === liftedId ? ' lifted cc-taken' : ''}" type="button" data-recipe="${id}" aria-label="${name}">
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
    // cab-fit sizes the painting to the space left on screen; .cabinet is the
    // measuring box the cakes are placed in (its width drives their cqw units).
    rows = `
      <div class="cab-fit">
        <div class="cabinet">
          <img class="cabinet-img" src="./images/shelf/scene/cabinet.webp" alt="" width="1536" height="1024" aria-hidden="true">
          ${entries.map(([id, r], i) => sceneCakeHTML(id, r, i)).join('')}
        </div>
      </div>`;
  }
  // on wider screens the shelf is laid out on an open book like History's (book-frame.css)
  panel.innerHTML = `
    <div class="bk-spread"><div class="shelf-wrap">
      <header class="shelf-head">
        <h1 class="shelf-title" data-i18n="recipes.title">${t('recipes.title')}</h1>
        <div class="head-note">
          <p class="shelf-count">${t('shelf.count').replace('{n}', entries.length)}</p>
          <p class="shelf-sub" data-i18n="recipes.subtitle">${t('recipes.subtitle')}</p>
        </div>
      </header>
      <div class="shelf">${rows}</div>
      <nav class="shelf-foot">
        <button class="foot-hand" type="button" hidden></button>
      </nav>
    </div></div>`;
  panel.querySelectorAll('.slice').forEach(btn => {
    btn.addEventListener('click', () => pick(btn.dataset.recipe));
    btn.addEventListener('pointerenter', () => window.cakeCard?.preload(btn.dataset.recipe));
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

// Take the cake off the shelf: it comes to you and turns over into its
// recipe card (cake-card.js). Without that, it just lifts and the card opens.
function pick(id){
  if(liftedId) return;
  const btn = document.querySelector(`.slice[data-recipe="${id}"]`);
  if(!btn) return;
  liftedId = id;
  point(null);
  if(window.cakeCard){ window.cakeCard.open(btn, id, () => openRecipeModal(id)); return; }
  btn.classList.add('lifted');
  setTimeout(() => openRecipeModal(id), reducedMotion() ? 0 : LIFT_MS);
}

// Closing puts the cake back on the shelf; its tag may show a new stamp.
const originalClose = window.closeRecipeModal;
let closing = false;
window.closeRecipeModal = function(){
  const id = liftedId;
  const btn = id && document.querySelector(`.slice[data-recipe="${id}"]`);
  const settle = () => {
    liftedId = null;
    if(!btn) return;
    btn.classList.remove('lifted');
    const tag = btn.querySelector('.slice-tag');
    tag.querySelector('.tag-stamp')?.remove();
    tag.insertAdjacentHTML('beforeend', stampFor(id));
  };
  if(!btn || !window.cakeCard){ originalClose(); settle(); return; }
  if(closing) return;
  closing = true;
  window.cakeCard.close(btn, id, originalClose).then(settle).finally(() => { closing = false; });
};

window.buildRecipesPage = buildShelf;
if(document.getElementById('recipes-panel')?.classList.contains('active')) buildShelf();

// The hand tracker lights the cake under the fingertip, as a mouse hover would.
// Pointing also hangs a small paper tag from the cake's label, saying what to do.
let nametag = null, nametagFor = null;
function point(id){
  document.querySelectorAll('#recipes-panel .slice').forEach(btn => {
    btn.classList.toggle('pointed', btn.dataset.recipe === id);
  });
  if(!nametag){
    nametag = document.createElement('div');
    nametag.className = 'cc-nametag';
    nametag.hidden = true;
    document.body.appendChild(nametag);
  }
  const label = id && document.querySelector(`.slice[data-recipe="${id}"] .slice-tag`);
  if(!label){ nametag.hidden = true; nametagFor = null; return; }
  const r = label.getBoundingClientRect();
  nametag.style.left = (r.left + r.width / 2) + 'px';
  nametag.style.top = (r.bottom + 12) + 'px';
  if(nametagFor === id) return;
  nametagFor = id;
  nametag.textContent = t('shelf.pinch');
  nametag.hidden = false;
  nametag.style.animation = 'none'; nametag.offsetWidth; nametag.style.animation = '';   // swing in again for each cake
  window.cakeCard?.preload(id);
}

// A held pinch pulls the cake out bit by bit (p 0–1, null to let go);
// meanwhile its tag says to keep pinching, and fills up like a loading bar.
function pull(id, p){
  const btn = document.querySelector(`.slice[data-recipe="${id}"]`);
  if(!btn || !window.cakeCard) return;
  window.cakeCard.pull(btn, p);
  if(nametag && nametagFor === id){
    nametag.textContent = t(p === null ? 'shelf.pinch' : 'shelf.pulling');
    nametag.style.setProperty('--p', ((p || 0) * 100) + '%');   // the tag fills up as it's pulled out
    nametag.classList.toggle('pulling', p !== null);
  }
}

// For the hand tracker (and tests): the cakes on the shelf, pointing at one, and picking it.
window.recipeShelf = {
  pick,
  pull,
  point,
  cakes: () => [...document.querySelectorAll('#recipes-panel .slice')],
  get open(){ return !!liftedId; },
};
