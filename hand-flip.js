// ── HAND PAGE-TURN ──────────────────────────────────────────
// Turn the notebook's pages with your real hand, using MediaPipe
// Gesture Recognizer on the webcam (Hand Landmarker if that can't load).
// Everything runs in the browser.
//
// Layers, each usable on its own:
//   1. Pages   — the notebook's sections in reading order, and how to jump to one.
//   2. Flip    — a flat page-turn between sections, driven by one number p (0 → 1).
//   3. Surface — routes a turn to the history book (history-book.js), where the
//                hand drags a real curling page, or to Flip everywhere else.
//   4. Gesture — turns hand landmarks into a sweep (or a hello wave).
//   5. Pointer — on the Recipes shelf and its recipe card: point to choose a
//                cake, pinch to open it, pinch and drag to scroll the card,
//                hold an open palm to close it, hold 👍 / make a 🫶 heart to mark it.
// The camera code at the bottom feeds each frame to Pointer, then Gesture.
//
// Relies on globals from index.html: openBook, switchSection, buildHistSlideshow,
// histSetPositions, currentEraIndex, ERA_KEYS, T, t — and window.historyBook
// when the book loaded (without it, history falls back to the old slideshow).

const MEDIAPIPE_VERSION = '1.1.0';
const MEDIAPIPE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const GESTURE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

