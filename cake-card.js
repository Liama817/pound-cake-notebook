// ── CAKE ⇄ CARD ─────────────────────────────────────────────
// Made to read at a glance, even in a video of someone using it:
//   Opening   the chosen cake is taken off the shelf (its spot is left
//             bare), comes toward you, and turns over into its recipe card.
//             Closing plays it backwards, and the cake settles back onto
//             its plate.
//   Marking   "Baked it" and "Want to bake" are postage stamps in the
//             photo's corner (the recipe's own painted slice, or a heart),
//             postmarked with the day. Marked (by a held gesture or the
//             buttons), the stamp pops up big in the middle of the card,
//             travels to its corner and lands; then the postmark is inked
//             over it. The stamp stays on the card.
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
  'cc.pm.made': 'BAKED',
  'cc.pm.wish': 'SOON',
  'cc.key.made': 'hold · baked it',
  'cc.key.wish': 'hold · want to bake',
  'cc.key.close': 'hold · close',
});
Object.assign(T.zh, {
  'cc.made': '做过了',
  'cc.wish': '想做',
  'cc.pm.made': '做过',
  'cc.pm.wish': '想做',
  'cc.key.made': '保持 · 做过了',
  'cc.key.wish': '保持 · 想做',
  'cc.key.close': '保持 · 关闭',
});

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const modal = document.getElementById('recipe-modal');
const card = document.getElementById('rm-card');
const nameOf = id => t('recipe.' + id) || RJ[id]?.name || '';
const sourceOf = id => (currentLang === 'zh' && RJ[id]?.zh_source) || RJ[id]?.source || '';

// ── Cake ⇄ card ─────────────────────────────────────────────

const OPEN_MS = 1600, OPEN_PULLED_MS = 1900, CLOSE_MS = 1700;
const EASE = 'cubic-bezier(.45,0,.2,1)';

