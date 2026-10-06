// ════════════════════════════════════════
// UTILS — small pure helpers + DOM shortcuts shared by every screen
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

// { q, examNum, origIdx } pool item → session question (shuffled options + its origin)
function toQuestionItem({ q, examNum, origIdx }) {
  return { ...shuffleOptions(q), examNum, origIdx };
}

// every correct option picked and nothing else
function isCorrectAnswer(q, ans) {
  const picked = ans || [];
  return q.a.every(a => picked.includes(a)) && picked.length === q.a.length;
}

function getLS(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function setLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// Escape text for safe insertion into innerHTML.
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const pad2 = n => String(n).padStart(2, '0');
const keysOf = obj => Object.keys(obj).filter(k => obj[k]);
const percent = (part, whole) => (whole ? Math.round((part / whole) * PERCENT) : 0);

const byId = id => document.getElementById(id);
function setShown(id, visible) { byId(id).hidden = !visible; }
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  byId(id).classList.add('active');
}
