import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {BranchSolver,initRapier} from './solver.mjs';
await initRapier();
const sec=(x,y,z=0)=>({origin:{x,y,z},radius:.1});
const fixture=()=>({branches:[{sections:[sec(0,0),sec(0,2),sec(0,4)]},{sections:[sec(0,2),sec(1,2.1,.1),sec(2,2.3,.2),sec(3,2.6,.3)]},{sections:[sec(2,2.3,.2),sec(2.5,2.8,.4),sec(3,3.2,.8)]}]});
const tick=(s,n,w=null)=>{for(let i=0;i<n;i++)s.step(1/120,w);};
test('Rapier 0.21 distribution matches the Megatowers integrity manifest',()=>{
 const bytes=readFileSync(new URL('./node_modules/@dimforge/rapier3d-compat/dist/rapier.mjs',import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),'02dc6a4e2fffc013bab08fbb44fa68f501d8303615e9afe4c7d89ad4eedda0d0');
});
test('native joints, motors and fixed trunk are active; rest does not drift',()=>{
 const s=new BranchSolver(fixture());assert.equal(s.engine,'@dimforge/rapier3d-compat@0.21.0');assert.ok(s.joints.length);assert.ok(s.joints.every(j=>typeof j.joint.configureMotorPosition==='function'));tick(s,400);assert.deepEqual(s.branches[0].points,s.branches[0].rest);assert.ok(s.metrics().maxDisplacement<1e-3);s.dispose();
});
test('moving kinematic box produces branch response and recovery',()=>{
 const s=new BranchSolver(fixture());for(let i=0;i<160;i++)s.step(1/120,{x:4-i*.015,y:1,width:1.2,height:1.5});assert.ok(s.metrics().maxDisplacement>.05);tick(s,1400);assert.ok(s.metrics().maxDisplacement<.05);assert.ok(s.metrics().jointError<.005);s.dispose();
});
test('whole limb releases together and remains disabled until clear',()=>{
 const s=new BranchSolver(fixture());tick(s,1,{x:-.2,y:1,width:1.3,height:2});assert.equal(s.groups[0].state,'OCCLUDED');assert.equal(s.branches[1].group,s.branches[2].group);
 tick(s,1,{x:.8,y:1,width:1.3,height:2});assert.equal(s.groups[0].state,'WAIT_CLEAR');assert.ok(s.branches[1].released&&s.branches[2].released);
 tick(s,1,{x:10,y:1,width:1.3,height:2});assert.equal(s.groups[0].state,'ACTIVE');assert.equal(s.deepReentries,0);assert.ok(s.activationEvents.every(e=>e.minClearance>.003));s.dispose();
});
test('reversal and moving/resizing through center remain finite',()=>{
 const s=new BranchSolver(fixture());tick(s,1,{x:-5,y:1,width:1,height:2});let error=0;for(let i=0;i<400;i++){s.step(1/120,{x:-5+Math.abs(200-i)*.04,y:1,width:1+(i%3)*.1,height:2});const m=s.metrics();assert.ok(Number.isFinite(m.maxDisplacement));error=Math.max(error,m.jointError);}assert.ok(error<.05);assert.ok(s.activationEvents.every(e=>e.minClearance>.003));s.dispose();
});
test('reset rebuilds native window shape and preserves parameters',()=>{
 const s=new BranchSolver(fixture());const w={x:-5,y:1,width:3,height:2};tick(s,1,w);s.reset();tick(s,1,w);assert.ok(Math.abs(s.windowCollider.shape.halfExtents.x-(.15+.006))<1e-6);assert.equal(s.options.stiffness,36);assert.equal(s.snapshot().schema,'ez-tree-window-lab/v3');assert.throws(()=>s.step(1),/fixed/);s.dispose();
});
