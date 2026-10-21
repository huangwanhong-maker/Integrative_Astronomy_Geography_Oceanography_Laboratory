// Runs the barotropic vorticity model (src/core/barotropic.js) away from the
// page's main thread, and returns its fields every few hours on a regular grid.
//
// Message in:  { u, v: Float64Array on the model's Gaussian grid (rows south to north),
//                hours, dt (s), every (h), grid: the output grid, truncation }
// Messages out: { progress: 0..1 } ..., then { done: true, times: [s], fields: { dz, u, v, zeta } }
//   dz is the balanced height change since the start (m), u and v the wind (m/s),
//   zeta the relative vorticity (1/s), each a list of Float32Arrays, one per time.

import { BarotropicModel } from '../core/barotropic.js';

self.onmessage = (event) => {
  const { u, v, hours, dt, every, grid, truncation } = event.data;
  const model = new BarotropicModel({ truncation });
  model.setWind(u, v);
  const sh = model.sh;
  const z0 = sh.synthesiseOn(model.balancedHeight(model.streamFunction()), grid);
  const out = { dz: [], u: [], v: [], zeta: [] };
  const times = [];
  const record = () => {
    const psi = model.streamFunction();
    const z = sh.synthesiseOn(model.balancedHeight(psi), grid);
    for (let i = 0; i < z.length; i++) z[i] -= z0[i];
    // Wind on the output grid: U = u cos(phi) and V = v cos(phi) from psi, by
    // synthesis of the spectral derivatives at the output latitudes.
    const { uu, vv } = windOn(sh, psi, grid, model.radius);
    out.dz.push(z); out.u.push(uu); out.v.push(vv);
    out.zeta.push(sh.synthesiseOn(model.zeta, grid));
    times.push(model.time);
  };
  record();
  const steps = Math.round((hours * 3600) / dt);
  const recordEvery = Math.max(1, Math.round((every * 3600) / dt));
  for (let s = 1; s <= steps; s++) {
    model.step(dt);
    if (s % recordEvery === 0) record();
    if (s % 4 === 0) self.postMessage({ progress: s / steps });
  }
  const transfer = Object.values(out).flat().map((a) => a.buffer);
  self.postMessage({ done: true, times, fields: out }, transfer);
};

// u = -(1/a) dpsi/dphi and v = (1/(a cos phi)) dpsi/dlambda on a regular grid.
function windOn(sh, psi, grid, radius) {
  const mus = Array.from({ length: grid.nlat }, (_, r) => Math.sin(((grid.lat0 - r * grid.dlat) * Math.PI) / 180));
  const [P, H] = sh.legendre(mus);
  const { M, size } = sh;
  const uu = new Float32Array(grid.nlat * grid.nlon), vv = new Float32Array(grid.nlat * grid.nlon);
  for (let r = 0; r < grid.nlat; r++) {
    const c = Math.sqrt(Math.max(1e-12, 1 - mus[r] * mus[r]));
    const Ur = new Float64Array(M + 1), Ui = new Float64Array(M + 1), Vr = new Float64Array(M + 1), Vi = new Float64Array(M + 1);
    for (let k = 0; k < size; k++) {
      const m = sh.m[k], p = P[r * size + k], h = H[r * size + k];
      Ur[m] -= (psi.re[k] * h) / radius; Ui[m] -= (psi.im[k] * h) / radius;          // U = -(1/a) sum psi H
      Vr[m] += (-m * psi.im[k] * p) / radius; Vi[m] += (m * psi.re[k] * p) / radius; // V = (1/a) sum i m psi P
    }
    for (let col = 0; col < grid.nlon; col++) {
      const lam = ((grid.lon0 + col * grid.dlon) * Math.PI) / 180;
      let U = Ur[0], V = Vr[0];
      for (let m = 1; m <= M; m++) {
        const cm = Math.cos(m * lam), sm = Math.sin(m * lam);
        U += 2 * (Ur[m] * cm - Ui[m] * sm);
        V += 2 * (Vr[m] * cm - Vi[m] * sm);
      }
      uu[r * grid.nlon + col] = U / c;
      vv[r * grid.nlon + col] = V / c;
    }
  }
  return { uu, vv };
}
