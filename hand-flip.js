// ── HAND PAGE-TURN ──────────────────────────────────────────
// Turn the notebook's pages with your real hand, using MediaPipe
// Hand Landmarker on the webcam. Everything runs in the browser.
//
// Three layers, each usable on its own:
//   1. Pages   — the notebook's pages in reading order, and how to jump to one.
//   2. Flip    — the page-turn animation, driven by a single number p (0 → 1).
//   3. Gesture — turns hand landmarks into Flip calls (pinch-and-drag, or swipe).
// The camera code at the bottom only feeds landmarks into the Gesture layer.
//
// Relies on globals from index.html: openBook, switchSection, buildHistSlideshow,
// histSetPositions, currentEraIndex, ERA_KEYS, T, t.

const MEDIAPIPE_VERSION = '1.1.0';
const MEDIAPIPE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

Object.assign(T.en, {
  'hand.toggle': '✋ Turn pages by hand',
  'hand.stop': '✋ Stop hand mode',
  'hand.loading': 'Loading hand tracking…',
  'hand.camera': 'Allow camera access to begin.',
  'hand.ready': 'Pinch to grab the page, pull left to turn. Or swipe.',
  'hand.noHand': 'Show your hand to the camera.',
  'hand.grab': 'Holding the page…',
  'hand.end': 'No more pages this way.',
  'hand.denied': 'Camera access was blocked. Allow it in your browser to use hand mode.',
  'hand.error': 'Hand tracking could not start on this device.',
  'hand.privacy': 'Video stays on your device.',
  'hand.sayHi': '👋 Say hi to open',
  'hand.wave': 'Wave hello to open the notebook.',
  'hand.hello': 'Hello! Opening your notebook…',
  'hand.skip': 'Skip',
  'hand.openInstead': 'Open the notebook instead',
});
Object.assign(T.zh, {
  'hand.toggle': '✋ 用手翻页',
  'hand.stop': '✋ 关闭手势翻页',
  'hand.loading': '正在加载手势识别…',
  'hand.camera': '请允许使用摄像头。',
  'hand.ready': '捏住页面，向左拉即可翻页，也可以挥手。',
  'hand.noHand': '请把手放到摄像头前。',
  'hand.grab': '正在翻页…',
  'hand.end': '这个方向没有更多页面了。',
  'hand.denied': '摄像头被拒绝，请在浏览器中允许后再试。',
  'hand.error': '此设备无法启动手势识别。',
  'hand.privacy': '视频只在你的设备上处理。',
  'hand.sayHi': '👋 挥手打开',
  'hand.wave': '向镜头挥挥手，打开笔记本。',
  'hand.hello': '你好！正在为你打开笔记本…',
  'hand.skip': '跳过',
  'hand.openInstead': '直接打开笔记本',
});

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp01 = v => Math.min(1, Math.max(0, v));

// ── 1. PAGES ────────────────────────────────────────────────
// Reading order: cover → each history era → recipes → tips.

function isCoverOpen(){
  return !document.getElementById('cover').classList.contains('hidden');
}

function currentPage(){
  if(isCoverOpen()) return { kind:'cover' };
  const tab = document.querySelector('.tab-btn.active');
  const section = tab ? tab.dataset.section : 'history';
  if(section === 'history') return { kind:'history', era:currentEraIndex };
  return { kind:section };
}

function neighbourPage(page, dir){
  const lastEra = ERA_KEYS.length - 1;
  switch(page.kind){
    case 'cover':   return dir > 0 ? { kind:'history', era:0 } : null;
    case 'history':
      if(dir > 0) return page.era < lastEra ? { kind:'history', era:page.era + 1 } : { kind:'recipes' };
      return page.era > 0 ? { kind:'history', era:page.era - 1 } : { kind:'cover' };
    case 'recipes': return dir > 0 ? { kind:'tips' } : { kind:'history', era:lastEra };
    case 'tips':    return dir > 0 ? null : { kind:'recipes' };
  }
  return null;
}

// Jump straight to a page inside the book, with no animation of its own —
// the Flip layer swaps pages while the old one is edge-on and invisible.
function showPage(page){
  if(page.kind === 'history'){
    if(currentPage().kind !== 'history') switchSection('history');
    buildHistSlideshow();
    currentEraIndex = page.era;
    histSetPositions(page.era, false);
  } else {
    switchSection(page.kind);
  }
  window.scrollTo(0, 0);
}

