// The card about a place (or about the Earth as a whole when no place is
// chosen): where it is, the Sun there, and every value the loaded data give
// for it, with the course of each value over time for a chosen place.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function sparkline(times, values, cursor, colour = '#CA8DBE') {
  const W = 280, H = 34, pad = 3;
  const ok = values.map((v, i) => [times[i], v]).filter(([, v]) => Number.isFinite(v));
  if (ok.length < 2) return '';
  const t0 = times[0], t1 = times[times.length - 1];
  let lo = Math.min(...ok.map((p) => p[1])), hi = Math.max(...ok.map((p) => p[1]));
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const x = (t) => pad + ((t - t0) / (t1 - t0)) * (W - 2 * pad);
  const y = (v) => H - pad - ((v - lo) / (hi - lo)) * (H - 2 * pad);
  const d = ok.map(([t, v], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const area = `${d}L${x(ok[ok.length - 1][0]).toFixed(1)},${H}L${x(ok[0][0]).toFixed(1)},${H}Z`;
  let mark = '';
  if (cursor && cursor.time >= t0 && cursor.time <= t1) {
    const cx = x(cursor.time);
    mark = `<line x1="${cx}" x2="${cx}" y1="0" y2="${H}" stroke="#f4dbe7" stroke-width="1" vector-effect="non-scaling-stroke" opacity=".6"/>`;
    if (Number.isFinite(cursor.value)) mark += `<circle cx="${cx}" cy="${y(cursor.value)}" r="2.6" fill="#f4dbe7"/>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${area}" fill="${colour}" opacity=".14"/>
    <path d="${d}" fill="none" stroke="${colour}" stroke-width="1.4" vector-effect="non-scaling-stroke"/>
    ${mark}</svg>`;
}

// info: { title, sub, pinned, rows: [[term, html]], sections: [{ heading, rows }],
//         series: [{ label, now, times, values, cursor }], hint }
export function renderPlace(el, info) {
  const rows = (list) => `<dl>${list.map(([dt, dd]) => `<dt>${esc(dt)}</dt><dd>${dd}</dd>`).join('')}</dl>`;
  let html = '';
  if (info.pinned) html += '<button type="button" class="unpin" data-action="unpin" aria-label="Forget this place">✕</button>';
  html += `<h2 class="${info.title.length > 22 ? 'long' : ''}">${esc(info.title)}</h2>`;
  if (info.sub) html += `<p class="sub">${esc(info.sub)}</p>`;
  if (info.rows && info.rows.length) html += rows(info.rows);
  for (const s of info.sections || []) {
    if (!s.rows.length) continue;
    html += `<h4>${esc(s.heading)}</h4>${rows(s.rows)}`;
  }
  if (info.series && info.series.length) {
    html += '<h4>Over time</h4><div class="series">';
    for (const s of info.series) {
      const line = sparkline(s.times, s.values, s.cursor, s.colour);
      if (!line) continue;
      html += `<div class="row"><span>${esc(s.label)}</span><span class="now">${s.now}</span>${line}</div>`;
    }
    html += '</div>';
  }
  if (info.hint) html += `<p class="hint">${esc(info.hint)}</p>`;
  el.innerHTML = html;
}
