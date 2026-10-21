// Tests for the atlas's provisional computational core.
// Run from the repository root:  node applications/astronomy/celestial-atlas/tests/run-tests.mjs
// Requires data/cache/jpl-de440s/de440s.bsp (python data/acquisition/fetch.py jpl-de440s).

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SPK } from '../src/core/spk.js';
import { scalesFromUnixMs, gmst, taiMinusUtc, deltaTBefore1972 } from '../src/core/time.js';
import {
  DEG, AU_KM, LIGHT_KM_S, fromSpherical, toSpherical, apply, precessionMatrix,
  horizontal, sub, norm, dot, cross,
} from '../src/core/frames.js';
import { osculating } from '../src/core/kepler.js';
import { GM_SUN } from '../src/core/bodies.js';
import { ICRS_TO_SUPERGALACTIC } from '../src/core/frames.js';
import {
  supergalactic, tidalIndices, tidalGroups, inferDisturberLuminosities, displayName,
} from '../src/core/galaxies.js';
import { existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const fixtures = JSON.parse(readFileSync(resolve(here, 'fixtures/horizons.json'), 'utf8'));
const kernel = readFileSync(resolve(root, 'data/cache/jpl-de440s/de440s.bsp'));
const spk = new SPK(kernel.buffer.slice(kernel.byteOffset, kernel.byteOffset + kernel.byteLength));

let failures = 0;
function check(name, value, limit, unit) {
  const ok = Math.abs(value) <= limit;
  if (!ok) failures++;
  console.log(`${ok ? 'pass' : 'FAIL'}  ${name}: ${value.toExponential(3)} ${unit} (limit ${limit} ${unit})`);
}

const etOf = (jdTdb) => (jdTdb - 2451545.0) * 86400;
const unixMsOf = (jd) => (jd - 2440587.5) * 86400000;
const hms = (h, m, s) => (h + m / 60 + s / 3600) * 15 * DEG;
const dms = (sign, d, m, s) => sign * (d + m / 60 + s / 3600) * DEG;
const separation = (a, b) => Math.atan2(norm(cross(a, b)), dot(a, b));

// 1. DE440 evaluator against Horizons barycentric vectors (DE441).
for (const [target, entries] of Object.entries(fixtures.vectors_ssb_icrf_km)) {
  let dp = 0, dv = 0;
  for (const e of entries) {
    const s = spk.stateSSB(Number(target), etOf(e.jd_tdb));
    dp = Math.max(dp, norm(sub(s.p, e.p)));
    dv = Math.max(dv, norm(sub(s.v, e.v)));
  }
  check(`position of ${target} vs Horizons, max over 1850-2150`, dp, 2, 'km');
  check(`velocity of ${target} vs Horizons`, dv, 1e-6, 'km/s');
}

// 2. Geocentric astrometric directions (light-time corrected) against Horizons.
const naifOf = { 10: 10, 301: 301, 499: 4, 599: 5, 699: 6 };
for (const [target, entries] of Object.entries(fixtures.astrometric_geocentric_icrf)) {
  let worst = 0;
  for (const e of entries) {
    const t = scalesFromUnixMs(unixMsOf(e.jd_utc));
    const earth = spk.stateSSB(399, t.et).p;
    let tau = 0, g;
    for (let i = 0; i < 3; i++) {
      g = sub(spk.stateSSB(naifOf[target], t.et - tau).p, earth);
      tau = norm(g) / LIGHT_KM_S;
    }
    const ref = fromSpherical(e.ra_deg * DEG, e.dec_deg * DEG);
    worst = Math.max(worst, separation(g, ref) / DEG * 3600);
  }
  check(`astrometric direction of ${target} vs Horizons`, worst, 0.5, 'arcsec');
}

// 3. Time scales.
const t2026 = scalesFromUnixMs(Date.UTC(2026, 9, 22, 12));
check('TT - UTC in 2026 is 69.184 s', t2026.deltaT - 69.184, 1e-9, 's');
check('TAI - UTC on 2016-12-31 is 36 s', taiMinusUtc(2457753.5) - 36, 0, 's');
check('Delta T in 1950 near 29.07 s', deltaTBefore1972(1950) - 29.07, 1e-9, 's');
{
  // Meeus, Astronomical Algorithms, example 12.a: 1987-04-10 0h UT, GMST 13h10m46.3668s.
  const t = scalesFromUnixMs(Date.UTC(1987, 3, 10));
  const diff = (gmst(t.jdUT1, t.jdTT) - hms(13, 10, 46.3668)) / (15 * DEG) * 3600;
  check('GMST 1987-04-10 0h UT (Meeus 12.a)', diff, 0.01, 's');
}

// 4. Precession (Meeus example 21.b, theta Persei, mean place of date 2028-11-13.19 TD).
{
  const v0 = fromSpherical(hms(2, 44, 12.975), dms(1, 49, 13, 39.90));
  const v = apply(precessionMatrix(2462088.69), v0);
  const s = toSpherical(v);
  check('precessed RA (Meeus 21.b)', (s.lon - hms(2, 46, 11.331)) / (15 * DEG) * 3600, 0.01, 's');
  check('precessed Dec (Meeus 21.b)', (s.lat - dms(1, 49, 20, 54.54)) / DEG * 3600, 0.1, 'arcsec');
}

// 5. Horizontal coordinates (Meeus example 13.b, Venus seen from the US Naval Observatory).
{
  const lst = hms(8, 34, 56.853) + dms(-1, 77, 3, 56);
  const h = horizontal(fromSpherical(hms(23, 9, 16.641), dms(-1, 6, 43, 11.61)), lst, dms(1, 38, 55, 17));
  check('altitude (Meeus 13.b)', h.alt / DEG - 15.1249, 0.001, 'deg');
  check('azimuth from north (Meeus 13.b)', h.az / DEG - (68.0337 + 180), 0.001, 'deg');
}

// 6. Osculating orbit of the Earth-Moon barycentre at J2000.
{
  const emb = spk.stateSSB(3, 0), sun = spk.stateSSB(10, 0);
  const o = osculating(sub(emb.p, sun.p), sub(emb.v, sun.v), GM_SUN + 403503.235502);
  check('EMB semi-major axis near 1.0000 AU', o.a / AU_KM - 1.0000, 0.0005, 'AU');
  check('EMB eccentricity near 0.0167', o.e - 0.0167, 0.0005, '');
}

// ---- galaxies (need data/cache from data/acquisition/fetch.py) ----

function readCsv(path) {
  const split = (line) => {
    const out = [];
    let cur = '', quoted = false;
    for (const ch of line) {
      if (ch === '"') quoted = !quoted;
      else if (ch === ',' && !quoted) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const lines = readFileSync(path, 'utf8').trim().split(/\r?\n/);
  const head = split(lines[0]);
  return lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [head[i], v])));
}
const num = (s) => (s === '' ? NaN : Number(s));
const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];

