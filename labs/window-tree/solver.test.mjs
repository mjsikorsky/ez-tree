import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BranchSolver} from './solver.mjs';
const section=(x,y,radius=.1)=>({origin:{x,y,z:0},radius});
const fixture=()=>({branches:[{sections:[section(0,0,.5),section(0,2,.4),section(0,4,.3)]},{sections:[section(0,2),section(1,2),section(2,2),section(3,2)]},{sections:[section(0,2),section(-1,2),section(-2,2),section(-3,2)]},{sections:[section(2,2),section(2.5,2.5),section(3,3)]}]});
const tick=(s,n,w=null)=>{for(let i=0;i<n;i++)s.step(1/120,w);};
test('side contact lifts either branch; lengths, trunk and curvature stay constrained',()=>{
  for(const side of [-1,1]){const s=new BranchSolver(fixture(),{maxBend:.61});const window={x:side===1?1.4:-2.8,y:.8,width:1.4,height:1.5};tick(s,100,window);const b=s.branches[side===1?1:2];assert.ok(b.points[2].y>2.1,'branch must visibly lift');assert.deepEqual(s.branches[0].points,s.branches[0].rest);assert.ok(s.metrics().lengthError<1e-12);assert.ok(s.metrics().maxAngle<=.61+1e-12);}
});
test('recovery after moving away and after covering the trunk',()=>{
  for(const covering of [false,true]){const s=new BranchSolver(fixture());tick(s,60,{x:1.4,y:.8,width:1.4,height:1.5});assert.ok(s.metrics().maxDisplacement>.1);tick(s,1200,covering?{x:-.5,y:0,width:4,height:5}:null);assert.ok(s.metrics().maxDisplacement<1e-5);}
});
test('child follows its parent attachment exactly during deformation',()=>{
  const s=new BranchSolver(fixture());tick(s,60,{x:1.4,y:.8,width:1.4,height:1.5});const child=s.branches[3],a=child.parent,p=s.branches[a.branch].points;assert.ok(Math.hypot(child.points[0].x-(p[a.segment].x+(p[a.segment+1].x-p[a.segment].x)*a.t),child.points[0].y-(p[a.segment].y+(p[a.segment+1].y-p[a.segment].y)*a.t))<1e-12);
});
test('fast sweeps, resize and reversals remain finite and bounded',()=>{
 const s=new BranchSolver(fixture());for(let i=0;i<300;i++){s.step(1/120,{x:Math.sin(i*.3)*4,y:1,width:i%2?1.5:3,height:2});const m=s.metrics();assert.ok(Number.isFinite(m.maxDisplacement));assert.ok(m.lengthError<1e-12);assert.ok(m.maxAngle<=s.options.maxBend+1e-12);}
});
test('export preserves topology; reset is reproducible; invalid timestep rejected',()=>{
 const s=new BranchSolver(fixture());tick(s,40,{x:1.4,y:.8,width:1.4,height:1.5});const first=JSON.stringify(s.snapshot());s.reset();tick(s,40,{x:1.4,y:.8,width:1.4,height:1.5});assert.equal(JSON.stringify(s.snapshot()),first);assert.throws(()=>s.step(1),/fixed/);assert.ok(s.snapshot().branches[3].parent);
});
