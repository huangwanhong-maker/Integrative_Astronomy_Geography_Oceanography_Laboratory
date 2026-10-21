// Celestial Atlas: data loading, the clock, the four views and the interface.

import * as THREE from 'three';
import { SPK } from './core/spk.js';
import { scalesFromUnixMs, unixMsFromJdTDB, formatUtc, J2000, DAY } from './core/time.js';
import { DEG, AU_KM, ICRS_TO_ECLIPTIC, ICRS_TO_GALACTIC, apply, sub, norm, toSpherical } from './core/frames.js';
import { BODIES, BY_KEY, PLANETS, orbitalMu } from './core/bodies.js';
import { snapshot } from './core/sky.js';
import { osculating } from './core/kepler.js';
import { loadStars, loadConstellations } from './data/catalog.js';
import { SolarSystemView } from './views/solar-system.js';
import { NeighbourhoodView, LY_PER_PC, absoluteMagnitude } from './views/neighbourhood.js';
import { SkyChartView } from './views/sky-chart.js';
import { OrbitDiagramView } from './views/orbit-diagram.js';

const DATA = 'data';
const STORAGE_KEY = 'celestial-atlas/v1';

const SPEEDS = [
  [1, 'real time'], [60, '1 minute per second'], [3600, '1 hour per second'],
  [86400, '1 day per second'], [604800, '1 week per second'],
  [2629800, '1 month per second'], [31557600, '1 year per second'],
];
const RATES = [...SPEEDS.slice().reverse().map(([s, l]) => [-s, `${l}, backwards`]), ...SPEEDS];
const REAL_TIME = SPEEDS.length;
const SIZE_STEPS = [1, 10, 50, 100, 300, 600, 1500, 3000];
const RADIUS_STEPS = [5, 10, 15, 20, 30, 50, 75, 100];
const PLACES = [
  { name: 'Tokyo', lat: 35.6812, lon: 139.7671, height: 0.04 },
  { name: 'Beijing', lat: 39.9042, lon: 116.4074, height: 0.05 },
  { name: 'Greenwich', lat: 51.4769, lon: -0.0005, height: 0.05 },
  { name: 'Mauna Kea', lat: 19.8207, lon: -155.4681, height: 4.2 },
  { name: 'Cerro Paranal', lat: -24.6272, lon: -70.4042, height: 2.64 },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093, height: 0.03 },
];
const VIEW_NAMES = { solar: 'Solar System', near: 'Neighbourhood', sky: 'Sky Chart', orbits: 'Orbits' };

const $ = (selector) => document.querySelector(selector);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// ---- persistence (a per-viewer convenience; the page works without it) ----

function readSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      view: state.view, place: state.place, options: state.options,
    }));
  } catch { /* storage unavailable */ }
}

const saved = readSaved();
const state = {
  view: VIEW_NAMES[saved.view] ? saved.view : 'solar',
  ms: Date.now(),
  live: true,
  paused: false,
  rate: REAL_TIME,
  place: saved.place || PLACES[0],
  selection: {
    solar: { kind: 'body', key: 'earth' },
    near: { kind: 'star', index: null },
    sky: { kind: 'body', key: 'moon' },
    orbits: { kind: 'body', key: 'mars' },
  },
  options: {
    solar: { size: 5, orbits: true, labels: true, stars: true, constellations: false, grid: true },
    near: { radius: 3, labels: true, grid: true },
    sky: { magLimit: 5.5, lines: true, names: true, nameLang: 'la', ecliptic: true, grid: true,
      refraction: true, starNames: true },
    orbits: { range: 'inner', sightLines: true },
  },
};
for (const view of Object.keys(state.options)) Object.assign(state.options[view], saved.options?.[view]);

const observer = () => ({
  name: state.place.name, lat: state.place.lat * DEG, lon: state.place.lon * DEG, height: state.place.height || 0,
});

// ---- formatting --------------------------------------------------------------

const pad = (n) => String(n).padStart(2, '0');
const signed = (x, digits) => `${x < 0 ? '−' : ''}${Math.abs(x).toFixed(digits)}`;

