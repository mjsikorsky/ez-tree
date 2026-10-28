import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BranchSolver,ScreenWindowShape} from './solver.mjs';
const section=(x,y,z=0,radius=.1)=>({origin:{x,y,z},radius});
const fixture=()=>({branches:[{sections:[section(0,0),section(0,2),section(0,4)]},{sections:[section(0,2),section(1,2.1,.1),section(2,2.3,.2),section(3,2.6,.3)]},{sections:[section(0,2),section(-1,2.1,.1),section(-2,2.3,.2),section(-3,2.6,.3)]},{sections:[section(2,2.3,.2),section(2.5,2.8,.4),section(3,3.2,.8)]}]});
const tick=(s,n,w=null)=>{for(let i=0;i<n;i++)s.step(1/120,w);};
test('actual Pixiv joints lift either branch and preserve full 3D lengths and trunk',()=>{
 for(const side of [-1,1]){const s=new BranchSolver(fixture());tick(s,300,{x:side===1?1.4:-2.8,y:.8,width:1.4,height:1.5});assert.equal(s.engine,'@pixiv/three-vrm-springbone@3.5.5');assert.ok(s.manager.joints.size>0);assert.ok(s.branches[side===1?1:2].points[2].y>2.4);assert.deepEqual(s.branches[0].points,s.branches[0].rest);assert.ok(s.metrics().lengthError<1e-12);}
});
test('release uses rest attachment and hysteresis, independent of deformed attachment motion',()=>{
 const s=new BranchSolver(fixture()),b=s.branches[3];
 tick(s,1,{x:1.5,y:.5,width:2,height:2});assert.equal(b.released,true);
 for(let i=0;i<80;i++){b.points[0].x=i%2?-100:100;s.step(1/120,{x:1.5,y:.5,width:2,height:2});}
 assert.equal(b.released,true);assert.equal(s.releaseTransitions,0);
 tick(s,1,{x:2.05,y:.5,width:2,height:2});assert.equal(b.released,true);
 tick(s,1,{x:2.3,y:.5,width:2,height:2});assert.equal(b.released,false);
});
test('springs recover after moving away and after the window covers attachments',()=>{
 for(const covering of [false,true]){const s=new BranchSolver(fixture());tick(s,300,{x:1.4,y:.8,width:1.4,height:1.5});assert.ok(s.metrics().maxDisplacement>.1);tick(s,2400,covering?{x:-.5,y:0,width:4,height:5}:null);assert.ok(s.metrics().maxDisplacement<1e-5);}
});
test('child attachment follows interpolated parent segment in XYZ',()=>{
 const s=new BranchSolver(fixture());tick(s,300,{x:1.4,y:.8,width:1.4,height:1.5});const c=s.branches[3],a=c.parent,p=s.branches[a.branch].points;
 for(const key of ['x','y','z'])assert.ok(Math.abs(c.points[0][key]-(p[a.segment][key]+(p[a.segment+1][key]-p[a.segment][key])*a.t))<1e-12);
});
test('finite screen collider rotates its response into the camera plane',()=>{
 const s=new BranchSolver(fixture()),b=s.branches[1];s.window={x:0,y:0,width:4,height:4};s.setFrame({origin:new THREE.Vector3(),right:new THREE.Vector3(0,0,-1),up:new THREE.Vector3(0,1,0)});
 const direction=new THREE.Vector3(),shape=new ScreenWindowShape(s,b);
 assert.ok(shape.calculateCollision(null,new THREE.Vector3(7,2,-.1),.1,direction)<0);
 assert.ok(direction.z>.99);assert.equal(direction.x,0);assert.ok(shape.calculateCollision(null,new THREE.Vector3(7,10,-2),.1,direction)>0);
});
test('rest and held contact settle; no binary release chatter',()=>{
 const s=new BranchSolver(fixture());tick(s,1000);assert.ok(s.metrics().maxDisplacement<1e-9);
 const w={x:1.4,y:.8,width:1.4,height:1.5};tick(s,1500,w);let max=0;
 for(let i=0;i<120;i++){const p=s.branches.map(b=>({...b.points.at(-1)}));s.step(1/120,w);s.branches.forEach((b,j)=>{const n=b.points.at(-1);max=Math.max(max,Math.hypot(n.x-p[j].x,n.y-p[j].y,n.z-p[j].z));});}
 assert.ok(max<1e-4,`stationary tip step ${max}`);assert.equal(s.releaseTransitions,0);
});
test('reset/export are deterministic; invalid timesteps rejected',()=>{
 const s=new BranchSolver(fixture());tick(s,40,{x:1.4,y:.8,width:1.4,height:1.5});const first=JSON.stringify(s.snapshot());s.reset();tick(s,40,{x:1.4,y:.8,width:1.4,height:1.5});assert.equal(JSON.stringify(s.snapshot()),first);assert.throws(()=>s.step(1),/fixed/);
});
