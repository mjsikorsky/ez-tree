import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Tree} from '../../src/lib/tree.js';
import {BranchSolver} from './solver.mjs';
import {bindGeometry,bindBarkGeometry,deformGeometry} from './adapter.js';

const $=id=>document.getElementById(id),stage=$('stage'),viewport=$('viewport'),win=$('window');
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-10,10,15,-2,0.1,500);
camera.position.z=100;
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);viewport.append(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=false;controls.minZoom=.25;controls.maxZoom=8;controls.screenSpacePanning=true;
const frame={origin:new THREE.Vector3(),right:new THREE.Vector3(),up:new THREE.Vector3()};
scene.add(new THREE.HemisphereLight(0xf9ffe9,0x58654e,2.1));
const light=new THREE.DirectionalLight(0xfff8dc,2.5);light.position.set(-15,25,40);scene.add(light);
let tree,solver,bindings,ghost,spines,box,sweep=null,paused=false,accumulator=0,previous=performance.now(),lastCost=0;
let seed=1042;

function leafMap(){const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(32,31,18,29,-0.25,0,Math.PI*2);ctx.fill();return new THREE.CanvasTexture(c);}
const map=leafMap();
function disposeTree(){if(!tree)return;scene.remove(tree,ghost,spines);for(const b of bindings)b.geometry.dispose();tree.branchesMesh.material.dispose();tree.leavesMesh.material.dispose();ghost.geometry.dispose();ghost.material.dispose();spines.geometry.dispose();spines.material.dispose();}
function setup(){
  disposeTree();tree=new Tree();tree.loadPreset($('preset').value);
  tree.options.seed=seed;tree.options.bark.textured=false;tree.options.leaves.map=map;tree.options.leaves.tint=0x718747;
  tree.generate();tree.branchesMesh.material.color.set(0x746149);
  // Contact animation owns the branch transform. Disable leaf-only shader wind.
  tree.leavesMesh.material.onBeforeCompile=()=>{};
  solver=new BranchSolver(tree.skeleton,{stiffness:+$('stiffness').value,damping:+$('damping').value/100,contactMargin:+$('padding').value/100});
  bindings=[bindBarkGeometry(tree.branchesMesh.geometry,solver,tree.skeleton),bindGeometry(tree.leavesMesh.geometry,solver,4)];
  scene.add(tree);box=new THREE.Box3().setFromObject(tree);
  const points=[];for(const b of solver.branches)for(let i=0;i<b.rest.length-1;i++)points.push(b.rest[i].x,b.rest[i].y,b.rest[i].z,b.rest[i+1].x,b.rest[i+1].y,b.rest[i+1].z);
  ghost=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(points,3)),new THREE.LineBasicMaterial({color:0x88a97c,transparent:true,opacity:.35,depthTest:false}));
  spines=new THREE.LineSegments(ghost.geometry.clone(),new THREE.LineBasicMaterial({color:0xd0a451,depthTest:false}));spines.renderOrder=10;scene.add(ghost,spines);
  ghost.visible=$('ghost').checked;spines.visible=$('skeleton').checked;
  fit();setWindow(24,Math.max(140,stage.clientHeight*.42),Math.min(280,stage.clientWidth*.42),205);
  accumulator=0;sweep=null;
  window.lab={solver,tree,camera,controls,getRect:worldRect,moveWindow:setWindow,snapshot:()=>solver.snapshot(),setPaused:v=>paused=v,step:(n=1)=>{for(let i=0;i<n;i++)solver.step(1/120,worldRect());updateMesh();},reset:()=>solver.reset(),frontView:()=>fit(true)};
}
function fit(reset=true){
  const width=stage.clientWidth,height=stage.clientHeight;renderer.setSize(width,height);
  const h=Math.max(8,(box.max.y-box.min.y)*1.34),span=Math.max(h*width/height,(box.max.x-box.min.x)*1.6);
  const cy=(box.max.y+box.min.y)/2,cx=(box.max.x+box.min.x)/2;
  camera.left=-span/2;camera.right=span/2;camera.top=span*height/width/2;camera.bottom=-span*height/width/2;
  if(reset){camera.zoom=1;controls.target.set(cx,cy,0);camera.position.set(cx,cy,100);camera.up.set(0,1,0);}
  camera.updateProjectionMatrix();controls.update();
}
function setWindow(x,y,width=win.offsetWidth,height=win.offsetHeight){
  win.style.width=Math.max(150,Math.min(stage.clientWidth,width))+'px';win.style.height=Math.max(100,Math.min(stage.clientHeight,height))+'px';
  win.style.left=Math.max(-win.offsetWidth+50,Math.min(stage.clientWidth-50,x))+'px';win.style.top=Math.max(65,Math.min(stage.clientHeight-90,y))+'px';
}
function worldRect(){
  frame.origin.copy(controls.target);frame.right.set(1,0,0).applyQuaternion(camera.quaternion);frame.up.set(0,1,0).applyQuaternion(camera.quaternion);solver.setFrame(frame);
  const s=stage.getBoundingClientRect(),r=win.getBoundingClientRect(),sx=(camera.right-camera.left)/camera.zoom/s.width,sy=(camera.top-camera.bottom)/camera.zoom/s.height;
  return {x:camera.left/camera.zoom+(r.left-s.left)*sx,y:camera.top/camera.zoom-(r.bottom-s.top)*sy,width:r.width*sx,height:r.height*sy};
}
function updateMesh(){for(const b of bindings)deformGeometry(b,solver);if(spines.visible){const out=spines.geometry.attributes.position.array;let k=0;for(const b of solver.branches)for(let i=0;i<b.points.length-1;i++)for(const p of [b.points[i],b.points[i+1]]){out[k++]=p.x;out[k++]=p.y;out[k++]=p.z;}spines.geometry.attributes.position.needsUpdate=true;}}
let drag=null;
win.addEventListener('pointerdown',e=>{sweep=null;win.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,left:win.offsetLeft,top:win.offsetTop,width:win.offsetWidth,height:win.offsetHeight,resize:e.target.id==='resize'};win.focus();});
win.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(drag.resize)setWindow(drag.left,drag.top,drag.width+dx,drag.height+dy);else setWindow(drag.left+dx,drag.top+dy);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])win.addEventListener(event,()=>drag=null);
win.addEventListener('keydown',e=>{const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(!moves[e.key])return;e.preventDefault();sweep=null;const [x,y]=moves[e.key],step=e.shiftKey?30:8;setWindow(win.offsetLeft+x*step,win.offsetTop+y*step);});
$('stiffness').addEventListener('input',()=>{solver.options.stiffness=+$('stiffness').value;$('stiffnessValue').value=$('stiffness').value;});
$('damping').addEventListener('input',()=>{solver.options.damping=+$('damping').value/100;$('dampingValue').value=solver.options.damping.toFixed(2);});
$('padding').addEventListener('input',()=>{solver.options.contactMargin=+$('padding').value/100;$('paddingValue').value=(+$('padding').value/100).toFixed(2);});
$('front').onclick=()=>fit(true);
for(const [id,factor] of [['zoomIn',1.25],['zoomOut',.8]])$(id).onclick=()=>{camera.zoom=THREE.MathUtils.clamp(camera.zoom*factor,.25,8);camera.updateProjectionMatrix();};
$('preset').addEventListener('change',setup);$('reset').onclick=setup;
$('skeleton').onchange=()=>spines.visible=$('skeleton').checked;$('ghost').onchange=()=>ghost.visible=$('ghost').checked;$('transparent').onchange=()=>win.classList.toggle('inspect',$('transparent').checked);
$('sweep').onclick=()=>{solver.reset();sweep={start:performance.now(),from:-win.offsetWidth+55,to:stage.clientWidth-55};};
$('export').onclick=()=>{const pose=solver.snapshot();pose.source={repository:'dgreenheck/ez-tree',commit:'dcf309bd86bd521083d9c70f01f2de45fdc7c457',preset:$('preset').value,seed};const blob=new Blob([JSON.stringify(pose,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ez-tree-window-pose.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);};
new ResizeObserver(()=>{if(box)fit(false);}).observe(stage);
function animate(now){requestAnimationFrame(animate);if(!solver)return;
  if(sweep){const t=Math.min(1,(now-sweep.start)/6500);setWindow(sweep.from+(sweep.to-sweep.from)*t,stage.clientHeight*.42);if(t===1)sweep=null;}
  accumulator=Math.min(accumulator+(now-previous)/1000,8/120);previous=now;
  const start=performance.now();if(!paused){while(accumulator>=1/120){solver.step(1/120,worldRect());accumulator-=1/120;}updateMesh();}else accumulator=0;
  lastCost=lastCost*.9+(performance.now()-start)*.1;
  renderer.render(scene,camera);
  const m=solver.metrics();$('stats').textContent=`${m.branches} branches · ${m.joints} spring joints · ${lastCost.toFixed(1)} ms CPU/frame · length error ${m.lengthError.toExponential(1)}`;
}
try{setup();requestAnimationFrame(animate);}catch(error){$('error').hidden=false;$('error').textContent=error.stack;throw error;}