function formatRA(rad) {
  const total = Math.round(((rad / DEG / 15 + 24) % 24) * 36000);   // tenths of a second
  const h = Math.floor(total / 36000), m = Math.floor((total % 36000) / 600), s = (total % 600) / 10;
  return `${h}h ${pad(m)}m ${s.toFixed(1).padStart(4, '0')}s`;
}

function formatDec(rad) {
  const total = Math.round(Math.abs(rad / DEG) * 3600);
  const d = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return `${rad < 0 ? '−' : '+'}${d}° ${pad(m)}′ ${pad(s)}″`;
}

function formatDistance(km) {
  const au = km / AU_KM;
  if (au < 0.01) return `${Math.round(km).toLocaleString('en')} km`;
  return `${au.toFixed(au < 10 ? 4 : 3)} AU`;
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
  if (seconds < 86400 * 2) return `${Math.floor(seconds / 3600)} h ${Math.round((seconds % 3600) / 60)} min`;
  const days = seconds / 86400;
  return days < 800 ? `${days.toFixed(2)} days` : `${(days / 365.25).toFixed(2)} years`;
}

function compass(azDeg) {
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return points[Math.round(azDeg / 22.5) % 16];
}

function eclipticLongitude(v) {
  return toSpherical(apply(ICRS_TO_ECLIPTIC, v)).lon;
}

// ---- information shown in the panel -----------------------------------------

function bodyInfo(snap, key) {
  const b = BY_KEY[key];
  const e = snap.bodies[key];
  const rows = [];
  if (key !== 'earth') {
    rows.push(['Distance from Earth', formatDistance(e.distKm)]);
    rows.push(['Light-time', formatDuration(e.lightTime)]);
  }
  if (key !== 'sun') rows.push(['Distance from Sun', formatDistance(norm(e.helio.p))]);
  if (key !== 'earth') {
    rows.push(['Right ascension', formatRA(e.ra)]);
    rows.push(['Declination', formatDec(e.dec)]);
    const alt = e.altApparent / DEG, az = e.az / DEG;
    rows.push(['Altitude', `${signed(alt, 1)}°${alt < 0 ? ' · below horizon' : ''}`]);
    rows.push(['Azimuth', `${az.toFixed(1)}° ${compass(az)}`]);
  }
  if (key !== 'sun' && key !== 'earth') {
    let d = (eclipticLongitude(e.geo) - eclipticLongitude(snap.bodies.sun.geo)) / DEG;
    d = ((d + 540) % 360) - 180;
    rows.push(['Elongation', `${(e.elongation / DEG).toFixed(1)}° ${d >= 0 ? 'E · evening' : 'W · morning'}`]);
    rows.push(['Illuminated', `${Math.round(e.illuminated * 100)} %`]);
  }
  if (key !== 'sun') {
    let state6;
    if (key === 'earth') state6 = snap.emb;
    else if (b.parent) {
      const p = snap.bodies[b.parent].ssb;
      state6 = { p: sub(e.ssb.p, p.p), v: sub(e.ssb.v, p.v) };
    } else state6 = e.helio;
    const o = osculating(state6.p, state6.v, orbitalMu(b));
    rows.push(['Semi-major axis', formatDistance(o.a)]);
    rows.push(['Eccentricity', o.e.toFixed(4)]);
    rows.push(['Orbital period', formatDuration(o.period)]);
  }
  const kind = key === 'sun' ? 'Star' : key === 'moon' ? 'Natural satellite of the Earth'
    : key === 'pluto' ? 'Dwarf planet' : 'Planet';
  return { title: b.name, subtitle: kind, rows };
}

function starInfo(stars, i) {
  const rows = [];
  const dist = stars.dist[i];
  if (Number.isFinite(dist)) {
    rows.push(['Distance', `${dist.toFixed(2)} pc · ${(dist * LY_PER_PC).toFixed(1)} ly`]);
  }
  rows.push(['Apparent magnitude', signed(stars.mag[i], 2)]);
  if (Number.isFinite(dist)) rows.push(['Absolute magnitude', signed(absoluteMagnitude(stars.mag[i], dist), 2)]);
  if (stars.spectrum(i)) rows.push(['Spectral type', stars.spectrum(i)]);
  if (Number.isFinite(stars.ci[i])) rows.push(['B − V', signed(stars.ci[i], 2)]);
  const u = [stars.unit[3 * i], stars.unit[3 * i + 1], stars.unit[3 * i + 2]];
  const eq = toSpherical(u);
  rows.push(['Right ascension (J2000)', formatRA(eq.lon)]);
  rows.push(['Declination (J2000)', formatDec(eq.lat)]);
  const g = toSpherical(apply(ICRS_TO_GALACTIC, u));
  rows.push(['Galactic l, b', `${(g.lon / DEG).toFixed(1)}°, ${(g.lat / DEG).toFixed(1)}°`]);
  return {
    title: stars.label(i) || 'Unnamed star',
    subtitle: stars.name(i) && stars.designation(i) ? stars.designation(i) : 'Star',
    rows,
  };
}

