// ── CAKE ⇄ CARD ─────────────────────────────────────────────
// Made to read at a glance, even in a video of someone using it:
//   Opening   the chosen cake is taken off the shelf (its spot is left
//             bare), comes toward you, and turns over into its recipe card.
//             Closing plays it backwards, and the cake settles back onto
//             its plate with a little bounce.
//   Marking   "Baked it" (with the day) and "Want to bake" are rubber
//             stamps, inked onto a small paper tag taped to the photo's
//             corner, where the ink always has clean paper under it. Held by
//             hand, the stamp's shadow comes down onto the tag as the gesture
//             is held, and the ink lands when it touches; by the buttons, it
//             comes down at once. The stamp stays on the card.
//   Closing   holding an open palm lets the card sink a little, as if being
//             put away, before it turns back into the cake.
//   Key       in hand mode, the card's foot says which gesture does what.
// recipe-shelf.js calls open()/close(); hand-flip.js calls hold().
//
// Relies on globals from index.html: RJ, rmCurrentId, toggleMade,
// toggleWish, getStampState, currentLang, T, t.

Object.assign(T.en, {
  'cc.made': 'Baked it',
  'cc.wish': 'Want to bake',
  'cc.key.made': 'hold · baked it',
  'cc.key.wish': 'hold · want to bake',
  'cc.key.close': 'hold · close',
});
Object.assign(T.zh, {
  'cc.made': '做过了',
  'cc.wish': '想做',
  'cc.key.made': '保持 · 做过了',
  'cc.key.wish': '保持 · 想做',
  'cc.key.close': '保持 · 关闭',
});

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const modal = document.getElementById('recipe-modal');
const card = document.getElementById('rm-card');
const nameOf = id => t('recipe.' + id) || RJ[id]?.name || '';
const sourceOf = id => (currentLang === 'zh' && RJ[id]?.zh_source) || RJ[id]?.source || '';
const GESTURE = { made:'👍', wish:'🫶', close:'✋' };

// ── Cake ⇄ card ─────────────────────────────────────────────

const OPEN_MS = 1050, CLOSE_MS = 900;
const EASE = 'cubic-bezier(.45,0,.2,1)';

function flight(id, src, rect, flipped){
  const fl = document.createElement('div');
  fl.className = 'cc-flight';
  fl.innerHTML = `
    <div class="cc-flip"${flipped ? ' style="transform:rotateY(180deg)"' : ''}>
      <div class="cc-face cc-front"><img src="${src}" alt=""></div>
      <div class="cc-face cc-back">
        <div class="cc-back-text"><span class="cc-eyebrow">pound cake</span><b></b><i></i><span class="cc-lines"></span></div>
        <div class="cc-back-photo"><img alt=""></div>
      </div>
    </div>`;
  fl.querySelector('.cc-back b').textContent = nameOf(id);
  fl.querySelector('.cc-back i').textContent = sourceOf(id);
  fl.querySelector('.cc-back-photo img').src = RJ[id]?.photo || '';
  place(fl, rect);
  const dim = document.createElement('div');
  dim.className = 'cc-dim';
  document.body.append(dim, fl);
  return { fl, flip: fl.firstElementChild, dim };
}
const box = r => ({ left:r.left + 'px', top:r.top + 'px', width:r.width + 'px', height:r.height + 'px' });
function place(el, r){ Object.assign(el.style, box(r)); }
const rectOf = el => { const r = el.getBoundingClientRect(); return { left:r.left, top:r.top, width:r.width, height:r.height }; };

// Halfway: the cake held up in front of you, before it turns over. Never
// bigger than the card it becomes, so it grows into place.
function middle(cake, target){
  const h = Math.min(target.height * .6, innerHeight * .5);
  const w = h * cake.width / cake.height;
  return { left:(innerWidth - w) / 2, top:(innerHeight - h) / 2, width:w, height:h };
}

// Decoding a big photo while the cake is in the air would stall it, so each
// recipe's photo is decoded ahead: when its cake is pointed at or hovered,
// and at the latest just before it flies (waiting a moment at most).
const decoded = new Map();
function preload(id){
  const src = RJ[id]?.photo;
  if(!src) return Promise.resolve();
  if(!decoded.has(id)){
    const im = new Image();
    im.src = src;
    decoded.set(id, im.decode().catch(() => {}));
  }
  return decoded.get(id);
}
const atMost = ms => new Promise(r => setTimeout(r, ms));

