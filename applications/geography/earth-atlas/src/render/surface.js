// The Earth's surface as drawn by the GPU: the base map, one data layer (a
// field or a choropleth of countries), and day and night, on the globe or on a
// flat map.
//
// One fragment shader serves every projection. For the globe it reads the
// place from the sphere's surface; for a flat map it inverts the projection at
// each pixel (transcribing src/core/projections.js). It then samples, at that
// place, the base image, the data and the Sun's altitude. Fields are sampled
// from float textures holding the grid exactly as stored, with the bilinear rule
// of src/core/grid.js (weights renormalised beside missing values) and linear
// interpolation between two times, so the GPU draws what the probe reports.

import * as THREE from 'three';

export const GPU_MISSING = -1e30;

const vertexShader = /* glsl */ `
out vec3 vEarth;
out vec2 vPlane;
void main() {
  vEarth = position;
  vPlane = (modelMatrix * vec4(position, 1.0)).xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragmentShader = /* glsl */ `
precision highp float;
precision highp int;
precision highp usampler2D;

in vec3 vEarth;
in vec2 vPlane;
out vec4 fragColor;

uniform int uProjection;          // 0 globe, 1 equirectangular, 2 Equal Earth
uniform float uLambda0;           // central meridian, radians
uniform vec2 uExtent;             // half-width and half-height of the map
uniform sampler2D uBase;          // RGB: tinted, shaded relief; A: shading x 127.5
uniform int uMode;                // 0 none, 1 scalar field, 2 magnitude of a vector field, 3 countries
uniform sampler2D uA0, uA1, uB0, uB1;
uniform float uMix;               // weight of the later time
uniform vec4 uGrid;               // lon0, dlon, lat0, dlat (degrees)
uniform ivec3 uGridN;             // nlon, nlat, periodic
uniform sampler2D uLut;
uniform vec3 uRange;              // low, high (stored units), scale: 0 linear, 1 logarithmic, 2 square root
uniform float uOpacity;
uniform float uReliefOnData;
uniform usampler2D uCountries;    // 1 + index of the country at each pixel, 0 for none
uniform sampler2D uCountryColours;
uniform vec3 uSun;                // unit vector toward the Sun, Earth-fixed
uniform float uNight;             // 0 none, 1 full
uniform vec3 uNightTint;

const float PI = 3.141592653589793;
const float MISSING = -1.0e29;
const float A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = 0.8660254037844386;

vec2 equalEarthInverse(vec2 p) {
  float t = p.y;
  for (int i = 0; i < 6; i++) {
    float t2 = t * t, t6 = t2 * t2 * t2;
    float fy = t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2)) - p.y;
    float fpy = A1 + 3.0 * A2 * t2 + t6 * (7.0 * A3 + 9.0 * A4 * t2);
    t -= fy / fpy;
  }
  float t2 = t * t, t6 = t2 * t2 * t2;
  float lambda = M * p.x * (A1 + 3.0 * A2 * t2 + t6 * (7.0 * A3 + 9.0 * A4 * t2)) / cos(t);
  return vec2(lambda, asin(clamp(sin(t) / M, -1.0, 1.0)));
}

float cell(sampler2D t, int c, int r) { return texelFetch(t, ivec2(c, r), 0).r; }

// Bilinear interpolation with renormalised weights (src/core/grid.js).
float fieldAt(sampler2D t, vec2 ll) {
  float nlon = float(uGridN.x), nlat = float(uGridN.y);
  float x = (ll.x - uGrid.x) / uGrid.y;
  if (uGridN.z == 1) x = mod(x, nlon);
  else if (x < -0.5 || x > nlon - 0.5) return MISSING;
  float y = (uGrid.z - ll.y) / uGrid.w;
  if (y < -0.5 || y > nlat - 0.5) return MISSING;
  y = clamp(y, 0.0, nlat - 1.0);
  int c0 = int(floor(x)), r0 = int(floor(y));
  float fx = x - float(c0), fy = y - float(r0);
  int c1 = c0 + 1, r1 = min(r0 + 1, uGridN.y - 1);
  if (c1 >= uGridN.x) c1 = uGridN.z == 1 ? c1 - uGridN.x : uGridN.x - 1;
  c0 = max(c0, 0);
  vec4 v = vec4(cell(t, c0, r0), cell(t, c1, r0), cell(t, c0, r1), cell(t, c1, r1));
  vec4 w = vec4((1.0 - fx) * (1.0 - fy), fx * (1.0 - fy), (1.0 - fx) * fy, fx * fy);
  vec4 ok = vec4(greaterThan(v, vec4(MISSING)));
  float weight = dot(w, ok);
  if (weight < 0.5) return MISSING;
  return dot(w * ok, v) / weight;
}

