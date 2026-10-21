# Celestial Atlas

*Status: draft (2026-10-22). Kind: tool. Field: astronomy.* See [ADR 0011](../../../development/decisions/0011-first-application-celestial-atlas.md).

The Celestial Atlas shows the Sun, the Moon, the planets and the stars at any instant from 1849 to 2150, or live. It has four views:

| View | What it shows |
|---|---|
| Solar System | A 3D heliocentric view in the ecliptic frame of J2000, with DE440 positions and osculating orbits. Body sizes can be enlarged; the legend states by how much. |
| Neighbourhood | Stars within 5–100 pc, placed at their Hipparcos distances, in galactic coordinates |
| Sky Chart | The sky for any place and time, as a star-atlas chart. It shows stars to magnitude 7, the constellations, the ecliptic, the planets and the Moon in its phase. Refraction is applied, and the sky is tinted for day and twilight. Constellation names can be shown in Latin, English, Chinese or Japanese. |
| Orbits | The planets seen from the north ecliptic pole, with lines of sight from the Earth and a table of distances and elongations |

## 1. Running

From the repository root:

```
python data/acquisition/fetch.py          # once: DE440, HYG and constellations into data/cache/
python data/products/star_catalog.py      # once: the derived star catalogue
python applications/astronomy/celestial-atlas/serve.py --open
```

The page also loads three.js from jsDelivr and the Source Serif 4 font from Google Fonts.

## 2. Data

| Data | Source | Licence |
|---|---|---|
| Sun, Moon, planets | JPL DE440 (Park et al. 2021), SPK kernel `de440s.bsp` from NAIF | Distributed freely; cite the reference |
| Stars | HYG Stellar Database v4.1: Hipparcos, Yale Bright Star and Gliese catalogues | CC BY-SA 4.0 |
| Constellations | d3-celestial, Olaf Frohn | BSD 3-Clause |

The manifests are in `data/registry/`.

## 3. Method

- **Time.**
  - From 1972, TT = UTC + (TAI − UTC) + 32.184 s, using the leap-second table.
  - TDB is TT plus its main periodic term.
  - UT1 is taken to be UTC.
  - Before 1972, ΔT follows Espenak and Meeus (2006).
- **Ephemeris.** The atlas reads DE440's type-2 Chebyshev segments directly from the SPK kernel. It then chains them to the solar-system barycentre, for example Moon = (Earth–Moon barycentre) + (Moon relative to that barycentre).
- **Apparent places.**
  - **Applied:** light-time, IAU 1976 precession, GMST (IAU 2006), topocentric parallax on WGS 84, and Saemundsson refraction.
  - **Not applied:** aberration, nutation and light deflection. Leaving them out keeps the error well under 1′.
- **Orbits.** Osculating two-body conics are computed from the state vector. The Earth's orbit uses the state of the Earth–Moon barycentre.

## 4. Verification

```
node applications/astronomy/celestial-atlas/tests/run-tests.mjs
```

The suite runs 37 checks:

| Quantity | Reference | Agreement |
|---|---|---|
| Positions, 1850–2150 | JPL Horizons (DE441) | Better than 1 mm for the planets; 18 m for the Moon |
| Geocentric astrometric directions | JPL Horizons | Within 0.05″ |
| GMST, precession, horizontal coordinates | Meeus's worked examples | Within the stated tolerances |

The reference values are in `tests/fixtures/horizons.json`. To regenerate them, run `tests/fetch_fixtures.py`.

## 5. Structure

The computation in `src/core/` is a provisional stand-in for the laboratory's C++ core ([ADR 0011](../../../development/decisions/0011-first-application-celestial-atlas.md)). Each file names the module it anticipates.

The views are written directly with three.js and Canvas. The scene model for `visualization/` will be extracted from them.

| Path | Role | Stands in for |
|---|---|---|
| `src/core/time.js` | Time scales, Earth rotation angle, GMST | `core/metrology` (time) |
| `src/core/frames.js` | Rotations, precession, horizon, refraction | `core/metrology` (frames) |
| `src/core/spk.js` | DE440 reader and evaluator | `core/domains/astronomy` (ephemerides) |
| `src/core/sky.js` | Apparent places, elongation, phase | `core/domains/astronomy` (positional) |
| `src/core/kepler.js` | Osculating orbits | physis (mechanics) |
| `src/core/bodies.js` | Radii, GM, poles, colours | `core/domains/astronomy` |
| `src/data/catalog.js` | Loads the data products | — |
| `src/render/` | Palette, star points, label placement | `visualization/styles`, `renderers` |
| `src/views/` | The four views | `visualization/renderers` |
| `serve.py` | Local server (standard library) | — |

## 6. Limits

- **Time scales.** UT1 − UTC (under 0.9 s) and future leap seconds are not modelled.
- **Star positions.** Stars are drawn at their J2000 positions, without proper motion. Most stars move only a few arcseconds over decades; Barnard's Star moves 10″ a year.
- **Kernel size.** The browser loads the 32 MB DE440 kernel. A public deployment would need a subset of the years.