// btn: the cake's button on the shelf; reveal(): opens the card.
async function open(btn, id, reveal){
  const img = btn.querySelector('.slice-img');
  if(!img || reducedMotion()){ reveal(); return; }
  await Promise.race([Promise.all([preload(id), img.decode?.().catch(() => {})]), atMost(400)]);
  const from = rectOf(img);
  // open the card unseen to learn where it will be
  modal.classList.add('cc-hidden');
  reveal();
  const to = rectOf(card);
  const lifted = { ...from, top: from.top - from.height * .3 };
  const mid = middle(from, to);
  const { fl, flip, dim } = flight(id, img.currentSrc || img.src, from, false);
  btn.classList.add('cc-taken');   // the spot on the shelf is left bare
  const anims = [
    fl.animate([
      { ...box(from), offset:0 },
      { ...box(lifted), offset:.18 },
      { ...box(mid), offset:.5 },
      { ...box(to), offset:1 },
    ], { duration:OPEN_MS, easing:EASE, fill:'forwards' }),
    flip.animate([
      { transform:'rotateY(0deg)', offset:0 },
      { transform:'rotateY(0deg)', offset:.5 },
      { transform:'rotateY(180deg)', offset:1 },
    ], { duration:OPEN_MS, easing:EASE, fill:'forwards' }),
    dim.animate([{ opacity:0 }, { opacity:1, offset:.5 }, { opacity:1 }], { duration:OPEN_MS, fill:'forwards' }),
  ];
  await Promise.all(anims.map(a => a.finished));
  modal.classList.add('cc-arrived');      // the card is already in place: no entrance of its own
  modal.classList.remove('cc-hidden');
  await fl.animate([{ opacity:1 }, { opacity:0 }], { duration:140, fill:'forwards' }).finished;
  fl.remove(); dim.remove();
}

// hide(): closes the card. Resolves once the cake is back on the shelf.
async function close(btn, id, hide){
  const img = btn && btn.querySelector('.slice-img');
  if(!img || reducedMotion() || !modal.classList.contains('open')){ hide(); btn?.classList.remove('cc-taken'); return; }
  const from = rectOf(card);
  hide();
  modal.classList.remove('cc-arrived');
  const to = rectOf(img);
  const mid = middle(to, from);
  const lifted = { ...to, top: to.top - to.height * .3 };
  const { fl, flip, dim } = flight(id, img.currentSrc || img.src, from, true);
  const anims = [
    fl.animate([
      { ...box(from), offset:0 },
      { ...box(mid), offset:.45 },
      { ...box(lifted), offset:.82 },
      { ...box(to), offset:1 },
    ], { duration:CLOSE_MS, easing:EASE, fill:'forwards' }),
    flip.animate([
      { transform:'rotateY(180deg)', offset:0 },
      { transform:'rotateY(0deg)', offset:.45 },
      { transform:'rotateY(0deg)', offset:1 },
    ], { duration:CLOSE_MS, easing:EASE, fill:'forwards' }),
    dim.animate([{ opacity:1 }, { opacity:1, offset:.3 }, { opacity:0, offset:.8 }, { opacity:0 }], { duration:CLOSE_MS, fill:'forwards' }),
  ];
  await Promise.all(anims.map(a => a.finished));
  btn.classList.remove('cc-taken');
  fl.remove(); dim.remove();
  // back on its plate: a little bounce
  img.animate([
    { transform:'translateY(-5%)' }, { transform:'translateY(1.5%)', offset:.55 }, { transform:'translateY(0)' },
  ], { duration:360, easing:'cubic-bezier(.3,.7,.3,1)' });
}

// ── The stamp, on a paper tag taped to the photo's corner ──

const tag = document.createElement('div');
tag.className = 'cc-tag';
tag.hidden = true;
tag.innerHTML = '<span class="cc-tape" aria-hidden="true"></span><span class="cc-shadow" aria-hidden="true"></span><div class="cc-ink" role="img"></div>';
card.appendChild(tag);
const shadow = tag.querySelector('.cc-shadow');
const ink = tag.querySelector('.cc-ink');

