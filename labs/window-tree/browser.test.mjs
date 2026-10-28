// Optional: install playwright, or set PLAYWRIGHT_MODULE to its absolute module.
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=await createServer({configFile:new URL('./vite.config.js',import.meta.url).pathname});
await server.listen();
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const evidence={engine:'@pixiv/three-vrm-springbone@3.5.5',heldWindows:[],controls:[]};
try{
 const page=await browser.newPage({viewport:{width:1320,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8172');await page.waitForFunction(()=>!!window.lab);
 for(const preset of ['Oak Small','Ash Small','Pine Small']){
  await page.selectOption('#preset',preset);
  const holds=await page.evaluate(()=>{
   const l=window.lab;l.setPaused(true);const results=[];
   for(const x of [180,230,270,320]){
    l.reset();l.moveWindow(x,380,280,205);let last=null,maxTipStep=0;
    for(let i=0;i<1300;i++){
     l.step(1);const points=l.solver.branches.map(b=>({...b.points.at(-1)}));
     if(last&&i>=1000)points.forEach((p,j)=>maxTipStep=Math.max(maxTipStep,Math.hypot(p.x-last[j].x,p.y-last[j].y,p.z-last[j].z)));
     last=points;
    }
    results.push({x,maxTipStep,...l.solver.metrics()});
   }return results;
  });
  for(const hold of holds){assert.ok(hold.maxTipStep<.001,`${preset} held tip step ${hold.maxTipStep}`);assert.equal(hold.releaseTransitions,0);assert.ok(hold.lengthError<1e-10);}
  evidence.heldWindows.push({preset,holds});
 }
 await page.selectOption('#preset','Oak Small');await page.evaluate(()=>window.lab.setPaused(true));
 // Exercise camera gestures outside the DOM collider.
 const initial=await page.evaluate(()=>window.lab.camera.quaternion.toArray());
 await page.mouse.move(1140,300);await page.mouse.down();await page.mouse.move(1000,370,{steps:10});await page.mouse.up();
 assert.notDeepEqual(await page.evaluate(()=>window.lab.camera.quaternion.toArray()),initial);
 const beforeZoom=await page.evaluate(()=>window.lab.camera.zoom);await page.mouse.wheel(0,-300);await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>window.lab.camera.zoom)>beforeZoom);
 const beforePan=await page.evaluate(()=>window.lab.controls.target.toArray());await page.mouse.move(1120,300);await page.mouse.down({button:'right'});await page.mouse.move(1160,325,{steps:5});await page.mouse.up({button:'right'});assert.notDeepEqual(await page.evaluate(()=>window.lab.controls.target.toArray()),beforePan);
 // Verify 3D length preservation and finite pose while colliding after orbit.
 const orbit=await page.evaluate(()=>{const l=window.lab;l.reset();l.moveWindow(230,380);l.step(600);return{m:l.solver.metrics(),right:l.solver.frame.right.toArray()};});assert.ok(orbit.m.lengthError<1e-10);assert.ok(Number.isFinite(orbit.m.maxDisplacement));assert.ok(Math.abs(orbit.right[2])>.01);
 await page.click('#front');assert.equal(await page.evaluate(()=>window.lab.camera.zoom),1);assert.ok((await page.evaluate(()=>window.lab.camera.quaternion.toArray())).every((v,i)=>Math.abs(v-[0,0,0,1][i])<1e-10));
 await page.click('#zoomIn');assert.equal(await page.evaluate(()=>window.lab.camera.zoom),1.25);await page.click('#zoomOut');assert.equal(await page.evaluate(()=>window.lab.camera.zoom),1);
 evidence.controls.push('orbit','wheel zoom','right-drag pan','front view','zoom buttons','collision after orbit');
 // Drag the window without accidentally orbiting the tree.
 const q=await page.evaluate(()=>window.lab.camera.quaternion.toArray());const w=await page.locator('#window').boundingBox();
 await page.mouse.move(w.x+100,w.y+15);await page.mouse.down();await page.mouse.move(w.x+180,w.y+25,{steps:5});await page.mouse.up();assert.deepEqual(await page.evaluate(()=>window.lab.camera.quaternion.toArray()),q);
 const old=await page.locator('#window').boundingBox(),corner=await page.locator('#resize').boundingBox();await page.mouse.move(corner.x+3,corner.y+3);await page.mouse.down();await page.mouse.move(corner.x+50,corner.y+35,{steps:5});await page.mouse.up();assert.ok((await page.locator('#window').boundingBox()).width>old.width+25);
 await page.locator('#window').focus();const x=await page.locator('#window').evaluate(e=>e.offsetLeft);await page.keyboard.press('Shift+ArrowRight');assert.equal(await page.locator('#window').evaluate(e=>e.offsetLeft),x+30);
 for(const [id,value,expected]of [['stiffness','50',50],['damping','40',.4],['padding','12',.12]]){await page.locator('#'+id).fill(value);const key=id==='padding'?'contactMargin':id;assert.equal(await page.evaluate(key=>window.lab.solver.options[key],key),expected);}
 for(const id of ['ghost','skeleton','transparent']){await page.check('#'+id);assert.ok(await page.isChecked('#'+id));await page.uncheck('#'+id);}
 const downloading=page.waitForEvent('download');await page.click('#export');const download=await downloading;assert.equal(download.suggestedFilename(),'ez-tree-window-pose.json');
 await page.click('#reset');assert.ok(await page.evaluate(()=>window.lab.solver.metrics().maxDisplacement)<1e-9);
 // Manual sweeping, reversal and resize including discontinuous moves.
 const sweep=await page.evaluate(()=>{const l=window.lab;l.setPaused(true);let max=0;for(let i=0;i<300;i++){l.moveWindow(30+Math.abs(150-i)*5,350,240+(i%3)*20,200);l.step(2);max=Math.max(max,l.solver.metrics().maxDisplacement);}return{max,...l.solver.metrics()};});assert.ok(sweep.max>.1);assert.ok(sweep.lengthError<1e-10);assert.ok(Number.isFinite(sweep.maxDisplacement));
 evidence.controls.push('window drag isolation','resize','keyboard','three sliders','three toggles','pose export','reset','fast sweeps and reversal');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);evidence.controls.push('390px layout');
 assert.deepEqual(errors,[]);evidence.pageErrors=errors;
 await mkdir(new URL('./dist/',import.meta.url),{recursive:true});
 await writeFile(new URL('./dist/browser-evidence.json',import.meta.url),JSON.stringify(evidence,null,2));
 console.log(JSON.stringify({status:'passed',heldWindows:evidence.heldWindows.length*4,maxHeldTipStep:Math.max(...evidence.heldWindows.flatMap(p=>p.holds.map(h=>h.maxTipStep))),controls:evidence.controls},null,2));
}finally{await browser.close();await server.close();}
