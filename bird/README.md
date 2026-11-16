# Feather bird — standalone

Procedural Three.js bird extracted from Theo Tillberg's MIT-licensed
[Codevember 2026, day 12](https://github.com/ttillberg/codevember-2026/tree/f7618b3/12).
Keep `LICENSE` and `public/NOTICE.txt` with copies or distributions.

```sh
cd bird
npm ci
npm run dev
# Static files, including attribution: dist/
npm run build
npm run preview
```

Requires Node 22.12+ and a WebGL 2 browser. No backend, CDN, font service, model
download, account or paid service is needed. `dist/` uses relative asset URLs
and can be served from a subdirectory by any static HTTP server.

The default page uses the original species. `?species=proof` uses the temporary
amber/teal data experiment in `src/species/proof.ts`; it is not a final design.
Drag to orbit, move the pointer to attract attention, Space to startle.
Optional demo debug flags include `?quiet&pose=three`, `?bones`, `?skin` and
`?gaze=yaw,pitch,roll` (see `src/demo/debug.ts`).

Use the engine with an existing Three.js scene:

```ts
import { createBird, MOUNTAIN_GEM } from './src/engine';

const bird = createBird({ species: MOUNTAIN_GEM });
scene.add(bird.root);
// Each animation frame, elapsedSeconds must be finite and nonnegative:
bird.update(Math.max(0, Math.min(elapsedSeconds, 1 / 20)));
// When removing the component:
scene.remove(bird.root);
bird.dispose();
```

`createBird` owns geometry, rig, materials and behaviour. The host owns the
renderer, camera, lighting, animation loop and input. For a complete small host,
use `mountBirdScene(canvas, { species, pixelRatio? })` from `src/scene.ts` and
call its idempotent `dispose()` when unmounting. `src/demo/*`, `main.ts` and CSS
are optional; the engine has no DOM or URL dependency.

`npm run verify` checks the **built** static page under `/bird-preview/`, saves
screenshots and JSON metrics to `../bird-evidence/`, and checks behaviour,
data-only appearance changes and resource cleanup. It needs an installed
Chromium (`CHROMIUM_PATH=/path/to/chromium`); use `BIRD_SOFTWARE_GL=1` for
SwiftShader in a cloud environment. Software render FPS is not a GPU benchmark.

Full extraction notes, measured limits and screenshots: `../BIRD-EXTRACTION.md`.