// "Baked it" carries the day it was marked.
const madeKey = id => 'rj-made-' + id;
function bakedOn(id){
  let v = localStorage.getItem(madeKey(id));
  if(v === '1'){ v = new Date().toISOString().slice(0, 10); localStorage.setItem(madeKey(id), v); }
  return /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null;
}
function dayText(iso){
  if(!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if(currentLang === 'zh') return `${y}.${m}.${d}`;
  return `${d} ${'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[m - 1]} ${y}`;
}

// What the tag shows for the open card: one stamp, or nothing.
function markOf(id){
  const s = id ? getStampState(id) : {};
  return s.made ? 'made' : s.wish ? 'wish' : null;
}
function inkFor(kind){
  ink.className = 'cc-ink ' + kind;
  const sub = kind === 'made' ? dayText(bakedOn(rmCurrentId)) : nameOf(rmCurrentId);
  ink.innerHTML = `<b></b><span class="cc-mark">${kind === 'made' ? '✓' : '♡'}</span><i></i>`;
  ink.querySelector('b').textContent = t('cc.' + kind);
  ink.querySelector('i').textContent = sub;
  ink.setAttribute('aria-label', t('cc.' + kind) + (sub ? ', ' + sub : ''));
}
// The stamp's shadow is driven by plain style changes and a CSS transition
// (never by element.animate, whose finished effects can linger and pin it).
// ms: how long it takes to get there; 0 = at once.
function shadowTo(opacity, scale, ms = 0, easing = 'ease-in'){
  shadow.style.transition = ms ? `opacity ${ms}ms ${easing}, transform ${ms}ms ${easing}` : 'none';
  shadow.style.opacity = String(opacity);
  shadow.style.transform = `scale(${scale}) rotate(-6deg)`;
}
const reflow = el => el.offsetWidth;

// Show the card's stamp as it already is, without any motion.
function showMark(){
  const kind = markOf(rmCurrentId);
  tag.hidden = !kind;
  tag.classList.remove('arriving');
  shadowTo(0, 1.35);
  if(kind){ inkFor(kind); ink.style.opacity = ''; }
  else ink.className = 'cc-ink';
}

let pressed = 0;   // how far the hand has brought the stamp down (0–1)

// Lands the stamp: from a hand hold the shadow is already down; from a
// button it comes down quickly first.
function stamp(kind){
  inkFor(kind);
  const fresh = tag.hidden;
  tag.hidden = false;
  if(reducedMotion()){ shadowTo(0, 1.35); return; }
  if(fresh){ tag.classList.remove('arriving'); reflow(tag); tag.classList.add('arriving'); }
  const lead = pressed > .9 ? 0 : (fresh ? 380 : 160);
  if(lead){ shadowTo(0, 1.35); reflow(shadow); shadowTo(1, 1, lead); }
  setTimeout(() => shadowTo(0, 1, 220, 'ease-out'), lead);   // it lifts as the ink lands
  ink.animate([
    { opacity:0, transform:'scale(1.04)', filter:'blur(1.2px)' },
    { opacity:.55, transform:'scale(1.04)', filter:'blur(.8px)', offset:.12 },
    { opacity:.95, transform:'scale(1)', filter:'blur(0)' },
  ], { duration:480, delay:lead, easing:'cubic-bezier(.2,.7,.2,1)', fill:'backwards' });
  card.animate([
    { transform:'none' }, { transform:'translateY(2px)', offset:.3 }, { transform:'none' },
  ], { duration:220, delay:lead, easing:'ease-out' });
  pressed = 0;
}

// Marking by hand or by the buttons both go through toggleMade / toggleWish.
['made', 'wish'].forEach(kind => {
  const name = kind === 'made' ? 'toggleMade' : 'toggleWish';
  const original = window[name];
  window[name] = function(e){
    original(e);
    if(!rmCurrentId) return;
    if(getStampState(rmCurrentId)[kind]){
      if(kind === 'made') localStorage.setItem(madeKey(rmCurrentId), new Date().toISOString().slice(0, 10));
      stamp(kind);
    } else showMark();   // unmarked: the tag goes
  };
});

// ── Holding a gesture on the card ───────────────────────────

let holding = null;
// kind: 'made' | 'wish' | 'close' | null; progress 0–1
function hold(kind, progress = 0){
  if(!modal.classList.contains('open')) kind = null;
  if(kind !== holding){
    // let go early: the stamp lifts away, the card comes back up
    if(holding === 'made' || holding === 'wish'){
      shadowTo(0, 1.35, 200, 'ease-out');
      if(!markOf(rmCurrentId)) tag.hidden = true;
      pressed = 0;
    }
    if(holding === 'close') card.style.scale = '';
    holding = kind;
    if((kind === 'made' || kind === 'wish') && tag.hidden){
      ink.className = 'cc-ink';   // a blank tag, waiting for its stamp
      tag.hidden = false;
      tag.classList.remove('arriving'); void tag.offsetWidth; tag.classList.add('arriving');
    }
  }
  if(kind === 'made' || kind === 'wish'){
    // the stamp comes down as the gesture is held
    pressed = progress;
    shadowTo(progress, 1.35 - .35 * progress);
  }
  if(kind === 'close') card.style.scale = String(1 - .035 * progress);
}

// ── The gesture key, in hand mode ───────────────────────────

const key = document.createElement('div');
key.className = 'cc-key';
key.innerHTML = ['made', 'wish', 'close'].map(k =>
  `<span><b aria-hidden="true">${GESTURE[k]}</b><span data-i18n="cc.key.${k}">${t('cc.key.' + k)}</span></span>`).join('');
card.appendChild(key);

// Opening a card shows its stamp; closing it clears what the hand left.
let wasOpen = false;
new MutationObserver(() => {
  const isOpen = modal.classList.contains('open');
  if(isOpen && !wasOpen) showMark();
  if(!isOpen){ hold(null); card.style.scale = ''; }
  wasOpen = isOpen;
}).observe(modal, { attributes:true, attributeFilter:['class'] });

const originalSetLang = window.setLang;
window.setLang = function(l){
  originalSetLang(l);
  if(modal.classList.contains('open')) showMark();
};

window.cakeCard = { open, close, hold, stamp, preload };