// openBook() exists in index.html; this is its reverse.
function closeBook(){
  document.getElementById('cover').classList.remove('hidden');
  document.getElementById('book').classList.remove('visible');
}

// ── 2. FLIP ─────────────────────────────────────────────────
// begin(dir) → update(p) … → release(). Or turn(dir) for one full turn.
// dir: +1 = forward (next page), -1 = back.

const Flip = (() => {
  let active = null;      // the flip in progress
  let settling = false;   // animating to its end after release

  // Turning a page inside the book. The page folds toward the spine;
  // at p = 0.5 it is edge-on, so we swap in the neighbour page there and
  // unfold it the rest of the way. Dragging back below 0.5 swaps back.
  function pageFlip(dir, from, to){
    const el = document.getElementById('book-spread');
    const shade = document.createElement('div');
    shade.className = 'hf-shade';
    el.appendChild(shade);
    let swapped = false;

    el.style.transformOrigin = dir > 0 ? 'left center' : 'right center';
    el.style.willChange = 'transform';

    return {
      render(p){
        const wantSwap = p >= 0.5;
        if(wantSwap !== swapped){ showPage(wantSwap ? to : from); swapped = wantSwap; }
        if(reducedMotion()) return;
        // The free edge recedes into the screen (0 → 90°), then the new page
        // unfolds back out (90° → 0). Swinging toward the viewer instead makes
        // a full-width page balloon past the window.
        const depth = swapped ? (1 - p) * 2 : p * 2;   // 0 flat → 1 edge-on
        el.style.transform = `perspective(1800px) rotateY(${dir * depth * 90}deg)`;
        shade.style.opacity = String(depth * 0.85);
        shade.style.background = `linear-gradient(${dir > 0 ? 'to left' : 'to right'},
          rgba(20,12,5,.9) 0%, rgba(20,12,5,.35) 45%, rgba(255,240,215,.08) 100%)`;
      },
      finish(){
        el.style.transform = el.style.transformOrigin = el.style.willChange = '';
        shade.remove();
      },
    };
  }

  // Opening the cover (forward from the cover) or closing it (back from the
  // first page). `open` is how far the cover has swung open, 0 → 1.
  function coverFlip(dir){
    const cover = document.getElementById('cover');
    const bookObj = cover.querySelector('.book-object');
    const opening = dir > 0;

    // Lay out the starting state without the cover's own CSS transitions.
    cover.style.transition = 'none';
    bookObj.style.animation = 'none';
    bookObj.style.transformOrigin = 'left center';
    bookObj.style.backfaceVisibility = 'hidden';
    document.getElementById('book').classList.add('visible');
    if(opening){
      buildHistSlideshow();
      if(currentPage().kind !== 'history') showPage({ kind:'history', era:0 });
    } else {
      cover.classList.remove('hidden');
    }

    return {
      render(p){
        const open = opening ? p : 1 - p;
        if(!reducedMotion()) bookObj.style.transform = `perspective(1400px) rotateY(${-open * 170}deg)`;
        cover.style.opacity = String(1 - clamp01((open - 0.25) / 0.75));
        cover.style.pointerEvents = open > 0.5 ? 'none' : '';
      },
      finish(p){
        const endedOpen = opening ? p >= 0.5 : p < 0.5;
        if(endedOpen){
          cover.classList.add('hidden');
          document.getElementById('book').classList.add('visible');
        } else {
          closeBook();
        }
        // Let the inline transition:none take effect before clearing it,
        // so the cover doesn't replay its 1.2s fade.
        requestAnimationFrame(() => {
          cover.style.transition = cover.style.opacity = cover.style.pointerEvents = '';
          bookObj.style.animation = bookObj.style.transform = '';
          bookObj.style.transformOrigin = bookObj.style.backfaceVisibility = '';
        });
      },
    };
  }

  function blocked(){
    return settling || active ||
      document.getElementById('recipe-modal')?.classList.contains('open') ||
      document.getElementById('img-lightbox')?.classList.contains('open');
  }

  function begin(dir){
    if(blocked()) return false;
    const from = currentPage();
    const to = neighbourPage(from, dir);
    if(!to) return false;
    const kind = (from.kind === 'cover' || to.kind === 'cover') ? coverFlip(dir) : pageFlip(dir, from, to);
    active = { ...kind, p:0 };
    active.render(0);
    return true;
  }

  function update(p){
    if(!active || settling) return;
    active.p = clamp01(p);
    active.render(active.p);
  }

  // Finish the turn if it is past halfway, otherwise fall back.
  function release(){
    if(!active || settling) return;
    const flip = active;
    const target = flip.p >= 0.5 ? 1 : 0;
    const start = flip.p;
    const duration = reducedMotion() ? 0 : 140 + 380 * Math.abs(target - start);
    const t0 = performance.now();
    settling = true;
    const step = now => {
      const k = duration ? clamp01((now - t0) / duration) : 1;
      const eased = 1 - Math.pow(1 - k, 3);
      flip.p = start + (target - start) * eased;
      flip.render(flip.p);
      if(k < 1){ requestAnimationFrame(step); return; }
      flip.finish(flip.p);
      active = null;
      settling = false;
    };
    requestAnimationFrame(step);
  }

  function turn(dir){
    if(!begin(dir)) return false;
    active.p = 0.5;   // release() completes from halfway: a quick, full turn
    active.render(0.5);
    release();
    return true;
  }

  return { begin, update, release, turn, isBusy: () => !!active || settling };
})();

