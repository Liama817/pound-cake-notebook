// ── TIPS PAGE ───────────────────────────────────────────────
// The two tips on the Tips spread (markup in index.html, styles in
// tips-page.css):
//   One egg at a time.     the same batter made two ways, split down the
//                          middle: drag the line (or use the arrow keys) to
//                          compare smooth with curdled. The first time the
//                          page shows, the line peeks each way once.
//   How long will it keep? a sentence with two blanks; the answer below it
//                          follows whatever is chosen, so it is never empty.
//
// Relies on globals from index.html: WRAP_OUTCOMES_V2, currentLang, setLang,
// switchSection, T, t.

Object.assign(T.en, {
  'tips.eggs.title': 'One egg<br><em>at a time.</em>',
  'tips.eggs.how': 'Beat each egg in fully before adding the next — or the batter splits.',
  'tips.eggs.hint': 'Drag to compare the same batter, made two ways.',
  'tips.eggs.drag': 'Compare: eggs added one at a time, or all at once',
  'tips.keep.title': 'How long will<br>it <em>keep?</em>',
  'tips.keep.how': 'How',
  'wrap.s1': 'My cake is',
  'wrap.s1b': ' ',   // (an empty string would show the key)
  'wrap.s2': 'and topped with',
  'wrap.s3': '.',
});
Object.assign(T.zh, {
  'tips.eggs.title': '鸡蛋<br><em>一个一个加。</em>',
  'tips.eggs.how': '每个蛋完全打匀，再加下一个——不然面糊会油水分离。',
  'tips.eggs.hint': '拖动，对比同一份面糊的两种做法。',
  'tips.eggs.drag': '对比：鸡蛋一个一个加，或一次全加',
  'tips.keep.title': '能放<br><em>多久？</em>',
  'tips.keep.how': '怎么放',
  'wrap.s1': '我的蛋糕是',
  'wrap.s1b': '，',
  'wrap.s2': '上面',
  'wrap.s3': '。',
});

const $ = id => document.getElementById(id);
const lang = () => currentLang || 'en';
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── One egg at a time: drag to compare ──────────────────────

const split = $('tp-split');
let pos = 50;   // where the line is, as % from the left; left of it is the smooth batter

function setPos(p){
  pos = Math.min(100, Math.max(0, p));
  split.style.setProperty('--pos', pos + '%');
  split.setAttribute('aria-valuenow', Math.round(pos));
  // a label fades once its side is almost hidden
  split.classList.toggle('good-hidden', pos < 18);
  split.classList.toggle('bad-hidden', pos > 82);
}

function posFromEvent(e){
  const r = split.getBoundingClientRect();
  return (e.clientX - r.left) / r.width * 100;
}
split.addEventListener('pointerdown', e => {
  stopPeek();
  split.setPointerCapture(e.pointerId);
  split.classList.add('dragging');
  setPos(posFromEvent(e));
});
split.addEventListener('pointermove', e => {
  if(split.hasPointerCapture(e.pointerId)) setPos(posFromEvent(e));
});
const endDrag = () => split.classList.remove('dragging');
split.addEventListener('pointerup', endDrag);
split.addEventListener('pointercancel', endDrag);
split.addEventListener('keydown', e => {
  const step = { ArrowLeft:-5, ArrowDown:-5, ArrowRight:5, ArrowUp:5 }[e.key];
  if(step){ e.preventDefault(); stopPeek(); setPos(pos + step); }
  else if(e.key === 'Home'){ e.preventDefault(); stopPeek(); setPos(0); }
  else if(e.key === 'End'){ e.preventDefault(); stopPeek(); setPos(100); }
});

// The first time Tips opens, the line glides a little each way and back,
// so it's clear the picture can be dragged.
let peeked = false, peekFrame = 0;
function peek(){
  if(peeked || reducedMotion()) return;
  peeked = true;
  const keys = [[0, 50], [700, 50], [1300, 30], [2100, 70], [2700, 50]];
  const ease = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  const t0 = performance.now();
  const tick = now => {
    const t = Math.max(0, now - t0);   // a frame's timestamp can be a moment before t0
    const i = keys.findIndex(([at]) => at > t);
    if(i === -1){ setPos(50); return; }
    if(i === 0){ peekFrame = requestAnimationFrame(tick); return; }
    const [ta, pa] = keys[i - 1], [tb, pb] = keys[i];
    setPos(pa + (pb - pa) * ease((t - ta) / (tb - ta)));
    peekFrame = requestAnimationFrame(tick);
  };
  peekFrame = requestAnimationFrame(tick);
}
function stopPeek(){ peeked = true; cancelAnimationFrame(peekFrame); }

const originalSwitchSection = window.switchSection;
window.switchSection = function(s){
  originalSwitchSection(s);
  if(s === 'tips') setTimeout(peek, 500);   // after the slide in
};

// ── How long will it keep? ──────────────────────────────────

const q1 = $('tp-q1'), q2 = $('tp-q2');

function renderStorage(){
  const key = q1.value === 'C' ? 'C-anything' : `${q1.value}-${q2.value}`;
  const outcome = WRAP_OUTCOMES_V2[key] || WRAP_OUTCOMES_V2['A-nothing'];
  const o = outcome[lang()] || outcome.en;
  // the time is the headline; "in fridge" is already said by how to store it
  $('tp-keeps').textContent = o.keeps.replace(/\s*in fridge$/, '').replace(/^冰箱冷藏/, '');
  $('tp-store').textContent = o.store;
  $('tp-note').textContent = o.storeNote;
  $('tp-flavor').textContent = o.flavor;
  fitBlanks();
}

// A <select> is as wide as its longest option; size each blank to the words
// actually chosen, so the sentence reads as a sentence.
const ruler = document.createElement('span');
ruler.setAttribute('aria-hidden', 'true');
ruler.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:0';
document.body.appendChild(ruler);
function fitBlanks(){
  [q1, q2].forEach(sel => {
    if(!sel.offsetParent) return;   // not on screen: measured when it is shown
    const cs = getComputedStyle(sel);
    ruler.style.font = cs.font;
    ruler.style.letterSpacing = cs.letterSpacing;
    ruler.textContent = sel.options[sel.selectedIndex].text;
    const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    sel.style.width = Math.ceil(ruler.getBoundingClientRect().width + pad + 2) + 'px';
  });
}

q1.addEventListener('change', renderStorage);
q2.addEventListener('change', renderStorage);
window.addEventListener('resize', fitBlanks);
new ResizeObserver(fitBlanks).observe($('tips-panel'));
// measure again once the web fonts arrive; the fallback font is wider
document.fonts?.ready.then(fitBlanks);
document.fonts?.addEventListener('loadingdone', fitBlanks);

// ── Language ────────────────────────────────────────────────

// Chinese reads as one running sentence, so its two halves don't split into lines
function markLang(){ document.querySelector('.tp')?.classList.toggle('tp-zh', lang() === 'zh'); }
function labelControls(){
  [q1, q2, split].forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nLabel)));
}

const originalSetLang = window.setLang;
window.setLang = function(l){
  originalSetLang(l);
  markLang();
  labelControls();
  renderStorage();
};

markLang();
labelControls();
setPos(50);
renderStorage();
