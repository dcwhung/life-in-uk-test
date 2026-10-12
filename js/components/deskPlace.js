// ════════════════════════════════════════
// DESK PLACE (v2.0.0 desktop layout, ≥ 1024px; handoff .proj-docs/plans/2026-10-12_handoff_desktop-layout.md §5)
// The one way a screen moves its own parts into desktop columns and back (W-377 / S-235). index.html holds the phone
// order; from 1024px a screen moves some of its elements (same ids, so every render keeps writing to them) into
// containers it builds once and keeps; below 1024px each goes back to its place, which a comment marker remembers.
// The phone's DOM, order and spacing never change.
//   deskRemember(el)            mark el's phone place (once; later calls do nothing)
//   deskFill(parent, els)       parent's first children become els, in order; an element already in place is not moved
//   deskRestore(els)            each remembered el back at its marker (one already there is not moved)
//   setDesktopColumns(spec, on) a column box for a screen without its own containers (Home, Plan Goal, Plan Day):
//                               { key, boxClass, columns: [{ cls, parts: [el, …] }] }; built once, put where the first
//                               part was, out of the DOM below 1024px. Returns the box (null when off)
//   desktopRefit(screenId, fit) registers the screen's fit with js/components/fit.js the first time it is called
//                               (lazily: a cached shell may load fit.js after the screens, js/main.js LATE_BOOT_SCRIPTS),
//                               then runs the fits. Screens call it at the end of every render
// Every move keeps keyboard focus (S-228): an element that had focus and is still in the document gets it back
// (preventScroll), as moving a node in the DOM drops its focus.
// When to use which:
//   - moved parts (this file): the desktop order differs from the phone's, or a part changes column with the state
//     (Quiz, Result, Home, Plan Goal, Plan Day)
//   - a permanent wrapper (display: contents below 1024px; Study's .study-cols, Flagged's .flagged-wrap): the phone
//     order already is the desktop order and the wrapper only adds a box (columns, a scroll panel) around it
// ════════════════════════════════════════
const deskPlaceMarkers = new Map(); // element → the comment that marks its phone place
const deskColumnBoxes = new Map(); // setDesktopColumns key → { box, cols: [{ col, parts }] }
const deskFits = new Set(); // screen ids whose fit is registered

function deskOn() { return typeof isDesktop === 'function' && isDesktop(); } // W-057: a cached shell may lack fit.js
function deskEl(tag, className, attrs = {}) {
  const el = document.createElement(tag);
  el.className = className;
  Object.entries(attrs).forEach(([name, value]) => el.setAttribute(name, value));
  return el;
}
// S-228: run DOM moves and give focus back to the element that had it, if a move took it away. Nested calls leave
// it to the outermost one: a screen arranging several boxes (a box filled before it is itself in the document)
// wraps the whole arrangement, so focus comes back once everything is in place
let deskMoveDepth = 0;
function deskKeepFocus(move) {
  const active = deskMoveDepth ? null : document.activeElement;
  deskMoveDepth++;
  try { move(); } finally { deskMoveDepth--; }
  if (active && active !== document.body && active.isConnected && document.activeElement !== active) active.focus({ preventScroll: true });
}
// a missing element (null) is skipped everywhere: a cached older index.html may lack one (W-057; e.g. a pre-PR6a
// shell has no #planPairNote)
function deskRemember(el) {
  if (!el || deskPlaceMarkers.has(el)) return;
  const marker = document.createComment(` phone place: ${el.id || el.className} `);
  el.before(marker);
  deskPlaceMarkers.set(el, marker);
}
function deskHome(el) { return deskPlaceMarkers.get(el) || null; }
function deskFill(parent, els) {
  const want = els.filter(Boolean);
  if (want.every((el, i) => parent.children[i] === el)) return;
  deskKeepFocus(() => want.forEach((el, i) => { if (parent.children[i] !== el) parent.insertBefore(el, parent.children[i] || null); }));
}
function deskRestore(els) {
  const away = els.filter(el => el && deskPlaceMarkers.has(el) && deskPlaceMarkers.get(el).nextSibling !== el);
  if (away.length) deskKeepFocus(() => away.forEach(el => deskPlaceMarkers.get(el).after(el)));
}

// ── column boxes (Home, Plan Goal, Plan Day) ──
function deskFirstInDocument(els) {
  return els.reduce((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING ? b : a));
}
function deskBuildColumns({ key, boxClass, columns }) {
  const box = deskEl('div', boxClass);
  const cols = columns.map(({ cls }) => deskEl('div', cls));
  box.append(...cols);
  const entry = { box, cols, parts: [] };
  deskColumnBoxes.set(key, entry);
  return entry;
}
// the parts come from the spec on every call (a part missing from an older shell is null and skipped)
function setDesktopColumns(spec, on) {
  const entry = deskColumnBoxes.get(spec.key);
  if (!on) {
    if (entry && entry.box.isConnected) deskKeepFocus(() => { deskRestore(entry.parts); entry.box.remove(); });
    return null;
  }
  if (entry && entry.box.isConnected) return entry.box; // in place: a refit moves nothing (focus, scroll)
  const parts = spec.columns.flatMap(col => col.parts).filter(Boolean);
  if (!parts.length) return null;
  const built = entry || deskBuildColumns(spec);
  built.parts = parts;
  deskKeepFocus(() => {
    parts.forEach(deskRemember);
    deskFirstInDocument(parts).before(built.box);
    spec.columns.forEach((col, i) => deskFill(built.cols[i], col.parts));
  });
  return built.box;
}
// the column box of `key` while the desktop layout is on (null otherwise)
function desktopColumnsBox(key) {
  const entry = deskColumnBoxes.get(key);
  return entry && entry.box.isConnected ? entry.box : null;
}

// ── refits ──
function desktopRefit(screenId, fit) {
  if (typeof runRefits !== 'function') return;
  if (!deskFits.has(screenId)) { deskFits.add(screenId); onRefit(fit, screenId); }
  runRefits();
}
