// The legend over the map: for each active layer, what it shows, in which
// units, from which source, and at which time.

import { format } from '../core/units.js';
import { DEPTH_CLASSES, radiusOf } from '../layers/events.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function tickText(v) {
  if (Math.abs(v) >= 1e4) return format(v, 2);
  return Number.isInteger(v) ? String(v) : format(v, 2);
}

export function renderLegend(el, { surface, flow, lines, events }) {
  const parts = [];
  if (surface) {
    const ticks = surface.ticks.map((t) => `<span style="left:${(t.at * 100).toFixed(2)}%">${esc(tickText(t.value))}</span>`).join('');
    parts.push(`<div>
      <div class="title"><span>${esc(surface.title)}</span><span class="unit">${esc(surface.unit)}</span></div>
      <div class="bar"><span style="background:${surface.gradient}"></span></div>
      <div class="ticks">${ticks}</div>
      ${surface.note ? `<div class="note">${esc(surface.note)}</div>` : ''}
      ${surface.offset ? `<div class="note offset">${esc(surface.offset)}</div>` : ''}
    </div>`);
  }
  if (flow || lines) {
    const rows = [];
    if (flow) rows.push(`<div class="title"><span>${esc(flow.title)}</span><span class="unit">moving</span></div>${flow.note ? `<div class="note">${esc(flow.note)}</div>` : ''}${flow.offset ? `<div class="note offset">${esc(flow.offset)}</div>` : ''}`);
    if (lines) rows.push(`<div class="title"><span>${esc(lines.title)}</span><span class="unit">${esc(lines.unit)}</span></div>${lines.note ? `<div class="note">${esc(lines.note)}</div>` : ''}`);
    parts.push(`<div>${rows.join('<div style="height:6px"></div>')}</div>`);
  }
  if (events) {
    const keys = DEPTH_CLASSES.map((c) => `<span><i style="background:rgb(${c.colour.join(',')})"></i>${esc(c.label)}</span>`).join('');
    const sizes = [5, 6, 7].map((m) => {
      const r = radiusOf(m);
      return `<span><svg width="${2 * r + 2}" height="${2 * r + 2}" style="vertical-align:middle;margin-right:4px"><circle cx="${r + 1}" cy="${r + 1}" r="${r - 0.5}" fill="none" stroke="#cdb6c8" stroke-width="1"/></svg>M ${m}</span>`;
    }).join('');
    parts.push(`<div>
      <div class="title"><span>${esc(events.title)}</span><span class="unit">${esc(events.count)}</span></div>
      <div class="keys">${keys}</div>
      <div class="keys">${sizes}</div>
      ${events.note ? `<div class="note">${esc(events.note)}</div>` : ''}
    </div>`);
  }
  el.innerHTML = parts.join('');
}
