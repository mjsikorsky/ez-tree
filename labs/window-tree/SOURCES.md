# Official references and lessons used

Research was completed before selecting the final Rapier setup.

- [Rapier JavaScript joint guide](https://rapier.rs/docs/user_guides/javascript/joints/): native joint anchors, axes, limits and motor setup.
- [Official joints example](https://github.com/dimforge/rapier.js/blob/master/testbed3d/src/demos/joints.ts), inspected blob 56546d7fabc77b6b505efb115dbb01e0953f9b31: constructing rigid-body chains with native joints. This lab adapts the setup pattern rather than copying the demo wholesale.
- [Official moving-platform example](https://github.com/dimforge/rapier.js/blob/master/testbed3d/src/demos/platform.ts), inspected blob fe51d9aeaf0df3513009c25eab21a03eb3fabb64: velocity-based kinematics. The lab uses the separately documented position-based kinematic API.
- [Rigid bodies](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/): use next kinematic targets so Rapier computes velocity, rather than teleporting the window on every tick.
- [Joint constraints](https://rapier.rs/docs/user_guides/javascript/joint_constraints/): impulse/multibody tradeoffs. This lab uses public impulse-joint motor APIs.
- [Integration parameters](https://rapier.rs/docs/user_guides/javascript/integration_parameters/): small timesteps, solver iterations and tolerances.
- [Common mistakes](https://rapier.rs/docs/user_guides/javascript/common_mistakes/): consistent scale, masses and inertias.
- [Collision detection](https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection/): native contact queries and filtering.

## Application-specific lessons

A rigid solid cannot both pass through a fixed trunk and keep attached branches in hard contact. Release is a deliberate desktop-occlusion policy; Rapier does not infer it.

Re-enabling a collider already embedded in the window recreates a deep contact and can cause a violent impulse. Entire limbs therefore wait until native capsule/box queries report clearance greater than 0.003 m. Shape expansion receives the same overlap guard.

Checking only the final cursor destination misses the trunk crossing while the kinematic collider travels there. Release/clearance checks must run before every native substep at the intermediate pose.

Very thin capsules, long joint chains, unequal inertias and abrupt target motion increased constraint error in experiments. The final lab uses two proxy links per generated branch, balanced explicit masses/inertias, bounded native motor force, small native substeps and native angle limits. These are tuned lab settings, not measured tree material properties.

The vendored 0.21.0 engine is the same byte-pinned distribution already present in Megatowers. Older 0.12 experiments are not shipped.
