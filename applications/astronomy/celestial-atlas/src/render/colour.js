// Colours: the atlas palette, and the colour of a star from its B-V index.
//
// Sources:
//   Ballesteros (2012), EPL 97, 34008: effective temperature from B-V.
//   Helland (2012), "How to convert temperature (K) to RGB": blackbody fit.

// Pink: rose-plum nights with rose and blush accents; blush paper with
// rose-plum ink for the charts.
export const PALETTE = {
  night: '#1b1018',
  text: '#fdf0f5',
  textDim: '#d4b2c3',
  pink: '#ff7eb0',
  blush: '#ffb0d2',
  accentDeep: '#c23a75',
  roseDeep: '#b65a86',
  gold: '#f6c47e',
  goldDeep: '#c98a2e',
  paper: '#fdf3f6',
  ink: '#3e2533',
  inkSoft: '#8c6678',
};

// rgba() of a palette colour.
export function rgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${alpha})`;
}

export function bvToTemperature(bv) {
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
}

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// Approximate sRGB of a blackbody of temperature T (K), components in [0, 1].
export function temperatureToRgb(T) {
  const t = clamp(T, 1000, 40000) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661
    : 288.1221695283 * (t - 60) ** -0.0755148492;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [clamp(r, 0, 255) / 255, clamp(g, 0, 255) / 255, clamp(b, 0, 255) / 255];
}

// Star colour from B-V; unknown indices are drawn as a Sun-like star.
export function starRgb(bv) {
  const index = Number.isFinite(bv) ? clamp(bv, -0.4, 2.0) : 0.65;
  return temperatureToRgb(bvToTemperature(index));
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
