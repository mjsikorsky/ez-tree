# Branch / Window Lab

Real EZ-Tree geometry driven by **@pixiv/three-vrm-springbone 3.5.5** in full 3D.
Move a foreground test window through the canopy, orbit around the result, and
watch branches yield and recover. The primary trunk remains anchored.

## Run

From the repository root:

```sh
npm ci
npx vite --config labs/window-tree/vite.config.js
```

Open http://127.0.0.1:8172. The lab is isolated under `labs/window-tree/`.
Generator/editor/native source and root dependencies are unchanged.

## Controls

- Drag the background to orbit; scroll/pinch to zoom; right-drag to pan.
- Use Front view to reset the camera, or the +/− buttons to zoom.
- Drag the test window; drag its bottom-right corner to resize it.
- Focus the window and use arrow keys; Shift moves faster.
- Camera gestures and window dragging are separate. Contact uses the current
  camera's right/up plane, so orbit and zoom do not require a front-view mode.
- Try Oak Small, Ash Small, or Pine Small, tune spring strength, per-step drag
  and contact padding, and inspect rest/current spines or the translucent window.
- Sweep across the tree, reverse direction, reset, or export a JSON pose.

The opaque window is simulated inside the page. Real macOS window enumeration
and integration are not present. Contact is a finite camera-space rectangle
extruded along viewing depth; dynamics, lengths, rotations and skinning are 3D.
The window releases each branch when it covers the resting attachment in X;
hysteresis prevents repeated switches. Hidden branches may overlap the window.

## Existing solver, application adapter

The custom angular IK/spring solver has been removed. The dynamics engine is
the pinned, unmodified official Pixiv spring-bone source. It supplies Verlet
inertia, restoring motion, drag, fixed-length projection, collision response,
and quaternion updates. Only tree setup/skinning, finite-window collider shape,
camera projection and release policy are application code.

`vendor/PROVENANCE.md` records version, revision, license and rebuilding. The
compiled runtime is included for offline use; no avatar or VRM model is needed.

This engine supplies spring stiffness, not a hard branch angle limit. The old
bend-limit slider has been replaced with contact padding. Large/impossible
contacts may produce strong bending or residual overlap; full nonpenetration,
continuous collision detection, branch fracture and branch self-collision are
not claimed.

## Verify and package

```sh
node --test labs/window-tree/solver.test.mjs
npx vite build --config labs/window-tree/vite.config.js
node labs/window-tree/standalone.mjs
```

`dist/Branch-Window-Lab.html` opens directly, offline, without a server.
For optional browser regression tests, install Playwright and its Chromium:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node labs/window-tree/browser.test.mjs
```

The browser script can alternatively use `PLAYWRIGHT_MODULE` and
`CHROMIUM_EXECUTABLE_PATH`. It writes `dist/browser-evidence.json`.

See `METAL-HANDOFF.md` and `QA.md` for interfaces and verification limits.
EZ-Tree baseline: `dcf309bd86bd521083d9c70f01f2de45fdc7c457`, MIT.
