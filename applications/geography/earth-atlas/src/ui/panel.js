// The layer panel: what is drawn on the surface and by which model, what
// moves, which lines and events are shown, the laboratory's own model, and how
// the base map looks.

import { cssGradient } from '../render/colormaps.js';
import { DOMAINS, byKey } from '../layers/catalogue.js';

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

// Buttons choosing one model among the definitions of a key.
function models(kind, defs, current) {
  if (defs.length < 2) return '';
  return `<div class="models" role="group" aria-label="Model">${defs.map((d) =>
    `<button type="button" data-model="${kind}" data-id="${esc(d.id)}" aria-pressed="${d.id === current}">${esc(d.model)}</button>`).join('')}</div>`;
}

// A list of keyed choices: one radio per key; the models of the chosen key below it.
function keyed(kind, groups, selected, { swatches = false, compare = null } = {}) {
  const html = [];
  for (const [key, defs] of groups) {
    const active = defs.find((d) => d.id === selected);
    const def = active || defs[0];
    html.push(choice(kind, def.id, def.label, Boolean(active), swatches ? swatchOf(def) : null));
    if (active && defs.length > 1) {
      html.push(models(kind, defs, active.id));
      if (compare) {
        const options = [`<option value="">—</option>`, ...defs.filter((d) => d.id !== active.id)
          .map((d) => `<option value="${esc(d.id)}"${d.id === compare.id ? ' selected' : ''}>${esc(d.model)}</option>`)];
        html.push(`<label class="compare"><span>minus</span><select data-compare aria-label="Compare with">${options.join('')}</select></label>`);
      }
    }
  }
  return html.join('');
}