// ── 3. GESTURE ──────────────────────────────────────────────
// Feed it one hand's 21 landmarks per video frame (or null for no hand).
// Landmark indices: 0 wrist, 4 thumb tip, 8 index tip, 9 middle knuckle.

const PINCH_ON = 0.38;      // pinch gap / hand size to start grabbing
const PINCH_OFF = 0.62;     // …and to let go (wide gap so a loosening pinch mid-turn holds)
const LOST_GRACE_MS = 350;  // hand can vanish this long (motion blur) without dropping the page
const DRAG_START = 0.035;   // movement (fraction of frame width) before a drag picks a direction
const DRAG_FULL = 0.30;     // movement for a complete turn
const SWIPE_DIST = 0.22;    // open-hand sweep that counts as a swipe…
const SWIPE_MS = 320;       // …within this long
const COOLDOWN_MS = 900;    // wait after a swipe before another
const WAVE_SWING = 0.035;   // palm travel that counts as one swing of a wave
const WAVE_MS = 1500;       // two direction changes within this long = a wave

// mode 'turn' turns pages; 'wave' only listens for a hello wave; 'idle' ignores the hand.
function createGesture({ flip, onState, onWave = () => {}, aspect = 4 / 3 }){
  let mode = 'turn';
  let pinched = false;
  let anchorX = 0, smoothX = null, dir = 0, refused = false;
  let trail = [];             // recent open-hand positions for swipe detection
  let lastSwipe = -Infinity;
  let waveDir = 0, waveEdge = null, reversals = [];   // wave: current heading, furthest point, turn times
  let lastSeen = -Infinity;
  let debug = { hand:false, gap:null, state:'' };

  // 3D distance in frame-height units. x and z are scaled by frame width,
  // y by height. Using depth too keeps the hand's measured size steady
  // when it tilts — in 2D a turned hand looks smaller and a pinch looks open.
  const dist = (a, b) => Math.hypot((a.x - b.x) * aspect, a.y - b.y, ((a.z || 0) - (b.z || 0)) * aspect);

  function letGo(){
    if(pinched && dir) flip.release();
    pinched = false; dir = 0; refused = false; smoothX = null;
  }

  function resetWave(){ waveDir = 0; waveEdge = null; reversals = []; }

  // A wave is an open palm swinging side to side: count the moments it
  // changes direction after travelling at least WAVE_SWING.
  function trackWave(palmX, now){
    if(waveEdge === null){ waveEdge = palmX; return false; }
    const moved = palmX - waveEdge;
    if(waveDir === 0){
      if(Math.abs(moved) > WAVE_SWING){ waveDir = Math.sign(moved); waveEdge = palmX; }
    } else if(Math.sign(moved) === waveDir){
      waveEdge = palmX;                                   // still heading the same way
    } else if(Math.abs(moved) > WAVE_SWING){
      waveDir = -waveDir; waveEdge = palmX;               // turned around
      reversals = reversals.filter(t => now - t <= WAVE_MS).concat(now);
      if(reversals.length >= 2){ resetWave(); return true; }
    }
    return false;
  }

  function feed(landmarks, now = performance.now()){
    if(!landmarks){
      debug = { hand:false, gap:null, state: pinched ? 'lost (holding)' : 'no hand' };
      // A fast-moving hand often drops out for a frame or two: keep hold of the page briefly.
      if(pinched && now - lastSeen < LOST_GRACE_MS) return;
      letGo(); trail = []; resetWave();
      if(mode !== 'idle') onState(mode === 'wave' ? 'wave' : 'noHand');
      return;
    }
    lastSeen = now;
    if(mode === 'idle'){ debug = { hand:true, gap:null, state:'waiting' }; return; }
    if(mode === 'wave'){
      debug = { hand:true, gap:null, state:`wave ${reversals.length}/2` };
      if(trackWave(1 - landmarks[9].x, now)){ mode = 'idle'; onWave(); }
      else onState('wave');
      return { pinched:false };
    }
    const size = dist(landmarks[0], landmarks[9]) || 1e-6;
    const gap = dist(landmarks[4], landmarks[8]) / size;
    // Mirror x so moving your hand left moves left on screen.
    const rawX = 1 - (landmarks[4].x + landmarks[8].x) / 2;
    smoothX = smoothX === null ? rawX : smoothX * 0.45 + rawX * 0.55;

    if(!pinched && gap < PINCH_ON && !flip.isBusy()){
      pinched = true; anchorX = smoothX; dir = 0; refused = false; trail = [];
    } else if(pinched && gap > PINCH_OFF){
      letGo();
    }

    if(pinched){
      const dx = smoothX - anchorX;
      if(!dir && !refused && Math.abs(dx) > DRAG_START){
        const want = dx < 0 ? 1 : -1;       // pull left = next page
        if(flip.begin(want)) dir = want; else refused = true;
      }
      const p = dir ? (dir > 0 ? -dx : dx) / DRAG_FULL : 0;
      if(dir) flip.update(p);
      debug = { hand:true, gap, state: refused ? 'pinched · no page that way'
        : dir ? `turning ${dir > 0 ? 'forward' : 'back'} ${Math.round(Math.min(1, Math.max(0, p)) * 100)}%` : 'pinched · move sideways' };
      onState(refused ? 'end' : 'grab');
      return { pinched, gap };
    }

    // Open hand: look for a quick horizontal sweep of the palm.
    const palmX = 1 - landmarks[9].x;
    trail.push({ x:palmX, t:now });
    trail = trail.filter(s => now - s.t <= SWIPE_MS);
    const sweep = palmX - trail[0].x;
    debug = { hand:true, gap, state:'open hand' };
    if(Math.abs(sweep) > SWIPE_DIST && now - lastSwipe > COOLDOWN_MS && !flip.isBusy()){
      lastSwipe = now; trail = [];
      onState(flip.turn(sweep < 0 ? 1 : -1) ? 'ready' : 'end');
    } else {
      onState('ready');
    }
    return { pinched, gap };
  }

  return {
    feed,
    reset(){ letGo(); trail = []; resetWave(); },
    setMode(m){ mode = m; resetWave(); },
    get mode(){ return mode; },
    get debug(){ return debug; },
  };
}

