# Verification

## Automated checks

`node --test labs/window-tree/solver.test.mjs` covers:
- SHA-256 of the exact Rapier 0.21.0 bundle.
- Native joint motor API presence, fixed trunk and rest stability.
- Moving kinematic contact and recovery.
- Whole-limb release, delayed clearance-based reactivation and no overlapped re-entry.
- Center reversal/resizing with finite native state and bounded anchor error.
- Reset collider dimensions, preserved settings, export schema and timestep validation.

`browser.test.mjs` tests real generated Oak Small, Ash Small and Pine Small:
left-to-right, right-to-left, reversal and changing width through the center.
It records maximum tip step, displacement and native anchor error; checks all
reactivations have native clearance >0.003 m; and bounds native anchor error to
0.15 render units during these tests. See `evidence/browser-evidence.json` for measured results.

The same suite exercises orbit, wheel zoom, pan, front reset, zoom buttons,
collision after orbit, independent window dragging, resizing, keyboard control,
sliders, display toggles, pose export, reset and 390px layout. Page exceptions fail the suite.

## Acceptance limits

These checks establish repeatable native simulation and protected re-entry for
the tested trajectories. They do not prove zero visual overlap, zero motion
discontinuity under arbitrary input, exact mesh collision, or real-tree material
accuracy. The reduced two-link proxies and native impulse-joint tolerances remain
visible limitations. CPU cost depends on preset and hardware.

Current spherical candidate: six solver tests and all 12 browser crossing cases passed, with maximum anchor error 0.0006011433 world units. All 16 control checks passed.
