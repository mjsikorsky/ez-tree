# Native integration boundary

Keep the Metal conversion independent. This lab now uses the **actual Pixiv
spring-bone engine**, replacing the previous custom angular IK dynamics.

## Engine

- `@pixiv/three-vrm-springbone` 3.5.5, MIT.
- Pinned upstream: `3caf7a21ee68f0d5dfa363ab3d577450bbf60136`.
- Unmodified source and license: `vendor/three-vrm-springbone/`.
- Runtime: `vendor/three-vrm-springbone.mjs`.
- `vendor/PROVENANCE.md` describes the selection and build command.

The upstream joint implements world/center-space Verlet inertia, drag, restoring
motion, length projection, collider correction and quaternion writeback. The
manager orders dependencies. No custom integration or IK projection remains.
The solver runs on CPU; no Metal shader rewrite is needed for rendering.
The JS/Three.js engine itself is not a drop-in native Swift/Metal library. A
native CPU port or an equivalent native implementation remains separate work.

## Tree and mesh data

`solver.mjs` builds ordinary Object3D joints from original XYZ section positions.
Trunk sections are static; other segments are managed Pixiv spring joints.
Parents are inferred from exact original 3D centerlines and parent-before-child
generation order. Production generation should emit explicit attachment IDs.

Each section exposes `currentWorldMatrix * inverseRestWorldMatrix` in
`branches[].transforms`. Bark uses known full-detail ring order, and each leaf
quad binds rigidly to a nearest original segment. Normals use the same rotation.
These are straightforward native skinning inputs; blend weights can improve
junction appearance. LOD meshes need corresponding bindings.

## Window collider and release

Each 1/120 s step receives `{x,y,width,height}` in the current camera's right/up
plane. A camera frame contains world `origin`, `right`, and `up`. The custom
`ScreenWindowShape` computes signed distance/normal to the finite rounded-by-
padding rectangle, extruded in camera depth. The upstream engine applies the
collision correction and restores bone length. This supports orbit, orthographic
zoom and pan; projection is no longer tied to world XY or a fixed front camera.

Release is an application policy: once the rectangle covers a branch's **resting**
attachment in camera X, its collider is disabled. A 0.12-world-unit hysteresis
band prevents edge chatter. Deformed attachment positions never drive release.
After release, the library springs recover behind the foreground DOM window.

Native window bounds, DPI/origin conversion, multiple displays, z-order and
occlusion remain native app integration work. The current lab has one window.

## Parameters and limitations

UI spring strength maps to upstream stiffness `/12`, scaled by base radius.
Damping is the library's `dragForce` fraction per fixed step (default 0.30).
Contact padding defaults to 0.06 world units. Gravity is zero. These are visual
tuning values rather than calibrated wood mechanics.

The upstream implementation checks tail spheres, not swept entire branches.
No CCD, global coupled rod solution, branch self-collision, hard bend/twist limit,
or guaranteed nonpenetration is provided. Occluded released branches may overlap
the rectangle. Changing the camera or teleporting the collider changes contact
geometry and can legitimately produce a transient response.

Pose export schema `ez-tree-window-lab/v2` records engine, camera frame, window,
settings, topology, current points and local quaternions. It is an inspection
snapshot, not a full resumable checkpoint of upstream private Verlet tail state.
Source seed/preset is included by the UI.

## Validation

Node tests cover actual engine use, full 3D lengths, fixed trunk, attachment
tracking, finite camera collider, release hysteresis, recovery, settling, reset
and export. Browser tests reproduce four stationary window placements on all
three presets, measure per-substep tip motion after settling, and exercise orbit,
zoom, pan, projected contact and UI controls. See `QA.md`.