// ── CAMERA + UI ─────────────────────────────────────────────

function buildUI(){
  const btn = document.createElement('button');
  btn.className = 'hf-toggle';
  btn.type = 'button';
  btn.setAttribute('aria-pressed', 'false');
  btn.dataset.i18n = 'hand.toggle';
  btn.textContent = t('hand.toggle');

  const sayHi = document.createElement('button');
  sayHi.className = 'hf-sayhi';
  sayHi.type = 'button';
  sayHi.dataset.i18n = 'hand.sayHi';
  sayHi.textContent = t('hand.sayHi');
  document.getElementById('cover').appendChild(sayHi);

  const backdrop = document.createElement('div');
  backdrop.className = 'hf-backdrop';

  const panel = document.createElement('div');
  panel.className = 'hf-panel';
  panel.innerHTML = `
    <div class="hf-stage">
      <video playsinline muted></video>
      <canvas></canvas>
    </div>
    <p class="hf-status" role="status" aria-live="polite"></p>
    <p class="hf-privacy" data-i18n="hand.privacy">${t('hand.privacy')}</p>
    <p class="hf-debug" hidden></p>
    <button class="hf-skip" type="button" data-i18n="hand.skip">${t('hand.skip')}</button>`;

  document.body.append(backdrop, panel, btn);
  return {
    btn, sayHi, backdrop, panel,
    video: panel.querySelector('video'),
    canvas: panel.querySelector('canvas'),
    status: panel.querySelector('.hf-status'),
    skip: panel.querySelector('.hf-skip'),
    debug: panel.querySelector('.hf-debug'),
  };
}

