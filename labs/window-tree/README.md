# Branch / Window Lab

EZ-Tree geometry driven by **Rapier 3D 0.21.0**. Drag the test window through the canopy; branches bend against it, release when it covers their trunk attachment, and recover behind it. The primary trunk stays fixed.

## Run

From the repository root:

```sh
npm ci
npx vite --config labs/window-tree/vite.config.js
```

Open http://127.0.0.1:8172. All lab code and vendored physics are isolated under `labs/window-tree/`.

## Controls

- Drag the background to orbit, scroll to zoom, right-drag to pan.
- Front view resets the camera; +/− zoom.
- Drag the test window or its bottom-right resize handle.
- Focus the window and use arrow keys; Shift moves faster.
- Choose Oak Small, Ash Small or Pine Small; tune native joint stiffness, damping and contact padding.
- Inspect original/current skeletons, sweep, reset, or export a v3 JSON pose.

This is an in-page test window. OS window enumeration is a separate integration. Contacts use a camera-oriented solid box extruded through viewing depth.

## Physics

Rapier owns rigid-body integration, capsule/box contacts, contact normals, impulses, joints and restoring motors. Each generated branch uses at most two capsule links, joined through native spherical joints with three angular restoring motors. This candidate has no hard angular limits. There is no custom IK, positional projection or spring integration.

The adapter supplies original-mesh skinning and an application release policy. Each primary limb and all descendants share ACTIVE / OCCLUDED / WAIT_CLEAR state. Contacts release before the window reaches the fixed attachment. They re-enable only after Rapier confirms every capsule in the limb is clear. That policy runs at every native substep, including intermediate window positions during a center crossing.

Simulation uses 0.1 meters per tree unit, 1/120-second outer ticks, normally four native substeps and additional substeps for fast cursor movement. The moving box uses kinematic targets. Native joint motors restore the rest pose. See `SOURCES.md` for official examples and implementation lessons.

The physics proxy is intentionally coarse. Fast or impossible contacts can still produce strong motion, native joint error or visual overlap; exact mesh nonpenetration is not claimed. Branch self-collision, fracture and dynamic-body CCD are disabled. This is a CPU/WASM experiment, not Metal physics.

## Verify and package

```sh
node --test labs/window-tree/solver.test.mjs
node labs/window-tree/browser.test.mjs
npx vite build --config labs/window-tree/vite.config.js
node labs/window-tree/standalone.mjs
```

The browser suite requires Playwright/Chromium, or the environment variables `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE_PATH`. It writes `evidence/browser-evidence.json`. The generated `dist/Branch-Window-Lab.html` opens offline without a server.

See `QA.md`, `METAL-HANDOFF.md` and `vendor/PROVENANCE.md`.

Install and run this isolated lab: `cd labs/window-tree && npm ci && npm run dev`. Build the offline HTML with `npm run build`. Rapier 0.21.0 is pinned in package-lock.json.