// ── Pulling the cake out (a held pinch) ─────────────────────
// While the pinch is held, the cake rises off its plate and grows a little
// and the room starts to dim, so it's clear something is happening. Let go
// early and it settles back; hold to the end and it opens (open()).
let pulled = null;   // { btn, img, fl, dim }
// The cake is picked up as a copy floating above the dimming room (the shelf
// itself sits under it); its spot on the shelf is left bare meanwhile.
function pull(btn, p){
  const img = btn?.querySelector('.slice-img');
  if(!img) return;
  if(p === null){                                  // let go: back onto the plate
    if(!pulled) return;
    const { fl, dim, btn:b } = pulled;
    pulled = null;
    fl.style.transition = 'transform .35s cubic-bezier(.3,1.3,.5,1)';
    fl.style.transform = '';
    dim.style.transition = 'opacity .3s ease'; dim.style.opacity = '0';
    setTimeout(() => { fl.remove(); dim.remove(); b.classList.remove('cc-taken'); }, 360);
    return;
  }
  if(!pulled){
    const dim = document.createElement('div');
    dim.className = 'cc-dim';
    const fl = document.createElement('div');
    fl.className = 'cc-flight cc-held';
    fl.innerHTML = `<div class="cc-face cc-front"><img src="${img.currentSrc || img.src}" alt=""></div>`;
    place(fl, rectOf(img));
    document.body.append(dim, fl);
    pulled = { btn, img, fl, dim };
    btn.classList.add('cc-taken');
  }
  const e = Math.sin(p * Math.PI / 2);           // eases out: moves as soon as it's pinched, gentle to finish
  // the camera gives a new p only every frame or two: glide between them
  pulled.fl.style.transition = 'transform .18s linear';
  pulled.fl.style.transform = `translateY(${-26 * e}%) scale(${1 + .14 * e}) rotate(${-3 * e}deg)`;
  pulled.dim.style.transition = 'opacity .18s linear';
  pulled.dim.style.opacity = String(.35 * e);
}

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
  // pulled out by hand already: carry on from where the cake is held
  const wasPulled = pulled && pulled.img === img ? pulled : null;
  const from = rectOf(wasPulled ? wasPulled.fl : img);
  // open the card unseen to learn where it will be
  modal.classList.add('cc-hidden');
  reveal();
  const to = rectOf(card);
  const lifted = { ...from, top: from.top - from.height * .3 };
  const mid = middle(from, to);
  const { fl, flip, dim } = flight(id, img.currentSrc || img.src, from, false);
  btn.classList.add('cc-taken');   // the spot on the shelf is left bare
  const dimFrom = wasPulled ? .35 : 0;
  if(wasPulled){ pulled = null; wasPulled.dim.remove(); wasPulled.fl.remove(); }
  // up and toward you, a moment held in front of you, then it turns over into the card
  const path = wasPulled
    ? [{ ...box(from), offset:0, easing:'cubic-bezier(.45,0,.25,1)' }, { ...box(mid), offset:.4, easing:'linear' }, { ...box(mid), offset:.55, easing:'cubic-bezier(.45,0,.25,1)' }, { ...box(to), offset:1 }]
    : [{ ...box(from), offset:0 }, { ...box(lifted), offset:.16 }, { ...box(mid), offset:.42 }, { ...box(mid), offset:.54 }, { ...box(to), offset:1 }];
  const turn = wasPulled ? .55 : .54;
  const ms = wasPulled ? OPEN_PULLED_MS : OPEN_MS;
  const anims = [
    fl.animate(path, { duration:ms, easing:wasPulled ? 'linear' : EASE, fill:'forwards' }),
    flip.animate([
      { transform:'rotateY(0deg)', offset:0 },
      { transform:'rotateY(0deg)', offset:turn },
      { transform:'rotateY(180deg)', offset:1 },
    ], { duration:ms, easing:EASE, fill:'forwards' }),
    dim.animate([{ opacity:dimFrom }, { opacity:1, offset:.45 }, { opacity:1 }], { duration:ms, fill:'forwards' }),
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
  // just above its plate, to come down onto it softly
  const above = { ...to, top: to.top - to.height * .12 };
  const back = { ...from, left: from.left + from.width * .02, top: from.top + from.height * .02, width: from.width * .96, height: from.height * .96 };
  const { fl, flip, dim } = flight(id, img.currentSrc || img.src, from, true);
  // The reverse of opening, unhurried: the card eases back, turns over into
  // the cake held in front of you, rests a moment, then glides home and
  // settles onto its plate. Each step eases on its own, so none of it rushes.
  const io = 'cubic-bezier(.45,0,.25,1)', soft = 'cubic-bezier(.2,.6,.35,1)';
  const anims = [
    fl.animate([
      { ...box(from), offset:0, easing:io },
      { ...box(back), offset:.12, easing:io },
      { ...box(mid), offset:.46, easing:'linear' },
      { ...box(mid), offset:.56, easing:io },
      { ...box(above), offset:.9, easing:soft },
      { ...box(to), offset:1 },
    ], { duration:CLOSE_MS, fill:'forwards' }),
    flip.animate([
      { transform:'rotateY(180deg)', offset:0, easing:io },
      { transform:'rotateY(180deg)', offset:.1, easing:io },
      { transform:'rotateY(0deg)', offset:.44 },
      { transform:'rotateY(0deg)', offset:1 },
    ], { duration:CLOSE_MS, fill:'forwards' }),
    // the room comes back slowly, while the cake goes home
    dim.animate([
      { opacity:1, offset:0, easing:'linear' },
      { opacity:1, offset:.4, easing:'ease-in-out' },
      { opacity:0, offset:.95 },
      { opacity:0 },
    ], { duration:CLOSE_MS, fill:'forwards' }),
  ];
  await Promise.all(anims.map(a => a.finished));
  btn.classList.remove('cc-taken');
  fl.remove(); dim.remove();
  // on its plate: the smallest settle
  img.animate([
    { transform:'translateY(-1.5%)' }, { transform:'translateY(.6%)', offset:.6 }, { transform:'translateY(0)' },
  ], { duration:320, easing:'ease-out' });
}

// ── The stamp: a postage stamp in the photo's corner, postmarked with the day ──

