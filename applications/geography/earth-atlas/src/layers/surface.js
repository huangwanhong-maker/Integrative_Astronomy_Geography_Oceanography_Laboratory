// The surface layer: one quantity over the whole surface, as a field or as a
// value per country, coloured by a colour map.

import { lookupTable, colourAt, cssGradient } from '../render/colormaps.js';
import { FieldTextures, setField, setLut, setCountryColours } from '../render/surface.js';
import { displayUnit, toShown, toStored } from '../core/units.js';
import { joinCountries, valueForYear, latestWellCoveredYear } from '../core/join.js';

// Rounded ends for an automatic range.
function niceRange(lo, hi) {
  const span = hi - lo || Math.abs(hi) || 1;
  const step = 10 ** Math.floor(Math.log10(span / 5));
  return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step];
}

function percentile(sorted, p) {
  if (!sorted.length) return NaN;
  const x = (sorted.length - 1) * p, i = Math.floor(x);
  return sorted[i] + (sorted[Math.min(i + 1, sorted.length - 1)] - sorted[i]) * (x - i);
}

// Ticks for a legend: about n values, nicely rounded, within [lo, hi].
export function ticks(lo, hi, scale = 'linear', n = 5) {
  if (scale === 'log' && lo > 0) {
    const out = [];
    for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) {
      for (const m of [1, 2, 5]) {
        const v = m * 10 ** e;
        if (v >= lo * 0.999 && v <= hi * 1.001) out.push(v);
      }
    }
    const decade = (v) => Math.abs(Math.log10(v) - Math.round(Math.log10(v))) < 1e-9;
    return out.length > 7 ? out.filter(decade) : out;
  }
  const raw = (hi - lo) / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}

export function position(v, lo, hi, scale) {
  if (scale === 'log') return (Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
  if (scale === 'sqrt') return (Math.sqrt(Math.max(0, v)) - Math.sqrt(Math.max(0, lo))) / (Math.sqrt(hi) - Math.sqrt(Math.max(0, lo)));
  return (v - lo) / (hi - lo);
}

export class SurfaceLayer {
  constructor(stage, library, countries) {
    this.stage = stage;
    this.library = library;
    this.countries = countries;        // the geography product's countries
    this.textures = new FieldTextures();
    this.def = null;
    this.product = null;
    this.info = null;
  }

  async select(def) {
    this.def = def;
    this.product = null;
    const u = this.stage.material.uniforms;
    if (!def) { u.uMode.value = 0; return; }
    if (def.kind === 'field') {
      const product = await this.library.field(def.product);
      if (this.def !== def) return;
      this.product = product;
      this.unit = displayUnit(def.units);
      const st = def.style;
      let range = st.range;
      if (!range) range = niceRange(toShown(st.auto[0], this.unit), toShown(st.auto[1], this.unit));
      if (def.percent) this.unit = { unit: '%', a: 100, b: 0 };
      this.range = def.percent ? [range[0] * 100, range[1] * 100] : range;
      this.scale = st.scale || 'linear';
      setLut(this.stage.material, lookupTable(st.colormap, { reverse: st.reverse, clip: st.clip, fade: st.fade }));
      const stored = this.range.map((x) => toStored(x, this.unit));
      u.uRange.value.set(Math.min(...stored), Math.max(...stored), this.scale === 'log' ? 1 : this.scale === 'sqrt' ? 2 : 0);
    } else {
      const product = await this.library.indicator(def.product);
      if (this.def !== def) return;
      this.product = product;
      this.join = joinCountries(this.countries, product.economies);
      this.unit = { unit: def.units || '', a: 1, b: 0 };
      // One range for all years, so that years can be compared.
      const all = [];
      for (const e of Object.values(product.economies)) for (const v of e.values) if (v !== null) all.push(v);
      all.sort((a, b) => a - b);
      const lo = percentile(all, 0.02), hi = percentile(all, 0.98);
      this.scale = lo > 0 && hi / lo > 30 ? 'log' : 'linear';
      this.range = this.scale === 'log'
        ? [10 ** Math.floor(Math.log10(lo)), 10 ** Math.ceil(Math.log10(hi))]
        : niceRange(lo, hi);
      if (/^%/.test(def.units || '')) this.range = [Math.max(0, this.range[0]), Math.min(100, this.range[1])];
      this.defaultYear = latestWellCoveredYear(product.economies, product.years);
      this.year = this.year && product.years.includes(this.year) ? this.year : this.defaultYear;
      this.paintCountries();
    }
  }

  paintCountries() {
    const p = this.product, st = this.def.style;
    const colours = new Uint8Array(4 * (this.countries.length + 1));
    this.values = new Array(this.countries.length).fill(null);
    this.countries.forEach((c, i) => {
      const code = this.join.codes[i];
      const r = code && valueForYear(p.economies[code], p.years, this.year, 4);
      const k = 4 * (i + 1);
      if (!r) {
        colours.set([96, 84, 104, code ? 150 : 90], k);       // no value: a quiet grey-plum
        return;
      }
      this.values[i] = { ...r, code, name: p.economies[code].name };
      let t = Math.max(0, Math.min(1, position(r.value, this.range[0], this.range[1], this.scale)));
      t = st.clip[0] + (st.clip[1] - st.clip[0]) * (st.reverse ? 1 - t : t);
      const [cr, cg, cb] = colourAt(st.colormap, t);
      colours.set([cr, cg, cb, 236], k);
    });
    setCountryColours(this.stage.material, colours);
    this.stage.material.uniforms.uMode.value = 3;
  }

  setYear(year) {
    if (!this.def || this.def.kind !== 'indicator') return;
    this.year = year;
    this.paintCountries();
  }

  // Points the GPU at the data for an instant; returns what is shown.
  update(time) {
    if (!this.def || !this.product) return null;
    if (this.def.kind === 'indicator') return { year: this.year };
    const b = this.product.bracket(time, this.def.variables[0]);
    setField(this.stage.material, this.textures, this.product, this.def.variables, b);
    this.shown = b;
    return b;
  }

  // The value at a place (stored units), or NaN.
  sample(lon, lat, time) {
    if (!this.product || !this.def || this.def.kind !== 'field') return NaN;
    const [a, b] = this.def.variables;
    const x = this.product.sample(a, time, lon, lat);
    return b ? Math.hypot(x, this.product.sample(b, time, lon, lat)) : x;
  }

  legend() {
    if (!this.def || !this.product) return null;
    const st = this.def.style;
    return {
      title: this.def.label,
      unit: this.unit.unit,
      gradient: cssGradient(st.colormap, { reverse: st.reverse, clip: st.clip, fade: st.fade }),
      ticks: ticks(this.range[0], this.range[1], this.scale).map((v) => ({ at: position(v, this.range[0], this.range[1], this.scale), value: v })),
      range: this.range,
      scale: this.scale,
    };
  }
}
