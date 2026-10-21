// What can be drawn: layers built from the products in the library.
//
// Layers are typed by the shape of their data, not by subject:
//   surface  a quantity over the whole surface: a field (one variable, or the
//            speed of a vector field) or a value per country (an indicator);
//   flow     a vector field shown by moving particles;
//   lines    isolines of a field, with its highs and lows;
//   events   things that happened at places and instants.
// A field variable is recognised by its CF standard name, so that any product
// carrying, say, sea_surface_temperature offers the same layer, drawn the same
// way. A variable that is not recognised is still offered, with a range taken
// from its own values: new data, such as our own model output, can be seen as
// soon as it is a product.
//
// Styles (colour map, range, scale) live here, in the application, and not in
// the data. Ranges are in the units shown (src/core/units.js).

const QUANTITIES = [
  { id: 'air-temperature', standard: 'air_temperature', label: 'Air temperature', colormap: 'thermal', range: [-35, 40] },
  { id: 'surface-temperature', standard: 'surface_temperature', label: 'Surface temperature', colormap: 'thermal', range: [-40, 50] },
  { id: 'pressure', standard: 'air_pressure_at_sea_level', label: 'Pressure at sea level', colormap: 'dense', reverse: true, range: [975, 1040] },
  { id: 'precipitation', standard: 'precipitation_flux', label: 'Precipitation', colormap: 'haline', range: [0.1, 20], scale: 'log', fade: 0.2 },
  { id: 'humidity', standard: 'relative_humidity', label: 'Relative humidity', colormap: 'tempo', reverse: true, range: [0, 100] },
  { id: 'shortwave-down', standard: 'surface_downwelling_shortwave_flux', label: 'Sunlight reaching the surface', colormap: 'thermal', range: [0, 1000] },
  { id: 'shortwave-up', standard: 'surface_upwelling_shortwave_flux', label: 'Sunlight reflected by the surface', colormap: 'thermal', range: [0, 500] },
  { id: 'longwave-down', standard: 'surface_downwelling_longwave_flux', label: 'Infrared from the sky', colormap: 'thermal', range: [100, 450] },
  { id: 'longwave-up', standard: 'surface_upwelling_longwave_flux', label: 'Infrared from the surface', colormap: 'thermal', range: [150, 550] },
  { id: 'sst', standard: 'sea_surface_temperature', label: 'Sea-surface temperature', colormap: 'thermal', range: [-2, 32] },
  { id: 'sst-anomaly', standard: 'surface_temperature_anomaly', label: 'Sea-surface temperature anomaly', colormap: 'balance', range: [-4, 4] },
  { id: 'sea-ice', match: (v) => v.name === 'ice' || /sea ice concentration/i.test(v.long_name || ''), label: 'Sea-ice concentration', colormap: 'ice', range: [0, 1], fade: 0.12, percent: true },
  { id: 'wave-height', standard: 'sea_surface_wave_significant_height', label: 'Significant wave height', colormap: 'deep', reverse: true, range: [0, 9] },
  { id: 'swell-height', standard: 'sea_surface_swell_wave_significant_height', label: 'Swell height', colormap: 'deep', reverse: true, range: [0, 7] },
  { id: 'wind-sea-height', standard: 'sea_surface_wind_wave_significant_height', label: 'Wind-sea height', colormap: 'deep', reverse: true, range: [0, 7] },
  { id: 'wave-period', standard: 'sea_surface_wave_period_at_variance_spectral_density_maximum', label: 'Peak wave period', colormap: 'speed', reverse: true, range: [2, 18] },
  { id: 'swell-period', standard: 'sea_surface_swell_wave_period', label: 'Swell period', colormap: 'speed', reverse: true, range: [2, 18] },
  { id: 'wind-sea-period', standard: 'sea_surface_wind_wave_period', label: 'Wind-sea period', colormap: 'speed', reverse: true, range: [1, 12] },
  { id: 'elevation', standard: 'altitude', label: 'Elevation', base: true },
];

const VECTORS = [
  { id: 'wind', standard: 'wind', label: 'Wind', colormap: 'orchid', range: [0, 25] },
  { id: 'current', standard: 'sea_water_velocity', label: 'Ocean current', colormap: 'orchid', range: [0, 1.5] },
];

// Short names and units for World Bank indicators, by code.
export const INDICATORS = {
  'SP.POP.TOTL': ['Population', ''],
  'EN.POP.DNST': ['Population density', 'per km²'],
  'NY.GDP.PCAP.CD': ['GDP per person', 'US$'],
  'SP.DYN.LE00.IN': ['Life expectancy', 'years'],
  'SP.DYN.TFRT.IN': ['Births per woman', ''],
  'SP.URB.TOTL.IN.ZS': ['Urban population', '%'],
  'AG.LND.FRST.ZS': ['Forest area', '% of land'],
  'EG.ELC.ACCS.ZS': ['Access to electricity', '%'],
  'EN.GHG.CO2.PC.CE.AR5': ['CO₂ emitted per person', 't'],
  'EN.GHG.ALL.PC.CE.AR5': ['Greenhouse gases per person', 't CO₂e'],
  'SI.POV.GINI': ['Gini index of income', ''],
};

