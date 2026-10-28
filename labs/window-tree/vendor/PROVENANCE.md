# Vendored spring-bone package

Official package: `@pixiv/three-vrm-springbone`, version 3.5.5.
Source: https://github.com/pixiv/three-vrm
Pinned revision: `3caf7a21ee68f0d5dfa363ab3d577450bbf60136`.
License: MIT; included in `three-vrm-springbone/LICENSE`.

The source under `three-vrm-springbone/src` is unmodified upstream code (tests
excluded). `entry.mjs` selects the runtime joint/manager/collider classes.
`three-vrm-springbone.mjs` is the generated ESM runtime with Three.js external.
The generated runtime is checked in so running the lab needs no extra install.
Rebuild with `node labs/window-tree/vendor/build.mjs` (esbuild required).
The finite screen-window collider and EZ-Tree bridge are application adapters;
the integration, collision response, length projection and quaternion update are
provided by the upstream spring-bone implementation.
