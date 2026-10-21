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
  horizontal, sub, norm, dot,
} from '../src/core/frames.js';
import { osculating } from '../src/core/kepler.js';
import { GM_SUN } from '../src/core/bodies.js';

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
const separation = (a, b) => Math.acos(Math.min(1, dot(a, b) / (norm(a) * norm(b))));

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

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
