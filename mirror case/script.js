/* ════════════════════════════════════════════════
   SHATTERED — script.js
   3D Page Flip · Calm Paper Sound · Touch Swipe
   ════════════════════════════════════════════════ */

'use strict';

// ── State ─────────────────────────────────────────
const TOTAL  = 11;   // cover(0) + 10 story pages (1-10)
let   curr   = 0;    // current page index (0 = cover)
let   busy   = false;
let   audioCtx = null;

// ── DOM ──────────────────────────────────────────
const stack      = document.getElementById('book-stack');
const pageEls    = [...stack.querySelectorAll('.book-page')];
const btnPrev    = document.getElementById('btn-prev');
const btnNext    = document.getElementById('btn-next');
const numEl      = document.getElementById('page-num');
const totalEl    = document.getElementById('page-total');
const cornerAd   = document.getElementById('corner-ad');
const cornerClose= document.getElementById('corner-ad-close');
const bottomAd   = document.getElementById('bottom-ad');
const bottomClose= document.getElementById('bottom-ad-close');

// ── Init ─────────────────────────────────────────
function init() {
  totalEl.textContent = TOTAL;

  // Show only page 0; hide everything else
  pageEls.forEach((p, i) => {
    p.style.display   = i === 0 ? 'block' : 'none';
    p.style.zIndex    = '1';
    p.style.transform = 'rotateY(0deg)';
  });
  pageEls[0].style.zIndex = '5';

  updateNav();

  // Show corner ad on mobile after 5s
  if (window.innerWidth <= 960 && cornerAd) {
    setTimeout(() => { cornerAd.hidden = false; }, 5000);
  }
}

// ── Navigate forward ─────────────────────────────
function goNext() {
  if (busy || curr >= TOTAL - 1) return;
  busy = true;
  playPaperSound();

  const out  = pageEls[curr];
  const into = pageEls[curr + 1];

  // Reveal next page underneath
  into.style.display   = 'block';
  into.style.zIndex    = '2';
  into.style.transform = 'rotateY(0deg)';

  // Current page flips away (left)
  out.style.zIndex = '10';
  out.classList.add('flip-out');

  // Guard: done() can only fire once
  let fired = false;
  function done() {
    if (fired) return;
    fired = true;
    out.classList.remove('flip-out');
    out.style.display = 'none';
    out.style.zIndex  = '1';
    into.style.zIndex = '5';
    curr++;
    busy = false;
    updateNav();
    resetScroll(into);
  }

  out.addEventListener('animationend', done, { once: true });
  setTimeout(done, 850); // safety fallback
}

// ── Navigate backward ────────────────────────────
function goPrev() {
  if (busy || curr <= 0) return;
  busy = true;
  playPaperSound('back');

  const out  = pageEls[curr];
  const into = pageEls[curr - 1];

  // Previous page starts from fully-flipped position
  into.style.display   = 'block';
  into.style.zIndex    = '10';
  into.style.transform = 'rotateY(-180deg)';
  out.style.zIndex     = '2';

  // Force reflow so the -180deg is applied before animation
  void into.getBoundingClientRect();

  into.classList.add('flip-in');

  let fired = false;
  function done() {
    if (fired) return;
    fired = true;
    into.classList.remove('flip-in');
    into.style.transform = 'rotateY(0deg)';
    into.style.zIndex    = '5';
    out.style.display    = 'none';
    out.style.zIndex     = '1';
    curr--;
    busy = false;
    updateNav();
  }

  into.addEventListener('animationend', done, { once: true });
  setTimeout(done, 850);
}

// ── Scroll page content back to top ──────────────
function resetScroll(pageEl) {
  const c = pageEl.querySelector('.page-content');
  if (c) c.scrollTop = 0;
}

// ── Update nav buttons & counter ─────────────────
function updateNav() {
  numEl.textContent  = curr + 1;
  btnPrev.disabled   = curr === 0;
  btnNext.disabled   = curr === TOTAL - 1;

  // Replace next button text at last page
  if (curr === TOTAL - 1) {
    btnNext.innerHTML = '<span class="nav-label" style="font-size:.7rem;letter-spacing:.1em">&#8213; The End &#8213;</span>';
  } else {
    btnNext.innerHTML = '<span class="nav-label">Next</span><span class="nav-arrow">&#8250;</span>';
  }
}

