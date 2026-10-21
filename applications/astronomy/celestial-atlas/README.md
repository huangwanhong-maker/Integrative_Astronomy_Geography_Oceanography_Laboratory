# Celestial Atlas

*Status: draft (2026-10-22). Kind: tool. Field: astronomy.* Decision records: [ADR 0011](../../../development/decisions/0011-first-application-celestial-atlas.md), [ADR 0013](../../../development/decisions/0013-galaxies-and-their-relations.md).

The Celestial Atlas shows the Sun, Moon, planets, stars and galaxies, at any instant from 1849 to 2150 or live. It is organised as five views, from the Solar System out to the cosmic web.

| View | What it shows |
|---|---|
| Solar System | A 3D heliocentric view in the ecliptic frame of J2000, with DE440 positions and osculating orbits. Bodies can be enlarged by a stated factor. |
| Neighbourhood | Stars in 3D at their measured distances, in galactic coordinates, from a chosen catalogue: HYG (Hipparcos) or any fetched Gaia DR3 subset. The radius ranges from 5 to 5000 pc. |
| Galaxies | Galaxies and the relations between them, in supergalactic coordinates:<ul><li>**Local Volume** (UNGC): each galaxy is linked to its main disturber, with tidal groups and a Hubble-flow diagram.</li><li>**Local Universe** (2MRS groups): galaxies are linked to their group centres, with named clusters and a mass–light diagram.</li></ul> |
| Sky Chart | The sky for any place and time, drawn as a star atlas, with constellations named in Latin, English, Chinese or Japanese, the Moon in its phase, and the planets |
| Orbits | The planets seen from the north ecliptic pole, with lines of sight and their configuration |

## 1. Running

From the repository root:

```
python data/acquisition/fetch.py                                    # DE440, HYG, constellations
python data/products/star_catalog.py                                # HYG star product
python data/acquisition/fetch.py gaia-dr3 --profile small           # optional: Gaia subset
python data/products/star_catalog.py --source gaia-dr3 --profile small
python data/acquisition/fetch.py ungc tully-2mass-groups            # galaxies
python data/products/galaxy_catalog.py --source ungc
python data/products/galaxy_catalog.py --source tully-2mass-groups  # names from SIMBAD, cached
python applications/astronomy/celestial-atlas/serve.py --open
```

The page also loads three.js from jsDelivr, and the Source Serif 4 font from Google Fonts.

To choose which part of a catalogue to fetch, and how much of it, see `python data/acquisition/fetch.py --list` and [data/registry](../../../data/registry/README.md).

## 2. Data

| Data | Source | Licence |
|---|---|---|
| Sun, Moon, planets | JPL DE440 (Park et al. 2021), SPK kernel from NAIF | Freely distributed; cite |
| Stars | HYG v4.1 (Hipparcos, Yale, Gliese); Gaia DR3 with Bailer-Jones distances | CC BY-SA 4.0; CC BY-SA 3.0 IGO |
| Constellations | d3-celestial, O. Frohn | BSD 3-Clause |
| Local Volume galaxies | Updated Nearby Galaxy Catalog (Karachentsev et al. 2013), CDS VizieR | Published catalogue; cite |
| Galaxy groups | Tully (2015), from the 2MASS Redshift Survey (Huchra et al. 2012), CDS VizieR | Published catalogue; cite |
| Galaxy and cluster names | SIMBAD (CDS), resolved at build time | Cite SIMBAD |

## 3. Method

- **Time.**
  - From 1972, TT = UTC + (TAI − UTC) + 32.184 s.
  - TDB is TT plus its main periodic term.
  - UT1 is taken equal to UTC.
  - Before 1972, ΔT follows Espenak and Meeus (2006).
- **Ephemeris.** DE440's type-2 Chebyshev segments are read directly from the SPK kernel and chained to the barycentre.
- **Apparent places.**
  - **Applied:** light-time, IAU 1976 precession, GMST (IAU 2006), topocentric parallax and refraction.
  - **Not applied:** aberration, nutation and deflection, which together amount to under 1′.
- **Orbits.** Osculating two-body conics, computed from state vectors.
- **Galaxies.** The theory is in [theory/astronomy/galaxy-relations.md](../../../theory/astronomy/galaxy-relations.md).
  - Positions use supergalactic coordinates.
  - The tidal index Θ₁ = max log(M/D³) − 10.96 is recomputed, along with each galaxy's main disturber.
  - The Milky Way's missing luminosity is inferred from the published indices of its satellites.
  - Tidal groups are the connected components of the relations with Θ₁ > 0.
  - The Hubble flow is drawn with H₀ = 73 km s⁻¹ Mpc⁻¹.
  - Group distances in Tully (2015) are kinematic, in h⁻¹ Mpc, and are labelled as such.

## 4. Verification

```
node applications/astronomy/celestial-atlas/tests/run-tests.mjs
```

There are 47 checks.

| Quantity | Reference | Agreement |
|---|---|---|
| Positions, 1850–2150 | JPL Horizons (DE441) | < 1 mm for the planets, 18 m for the Moon |
| Geocentric astrometric directions | JPL Horizons | < 0.05″ |
| GMST, precession, horizontal coordinates | Meeus, worked examples | Within the stated tolerances |
| Supergalactic directions, 43 036 galaxies | Tully (2015) | Median 0.00012°, maximum 0.0096° (one listed anomaly) |
| Main disturbers, 770 galaxies | Karachentsev et al. (2013) | 99.2 % identical |
| Tidal index Θ₁ | Karachentsev et al. (2013) | Median difference 0.027 dex |

## 5. Structure

The computation in `src/core/` is a provisional stand-in for the laboratory's C++ core ([ADR 0011](../../../development/decisions/0011-first-application-celestial-atlas.md)).

| Path | Role | Stands in for |
|---|---|---|
| `src/core/time.js` | Time scales, Earth rotation angle, GMST | `core/metrology` (time) |
| `src/core/frames.js` | Rotations, precession, horizon, galactic and supergalactic frames | `core/metrology` (frames) |
| `src/core/spk.js` | DE440 reader and evaluator | `core/domains/astronomy` |
| `src/core/sky.js` | Apparent places, elongation, phase | `core/domains/astronomy` |
| `src/core/kepler.js` | Osculating orbits | physis (mechanics) |
| `src/core/galaxies.js` | Tidal index, main disturbers, inferred masses, tidal groups | `core/domains/astronomy` |
| `src/data/catalog.js` | Loads products: stars, constellations, galaxies | — |
| `src/render/` | Palette, star points, label placement | `visualization/` |
| `src/views/` | The five views and the galaxy diagrams | `visualization/renderers` |

## 6. Limits

- UT1 − UTC and future leap seconds are not modelled.
- Star positions are drawn at their catalogue epoch, without proper motion.
- Gaia subsets taken brightest-first are limited by magnitude, not complete within a distance.
- The browser loads the 32 MB DE440 kernel.
