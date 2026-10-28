# Spring-bone migration verification

Engine: official unmodified `@pixiv/three-vrm-springbone` 3.5.5, pinned revision
`3caf7a21ee68f0d5dfa363ab3d577450bbf60136`.

## Temporal regression

The old custom solver, with a stationary window at stage X=230, produced a
maximum tip jump of 3.034 world units in one 1/120 s step and 123 binary release
flips in the measured hold interval. The old tests did not check temporal motion.

The new browser regression covers X=180/230/270/320 on Oak Small (81 branches,
361 spring joints), Ash Small (56/554), and Pine Small (92/910). Each placement
uses 1,000 settling steps then measures consecutive XYZ tip movements. Assertions:

- No release transitions with a held window.
- Maximum measured tip step below 0.001 world units.
- Full 3D segment-length error below 1e-10 world units.

An exploratory 1,500-step run measured 0.000003835 world units maximum held tip
step for Oak X=230, with zero release transitions; the largest held tip step over
all 12 placements was 0.000009345. Settling is allowed: these are not bounds on
initial contact transients or high-speed/teleported collider movement.

The final scripted 1,300-step hold run passed all 12 placements, with maximum
measured tip step 0.000009458 world units and no held-window release switches.
All listed browser controls passed. The final offline build also passed orbit,
zoom and projected-contact checks, with zero page errors or network requests.

## Additional checks

Seven Node test groups exercise actual engine joints, left/right lifting, fixed
trunk and full 3D lengths, rest-based release/hysteresis, recovery, XYZ attachment
tracking, camera-oriented finite collider normals, temporal settling and
deterministic reset/export. Invalid timesteps are rejected.

Browser checks exercise all three presets, background orbit, wheel zoom,
right-drag pan, front reset and zoom buttons, collision after camera rotation,
independent window drag, corner resize, keyboard movement, three sliders, three
diagnostic toggles, pose export, reset, sweep/reversal, and narrow viewport.
The browser script writes measured results into `dist/browser-evidence.json`.

Production build and offline HTML are verified separately. Browser tests run
with software WebGL in headless Chromium; their CPU timings do not measure Mac
or Metal performance. Validation uses available Vite 6.4.5 / Three.js dependencies;
root package files are unchanged. Native macOS windows and Metal are not tested.
