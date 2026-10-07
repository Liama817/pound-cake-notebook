// ── BOOK DRAG ───────────────────────────────────────────────
// The hand tracker (hand-flip.js) turns a StPageFlip book's pages by
// dragging a corner, as a mouse would. Shared by the History book
// (history-book.js) and the recipe book (recipe-book.js).
//
// bookDrag(pageFlip, { cover }) → { canTurn(dir), drag }
//   cover: the book's first page is a cover shown alone (spreads [0], [1,2]…);
//   otherwise spreads are [0,1], [2,3]…
// drag.begin(dir, v) / drag.move(u, v) / drag.end(), with u, v the position
// across the whole book, 0–1 (u = 0 left edge, 1 right edge).

export function bookDrag(pageFlip, { cover = false } = {}){
  const landscape = () => pageFlip.getOrientation() === 'landscape';

  function toBookPoint(u, v){
    const r = pageFlip.getBoundsRect();
    return { x: r.left + u * r.width, y: r.top + v * r.height };
  }

  function canTurn(dir){
    const i = pageFlip.getCurrentPageIndex(), n = pageFlip.getPageCount();
    if(dir < 0) return i > 0;
    if(!landscape()) return i < n - 1;
    return (cover && i === 0 ? 1 : i + 2) < n;
  }

  let dragging = false;
  let last = { u:0.5, v:0.85 };   // where the hand last held the page
  const drag = {
    // Begin a turn in direction dir (+1 next, -1 back). In landscape the page
    // follows u/v from move(); in portrait the turn just plays.
    begin(dir, v = 0.85){
      if(dragging || !canTurn(dir) || pageFlip.getState() !== 'read') return false;
      if(!landscape()){
        dir > 0 ? pageFlip.flipNext('bottom') : pageFlip.flipPrev('bottom');
        return 'played';
      }
      dragging = true;
      last = { u: dir > 0 ? 0.97 : 0.03, v };
      pageFlip.startUserTouch(toBookPoint(last.u, last.v));
      // The library picks the turn's direction from the first point it is
      // dragged to (left half = back). Fold a little at the starting edge now,
      // so a jumpy first hand position can't turn the page the wrong way.
      last = { u: dir > 0 ? 0.92 : 0.08, v };
      pageFlip.userMove(toBookPoint(last.u, last.v), false);
      return true;
    },
    move(u, v){
      if(!dragging) return;
      last = { u: Math.min(1, Math.max(0, u)), v: Math.min(0.98, Math.max(0.02, v)) };
      pageFlip.userMove(toBookPoint(last.u, last.v), false);
    },
    // Let go: the library finishes the turn if the corner passed the spine,
    // otherwise the page settles back.
    end(){
      if(!dragging) return;
      dragging = false;
      pageFlip.userStop(toBookPoint(last.u, last.v));
    },
    get active(){ return dragging; },
  };

  return { canTurn, drag };
}
