// Run after vite build. Creates an offline, double-clickable lab.
import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('./dist/',import.meta.url);
let html=await readFile(new URL('index.html',root),'utf8');
const script=html.match(/<script[^>]+src="([^"]+)"[^>]*><\/script>/);
const css=html.match(/<link[^>]+href="([^"]+\.css)"[^>]*>/);
if(!script||!css)throw Error('Expected a single JS and CSS bundle');
const resolve=path=>new URL(path.replace(/^\//,''),root);
const js=await readFile(resolve(script[1]),'utf8'),style=await readFile(resolve(css[1]),'utf8');
html=html.replace(script[0],()=>'<script type="module">'+js.replace(/<\/script/gi,'<\\/script')+'</script>');
html=html.replace(css[0],()=>'<style>'+style+'</style>');
const license=await readFile(new URL('./vendor/three-vrm-springbone/LICENSE',import.meta.url),'utf8');
html=html.replace('</head>',()=>`<!-- @pixiv/three-vrm-springbone 3.5.5; source revision 3caf7a21ee68f0d5dfa363ab3d577450bbf60136\n${license}\n-->\n</head>`);
await writeFile(new URL('Branch-Window-Lab.html',root),html);
console.log('Wrote labs/window-tree/dist/Branch-Window-Lab.html');