// 7. Supergalactic coordinates against Tully (2015), which lists for every
// galaxy its ICRS position, supergalactic angles and SGX, SGY, SGZ.
// Known anomaly: PGC 4665585's VizieR-computed position is the Galactic centre
// (a placeholder), inconsistent with its own supergalactic coordinates.
// Elsewhere the catalogue is self-consistent to about 0.01°, without pattern on
// the sky; a wrong transformation would show a systematic offset everywhere.
const TULLY = resolve(root, 'data/cache/tully-2mass-groups/all/result.csv');
if (existsSync(TULLY)) {
  const anomalies = new Set(['4665585']);
  const angles = [];
  let worstXYZ = 0;
  for (const r of readCsv(TULLY)) {
    if (anomalies.has(r.PGC)) continue;
    const u = apply(ICRS_TO_SUPERGALACTIC, fromSpherical(num(r._RA_icrs) * DEG, num(r._DE_icrs) * DEG));
    angles.push(separation(u, fromSpherical(num(r.SGLON) * DEG, num(r.SGLAT) * DEG)) / DEG);
    if (Number.isFinite(num(r.SGX))) {
      const p = supergalactic(num(r._RA_icrs), num(r._DE_icrs), num(r.Dist));
      worstXYZ = Math.max(worstXYZ, Math.abs(p[0] - num(r.SGX)), Math.abs(p[1] - num(r.SGY)), Math.abs(p[2] - num(r.SGZ)));
    }
  }
  angles.sort((a, b) => a - b);
  check(`supergalactic direction vs Tully (2015), median of ${angles.length}`, percentile(angles, 0.5), 0.0005, 'deg');
  check('supergalactic direction, 99.9th percentile', percentile(angles, 0.999), 0.005, 'deg');
  check('supergalactic direction, maximum', angles[angles.length - 1], 0.02, 'deg');
  check('supergalactic X, Y, Z vs Tully (2015), maximum', worstXYZ, 0.03, 'h^-1 Mpc');
} else {
  console.log('skip  supergalactic tests: run python data/acquisition/fetch.py tully-2mass-groups');
}

