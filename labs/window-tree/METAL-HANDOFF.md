# Metal agent handoff

All changes are isolated under `labs/window-tree/`; keep the generator/editor/native conversion independent.

## Data boundary

`BranchSolver(tree.skeleton)` consumes each branch's rest sections: origin {x,y,z}, radius. Parents are resolved against earlier generated branches. Branch 0 is the fixed trunk. Descendants inherit the release group of their top-level limb.

`step(1/120, rect)` accepts a rectangle in the current camera right/up plane. `setFrame({origin,right,up})` supplies that plane. Native window targets interpolate through substeps.

Each section exposes a THREE.Matrix4 rest-to-current rigid transform in `branches[b].transforms[s]`, plus current `points`. `adapter.js` maps original bark rings and leaf quads to these transforms. A Metal renderer can consume equivalent matrices and original mesh bindings without adopting the browser UI.

## Native physics

Rapier 0.21.0, zero gravity, 0.1 m per render unit. At most two capsule links per generated branch; one spherical joint per link, native angular position motors on three axes with force caps. Branch/branch contacts are filtered out. The trunk is fixed; the window is a kinematic cuboid. Normal outer ticks use four 1/480-second native steps; rapid translation adds native steps, capped at 64 per outer tick.

ACTIVE limbs collide. OCCLUDED limbs have their attachment covered by the window plus a 0.5-render-unit early-release margin. WAIT_CLEAR limbs recover without window impulses until every descendant capsule has more than 0.003 m native clearance. Evaluate this policy at each intermediate native target. Never teleport branch links when changing state.

## Export and limits

JSON schema `ez-tree-window-lab/v3` includes scale, options, camera frame, rectangle, rest/current points, release states and native anchor metrics. Activation clearance null in JSON means Infinity in memory: no native contact within the query margin. The export is a pose/debug record, not a resumable Rapier checkpoint.

Simulation is CPU/WASM and rendering is Three/WebGL. Real macOS window tracking and Rapier native integration are separate work. Reduced capsules may overlap visible leaves/bark; fast reversals can still cause strong physical motion and finite native anchor error. Dynamic CCD, branch fracture and branch self-collision are not enabled.
