// The Sun's stellar neighbourhood in three dimensions, from Hipparcos distances,
// in galactic coordinates (parsecs): x towards the galactic centre, y in the
// direction of galactic rotation, z towards the north galactic pole.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { ICRS_TO_GALACTIC, apply } from '../core/frames.js';
import { starPoints, magnitudeStyle } from '../render/points.js';
import { starRgb } from '../render/colour.js';
import { declutter } from '../render/declutter.js';

export const LY_PER_PC = 3.261563777;
const RING_RADII = [5, 10, 25, 50, 100];
const MAX_NAMED_LABELS = 32;
const NEAREST_LABELS = 6;

const toScene = (g, out = new THREE.Vector3()) => out.set(g[0], g[2], -g[1]);

function label(className, html, onClick) {
  const el = document.createElement(onClick ? 'button' : 'div');
  el.className = className;
  el.innerHTML = html;
  if (onClick) {
    el.type = 'button';
    el.addEventListener('click', (event) => { event.stopPropagation(); onClick(); });
  }
  const object = new CSS2DObject(el);
  object.center.set(0, 0.5);
  return object;
}

export function absoluteMagnitude(mag, distPc) {
  return mag - 5 * Math.log10(distPc / 10);
}

export class NeighbourhoodView {
  constructor({ renderer, container, stars, onSelect }) {
    this.renderer = renderer;
    this.stars = stars;
    this.onSelect = onSelect;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.001, 1e5);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, zoomSpeed: 1.2, minDistance: 0.05 });
    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = 'label-layer';
    container.appendChild(this.labels.domElement);
    this.options = { labels: true, grid: true };
    this.radius = null;
    this.content = new THREE.Group();
    this.scene.add(this.content);
    this.raycaster = new THREE.Raycaster();

    const sun = label('body-label sun', '<span class="dot" style="background:#ffcf7a"></span><span class="name">Sun</span>');
    this.scene.add(sun);
    this.sunLabel = sun;
    this.marker = label('star-marker', '');
    this.marker.center.set(0.5, 0.5);
    this.marker.visible = false;
    this.scene.add(this.marker);
    this.setRadius(20);
  }

  galactic(i) {
    const s = this.stars;
    return apply(ICRS_TO_GALACTIC, [s.xyz[3 * i], s.xyz[3 * i + 1], s.xyz[3 * i + 2]]);
  }

  setRadius(radius) {
    const previous = this.radius;
    this.radius = radius;
    this.content.clear();
    const s = this.stars;
    const indices = [];
    for (let i = 0; i < s.count; i++) {
      if (s.dist[i] <= radius) indices.push(i);
    }
    this.indices = indices;

    const positions = new Float32Array(indices.length * 3);
    const colours = new Float32Array(indices.length * 3);
    const sizes = new Float32Array(indices.length);
    const v = new THREE.Vector3();
    indices.forEach((i, k) => {
      toScene(this.galactic(i), v).toArray(positions, 3 * k);
      const { size, intensity } = magnitudeStyle(absoluteMagnitude(s.mag[i], s.dist[i]), 15);
      const [r, g, b] = starRgb(s.ci[i]);
      colours.set([r * intensity, g * intensity, b * intensity], 3 * k);
      sizes[k] = size;
    });
    this.points = starPoints(positions, colours, sizes, this.renderer.getPixelRatio());
    this.content.add(this.points);

    // Labels: the brightest named stars, and the nearest stars whatever their names.
    this.labelGroup = new THREE.Group();
    const named = indices.filter((i) => s.name(i)).sort((a, b) => s.mag[a] - s.mag[b])
      .slice(0, MAX_NAMED_LABELS);
    const nearest = [...indices].sort((a, b) => s.dist[a] - s.dist[b]).slice(0, NEAREST_LABELS);
    this.labelEntries = [];
    for (const i of new Set([...named, ...nearest])) {
      const text = s.label(i);
      if (!text) continue;
      const object = label('star-label', `<span class="name">${text}</span>`, () => this.onSelect(i));
      toScene(this.galactic(i), object.position);
      this.labelGroup.add(object);
      this.labelEntries.push({ object, text, i });
    }
    this.content.add(this.labelGroup);

    this.grid = new THREE.Group();
    const material = new THREE.LineBasicMaterial({ color: 0xfbe2ee, transparent: true, opacity: 0.09 });
    for (const r of RING_RADII.filter((x) => x <= radius * 1.05)) {
      const pts = [];
      for (let k = 0; k <= 160; k++) {
        const a = (2 * Math.PI * k) / 160;
        pts.push(new THREE.Vector3(r * Math.cos(a), 0, -r * Math.sin(a)));
      }
      this.grid.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), material));
      const tag = label('grid-label', `${r} pc · ${Math.round(r * LY_PER_PC)} ly`);
      tag.position.set(r * Math.cos(-2.2), 0, -r * Math.sin(-2.2));
      this.grid.add(tag);
    }
    const reach = radius * 1.1;
    const axis = new THREE.Line(new THREE.BufferGeometry().setFromPoints(
      [new THREE.Vector3(0, 0, 0), new THREE.Vector3(reach, 0, 0)]),
      new THREE.LineBasicMaterial({ color: 0xff7eb0, transparent: true, opacity: 0.35 }));
    this.grid.add(axis);
    const centre = label('grid-label accent', '→ galactic centre');
    centre.position.set(radius * 0.8, 0, 0);
    this.grid.add(centre);
    const pole = new THREE.Line(new THREE.BufferGeometry().setFromPoints(
      [new THREE.Vector3(0, -reach * 0.5, 0), new THREE.Vector3(0, reach * 0.5, 0)]),
      new THREE.LineBasicMaterial({ color: 0xfbe2ee, transparent: true, opacity: 0.12 }));
    this.grid.add(pole);
    const north = label('grid-label', 'north galactic pole');
    north.position.set(0, reach * 0.5, 0);
    this.grid.add(north);
    this.content.add(this.grid);

    if (previous) {
      this.camera.position.multiplyScalar(radius / previous);
    } else {
      this.camera.position.set(radius * 1.25, radius * 0.75, radius * 1.45);
    }
    this.controls.maxDistance = radius * 8;
    this.controls.target.set(0, 0, 0);
  }

  setOptions(options) {
    Object.assign(this.options, options);
  }

  select(index) {
    this.selected = index;
    if (index == null) { this.marker.visible = false; return; }
    toScene(this.galactic(index), this.marker.position);
    this.marker.visible = true;
  }

  pick(ndc) {
    this.raycaster.params.Points.threshold = this.radius * 0.012;
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObject(this.points, false);
    if (!hits.length) return null;
    hits.sort((a, b) => a.distanceToRay - b.distanceToRay);
    return this.indices[hits[0].index];
  }

  update() {
    this.grid.visible = this.options.grid;
    this.controls.update();
    this.scene.updateMatrixWorld();
    declutter([
      { object: this.sunLabel, text: 'Sun', wanted: true, always: true },
      ...this.labelEntries.map((e) => ({
        object: e.object, text: e.text,
        wanted: this.options.labels || e.i === this.selected, always: e.i === this.selected,
      })),
    ], this.camera, this.width, this.height);
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.labels.setSize(width, height);
  }

  setActive(active) {
    this.controls.enabled = active;
    this.labels.domElement.style.display = active ? '' : 'none';
  }

  render() {
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }

  legend() {
    return `${this.indices.length.toLocaleString('en')} stars within ${this.radius} pc `
      + `(${Math.round(this.radius * LY_PER_PC)} light-years), from Hipparcos parallaxes`;
  }
}
