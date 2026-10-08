// ── CAKE ⇄ CARD ─────────────────────────────────────────────
// Made to read at a glance, even in a video of someone using it:
//   Opening   the chosen cake is taken off the shelf (its spot is left
//             bare), comes toward you, and turns over into its recipe card.
//             Closing plays it backwards, back onto the shelf.
//   Holding   while a hand holds 👍, 🫶 or ✋ on the card, the gesture shows
//             big in the middle of the card with a ring filling around it.
//   Marking   when a card is marked baked or want-to-bake (by hand or by
//             its buttons), a big stamp lands on it, then settles into the
//             small button.
//   Key       in hand mode, the card shows which gesture does what.
// recipe-shelf.js calls open()/close(); hand-flip.js calls hold().
//
// Relies on globals from index.html: RJ, rmCurrentId, toggleMade,
// toggleWish, getStampState, currentLang, T, t.

Object.assign(T.en, {
  'cc.made': 'Baked it ✓',
  'cc.wish': 'Want to bake ♡',
  'cc.hold.made': 'keep holding…',
  'cc.hold.wish': 'keep holding…',
  'cc.hold.close': 'closing…',
  'cc.key.made': 'hold · baked it',
  'cc.key.wish': 'hold · want to bake',
  'cc.key.close': 'hold · close',
});
Object.assign(T.zh, {
  'cc.made': '做过了 ✓',
  'cc.wish': '想做 ♡',
  'cc.hold.made': '保持住…',
  'cc.hold.wish': '保持住…',
  'cc.hold.close': '正在关闭…',
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

const OPEN_MS = 1500, CLOSE_MS = 1150;
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

// Halfway: the cake held up in front of you, big, before it turns over.
function middle(cake, target){
  const h = Math.min(target.height * .7, innerHeight * .55);
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
  const lifted = { ...from, top: from.top - from.height * .35 };
  const mid = middle(from, to);
  const { fl, flip, dim } = flight(id, img.currentSrc || img.src, from, false);
  btn.classList.add('cc-taken');   // the spot on the shelf is left bare
  const anims = [
    fl.animate([
      { ...box(from), offset:0 },
      { ...box(lifted), offset:.2 },
      { ...box(mid), offset:.55 },
      { ...box(to), offset:1 },
    ], { duration:OPEN_MS, easing:EASE, fill:'forwards' }),
    flip.animate([
      { transform:'rotateY(0deg)', offset:0 },
      { transform:'rotateY(0deg)', offset:.55 },
      { transform:'rotateY(180deg)', offset:1 },
    ], { duration:OPEN_MS, easing:EASE, fill:'forwards' }),
    dim.animate([{ opacity:0 }, { opacity:1, offset:.55 }, { opacity:1 }], { duration:OPEN_MS, fill:'forwards' }),
  ];
  await Promise.all(anims.map(a => a.finished));
  modal.classList.add('cc-arrived');      // the card is already in place: no entrance of its own
  modal.classList.remove('cc-hidden');
  await fl.animate([{ opacity:1 }, { opacity:0 }], { duration:180, fill:'forwards' }).finished;
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
  const lifted = { ...to, top: to.top - to.height * .35 };
  const { fl, flip, dim } = flight(id, img.currentSrc || img.src, from, true);
  const anims = [
    fl.animate([
      { ...box(from), offset:0 },
      { ...box(mid), offset:.45 },
      { ...box(lifted), offset:.8 },
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
}

// ── Holding a gesture ───────────────────────────────────────

const holdEl = document.createElement('div');
holdEl.className = 'cc-hold';
holdEl.hidden = true;
holdEl.innerHTML = '<div><span class="cc-hold-emoji"></span><small></small></div>';
card.appendChild(holdEl);
let holding = null;

// kind: 'made' | 'wish' | 'close' | null; progress 0–1
function hold(kind, progress = 0){
  if(!modal.classList.contains('open')) kind = null;
  if(kind !== holding){
    holding = kind;
    holdEl.hidden = !kind;
    if(kind){
      holdEl.dataset.kind = kind;
      holdEl.querySelector('.cc-hold-emoji').textContent = GESTURE[kind];
      holdEl.querySelector('small').textContent = t('cc.hold.' + kind);
    }
  }
  if(kind) holdEl.style.setProperty('--p', (progress * 100).toFixed(1) + '%');
}

// ── The stamp ───────────────────────────────────────────────

function stamp(kind){
  card.querySelectorAll('.cc-stamp, .cc-heart').forEach(e => e.remove());
  if(reducedMotion()) return;
  const s = document.createElement('div');
  s.className = 'cc-stamp ' + kind;
  s.innerHTML = '<span></span><small></small>';
  s.firstChild.textContent = t('cc.' + kind);
  s.lastChild.textContent = nameOf(rmCurrentId);
  card.appendChild(s);
  card.animate([
    { transform:'none' }, { transform:'translate(0,6px) scale(.995)', offset:.25 }, { transform:'translate(-3px,-2px)', offset:.5 }, { transform:'none' },
  ], { duration:320, delay:170 });
  if(kind === 'wish'){
    [[22, -8], [36, 10], [50, -4], [64, 12], [78, -10]].forEach(([x, r], i) => {
      const h = document.createElement('span');
      h.className = 'cc-heart';
      h.textContent = '❤️';
      h.style.left = x + '%';
      h.style.setProperty('--r', r + 'deg');
      h.style.animationDelay = (220 + i * 90) + 'ms';
      card.appendChild(h);
    });
  }
  // after a moment it settles into the small button, which is now filled in
  const btn = document.getElementById(kind === 'made' ? 'rm-made-btn' : 'rm-wish-btn');
  setTimeout(() => {
    const a = s.getBoundingClientRect(), b = btn.getBoundingClientRect();
    const dx = (b.left + b.width / 2) - (a.left + a.width / 2), dy = (b.top + b.height / 2) - (a.top + a.height / 2);
    s.animate([
      { transform:'translate(-50%,-50%) rotate(-10deg)', opacity:1 },
      { transform:`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(0deg) scale(.15)`, opacity:0 },
    ], { duration:520, easing:'cubic-bezier(.5,0,.3,1)', fill:'forwards' }).finished.then(() => s.remove());
  }, 1500);
  setTimeout(() => card.querySelectorAll('.cc-heart').forEach(e => e.remove()), 2600);
}

// Marking by hand or by the buttons both go through toggleMade / toggleWish.
['made', 'wish'].forEach(kind => {
  const name = kind === 'made' ? 'toggleMade' : 'toggleWish';
  const original = window[name];
  window[name] = function(e){
    original(e);
    if(rmCurrentId && getStampState(rmCurrentId)[kind]) stamp(kind);
    else card.querySelectorAll('.cc-stamp.' + kind).forEach(s => s.remove());
  };
});

// ── The gesture key, in hand mode ───────────────────────────

const key = document.createElement('div');
key.className = 'cc-key';
key.innerHTML = ['made', 'wish', 'close'].map(k =>
  `<span><b aria-hidden="true">${GESTURE[k]}</b><span data-i18n="cc.key.${k}">${t('cc.key.' + k)}</span></span>`).join('');
card.appendChild(key);

// a card closed by any means loses its leftovers
new MutationObserver(() => {
  if(modal.classList.contains('open')) return;
  hold(null);
  card.querySelectorAll('.cc-stamp, .cc-heart').forEach(e => e.remove());
}).observe(modal, { attributes:true, attributeFilter:['class'] });

window.cakeCard = { open, close, hold, stamp, preload };