export const DOMAINS = {
  meteorology: 'Meteorology', oceanography: 'Oceanography', climate: 'Climate',
  geography: 'Geography', geophysics: 'Geophysics',
};

const isDirection = (v) => /direction/.test(v.standard_name || '') || v.units === 'degree';

// "air temperature at 2m" -> " at 2 m"
function height(v) {
  const m = /\bat\s*(\d+(?:\.\d+)?)\s*m\b/i.exec(v.long_name || '');
  return m ? ` at ${m[1]} m` : '';
}

const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function source(meta) {
  const s = meta.source || {};
  return { dataset: s.dataset, profile: s.profile, provider: s.provider, licence: s.licence, citation: s.citation, retrieved: s.retrieved_at };
}

export function buildCatalogue(library) {
  const surfaces = [], flows = [], lines = [], events = [], probes = [];
  const taken = new Set();
  for (const [name, meta] of library.fieldMeta) {
    const domain = meta.domain || 'geography';
    for (const vec of meta.vectors || []) {
      const known = VECTORS.find((k) => k.standard === vec.standard_name) || { id: vec.name, label: capital(vec.name.replace(/_/g, ' ')), colormap: 'orchid', range: [0, 20] };
      const u = meta.variables.find((v) => v.name === vec.u);
      const id = `${known.id}@${name}`;
      const label = `${known.label}${height(u)}`;
      flows.push({ id, kind: 'vector', label, product: name, variables: [vec.u, vec.v], domain, units: u.units, source: source(meta) });
      surfaces.push({ id: `${id}:speed`, kind: 'field', label: `${known.label} speed${height(u)}`, product: name, variables: [vec.u, vec.v], domain, units: u.units,
        style: { colormap: known.colormap, range: known.range, scale: 'linear' }, source: source(meta) });
      taken.add(`${name}/${vec.u}`); taken.add(`${name}/${vec.v}`);
      probes.push({ kind: 'vector', label: `${known.label}${height(u)}`, product: name, variables: [vec.u, vec.v], units: u.units, domain });
    }
    const dir = meta.variables.find((v) => v.standard_name === 'sea_surface_wave_from_direction_at_variance_spectral_density_maximum');
    const per = meta.variables.find((v) => v.standard_name === 'sea_surface_wave_period_at_variance_spectral_density_maximum');
    if (dir && per) {
      flows.push({ id: `waves@${name}`, kind: 'waves', label: 'Wave energy', product: name, variables: [dir.name, per.name], domain, units: 'm s-1', source: source(meta) });
    }
    for (const v of meta.variables) {
      if (taken.has(`${name}/${v.name}`)) continue;
      const known = QUANTITIES.find((q) => (q.standard && q.standard === v.standard_name) || (q.match && q.match(v)));
      if (isDirection(v)) {
        probes.push({ kind: 'direction', label: capital((v.long_name || v.name)), product: name, variables: [v.name], units: v.units, domain });
        continue;
      }
      const label = known ? `${known.label}${height(v)}` : capital(v.long_name || v.name);
      probes.push({ kind: 'scalar', id: known && known.id, label, product: name, variables: [v.name], units: v.units, domain, percent: known && known.percent });
      if (known && known.base) continue;
      const style = known
        ? { colormap: known.colormap, reverse: known.reverse, range: known.range, scale: known.scale || 'linear', fade: known.fade }
        : { colormap: 'matter', reverse: true, clip: [0, 0.9], range: null, scale: 'linear', auto: [v.p02, v.p98] };
      surfaces.push({ id: `${known ? known.id : v.name}@${name}`, kind: 'field', label, product: name, variables: [v.name], domain, units: v.units, style, source: source(meta), percent: known && known.percent });
      if (v.standard_name === 'air_pressure_at_sea_level') {
        lines.push({ id: `isobars@${name}`, label: 'Isobars', product: name, variable: v.name, step: 400, base: 101300, extrema: { radius: 10, prominence: 500, polarRows: 8 }, units: v.units, labelUnits: 'hPa' });
      }
      if (v.standard_name === 'air_temperature') {
        lines.push({ id: `isotherms@${name}`, label: 'Isotherms', product: name, variable: v.name, step: 5, base: 273.15, units: v.units, labelUnits: '°C' });
      }
    }
  }
  for (const e of library.list('indicators')) {
    const [label, unit] = INDICATORS[e.code] || [e.quantity || e.title, e.unit];
    surfaces.push({ id: `indicator:${e.name}`, kind: 'indicator', label, product: e.name, code: e.code, domain: e.domain || 'geography',
      units: unit, title: e.title, style: { colormap: 'matter', reverse: true, clip: [0.04, 0.96] }, source: e.source });
  }
  for (const e of library.list('events')) {
    events.push({ id: e.name, label: e.title, kind: e.kind, product: e.name, count: e.count, window: e.window, domain: e.domain });
  }
  const order = ['meteorology', 'oceanography', 'climate', 'geography', 'geophysics'];
  const within = (s) => (s.id.startsWith('wind@') ? 0 : QUANTITIES.findIndex((q) => s.id.startsWith(`${q.id}@`)) + 1 || 500);
  const rank = (s) => (order.indexOf(s.domain) + 1 || 99) * 1000 + within(s);
  surfaces.sort((a, b) => rank(a) - rank(b));
  return { surfaces, flows, lines, events, probes };
}