float atTime(sampler2D t0, sampler2D t1, vec2 ll) {
  float a = fieldAt(t0, ll);
  if (uMix <= 0.0 || a < MISSING) return a;
  float b = fieldAt(t1, ll);
  return b < MISSING ? MISSING : mix(a, b, uMix);
}

vec4 colourOf(float v) {
  float t;
  if (uRange.z > 0.5 && uRange.z < 1.5) t = (log(max(v, 1e-30)) - log(uRange.x)) / (log(uRange.y) - log(uRange.x));
  else if (uRange.z > 1.5) t = (sqrt(max(v, 0.0)) - sqrt(max(uRange.x, 0.0))) / (sqrt(uRange.y) - sqrt(max(uRange.x, 0.0)));
  else t = (v - uRange.x) / (uRange.y - uRange.x);
  return texture(uLut, vec2(clamp(t, 0.0, 1.0) * (255.0 / 256.0) + 0.5 / 256.0, 0.5));
}

// Darkening by the Sun's altitude, in steps at sunset and at the ends of civil,
// nautical and astronomical twilight (-0.833, -6, -12, -18 degrees).
float darkness(float alt) {
  float d = 0.30 * smoothstep(-0.533, -1.133, alt);
  d += 0.26 * smoothstep(-5.75, -6.25, alt);
  d += 0.24 * smoothstep(-11.75, -12.25, alt);
  d += 0.20 * smoothstep(-17.75, -18.25, alt);
  return d;
}

