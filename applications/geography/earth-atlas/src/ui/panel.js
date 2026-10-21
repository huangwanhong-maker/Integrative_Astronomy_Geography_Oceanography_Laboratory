// The layer panel: what is drawn on the surface, what moves, which lines and
// events are shown, and how the base map looks.

import { cssGradient } from '../render/colormaps.js';
import { DOMAINS } from '../layers/catalogue.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const LANGUAGES = [
  ['en', 'English'], ['zh', '中文（简体）'], ['zht', '中文（繁體）'], ['ja', '日本語'], ['ko', '한국어'],
  ['fr', 'Français'], ['de', 'Deutsch'], ['es', 'Español'], ['pt', 'Português'], ['it', 'Italiano'],
  ['ru', 'Русский'], ['ar', 'العربية'], ['hi', 'हिन्दी'],
];

function choice(name, value, label, checked, swatch) {
  const mark = swatch ? `<span class="swatch" style="background:${swatch}"></span>` : '<span class="dotmark"></span>';
  return `<label class="choice"><input type="radio" name="${name}" value="${esc(value)}"${checked ? ' checked' : ''}>${mark}<span>${esc(label)}</span></label>`;
}

function swatchOf(def) {
  const st = def.style;
  return st ? cssGradient(st.colormap, { reverse: st.reverse, clip: st.clip }) : null;
}

export function buildPanel(el, catalogue, state, years, on) {
  const html = [];
  // ---- surface ----
  html.push('<h3 style="margin-top:6px;border-top:0;padding-top:0">Surface</h3>');
  const fields = catalogue.surfaces.filter((s) => s.kind === 'field');
  const indicators = catalogue.surfaces.filter((s) => s.kind === 'indicator');
  const byDomain = new Map();
  for (const s of fields) {
    if (!byDomain.has(s.domain)) byDomain.set(s.domain, []);
    byDomain.get(s.domain).push(s);
  }
  for (const [domain, list] of byDomain) {
    html.push(`<div class="group-name">${esc(DOMAINS[domain] || domain)}</div>`);
    for (const s of list) html.push(choice('surface', s.id, s.label, state.surface === s.id, swatchOf(s)));
  }
  if (indicators.length) {
    const active = indicators.find((s) => s.id === state.surface);
    const current = active || indicators.find((s) => s.id === state.indicator) || indicators[0];
    html.push(`<div class="group-name">${esc(DOMAINS.geography)}, by country</div>`);
    const options = indicators.map((s) => `<option value="${esc(s.id)}"${s.id === current.id ? ' selected' : ''}>${esc(s.label)}</option>`).join('');
    html.push(`<label class="choice indicator"><input type="radio" name="surface" value="${esc(current.id)}"${active ? ' checked' : ''}><span class="swatch" style="background:${swatchOf(current)}"></span><select id="indicator" aria-label="Indicator">${options}</select></label>`);
    if (active && years) {
      html.push(`<div class="indicator-row"><span></span><span class="year"><button type="button" data-year="-1" aria-label="Earlier year">‹</button><span>${years.year}</span><button type="button" data-year="1" aria-label="Later year">›</button></span></div>`);
    }
  }
  html.push(choice('surface', 'none', 'Relief only', state.surface === 'none', null));

  // ---- motion, lines, events ----
  html.push('<h3>Motion</h3>');
  html.push(choice('flow', 'none', 'None', state.flow === 'none'));
  for (const f of catalogue.flows) html.push(choice('flow', f.id, f.label, state.flow === f.id));
  if (catalogue.lines.length) {
    html.push('<h3>Lines</h3>');
    html.push(choice('lines', 'none', 'None', state.lines === 'none'));
    for (const l of catalogue.lines) html.push(choice('lines', l.id, l.label, state.lines === l.id));
  }
  if (catalogue.events.length) {
    html.push('<h3>Events</h3>');
    const kinds = new Map();
    for (const e of catalogue.events) {
      if (!kinds.has(e.kind)) kinds.set(e.kind, []);
      kinds.get(e.kind).push(e);
    }
    for (const [kind, list] of kinds) {
      const on = list.some((e) => e.id === state.events);
      const label = kind === 'earthquake' ? 'Earthquakes' : kind;
      html.push(`<label class="check"><input type="checkbox" data-events="${esc(list[0].id)}"${on ? ' checked' : ''}> ${esc(label)}</label>`);
      if (list.length > 1) {
        const span = (e) => {
          const days = (Date.parse(e.window.end) - Date.parse(e.window.start)) / 86400000;
          return days > 300 ? 'past year' : days > 20 ? 'past month' : days > 5 ? 'past week' : 'past day';
        };
        html.push(`<div class="segmented" style="margin-left:26px">${list.map((e) => `<button type="button" data-events-window="${esc(e.id)}" aria-pressed="${e.id === state.events}">${span(e)}</button>`).join('')}</div>`);
      }
    }
  }

  // ---- map ----
  html.push('<h3>Map</h3>');
  html.push(`<div class="segmented">${['relief', 'plain'].map((s) => `<button type="button" data-style="${s}" aria-pressed="${state.style === s}">${s === 'relief' ? 'Relief' : 'Plain'}</button>`).join('')}</div>`);
  const checks = [['night', 'Day and night'], ['coast', 'Coastlines'], ['borders', 'Borders'], ['rivers', 'Rivers'], ['graticule', 'Graticule'], ['labels', 'Names'], ['reliefOnData', 'Relief on data']];
  html.push(`<div class="checks">${checks.map(([k, l]) => `<label class="check"><input type="checkbox" data-base="${k}"${state[k] ? ' checked' : ''}> ${l}</label>`).join('')}</div>`);
  html.push(`<label class="select"><span>Names in</span><select id="language">${LANGUAGES.map(([c, n]) => `<option value="${c}"${c === state.lang ? ' selected' : ''}>${n}</option>`).join('')}</select></label>`);
  el.innerHTML = html.join('');

  el.querySelectorAll('input[name="surface"]').forEach((i) => i.addEventListener('change', () => on.surface(i.value)));
  el.querySelectorAll('input[name="flow"]').forEach((i) => i.addEventListener('change', () => on.flow(i.value)));
  el.querySelectorAll('input[name="lines"]').forEach((i) => i.addEventListener('change', () => on.lines(i.value)));
  el.querySelectorAll('input[data-events]').forEach((i) => i.addEventListener('change', () => on.events(i.checked ? i.dataset.events : null)));
  el.querySelectorAll('button[data-events-window]').forEach((b) => b.addEventListener('click', () => on.events(b.dataset.eventsWindow)));
  el.querySelectorAll('button[data-style]').forEach((b) => b.addEventListener('click', () => on.base('style', b.dataset.style)));
  el.querySelectorAll('input[data-base]').forEach((i) => i.addEventListener('change', () => on.base(i.dataset.base, i.checked)));
  el.querySelectorAll('button[data-year]').forEach((b) => b.addEventListener('click', () => on.year(Number(b.dataset.year))));
  const ind = el.querySelector('#indicator');
  if (ind) ind.addEventListener('change', () => on.surface(ind.value));
  el.querySelector('#language').addEventListener('change', (e) => on.base('lang', e.target.value));
}