function setI18n(el, key){
  el.dataset.i18n = key;
  el.textContent = t(key);
}

function drawHand(canvas, landmarks, pinched){
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.clientWidth * devicePixelRatio;
  const h = canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.clearRect(0, 0, w, h);
  if(!landmarks) return;
  ctx.fillStyle = 'rgba(240,225,195,.7)';
  for(const p of landmarks){
    ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 2 * devicePixelRatio, 0, Math.PI * 2); ctx.fill();
  }
  const [a, b] = [landmarks[4], landmarks[8]];
  ctx.strokeStyle = pinched ? '#E2B84A' : 'rgba(240,225,195,.45)';
  ctx.lineWidth = (pinched ? 3 : 1.5) * devicePixelRatio;
  ctx.beginPath(); ctx.moveTo(a.x * w, a.y * h); ctx.lineTo(b.x * w, b.y * h); ctx.stroke();
}

const ui = buildUI();
// Add ?debug to the address to see what the tracker sees, live.
const DEBUG = new URLSearchParams(location.search).has('debug');
ui.debug.hidden = !DEBUG;
let handLandmarker = null;
let stream = null;
let running = false;
let lastVideoTime = -1;
let introTimer = null;
let holdStatus = false;   // keep the "Hello!" message up while the intro plays out

const gesture = createGesture({
  flip: Flip,
  onState: key => {
    if(holdStatus) return;
    const k = 'hand.' + key;
    if(ui.status.dataset.i18n !== k) setI18n(ui.status, k);
  },
  onWave: () => greeted(),
});

async function loadLandmarker(){
  const { FilesetResolver, HandLandmarker } = await import(`${MEDIAPIPE_URL}/vision_bundle.mjs`);
  const fileset = await FilesetResolver.forVisionTasks(`${MEDIAPIPE_URL}/wasm`);
  const options = delegate => ({
    baseOptions:{ modelAssetPath:MODEL_URL, delegate },
    runningMode:'VIDEO',
    numHands:1,
  });
  try {
    return await HandLandmarker.createFromOptions(fileset, options('GPU'));
  } catch(err){
    return HandLandmarker.createFromOptions(fileset, options('CPU'));
  }
}

function loop(){
  if(!running) return;
  const v = ui.video;
  if(v.readyState >= 2 && v.currentTime !== lastVideoTime){
    lastVideoTime = v.currentTime;
    const result = handLandmarker.detectForVideo(v, performance.now());
    const hand = result.landmarks && result.landmarks[0] || null;
    const info = gesture.feed(hand);
    drawHand(ui.canvas, hand, info && info.pinched);
    if(DEBUG){
      const d = gesture.debug;
      ui.debug.textContent = `hand ${d.hand ? '✓' : '✗'} · pinch ${d.gap == null ? '–' : d.gap.toFixed(2)}`
        + ` (grab < ${PINCH_ON}, let go > ${PINCH_OFF}) · ${d.state}`;
    }
  }
  requestAnimationFrame(loop);
}

