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
  'shelf.sign': 'Today’s Pound Cakes',
  'shelf.hint': 'Choose a cake to open its recipe',
  'shelf.made': '✓ Baked',
  'shelf.wish': '♡ Want to bake',
});
Object.assign(T.zh, {
  'shelf.sign': '今日磅蛋糕',
  'shelf.hint': '选一块蛋糕，打开它的食谱',
  'shelf.made': '✓ 做过了',
  'shelf.wish': '♡ 想做',
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

// Each cake is one painted piece: a slice already on its porcelain plate,
// all six painted from one reference so the plate, angle, light and scale
// match. The oak shelf, brackets included, is a single painted plank.
function cakeHTML(id, r, i){
  const name = t('recipe.' + id) || r.name;
  const source = currentLang === 'zh' ? (r.zh_source || r.source) : r.source;
  return `
    <button class="slice${id === liftedId ? ' lifted' : ''}" type="button" data-recipe="${id}" aria-label="${name}">
      <span class="slice-stage">
        <span class="plate-shadow" aria-hidden="true"></span>
        <img class="slice-img" src="./images/shelf/${id}.webp" alt="" width="640" height="486" draggable="false">
      </span>
      <span class="slice-tag">
        <span class="tag-no">No. ${String(i + 1).padStart(2, '0')}</span>
        <span class="tag-name">${name}</span>
        <span class="tag-src">${source}</span>
        ${stampFor(id)}
      </span>
    </button>`;
}

function shelfRow(items){
  return `
    <div class="shelf-row">
      <img class="shelf-board" src="./images/shelf/shelf.webp" alt="" width="1498" height="278" aria-hidden="true">
      <div class="shelf-items">${items}</div>
    </div>`;
}

function buildShelf(){
  const panel = document.getElementById('recipes-panel');
  if(!panel) return;
  const all = Object.entries(RJ).map(([id, r], i) => cakeHTML(id, r, i));
  const perRow = window.matchMedia('(max-width:640px)').matches ? 2 : 3;
  let rows = '';
  for(let k = 0; k < all.length; k += perRow) rows += shelfRow(all.slice(k, k + perRow).join(''));
  panel.innerHTML = `
    <div class="shelf-wrap">
      <header class="shelf-head">
        <div class="head-title">
          <p class="shelf-kicker"><span data-i18n="shelf.sign">${t('shelf.sign')}</span> <span class="kicker-count">· ${String(all.length).padStart(2, '0')}</span></p>
          <h1 class="shelf-title" data-i18n="recipes.title">${t('recipes.title')}</h1>
        </div>
        <div class="head-note">
          <p class="shelf-sub" data-i18n="recipes.subtitle">${t('recipes.subtitle')}</p>
          <p class="shelf-hint" data-i18n="shelf.hint">${t('shelf.hint')}</p>
        </div>
      </header>
      <div class="shelf">${rows}</div>
      <nav class="shelf-foot">
        <button type="button" data-go="history">← <span data-i18n="nav.history">${t('nav.history')}</span></button>
        <span class="foot-mark" aria-hidden="true">❦</span>
        <button type="button" data-go="tips"><span data-i18n="nav.tips">${t('nav.tips')}</span> →</button>
      </nav>
    </div>`;
  panel.querySelectorAll('.slice').forEach(btn => {
    btn.addEventListener('click', () => pick(btn.dataset.recipe));
  });
  panel.querySelectorAll('[data-go]').forEach(btn => {
    btn.addEventListener('click', () => switchSection(btn.dataset.go));
  });
}

// Recipes is a daylit paper page: let the header and hand toggle follow it.
const originalSwitch = window.switchSection;
window.switchSection = function(s){
  originalSwitch(s);
  document.body.classList.toggle('on-recipes', s === 'recipes');
};
document.body.classList.toggle('on-recipes',
  !!document.querySelector('.tab-btn.active[data-section="recipes"]'));

// Shelves hold three cakes, or two on a phone: rebuild when that changes.
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
  const tag = btn.querySelector('.slice-tag');
  tag.querySelector('.tag-stamp')?.remove();
  tag.insertAdjacentHTML('beforeend', stampFor(id));
};

window.buildRecipesPage = buildShelf;
if(document.getElementById('recipes-panel')?.classList.contains('active')) buildShelf();

// For the hand tracker (and tests): the cakes on the shelf, and picking one.
window.recipeShelf = {
  pick,
  cakes: () => [...document.querySelectorAll('#recipes-panel .slice')],
  get open(){ return !!liftedId; },
};
