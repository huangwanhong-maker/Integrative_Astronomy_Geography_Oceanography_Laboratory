# Integrative Astronomy, Geography, Oceanography Laboratory

This is a long-term programme to learn, use and research astronomy, geography, oceanography and meteorology as one connected body of knowledge, in both theory and practice. Geometry, mathematics and physics form the shared foundation.

## Abstract

**English.** This project studies astronomy, geography, oceanography and meteorology as one connected body of knowledge, in theory and in practice. Geometry, mathematics and physics form their shared foundation. The fields share spherical geometry, coordinate systems, the rotation group, potential theory, harmonic analysis and the dynamics of rotating, stratified fluids. They meet in concrete phenomena: tides, navigation, the figure and mapping of the Earth, the coupled exchange between ocean and atmosphere, and the astronomical forcing of climate. New ideas will keep emerging and evolving, so the project is designed throughout to be modular, extensible and revisable.

**中文.** 本项目是一个长期的综合计划，以几何学、数学与物理学为共同基础，把天文学、地理学、海洋学与气象学作为一个相互联系的知识整体，从理论与实践两方面加以学习、应用和研究。这些领域共享球面几何、坐标系、旋转群、位势理论、调和分析以及旋转层结流体动力学，并在潮汐、导航、地球的形状与测绘、海洋与大气的耦合交换以及气候的天文强迫等现象中交汇。由于新的想法会不断涌现和演化，本项目以模块化、可扩展、可修订为总体设计原则。

**日本語.** 本プロジェクトは、幾何学・数学・物理学を共通の基盤として、天文学・地理学・海洋学・気象学を一つのつながった知識体系として、理論と実践の両面から学び、使い、研究するための長期的な総合プログラムである。これらの分野は球面幾何学、座標系、回転群、ポテンシャル論、調和解析、回転成層流体の力学を共有し、潮汐、航法、地球の形状と地図化、海洋と大気の結合した交換、気候の天文学的強制といった現象において交わる。新しい着想が絶えず生まれ発展していくことを前提に、モジュール性・拡張性・改訂可能性を全体の設計原則とする。

## 1. Motivation and Scope

These subjects are usually taught apart, yet shared structure binds them together.

- **Spheres and rotations.** The geometry of the sphere and of rotations underlies all of these fields.
  - The celestial sphere, the figure of the Earth, and the ocean and atmosphere (thin fluid shells on a rotating sphere) are all described in this language.
  - Changes of reference frame are elements of SO(3).
  - Fields on the sphere expand in spherical harmonics, which carry the irreducible representations of SO(3).