// Starts the camera and tracking. Resolves true once frames are flowing.
async function start(){
  ui.panel.classList.add('open');
  ui.btn.setAttribute('aria-pressed', 'true');
  setI18n(ui.btn, 'hand.stop');
  try {
    setI18n(ui.status, 'hand.loading');
    handLandmarker = handLandmarker || await loadLandmarker();
    setI18n(ui.status, 'hand.camera');
    stream = await navigator.mediaDevices.getUserMedia({
      video:{ facingMode:'user', width:{ ideal:640 }, height:{ ideal:480 } },
      audio:false,
    });
    if(ui.btn.getAttribute('aria-pressed') !== 'true'){ stopCamera(); return false; }  // turned off while loading
    ui.video.srcObject = stream;
    await ui.video.play();
    setI18n(ui.status, gesture.mode === 'wave' ? 'hand.wave' : 'hand.noHand');
    running = true;
    requestAnimationFrame(loop);
    return true;
  } catch(err){
    console.warn('[hand-flip]', err);
    const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
    setI18n(ui.status, denied ? 'hand.denied' : 'hand.error');
    setI18n(ui.skip, 'hand.openInstead');
    stopCamera();
    ui.btn.setAttribute('aria-pressed', 'false');
    setI18n(ui.btn, 'hand.toggle');
    return false;
  }
}

function stopCamera(){
  running = false;
  gesture.reset();
  if(stream) stream.getTracks().forEach(tr => tr.stop());
  stream = null;
  ui.video.srcObject = null;
  drawHand(ui.canvas, null);
}

function stop(){
  endIntro();
  stopCamera();
  gesture.setMode('turn');
  ui.panel.classList.remove('open');
  ui.btn.setAttribute('aria-pressed', 'false');
  setI18n(ui.btn, 'hand.toggle');
}

// ── WELCOME INTRO ───────────────────────────────────────────
// "Say hi" on the cover → big mirror → wave → the mirror shrinks into the
// corner → the cover rests for 1 s → it opens onto the first history page.

const COVER_PAUSE_MS = 1000;

function startIntro(){
  setI18n(ui.skip, 'hand.skip');
  gesture.setMode('wave');
  document.body.classList.add('hf-intro');
  ui.panel.classList.add('hero');
  ui.backdrop.classList.add('open');
  start();   // on failure the hero stays up showing why, with Skip to carry on
}

// Leave the big-mirror state. No-op if we're not in it.
function endIntro(){
  clearTimeout(introTimer);
  holdStatus = false;
  ui.backdrop.classList.remove('open');
  document.body.classList.remove('hf-intro');
  ui.panel.classList.remove('hero', 'greeted');
}

function greeted(){
  setI18n(ui.status, 'hand.hello');
  holdStatus = true;
  ui.panel.classList.add('greeted');
  introTimer = setTimeout(() => {
    shrinkToCorner();
    introTimer = setTimeout(() => {
      holdStatus = false;
      if(isCoverOpen()) Flip.turn(1);
      // Page-turning starts once the book is open, so a lingering wave
      // during the intro isn't read as a swipe.
      gesture.setMode('turn');
    }, COVER_PAUSE_MS + 900);   // 900ms = the shrink itself
  }, 700);
}

// FLIP technique: measure the big mirror, snap it to its corner size,
// then animate from the old box to the new one with a single transform.
function shrinkToCorner(){
  const panel = ui.panel;
  const first = panel.getBoundingClientRect();
  ui.backdrop.classList.remove('open');
  document.body.classList.remove('hf-intro');
  panel.classList.remove('hero', 'greeted');
  if(reducedMotion()) return;
  const last = panel.getBoundingClientRect();
  panel.style.transformOrigin = 'top left';
  panel.style.transform =
    `translate(${first.left - last.left}px, ${first.top - last.top}px) scale(${first.width / last.width})`;
  panel.getBoundingClientRect();   // commit the starting frame
  panel.style.transition = 'transform .9s cubic-bezier(.65,0,.25,1)';
  panel.style.transform = '';
  panel.addEventListener('transitionend', () => {
    panel.style.transition = panel.style.transformOrigin = '';
  }, { once:true });
}

ui.sayHi.addEventListener('click', startIntro);

// Skip: put the camera away and open the notebook the ordinary way.
ui.skip.addEventListener('click', () => { stop(); openBook(); });

document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && ui.panel.classList.contains('hero')) stop();
});

ui.btn.addEventListener('click', () => {
  ui.btn.getAttribute('aria-pressed') === 'true' ? stop() : start();
});

// Exposed for testing and for other controls (e.g. keyboard) to reuse.
window.handFlip = { Flip, createGesture, gesture };
