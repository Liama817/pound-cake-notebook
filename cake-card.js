// ── CAKE ⇄ CARD ─────────────────────────────────────────────
// Made to read at a glance, even in a video of someone using it:
//   Opening   the chosen cake is taken off the shelf (its spot is left
//             bare), comes toward you, and turns over into its recipe card.
//             Closing plays it backwards, and the cake settles back onto
//             its plate.
//   Marking   "Baked it" (with the day) and "Want to bake" are rubber
//             stamps, inked onto a small paper tag taped to the photo's
//             corner, where the ink always has clean paper under it. Held by
//             hand, the stamp's shadow comes down onto the tag as the gesture
//             is held, and the ink lands when it touches; by the buttons, it
//             comes down at once. Then a sticker (👍 or ♥) is pressed onto
//             the tag's corner. Stamp and sticker stay on the card.
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

// ── The stamp, on a paper tag taped to the photo's corner ──

const tag = document.createElement('div');
tag.className = 'cc-tag';
tag.hidden = true;
tag.innerHTML = '<span class="cc-tape" aria-hidden="true"></span><span class="cc-shadow" aria-hidden="true"></span><div class="cc-ink" role="img"></div>'
  + '<span class="cc-sticker" aria-hidden="true"><i class="cc-shine"></i></span>';   // its picture follows the ink (cake-card.css)
card.appendChild(tag);
const shadow = tag.querySelector('.cc-shadow');
const ink = tag.querySelector('.cc-ink');
const sticker = tag.querySelector('.cc-sticker');

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
  glue(lead + 260);
  pressed = 0;
}

// Once the ink is down, a sticker is pressed onto the tag's corner (a
// thumbs-up for baked, a heart for want to bake): it comes down from above,
// lifted and tilted, is pressed flat with a little squash, and its gloss is
// smoothed down. It stays on, like the ink.
['thumb', 'heart'].forEach(n => { new Image().src = `images/stamp/sticker-${n}@2x.png`; });   // ready before the first stamp
function glue(delay){
  if(reducedMotion()) return;
  // fill: backwards only: hidden until its turn, then nothing left pinning it
  sticker.animate([
    { opacity:0, transform:'translate(26px,-70px) rotate(-34deg) scale(1.55)', filter:'drop-shadow(10px 26px 14px rgba(60,35,10,.22))' },
    { opacity:1, transform:'translate(16px,-44px) rotate(-26deg) scale(1.45)', filter:'drop-shadow(9px 22px 12px rgba(60,35,10,.24))', offset:.18 },
    { transform:'translate(0,0) rotate(-14deg) scale(1.06)', filter:'drop-shadow(2px 5px 4px rgba(60,35,10,.3))', offset:.5, easing:'ease-out' },
    { transform:'translate(0,1px) rotate(-11deg) scale(.93,.9)', filter:'drop-shadow(1px 2px 1.5px rgba(60,35,10,.32))', offset:.62, easing:'ease-out' },
    { transform:'rotate(-12deg) scale(1.03)', offset:.78 },
    { opacity:1, transform:'rotate(-12deg) scale(1)', filter:'drop-shadow(1px 2px 2px rgba(60,35,10,.28))' },
  ], { duration:900, delay, easing:'cubic-bezier(.3,.6,.4,1)', fill:'backwards' });
  // smoothing it down: a gleam passes over it once it's flat
  sticker.firstElementChild.animate([
    { backgroundPosition:'160% 0' }, { backgroundPosition:'-60% 0' },
  ], { duration:620, delay:delay + 640, easing:'ease-in-out' });
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

window.cakeCard = { open, close, hold, stamp, preload, pull };