void main() {
  vec3 earth;
  vec2 ll;
  if (uProjection == 0) {
    earth = normalize(vEarth);
    ll = vec2(atan(earth.y, earth.x), asin(clamp(earth.z, -1.0, 1.0))) * (180.0 / PI);
  } else {
    if (abs(vPlane.y) > uExtent.y) discard;
    vec2 lp = uProjection == 1 ? vPlane : equalEarthInverse(vPlane);
    if (abs(lp.x) > PI) discard;
    float lon = mod(lp.x + uLambda0 + PI, 2.0 * PI) - PI;
    earth = vec3(cos(lp.y) * cos(lon), cos(lp.y) * sin(lon), sin(lp.y));
    ll = vec2(lon, lp.y) * (180.0 / PI);
  }

  // The base image, with gradients taken across the seam at 180 degrees so that
  // the mipmap level does not jump there.
  vec2 uv = vec2((ll.x + 180.0) / 360.0, (90.0 - ll.y) / 180.0);
  vec2 uvs = vec2(fract(uv.x + 0.5), uv.y);
  vec2 dx = dFdx(uv), dy = dFdy(uv), dxs = dFdx(uvs), dys = dFdy(uvs);
  if (abs(dxs.x) < abs(dx.x)) dx.x = dxs.x;
  if (abs(dys.x) < abs(dy.x)) dy.x = dys.x;
  vec4 base = textureGrad(uBase, uv, dx, dy);
  float shade = base.a * 2.0;
  float alt = asin(clamp(dot(earth, uSun), -1.0, 1.0)) * (180.0 / PI);
  float dark = darkness(alt) * uNight;
  // Night darkens the map fully, and data drawn over it by half, so that
  // values stay readable on the night side.
  vec3 colour = base.rgb * mix(vec3(1.0), uNightTint, dark);
  vec3 dataNight = mix(vec3(1.0), uNightTint, dark * 0.5);

  if (uMode == 1 || uMode == 2) {
    float v = atTime(uA0, uA1, ll);
    if (uMode == 2 && v > MISSING) {
      float w = atTime(uB0, uB1, ll);
      v = w > MISSING ? length(vec2(v, w)) : MISSING;
    }
    if (v > MISSING) {
      vec4 c = colourOf(v);
      vec3 shaded = c.rgb * mix(1.0, shade, uReliefOnData) * dataNight;
      colour = mix(colour, shaded, c.a * uOpacity);
    }
  } else if (uMode == 3) {
    ivec2 size = textureSize(uCountries, 0);
    ivec2 px = ivec2(clamp(uv * vec2(size), vec2(0.0), vec2(size) - 1.0));
    uint id = texelFetch(uCountries, px, 0).r;
    if (id > 0u) {
      vec4 c = texelFetch(uCountryColours, ivec2(int(id), 0), 0);
      vec3 shaded = c.rgb * mix(1.0, shade, uReliefOnData) * dataNight;
      colour = mix(colour, shaded, c.a * uOpacity);
    }
  }
  fragColor = vec4(colour, 1.0);
}`;

function floatTexture(width, height, data) {
  const t = new THREE.DataTexture(data, width, height, THREE.RedFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

const empty = () => floatTexture(1, 1, new Float32Array([GPU_MISSING]));

export function createSurfaceMaterial() {
  const lut = new THREE.DataTexture(new Uint8Array(256 * 4), 256, 1, THREE.RGBAFormat);
  lut.minFilter = lut.magFilter = THREE.LinearFilter;
  lut.needsUpdate = true;
  const countries = new THREE.DataTexture(new Uint16Array(1), 1, 1, THREE.RedIntegerFormat, THREE.UnsignedShortType);
  countries.internalFormat = 'R16UI';
  countries.needsUpdate = true;
  const colours = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat);
  colours.needsUpdate = true;
  const base = new THREE.DataTexture(new Uint8Array([60, 50, 70, 128]), 1, 1, THREE.RGBAFormat);
  base.needsUpdate = true;
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader,
    fragmentShader,
    uniforms: {
      uProjection: { value: 0 },
      uLambda0: { value: 0 },
      uExtent: { value: new THREE.Vector2(Math.PI, Math.PI / 2) },
      uBase: { value: base },
      uMode: { value: 0 },
      uA0: { value: empty() }, uA1: { value: empty() }, uB0: { value: empty() }, uB1: { value: empty() },
      uMix: { value: 0 },
      uGrid: { value: new THREE.Vector4(0, 1, 0, 1) },
      uGridN: { value: new THREE.Vector3(1, 1, 0) },
      uLut: { value: lut },
      uRange: { value: new THREE.Vector3(0, 1, 0) },
      uOpacity: { value: 0.88 },
      uReliefOnData: { value: 0.55 },
      uCountries: { value: countries },
      uCountryColours: { value: colours },
      uSun: { value: new THREE.Vector3(1, 0, 0) },
      uNight: { value: 1 },
      uNightTint: { value: new THREE.Color(0.30, 0.27, 0.47) },
    },
  });
}

export function setBase(material, rgba, width, height) {
  const t = new THREE.DataTexture(rgba, width, height, THREE.RGBAFormat);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  const old = material.uniforms.uBase.value;
  material.uniforms.uBase.value = t;
  old.dispose();
}

export function setLut(material, table) {
  const t = material.uniforms.uLut.value;
  t.image.data.set(table);
  t.needsUpdate = true;
}

export function setCountryRaster(material, ids, width, height) {
  const t = new THREE.DataTexture(ids, width, height, THREE.RedIntegerFormat, THREE.UnsignedShortType);
  t.internalFormat = 'R16UI';
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  material.uniforms.uCountries.value.dispose();
  material.uniforms.uCountries.value = t;
}

// colours: Uint8Array of RGBA for country index 0..n (entry 0 unused).
export function setCountryColours(material, colours) {
  const n = colours.length / 4;
  const t = new THREE.DataTexture(colours, n, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  material.uniforms.uCountryColours.value.dispose();
  material.uniforms.uCountryColours.value = t;
}

// A cache of field textures, keyed by product, variable and time index.
export class FieldTextures {
  constructor(limit = 24) {
    this.limit = limit;
    this.map = new Map();
  }

  get(product, name, index) {
    const key = `${product.meta.name}/${name}/${index}`;
    let t = this.map.get(key);
    if (t) { this.map.delete(key); this.map.set(key, t); return t; }
    const values = product.slice(name, Math.max(0, index));
    const data = new Float32Array(values.length);
    for (let i = 0; i < values.length; i++) data[i] = values[i] === values[i] ? values[i] : GPU_MISSING;
    t = floatTexture(product.grid.nlon, product.grid.nlat, data);
    this.map.set(key, t);
    if (this.map.size > this.limit) {
      const [k, old] = this.map.entries().next().value;
      this.map.delete(k);
      old.dispose();
    }
    return t;
  }
}

// Points the material at a field (one variable, or the two components of a vector).
export function setField(material, textures, product, names, bracket) {
  const u = material.uniforms;
  const i0 = Math.max(0, bracket.i0), i1 = Math.max(0, bracket.i1);
  u.uA0.value = textures.get(product, names[0], i0);
  u.uA1.value = textures.get(product, names[0], i1);
  if (names[1]) {
    u.uB0.value = textures.get(product, names[1], i0);
    u.uB1.value = textures.get(product, names[1], i1);
  }
  u.uMix.value = bracket.w || 0;
  const g = product.grid;
  u.uGrid.value.set(g.lon0, g.dlon, g.lat0, g.dlat);
  u.uGridN.value.set(g.nlon, g.nlat, g.periodic ? 1 : 0);
  u.uMode.value = names[1] ? 2 : 1;
}
