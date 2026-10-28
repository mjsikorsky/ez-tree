# Interface for the native agent

Keep the Metal conversion moving independently. This lab adds no requirement to
port its Three.js renderer. `solver.mjs` contains no renderer, DOM, or Three.js
dependency. Its CPU reference behavior can be ported after the interaction is
approved. This is a prototype, not a completed native collision implementation.

## Data boundary

Input at tree creation:

- Branch section arrays: rest origin xyz, radius, radial segment count.
- Parent attachment: parent branch ID, segment index, interpolation fraction.
- Original mesh vertices and normals. Bark uses exact generation ring order;
  leaves bind as rigid quads to nearest original 3D centerline segments.

Per fixed step (1/120 s): receive a foreground window rectangle `{x,y,width,height}`
in tree-world XY units. Y is up; convert desktop points/DPI and screen origin
before this boundary. Enumerating native windows, permissions, z-order, multiple
displays, actual occlusion and tracking are native integration work, not present
in this lab. One rectangular collider is currently supported.

Output: current section positions, local joint angles and angular velocities.
Meshes use the same segment transforms for bark and leaves. A native GPU path
can upload transforms and vertex bindings; CPU simulation is sufficient to begin.

## Reference motion

1. Apply damped springs to joint deformation angles, targeting zero (rest pose).
2. Forward-kinematics traversal anchors the trunk and attaches descendants to
   the interpolated parent segment. Projected segment lengths stay constant.
3. Bound accumulated deformation within each branch to `maxBend` radians.
4. Sample branch segments against the moving rectangle and lift contact toward
   its top using bounded Jacobian angle corrections. Sweep intermediate rectangle
   positions to reduce missed contact on fast drags (64 sweep cap).
5. Once the window covers a branch's attachment in X, stop applying collision
   constraints to that branch. It recovers behind the opaque foreground window.
6. Skin original bark rings and rigid leaf quads; rotate normals along with them.

Defaults are in `solver.mjs`; the UI initially uses a 35-degree per-branch bend
limit. The radius increases spring stiffness. All stiffness values are visual
tuning values, not calibrated wood mechanics.

## Known limits to preserve explicitly

- Top-edge lifting and attachment release are deliberate desktop animation
  rules. Hidden branches may intersect the window. Full nonpenetration is not
  promised, especially at the bend limit or for unreachable contact targets.
- No branch/branch, leaf/leaf, fracture, torsion, or real 3D window collision.
- Branch root attachments are inferred from the upstream parent-before-child
  generation order and exact 3D centerline proximity. The adapter rejects missing
  attachments. Production generation should emit explicit IDs instead.
- Bark is skinned by known ring layout, leaves by nearest segment per quad;
  production leaf generation should emit attachment IDs. Hard segment transforms
  are a reference; smooth GPU skin weights can improve junction appearance.
- This lab uses full-detail geometry. LODs need matching bindings.
- Very large discontinuous window moves beyond the sweep cap can skip contact;
  they still cannot stretch a branch or bend the anchored trunk.

## Verification contract

`solver.test.mjs` covers left/right lifting, fixed trunk, preserved lengths,
bounded curvature, parent attachments, recovery, trunk-cover release, fast
sweeps/reversal/resize, deterministic reset/export and timestep validation.
`Export pose + settings` writes schema `ez-tree-window-lab/v1`. Preserve source
seed/preset to reproduce the rest mesh. `window.lab` provides browser QA hooks
for `solver`, `tree`, `moveWindow`, `getRect`, `snapshot`, `setPaused`, `step`, `reset`.