const tag = document.createElement('div');
tag.className = 'cc-tag';
tag.hidden = true;
tag.innerHTML = '<span class="cc-sheet" aria-hidden="true"><span class="cc-paper"></span></span>'
  + '<div class="cc-ink" role="img"></div>'
  // the postmark: a round date stamp with wavy lines, inked over the stamp's edge
  + '<svg class="cc-postmark" viewBox="0 0 120 120" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">'
  + '<circle cx="44" cy="60" r="34"/><circle cx="44" cy="60" r="27" stroke-width="1.2"/>'
  + '<path d="M78 44q8-5 16 0t16 0t16 0M78 54q8-5 16 0t16 0t16 0M78 64q8-5 16 0t16 0t16 0M78 74q8-5 16 0t16 0t16 0"/></g>'
  + '<text class="pm-top" x="44" y="56" text-anchor="middle"></text><text class="pm-day" x="44" y="73" text-anchor="middle"></text></svg>';
card.appendChild(tag);
const ink = tag.querySelector('.cc-ink');
const postmark = tag.querySelector('.cc-postmark');
// The perforated edge: a mask with small bites all round (cake-card.css).
{
  const w = 112, h = 138, step = 9.2, r = 3.1;
  let bites = '';
  for(let x = step / 2; x < w; x += step) bites += `<circle cx='${x}' cy='0' r='${r}'/><circle cx='${x}' cy='${h}' r='${r}'/>`;
  for(let y = step / 2; y < h; y += step) bites += `<circle cx='0' cy='${y}' r='${r}'/><circle cx='${w}' cy='${y}' r='${r}'/>`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}' preserveAspectRatio='none'><mask id='p'><rect width='${w}' height='${h}' fill='white'/>${bites}</mask><rect width='${w}' height='${h}' mask='url(#p)'/></svg>`;
  tag.style.setProperty('--perf', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
}
// The stamp's picture: this recipe's own painted slice from the shelf (a heart for want to bake).
const cakePic = id => document.querySelector(`.slice[data-recipe="${id}"] .slice-img`)?.currentSrc || '';

// "Baked it" carries the day it was marked.
const madeKey = id => 'rj-made-' + id;
function bakedOn(id){
  let v = localStorage.getItem(madeKey(id));
  if(v === '1'){ v = new Date().toISOString().slice(0, 10); localStorage.setItem(madeKey(id), v); }
  return /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null;
}
function dayText(iso, withYear = true){
  if(!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if(currentLang === 'zh') return withYear ? `${y}.${m}.${d}` : `${m}.${d}`;
  return `${d} ${'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[m - 1]}` + (withYear ? ` ${y}` : '');
}

// What the tag shows for the open card: one stamp, or nothing.
function markOf(id){
  const s = id ? getStampState(id) : {};
  return s.made ? 'made' : s.wish ? 'wish' : null;
}
// The stamp's face (what it says and shows) and its postmark.
function inkFor(kind){
  ink.className = 'cc-ink ' + kind;
  const iso = bakedOn(rmCurrentId);
  const sub = kind === 'made' ? dayText(iso) : '';   // want to bake: just the heart
  const pic = (kind === 'made' && cakePic(rmCurrentId)) || 'images/stamp/heart@2x.png';
  ink.innerHTML = '<b></b><img alt=""><i></i>';
  ink.querySelector('b').textContent = t('cc.' + kind);
  ink.querySelector('img').src = pic;
  ink.querySelector('i').textContent = sub;
  ink.setAttribute('aria-label', t('cc.' + kind) + (sub ? ', ' + sub : ''));
  postmark.querySelector('.pm-top').textContent = t('cc.pm.' + kind);
  postmark.querySelector('.pm-day').textContent = kind === 'made' ? dayText(iso, false) : '♡';
}

// Show the card's stamp as it already is, without any motion.
function showMark(){
  const kind = markOf(rmCurrentId);
  tag.hidden = !kind;
  if(kind){ inkFor(kind); ink.style.opacity = ''; }
  else ink.className = 'cc-ink';
}

// Adds the stamp: it pops up big in the middle of the card, with its face
// showing, rests a beat, then arcs over to the photo's corner and lands
// with a little squash; then the postmark is inked over it.
const FLY_MS = 1100;
function stamp(kind){
  inkFor(kind);
  tag.hidden = false;
  if(reducedMotion()) return;
  // from the middle of the card (its own spot is where it ends)
  const r = tag.getBoundingClientRect(), c = card.getBoundingClientRect();
  const dx = (c.left + c.width / 2) - (r.left + r.width / 2), dy = (c.top + c.height / 2) - (r.top + r.height / 2);
  tag.animate([
    { transform:`translate(${dx}px, ${dy}px) rotate(-14deg) scale(.4)`, opacity:0, offset:0, easing:'cubic-bezier(.3,.8,.4,1.2)' },
    { transform:`translate(${dx}px, ${dy}px) rotate(-6deg) scale(2.2)`, opacity:1, offset:.24, easing:'linear' },     // pops up in the middle
    { transform:`translate(${dx}px, ${dy}px) rotate(-6deg) scale(2.15)`, offset:.4, easing:'cubic-bezier(.45,0,.3,1)' }, // a beat to see it
    { transform:`translate(${dx * .38}px, ${dy * .38 - 46}px) rotate(9deg) scale(1.45)`, offset:.72, easing:'cubic-bezier(.3,0,.4,1)' }, // arcs over…
    { transform:'translate(0, 0) rotate(0deg) scale(.93, .9)', offset:.88, easing:'ease-out' },                       // …lands
    { transform:'none', offset:1 },
  ], { duration:FLY_MS, fill:'backwards' });
  const markAt = FLY_MS + 60;   // the postmark comes down once it has landed
  postmark.animate([
    { opacity:0, transform:'scale(1.25)', filter:'blur(1.5px)' },
    { opacity:.6, filter:'blur(.6px)', offset:.35 },
    { opacity:.92, transform:'scale(.97)', offset:.7 },
    { opacity:.92, transform:'scale(1)', filter:'blur(0)' },
  ], { duration:420, delay:markAt, easing:'cubic-bezier(.2,.7,.2,1)', fill:'backwards' });
  card.animate([
    { transform:'none' }, { transform:'translateY(2px)', offset:.3 }, { transform:'none' },
  ], { duration:220, delay:markAt, easing:'ease-out' });
  setTimeout(() => burst(kind), markAt + 120);
}

// As the ink lands, a little burst of painted stickers rises from the tag:
// the oven mitt's thumbs-up for baked, a heart for want to bake.
const BURST = { made:'thumbs', wish:'heart' };
Object.values(BURST).forEach(n => { new Image().src = `images/stamp/${n}@2x.png`; });   // ready before the first stamp
function burst(kind){
  if(reducedMotion() || tag.hidden) return;
  const r = tag.getBoundingClientRect();
  // [across the tag, tilt, delay, size, drift]: a little fountain, spreading outwards
  [[-.3, -16, 0, 1, -1.6], [-.1, 10, 140, .78, -.5], [.08, -6, 60, 1.12, .3], [.3, 14, 200, .86, 1.5]].forEach(([dx, rot, delay, size, drift]) => {
    const e = document.createElement('span');
    e.className = 'cc-burst ' + BURST[kind];
    e.setAttribute('aria-hidden', 'true');
    e.style.left = (r.left + r.width * (.5 + dx)) + 'px';
    e.style.top = (r.top + r.height * .6) + 'px';
    e.style.setProperty('--r', rot + 'deg');
    e.style.setProperty('--s', size);
    e.style.setProperty('--dx', (drift * 70) + 'px');
    e.style.animationDelay = delay + 'ms';
    document.body.appendChild(e);
    setTimeout(() => e.remove(), 2000 + delay);
  });
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
    if(holding === 'close') card.style.scale = '';   // let go early: the card comes back up
    holding = kind;
  }
  if(kind === 'close') card.style.scale = String(1 - .035 * progress);
}

// ── The gesture key, in hand mode ───────────────────────────

const key = document.createElement('div');
key.className = 'cc-key';
key.innerHTML = ['made', 'wish', 'close'].map(k =>
  `<span><img class="cc-glyph" src="images/glyph/${k}.png" srcset="images/glyph/${k}@2x.png 2x" alt=""><span data-i18n="cc.key.${k}">${t('cc.key.' + k)}</span></span>`).join('');   // painted hands, like the notebook
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

window.cakeCard = { open, close, hold, stamp, preload, pull };
