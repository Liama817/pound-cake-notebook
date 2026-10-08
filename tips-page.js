// ── TIPS PAGE ───────────────────────────────────────────────
// The two tools on the Tips spread (markup in index.html, styles in
// tips-page.css):
//   Is My Batter Ready?   one photo of the bowl per step, back / next, and
//                         at the end a choice of how to add the eggs.
//   How to Store Your Cake  a sentence with two blanks; the answer below it
//                         follows whatever is chosen, so it is never empty.
//
// Relies on globals from index.html: CREAM_STEPS, WRAP_OUTCOMES_V2,
// currentLang, setLang, T, t.

Object.assign(T.en, {
  'tips.stepOf': 'Step {n} of {total}',
  'tips.back': '← back',
  'tips.next': 'next →',
  'wrap.s1': 'My cake is',
  'wrap.s1b': '',
  'wrap.s2': 'and topped with',
  'wrap.s3': '.',
});
Object.assign(T.zh, {
  'tips.stepOf': '第 {n} 步，共 {total} 步',
  'tips.back': '← 上一步',
  'tips.next': '下一步 →',
  'wrap.s1': '我的蛋糕是',
  'wrap.s1b': '，',
  'wrap.s2': '上面',
  'wrap.s3': '。',
});

const $ = id => document.getElementById(id);
const lang = () => currentLang || 'en';

// ── Is My Batter Ready? ─────────────────────────────────────

const EGGS = {
  good: { img: './images/bowl-5-egg-added.png', key: 'cream.result.good' },
  bad:  { img: './images/bowl-6-curdled.png',   key: 'cream.result.bad'  },
};
let step = 0;
let eggs = null;   // 'good' | 'bad' once the eggs are in

const bowl = $('tp-bowl');
function showBowl(src, animate){
  if(bowl.getAttribute('src') === src) return;
  if(!animate){ bowl.src = src; return; }
  bowl.style.opacity = '0';
  setTimeout(() => { bowl.src = src; bowl.style.opacity = '1'; }, 200);
}

function renderBatter(animate = false){
  const s = CREAM_STEPS[step];
  const words = s[lang()] || s.en;
  const last = step === CREAM_STEPS.length - 1;
  $('tp-step-count').textContent = eggs
    ? t('cream.decide.' + eggs)
    : `${t('tips.stepOf').replace('{n}', step + 1).replace('{total}', CREAM_STEPS.length)} · ${words.label}`;
  $('tp-step-say').textContent = eggs ? t(EGGS[eggs].key) : words.action;
  showBowl(eggs ? EGGS[eggs].img : s.img, animate);
  $('tp-back').disabled = step === 0;
  $('tp-nav').hidden = !!eggs;
  $('tp-next').hidden = last;
  $('tp-eggs').hidden = !last || !!eggs;
  $('tp-done').hidden = !eggs;
}

$('tp-back').addEventListener('click', () => { step = Math.max(0, step - 1); renderBatter(true); });
$('tp-next').addEventListener('click', () => { step = Math.min(CREAM_STEPS.length - 1, step + 1); renderBatter(true); });
document.querySelectorAll('[data-eggs]').forEach(b =>
  b.addEventListener('click', () => { eggs = b.dataset.eggs; renderBatter(true); }));
$('tp-again').addEventListener('click', () => { step = 0; eggs = null; renderBatter(true); });

// ── How to Store Your Cake ──────────────────────────────────

const q1 = $('tp-q1'), q2 = $('tp-q2');

function renderStorage(){
  const key = q1.value === 'C' ? 'C-anything' : `${q1.value}-${q2.value}`;
  const outcome = WRAP_OUTCOMES_V2[key] || WRAP_OUTCOMES_V2['A-nothing'];
  const o = outcome[lang()] || outcome.en;
  $('tp-store').textContent = o.store;
  $('tp-note').textContent = o.storeNote;
  $('tp-flavor').textContent = o.flavor;
  $('tp-keeps').textContent = o.keeps;
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
function labelBlanks(){
  [q1, q2].forEach(sel => sel.setAttribute('aria-label', t(sel.dataset.i18nLabel)));
}

q1.addEventListener('change', renderStorage);
q2.addEventListener('change', renderStorage);
window.addEventListener('resize', fitBlanks);
new ResizeObserver(fitBlanks).observe($('tips-panel'));
// measure again once the web fonts arrive; the fallback font is wider
document.fonts?.ready.then(fitBlanks);
document.fonts?.addEventListener('loadingdone', fitBlanks);

// ── Language and showing the page ───────────────────────────

const originalSetLang = window.setLang;
window.setLang = function(l){
  originalSetLang(l);
  markLang();
  labelBlanks();
  renderBatter();
  renderStorage();
};

// Chinese reads as one running sentence, so its two halves don't split into lines
function markLang(){ document.querySelector('.tp')?.classList.toggle('tp-zh', lang() === 'zh'); }

markLang();
labelBlanks();
renderBatter();
renderStorage();
