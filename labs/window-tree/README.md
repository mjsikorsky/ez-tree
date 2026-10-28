# Branch / Window Lab

An isolated deformation experiment using actual EZ-Tree meshes. Drag the test
window into the canopy: branches lift toward the top edge and recover when the
window covers their attachment or moves away. The primary trunk stays fixed.

## Run

From the repository root, with Node 20.19+ or 22.12+:

```sh
npm ci
npx vite --config labs/window-tree/vite.config.js
```

Open http://127.0.0.1:8172. This does not launch or modify the standalone editor.
No native app, Metal renderer, or macOS permission is needed for this lab.

## Use

- Drag anywhere on the test window; drag its bottom-right corner to resize it.
- Focus the window and use arrow keys; Shift moves faster.
- Sweep across the tree, reverse mid-drag, or move past the trunk.
- Try Ash Small, Oak Small, and Pine Small.
- Tune spring strength, damping and maximum accumulated bend per branch.
- Show resting/current centerlines and make the window translucent for diagnosis.
- Export a JSON pose with rest geometry, attachments, angles, velocity, window,
  metrics, generation preset, seed, and source revision.

The foreground window is simulated inside this page. It does not read or collide
with real operating-system windows yet. The mesh remains 3D; contact/deformation
is solved in XY with Z preserved. This is a 2.5D motion study.

## Validate and build

```sh
node --test labs/window-tree/solver.test.mjs
npx vite build --config labs/window-tree/vite.config.js
node labs/window-tree/standalone.mjs
```

The last command produces `labs/window-tree/dist/Branch-Window-Lab.html`, which
can be opened directly without a server or network. Generated `dist` files do
not need to be committed.

## Ownership boundary

All additions are under `labs/window-tree/`. Production generator files, build
scripts, root package files, and the Metal conversion are untouched. Work on
the native renderer can continue independently. See `METAL-HANDOFF.md` for the
portable simulation and rendering interface.

Upstream baseline: dgreenheck/ez-tree, commit
`dcf309bd86bd521083d9c70f01f2de45fdc7c457` (MIT; repository LICENSE).