export function buildPanel(el, catalogue, state, years, extra, on) {
  const html = [];
  // ---- surface ----
  html.push('<h3 style="margin-top:6px;border-top:0;padding-top:0">Surface</h3>');
  const fields = catalogue.surfaces.filter((s) => s.kind === 'field');
  const indicators = catalogue.surfaces.filter((s) => s.kind === 'indicator');
  const compare = catalogue.surfaces.find((s) => s.id === state.compare) || null;
  const byDomain = new Map();
  for (const s of fields) {
    if (!byDomain.has(s.domain)) byDomain.set(s.domain, []);
    byDomain.get(s.domain).push(s);
  }
  for (const [domain, list] of byDomain) {
    html.push(`<div class="group-name">${esc(DOMAINS[domain] || domain)}</div>`);
    html.push(keyed('surface', byKey(list), state.surface, { swatches: true, compare: compare || {} }));
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
  html.push(keyed('flow', byKey(catalogue.flows), state.flow));
  if (catalogue.lines.length) {
    html.push('<h3>Lines</h3>');
    html.push(choice('lines', 'none', 'None', state.lines === 'none'));
    html.push(keyed('lines', byKey(catalogue.lines), state.lines));
  }
  if (catalogue.events.length) {
    html.push('<h3>Events</h3>');
    const kinds = new Map();
    for (const e of catalogue.events) {
      if (!kinds.has(e.kind)) kinds.set(e.kind, []);
      kinds.get(e.kind).push(e);
    }
    for (const [kind, list] of kinds) {
      const checked = list.some((e) => e.id === state.events);
      const label = kind === 'earthquake' ? 'Earthquakes' : kind;
      html.push(`<label class="check"><input type="checkbox" data-events="${esc(list[0].id)}"${checked ? ' checked' : ''}> ${esc(label)}</label>`);
      if (list.length > 1) {
        const span = (e) => {
          const days = (Date.parse(e.window.end) - Date.parse(e.window.start)) / 86400000;
          return days > 300 ? 'past year' : days > 20 ? 'past month' : days > 5 ? 'past week' : 'past day';
        };
        html.push(`<div class="segmented" style="margin-left:26px">${list.map((e) => `<button type="button" data-events-window="${esc(e.id)}" aria-pressed="${e.id === state.events}">${span(e)}</button>`).join('')}</div>`);
      }
    }
  }

  // ---- the laboratory's model ----
  if (extra.lab) {
    const lab = extra.lab;
    html.push('<h3>Laboratory model</h3>');
    html.push(`<div class="lab"><p>Barotropic vorticity at 500 hPa, spectral T42, from ${esc(lab.input)}.</p>`);
    if (lab.running) {
      html.push(`<div class="progress lab-progress"><span style="width:${Math.round(lab.progress * 100)}%"></span></div>`);
    } else {
      html.push('<button type="button" class="run" data-run-lab>Run from the time shown</button>');
    }
    if (lab.verification && lab.verification.length) {
      html.push(`<table class="verify"><thead><tr><th>Lead</th><th>Model</th><th>Persistence</th></tr></thead><tbody>${lab.verification
        .filter((r) => r.hours % 24 === 0)
        .map((r) => `<tr><th>+${r.hours} h</th><td>${Math.round(r.model)} m</td><td>${Math.round(r.persistence)} m</td></tr>`).join('')}</tbody></table>`);
      html.push(`<p class="note">Root-mean-square error of height, 20–80° N, against ${esc(lab.against)}${lab.verification.some((r) => r.against === 'forecast') ? ' (its forecast, beyond the present)' : ' analyses'}.</p>`);
    }
    if (lab.error) html.push(`<p class="note">${esc(lab.error)}</p>`);
    html.push('</div>');
  }

  // ---- map ----
  html.push('<h3>Map</h3>');
  const styles = [['relief', 'Relief'], ...extra.imagery.map((e) => [e.name, e.name === 'true-colour' ? `Satellite, ${e.date ? e.date.slice(5).replace('-', '/') : 'day'}` : e.name === 'blue-marble' ? 'Blue Marble' : e.title]), ['plain', 'Plain']];
  html.push(`<div class="segmented wrap">${styles.map(([s, label]) => `<button type="button" data-style="${esc(s)}" aria-pressed="${state.style === s}">${esc(label)}</button>`).join('')}</div>`);
  const checks = [['night', 'Day and night'], ...(extra.lights ? [['lights', 'Lights at night']] : []), ...(extra.clouds ? [['clouds', 'Forecast clouds']] : []),
    ['coast', 'Coastlines'], ['borders', 'Borders'], ['rivers', 'Rivers'], ['graticule', 'Graticule'], ['labels', 'Names'], ['reliefOnData', 'Relief on data']];
  html.push(`<div class="checks">${checks.map(([k, l]) => `<label class="check"><input type="checkbox" data-base="${k}"${state[k] ? ' checked' : ''}> ${l}</label>`).join('')}</div>`);
  html.push(`<label class="select"><span>Names in</span><select id="language">${LANGUAGES.map(([c, n]) => `<option value="${c}"${c === state.lang ? ' selected' : ''}>${n}</option>`).join('')}</select></label>`);
  el.innerHTML = html.join('');

  el.querySelectorAll('input[name="surface"]').forEach((i) => i.addEventListener('change', () => on.surface(i.value)));
  el.querySelectorAll('input[name="flow"]').forEach((i) => i.addEventListener('change', () => on.flow(i.value)));
  el.querySelectorAll('input[name="lines"]').forEach((i) => i.addEventListener('change', () => on.lines(i.value)));
  el.querySelectorAll('button[data-model]').forEach((b) => b.addEventListener('click', () => on[b.dataset.model](b.dataset.id)));
  const cmp = el.querySelector('select[data-compare]');
  if (cmp) cmp.addEventListener('change', () => on.compare(cmp.value || null));
  el.querySelectorAll('input[data-events]').forEach((i) => i.addEventListener('change', () => on.events(i.checked ? i.dataset.events : null)));
  el.querySelectorAll('button[data-events-window]').forEach((b) => b.addEventListener('click', () => on.events(b.dataset.eventsWindow)));
  el.querySelectorAll('button[data-style]').forEach((b) => b.addEventListener('click', () => on.base('style', b.dataset.style)));
  el.querySelectorAll('input[data-base]').forEach((i) => i.addEventListener('change', () => on.base(i.dataset.base, i.checked)));
  el.querySelectorAll('button[data-year]').forEach((b) => b.addEventListener('click', () => on.year(Number(b.dataset.year))));
  const run = el.querySelector('[data-run-lab]');
  if (run) run.addEventListener('click', () => on.runLab());
  const ind = el.querySelector('#indicator');
  if (ind) ind.addEventListener('change', () => on.surface(ind.value));
  el.querySelector('#language').addEventListener('change', (e) => on.base('lang', e.target.value));
}
