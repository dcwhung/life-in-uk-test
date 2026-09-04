// ════════════════════════════════════════
// UTILS — pure helpers shared by the app (loaded before the main script)
// ════════════════════════════════════════
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Return a copy of q with its options in random order and `a` remapped
// to the new positions (applies to both Practice and Exam mode).
function shuffleOptions(q) {
  const order = shuffle(q.o.map((_, i) => i)); // order[newPos] = oldIdx
  return {
    ...q,
    o: order.map(oldIdx => q.o[oldIdx]),
    oy: order.map(oldIdx => (q.oy || [])[oldIdx] || ''),
    a: q.a.map(oldIdx => order.indexOf(oldIdx)).sort((x, y) => x - y),
  };
}

function getLS(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function setLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// Difficulty stars (1-5) as inline HTML.
function starsHtml(d) {
  return `<span class="stars" title="Difficulty ${d}/5">${'★'.repeat(d)}<span class="off">${'★'.repeat(5 - d)}</span></span>`;
}

// Escape text for safe insertion into innerHTML.
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