Object.assign(T.en, {
  'hand.toggle': 'Turn pages by hand',
  'hand.stop': 'Stop hand mode',
  'hand.loading': 'Loading hand tracking…',
  'hand.camera': 'Allow camera access to begin.',
  'hand.ready': "👋 Sweep left — next page\n👋 Lower your hand, then sweep right — back",
  'hand.noHand': "✋ Show your hand to the camera",
  'hand.cover': "👋 Sweep left to open the notebook",
  'hand.grab': 'Turning the page…',
  'hand.end': 'No more pages this way.',
  'hand.denied': 'Camera access was blocked. Allow it in your browser to use hand mode.',
  'hand.error': 'Hand tracking could not start on this device.',
  'hand.privacy': 'Video stays on your device.',
  'hand.sayHi': '👋 Say hi to open',
  'hand.wave': "👋👋 Raise both hands and wave hello",
  'hand.hello': "👋 Hello! Here's your notebook",
  'hand.skip': 'Skip',
  'hand.openInstead': 'Open the notebook instead',
  'hand.shelf': "☝️ Point at a cake\n🤏 Pinch to take it out\n✋ Sweep a flat palm — next chapter",
  'hand.pointing': "🤏 Pinch to take it out",
  'hand.pulling': "🤏 Keep pinching — taking it out…",
  'hand.card': "🤏 Pinch and drag — scroll\n👍 Hold — baked it\n🫶 Hold — want to bake\n✋ Hold — close",
  'hand.hold.close': "✋ Keep holding to close…",
  'hand.hold.made': "👍 Keep holding…",
  'hand.hold.wish': "🫶 Keep holding…",
  'hand.marked.made': "👍 Baked it!",
  'hand.unmarked.made': "Baked mark removed",
  'hand.marked.wish': "🫶 Want to bake!",
  'hand.unmarked.wish': "Removed from want to bake",
});
Object.assign(T.zh, {
  'hand.toggle': '用手翻页',
  'hand.stop': '关闭手势翻页',
  'hand.loading': '正在加载手势识别…',
  'hand.camera': '请允许使用摄像头。',
  'hand.ready': "👋 向左划 — 下一页\n👋 先放下手，再向右划 — 上一页",
  'hand.noHand': "✋ 请把手放到摄像头前",
  'hand.cover': "👋 向左划，打开笔记本",
  'hand.grab': '正在翻页…',
  'hand.end': '这个方向没有更多页面了。',
  'hand.denied': '摄像头被拒绝，请在浏览器中允许后再试。',
  'hand.error': '此设备无法启动手势识别。',
  'hand.privacy': '视频只在你的设备上处理。',
  'hand.sayHi': '👋 挥手打开',
  'hand.wave': "👋👋 举起双手，挥手打个招呼",
  'hand.hello': "👋 你好！这是你的笔记本",
  'hand.skip': '跳过',
  'hand.openInstead': '直接打开笔记本',
  'hand.shelf': "☝️ 用食指指向一块蛋糕\n🤏 捏一下，把它取出来\n✋ 张开手掌划动 — 换章节",
  'hand.pointing': "🤏 捏一下，把它取出来",
  'hand.pulling': "🤏 继续捏住 — 正在取出…",
  'hand.card': "🤏 捏住拖动 — 滚动\n👍 保持 — 做过了\n🫶 保持 — 想做\n✋ 保持 — 关闭",
  'hand.hold.close': "✋ 保持住，即将关闭…",
  'hand.hold.made': "👍 保持住…",
  'hand.hold.wish': "🫶 保持住…",
  'hand.marked.made': "👍 做过了！",
  'hand.unmarked.made': "已取消“做过”",
  'hand.marked.wish': "🫶 想做！",
  'hand.unmarked.wish': "已从想做中移除",
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
  // With the book loaded, the cover and the eras turn inside the book;
  // Flip only moves between the book and the other sections.
  if(window.historyBook){
    if(page.kind === 'cover') return null;
    if(page.kind === 'history') return dir > 0 ? { kind:'recipes' } : null;
  }
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
    if(window.historyBook){ window.scrollTo(0, 0); return; }
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
    // History lives in the book's own stage when the book loaded.
    const elFor = page => window.historyBook && page.kind === 'history'
      ? window.historyBook.stage : document.getElementById('book-spread');
    const shade = document.createElement('div');
    shade.className = 'hf-shade';
    let el = null;
    let swapped = false;
    const target = page => {
      if(el){ el.style.transform = el.style.transformOrigin = el.style.willChange = ''; }
      el = elFor(page);
      el.appendChild(shade);
      el.style.transformOrigin = dir > 0 ? 'left center' : 'right center';
      el.style.willChange = 'transform';
    };
    target(from);

    return {
      render(p){
        const wantSwap = p >= 0.5;
        if(wantSwap !== swapped){ showPage(wantSwap ? to : from); swapped = wantSwap; target(swapped ? to : from); }
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
    // Between sections, a sweep slides to the next one like the tabs do (section-transition.js).
    if(from.kind !== 'cover' && to.kind !== 'cover' && document.startViewTransition && !reducedMotion()){
      showPage(to);
      return 'slid';
    }
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

// ── 3. SURFACE ──────────────────────────────────────────────
// One interface for "a page is being turned by hand": begin(dir, v),
// move(p, v) with p = how far the hand has swept (0 → 1 is a full turn),
// end(). The history book gets a real curling page under the hand; other
// sections get the flat Flip.

const Surface = (() => {
  let on = null;   // 'book' | 'flip' | null
  let dir = 0;

  function begin(d, v){
    const hb = window.historyBook;
    if(hb && hb.visible){
      if(hb.canTurn(d)){
        const r = hb.drag.begin(d, v);
        if(!r) return false;
        on = r === true ? 'book' : null;   // 'played': a phone-sized book just turns
        dir = d;
        return true;
      }
      if(d < 0 || hb.isClosed()) return false;
      // Past the last history spread: carry on into Recipes.
    }
    const r = Flip.begin(d);
    if(!r) return false;
    on = r === 'slid' ? null : 'flip';   // a slide plays on its own; nothing to drag
    dir = d;
    return true;
  }

  function move(p, v){
    if(on === 'book'){
      // The corner starts at the outer edge and travels across both pages;
      // past the spine (u = 0.5) the library will finish the turn.
      const u = dir > 0 ? 0.97 - p * 0.94 : 0.03 + p * 0.94;
      window.historyBook.drag.move(u, v);
    } else if(on === 'flip'){
      Flip.update(p);
    }
  }

  function end(){
    if(on === 'book') window.historyBook.drag.end();
    else if(on === 'flip') Flip.release();
    on = null;
  }

  const busy = () => Flip.isBusy() || !!(window.historyBook && window.historyBook.busy);
  return { begin, move, end, busy };
})();


// ── 4. GESTURE ──────────────────────────────────────────────
// Feed it one hand's 21 landmarks per video frame (or null for no hand).
// Landmark indices: 8 index fingertip, 9 middle knuckle (palm centre).
//
// Turning is an open-hand sweep, like brushing a page over: the index
// fingertip moving quickly sideways starts a turn, the page then follows
// the hand, and the turn ends when the hand stops, leaves the frame, or
// has swept all the way across.
//
// After a turn the hand has to travel back across the frame, and that
// return stroke looks exactly like a sweep the other way. So the opposite
// direction stays locked until the hand leaves the frame: to go back a
// page, lower your hand, then sweep right. Forward sweeps start on the
// right half of the frame, back sweeps on the left, and a back sweep has
// to be brisk — raising a hand and drifting into position shouldn't turn
// anything.

const LOST_GRACE_MS = 350;   // hand can vanish this long (motion blur) without dropping the page
const SWEEP_START = 0.045;   // fingertip travel (fraction of frame width)…
const SWEEP_WINDOW = 200;    // …within this many ms that starts a turn
const BACK_SWEEP = 1.5;      // going back needs a quicker sweep, so drifting into position doesn't count
const SETTLE_MS = 250;       // a hand that just came into view must settle before it can turn
const SWEEP_FULL = 0.34;     // fingertip travel for a complete turn
const STILL_MS = 380;        // hand resting this long ends the turn where it is
const STILL_EPS = 0.012;     // movement smaller than this counts as resting
const WAVE_SWING = 0.035;    // palm travel that counts as one swing of a wave
const WAVE_MS = 1500;        // two direction changes within this long = a wave

// mode 'turn' turns pages; 'wave' only listens for a hello wave; 'idle' ignores the hand.
function createGesture({ surface, onState, onWave = () => {} }){
  let mode = 'turn';
  let smoothX = null, smoothY = null;
  let trail = [];               // recent fingertip positions {x, t}
  let dir = 0, anchorX = 0, lastMoveX = 0, lastMoveT = 0;
  let lockedDir = 0;            // direction refused until the hand leaves the frame
  let blockedUntil = -Infinity;
  let lastSeen = -Infinity;
  let appearedAt = -Infinity;
  let waves = [];                // wave: one swing tracker per hand, left to right
  let twoSeenAt = -Infinity;     // when two hands were last in view
  let debug = { hand:false, state:'' };

  const pageY = y => Math.min(0.95, Math.max(0.05, (y - 0.15) / 0.7));

  function finish(now){
    if(!dir) return;
    surface.end();
    lockedDir = -dir;
    dir = 0; trail = [];
  }

  const newWave = () => ({ dir:0, edge:null, turns:[] });
  function resetWave(){ waves = [newWave(), newWave()]; }
  resetWave();

  // A wave is an open palm swinging side to side: count the moments it
  // changes direction after travelling at least WAVE_SWING. Returns how
  // many turns this hand made within WAVE_MS.
  function trackWave(w, palmX, now){
    w.turns = w.turns.filter(t => now - t <= WAVE_MS);
    if(w.edge === null){ w.edge = palmX; return w.turns.length; }
    const moved = palmX - w.edge;
    if(w.dir === 0){
      if(Math.abs(moved) > WAVE_SWING){ w.dir = Math.sign(moved); w.edge = palmX; }
    } else if(Math.sign(moved) === w.dir){
      w.edge = palmX;                                     // still heading the same way
    } else if(Math.abs(moved) > WAVE_SWING){
      w.dir = -w.dir; w.edge = palmX;                     // turned around
      w.turns.push(now);
    }
    return w.turns.length;
  }

  // The hello is both hands waving: each turns at least once, three turns
  // between them. Someone showing only one hand can still wave it (two turns).
  function trackWaves(hands, now){
    const palms = hands.map(h => 1 - h[9].x).sort((a, b) => a - b).slice(0, 2);
    if(palms.length === 2) twoSeenAt = now;
    // each hand keeps its own tracker: by order when both are seen, by side of the picture when one is
    const slots = palms.length === 2 ? [0, 1] : [palms[0] < 0.5 ? 0 : 1];
    const turns = [0, 0];
    slots.forEach((slot, i) => { turns[slot] = trackWave(waves[slot], palms[i], now); });
    const both = now - twoSeenAt < 1000;
    if(both) return turns[0] >= 1 && turns[1] >= 1 && turns[0] + turns[1] >= 3;
    return turns[slots[0]] >= 2;
  }

  // canStart false: keep watching the hand, but don't start a new turn
  // (the Pointer layer is using the hand to point or pinch).
  // strict: the sweep would leave the section at once, with no page to hold
  // and let fall back, so it has to travel twice as far.
  function feed(landmarks, now = performance.now(), canStart = true, strict = false, hands = landmarks ? [landmarks] : []){
    if(!landmarks){
      // A fast-moving hand often drops out for a frame or two: until it has
      // been gone a moment, change nothing (keep the page, keep the lock).
      if(now - lastSeen < LOST_GRACE_MS){ debug = { hand:false, state:'lost (waiting)' }; return; }
      debug = { hand:false, state:'no hand' };
      finish(now); smoothX = smoothY = null; trail = []; resetWave();
      lockedDir = 0;                                    // hand left the frame: both ways open again
      if(mode !== 'idle') onState(mode === 'wave' ? 'wave' : 'noHand');
      return;
    }
    if(now - lastSeen >= LOST_GRACE_MS) appearedAt = now;   // back in view after being gone
    lastSeen = now;
    if(mode === 'idle'){ debug = { hand:true, state:'waiting' }; return; }
    if(mode === 'wave'){
      const done = trackWaves(hands.length ? hands : [landmarks], now);
      debug = { hand:true, state:`wave ${waves[0].turns.length}+${waves[1].turns.length} (${hands.length} hand${hands.length === 1 ? '' : 's'})` };
      if(done){ resetWave(); mode = 'idle'; onWave(); }
      else onState('wave');
      return { active:false };
    }

    // Mirror x so moving your hand left moves left on screen.
    const tip = landmarks[8];
    const x = 1 - tip.x;
    smoothX = smoothX === null ? x : smoothX * 0.4 + x * 0.6;
    smoothY = smoothY === null ? tip.y : smoothY * 0.4 + tip.y * 0.6;

    if(dir){
      const p = (dir > 0 ? anchorX - smoothX : smoothX - anchorX) / SWEEP_FULL;
      surface.move(Math.max(0, p), pageY(smoothY));
      if(Math.abs(smoothX - lastMoveX) > STILL_EPS){ lastMoveX = smoothX; lastMoveT = now; }
      debug = { hand:true, state:`turning ${dir > 0 ? 'forward' : 'back'} ${Math.round(Math.min(1, Math.max(0, p)) * 100)}%` };
      if(p >= 1.1 || now - lastMoveT > STILL_MS) finish(now);
      onState('grab');
      return { active:true };
    }

    trail.push({ x:smoothX, t:now });
    trail = trail.filter(s => now - s.t <= SWEEP_WINDOW);
    const dx = smoothX - trail[0].x;
    debug = { hand:true, state:'open hand · ready' };
    const want = dx < 0 ? 1 : -1;                       // sweep left = next page
    const needed = (want > 0 ? SWEEP_START : SWEEP_START * BACK_SWEEP) * (strict ? 2 : 1);
    if(canStart && Math.abs(dx) > needed && now >= blockedUntil && now - appearedAt >= SETTLE_MS && !surface.busy()){
      const startX = trail[0].x;
      const inZone = want > 0 ? startX > 0.5 : startX < 0.4;
      if(inZone && want !== lockedDir){
        if(surface.begin(want, pageY(smoothY))){
          dir = want; anchorX = startX; lastMoveX = smoothX; lastMoveT = now;
          surface.move(Math.max(0, (want > 0 ? anchorX - smoothX : smoothX - anchorX) / SWEEP_FULL), pageY(smoothY));
          onState('grab');
          return { active:true };
        }
        blockedUntil = now + 700;                       // no page that way: don't retry every frame
        trail = [];
        onState('end');
        return { active:false };
      }
    }
    onState('ready');
    return { active:false };
  }

  return {
    feed,
    reset(){ finish(performance.now()); smoothX = smoothY = null; trail = []; resetWave(); lockedDir = 0; },
    setMode(m){ mode = m; resetWave(); },
    get mode(){ return mode; },
    get debug(){ return debug; },
  };
}

// ── 5. POINTER ──────────────────────────────────────────────
// The Recipes shelf and its recipe card, by hand.
//   On the shelf: point with the index finger (other fingers curled) and a
//   cursor follows the fingertip; the cake under it lifts. Pinch (thumb tip
//   to index tip) to open that cake's recipe.
//   On the card: pinch and drag up or down to scroll it. Hold an open palm
//   to close it, hold 👍 to mark it baked, make a heart with both hands 🫶
//   to add it to want-to-bake (the tracker follows two hands while a card is open).
// While the hand points or pinches, sweeps are held back so choosing a cake
// can't turn the chapter. `env` connects it to the page (see the camera code).
//
// feed(landmarks, pose, now) → { claimed, status, progress }
//   pose: the Gesture Recognizer's label ('Open_Palm', 'Thumb_Up',
//   'ILoveYou', …) or null when only Hand Landmarker is available.

const PINCH_ON = 0.25;      // thumb–index gap (in palm lengths) that counts as a pinch…
const PINCH_OFF = 0.38;     // …and that lets it go (the gap between avoids flicker).
                            // A fist's thumb rests about 0.4–0.5 from the index tip.
const HOLD_MS = 700;        // how long a pose must be held to act
const AFTER_CLOSE_MS = 1900; // after closing a card (1.7 s back to the shelf), the open palm mustn't sweep the page
const AFTER_POINT_MS = 1200;// after pointing at the shelf, no sweeps either
const PULL_MS = 1500;       // how long a pinch is held to pull a cake off the shelf
const PULL_GRACE_MS = 300;  // a pinch lost for less than this (tracking flicker) isn't letting go
const PINCH_BACK_MS = 250;  // closing the fingers moves the fingertip: a pinch counts where it pointed this long before
const SCROLL_GAIN = 2.2;    // card scroll per unit of hand travel, in card heights

const dist2d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Which fingers are straight, and how far apart thumb and index tips are.
// A finger is straight when its tip is clearly farther from the wrist than its middle joint.
function handShape(lm){
  const wrist = lm[0];
  const palm = dist2d(lm[0], lm[9]) || 1e-6;
  const straight = (tip, pip) => dist2d(lm[tip], wrist) > dist2d(lm[pip], wrist) * 1.12;
  const index = straight(8, 6), middle = straight(12, 10), ring = straight(16, 14), pinky = straight(20, 18);
  return {
    pinchGap: dist2d(lm[4], lm[8]) / palm,
    pointing: index && !middle && !ring && !pinky,
    open: index && middle && ring && pinky,
  };
}

// Two hands making a heart 🫶: thumb tips touching at the bottom, index
// fingertips touching above them, the hands apart (it isn't one hand seen twice).
function isHeart(a, b){
  const palm = (dist2d(a[0], a[9]) + dist2d(b[0], b[9])) / 2 || 1e-6;
  const thumbs = dist2d(a[4], b[4]) / palm;
  const tips = dist2d(a[8], b[8]) / palm;
  const rise = ((a[4].y + b[4].y) - (a[8].y + b[8].y)) / 2 / palm;   // image y grows downward
  const apart = dist2d(a[0], b[0]) / palm;
  return thumbs < 0.7 && tips < 0.7 && rise > 0.45 && apart > 0.9;
}

// The "1€ filter" (Casiez et al.): smooths hard while the hand is nearly
// still, so a tremor doesn't move the mitt, and less the faster it moves, so
// a deliberate move isn't laggy. One per axis; values 0–1, time in ms.
function oneEuro(minCutoff = 0.8, beta = 4, dCutoff = 1){
  let x = null, dx = 0, t = 0;
  const alpha = (cutoff, dt) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
  return (value, now) => {
    if(x === null){ x = value; t = now; return x; }
    const dt = Math.max(1e-3, (now - t) / 1000); t = now;
    const a = alpha(dCutoff, dt);
    dx = dx + a * ((value - x) / dt - dx);
    x = x + alpha(minCutoff + beta * Math.abs(dx), dt) * (value - x);
    return x;
  };
}

function createPointer(env){
  let pinching = false;
  let lastPinchY = null;
  let cursor = null;          // smoothed fingertip, 0–1 across the window
  let hold = { kind:null, since:0, fired:false };
  let quietUntil = -Infinity; // no sweeps until then (just closed a card)

  let pulling = null;         // { id, since, lostAt }: a cake being pulled off the shelf
  let aimed = null;           // { id, at }: the cake last pointed at
  let smooth = null;          // the mitt's 1€ filters, { u, v }
  // An open palm closes the card only once it's shown on purpose: the hand
  // that just pinched (to take the cake out, or to scroll) relaxes open by
  // itself, so a palm counts only after the hand has been out of view or in
  // another shape for a moment.
  let closeArmed = false;
  let goneSince = null, otherSince = null;
  const ARM_MS = 250;
  let trail = [];             // where the mitt was lately, [{ u, v, at }]

  function stopPulling(){ if(pulling){ env.pull(pulling.id, null); pulling = null; } }

  function release(){
    stopPulling();
    aimed = null;
    pinching = false; lastPinchY = null; cursor = null; smooth = null; trail = [];
    hold = { kind:null, since:0, fired:false };
    env.point(null);
    env.cursor(null);
  }

  // hands: every hand in view (two only while a card is open)
  function feed(lm, pose, now = performance.now(), hands = lm ? [lm] : []){
    if(!lm){
      if(goneSince === null) goneSince = now;
      if(now - goneSince >= ARM_MS) closeArmed = true;
      release();
      return { claimed: now < quietUntil, status:null };
    }
    goneSince = null;
    const shape = handShape(lm);
    const heart = hands.length >= 2 && isHeart(hands[0], hands[1]);
    const wasPinching = pinching;
    pinching = pinching ? shape.pinchGap < PINCH_OFF : shape.pinchGap < PINCH_ON;
    // A pinch has no name of its own: a named pose (👍, 🤟, fist, open palm…) means it isn't one.
    // But once a cake is pinched on the shelf, the recognizer briefly naming
    // the pinching hand a fist doesn't drop it; opening the fingers does.
    const keepPinch = wasPinching && !env.cardOpen();
    if(heart || (pose && pose !== 'Pointing_Up' && !keepPinch)) pinching = false;
    const pinchStarted = pinching && !wasPinching;
    // Pinch point: halfway between thumb and index tips. Mirror x like a mirror.
    const tip = pinching
      ? { x:(lm[4].x + lm[8].x) / 2, y:(lm[4].y + lm[8].y) / 2 }
      : lm[8];

    // ── Recipe card open ──
    if(env.cardOpen()){
      env.point(null); env.cursor(null, 'hide'); cursor = null;
      // nothing counts while the cake is still turning into the card
      if(!env.cardReady()){
        hold = { kind:null, since:now, fired:false };
        closeArmed = false; otherSince = null;
        return { claimed:true, status:'card' };
      }
      if(pinching){
        closeArmed = false; otherSince = null;
        if(lastPinchY !== null) env.scrollCard((lastPinchY - tip.y) * SCROLL_GAIN);   // hand up = read further down
        lastPinchY = tip.y;
        hold = { kind:null, since:now, fired:false };
        return { claimed:true, status:'card' };
      }
      lastPinchY = null;
      const shown = heart ? 'wish'
                  : pose === 'Thumb_Up' ? 'made'
                  : (pose === 'Open_Palm' || (!pose && shape.open)) ? 'close'
                  : null;
      if(shown !== 'close'){
        if(otherSince === null) otherSince = now;
        if(now - otherSince >= ARM_MS) closeArmed = true;
      } else otherSince = null;
      const kind = shown === 'close' && !closeArmed ? null : shown;
      if(kind !== hold.kind) hold = { kind, since:now, fired:false };
      if(!kind || hold.fired) return { claimed:true, status:'card' };
      const progress = Math.min(1, (now - hold.since) / HOLD_MS);
      if(progress < 1) return { claimed:true, status:'hold.' + kind, progress };
      hold.fired = true;      // the pose has to change before it can act again
      if(kind === 'close'){
        env.closeCard();
        quietUntil = now + AFTER_CLOSE_MS;
        return { claimed:true, status:'shelf' };
      }
      const on = env.mark(kind);
      return { claimed:true, status:(on ? 'marked.' : 'unmarked.') + kind, flash:true };
    }

    // ── Shelf showing ──
    hold = { kind:null, since:0, fired:false };
    lastPinchY = null;
    if(!env.shelfActive()){ stopPulling(); env.point(null); env.cursor(null, 'hide'); cursor = null; smooth = null; trail = []; return { claimed: now < quietUntil, status:null }; }
    // The middle of the camera frame covers the whole window, so the arm needn't stretch.
    const u = clamp01((1 - tip.x - 0.2) / 0.6);
    const v = clamp01((tip.y - 0.15) / 0.6);
    // Steady when the hand moves slowly (small shakes don't move the mitt),
    // quick when it moves on purpose. While pinching the mitt stays where it
    // was aimed: closing the fingers moves the hand, and the pinch point
    // (between thumb and finger) isn't where the fingertip was pointing.
    if(!smooth) smooth = { u:oneEuro(), v:oneEuro() };
    if(!cursor || !pinching){
      cursor = { u: smooth.u(u, now), v: smooth.v(v, now) };
      trail.push({ ...cursor, at:now });
      while(trail.length && now - trail[0].at > 600) trail.shift();
    }
    // …and as the fingers close, the fingertip has already drifted: go back
    // to where it pointed just before.
    if(pinchStarted && !pulling){
      const before = trail.find(p => now - p.at <= PINCH_BACK_MS);
      if(before) cursor = { u: before.u, v: before.v };
    }
    // A held pinch pulls the cake out bit by bit; letting go puts it back.
    if(pulling){
      if(pinching) pulling.lostAt = null;
      else if(pulling.lostAt === null) pulling.lostAt = now;
      if(pulling.lostAt !== null && now - pulling.lostAt > PULL_GRACE_MS) stopPulling();
      else {
        const p = Math.min(1, (now - pulling.since) / PULL_MS);
        env.pull(pulling.id, p);
        env.cursor(cursor, 'pinch');
        quietUntil = Math.max(quietUntil, now + AFTER_POINT_MS);
        if(p < 1) return { claimed:true, status:'pulling', progress:p };
        const id = pulling.id;
        pulling = null;
        env.point(null); env.cursor(null, 'hide'); cursor = null;
        env.pick(id);
        return { claimed:true, status:'card' };
      }
    }
    // the mitt follows the hand whatever its shape, so it's always easy to find;
    // only a pointing finger picks out a cake
    if(!shape.pointing && !pinching){
      env.point(null); env.cursor(cursor, 'idle');
      return { claimed: now < quietUntil, status:'shelf' };
    }
    // lowering or relaxing the hand after pointing mustn't sweep the chapter away
    quietUntil = Math.max(quietUntil, now + AFTER_POINT_MS);
    const id = env.cakeAt(cursor.u, cursor.v, aimed && aimed.id);
    if(id) aimed = { id, at:now };
    env.point(id);
    env.cursor(cursor, pinching ? 'pinch' : 'point');
    if(cursor.v > 0.9) env.scrollPage((cursor.v - 0.9) * 120);   // near the edge: bring more shelf into view
    if(cursor.v < 0.1) env.scrollPage((cursor.v - 0.1) * 120);
    // the pinch goes to the cake aimed at a moment ago, even if the hand slid off it while pinching
    const target = id || (aimed && now - aimed.at < 500 ? aimed.id : null);
    if(pinchStarted && target){
      pulling = { id:target, since:now, lostAt:null };
      env.point(target);
      env.pull(target, 0);
      return { claimed:true, status:'pulling', progress:0 };
    }
    return { claimed:true, status: id ? 'pointing' : 'shelf' };
  }

  return { feed, release };
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

  // The fingertip on the page while pointing at the Recipes shelf
  const cursor = document.createElement('div');
  cursor.className = 'hf-cursor';
  cursor.hidden = true;

  document.body.append(backdrop, panel, btn, cursor);
  return {
    btn, sayHi, backdrop, panel, cursor,
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

// The hand's bones, as pairs of landmark numbers (MediaPipe's numbering)
const BONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

// hands: a list of hands (or null). The first is the one that points and turns.
function drawHand(canvas, hands, active, progress = 0){
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.clientWidth * devicePixelRatio;
  const h = canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.clearRect(0, 0, w, h);
  if(!hands || !hands.length) return;
  // white dots joined by thin white lines, on every hand in view
  const d = devicePixelRatio;
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 1.25 * d;
  ctx.fillStyle = '#fff';
  for(const hand of hands){
    ctx.beginPath();
    for(const [a, b] of BONES){ ctx.moveTo(hand[a].x * w, hand[a].y * h); ctx.lineTo(hand[b].x * w, hand[b].y * h); }
    ctx.stroke();
    for(const p of hand){ ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 2.4 * d, 0, Math.PI * 2); ctx.fill(); }
  }
  const landmarks = hands[0];
  // The index fingertip is the "finger" that drags the page; it glows while turning.
  const tip = landmarks[8];
  ctx.fillStyle = active ? '#E2B84A' : '#fff';
  ctx.beginPath(); ctx.arc(tip.x * w, tip.y * h, (active ? 7 : 4.5) * devicePixelRatio, 0, Math.PI * 2); ctx.fill();
  // A held pose (close, baked, want to bake) fills a ring around the palm.
  if(progress > 0){
    const palm = landmarks[9];
    ctx.strokeStyle = '#E2B84A';
    ctx.lineWidth = 3 * devicePixelRatio;
    ctx.beginPath();
    ctx.arc(palm.x * w, palm.y * h, 22 * devicePixelRatio, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.stroke();
  }
}

const ui = buildUI();
// Add ?debug to the address to see what the tracker sees, live.
const DEBUG = new URLSearchParams(location.search).has('debug');
ui.debug.hidden = !DEBUG;
let tracker = null;        // { run(video, time) → { hand, pose } }
let stream = null;
let running = false;
let lastVideoTime = -1;
let introTimer = null;
let holdStatus = false;   // keep the "Hello!" message up while the intro plays out
let pointerStatus = null; // the Pointer's message this frame, which outranks the sweep's
let flashUntil = 0;       // keep a "Marked as baked" message up for a moment
let frameNow = 0;         // the current frame's time, so every timer here uses the same clock

function say(key){
  const k = 'hand.' + key;
  if(ui.status.dataset.i18n !== k) setI18n(ui.status, k);
}


const gesture = createGesture({
  surface: Surface,
  onState: key => {
    if(holdStatus || frameNow < flashUntil) return;
    if(pointerStatus && key !== 'grab') return;
    say(key);
  },
  onWave: () => greeted(),
});

const pointerEnv = {
  // A cake being lifted counts too: its card is about to open.
  cardOpen: () => !!document.getElementById('recipe-modal')?.classList.contains('open') || !!window.recipeShelf?.open,
  // …and has arrived (not still turning over from the cake)
  cardReady(){ const m = document.getElementById('recipe-modal'); return !!m && m.classList.contains('open') && !m.classList.contains('cc-hidden'); },
  shelfActive: () => !isCoverOpen() && !!window.recipeShelf &&
    !!document.getElementById('recipes-panel')?.classList.contains('active'),
  // The cake pointed at. Each cake owns the part of the shelf nearer to it
  // than to any other (no gaps between cakes), as far as a little beyond its
  // picture. The cake already aimed at keeps it until the fingertip is
  // clearly nearer another one, so a tremor at a border doesn't flick
  // between two.
  cakeAt(u, v, current){
    const x = u * innerWidth, y = v * innerHeight;
    const REACH = 90, KEEP = 40;   // px
    let best = null, bestD = Infinity, held = Infinity;
    window.recipeShelf.cakes().forEach(el => {
      const r = (el.querySelector('.slice-img') || el).getBoundingClientRect();
      const out = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
      if(out > REACH) return;
      const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
      if(el.dataset.recipe === current) held = d;
      if(d < bestD){ bestD = d; best = el.dataset.recipe; }
    });
    return held - KEEP <= bestD ? current : best;
  },
  point: id => window.recipeShelf?.point(id),
  pick: id => window.recipeShelf.pick(id),
  pull: (id, p) => window.recipeShelf?.pull(id, p),
  // The oven mitt on the shelf. state: 'idle' | 'point' | 'pinch' | 'hide';
  // c null (no hand in view): it waits where it was, faded, or in the middle
  // of the shelf if it hasn't been anywhere yet.
  cursor(c, state){
    const el = ui.cursor;
    // hidden off the shelf, and while a card is open or a cake is in the air
    if(state === 'hide' || !this.shelfActive() || this.cardOpen() || !document.body.classList.contains('hf-on')){ el.hidden = true; return; }
    const appearing = el.hidden;
    el.hidden = false;
    if(!c){
      if(!el.dataset.placed){
        // the cabinet on wide screens, the shelf on phones: whichever is showing
        const r = [...document.querySelectorAll('#recipes-panel .cabinet, #recipes-panel .shelf')].find(e => e.offsetWidth)?.getBoundingClientRect();
        el.style.transition = 'none';   // appears there, rather than gliding in from the corner
        el.style.translate = r ? `${r.left + r.width / 2}px ${r.top + r.height * .45}px` : `${innerWidth / 2}px ${innerHeight / 2}px`;
        el.offsetWidth; el.style.transition = '';
      }
      el.className = 'hf-cursor parked';
      return;
    }
    // it glides between camera frames, but appears right where the hand is
    const jump = appearing || !el.dataset.placed;
    el.dataset.placed = '1';
    if(jump) el.style.transition = 'none';
    // `translate`, not `transform`: the mitt's scale and tilt (cake-card.css)
    // are applied after a transform and would scale the position with it,
    // drawing the mitt away from where the hand points.
    el.style.translate = `${c.u * innerWidth}px ${c.v * innerHeight}px`;
    if(jump){ el.offsetWidth; el.style.transition = ''; }
    el.className = 'hf-cursor ' + state;
  },
  scrollCard(amount){
    const body = document.querySelector('#recipe-modal .rm-body-scroll');
    if(body) body.scrollTop += amount * body.clientHeight;
  },
  scrollPage: dy => document.body.scrollBy(0, dy),
  closeCard: () => window.closeRecipeModal(),
  // Toggle the card's stamp, as its buttons do; returns whether it is now on.
  mark(kind){
    if(kind === 'made') toggleMade(); else toggleWish();
    const s = getStampState(rmCurrentId);
    return kind === 'made' ? s.made : s.wish;
  },
};
const pointer = createPointer(pointerEnv);

// Gesture Recognizer gives the same 21 hand points as Hand Landmarker plus a
// named pose (👍, 🤟, open palm…). If it can't load, fall back to the plain
// tracker: pointing, pinching and sweeping still work, the named poses don't.
async function loadTracker(){
  const { FilesetResolver, GestureRecognizer, HandLandmarker } = await import(`${MEDIAPIPE_URL}/vision_bundle.mjs`);
  const fileset = await FilesetResolver.forVisionTasks(`${MEDIAPIPE_URL}/wasm`);
  const create = async (Task, model) => {
    const options = delegate => ({ baseOptions:{ modelAssetPath:model, delegate }, runningMode:'VIDEO', numHands:1 });
    try { return await Task.createFromOptions(fileset, options('GPU')); }
    catch(err){ return Task.createFromOptions(fileset, options('CPU')); }
  };
  // How many hands to follow; changed only when it differs (it reconfigures the task).
  const handCount = task => {
    let n = 1;
    return want => { if(want === n || !task.setOptions) return; n = want; task.setOptions({ numHands:want }); };
  };
  try {
    const recognizer = await create(GestureRecognizer, GESTURE_MODEL_URL);
    return {
      run(video, time){
        const r = recognizer.recognizeForVideo(video, time);
        const top = r.gestures && r.gestures[0] && r.gestures[0][0];
        return {
          hand: r.landmarks && r.landmarks[0] || null,
          hands: r.landmarks || [],
          pose: top && top.score > 0.6 && top.categoryName !== 'None' ? top.categoryName : null,
        };
      },
      setHands: handCount(recognizer),
    };
  } catch(err){
    console.warn('[hand-flip] gesture recognizer unavailable, using hand landmarks only', err);
    const landmarker = await create(HandLandmarker, MODEL_URL);
    return {
      run(video, time){
        const r = landmarker.detectForVideo(video, time);
        return { hand: r.landmarks && r.landmarks[0] || null, hands: r.landmarks || [], pose: null };
      },
      setHands: handCount(landmarker),
    };
  }
}

// One video frame: the Pointer looks first (it may hold sweeps back), then the sweep detector.
function handleFrame(hand, pose, now = performance.now(), hands = hand ? [hand] : []){
  frameNow = now;
  let p = { claimed:false, status:null };
  if(gesture.mode === 'turn') p = pointer.feed(hand, pose, now, hands);
  else pointer.release();
  pointerStatus = p.status;
  // Off the History book a sweep jumps straight to another chapter, so it
  // takes a deliberate one: an open palm, travelling twice as far.
  const strict = !window.historyBook?.visible;
  const openPalm = !!hand && (pose === 'Open_Palm' || (!pose && handShape(hand).open));
  const info = gesture.feed(hand, now, !p.claimed && (!strict || openPalm), strict, hands);
  if(p.flash) flashUntil = now + 1600;
  if(pointerStatus && !holdStatus && !(info && info.active) && (p.flash || now >= flashUntil)) say(pointerStatus);
  // a held gesture also shows big on the card itself (cake-card.js)
  const holding = pointerStatus && pointerStatus.startsWith('hold.') ? pointerStatus.slice(5) : null;
  window.cakeCard?.hold(holding, p.progress || 0);
  return { active: !!(info && info.active), progress: p.progress || 0 };
}

function loop(){
  if(!running) return;
  // resting while the notebook opens: nothing needs a hand then, and the
  // tracker would take time from the animation on every camera frame
  if(performance.now() < restUntil){ requestAnimationFrame(loop); return; }
  const v = ui.video;
  if(v.readyState >= 2 && v.currentTime !== lastVideoTime){
    lastVideoTime = v.currentTime;
    const now = performance.now();
    // follow a second hand for the two-handed hello, and while a card is open, for the 🫶 heart
    tracker.setHands?.(gesture.mode === 'wave' || pointerEnv.cardOpen() ? 2 : 1);
    const { hand, pose, hands } = tracker.run(v, now);
    const frame = handleFrame(hand, pose, now, hands);
    drawHand(ui.canvas, hands && hands.length ? hands : hand && [hand], frame.active, frame.progress);
    if(DEBUG){
      const d = gesture.debug;
      ui.debug.textContent = `hand ${d.hand ? '✓' : '✗'} · ${pose || '–'} · ${d.state}`;
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
    tracker = tracker || await loadTracker();
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
    setHandOn(true);
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

// While hand mode is on, the open book makes room for the camera window
// (hand-flip.css). The page-turning library only measures the book when the
// window resizes, so tell it to measure again once the book has moved.
function setHandOn(on){
  if(document.body.classList.contains('hf-on') === on) return;
  document.body.classList.toggle('hf-on', on);
  if(!on){ ui.cursor.hidden = true; delete ui.cursor.dataset.placed; }
  setTimeout(() => window.dispatchEvent(new Event('resize')), 650);
}
// The book also moves later, when the cover opens: measure again each time it has moved.
window.historyBook?.stage.addEventListener('transitionend', e => {
  if(e.target === window.historyBook.stage && e.propertyName.startsWith('padding')) window.dispatchEvent(new Event('resize'));
});

function stopCamera(){
  setHandOn(false);
  running = false;
  gesture.reset();
  pointer.release();
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
// camera print beside the cover → the cover waits: a sweep opens it.

const COVER_PAUSE_MS = 1000;
let restUntil = 0;           // hand tracking rests until then (loop())

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
  ui.panel.classList.remove('hero', 'greeted', 'leaving');
  restUntil = 0;
}

function greeted(){
  setI18n(ui.status, 'hand.hello');
  holdStatus = true;
  ui.panel.classList.add('greeted');
  // While the mirror becomes the print, everything is animation: the
  // tracker rests, so it can't make the motion stutter.
  restUntil = performance.now() + 700 + 900 + COVER_PAUSE_MS;
  drawHand(ui.canvas, null);
  introTimer = setTimeout(() => {
    ui.panel.classList.add('leaving');   // the mirror's words fade first…
    introTimer = setTimeout(() => {
      shrinkToCorner();                  // …then it becomes the print
      // The cover then waits for the person: a sweep turns it, like any page.
      // Page-turning starts only after a pause, so the tail of the wave
      // isn't read as a sweep.
      introTimer = setTimeout(() => {
        holdStatus = false;
        setI18n(ui.status, 'hand.cover');
        gesture.setMode('turn');
      }, COVER_PAUSE_MS + 900);   // 900ms = the shrink itself
    }, 230);
  }, 470);
}

// FLIP technique: measure the big mirror, snap it to its corner size,
// then animate from the old box to the new one with a single transform.
// It's the camera picture that's lined up, so the window around it can
// change (its words gone, its frame from dark to cream) without a jump.
function shrinkToCorner(){
  const panel = ui.panel, pic = panel.querySelector('.hf-stage');
  const first = pic.getBoundingClientRect();
  ui.backdrop.classList.remove('open');
  document.body.classList.remove('hf-intro');
  panel.classList.remove('hero', 'greeted', 'leaving');
  if(reducedMotion()) return;
  // Measure the boxes as laid out (offset*), not as drawn: on a wide screen
  // the print is drawn centred and tilted (hand-flip.css), and that transform
  // is what the shrink ends on.
  const k = first.width / pic.offsetWidth;
  panel.style.transformOrigin = 'top left';
  panel.style.transform =
    `translate(${first.left - panel.offsetLeft - k * pic.offsetLeft}px, ${first.top - panel.offsetTop - k * pic.offsetTop}px) scale(${k})`;
  panel.getBoundingClientRect();   // commit the starting frame
  panel.style.transition = 'transform .9s cubic-bezier(.45,0,.2,1), background-color .7s ease';   // the notebook's own glide (history-book.css)
  panel.style.transform = '';
  // (the colour finishes first: wait for the move itself)
  const done = e => {
    if(e.target !== panel || e.propertyName !== 'transform') return;
    panel.removeEventListener('transitionend', done);
    panel.style.transition = panel.style.transformOrigin = '';
  };
  panel.addEventListener('transitionend', done);
}

ui.sayHi.addEventListener('click', startIntro);

// Hand mode is made for a laptop: on a phone you hold the screen in one hand
// and the camera is too close, so phones turn pages by touch (the buttons
// are hidden in hand-flip.css). If a window narrows to phone size, stop.
const PHONE = window.matchMedia('(max-width:700px)');
PHONE.addEventListener('change', () => { if(PHONE.matches && ui.btn.getAttribute('aria-pressed') === 'true') stop(); });

// Skip: put the camera away and open the notebook the ordinary way.
ui.skip.addEventListener('click', () => { stop(); openBook(); });

document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && ui.panel.classList.contains('hero')) stop();
});

ui.btn.addEventListener('click', () => {
  ui.btn.getAttribute('aria-pressed') === 'true' ? stop() : start();
});

// Exposed for testing and for other controls (e.g. keyboard) to reuse.
window.handFlip = { Flip, Surface, createGesture, gesture, createPointer, handShape, pointer, handleFrame, startIntro,
  available: () => !PHONE.matches };