- **Tides join astronomy to oceanography.**
  - The Moon and the Sun set up a tide-generating potential, and the ocean responds to it.
  - Each tidal constituent oscillates at a frequency that is an integer combination of six fundamental astronomical frequencies (Doodson's expansion).
  - The tidal spectrum therefore carries a lattice structure.
- **Geography maps the surface on which the other fields meet.**
  - Its maps rest on geodesy and on map projections.
  - Its climatic zones follow from the way sunlight is distributed over the sphere.
  - Its coasts are where land, sea and air meet.
  - Its satellites observe all of these at once.
- **Navigation joins astronomy to geography.** A position at sea is fixed from star sights by solving a spherical triangle, using an almanac computed by positional astronomy. The resulting route is then drawn on a chart.
- **Ocean and atmosphere form one coupled fluid system.**
  - Both obey the equations of rotating, stratified flow.
  - They exchange momentum, heat, freshwater and gases at the sea surface.
  - Phenomena such as ENSO and the monsoons exist only in the coupled system.
  - Both are driven by sunlight. Astronomy sets how that sunlight is distributed over the Earth, and how the distribution changes slowly over millennia (the Milankovitch cycles).

The project serves three activities:

- **Learning:** derivations, worked examples and expositions.
- **Use:** tested computational tools whose results can be relied on.
- **Research:** open questions, and new results built on the first two.

The scope of the fields:

- **Geography** covers all its branches: physical geography, cartography and GIS, remote sensing, human geography, and others as the work requires.
- **Meteorology** is taken in the broad sense of atmospheric science.
- **Geodesy** supports all four fields.
- **Bridges.** Tides, navigation, air–sea interaction and climate bridge the fields.
- **Future fields.** Fields such as geophysics and the cryosphere may join as the work grows.

## 2. Design Philosophy

The project will grow over a long time and will change direction as understanding deepens. Five principles govern its construction.

### 2.1 Modularity

- The project is built as layers, and its dependencies point only downward.
- General knowledge lives in independent libraries, each in its own repository:
  - numerics and computation;
  - mathematical structures;
  - geometry and physics.
- The libraries and the laboratory's core are pure computation. They have no network, instruments or user interface.
- Data acquisition, observation, visualization and applications sit at the edges and call into the core.

### 2.2 Extensibility

- Adding a field, a method, a device or a presentation technique means adding a module, not rewriting existing ones.
- Computing hardware and presentation media change constantly. In both, a stable, device-neutral representation separates *what* is done from *how* it is realised. Each technology is then a plug-in backend.

### 2.3 Revisability

- Every module and note carries a status: `planned`, `seed`, `draft`, `stable` or `deprecated`.
- Significant decisions are recorded together with the alternatives considered, so that they can be revisited deliberately.
- Ideas are captured early and promoted once they mature.

### 2.4 Unity of Theory and Computation

- Every implemented formula cites its derivation or source.
- Every theoretical result that can be checked numerically is checked by code.

### 2.5 Verifiability

- Numerical results are validated against authoritative references, such as IAU SOFA/ERFA, JPL Horizons, the IERS Conventions and NOAA tide predictions.
- Units, time scales and reference frames are always explicit.

## 3. Architecture

The project spans four repositories. The laboratory composes three independent C++ libraries:

| Library | Scope |
|---|---|
| [**calx**](https://github.com/huangwanhong-maker/calx) | A retargetable computation stack in the manner of TVM, Halide and MLIR (representation, schedule, compiler, runtime, scheduler, backends), together with numerical methods. A computation is written once. It then runs on the CPU, which is the reference backend, and on any device for which a backend exists, including devices not yet invented. |
| [**morphe**](https://github.com/huangwanhong-maker/morphe) | Mathematical structures and their equivalences: exact arithmetic, algebra, category theory, topology, algebraic geometry, and formal structures such as automata, grammars and rewriting systems. It also covers notions of sameness such as bisimulation and bimorphism. |
| [**physis**](https://github.com/huangwanhong-maker/physis) | Geometry and theoretical physics: units, differential geometry, structure-preserving discretisation, mechanics, gravitation, thermodynamics, geophysical fluid dynamics, chemistry and radiation |

```
Edges        applications · visualization · observation · data
                    │
core/        inference · domains · metrology            (the laboratory's own library)
                    │
lib/         physis ──► calx
                └─────► morphe                          (calx and morphe are independent)
```

The domains are the fields investigated together:

- **Fields:** astronomy, geography, oceanography and meteorology, supported by geodesy.
- **Bridges:** tides, navigation, air–sea interaction and climate.

`applications/` mirrors the same fields and bridges, holding labs and tools for each. Visualization is a representation layer: a device-neutral scene model, with one renderer per technique.

For more detail:

- Full design: [docs/architecture.md](docs/architecture.md).
- Decisions: [development/decisions/](development/decisions/).
- Plan: [development/roadmap.md](development/roadmap.md).

## 4. Organisation of the Repository

```
.
├── lib/                   calx · morphe · physis (git submodules)
├── core/
│   ├── metrology/         time scales · reference frames · Earth orientation
│   ├── domains/           astronomy · geography · oceanography · meteorology · geodesy
│   │                      tides · navigation · air_sea · climate
│   └── inference/         estimation · filtering · assimilation · uncertainty · learning
├── applications/          labs and tools, one folder per field and bridge
├── data/                  dataset registry · acquisition · formats · provenance
├── observation/           instruments · field work
├── visualization/         scene model · renderers · styles
├── validation/            reference values · standard problems · benchmarks
├── theory/                notes on fields and bridges
├── notebooks/             exploration and teaching
├── research/              questions · experiments · papers
├── docs/                  architecture
├── development/           ideas · decisions · roadmap
└── assets/                images · fonts · style tokens
```

To clone the repository together with its libraries:

```
git clone --recurse-submodules https://github.com/huangwanhong-maker/Integrative_Astronomy_Geography_Oceanography_Laboratory.git
```

Every directory has a README describing its purpose and planned modules. [`CLAUDE.md`](CLAUDE.md) gives the working conventions and lists the decisions that are still open.

## 5. Status

**Foundational stage (2026-10-22).** The architecture is designed, and the four repositories are scaffolded and published. There is no code yet.

The next step is Phase 0 of the [roadmap](development/roadmap.md): the toolchain and the build.

## 6. License

The project is released under the MIT License. See [`LICENSE`](LICENSE).
