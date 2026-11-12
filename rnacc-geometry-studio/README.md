# RNACC Geometry Studio · v0.4

A standalone browser instrument for *The Recurrent Normalized Asymptotic Centers of Correspondence* (Silent Emry, October 2026). Written in plain HTML, CSS and ES-module JavaScript; no framework, build step, or internet dependency.

## Open in VS Code (Live Server)

1. Extract `rnacc-geometry-studio-v0.4.zip`.
2. Open the resulting `rnacc-geometry-studio-v0.4` folder in VS Code.
3. Right-click `index.html` → **Open with Live Server**.
4. If upgrading an existing workspace, back up any modified source files before copying the new `index.html`, `styles.css`, `src/`, `tests/`, and `scripts/` files over the previous version. **The new `src/transport.js` must be included.**
5. Optionally, if you have Node.js installed, run `npm test` (20 unit/integration tests) and `node scripts/examples.js` to regenerate vector examples.

ES modules require Live Server or another static web server; don't rely on opening `index.html` directly via `file://`.

## What's new: exact lowercase-σ transport into τ

v0.3 fitted an entire polygon inside the *incircle* of each τ triangle. **v0.4 replaces that construction entirely**. It transports a **single lowercase σ triangle partition** into each τ frame using an exact scale + rotation (and optionally a reflection). No Σ polygon is embedded into τ and no affine distortion occurs.

### Why τ₁ and τ₃ contain σ₂ₙ, but τ₂ contains σₙ

From the manuscript, θ = π/n, Δ = 2π/n, and the first three prescribed transport contacts occur at:

- τ₁: central angle θ between the α₀ arc start and outer-side contact
- τ₂: central angle Δ = 2θ between the α₁ arc start and inner-side contact
- τ₃: central angle θ between the α₂ arc start and Ωˢ seam contact

Each τ triangle has equal legs (the two corresponding αₖ radii). The reference σ_q triangle has equal legs Γ₀=1/2 and apex angle 2π/q. Therefore:

| τ carrier | Exact reference triangle | Scale multiplier |
|:--|:--|:--|
| τ₁ (k=0) | σ₂ₙ | 2α₀ |
| τ₂ (k=1) | σₙ | 2α₁ |
| τ₃ (k=2) | σ₂ₙ | 2α₂ |

With P₀=(0,0), P₁=(1/2,0), P₂=(1/2 cos(2π/q), 1/2 sin(2π/q)), the unmirrored transport is

```
Tτ(p) = Oτ + (2αₖ) R(aₖ) p
```

where Oτ is the αₖ arc center and aₖ = 0°, 90°, or 180° is the arc start angle. Thus the σ vertices match τ's `(center, start, contact)` **exactly**. The mirrored version first reflects σ about its angular bisector; this swaps `start` and `contact` without changing the triangle itself.

This *geometric similarity* is derivable from the defined contact angles. **Whether an actual physical transport must mirror is not established by those equations.** The Automatic option mirrors only τ₂ as a clearly identified and editable display convention.

### New τ controls

**Transport lowercase σ into τ**

- **Off** — original τ outlines without transported payloads.
- **σ basic** — carry one local σ triangle into each of the three enabled τ triangles in the fundamental sector. Local σ inherits the selected frame, α spiral, Ω directions, Ω depths, and τ linework.
- **σ extended** — everything in Basic, plus carry the same local σ payload into τ triangles located on the selected visible Ω branch chains, through the slider-defined orders 1–12. This realizes a repeatable, **pure-direction r extension** of the fundamental placement.

**Ω branch for τ payload extension**: None / s / f / j / All. This chooses *where* payload copies are carried. It is independent of **Repeat τ in Ω regions** (which controls whether the carrier *outlines* are shown).

**Transport handedness**: Automatic (τ₂ mirrored), Normal, Mirrored. Each mode preserves the exact τ triangle outline and σ proportions.

**Show transported local axes / anchors**: displays the origin Oτ and the two endpoint directions (orange / teal / purple) for inspecting the mapping. Turn this on in sector view for visual validation.

All existing controls continue working: n=4–120, σ/Σ main mode, m, α depth, Ω order s/f/j up to 12, Ω layer visibility, independent τ₁–τ₃ visibility, palette, pan, zoom, Fit, SVG export and deep Ω inspection. Changing a selected layer also changes the *content of the transported σ*.

### Deliberate limits and performance

- This is **one-level payload embedding**. A transported σ can show τ lines, but those inner τ lines **do not themselves spawn further σ payloads** (no uncontrolled fractal recursion).
- Ω directions remain *independent pure-direction chains*: Ωˢᵖ, Ωᶠᵖ and Ωʲᵖ. Ordered mixed words such as `sfsj` are not implemented and no commutativity is assumed.
- The view can omit payloads smaller than the rendering threshold (default 5 screen pixels). That is only a drawing optimization, not a mathematical cutoff.
- SVG payload instances reuse exactly two `<defs>` templates via `<use>`, rather than duplicating whole constructions. A cap of 4,000 instances prevents excessively large output at high n and large orders. If tiny geometries are important, zoom or use a normalized local Ω inspection view.
- Main n remains 4–120. Internal σ₂ₙ templates permit q up to 240.
- The root Ω-region homotheties are inherited from the validated v0.3 construction. Their being placed at the three reference vertices is a modeling convention, not a uniqueness proof.

## Files

| Path | Responsibility |
|:--|:--|
| `index.html` | UI and layer/transport controls |
| `styles.css` | Responsive interface styling |
| `src/math.js` | Normalized manuscript calculations |
| `src/geometry.js` | α quarter-circles, Ω chains, τ carrier triangle coordinates, fitting |
| `src/transport.js` | **New:** exact τ↔σ similarity/reflection, state mapping and branch selection |
| `src/render.js` | Reusable SVG σ templates, source and Ω branch transported payloads, projection |
| `src/app.js` | UI state, camera, controls and export |
| `tests/geometry.test.js` | 20 tests, including n=4…120 carrier similarity, mirror and SVG integration |
| `scripts/examples.js` | Four editable example SVG exports |

## Suggested visual checks

- `n=6`, σ, **σ basic**, α depth≥3, all three τ on: compare the three interior σ copies against `sigma_Tau6-nest.pdf`.
- `n=9`, σ, **σ extended**, transport=s, s=12: examine recurring τ payloads down the s direction, then use Ω inspection for very small orders.
- `n=9`, Σ, **σ extended**, transport=All: observe the same local carriers repeated across all nine phases.
- Try **Normal** and **Mirrored** while the local axes overlay is on; the carrier outline remains fixed but internal spiral handedness reverses.

The accompanying `CHANGELOG.md` documents the precise changes from v0.3.
