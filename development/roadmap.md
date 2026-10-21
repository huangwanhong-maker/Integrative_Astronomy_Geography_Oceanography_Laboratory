# Roadmap

*Status: draft, 2026-10-21.* The phases are ordered intentions, not commitments. Revise them as the work teaches us.

## Phase 0. Foundations

- **Repositories.** Create calx, morphe and physis on GitHub, then push all four repositories.
- **Names.** Confirm the library names. Settle the laboratory's name ("Geography" or "Geometry") and its C++ namespace.
- **C++ toolchain.** As of 2026-10-21, the Windows side has no C++ compiler and no CMake. The options are the MSVC Build Tools, LLVM/clang, or WSL.
- **Build.**
  - A CMake superbuild across `lib/` and `core/`.
  - A C++ test framework.
  - Python bindings.
  - pytest.
  - Continuous integration in every repository.
- **Conventions.** A glossary in the laboratory and in each library, with the orientation and normalisation conventions. A `references.bib`.

## Phase 1. First Vertical Slice: Sun, Moon, Earth and the Tides

This slice touches every repository at small scale, and also touches astronomy, geometry and oceanography. Atmospheric tides are a natural extension.

| Step | Repository and layer | Work |
|---|---|---|
| 1 | physis `units`; laboratory `metrology` | Units; the time scales UTC, TAI, TT, TDB and UT1; frames for the Sun and the Moon |
| 2 | calx `numerics`; physis `geometry` | Chebyshev evaluation and associated Legendre functions; rotations |
| 3 | laboratory `domains/astronomy`, `data` | An evaluator for the JPL DE format; a registry entry for DE440 |
| 4 | physis `gravitation`; laboratory `domains/tides` | Spherical-harmonic potential theory; the tide-generating potential; the equilibrium tide; Doodson arguments |
| 5 | calx `compute` | A minimal IR and CPU reference interpreter. The first IR kernel is the equilibrium tide on a global grid. |
| 6 | laboratory `inference`, `data` | Least-squares harmonic analysis of a real NOAA tide-gauge record |
| 7 | laboratory `visualization` | Scene model v0, a static renderer and a web renderer, showing the Earth–Moon system with the tidal bulge |
| 8 | laboratory `validation` | The ephemeris checked against JPL Horizons; the tides checked against NOAA predictions |
| 9 | theory, in the laboratory and the libraries | A note for each derivation used |

## Phase 2. Breadth and a Second Device

- **calx: a second backend.** Either CUDA (on the RTX 3050 Ti) or SYCL with Level Zero (on the Iris Xe). This tests whether the stack really is retargetable.
- **morphe: two slices.**
  - Arithmetic, then algebra (Smith normal form), then topology (homology of cell complexes). This is the foundation for discrete exterior calculus in physis.
  - A research slice: partition refinement and bisimulation.
- **physis: a shallow-water model on the rotating sphere.** It serves both ocean tides and atmospheric waves, and runs on both backends.
- **Laboratory.**
  - An energy-balance model driven by a Milankovitch insolation calculation.
  - The first labs: an orbital sandbox, a digital tide-predicting machine, and a sight-reduction trainer.

## Phase 3. Research Capacity

- **Ocean dynamics beyond tides:** circulation, waves, seawater thermodynamics and biogeochemistry.
- **Atmospheric dynamics:** a dry dynamical core first, then moist processes and radiation.
- **Coupling:** the atmosphere and ocean coupled through `air_sea`, leading towards a simple coupled climate model.
- **Inference:** data assimilation and uncertainty quantification.
- **Machine learning:** surrogate models.
- **Observation and field work.**
- **Visualization:** star and galaxy catalogues at full scale in the renderers.
