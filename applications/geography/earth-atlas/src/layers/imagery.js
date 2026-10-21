// Imagery of the whole Earth (true colour by day, the Blue Marble, lights at
// night), and finer imagery of the part of the Earth in view.
//
// The global images are imagery products of the library. When the view is
// close enough that every pixel of the screen falls on the Earth, the detail
// layer asks the imagery's provider (its `live` service, recorded in the
// product: a WMS) for the region in view, at the screen's resolution, and the
// shader draws it over the global image. The request carries the same layer
// and date as the product, so detail and whole agree.

import { imageTexture, setTexture } from '../render/surface.js';

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

export class ImageryLayer {
  constructor(stage, library) {
    this.stage = stage;
    this.library = library;
    this.textures = new Map();      // product name -> texture
    this.metas = new Map();
    this.style = 'relief';
  }

  entry(role, name) {
    return this.library.list('imagery').find((e) => e.role === role && (!name || e.name === name));
  }

  async texture(entry) {
    if (!this.textures.has(entry.name)) {
      const meta = await (await fetch(`${this.library.base}/${entry.file}`)).json();
      this.metas.set(entry.name, meta);
      const img = await loadImage(`${this.library.base}/${meta.file}`);
      this.textures.set(entry.name, imageTexture(img, this.stage.renderer));
    }
    return this.textures.get(entry.name);
  }

  // style: 'relief' | 'plain' | the name of a day imagery product.
  async setStyle(style) {
    this.style = style;
    const u = this.stage.material.uniforms;
    const entry = this.entry('day', style);
    if (!entry) { u.uImageryOn.value = 0; this.active = null; return; }
    const t = await this.texture(entry);
    if (this.style !== style) return;
    u.uImagery.value = t;
    u.uImageryOn.value = 1;
    this.active = this.metas.get(entry.name);
  }

  async setLights(on) {
    const u = this.stage.material.uniforms;
    const entry = this.entry('night-lights');
    if (!on || !entry) { u.uLightsOn.value = 0; return; }
    u.uLights.value = await this.texture(entry);
    u.uLightsOn.value = 1;
  }

  // Imagery products by day, for the panel.
  dayImagery() { return this.library.list('imagery').filter((e) => e.role === 'day'); }
}

export class DetailLayer {
  constructor(stage) {
    this.stage = stage;
    this.box = null;
    this.pending = null;
    this.timer = 0;
    this.fade = 0;
    this.status = '';
  }

  // The region in view, if all of the screen falls on the Earth: [west, south, width, height] in degrees.
  viewBox() {
    const s = this.stage, pts = [];
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
      const p = s.place((s.width * i) / 8, (s.height * j) / 8);
      if (!p) return null;
      pts.push(p);
    }
    const lon0 = pts[40][0];
    let w = Infinity, e = -Infinity, south = Infinity, north = -Infinity;
    for (const [lon, lat] of pts) {
      const d = ((lon - lon0 + 540) % 360) - 180;
      w = Math.min(w, d); e = Math.max(e, d);
      south = Math.min(south, lat); north = Math.max(north, lat);
    }
    // A margin, so that small movements stay inside the region.
    const mx = (e - w) * 0.15, my = (north - south) * 0.15;
    let west = lon0 + w - mx;
    let width = e - w + 2 * mx;
    south = Math.max(-90, south - my); north = Math.min(90, north + my);
    if (width > 120 || north - south > 80) return null;
    west = ((west + 540) % 360) - 180;
    // The service does not wrap round the antimeridian: keep the larger side.
    if (west + width > 180) {
      if (180 - west >= (west + width - 180)) width = 180 - west;
      else { width = west + width - 180; west = -180; }
    }
    return [west, south, width, north - south];
  }

  // Called when the view settles; asks for detail if the view is close enough.
  request(imagery) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.fetch(imagery), 450);
  }

  async fetch(imagery) {
    const u = this.stage.material.uniforms;
    const box = imagery && imagery.live && imagery.live.kind === 'wms' ? this.viewBox() : null;
    if (!box) { this.target = 0; return; }
    if (this.box && this.box.key === `${imagery.name}` && contains(this.box.extent, box) && this.box.extent[2] < box[2] * 1.8) {
      this.target = 1;
      return;
    }
    const s = this.stage;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = Math.min(4096, Math.round(s.width * dpr * 1.4));
    let height = Math.round((width * box[3]) / box[2]);
    if (height > 4096) { width = Math.round((width * 4096) / height); height = 4096; }
    const [west, south, w, h] = box;
    const live = imagery.live;
    const url = `${live.url}&BBOX=${south.toFixed(5)},${west.toFixed(5)},${(south + h).toFixed(5)},${(west + w).toFixed(5)}`
      + `&WIDTH=${width}&HEIGHT=${height}&FORMAT=${encodeURIComponent(live.format)}${live.time ? `&TIME=${live.time}` : ''}`;
    const ticket = (this.pending = url);
    this.status = 'loading';
    try {
      const img = await loadImage(url);
      if (this.pending !== ticket) return;
      setTexture(this.stage.material, 'uDetail', imageTexture(img, s.renderer, false));
      u.uDetailBox.value.set(west, south, w, h);
      this.box = { key: imagery.name, extent: box };
      this.target = 1;
      this.fade = 0;
      this.status = '';
    } catch {
      this.status = 'failed';
    }
  }

  // Fades the detail in or out; returns true while changing.
  frame() {
    const u = this.stage.material.uniforms;
    const target = this.target || 0;
    const v = u.uDetailOn.value;
    if (Math.abs(v - target) < 0.01) { u.uDetailOn.value = target; return false; }
    u.uDetailOn.value = v + (target - v) * 0.12;
    return true;
  }

  clear() { this.target = 0; this.box = null; }
}

function contains(outer, inner) {
  const [w0, s0, ww, hh] = outer, [w1, s1, w2, h2] = inner;
  const d = ((w1 - w0 + 540) % 360) - 180;
  return d >= 0 && d + w2 <= ww && s1 >= s0 && s1 + h2 <= s0 + hh;
}
