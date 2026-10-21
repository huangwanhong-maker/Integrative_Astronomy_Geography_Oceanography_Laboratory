// Loading of the star catalogue and the constellation figures prepared by data/.
//
// stars-v1 is built by data/products/star_catalog.py from the HYG database
// (CC BY-SA 4.0); constellations come from d3-celestial (BSD 3-Clause).

import { fromSpherical, DEG } from '../core/frames.js';

async function json(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

async function binary(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.arrayBuffer();
}

export async function loadStars(base) {
  const [meta, buffer] = await Promise.all([
    json(`${base}/products/stars-v1.json`),
    binary(`${base}/products/stars-v1.bin`),
  ]);
  const record = new Float32Array(buffer);
  const n = meta.count;
  const stride = meta.fields.length;
  const unit = new Float32Array(3 * n);   // ICRS unit vectors
  const xyz = new Float32Array(3 * n);    // equatorial position, pc (NaN if unknown)
  const mag = new Float32Array(n);
  const ci = new Float32Array(n);
  const dist = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * stride;
    const ra = record[o], dec = record[o + 1];
    const c = Math.cos(dec);
    unit[3 * i] = c * Math.cos(ra);
    unit[3 * i + 1] = c * Math.sin(ra);
    unit[3 * i + 2] = Math.sin(dec);
    mag[i] = record[o + 2];
    ci[i] = record[o + 3];
    dist[i] = record[o + 4];
    xyz[3 * i] = record[o + 5];
    xyz[3 * i + 1] = record[o + 6];
    xyz[3 * i + 2] = record[o + 7];
  }
  const names = new Map(meta.names);
  const designations = new Map(meta.designations);
  const spectra = new Map(meta.spectra);

  // Indices sorted from brightest to faintest, for magnitude-limited drawing.
  const byBrightness = Uint32Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => mag[a] - mag[b]);

  return {
    count: n, unit, xyz, mag, ci, dist, byBrightness,
    name: (i) => names.get(i) || '',
    designation: (i) => designations.get(i) || '',
    spectrum: (i) => spectra.get(i) || '',
    label: (i) => names.get(i) || designations.get(i) || '',
    namedIndices: [...names.keys()],
    source: meta.source,
  };
}

export async function loadConstellations(base) {
  const dir = `${base}/d3-celestial-constellations`;
  const [lines, names] = await Promise.all([
    json(`${dir}/constellations.lines.json`),
    json(`${dir}/constellations.json`),
  ]);
  const segments = [];
  for (const f of lines.features) {
    for (const line of f.geometry.coordinates) {
      for (let k = 1; k < line.length; k++) {
        const a = fromSpherical(line[k - 1][0] * DEG, line[k - 1][1] * DEG);
        const b = fromSpherical(line[k][0] * DEG, line[k][1] * DEG);
        segments.push(...a, ...b);
      }
    }
  }
  const labels = names.features.map((f) => ({
    id: f.id,
    rank: Number(f.properties.rank),
    names: { en: f.properties.en || f.properties.name, la: f.properties.la || f.properties.name,
      zh: f.properties.zh, ja: f.properties.ja },
    unit: fromSpherical(f.geometry.coordinates[0] * DEG, f.geometry.coordinates[1] * DEG),
  }));
  return { segments: new Float32Array(segments), labels };
}
