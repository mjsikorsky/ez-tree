import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
await build({entryPoints:[fileURLToPath(new URL('./entry.mjs',import.meta.url))],outfile:fileURLToPath(new URL('./three-vrm-springbone.mjs',import.meta.url)),bundle:true,format:'esm',external:['three'],legalComments:'inline',banner:{js:'// @pixiv/three-vrm-springbone 3.5.5, MIT; upstream 3caf7a21ee68f0d5dfa363ab3d577450bbf60136. See three-vrm-springbone/LICENSE.'}});
