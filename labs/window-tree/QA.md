# Verification

- Five Node test groups pass: lifting from both sides; length/trunk/curvature
  invariants; release and recovery; attachment tracking; fast sweep/reversal/
  resize; deterministic reset/export and invalid timestep rejection.
- Chromium WebGL smoke checks pass on actual Oak Small (81 branches), Ash Small
  (56), and Pine Small (92) geometries. Each sweep produces visible displacement
  with projected length error below 1e-10 world units and curvature within 35°.
- Pointer dragging, corner resizing, keyboard motion, damping control, JSON
  download, and 390 px viewport checks pass without page errors.
- Vite production build passes. Offline HTML opens via file://, renders, and
  supports interaction without network requests or a local server.
- Browser checks used software WebGL in headless Chromium. The displayed CPU
  timing is a local diagnostic, not a Metal or Mac performance measurement.
- Build environment used available Vite 6.4.5 / Three.js dependencies; the
  upstream root package/lock were not changed. Run the documented commands on
  the native development machine to validate its exact installed environment.
- Native macOS window tracking and native Metal integration are not exercised.
