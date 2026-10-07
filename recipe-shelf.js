// ── RECIPE SHELF ────────────────────────────────────────────
// The Recipes section as a bakery display case: a warm-lit glass case with
// wooden shelves, each recipe a cake sitting on a shelf with a paper tag.
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

function cakeHTML(id, r, i){
  const name = t('recipe.' + id) || r.name;
  const source = currentLang === 'zh' ? (r.zh_source || r.source) : r.source;
  return `
    <button class="slice${id === liftedId ? ' lifted' : ''}" type="button" data-recipe="${id}" style="--i:${i}"
            aria-label="${name}">
      <span class="slice-glow"></span>
      <span class="slice-shadow"></span>
      <img class="slice-img" src="./images/shelf/${id}.webp" alt="" draggable="false">
      <span class="slice-tag">
        <span class="tag-name">${name}</span>
        <span class="tag-src">${source}</span>
        ${stampFor(id)}
      </span>
    </button>`;
}

function buildShelf(){
  const panel = document.getElementById('recipes-panel');
  if(!panel) return;
  const cakes = Object.entries(RJ).map(([id, r], i) => cakeHTML(id, r, i)).join('');
  panel.innerHTML = `
    <div class="shelf-wrap">
      <header class="shelf-head">
        <h1 class="shelf-title" data-i18n="recipes.title">${t('recipes.title')}</h1>
        <p class="shelf-sub" data-i18n="recipes.subtitle">${t('recipes.subtitle')}</p>
      </header>
      <div class="case">
        <div class="case-sign"><span data-i18n="shelf.sign">${t('shelf.sign')}</span></div>
        <div class="case-body">
          <div class="case-grid">${cakes}</div>
          <div class="case-glass" aria-hidden="true"></div>
        </div>
        <div class="case-base" aria-hidden="true"></div>
      </div>
      <p class="shelf-hint" data-i18n="shelf.hint">${t('shelf.hint')}</p>
    </div>`;
  panel.querySelectorAll('.slice').forEach(btn => {
    btn.addEventListener('click', () => pick(btn.dataset.recipe));
  });
}

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
