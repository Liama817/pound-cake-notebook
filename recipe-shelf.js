// ── RECIPE SHELF ────────────────────────────────────────────
// The Recipes section as a kitchen shelf in daylight, drawn in the project's
// watercolor-illustration style: each recipe is a painted slice of cake on
// its own porcelain plate, with a small label under the shelf.
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

// Painted pieces shared by every shelf. Two filters give drawn shapes the
// project's watercolor feel: "pencil" wobbles contour lines, "wash" breaks
// up flat fills with pigment granulation and soft, uneven edges.
const DRAWINGS = `
<svg class="shelf-defs" width="0" height="0" aria-hidden="true" focusable="false">
  <defs>
    <filter id="pencil" x="-5%" y="-20%" width="110%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7"/>
      <feDisplacementMap in="SourceGraphic" scale="2.4"/>
    </filter>
    <filter id="wash" x="-8%" y="-30%" width="116%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="3" seed="3" result="warp"/>
      <feDisplacementMap in="SourceGraphic" in2="warp" scale="3.5" result="shape"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" result="grain"/>
      <feColorMatrix in="grain" type="matrix" values="0 0 0 0 .45  0 0 0 0 .35  0 0 0 0 .25  0 0 0 -1.1 .62" result="specks"/>
      <feComposite in="specks" in2="shape" operator="in" result="pigment"/>
      <feMerge><feMergeNode in="shape"/><feMergeNode in="pigment"/></feMerge>
    </filter>
    <radialGradient id="porcelain" cx="50%" cy="30%" r="75%">
      <stop offset="0" stop-color="#fffefa"/><stop offset=".65" stop-color="#f4eee3"/><stop offset="1" stop-color="#e2d8c7"/>
    </radialGradient>
    <linearGradient id="board-wood" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#d7ad74"/><stop offset="1" stop-color="#b1814a"/>
    </linearGradient>

    <symbol id="plate" viewBox="0 0 300 80">
      <g filter="url(#wash)">
        <ellipse cx="150" cy="40" rx="142" ry="31" fill="url(#porcelain)"/>
        <ellipse cx="150" cy="38" rx="96" ry="18" fill="#efe7da"/>
      </g>
      <g filter="url(#pencil)" fill="none">
        <ellipse cx="150" cy="40" rx="142" ry="31" stroke="#8c7b66" stroke-width="1.2"/>
        <ellipse cx="150" cy="39" rx="127" ry="26" stroke="#7d9bb5" stroke-width="2.6" opacity=".7"/>
        <path d="M54 38 C 80 21, 220 21, 246 38" stroke="#b9ab97" stroke-width=".9"/>
      </g>
    </symbol>

    <symbol id="stand" viewBox="0 0 300 150">
      <g filter="url(#wash)">
        <path d="M136 52 C 138 90, 128 118, 112 128 L 188 128 C 172 118, 162 90, 164 52 Z" fill="url(#porcelain)"/>
        <ellipse cx="150" cy="131" rx="58" ry="12" fill="#ece4d6"/>
        <ellipse cx="150" cy="40" rx="140" ry="28" fill="url(#porcelain)"/>
      </g>
      <g filter="url(#pencil)" fill="none" stroke="#8c7b66" stroke-width="1.2">
        <ellipse cx="150" cy="40" rx="140" ry="28"/>
        <ellipse cx="150" cy="39" rx="126" ry="23" stroke="#7d9bb5" stroke-width="2.4" opacity=".7"/>
        <path d="M136 66 C 138 92, 128 118, 112 128"/><path d="M164 66 C 162 92, 172 118, 188 128"/>
        <ellipse cx="150" cy="131" rx="58" ry="12"/>
      </g>
    </symbol>

    <symbol id="board" viewBox="0 0 300 60">
      <g filter="url(#wash)">
        <path d="M22 24 Q 24 14 40 14 H 260 Q 276 14 280 24 L 292 40 Q 294 50 280 50 H 20 Q 6 50 8 40 Z" fill="url(#board-wood)"/>
        <path d="M8 40 Q 6 50 20 50 H 280 Q 294 50 292 40 L 292 46 Q 292 56 280 56 H 20 Q 8 56 8 46 Z" fill="#8f6436"/>
      </g>
      <g filter="url(#pencil)" fill="none" stroke="#6e4c2a" stroke-width="1.1">
        <path d="M22 24 Q 24 14 40 14 H 260 Q 276 14 280 24 L 292 40 Q 294 50 280 50 H 20 Q 6 50 8 40 Z"/>
        <path d="M60 24 C 120 21, 190 27, 250 23" opacity=".45"/><path d="M40 36 C 110 33, 200 39, 268 34" opacity=".45"/>
      </g>
    </symbol>

    <symbol id="bracket" viewBox="0 0 60 90">
      <g filter="url(#pencil)" stroke="#3f342a" stroke-width="2.4" fill="none" stroke-linecap="round">
        <path d="M6 2 V84"/><path d="M6 3 H56"/>
        <path d="M8 76 C 10 46, 26 22, 52 6"/>
        <path d="M24 36 c -8 -2 -12 6 -6 10 c 6 4 12 -2 8 -8"/>
        <path d="M10 60 c -2 -6 4 -10 8 -6"/>
      </g>
    </symbol>
  </defs>
</svg>`;

// Each cake sits on its own piece: plates, with a cake stand and a board for rhythm.
const VESSELS = ['plate', 'stand', 'plate', 'board', 'plate', 'stand'];

function cakeHTML(id, r, i){
  const name = t('recipe.' + id) || r.name;
  const source = currentLang === 'zh' ? (r.zh_source || r.source) : r.source;
  const vessel = VESSELS[i % VESSELS.length];
  return `
    <button class="slice on-${vessel}${id === liftedId ? ' lifted' : ''}" type="button" data-recipe="${id}" style="--i:${i}"
            aria-label="${name}">
      <span class="slice-stage">
        <span class="vessel-shadow" aria-hidden="true"></span>
        <svg class="vessel" aria-hidden="true"><use href="#${vessel}"/></svg>
        <span class="cake-shadow" aria-hidden="true"></span>
        <img class="slice-img" src="./images/shelf/${id}.webp" alt="" draggable="false">
      </span>
      <span class="slice-tag">
        <span class="tag-string" aria-hidden="true"></span>
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
      <div class="shelf-plank" aria-hidden="true">
        <span class="plank-top"></span><span class="plank-front"></span><span class="plank-shadow"></span>
        <svg class="bracket b1"><use href="#bracket"/></svg>
        <svg class="bracket b2"><use href="#bracket"/></svg>
      </div>
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
    ${DRAWINGS}
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
    </div>`;
  panel.querySelectorAll('.slice').forEach(btn => {
    btn.addEventListener('click', () => pick(btn.dataset.recipe));
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
