// Optional: install playwright, or set PLAYWRIGHT_MODULE to its absolute module.
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=await createServer({configFile:new URL('./vite.config.js',import.meta.url).pathname});
await server.listen();
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const evidence={engine:'@dimforge/rapier3d-compat@0.21.0',crossings:[],controls:[]};
try{
 const page=await browser.newPage({viewport:{width:1320,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8172');await page.waitForFunction(()=>!!window.lab);if(process.env.TEST_MODE)await page.evaluate(m=>window.testMode=m,process.env.TEST_MODE);
 for(const preset of (process.env.TEST_PRESET?[process.env.TEST_PRESET]:['Oak Small','Ash Small','Pine Small'])){
  await page.selectOption('#preset',preset);
  const cases=await page.evaluate(()=>{
   const l=window.lab;l.setPaused(true);const results=[];
   for(const mode of (window.testMode?[window.testMode]:['left-right','right-left','reverse-center','resize-center'])){
    l.reset();l.moveWindow(mode==='right-left'?820:-200,380,280,205);l.step(2);
    let prior=null,maxStep=0,maxAnchor=0,maxDisplacement=0;
    for(let i=0;i<450;i++){
     const t=Math.min(i,300)/300;
     const x=mode==='right-left'?820-1020*t:mode==='reverse-center'?-200+1020*(t<.5?t*2:(1-t)*2):-200+1020*t;
     l.moveWindow(x,380,mode==='resize-center'?230+90*Math.sin(t*Math.PI):280,205);l.step(1);
     const m=l.solver.metrics();if(!Number.isFinite(m.maxDisplacement))throw Error(mode+' nonfinite '+i);
     maxAnchor=Math.max(maxAnchor,m.jointError);maxDisplacement=Math.max(maxDisplacement,m.maxDisplacement);
     const current=l.solver.branches.map(b=>({...b.points.at(-1)}));
     if(prior)current.forEach((p,j)=>maxStep=Math.max(maxStep,Math.hypot(p.x-prior[j].x,p.y-prior[j].y,p.z-prior[j].z)));prior=current;
    }
    if(l.solver.activationEvents.some(e=>!(e.minClearance>.003)))throw Error(mode+' overlapped re-entry');
    if(maxAnchor>.15)throw Error(mode+' anchor error '+maxAnchor);
    results.push({mode,maxStep,maxAnchor,maxDisplacement,reentries:l.solver.reentries,deepReentries:l.solver.deepReentries});
   }return results;
  });
  evidence.crossings.push({preset,cases});console.log(preset,JSON.stringify(cases));
 }
 await page.selectOption('#preset','Oak Small');await page.evaluate(()=>window.lab.setPaused(true));
 // Exercise camera gestures outside the DOM collider.
 const initial=await page.evaluate(()=>window.lab.camera.quaternion.toArray());
 await page.mouse.move(1140,300);await page.mouse.down();await page.mouse.move(1000,370,{steps:10});await page.mouse.up();
 assert.notDeepEqual(await page.evaluate(()=>window.lab.camera.quaternion.toArray()),initial);
 const beforeZoom=await page.evaluate(()=>window.lab.camera.zoom);await page.mouse.wheel(0,-300);await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>window.lab.camera.zoom)>beforeZoom);
 const beforePan=await page.evaluate(()=>window.lab.controls.target.toArray());await page.mouse.move(1120,300);await page.mouse.down({button:'right'});await page.mouse.move(1160,325,{steps:5});await page.mouse.up({button:'right'});assert.notDeepEqual(await page.evaluate(()=>window.lab.controls.target.toArray()),beforePan);
 // Verify 3D length preservation and finite pose while colliding after orbit.
 const orbit=await page.evaluate(()=>{const l=window.lab;l.reset();l.moveWindow(230,380);l.step(600);return{m:l.solver.metrics(),right:l.solver.frame.right.toArray()};});assert.ok(orbit.m.jointError<.15);assert.ok(Number.isFinite(orbit.m.maxDisplacement));assert.ok(Math.abs(orbit.right[2])>.01);
 await page.click('#front');assert.equal(await page.evaluate(()=>window.lab.camera.zoom),1);assert.ok((await page.evaluate(()=>window.lab.camera.quaternion.toArray())).every((v,i)=>Math.abs(v-[0,0,0,1][i])<1e-10));
 await page.click('#zoomIn');assert.equal(await page.evaluate(()=>window.lab.camera.zoom),1.25);await page.click('#zoomOut');assert.equal(await page.evaluate(()=>window.lab.camera.zoom),1);
 evidence.controls.push('orbit','wheel zoom','right-drag pan','front view','zoom buttons','collision after orbit');
 // Drag the window without accidentally orbiting the tree.
 const q=await page.evaluate(()=>window.lab.camera.quaternion.toArray());const w=await page.locator('#window').boundingBox();
 await page.mouse.move(w.x+100,w.y+15);await page.mouse.down();await page.mouse.move(w.x+180,w.y+25,{steps:5});await page.mouse.up();assert.deepEqual(await page.evaluate(()=>window.lab.camera.quaternion.toArray()),q);
 const old=await page.locator('#window').boundingBox(),corner=await page.locator('#resize').boundingBox();await page.mouse.move(corner.x+3,corner.y+3);await page.mouse.down();await page.mouse.move(corner.x+50,corner.y+35,{steps:5});await page.mouse.up();assert.ok((await page.locator('#window').boundingBox()).width>old.width+25);
 await page.locator('#window').focus();const x=await page.locator('#window').evaluate(e=>e.offsetLeft);await page.keyboard.press('Shift+ArrowRight');assert.equal(await page.locator('#window').evaluate(e=>e.offsetLeft),x+30);
 for(const [id,value,expected]of [['stiffness','50',50],['damping','18',18],['padding','12',.12]]){await page.locator('#'+id).fill(value);const key=id==='padding'?'contactMargin':id;assert.equal(await page.evaluate(key=>window.lab.solver.options[key],key),expected);}
 for(const id of ['ghost','skeleton','transparent']){await page.check('#'+id);assert.ok(await page.isChecked('#'+id));await page.uncheck('#'+id);}
 const downloading=page.waitForEvent('download');await page.click('#export');const download=await downloading;assert.equal(download.suggestedFilename(),'ez-tree-window-pose.json');
 await page.click('#reset');assert.ok(await page.evaluate(()=>window.lab.solver.metrics().maxDisplacement)<1e-4);
 // Manual sweeping, reversal and resize including discontinuous moves.
 const sweep=await page.evaluate(()=>{const l=window.lab;l.setPaused(true);let max=0;for(let i=0;i<300;i++){l.moveWindow(30+Math.abs(150-i)*5,350,240+(i%3)*20,200);l.step(2);max=Math.max(max,l.solver.metrics().maxDisplacement);}return{max,...l.solver.metrics()};});assert.ok(sweep.max>.1);assert.ok(sweep.jointError<.15);assert.ok(Number.isFinite(sweep.maxDisplacement));
 evidence.controls.push('window drag isolation','resize','keyboard','three sliders','three toggles','pose export','reset','fast sweeps and reversal');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);evidence.controls.push('390px layout');
 assert.deepEqual(errors,[]);evidence.pageErrors=errors;
 await mkdir(new URL('./evidence/',import.meta.url),{recursive:true});
 await writeFile(new URL('./evidence/browser-evidence.json',import.meta.url),JSON.stringify(evidence,null,2));
 console.log(JSON.stringify({status:'passed',crossings:evidence.crossings.length*4,maxAnchor:Math.max(...evidence.crossings.flatMap(p=>p.cases.map(c=>c.maxAnchor))),controls:evidence.controls},null,2));
}finally{await browser.close();await server.close();}
