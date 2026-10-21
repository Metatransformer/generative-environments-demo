# Generative Environments — Field Notes

**[Open the live demo →](https://generative-environments-demo.vercel.app)** · [Read the article](https://metatransformer.com/blog/building-procedural-environments)


A standalone public Three.js study of deterministic terrain, ecological scatter, and footprint-aware structure placement. It is inspired by the publicly described environment-generation principles behind Nick Bryant's [*The Lower Worlds I: Valenfeld* on itch.io](https://metatransformer.itch.io/the-lower-worlds-i-valenfeld) and accompanies the article [“Building Procedural Environments”](https://metatransformer.com/blog/building-procedural-environments).

This repository is an original, small educational reimplementation. It is **not** the source of Valenfeld or any other game, is not a direct Godot port, and contains no private assets, production implementation, credentials, prompts, or game lore.

## Run locally

Requires a current Node.js LTS release with npm.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite. The complete verification suite is:

```bash
npm test
npm run typecheck
npm run build
```

`npm run build` passes `--base=./` to Vite, so the output in `dist/` works from a GitHub Pages project subpath. No API key or network service is used by the demo.

## What the study demonstrates

- **Biome profiles supply common slots.** Forest, desert, and alpine profiles tune palette, density, slope/shore rules, prop proportions, and the allowed primitive packs without changing the placement interface.
- **Seeded terrain is reproducible.** A string seed drives an original multi-octave 2D value-noise heightfield with domain warping and broad ridge modulation. The same seed and controls produce the same report and placements.
- **Scatter is constrained, then instanced.** Candidate vegetation and rocks are rejected for water, shore proximity, slope, or minimum spacing. Accepted transforms are rendered with `THREE.InstancedMesh`; the JSON report records attempts, accepted counts, and every rejection reason.
- **PackComposer is data-defined.** Six tiny original packs compose boxes, cylinders, cones, beams, and rings at a shared vocabulary of footprint slots. They are intentionally schematic rather than game assets.
- **GroundMount samples contact, not just the center.** Each camp/ruin samples four rotated footprint corners plus its entrance. It accepts gentle terrain, seats the structure at the lowest corner, limits total contact relief, and rejects an entrance that cannot meet the base within tolerance. The placement overlay reveals those samples.

The hand-authored anchors are the three biome profiles and the six primitive packs. Procedural generation supplies terrain and constrained arrangement between them. This keeps the exercise focused on legible differences instead of unrestricted randomness.

## Controls and report

Choose a text seed and biome, tune relief and density, then regenerate. The orbit camera supports pointer drag and wheel/pinch zoom. Placement contacts and terrain wireframe are independent debug views. Reset restores the authored camera framing. **Export report .json** downloads the exact seed, settings, accepted counts, rejection ledger, constraints, terrain coverage sample, and per-site ground-contact summary for the current generation.

The UI is responsive, all controls have programmatic labels, focus states are visible, status updates use a polite live region, and a clear message replaces the scene when WebGL cannot start or its context is lost.

## Invariants and limits

Vitest exercises the pure generation model rather than the renderer. It proves reproducibility, seed divergence, no underwater plants, per-kind slope bounds, pairwise minimum spacing, and finite footprint/entrance seating for every structure.

This is a bounded browser illustration, not an open-world pipeline:

- the terrain is one 128×128 heightfield, not streamed chunks;
- props are capped at 800 and generated synchronously on regeneration;
- rejection sampling approximates blue-noise spacing but is not a tiled Bridson sampler;
- there is no hydraulic erosion, terrain LOD, persistence, navigation, collision, or gameplay;
- structure packs are deliberately simple primitives with no claim of architectural completeness;
- the terrain-coverage report is a deterministic 24×24 sample, not an exact surface-area integration;
- WebGL performance still depends on the browser and GPU.

The rendering contract is fixed across generations: forward Three.js lighting, opaque PBR-like standard materials, one sun, hemisphere fill, PCF shadows, and ACES filmic tonemapping. Biomes vary content parameters, not the imaging pipeline.

## Provenance

The implementation was written for this public demo from high-level stated principles: seeded placement, environmental constraints, data-defined parts at shared footprint slots, and footprint/entrance-aware grounding. Three.js, OrbitControls, Vite, TypeScript, and Vitest are the only code dependencies. Fonts are loaded from Google Fonts at runtime; system fallbacks are provided. All scene geometry and colors are generated in code.

## License

MIT © 2026 Nick Bryant. See [LICENSE](./LICENSE).

## Deployment

Hosted on Vercel under the Metatransformer account. Run `vercel --prod --scope metatransformer` to publish an authorized update. No environment variables or backend are required.