// ══════════════════════════════════════════════════
//  CALM PAPER TURN SOUND  ·  Web Audio synthesis
//  No files needed — pure synthesised paper rustle
// ══════════════════════════════════════════════════
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playPaperSound(dir) {
  try {
    const ctx      = getCtx();
    const dur      = 0.45;          // slightly longer = calmer
    const frames   = Math.floor(ctx.sampleRate * dur);
    const buf      = ctx.createBuffer(2, frames, ctx.sampleRate);

    // White noise base
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < frames; i++) d[i] = Math.random() * 2 - 1;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    // Low bandpass — soft paper (300–700 Hz), not shrill
    const bp = ctx.createBiquadFilter();
    bp.type  = 'bandpass';
    bp.Q.value = 1.1;

    if (dir === 'back') {
      // Backward: low → slightly higher
      bp.frequency.setValueAtTime(250, ctx.currentTime);
      bp.frequency.exponentialRampToValueAtTime(620, ctx.currentTime + dur * 0.5);
      bp.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + dur);
    } else {
      // Forward: slight high → settle low
      bp.frequency.setValueAtTime(580, ctx.currentTime);
      bp.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + dur);
    }

    // Gentle highpass — remove sub-bass rumble
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 180;

    // Very soft gain — not shrill at all
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0,    ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1,  ctx.currentTime + 0.03);  // soft attack
    gain.gain.setValueAtTime(0.07, ctx.currentTime + 0.15);           // gentle sustain
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur); // natural decay

    src.connect(bp);
    bp.connect(hp);
    hp.connect(gain);
    gain.connect(ctx.destination);
    src.start(ctx.currentTime);
    src.stop(ctx.currentTime + dur);

  } catch (_) { /* AudioContext unavailable — silent */ }
}

// ══════════════════════════════════════════════════
//  EVENT LISTENERS
// ══════════════════════════════════════════════════

btnNext.addEventListener('click', goNext);
btnPrev.addEventListener('click', goPrev);

// Keyboard navigation
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext();
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   goPrev();
});

// ── Touch swipe ───────────────────────────────────
// Fires only on fast horizontal swipes (not vertical scrolls)
let tx0 = 0, ty0 = 0, tt0 = 0;

document.addEventListener('touchstart', e => {
  tx0 = e.changedTouches[0].clientX;
  ty0 = e.changedTouches[0].clientY;
  tt0 = Date.now();
}, { passive: true });

document.addEventListener('touchend', e => {
  const dx    = e.changedTouches[0].clientX - tx0;
  const dy    = e.changedTouches[0].clientY - ty0;
  const dt    = Date.now() - tt0;
  const speed = Math.abs(dx) / dt;

  // Must be: clearly horizontal, ≥44px, fast enough
  if (Math.abs(dx) >= 44 && Math.abs(dx) > Math.abs(dy) * 1.5 && speed >= 0.2) {
    if (dx < 0) goNext();
    else         goPrev();
  }
}, { passive: true });

// ── Close corner ad ──────────────────────────────
if (cornerClose) {
  cornerClose.addEventListener('click', () => {
    if (!cornerAd) return;
    cornerAd.style.transition = 'opacity .28s, transform .28s';
    cornerAd.style.opacity    = '0';
    cornerAd.style.transform  = 'translateY(12px)';
    setTimeout(() => cornerAd.remove(), 300);
  });
}

// ── Close bottom banner ───────────────────────────
if (bottomClose) {
  bottomClose.addEventListener('click', () => {
    if (!bottomAd) return;
    bottomAd.style.transition = 'transform .28s';
    bottomAd.style.transform  = 'translateY(100%)';
    setTimeout(() => {
      bottomAd.remove();
      document.body.style.paddingBottom = '0';
    }, 300);
  });
}

// ── Boot ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