function renderInfo(info) {
  const html = info
    ? `<h2>${esc(info.title)}</h2><p class="sub">${esc(info.subtitle)}</p>`
      + `<dl>${info.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`
    : '<p class="hint">Select a star to see its details.</p>';
  const target = $('#info');
  if (target.dataset.html !== html) {
    target.innerHTML = html;
    target.dataset.html = html;
  }
}

// ---- application --------------------------------------------------------------

async function main() {
  const progress = $('#loading-bar');
  const [spk, stars, constellations] = await Promise.all([
    SPK.fromUrl(`${DATA}/jpl-de440s/de440s.bsp`, (p) => { progress.style.width = `${(p * 100).toFixed(1)}%`; }),
    loadStars(DATA),
    loadConstellations(DATA),
  ]);
  const minMs = unixMsFromJdTDB(J2000 + spk.coverage.startEt / DAY) + 2 * 86400000;
  const maxMs = unixMsFromJdTDB(J2000 + spk.coverage.endEt / DAY) - 2 * 86400000;

  const stage = $('#stage');
  const renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x150c13, 1);

  const views = {
    solar: new SolarSystemView({ renderer, container: stage, stars, constellations,
      onSelect: (key, how) => selectBody(key, how) }),
    near: new NeighbourhoodView({ renderer, container: stage, stars, onSelect: (i) => selectStar(i) }),
    sky: new SkyChartView({ canvas: $('#chart'), stars, constellations }),
    orbits: new OrbitDiagramView({ canvas: $('#chart') }),
  };
  const is3d = (v) => v === 'solar' || v === 'near';
  let dirty = true;
  let lastDrawnMs = 0;
  let snap = null;

  function applyOptions() {
    const o = state.options;
    views.solar.setOptions({ sizeScale: SIZE_STEPS[o.solar.size], orbits: o.solar.orbits, labels: o.solar.labels,
      stars: o.solar.stars, constellations: o.solar.constellations, grid: o.solar.grid });
    if (views.near.radius !== RADIUS_STEPS[o.near.radius]) views.near.setRadius(RADIUS_STEPS[o.near.radius]);
    views.near.setOptions({ labels: o.near.labels, grid: o.near.grid });
    views.sky.setOptions(o.sky);
    views.orbits.setOptions(o.orbits);
    dirty = true;
  }

  function selectBody(key, { focus = false } = {}) {
    state.selection[state.view] = { kind: 'body', key };
    if (state.view === 'solar') {
      views.solar.select(key);
      if (focus) views.solar.focus(key);
    }
    if (state.view === 'sky') views.sky.selectedKey = key;
    if (state.view === 'orbits') views.orbits.selectedKey = key;
    dirty = true;
    updatePanel(true);
  }

  function selectStar(index) {
    state.selection[state.view] = { kind: 'star', index };
    if (state.view === 'near') views.near.select(index);
    updatePanel(true);
  }

  // ---- views and options ----

  function showView(view) {
    state.view = view;
    for (const button of document.querySelectorAll('[data-view]')) {
      button.setAttribute('aria-selected', String(button.dataset.view === view));
    }
    $('#gl').hidden = !is3d(view);
    $('#chart').hidden = is3d(view);
    views.solar.setActive(view === 'solar');
    views.near.setActive(view === 'near');
    const sel = state.selection[view];
    if (view === 'solar') { views.solar.select(sel.key); }
    if (view === 'sky') views.sky.selectedKey = sel.key;
    if (view === 'orbits') views.orbits.selectedKey = sel.key;
    if (view === 'near') views.near.select(sel.index);
    renderOptions();
    resize();
    dirty = true;
    updatePanel(true);
    save();
  }

  function check(view, key, label) {
    return `<label class="check"><input type="checkbox" data-view-option="${view}" data-key="${key}"`
      + `${state.options[view][key] ? ' checked' : ''}><span>${label}</span></label>`;
  }

  function renderOptions() {
    const v = state.view, o = state.options[v];
    let html = '';
    if (v === 'solar') {
      html = `<h3>Display</h3>
        <label class="range"><span>Body size</span>
          <input type="range" min="0" max="${SIZE_STEPS.length - 1}" step="1" value="${o.size}" data-view-option="solar" data-key="size"></label>
        <p class="legend" id="legend"></p>
        ${check('solar', 'orbits', 'Orbits')}${check('solar', 'labels', 'Names')}
        ${check('solar', 'grid', 'Distance rings')}${check('solar', 'stars', 'Stars')}
        ${check('solar', 'constellations', 'Constellation figures')}
        <h3>Go to</h3>
        <div class="chips">${BODIES.map((b) => `<button type="button" data-focus="${b.key}">`
          + `<span class="dot" style="background:${b.colour}"></span>${b.name}</button>`).join('')}</div>`;
    } else if (v === 'near') {
      html = `<h3>Display</h3>
        <label class="range"><span>Radius</span>
          <input type="range" min="0" max="${RADIUS_STEPS.length - 1}" step="1" value="${o.radius}" data-view-option="near" data-key="radius"></label>
        <p class="legend" id="legend"></p>
        ${check('near', 'labels', 'Names')}${check('near', 'grid', 'Rings and axes')}`;
    } else if (v === 'sky') {
      const custom = !PLACES.some((p) => p.name === state.place.name);
      html = `<h3>Observer</h3>
        <select id="place">${PLACES.map((p) => `<option${p.name === state.place.name ? ' selected' : ''}>${p.name}</option>`).join('')}
          <option value="custom"${custom ? ' selected' : ''}>${custom ? esc(state.place.name) : 'Custom'}</option></select>
        <div class="coords">
          <label><span>Latitude</span><input id="lat" type="number" step="0.0001" min="-90" max="90" value="${state.place.lat}"></label>
          <label><span>Longitude</span><input id="lon" type="number" step="0.0001" min="-180" max="180" value="${state.place.lon}"></label>
        </div>
        <button type="button" class="link" id="locate">Use my location</button>
        <h3>Display</h3>
        <label class="range"><span>Faintest stars</span>
          <input type="range" min="3" max="7" step="0.5" value="${o.magLimit}" data-view-option="sky" data-key="magLimit"></label>
        <p class="legend" id="legend"></p>
        ${check('sky', 'lines', 'Constellation figures')}${check('sky', 'names', 'Constellation names')}
        <label class="select"><span>Names in</span><select data-view-option="sky" data-key="nameLang">
          ${[['la', 'Latin'], ['en', 'English'], ['zh', '中文'], ['ja', '日本語']].map(([k, l]) =>
            `<option value="${k}"${o.nameLang === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        ${check('sky', 'starNames', 'Bright star names')}${check('sky', 'ecliptic', 'Ecliptic')}
        ${check('sky', 'grid', 'Altitude grid')}${check('sky', 'refraction', 'Refraction')}`;
    } else {
      html = `<h3>Range</h3>
        <div class="segmented">
          <button type="button" data-range="inner" aria-pressed="${o.range === 'inner'}">Inner planets</button>
          <button type="button" data-range="all" aria-pressed="${o.range === 'all'}">All planets</button>
        </div>
        ${check('orbits', 'sightLines', 'Lines of sight from the Earth')}
        <h3>Configuration</h3><table class="config" id="config"></table>`;
    }
    $('#options').innerHTML = html;
    updateLegend();
  }

  function updateLegend() {
    const el = $('#legend');
    if (!el) return;
    if (state.view === 'solar') el.textContent = views.solar.legend();
    if (state.view === 'near') el.textContent = views.near.legend();
    if (state.view === 'sky') el.textContent = `Stars to magnitude ${state.options.sky.magLimit}`;
  }

  $('#options').addEventListener('input', (event) => {
    const t = event.target;
    if (!t.dataset.viewOption) return;
    const value = t.type === 'checkbox' ? t.checked : t.type === 'range' ? Number(t.value) : t.value;
    state.options[t.dataset.viewOption][t.dataset.key] = value;
    applyOptions();
    updateLegend();
    save();
  });

  $('#options').addEventListener('click', (event) => {
    const focus = event.target.closest('[data-focus]');
    if (focus) selectBody(focus.dataset.focus, { focus: true });
    const range = event.target.closest('[data-range]');
    if (range) {
      state.options.orbits.range = range.dataset.range;
      applyOptions();
      renderOptions();
      save();
    }
    if (event.target.id === 'locate' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        state.place = { name: 'My location', lat: +pos.coords.latitude.toFixed(4),
          lon: +pos.coords.longitude.toFixed(4), height: (pos.coords.altitude || 0) / 1000 };
        renderOptions(); dirty = true; save();
      }, () => toast('Location is not available.'));
    }
  });

  $('#options').addEventListener('change', (event) => {
    const t = event.target;
    if (t.id === 'place' && t.value !== 'custom') {
      state.place = { ...PLACES.find((p) => p.name === t.value) };
      renderOptions();
    } else if (t.id === 'lat' || t.id === 'lon') {
      const lat = clamp(Number($('#lat').value), -90, 90), lon = clamp(Number($('#lon').value), -180, 180);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        state.place = { name: 'Custom', lat, lon, height: 0 };
        renderOptions();
      }
    } else return;
    dirty = true;
    save();
  });

  for (const button of document.querySelectorAll('[data-view]')) {
    button.addEventListener('click', () => showView(button.dataset.view));
  }

  // ---- pointer interaction ----

  let down = null;
  $('#gl').addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  $('#gl').addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const rect = $('#gl').getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1);
    if (state.view === 'solar') {
      const key = views.solar.pick(ndc);
      if (key) selectBody(key);
    } else {
      const index = views.near.pick(ndc);
      if (index != null) selectStar(index);
    }
  });

  const chart = $('#chart');
  const chartPoint = (e) => {
    const rect = chart.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };
  const hitId = (hit) => (hit ? `${hit.kind}:${hit.key ?? hit.index}` : '');
  chart.addEventListener('pointermove', (e) => {
    const view = views[state.view];
    const hit = view.hitTest(...chartPoint(e));
    if (hitId(hit) !== hitId(view.hover)) {
      view.hover = hit;
      chart.style.cursor = hit ? 'pointer' : 'default';
      dirty = true;
    }
  });
  chart.addEventListener('pointerleave', () => { views[state.view].hover = null; dirty = true; });
  chart.addEventListener('click', (e) => {
    const hit = views[state.view].hitTest(...chartPoint(e));
    if (!hit) return;
    if (hit.kind === 'body') selectBody(hit.key);
    else selectStar(hit.index);
  });

  // ---- clock ----

  function running() { return state.live || !state.paused; }

  function setRate(index) {
    state.rate = clamp(index, 0, RATES.length - 1);
    state.live = false;
    state.paused = false;
    updateTimebar(true);
  }

  $('#now').addEventListener('click', () => {
    state.live = true; state.paused = false; state.rate = REAL_TIME;
    updateTimebar(true);
  });
  $('#toggle').addEventListener('click', () => {
    if (running()) { state.live = false; state.paused = true; } else state.paused = false;
    updateTimebar(true);
  });
  $('#faster').addEventListener('click', () => setRate(state.rate + 1));
  $('#slower').addEventListener('click', () => setRate(state.rate - 1));
  $('#date').addEventListener('change', (e) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(e.target.value);
    if (!m) return;
    const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
    state.ms = clamp(ms, minMs, maxMs);
    state.live = false;
    state.paused = true;
    dirty = true;
    updateTimebar(true);
  });
  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea')) return;
    if (e.key === ' ') { e.preventDefault(); $('#toggle').click(); }
    if (e.key === 'n') $('#now').click();
    if (e.key === ']') $('#faster').click();
    if (e.key === '[') $('#slower').click();
  });

  let lastClock = '';
  function updateTimebar(force = false) {
    const utc = `${formatUtc(state.ms)} UTC`;
    if (!force && utc === lastClock) return;
    lastClock = utc;
    $('#time-utc').textContent = utc;
    $('#time-local').textContent = new Date(state.ms).toLocaleString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
    });
    $('#rate').textContent = state.live ? 'live' : state.paused ? 'paused' : RATES[state.rate][1];
    $('#rate').classList.toggle('live', state.live);
    $('#toggle').innerHTML = running()
      ? '<svg viewBox="0 0 24 24"><path d="M6.5 5h3.6v14H6.5zM13.9 5h3.6v14h-3.6z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M7 4.8v14.4L19 12z"/></svg>';
    $('#toggle').setAttribute('aria-label', running() ? 'Pause' : 'Play');
    const input = $('#date');
    if (document.activeElement !== input) input.value = new Date(state.ms).toISOString().slice(0, 19);
  }

  let lastPanel = 0;
  function updatePanel(force = false) {
    const now = performance.now();
    if (!snap || (!force && now - lastPanel < 250)) return;
    lastPanel = now;
    const sel = state.selection[state.view];
    renderInfo(sel.kind === 'body' ? bodyInfo(snap, sel.key) : sel.index != null ? starInfo(stars, sel.index) : null);
    if (state.view === 'orbits') renderConfiguration();
  }

  function renderConfiguration() {
    const table = $('#config');
    if (!table) return;
    const sunLon = eclipticLongitude(snap.bodies.sun.geo);
    const rows = PLANETS.filter((b) => b.key !== 'earth').map((b) => {
      const e = snap.bodies[b.key];
      let d = (eclipticLongitude(e.geo) - sunLon) / DEG;
      d = ((d + 540) % 360) - 180;
      return `<tr><th><span class="dot" style="background:${b.colour}"></span>${b.name}</th>`
        + `<td>${(norm(e.helio.p) / AU_KM).toFixed(2)}</td><td>${(e.distKm / AU_KM).toFixed(2)}</td>`
        + `<td>${Math.abs(d).toFixed(0)}° ${d >= 0 ? 'E' : 'W'}</td></tr>`;
    }).join('');
    const html = '<thead><tr><th></th><th>Sun, AU</th><th>Earth, AU</th><th>Elong.</th></tr></thead>'
      + `<tbody>${rows}</tbody>`;
    if (table.dataset.html !== html) { table.innerHTML = html; table.dataset.html = html; }
  }

  let toastTimer = 0;
  function toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
  }

  // ---- layout ----

  function resize() {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    views.solar.resize(width, height);
    views.near.resize(width, height);
    views.sky.resize(width, height);
    views.orbits.resize(width, height);
    dirty = true;
  }
  new ResizeObserver(resize).observe(stage);

  // ---- frame loop ----

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (state.live) state.ms = Date.now();
    else if (!state.paused) state.ms += RATES[state.rate][0] * dt * 1000;
    if (state.ms < minMs || state.ms > maxMs) {
      state.ms = clamp(state.ms, minMs, maxMs);
      state.live = false;
      state.paused = true;
      toast('The DE440 ephemeris covers 1849-12-26 to 2150-01-22.');
      updateTimebar(true);
    }
    snap = snapshot(spk, scalesFromUnixMs(state.ms), observer());
    const view = views[state.view];
    if (is3d(state.view)) {
      view.update(snap, dt);
      view.render();
    } else {
      const animating = !state.live && !state.paused;
      if (dirty || animating || Math.abs(state.ms - lastDrawnMs) >= 1000) {
        view.draw(snap);
        lastDrawnMs = state.ms;
        dirty = false;
      }
    }
    updateTimebar();
    updatePanel();
    requestAnimationFrame(frame);
  }

  applyOptions();
  showView(state.view);
  $('#loading').hidden = true;
  requestAnimationFrame(frame);
}

main().catch((error) => {
  console.error(error);
  $('#loading-text').innerHTML = `<strong>The atlas could not start.</strong><br>${esc(error.message)}<br><br>`
    + 'Fetch the data from the repository root with<br>'
    + '<code>python data/acquisition/fetch.py</code><br><code>python data/products/star_catalog.py</code>';
  $('#loading').classList.add('failed');
});