// 8. Tidal indices and main disturbers against the Updated Nearby Galaxy
// Catalog (Karachentsev et al. 2013), recomputed from positions and
// luminosities; the Milky Way's missing luminosity is inferred from the
// published indices of its satellites.
const UNGC = resolve(root, 'data/cache/ungc/all/result.csv');
if (existsSync(UNGC)) {
  const rows = readCsv(UNGC);
  const index = new Map(rows.map((r, i) => [r.Name, i]));
  const positions = new Float64Array(3 * rows.length);
  rows.forEach((r, i) => positions.set(supergalactic(num(r.RAJ2000), num(r.DEJ2000), num(r.Dist)), 3 * i));
  const logL = Float64Array.from(rows, (r) => num(r.KLum));
  const published = Int32Array.from(rows, (r) => (index.has(r.MD) ? index.get(r.MD) : -1));
  const publishedTheta = Float64Array.from(rows, (r) => num(r.Ti1));
  const filled = inferDisturberLuminosities(positions, logL, published, publishedTheta);
  const mw = filled.inferred.find((x) => rows[x.index].Name === 'Milky Way');
  check('inferred log L_K of the Milky Way within 10.55 ± 0.3', mw ? mw.logL - 10.55 : 99, 0.3, 'dex');
  const ours = tidalIndices(positions, filled.logL);
  let comparable = 0, same = 0;
  const diffs = [];
  rows.forEach((r, i) => {
    if (published[i] < 0 || !Number.isFinite(publishedTheta[i])) return;
    comparable++;
    if (ours.disturber[i] === published[i]) {
      same++;
      diffs.push(Math.abs(ours.theta1[i] - publishedTheta[i]));
    }
  });
  diffs.sort((a, b) => a - b);
  check(`main disturber identical for ≥ 98 % of ${comparable} galaxies (miss rate)`, 1 - same / comparable, 0.02, '');
  check('median |Θ1 − published| (published values have 0.1 precision)', percentile(diffs, 0.5), 0.05, 'dex');
  check('90th percentile |Θ1 − published|', percentile(diffs, 0.9), 0.1, 'dex');
  const groups = tidalGroups(ours.disturber, ours.theta1, filled.logL);
  const leaders = groups.groups.slice(0, 6).map((g) => rows[g.leader].Name);
  check('M 81 and M 31 lead two of the six largest tidal groups',
    ['MESSIER081', 'MESSIER031'].every((n) => leaders.includes(n)) ? 0 : 1, 0, '');
} else {
  console.log('skip  tidal-index tests: run python data/acquisition/fetch.py ungc');
}

// 9. Names.
{
  const cases = [['MESSIER081', 'M 81'], ['NGC0253', 'NGC 253'], ['ESO499-037', 'ESO 499-037'],
    ['UGCA086', 'UGCA 86'], ['KKH011', 'KKH 11'], ['Milky Way', 'Milky Way'], ['And XXX', 'And XXX']];
  check('display names', cases.filter(([a, b]) => displayName(a) !== b).length, 0, 'mismatches');
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
