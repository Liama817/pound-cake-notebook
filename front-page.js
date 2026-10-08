// ── FRONT PAGE ──────────────────────────────────────────────
// The first thing a visitor sees: the project's title page, with one way in.
// Start fades the title page away and begins the hand-mode welcome exactly as
// "Say hi to open" does under the cover (hand-flip.js): the big mirror, a
// wave, and the notebook opens. The click on Start is what lets the browser
// ask for the camera.
//
// If hand mode can't load, Start simply opens the notebook.
//
// Relies on globals from index.html: T, t, currentLang, setLang, openBook;
// and window.handFlip (hand-flip.js).

Object.assign(T.en, {
  'front.title': 'The Pound Cake Notebook',
  'front.by': 'by Lia',
  'front.note': 'Uses your camera, so you can turn the pages by hand. Video stays on your device.',
  'front.start': 'Start',
  'front.wave': 'open the notebook',
  'front.sweep': 'turn a page',
  'front.pinch': 'open a recipe',
  'front.palm': 'close it again',
  'front.waveKey': 'wave',
  'front.sweepKey': 'sweep',
  'front.pinchKey': 'point + pinch',
  'front.palmKey': 'hold a palm',
});
Object.assign(T.zh, {
  'front.title': '磅蛋糕笔记',
  'front.by': 'by Lia',
  'front.note': '会使用你的摄像头，让你用手翻页。视频只在你的设备上处理。',
  'front.start': '开始',
  'front.wave': '打开笔记本',
  'front.sweep': '翻一页',
  'front.pinch': '打开一份食谱',
  'front.palm': '再合上',
  'front.waveKey': '挥手',
  'front.sweepKey': '划动',
  'front.pinchKey': '指向 + 捏合',
  'front.palmKey': '张开手掌停住',
});

const FADE_MS = 600;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const KEYS = [
  ['front.waveKey', 'front.wave'],
  ['front.sweepKey', 'front.sweep'],
  ['front.pinchKey', 'front.pinch'],
  ['front.palmKey', 'front.palm'],
];

const front = document.createElement('section');
front.className = 'fp';
front.setAttribute('aria-label', t('front.title'));
front.innerHTML = `
  <button class="fp-lang" type="button">EN / 中文</button>
  <div class="fp-main">
    <h1 class="fp-title" data-i18n="front.title">${t('front.title')}</h1>
    <p class="fp-by" data-i18n="front.by">${t('front.by')}</p>
    <p class="fp-note" data-i18n="front.note">${t('front.note')}</p>
    <button class="fp-start" type="button" data-i18n="front.start">${t('front.start')}</button>
  </div>
  <dl class="fp-keys">
    ${KEYS.map(([k, v]) => `<div><dt data-i18n="${k}">${t(k)}</dt><dd data-i18n="${v}">${t(v)}</dd></div>`).join('')}
  </dl>`;
document.body.appendChild(front);
document.body.classList.add('fp-showing');

const startBtn = front.querySelector('.fp-start');
startBtn.focus({ preventScroll:true });

function start(){
  if(front.classList.contains('leaving')) return;
  front.classList.add('leaving');
  // begin the welcome now, inside the click, so the browser lets it ask for the camera
  if(window.handFlip?.startIntro) window.handFlip.startIntro();
  else window.openBook?.();
  setTimeout(() => {
    front.remove();
    document.body.classList.remove('fp-showing');
  }, reducedMotion() ? 0 : FADE_MS);
}
startBtn.addEventListener('click', start);

front.querySelector('.fp-lang').addEventListener('click', () => setLang(currentLang === 'zh' ? 'en' : 'zh'));
const syncLang = () => front.querySelector('.fp-lang').classList.toggle('zh', currentLang === 'zh');
const originalSetLang = window.setLang;
window.setLang = function(lang){ originalSetLang(lang); syncLang(); };
syncLang();
