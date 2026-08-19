// ─────────────────────────────────────────────────────────────
// Trummer's Staff Reference — shared page chrome
//
// Loaded by every section page: sparkling, whites, reds, whisky, cocktails,
// beer, afters, dinner, dessert.
//
// Only code that is genuinely identical across all nine belongs here. Anything
// a page does differently (render, buildFilters, toggleCard) stays inline in
// that page. If you find yourself adding an `if (page === 'reds')` branch to
// this file, that function does not belong in this file.
//
// Load order: this tag must come BEFORE each page's inline <script>.
// Cache busting: bump the ?v= number on the script tags after editing.
// ─────────────────────────────────────────────────────────────

// ── SCROLL POSITIONING ───────────────────────────────────────
let _scrollSettleAbort = null;

function scrollToEl(el) {
  if (!el) return;
  if (_scrollSettleAbort) _scrollSettleAbort();   // cancel any run still in flight

  const controls = document.querySelector('.controls');
  const GAP = 48;
  const barH = () => (controls ? controls.offsetHeight : 0);
  const INPUT = ['wheel', 'touchstart', 'pointerdown', 'mousedown', 'keydown'];

  let cancelled = false, timer = null, intended = null;

  const stop = () => {
    cancelled = true;
    if (timer) { clearTimeout(timer); timer = null; }
    INPUT.forEach(ev => window.removeEventListener(ev, stop));
    if (_scrollSettleAbort === stop) _scrollSettleAbort = null;
  };
  INPUT.forEach(ev => window.addEventListener(ev, stop, { passive: true }));
  _scrollSettleAbort = stop;

  const place = () => {
    intended = el.getBoundingClientRect().top + window.scrollY - (barH() + GAP);
    window.scrollTo({ top: intended, behavior: 'smooth' });
  };

  // Wait until scrolling has actually stopped before touching anything. Polling
  // for a stable position works whether the scroll came from us, a wheel, a
  // dragged scrollbar or a finger, which matters because a dragged scrollbar
  // fires no pointer events on the page at all.
  const whenIdle = (cb, checks, last) => {
    if (cancelled) return;
    const y = window.scrollY;
    if (y === last) { checks++; } else { checks = 0; }
    if (checks >= 2) return cb();
    timer = setTimeout(() => whenIdle(cb, checks, y), 60);
  };

  // One correction, only if the page is still roughly where we put it. If the
  // guest has scrolled somewhere else, leave them alone.
  const correctOnce = () => {
    if (cancelled) return stop();
    if (intended !== null && Math.abs(window.scrollY - intended) > 200) return stop();
    const off = (el.getBoundingClientRect().top - barH()) - GAP;
    if (Math.abs(off) > 4) window.scrollBy({ top: off, behavior: 'auto' });
    stop();
  };

  const run = () => {
    if (cancelled) return;
    place();
    timer = setTimeout(() => whenIdle(correctOnce, 0, null), 200);
  };

  if (document.fonts && document.fonts.status !== 'loaded' && document.fonts.ready) {
    document.fonts.ready.then(run).catch(run);
  } else { run(); }
}

// Section and card anchors need a scroll margin matching the live height of
// the sticky controls bar, which changes as filters open and close.
function applyScrollMargins() {
  const h = document.querySelector('.controls')?.offsetHeight;
  if (h) {
    const px = (h + 24) + 'px';
    document.querySelectorAll('[id^="sec-"], [id^="card-"]').forEach(el => {
      el.style.scrollMarginTop = px;
    });
  }
}

// ── CONTROLS COLLAPSE ─────────────────────────────────────────
// The controls bar sits in normal flow, so collapsing it removes its height
// from the document. On a short list (a filter that returns two or three
// wines) that shrink can drop scrollY back under the collapse threshold, which
// re-expands the bar, which restores the height, which lets the page scroll
// past the threshold again. That loop runs every frame and reads as a stutter
// that bounces you off the last card. Two guards below: separate collapse and
// expand thresholds so a small clamp cannot flip the state, and a runway check
// so the bar never collapses when there is not enough page left to absorb it.

(function() {
  const COLLAPSE_AT = 60;
  const EXPAND_AT = 24;
  const RUNWAY = 80;

  let manualExpandAt = -1;
  let ticking = false;

  function collapsibleHeight(controls) {
    const el = controls.querySelector('.controls-collapsible');
    return el ? el.scrollHeight : 0;
  }

  // Would the page still be scrollable past COLLAPSE_AT once the bar collapses?
  // If not, collapsing guarantees a clamp back into expand territory.
  function hasRunway(controls) {
    const shrink = collapsibleHeight(controls);
    if (!shrink) return true;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const expandedMax = controls.classList.contains('collapsed') ? maxScroll + shrink : maxScroll;
    return (expandedMax - shrink) > COLLAPSE_AT + RUNWAY;
  }

  function update() {
    ticking = false;
    const controls = document.querySelector('.controls');
    if (!controls) return;
    const y = window.scrollY;

    if (y <= EXPAND_AT) {
      controls.classList.remove('collapsed');
      manualExpandAt = -1;
      return;
    }

    if (!hasRunway(controls)) {
      controls.classList.remove('collapsed');
      return;
    }

    if (y <= COLLAPSE_AT) return;

    if (manualExpandAt >= 0) {
      if (y > manualExpandAt + 80) {
        controls.classList.add('collapsed');
        manualExpandAt = -1;
      }
    } else {
      controls.classList.add('collapsed');
    }
  }

  function schedule() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  window.addEventListener('scroll', schedule, { passive: true });

  // A filter change alters list length, so re-check the runway rather than
  // waiting for the next scroll event to notice the page got shorter.
  window.addEventListener('resize', schedule, { passive: true });

  // Pages call this at the end of render().
  window.recheckControls = schedule;

  window.toggleFilters = function() {
    const controls = document.querySelector('.controls');
    if (!controls) return;
    manualExpandAt = window.scrollY;
    controls.classList.remove('collapsed');
  };
})();
